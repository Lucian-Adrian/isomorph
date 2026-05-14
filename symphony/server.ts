import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { Socket } from 'node:net';
import { buildIssueDetail, buildRuntimeSnapshot } from './dashboard-state.js';
import { renderDashboardHtml } from './dashboard.js';
import type { RuntimeStore } from './runtime-state.js';

interface StartServerInput {
  port: number;
  repoRoot?: string;
  workflowPath?: string;
  store?: RuntimeStore;
  onRefresh?: () => Promise<void> | void;
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown) {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    connection: 'close',
  });
  response.end(JSON.stringify(body));
}

function sendHtml(response: ServerResponse, statusCode: number, html: string) {
  response.writeHead(statusCode, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
    connection: 'close',
  });
  response.end(html);
}

function pathnameOf(request: IncomingMessage) {
  return new URL(request.url ?? '/', 'http://localhost').pathname;
}

export async function startSymphonyServer(input: StartServerInput) {
  const repoRoot = input.repoRoot ?? process.cwd();
  const snapshotInput = {
    repoRoot,
    workflowPath: input.workflowPath,
    serverPort: input.port,
    store: input.store,
  };
  const sockets = new Set<Socket>();

  const server = createServer(async (request, response) => {
    const path = pathnameOf(request);
    if (request.method === 'GET' && path === '/') {
      sendHtml(response, 200, renderDashboardHtml(buildRuntimeSnapshot(snapshotInput)));
      return;
    }
    if (request.method === 'GET' && path === '/api/v1/state') {
      sendJson(response, 200, buildRuntimeSnapshot(snapshotInput));
      return;
    }
    if (request.method === 'POST' && path === '/api/v1/refresh') {
      await input.onRefresh?.();
      sendJson(response, 202, {
        accepted: true,
        generated_at: new Date().toISOString(),
      });
      return;
    }
    if (request.method === 'GET' && path === '/healthz') {
      const state = buildRuntimeSnapshot(snapshotInput);
      sendJson(response, state.health.status === 'error' ? 503 : 200, {
        status: state.health.status,
        generated_at: state.generated_at,
      });
      return;
    }
    if (request.method === 'GET' && path.startsWith('/api/v1/')) {
      const identifier = decodeURIComponent(path.slice('/api/v1/'.length));
      if (!identifier || identifier === 'refresh' || identifier === 'state') {
        sendJson(response, 404, {
          error: { code: 'not_found', message: 'Unknown Symphony API route.' },
        });
        return;
      }
      const detail = buildIssueDetail(snapshotInput, identifier);
      if (!detail) {
        sendJson(response, 404, {
          error: {
            code: 'issue_not_found',
            message: `No runtime state found for issue ${identifier}.`,
          },
        });
        return;
      }
      sendJson(response, 200, detail);
      return;
    }
    if (request.method === 'GET' && path === '/favicon.ico') {
      response.writeHead(204);
      response.end();
      return;
    }
    sendJson(response, 404, {
      error: { code: 'not_found', message: 'Unknown Symphony route.' },
    });
  });
  server.on('connection', socket => {
    sockets.add(socket);
    socket.on('close', () => {
      sockets.delete(socket);
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(input.port, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('invalid_symphony_server_address');
  }

  return {
    port: address.port,
    origin: `http://127.0.0.1:${address.port}`,
    close() {
      return new Promise<void>((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
        for (const socket of sockets) socket.destroy();
      });
    },
  };
}
