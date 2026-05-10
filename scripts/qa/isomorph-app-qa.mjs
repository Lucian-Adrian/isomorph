import { mkdir, appendFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile, spawn } from 'node:child_process';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const artifactDir = resolve(repoRoot, 'artifacts', 'qa');
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const logPath = resolve(artifactDir, `isomorph-app-qa-${runId}.jsonl.log`);

const baseUrl = process.env.QA_BASE_URL ?? 'http://127.0.0.1:5173/isomorph/app/';
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
  await page.keyboard.type(source);
  await page.waitForTimeout(200);
}

async function visibleText(page, pattern) {
  return page.getByText(pattern).first().isVisible().catch(() => false);
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
  await log({ type: 'server:start', command: 'npm run dev -- --host 127.0.0.1' });
  const child = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1'], {
    cwd: repoRoot,
    shell: true,
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

let browser;
let devServer;
const svgAttributeErrors = [];
try {
  await log({
    type: 'run:start',
    baseUrl,
    headless,
    note: 'JSONL content is written to a *.log path so the existing git ignore rule excludes generated QA logs.',
  });

  devServer = await startDevServerIfNeeded();

  browser = await chromium.launch({ headless, slowMo });
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 960 } });
  const page = await context.newPage();

  page.on('console', message => {
    if (/Expected length, "NaN"|attribute .*NaN/i.test(message.text())) {
      svgAttributeErrors.push(message.text());
    }
    void log({ type: 'browser:console', level: message.type(), text: message.text() });
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

  await step('codegen visible and executable', async () => {
    await page.getByText(/Codegen/i).first().waitFor({ timeout: 10_000 });
    await clickFirst(page, [
      page.getByRole('button', { name: /^Generate$/i }),
      page.locator('button').filter({ hasText: /^Generate$/i }),
    ], 'Generate button');
    await page.locator('textarea').first().waitFor({ state: 'visible', timeout: 10_000 });
    await page.waitForFunction(() => {
      const value = document.querySelector('textarea')?.value ?? '';
      return value.trim().length > 0;
    });
    const output = await page.locator('textarea').first().inputValue();
    return { codegenChars: output.length, preview: output.slice(0, 80) };
  });

  await step('export SVG and PNG buttons trigger downloads', async () => {
    const downloads = [];
    for (const label of ['SVG', 'PNG']) {
      const downloadPromise = page.waitForEvent('download', { timeout: 10_000 });
      await clickFirst(page, [
        page.getByRole('button', { name: new RegExp(`^${label}$`, 'i') }),
        page.locator('button').filter({ hasText: new RegExp(`^${label}$`, 'i') }),
      ], `${label} export button`);
      const download = await downloadPromise;
      downloads.push(await download.suggestedFilename());
    }
    return { downloads };
  });

  await step('canvas route then back to IDE', async () => {
    await clickFirst(page, [
      page.getByRole('button', { name: /^Canvas$/i }),
      page.locator('button').filter({ hasText: /^Canvas$/i }),
    ], 'Canvas route button');
    await page.waitForFunction(() => window.location.hash === '#/canvas');
    await page.getByText(/Pure Infinite Canvas/i).first().waitFor({ timeout: 10_000 });

    await clickFirst(page, [
      page.getByRole('button', { name: /Back to IDE/i }),
      page.locator('button').filter({ hasText: /Back to IDE/i }),
    ], 'Back to IDE button');
    await page.waitForFunction(() => window.location.hash === '#/app');
    await page.getByText(/Codegen/i).first().waitFor({ timeout: 10_000 });
    return { hash: await page.evaluate(() => window.location.hash) };
  });

  await step('1000-line limit UI visible without cloud credentials', async () => {
    const limitsVisible = await visibleText(page, /1000 lines\/file/i);
    if (!limitsVisible) {
      throw new Error('Expected the 1000 lines/file limits copy to be visible in the IDE sidebar.');
    }
    return { limitsVisible };
  });

  await step('no NaN SVG attribute errors during live editing', async () => {
    if (svgAttributeErrors.length > 0) {
      throw new Error(`Found ${svgAttributeErrors.length} NaN SVG attribute errors`);
    }
    return { svgAttributeErrors: 0 };
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
