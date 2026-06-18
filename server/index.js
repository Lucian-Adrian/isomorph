require('dotenv').config();
const WebSocket = require('ws');
const http = require('http');
const url = require('url');
const { setupWSConnection, setPersistence } = require('y-websocket/bin/utils');
const { createClient } = require('@supabase/supabase-js');

const port = process.env.PORT || 1234;
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'placeholder';

// JWT secret for verifying Supabase access tokens
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET || '';

const supabase = createClient(supabaseUrl, supabaseKey);

// ─── Rate Limiting ──────────────────────────────────────────────────────────
const rateLimitMap = new Map(); // IP -> { count, resetAt }
const RATE_LIMIT = 30; // max requests per window
const RATE_WINDOW = 60_000; // 1 minute

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

// Clean up stale rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(ip);
  }
}, 5 * 60_000);

// ─── Room Connection Tracking ───────────────────────────────────────────────
const roomConnections = new Map(); // roomName -> Set<WebSocket>
const MAX_CONNECTIONS_PER_ROOM = 8;

// ─── Persistence ────────────────────────────────────────────────────────────
setPersistence({
  bindState: async (docName, ydoc) => {
    console.log(`Binding state for document: ${docName}`);
    try {
      // Fetch the latest state from the database
      const { data, error } = await supabase
        .from('diagrams')
        .select('content')
        .eq('id', docName)
        .single();

      if (error) {
        console.error(`Error loading diagram ${docName}:`, error.message);
        return;
      }

      if (data && data.content && data.content.source) {
        const text = ydoc.getText('source');
        // Only load if the document is empty
        if (text.toString() === '') {
          text.insert(0, data.content.source);
        }
      }
    } catch (err) {
      console.error(`Failed to bind state for ${docName}`, err);
    }
  },
  writeState: async (docName, ydoc) => {
    console.log(`Writing state for document: ${docName}`);
    try {
      const source = ydoc.getText('source').toString();
      
      // Update only the source field inside the jsonb content
      // We will fetch existing content first to avoid overwriting other fields.
      const { data: existing } = await supabase
        .from('diagrams')
        .select('content')
        .eq('id', docName)
        .single();
        
      const updatedContent = existing && existing.content ? { ...existing.content, source } : { source };

      const { error } = await supabase
        .from('diagrams')
        .update({ content: updatedContent, updated_at: new Date().toISOString() })
        .eq('id', docName);

      if (error) {
        console.error(`Failed to save diagram ${docName} to Supabase:`, error.message);
      } else {
        console.log(`Saved diagram ${docName} successfully.`);
      }
    } catch (err) {
      console.error(`Error writing state for ${docName}`, err);
    }
  }
});

// ─── HTTP Server ────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:4173').split(',').map(s => s.trim());

const server = http.createServer((request, response) => {
  // CORS: restrict to allowed origins
  const origin = request.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin);
  }
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }

  // Rate limit check
  const ip = request.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(ip)) {
    response.writeHead(429, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: 'Too many requests' }));
    return;
  }

  response.writeHead(200, { 'Content-Type': 'text/plain' });
  response.end('Isomorph Collaboration Server OK');
});

// ─── JWT Verification Helper ────────────────────────────────────────────────
let jwt;
try {
  jwt = require('jsonwebtoken');
} catch {
  console.warn('jsonwebtoken not installed — JWT verification disabled. Run: npm install jsonwebtoken');
}

function verifyToken(token) {
  if (!jwt || !JWT_SECRET) {
    // If JWT verification is not configured, allow connections (dev mode)
    console.warn('JWT verification skipped (no secret configured)');
    return { sub: 'unverified' };
  }
  return jwt.verify(token, JWT_SECRET);
}

// ─── WebSocket Server ───────────────────────────────────────────────────────
const wss = new WebSocket.Server({ server });

wss.on('connection', (conn, req) => {
  const parsedUrl = url.parse(req.url, true);
  const token = parsedUrl.query.token;
  const ip = req.socket.remoteAddress || 'unknown';

  // Extract room name from URL path (e.g., /roomName)
  const roomName = parsedUrl.pathname ? parsedUrl.pathname.replace(/^\/+/, '') : 'default';

  // ── Concurrency limit ──
  const roomSet = roomConnections.get(roomName) || new Set();
  if (roomSet.size >= MAX_CONNECTIONS_PER_ROOM) {
    console.log(`Room ${roomName} full (${roomSet.size}/${MAX_CONNECTIONS_PER_ROOM}). Rejecting connection from ${ip}`);
    conn.close(4029, 'Room full (8/8)');
    return;
  }

  // ── Authentication ──
  // Allow anonymous access for share links (they pass a share token)
  if (token && token.startsWith('share:')) {
    // Share token — anonymous access allowed
    console.log(`Anonymous share connection to room ${roomName} from ${ip}`);
  } else if (token) {
    // JWT token — verify
    try {
      const decoded = verifyToken(token);
      console.log(`Authenticated connection to room ${roomName}: ${decoded.sub} from ${ip}`);
    } catch (err) {
      console.log(`Invalid token for room ${roomName} from ${ip}: ${err.message}`);
      conn.close(4003, 'Invalid token');
      return;
    }
  } else {
    // No token at all — in dev mode allow, in production this should reject
    if (JWT_SECRET) {
      console.log(`No token provided for room ${roomName} from ${ip}. Rejecting.`);
      conn.close(4001, 'Authentication required');
      return;
    }
    console.log(`Unauthenticated connection to room ${roomName} from ${ip} (dev mode)`);
  }

  // ── Track connection ──
  roomSet.add(conn);
  roomConnections.set(roomName, roomSet);
  console.log(`Room ${roomName}: ${roomSet.size}/${MAX_CONNECTIONS_PER_ROOM} connections`);

  conn.on('close', () => {
    roomSet.delete(conn);
    if (roomSet.size === 0) {
      roomConnections.delete(roomName);
    } else {
      console.log(`Room ${roomName}: ${roomSet.size}/${MAX_CONNECTIONS_PER_ROOM} connections`);
    }
  });

  setupWSConnection(conn, req, { gc: true });
});

server.listen(port, () => {
  console.log(`y-websocket listening on port ${port}`);
  if (!JWT_SECRET) {
    console.warn('⚠ SUPABASE_JWT_SECRET not set — running in dev mode (no auth enforcement)');
  }
});
