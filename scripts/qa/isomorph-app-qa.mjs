import { mkdir, appendFile, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile, spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { chromium } from 'playwright';
import { runLiveSupabaseContract } from './supabase-live-contract.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const artifactDir = resolve(repoRoot, 'artifacts', 'qa');
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const logPath = resolve(artifactDir, `isomorph-app-qa-${runId}.jsonl.log`);

const qaPort = process.env.QA_PORT ?? String(4173 + Math.floor(Math.random() * 1000));
const baseUrl = process.env.QA_BASE_URL ?? `http://127.0.0.1:${qaPort}/isomorph/app/`;
const headless = process.env.QA_HEADLESS !== '0';
const slowMo = Number.parseInt(process.env.QA_SLOW_MO ?? '0', 10) || 0;
const shouldAutoStart = process.env.QA_AUTO_START !== '0';

async function log(event) {
  await mkdir(artifactDir, { recursive: true });
  await appendFile(logPath, `${JSON.stringify({ ts: new Date().toISOString(), ...event })}\n`, 'utf8');
}

async function step(name, fn) {
  const started = Date.now();
  await log({ type: 'step:start', name });
  try {
    const details = await fn();
    await log({ type: 'step:ok', name, durationMs: Date.now() - started, details });
    return details;
  } catch (error) {
    await log({
      type: 'step:fail',
      name,
      durationMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

async function clickFirst(page, candidates, description) {
  for (const locator of candidates) {
    const count = await locator.count().catch(() => 0);
    if (count > 0) {
      const first = locator.first();
      if (await first.isVisible().catch(() => false)) {
        await first.click();
        return;
      }
    }
  }
  throw new Error(`Could not find ${description}`);
}

async function ensureEditorSource(page, source) {
  const editor = page.locator('.cm-content').first();
  await editor.waitFor({ state: 'visible', timeout: 10_000 });
  await editor.click();
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await page.keyboard.insertText(source);
  await page.waitForTimeout(200);
}

async function visibleText(page, pattern) {
  return page.getByText(pattern).first().isVisible().catch(() => false);
}

async function readCanvasState(page) {
  return page.evaluate(() => {
    const activeKey = document.querySelector('.iso-full-canvas-shell')?.getAttribute('data-canvas-storage-key');
    const canvasKeys = Object.keys(localStorage)
      .filter(key => key.startsWith('isomorph-canvas:'));
    if (activeKey && canvasKeys.includes(activeKey)) {
      const value = localStorage.getItem(activeKey) ?? '';
      if (value.trim().length === 0) return { key: activeKey, state: { elements: [], selectedElementIds: [] } };
      try {
        return { key: activeKey, state: JSON.parse(value) };
      } catch {
        return { key: activeKey, state: { elements: [], selectedElementIds: [] } };
      }
    }
    const entries = canvasKeys
      .filter(key => key.startsWith('isomorph-canvas:'))
      .map(key => ({ key, value: localStorage.getItem(key) ?? '' }))
      .filter(entry => entry.value.trim().length > 0)
      .flatMap(entry => {
        try {
          return [{ key: entry.key, state: JSON.parse(entry.value) }];
        } catch {
          return [];
        }
      });
    if (entries.length === 0 && canvasKeys.length > 0) {
      return { key: canvasKeys[0], state: { elements: [], selectedElementIds: [] } };
    }
    if (entries.length === 0) throw new Error('No persisted isomorph-canvas:* localStorage entries found.');
    return entries.sort((a, b) => b.state.elements.length - a.state.elements.length)[0];
  });
}

async function readCanvasElements(page) {
  return (await readCanvasState(page)).state.elements;
}

async function canvasStateHas(page, predicateSource) {
  const sourceText = predicateSource.toString();
  return page.evaluate((source) => {
    const predicate = new Function('state', `return (${source})(state);`);
    const activeKey = document.querySelector('.iso-full-canvas-shell')?.getAttribute('data-canvas-storage-key');
    const keys = activeKey ? [activeKey] : Object.keys(localStorage).filter(key => key.startsWith('isomorph-canvas:'));
    return keys
      .filter(key => key.startsWith('isomorph-canvas:'))
      .map(key => localStorage.getItem(key))
      .filter(Boolean)
      .some(value => predicate(JSON.parse(value)));
  }, sourceText);
}

async function dispatchOverlayPointer(page, type, x, y, pointerId = 41) {
  await page.locator('.iso-freeform-overlay').first().evaluate((element, eventInit) => {
    const rect = element.getBoundingClientRect();
    element.dispatchEvent(new PointerEvent(eventInit.type, {
      bubbles: true,
      cancelable: true,
      pointerId: eventInit.pointerId,
      pointerType: 'mouse',
      clientX: rect.left + eventInit.x,
      clientY: rect.top + eventInit.y,
      buttons: eventInit.type === 'pointerup' ? 0 : 1,
      button: 0,
    }));
  }, { type, x, y, pointerId });
}

async function dispatchLocatorPointer(locator, type, pointerId = 41) {
  await locator.evaluate((element, eventInit) => {
    const rect = element.getBoundingClientRect();
    element.dispatchEvent(new PointerEvent(eventInit.type, {
      bubbles: true,
      cancelable: true,
      pointerId: eventInit.pointerId,
      pointerType: 'mouse',
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
      buttons: eventInit.type === 'pointerup' ? 0 : 1,
      button: 0,
    }));
  }, { type, pointerId });
}

async function clickCanvasToolbarTool(page, label) {
  const button = page.locator('.iso-full-canvas-toolbar').getByRole('button', { name: label });
  await button.click();
  await page.waitForTimeout(150);
}

async function overlayClientRect(page) {
  return page.locator('.iso-freeform-overlay').first().evaluate(element => {
    const rect = element.getBoundingClientRect();
    return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
  });
}

async function overlayCanvasPointToClient(page, point) {
  const rect = await overlayClientRect(page);
  const transform = await page.locator('.iso-freeform-overlay g').first().evaluate(element => (
    element.getAttribute('transform')
    || element.style.transform
    || element.getAttribute('style')
    || ''
  ));
  const translate = /translate\(([-\d.]+)(?:px)?,\s*([-\d.]+)(?:px)?\)/.exec(transform);
  const scaleMatch = /scale\(([-\d.]+)\)/.exec(transform);
  const panX = translate ? Number(translate[1]) : 0;
  const panY = translate ? Number(translate[2]) : 0;
  const scale = scaleMatch ? Number(scaleMatch[1]) : 1;
  return {
    x: rect.x + panX + point.x * scale,
    y: rect.y + panY + point.y * scale,
  };
}

async function clickMoreMenuItem(page, itemPattern, description) {
  const moreButtons = page.getByRole('button', { name: /^More$/i });
  const count = await moreButtons.count();
  let openedWorkspaceMenu = false;
  for (let i = count - 1; i >= 0; i--) {
    await moreButtons.nth(i).click().catch(() => {});
    openedWorkspaceMenu = await page
      .getByRole('menu', { name: /workspace more actions/i })
      .isVisible()
      .catch(() => false);
    if (openedWorkspaceMenu) break;
  }
  if (!openedWorkspaceMenu) {
    await clickFirst(page, [
      page.getByRole('button', { name: /^More$/i }),
      page.locator('button').filter({ hasText: /^More$/i }),
    ], 'More button');
  }
  await clickFirst(page, [
    page.getByRole('menuitem', { name: itemPattern }),
    page.locator('[role="menuitem"]').filter({ hasText: itemPattern }),
  ], description);
}

function readPngDimensions(buffer) {
  const signature = '89504e470d0a1a0a';
  if (buffer.subarray(0, 8).toString('hex') !== signature) {
    throw new Error('Downloaded PNG does not have a valid PNG signature.');
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

async function triggerDownloadFromMenu(page, itemPattern, description) {
  const downloadPromise = page.waitForEvent('download', { timeout: 10_000 });
  await clickMoreMenuItem(page, itemPattern, description);
  return downloadPromise;
}

async function clickFullCanvasMenuItem(page, itemPattern, description) {
  await clickFirst(page, [
    page.locator('.iso-full-canvas-dock').getByRole('button', { name: /^More$/i }),
  ], 'full-canvas More button');
  await page.locator('.iso-full-canvas-menu').first().waitFor({ state: 'visible', timeout: 10_000 });
  await clickFirst(page, [
    page.locator('.iso-full-canvas-menu [role="menuitem"]').filter({ hasText: itemPattern }),
  ], description);
}

async function triggerDownloadFromFullCanvasMenu(page, itemPattern, description) {
  const downloadPromise = page.waitForEvent('download', { timeout: 10_000 });
  await clickFullCanvasMenuItem(page, itemPattern, description);
  return downloadPromise;
}

async function triggerDownloadFromFullCanvasAction(page, itemPattern, description) {
  const downloadPromise = page.waitForEvent('download', { timeout: 10_000 });
  await clickFirst(page, [
    page.locator('.iso-full-canvas-actions').getByRole('button', { name: itemPattern }),
  ], description);
  return downloadPromise;
}

async function openCanvasMoreTools(page) {
  await clickFirst(page, [
    page.locator('.iso-full-canvas-toolbar').getByRole('button', { name: /more tools/i }),
    page.locator('.iso-full-canvas-dock').getByRole('button', { name: /^More$/i }),
  ], 'canvas more tools button');
  await page.locator('.iso-full-canvas-tool-menu').first().waitFor({ state: 'visible', timeout: 10_000 });
}

async function closeWorkspaceSurface(page) {
  await clickFirst(page, [
    page.getByRole('button', { name: /close workspace panel/i }),
    page.getByRole('button', { name: /close account and cloud/i }),
  ], 'workspace surface close button');
}

async function isReachable(url) {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

async function startDevServerIfNeeded() {
  if (!shouldAutoStart || await isReachable(baseUrl)) return null;
  await log({ type: 'server:start', command: `npm run dev -- --host 127.0.0.1 --port ${qaPort} --strictPort` });
  const command = process.platform === 'win32' ? 'cmd.exe' : 'npm';
  const args = process.platform === 'win32'
    ? ['/c', 'npm', 'run', 'dev', '--', '--host', '127.0.0.1', '--port', qaPort, '--strictPort']
    : ['run', 'dev', '--', '--host', '127.0.0.1', '--port', qaPort, '--strictPort'];
  const child = spawn(command, args, {
    cwd: repoRoot,
    shell: false,
    env: {
      ...process.env,
      VITE_SUPABASE_URL: process.env.QA_LIVE_SUPABASE === '1' ? process.env.VITE_SUPABASE_URL : '',
      VITE_SUPABASE_PUBLISHABLE_KEY: process.env.QA_LIVE_SUPABASE === '1' ? process.env.VITE_SUPABASE_PUBLISHABLE_KEY : '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', chunk => {
    void log({ type: 'server:stdout', text: String(chunk).trim() });
  });
  child.stderr.on('data', chunk => {
    void log({ type: 'server:stderr', text: String(chunk).trim() });
  });

  const started = Date.now();
  while (Date.now() - started < 30_000) {
    if (await isReachable(baseUrl)) return child;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  child.kill();
  throw new Error(`Timed out waiting for ${baseUrl}`);
}

async function stopDevServer(child) {
  if (!child) return;
  if (process.platform === 'win32' && child.pid) {
    await new Promise(resolve => {
      execFile('taskkill', ['/pid', String(child.pid), '/T', '/F'], () => resolve());
    });
    return;
  }
  child.kill();
}

async function runLiveSupabaseContractIfRequested() {
  if (process.env.QA_LIVE_SUPABASE !== '1') {
    await log({ type: 'supabase-live:skip', reason: 'QA_LIVE_SUPABASE is not 1' });
    return;
  }
  await log({ type: 'supabase-live:start' });
  await runLiveSupabaseContract({
    log: async (name, details) => log({ type: 'supabase-live:step', name, details }),
  });
  await log({ type: 'supabase-live:ok' });
}

const qaSource = `diagram QaHarness : class {

  class Gateway {
    +id: String
  }
  class Service {
    +call(): void
  }

  Gateway --> Service [label="calls"]

  @Gateway at (120, 120)
  @Service at (380, 120)

}
`;

const accountMenuItemPattern = /^(?:Account|Account \/ Sync|Account & Cloud|Cloud|Sync)$/i;

let browser;
let devServer;
const svgAttributeErrors = [];
const reactConsoleFailures = [];
try {
  await log({
    type: 'run:start',
    baseUrl,
    headless,
    note: 'JSONL content is written to a *.log path so the existing git ignore rule excludes generated QA logs.',
  });

  await step('live Supabase contract if enabled', runLiveSupabaseContractIfRequested);

  devServer = await startDevServerIfNeeded();

  browser = await chromium.launch({ headless, slowMo });
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 960 } });
  const page = await context.newPage();

  page.on('console', message => {
    const text = message.text();
    if (/Expected length, "NaN"|attribute .*NaN/i.test(text)) {
      svgAttributeErrors.push(text);
    }
    if (/Maximum update depth exceeded/i.test(text)) {
      reactConsoleFailures.push(text);
      Promise.all(message.args().map(arg => arg.jsonValue().catch(() => arg.toString())))
        .then(args => {
          console.error("=== REACT WARNING DETAILS ===");
          console.error("Text:", text);
          console.error("Args:", args);
          console.error("=============================");
        });
    }
    void log({ type: 'browser:console', level: message.type(), text });
  });
  page.on('pageerror', error => {
    void log({ type: 'browser:pageerror', error: error.message });
  });

  await step('navigate /isomorph/app/', async () => {
    const response = await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 30_000 });
    if (!response?.ok()) {
      throw new Error(`Navigation returned ${response?.status() ?? 'no response'}`);
    }
    await page.getByText('Isomorph').first().waitFor({ timeout: 10_000 });
    return { title: await page.title(), url: page.url() };
  });

  await step('pure canvas route works without a parsed diagram', async () => {
    await page.evaluate(() => {
      Object.keys(localStorage)
        .filter(key => key.startsWith('isomorph-canvas:'))
        .forEach(key => localStorage.removeItem(key));
    });
    const emptySelect = page.locator('.iso-empty-state select').first();
    if (await emptySelect.isVisible().catch(() => false)) {
      await emptySelect.selectOption('class');
      await clickFirst(page, [
        page.getByRole('button', { name: /create/i }),
        page.getByText(/create/i),
      ], 'empty-state create button for pure canvas check');
    }
    await ensureEditorSource(page, 'not a valid diagram yet');
    await clickFirst(page, [
      page.getByRole('button', { name: /^Canvas$/i }),
      page.locator('button').filter({ hasText: /^Canvas$/i }),
    ], 'Canvas route button without a parsed diagram');
    await page.waitForFunction(() => window.location.hash === '#/canvas');
    await page.locator('.iso-full-canvas-shell').first().waitFor({ state: 'visible', timeout: 10_000 });
    const rectangleButton = page.locator('.iso-full-canvas-toolbar').getByRole('button', { name: 'Rectangle' });
    if (await rectangleButton.isDisabled()) {
      throw new Error('Expected Rectangle tool to remain enabled when no parsed diagram exists.');
    }
    await rectangleButton.click();
    const overlay = page.locator('.iso-freeform-overlay').first();
    const overlayBox = await overlay.boundingBox();
    if (!overlayBox) {
      throw new Error('Expected pure canvas freeform overlay to have a measurable box.');
    }
    await page.mouse.move(overlayBox.x + 96, overlayBox.y + 120);
    await page.mouse.down();
    await page.mouse.move(overlayBox.x + 246, overlayBox.y + 220, { steps: 8 });
    await page.mouse.up();
    const canvasEntry = await readCanvasState(page);
    if (!canvasEntry.state.elements.some(element => element.kind === 'rectangle')) {
      throw new Error(`Expected pure canvas Rectangle tool to create an element. elements=${JSON.stringify(canvasEntry.state.elements)}`);
    }
    await clickFirst(page, [
      page.getByRole('button', { name: /^Back$/i }),
      page.locator('button').filter({ hasText: /^Back$/i }),
    ], 'Back button after pure canvas check');
    await page.waitForFunction(() => window.location.hash === '#/app');
    return { pureCanvasElements: canvasEntry.state.elements.length };
  });

  await step('create class diagram', async () => {
    const emptySelect = page.locator('.iso-empty-state select').first();
    if (await emptySelect.isVisible().catch(() => false)) {
      await emptySelect.selectOption('class');
      await clickFirst(page, [
        page.getByRole('button', { name: /create/i }),
        page.getByText(/create/i),
      ], 'empty-state create button');
    }
    await ensureEditorSource(page, qaSource);
    await page.locator('.iso-canvas-wrap svg, svg').first().waitFor({ state: 'visible', timeout: 10_000 });
    return {
      hasGateway: await visibleText(page, /Gateway/),
      svgCount: await page.locator('svg').count(),
    };
  });

  await step('codegen opens as an overlay and generates output', async () => {
    await clickFirst(page, [
      page.getByRole('button', { name: /Generate code|Generate/i }),
      page.locator('button').filter({ hasText: /Generate/i }),
    ], 'Generate button');
    await page.getByText(/Generated Code/i).first().waitFor({ timeout: 10_000 });
    await page.locator('textarea').first().waitFor({ state: 'visible', timeout: 10_000 });
    await page.waitForFunction(() => {
      const value = document.querySelector('textarea')?.value ?? '';
      return value.trim().length > 0;
    });
    const output = await page.locator('textarea').first().inputValue();
    await page.getByRole('button', { name: /close workspace panel/i }).click();
    return { codegenChars: output.length, preview: output.slice(0, 80) };
  });

  await step('cloud and metrics are hidden behind workspace overlays', async () => {
    const sidebarHasCloud = await page.locator('main').getByText(/^Cloud$/).isVisible().catch(() => false);
    const sidebarHasMetrics = await page.locator('main').getByText(/^Metrics$/).isVisible().catch(() => false);
    if (sidebarHasCloud || sidebarHasMetrics) {
      throw new Error('Cloud/Metrics should not be permanently visible in the IDE sidebar.');
    }
    await clickMoreMenuItem(page, accountMenuItemPattern, 'Account, Cloud, or Sync menu item');
    await page.getByRole('dialog', { name: /account and cloud sync/i }).waitFor({ timeout: 10_000 });
    await closeWorkspaceSurface(page);

    await clickMoreMenuItem(page, /^Reports(?: and Metrics)?$/i, 'Reports menu item');
    await page.getByText(/Reports and Metrics/i).first().waitFor({ timeout: 10_000 });
    const metricsVisible = await visibleText(page, /Generated LOC/i);
    await closeWorkspaceSurface(page);
    return { sidebarHasCloud, sidebarHasMetrics, metricsVisible };
  });

  await step('export SVG and PNG buttons trigger downloads', async () => {
    const downloads = [];
    for (const label of ['Export SVG', 'Export PNG']) {
      const download = await triggerDownloadFromMenu(page, new RegExp(`^${label}$`, 'i'), `${label} menu item`);
      downloads.push(await download.suggestedFilename());
    }
    return { downloads };
  });

  await step('canvas route deep persistence and interactions', async () => {
    await page.evaluate(() => {
      Object.keys(localStorage)
        .filter(key => key.startsWith('isomorph-canvas:'))
        .forEach(key => localStorage.removeItem(key));
    });
    await clickFirst(page, [
      page.getByRole('button', { name: /^Canvas$/i }),
      page.locator('button').filter({ hasText: /^Canvas$/i }),
    ], 'Canvas route button');
    await page.waitForFunction(() => window.location.hash === '#/canvas');
    await page.locator('.iso-full-canvas-shell').first().waitFor({ state: 'visible', timeout: 10_000 });
    for (const label of ['Select', 'Hand', 'Rectangle', 'Ellipse', 'Arrow', 'Line', 'Pen', 'Text', 'Image', 'Eraser', 'More tools']) {
      await page.getByRole('button', { name: label }).first().waitFor({ timeout: 10_000 });
    }
    await clickCanvasToolbarTool(page, 'Rectangle');
    const overlay = page.locator('.iso-freeform-overlay').first();
    await overlay.waitFor({ state: 'visible', timeout: 10_000 });
    const overlayBox = await overlay.boundingBox();
    if (!overlayBox) {
      throw new Error('Expected freeform overlay to have a measurable box.');
    }
    await page.mouse.move(overlayBox.x + 80, overlayBox.y + 90);
    await page.mouse.down();
    await page.mouse.move(overlayBox.x + 220, overlayBox.y + 170, { steps: 8 });
    await page.mouse.up();
    let canvasEntry = await readCanvasState(page);
    const firstRect = canvasEntry.state.elements.find(element => element.kind === 'rectangle');
    if (!firstRect) {
      throw new Error('Expected Rectangle tool to persist a rectangle in canvas_state.');
    }

    await clickCanvasToolbarTool(page, 'Select');
    const firstRectElement = page.locator(`[data-canvas-element-id="${firstRect.id}"]`).first();
    await firstRectElement.waitFor({ state: 'visible', timeout: 10_000 });
    await firstRectElement.click();

    await page.getByRole('button', { name: /pick fill color/i }).click();
    await page.getByRole('button', { name: '#e03131' }).click();
    canvasEntry = await readCanvasState(page);
    let persistedFirstRect = canvasEntry.state.elements.find(element => element.id === firstRect.id);
    if (persistedFirstRect?.style.fill !== '#e03131') {
      throw new Error('Expected fill color style edit to persist into canvas_state.');
    }

    await dispatchLocatorPointer(firstRectElement, 'pointerdown', 56);
    await page.waitForTimeout(50);
    await dispatchOverlayPointer(page, 'pointermove', firstRect.bounds.x + firstRect.bounds.width / 2 + 48, firstRect.bounds.y + firstRect.bounds.height / 2 + 32, 56);
    await page.waitForTimeout(50);
    await dispatchOverlayPointer(page, 'pointerup', firstRect.bounds.x + firstRect.bounds.width / 2 + 48, firstRect.bounds.y + firstRect.bounds.height / 2 + 32, 56);
    canvasEntry = await readCanvasState(page);
    persistedFirstRect = canvasEntry.state.elements.find(element => element.id === firstRect.id);
    if (!persistedFirstRect || persistedFirstRect.bounds.x <= firstRect.bounds.x || persistedFirstRect.bounds.y <= firstRect.bounds.y) {
      throw new Error('Expected drag move to update rectangle bounds in canvas_state.');
    }

    const resizeHandle = page.locator('.iso-freeform-resize-handle').first();
    await resizeHandle.waitFor({ state: 'visible', timeout: 10_000 });
    const beforeResize = persistedFirstRect;
    await dispatchLocatorPointer(resizeHandle, 'pointerdown', 57);
    await page.waitForTimeout(50);
    await dispatchOverlayPointer(page, 'pointermove', beforeResize.bounds.x + beforeResize.bounds.width + 40, beforeResize.bounds.y + beforeResize.bounds.height + 24, 57);
    await page.waitForTimeout(50);
    await dispatchOverlayPointer(page, 'pointerup', beforeResize.bounds.x + beforeResize.bounds.width + 40, beforeResize.bounds.y + beforeResize.bounds.height + 24, 57);
    await page.waitForTimeout(150);
    canvasEntry = await readCanvasState(page);
    persistedFirstRect = canvasEntry.state.elements.find(element => element.id === firstRect.id);
    if (!persistedFirstRect || persistedFirstRect.bounds.width <= beforeResize.bounds.width || persistedFirstRect.bounds.height <= beforeResize.bounds.height) {
      throw new Error('Expected resize handle drag to update rectangle size in canvas_state.');
    }

    await clickCanvasToolbarTool(page, 'Rectangle');
    await page.mouse.move(overlayBox.x + 340, overlayBox.y + 280);
    await page.mouse.down();
    await page.mouse.move(overlayBox.x + 440, overlayBox.y + 360, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(150);

    canvasEntry = await readCanvasState(page);
    persistedFirstRect = canvasEntry.state.elements.find(element => element.id === firstRect.id);
    if (!persistedFirstRect) throw new Error('Expected first rectangle before select-zone verification.');
    await clickCanvasToolbarTool(page, 'Select');
    const zoneStart = await overlayCanvasPointToClient(page, {
      x: persistedFirstRect.bounds.x - 12,
      y: persistedFirstRect.bounds.y - 12,
    });
    const zoneEnd = await overlayCanvasPointToClient(page, {
      x: persistedFirstRect.bounds.x + persistedFirstRect.bounds.width + 12,
      y: persistedFirstRect.bounds.y + persistedFirstRect.bounds.height + 12,
    });
    await page.mouse.move(zoneStart.x, zoneStart.y);
    await page.mouse.down();
    await page.mouse.move(zoneEnd.x, zoneEnd.y, { steps: 8 });
    if (!await page.locator('.iso-freeform-selection-zone').first().isVisible().catch(() => false)) {
      throw new Error('Expected select tool drag to render a visible selection zone.');
    }
    await page.mouse.up();
    await page.waitForTimeout(150);
    canvasEntry = await readCanvasState(page);
    if (canvasEntry.state.selectedElementIds.length !== 1 || canvasEntry.state.selectedElementIds[0] !== firstRect.id) {
      throw new Error(`Expected select drag zone to select only the first rectangle. selected=${JSON.stringify(canvasEntry.state.selectedElementIds)}`);
    }
    if (await page.locator('.iso-canvas-empty').count() > 0) {
      throw new Error('Expected full-canvas route to suppress the central empty-diagram placeholder once freeform canvas is in use.');
    }

    await clickCanvasToolbarTool(page, 'Hand');
    const beforeHandPan = (await readCanvasState(page)).state.viewport ?? { x: 0, y: 0, zoom: 1 };
    await page.mouse.move(overlayBox.x + 260, overlayBox.y + 220);
    await page.mouse.down();
    await page.mouse.move(overlayBox.x + 320, overlayBox.y + 265, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(150);
    canvasEntry = await readCanvasState(page);
    const afterHandPan = canvasEntry.state.viewport ?? { x: 0, y: 0, zoom: 1 };
    if (afterHandPan.x <= beforeHandPan.x || afterHandPan.y <= beforeHandPan.y) {
      throw new Error(`Expected hand tool to pan freeform viewport. before=${JSON.stringify(beforeHandPan)} after=${JSON.stringify(afterHandPan)}`);
    }

    await clickCanvasToolbarTool(page, 'Arrow');
    const arrowStart = { x: 540, y: 420 };
    const arrowEnd = { x: 450, y: 350 };
    const arrowStartClient = await overlayCanvasPointToClient(page, arrowStart);
    const arrowEndClient = await overlayCanvasPointToClient(page, arrowEnd);
    await page.mouse.move(arrowStartClient.x, arrowStartClient.y);
    await page.mouse.down();
    await page.mouse.move(arrowEndClient.x, arrowEndClient.y, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(150);
    canvasEntry = await readCanvasState(page);
    const arrow = canvasEntry.state.elements.find(element => element.kind === 'arrow' && element.points?.[0]?.x === arrowStart.x);
    if (!arrow || arrow.points?.[0]?.x !== arrowStart.x || arrow.points?.[1]?.x !== arrowEnd.x) {
      throw new Error(`Expected arrow drag to preserve exact reversed endpoints in canvas_state. arrow=${JSON.stringify(arrow)}`);
    }
    const arrowLine = page.locator(`[data-canvas-element-id="${arrow.id}"] line`).first();
    const renderedArrow = await arrowLine.evaluate(element => ({
      x1: Number(element.getAttribute('x1')),
      y1: Number(element.getAttribute('y1')),
      x2: Number(element.getAttribute('x2')),
      y2: Number(element.getAttribute('y2')),
    }));
    if (renderedArrow.x1 !== arrowStart.x || renderedArrow.y1 !== arrowStart.y || renderedArrow.x2 !== arrowEnd.x || renderedArrow.y2 !== arrowEnd.y) {
      throw new Error(`Expected rendered arrow line to use canonical points, not bounds. rendered=${JSON.stringify(renderedArrow)}`);
    }

    await openCanvasMoreTools(page);
    await clickFirst(page, [
      page.getByRole('menuitem', { name: /^Lasso$/i }),
      page.locator('[role="menuitem"]').filter({ hasText: /^Lasso$/i }),
      page.getByText(/^Lasso$/i),
    ], 'Lasso canvas menu item');
    await page.waitForTimeout(100);
    canvasEntry = await readCanvasState(page);
    persistedFirstRect = canvasEntry.state.elements.find(element => element.id === firstRect.id);
    if (!persistedFirstRect) throw new Error('Expected first rectangle before lasso selection.');
    const lassoClientStart = await overlayCanvasPointToClient(page, {
      x: Math.max(0, persistedFirstRect.bounds.x - 24),
      y: Math.max(0, persistedFirstRect.bounds.y - 24),
    });
    const lassoClientEnd = await overlayCanvasPointToClient(page, {
      x: persistedFirstRect.bounds.x + persistedFirstRect.bounds.width + 24,
      y: persistedFirstRect.bounds.y + persistedFirstRect.bounds.height + 24,
    });
    await page.mouse.move(lassoClientStart.x, lassoClientStart.y);
    await page.mouse.down();
    await page.mouse.move(lassoClientEnd.x, lassoClientEnd.y, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(150);
    canvasEntry = await readCanvasState(page);
    if (canvasEntry.state.selectedElementIds.length !== 1 || canvasEntry.state.selectedElementIds[0] !== firstRect.id) {
      throw new Error(`Expected lasso to select only the first freeform rectangle. selected=${JSON.stringify(canvasEntry.state.selectedElementIds)} bounds=${JSON.stringify(canvasEntry.state.elements.map(element => ({ id: element.id, kind: element.kind, bounds: element.bounds })))}`);
    }
    if (canvasEntry.state.elements.some(element => element.kind === 'lasso')) {
      throw new Error('Expected lasso stroke to be transient and not persisted.');
    }

    await clickCanvasToolbarTool(page, 'Select');
    await dispatchOverlayPointer(page, 'pointerdown', overlayBox.width - 32, overlayBox.height - 32, 58);
    await dispatchOverlayPointer(page, 'pointerup', overlayBox.width - 32, overlayBox.height - 32, 58);
    await page.waitForTimeout(100);
    canvasEntry = await readCanvasState(page);
    if (canvasEntry.state.selectedElementIds.length !== 0) {
      throw new Error(`Expected blank select-mode canvas click to clear freeform selection. selected=${JSON.stringify(canvasEntry.state.selectedElementIds)}`);
    }

    const secondRect = canvasEntry.state.elements.find(element => element.id === firstRect.id);
    if (!secondRect) throw new Error('Expected live rectangle before eraser verification.');
    await clickCanvasToolbarTool(page, 'Eraser');
    const eraserStart = await overlayCanvasPointToClient(page, { x: secondRect.bounds.x + 8, y: secondRect.bounds.y + 8 });
    const eraserEnd = await overlayCanvasPointToClient(page, {
      x: secondRect.bounds.x + secondRect.bounds.width - 8,
      y: secondRect.bounds.y + secondRect.bounds.height - 8,
    });
    await page.mouse.move(eraserStart.x, eraserStart.y);
    await page.mouse.down();
    await page.mouse.move(eraserEnd.x, eraserEnd.y, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(150);
    canvasEntry = await readCanvasState(page);
    if (canvasEntry.state.elements.some(element => element.id === secondRect.id) || canvasEntry.state.elements.some(element => element.kind === 'eraser')) {
      throw new Error(`Expected eraser to delete the touched rectangle without persisting an eraser stroke. elements=${JSON.stringify(canvasEntry.state.elements.map(element => ({ id: element.id, kind: element.kind, bounds: element.bounds })))}`);
    }

    await clickCanvasToolbarTool(page, 'Text');
    await dispatchOverlayPointer(page, 'pointerdown', 520, 160, 54);
    await dispatchOverlayPointer(page, 'pointerup', 520, 160, 54);
    if (!await canvasStateHas(page, state => state.elements.some(element => element.kind === 'text'))) {
      const elements = await readCanvasElements(page);
      throw new Error(`Expected Text tool to create a text element. elements=${JSON.stringify(elements.map(element => ({ kind: element.kind, bounds: element.bounds })))}`);
    }
    await page.getByLabel(/Text content/i).fill('QA edited label');
    await page.getByLabel(/Draft semantic target kind/i).selectOption('entity');
    await page.getByLabel(/Link draft semantic target/i).click();
    if (!await canvasStateHas(page, state => state.elements.some(element => element.kind === 'text' && element.text === 'QA edited label') && state.draftSemanticLinks.some(link => link.status === 'draft'))) {
      throw new Error('Expected text edit and semantic draft link to persist in canvas_state.');
    }

    await openCanvasMoreTools(page);
    await clickFirst(page, [
      page.getByRole('menuitem', { name: /web embed/i }),
      page.locator('[role="menuitem"]').filter({ hasText: /web embed/i }),
      page.getByText(/web embed/i),
    ], 'Web embed canvas menu item');
    await page.waitForTimeout(100);
    await dispatchOverlayPointer(page, 'pointerdown', 540, 260, 55);
    await dispatchOverlayPointer(page, 'pointerup', 540, 260, 55);
    await page.getByLabel(/Embed URL/i).fill('https://example.com/spec');
    if (!await canvasStateHas(page, state => state.elements.some(element => element.kind === 'embed' && element.url === 'https://example.com/spec'))) {
      throw new Error('Expected web embed URL edit to persist in canvas_state.');
    }

    const imagePath = resolve(tmpdir(), `isomorph-${runId}-qa-upload.png`);
    await writeFile(imagePath, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/luzMogAAAABJRU5ErkJggg==', 'base64'));
    await clickCanvasToolbarTool(page, 'Image');
    await page.locator('input[type="file"]').setInputFiles(imagePath);
    await page.waitForFunction(() => Object.keys(localStorage)
      .filter(key => key.startsWith('isomorph-canvas:'))
      .map(key => localStorage.getItem(key))
      .filter(Boolean)
      .some(value => JSON.parse(value).elements?.some(element => element.kind === 'image' && /^data:image\/png;base64,/.test(element.src))), null, { timeout: 10_000 });
    if (!await canvasStateHas(page, state => state.elements.some(element => element.kind === 'image' && /^data:image\/png;base64,/.test(element.src)))) {
      throw new Error('Expected uploaded image data URL to persist in canvas_state.');
    }

    await page.evaluate(() => {
      const key = document.querySelector('.iso-full-canvas-shell')?.getAttribute('data-canvas-storage-key')
        ?? Object.keys(localStorage).find(item => item.startsWith('isomorph-canvas:'));
      if (!key) throw new Error('No canvas state key available for export hardcase injection.');
      const state = JSON.parse(localStorage.getItem(key) ?? '{}');
      const style = state.styleDefaults ?? {
        stroke: '#111827',
        fill: '#f8fafc',
        text: '#111827',
        strokeWidth: 2,
        opacity: 1,
      };
      const now = new Date().toISOString();
      state.elements = [
        ...(state.elements ?? []),
        {
          id: 'qa-export-offscreen-image',
          kind: 'image',
          bounds: { x: -260, y: -180, width: 96, height: 64 },
          style,
          src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/luzMogAAAABJRU5ErkJggg==',
          fit: 'contain',
          locked: false,
          layer: 20,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'qa-export-far-rect',
          kind: 'rectangle',
          bounds: { x: 900, y: 620, width: 150, height: 80 },
          style: { ...style, strokeWidth: 8, fill: '#e03131' },
          locked: false,
          layer: 21,
          createdAt: now,
          updatedAt: now,
        },
      ];
      localStorage.setItem(key, JSON.stringify(state));
    });

    const persistedBeforeReload = await readCanvasState(page);
    await clickFirst(page, [
      page.getByRole('button', { name: /^Back$/i }),
      page.locator('button').filter({ hasText: /^Back$/i }),
    ], 'Back button for canvas route restore');
    await page.waitForFunction(() => window.location.hash === '#/app');
    const canvasButtons = [
      page.getByRole('button', { name: /^Canvas$/i }),
      page.locator('button').filter({ hasText: /^Canvas$/i }),
    ];
    if (await canvasButtons[0].count().catch(() => 0) || await canvasButtons[1].count().catch(() => 0)) {
      await clickFirst(page, canvasButtons, 'Canvas route button for restore');
    } else {
      await page.evaluate(() => { window.location.hash = '#/canvas'; });
    }
    await page.waitForFunction(() => window.location.hash === '#/canvas');
    await page.locator('.iso-full-canvas-shell').first().waitFor({ state: 'visible', timeout: 15_000 });
    const persistedAfterReload = await readCanvasState(page);
    if (persistedAfterReload.state.elements.length < persistedBeforeReload.state.elements.length) {
      throw new Error('Expected canvas_state localStorage restore to preserve freeform elements after route remount.');
    }

    await step('full-canvas export frames off-bounds freeform images in SVG and PNG', async () => {
      const svgDownload = await triggerDownloadFromFullCanvasAction(page, /^SVG$/i, 'full-canvas SVG export action');
      const svgPath = resolve(artifactDir, `full-canvas-export-${runId}.svg`);
      await svgDownload.saveAs(svgPath);
      const svgText = await readFile(svgPath, 'utf8');
      if (!svgText.includes('qa-export-offscreen-image') || !svgText.includes('qa-export-far-rect')) {
        throw new Error('Expected full-canvas SVG export to contain off-bounds freeform image and rectangle elements.');
      }
      const viewBox = /viewBox="([^"]+)"/.exec(svgText)?.[1]?.split(/\s+/).map(Number);
      if (!viewBox || viewBox.length !== 4 || viewBox.some(value => !Number.isFinite(value))) {
        throw new Error(`Expected valid SVG export viewBox, got ${viewBox?.join(' ') ?? 'none'}.`);
      }
      const [x, y, width, height] = viewBox;
      if (x > -300 || y > -220 || width < 1300 || height < 900) {
        throw new Error(`Expected SVG export viewBox to frame off-bounds freeform content. viewBox=${viewBox.join(' ')}`);
      }

      const pngDownload = await triggerDownloadFromFullCanvasAction(page, /^PNG$/i, 'full-canvas PNG export action');
      const pngPath = resolve(artifactDir, `full-canvas-export-${runId}.png`);
      await pngDownload.saveAs(pngPath);
      const pngDimensions = readPngDimensions(await readFile(pngPath));
      if (pngDimensions.width < width * 2 || pngDimensions.height < height * 2) {
        throw new Error(`Expected retina PNG dimensions to match expanded SVG frame. svg=${width}x${height} png=${pngDimensions.width}x${pngDimensions.height}`);
      }

      return { viewBox, pngDimensions };
    });

    await page.evaluate((key) => localStorage.setItem(key, '{corrupt canvas_state'), persistedAfterReload.key);
    await clickFirst(page, [
      page.getByRole('button', { name: /^Back$/i }),
      page.locator('button').filter({ hasText: /^Back$/i }),
    ], 'Back button for corrupt canvas route restore');
    await page.waitForFunction(() => window.location.hash === '#/app');
    await page.evaluate(() => { window.location.hash = '#/canvas'; });
    await page.waitForFunction(() => window.location.hash === '#/canvas');
    await page.locator('.iso-full-canvas-shell').first().waitFor({ state: 'visible', timeout: 10_000 });
    const corruptRestoreElementCount = await page.evaluate(() => Object.keys(localStorage)
      .filter(key => key.startsWith('isomorph-canvas:'))
      .map(key => localStorage.getItem(key))
      .filter(Boolean)
      .reduce((count, value) => {
        try {
          return count + (JSON.parse(value).elements?.length ?? 0);
        } catch {
          return count;
        }
      }, 0));
    if (corruptRestoreElementCount !== 0) {
      throw new Error('Expected corrupt canvas_state restore to normalize to an empty canvas state.');
    }

    await clickFirst(page, [
      page.getByRole('button', { name: /^Back$/i }),
      page.locator('button').filter({ hasText: /^Back$/i }),
    ], 'Back button');
    await page.waitForFunction(() => window.location.hash === '#/app');
    await page.getByText(/Source/i).first().waitFor({ timeout: 10_000 });
    return {
      hash: await page.evaluate(() => window.location.hash),
      persistedElementsBeforeCorruptRestore: persistedBeforeReload.state.elements.length,
      corruptRestoreElements: corruptRestoreElementCount,
    };
  });

  await step('1000-line limit UI visible without cloud credentials', async () => {
    const limitsVisible = await visibleText(page, /1000 lines\/file/i);
    if (limitsVisible) {
      return { limitsVisible, surface: 'already-open' };
    }
    await clickMoreMenuItem(page, accountMenuItemPattern, 'Account, Cloud, or Sync menu item for limit copy');
    const visibleInOverlay = await visibleText(page, /1000 lines\/file/i);
    if (!visibleInOverlay) {
      throw new Error('Expected the 1000 lines/file limits copy to be visible in the Account overlay.');
    }
    await closeWorkspaceSurface(page);
    return { limitsVisible: visibleInOverlay, surface: 'account-overlay' };
  });

  await step('no NaN SVG attribute errors during live editing', async () => {
    if (svgAttributeErrors.length > 0) {
      throw new Error(`Found ${svgAttributeErrors.length} NaN SVG attribute errors`);
    }
    return { svgAttributeErrors: 0 };
  });

  await step('no React maximum update depth warnings', async () => {
    if (reactConsoleFailures.length > 0) {
      throw new Error(`Found ${reactConsoleFailures.length} React maximum update depth warnings`);
    }
    return { reactConsoleFailures: 0 };
  });

  await log({ type: 'run:ok', logPath });
  console.log(`QA passed. JSONL log: ${logPath}`);
} catch (error) {
  await log({
    type: 'run:fail',
    logPath,
    error: error instanceof Error ? error.message : String(error),
    hint: `Start the app first, then retry with QA_BASE_URL=${baseUrl} node scripts/qa/isomorph-app-qa.mjs`,
  });
  console.error(`QA failed. JSONL log: ${logPath}`);
  throw error;
} finally {
  if (browser) await browser.close();
  await stopDevServer(devServer);
}
