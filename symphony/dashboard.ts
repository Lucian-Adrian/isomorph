import type { RuntimeIssueSummary, RuntimeSnapshot } from './types.js';

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function serializeBootstrap(snapshot: RuntimeSnapshot) {
  return JSON.stringify(snapshot).replaceAll('<', '\\u003c');
}

function issueListMarkup(issues: RuntimeIssueSummary[], emptyLabel: string) {
  if (issues.length === 0) {
    return `<div class="empty">${escapeHtml(emptyLabel)}</div>`;
  }
  return `<ul class="issue-list">${issues.map(issue => `
    <li>
      <button class="issue-chip" data-issue="${escapeHtml(issue.issue_identifier)}">
        <span class="issue-key">${escapeHtml(issue.issue_identifier)}</span>
        <span class="issue-title">${escapeHtml(issue.title)}</span>
      </button>
    </li>
  `).join('')}</ul>`;
}

function tableRows(snapshot: RuntimeSnapshot, kind: 'running' | 'retrying') {
  if (kind === 'running') {
    if (snapshot.running.length === 0) {
      return '<tr><td colspan="5" class="empty-table">No active sessions.</td></tr>';
    }
    return snapshot.running.map(row => `
      <tr data-issue="${escapeHtml(row.issue_identifier)}">
        <td><button class="table-link" data-issue="${escapeHtml(row.issue_identifier)}">${escapeHtml(row.issue_identifier)}</button></td>
        <td>${escapeHtml(row.session_id)}</td>
        <td>${escapeHtml(row.last_event)}</td>
        <td>${row.tokens.total_tokens.toLocaleString()}</td>
        <td>${escapeHtml(row.last_event_at)}</td>
      </tr>
    `).join('');
  }
  if (snapshot.retrying.length === 0) {
    return '<tr><td colspan="4" class="empty-table">Retry queue is empty.</td></tr>';
  }
  return snapshot.retrying.map(row => `
    <tr data-issue="${escapeHtml(row.issue_identifier)}">
      <td><button class="table-link" data-issue="${escapeHtml(row.issue_identifier)}">${escapeHtml(row.issue_identifier)}</button></td>
      <td>${row.attempt}</td>
      <td>${escapeHtml(row.due_at)}</td>
      <td>${escapeHtml(row.error ?? 'Retry pending')}</td>
    </tr>
  `).join('');
}

function recentEventsMarkup(snapshot: RuntimeSnapshot) {
  if (snapshot.recent_events.length === 0) {
    return '<div class="empty">No runtime events yet.</div>';
  }
  return `<ul class="event-list">${snapshot.recent_events.slice().reverse().map(event => `
    <li class="event-item">
      <div class="event-head">
        <strong>${escapeHtml(event.event)}</strong>
        <span>${escapeHtml(event.at)}</span>
      </div>
      <div class="event-body">${escapeHtml(event.issue_identifier ?? event.message ?? '')}</div>
    </li>
  `).join('')}</ul>`;
}

function healthMarkup(snapshot: RuntimeSnapshot) {
  return snapshot.health.checks.map(check => `
    <div class="health-row">
      <span class="health-dot health-${escapeHtml(check.status)}"></span>
      <div>
        <strong>${escapeHtml(check.name)}</strong>
        <p>${escapeHtml(check.detail)}</p>
      </div>
    </div>
  `).join('');
}

export function renderDashboardHtml(snapshot: RuntimeSnapshot) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Symphony Runtime Dashboard</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #0b1020;
        --panel: rgba(15, 23, 42, 0.82);
        --panel-soft: rgba(15, 23, 42, 0.62);
        --line: rgba(148, 163, 184, 0.18);
        --text: #e2e8f0;
        --muted: #94a3b8;
        --accent: #67e8f9;
        --good: #34d399;
        --warn: #fbbf24;
        --bad: #f87171;
        --info: #60a5fa;
        --shadow: 0 28px 80px rgba(2, 6, 23, 0.45);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background:
          radial-gradient(circle at top left, rgba(103, 232, 249, 0.12), transparent 28%),
          radial-gradient(circle at top right, rgba(96, 165, 250, 0.14), transparent 24%),
          linear-gradient(180deg, #08101e 0%, #0b1020 100%);
        color: var(--text);
      }
      .shell {
        max-width: 1480px;
        margin: 0 auto;
        padding: 28px;
      }
      .hero, .panel {
        border: 1px solid var(--line);
        background: var(--panel);
        box-shadow: var(--shadow);
        backdrop-filter: blur(18px);
      }
      .hero {
        border-radius: 20px;
        padding: 24px;
        display: grid;
        grid-template-columns: minmax(0, 1.6fr) minmax(320px, 0.9fr);
        gap: 24px;
        align-items: start;
      }
      .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--muted);
      }
      h1 {
        margin: 12px 0 8px;
        font-size: clamp(32px, 4vw, 48px);
        line-height: 1.05;
      }
      .lede {
        max-width: 72ch;
        color: #cbd5e1;
        font-size: 15px;
        line-height: 1.7;
      }
      .badge-row, .stat-grid, .main-grid, .task-grid, .toolbar, .setup-list { display: flex; gap: 12px; flex-wrap: wrap; }
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        border-radius: 999px;
        padding: 9px 14px;
        font-size: 13px;
        background: rgba(15, 23, 42, 0.74);
        border: 1px solid var(--line);
        color: var(--text);
      }
      .badge strong { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; }
      .badge.good { border-color: rgba(52, 211, 153, 0.32); }
      .badge.warn { border-color: rgba(251, 191, 36, 0.32); }
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        justify-content: flex-end;
      }
      button, .ghost-link {
        appearance: none;
        border: 0;
        border-radius: 12px;
        background: linear-gradient(180deg, rgba(56, 189, 248, 0.18), rgba(14, 165, 233, 0.12));
        color: var(--text);
        padding: 11px 14px;
        font: inherit;
        cursor: pointer;
        transition: transform 120ms ease, border-color 120ms ease, background 120ms ease;
        border: 1px solid rgba(103, 232, 249, 0.18);
      }
      button:hover, .ghost-link:hover { transform: translateY(-1px); border-color: rgba(103, 232, 249, 0.4); }
      .ghost-link {
        text-decoration: none;
        background: rgba(15, 23, 42, 0.5);
      }
      .stat-grid { margin-top: 18px; }
      .stat {
        flex: 1 1 160px;
        min-width: 160px;
        border-radius: 16px;
        border: 1px solid var(--line);
        background: var(--panel-soft);
        padding: 16px;
      }
      .stat label {
        display: block;
        color: var(--muted);
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .stat strong {
        display: block;
        margin-top: 10px;
        font-size: 34px;
        line-height: 1;
      }
      .stat span {
        display: block;
        margin-top: 8px;
        color: #cbd5e1;
        font-size: 13px;
      }
      .main-grid {
        margin-top: 20px;
        align-items: stretch;
      }
      .column {
        flex: 1 1 420px;
        min-width: 340px;
        display: grid;
        gap: 18px;
      }
      .panel {
        border-radius: 18px;
        padding: 18px;
      }
      .panel h2 {
        margin: 0 0 14px;
        font-size: 18px;
      }
      .panel h3 {
        margin: 0 0 10px;
        font-size: 15px;
      }
      .subtle {
        color: var(--muted);
        font-size: 13px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
      }
      th, td {
        text-align: left;
        padding: 11px 10px;
        border-bottom: 1px solid rgba(148, 163, 184, 0.12);
        vertical-align: top;
      }
      th {
        color: var(--muted);
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .empty-table, .empty {
        color: var(--muted);
        padding: 18px 0;
      }
      .table-link, .issue-chip {
        width: 100%;
        text-align: left;
        background: none;
        border: 0;
        padding: 0;
        color: var(--accent);
      }
      .issue-list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        gap: 10px;
      }
      .issue-chip {
        display: block;
        border-radius: 14px;
        padding: 12px;
        background: rgba(15, 23, 42, 0.54);
        border: 1px solid var(--line);
      }
      .issue-key {
        display: block;
        font-size: 12px;
        color: var(--accent);
      }
      .issue-title {
        display: block;
        margin-top: 6px;
        color: var(--text);
      }
      .task-grid > section {
        flex: 1 1 220px;
        min-width: 220px;
      }
      .event-list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        gap: 10px;
        max-height: 420px;
        overflow: auto;
      }
      .event-item {
        border: 1px solid var(--line);
        border-radius: 14px;
        padding: 12px;
        background: rgba(15, 23, 42, 0.48);
      }
      .event-head {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        font-size: 12px;
        color: var(--muted);
      }
      .event-body {
        margin-top: 8px;
        color: #cbd5e1;
        font-size: 13px;
      }
      .health-row {
        display: grid;
        grid-template-columns: 12px minmax(0, 1fr);
        gap: 12px;
        align-items: start;
        margin-bottom: 14px;
      }
      .health-row p { margin: 6px 0 0; color: var(--muted); font-size: 13px; line-height: 1.5; }
      .health-dot {
        width: 12px;
        height: 12px;
        margin-top: 5px;
        border-radius: 999px;
      }
      .health-healthy { background: var(--good); }
      .health-degraded { background: var(--warn); }
      .health-error { background: var(--bad); }
      .health-info { background: var(--info); }
      code, pre {
        font-family: "SFMono-Regular", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      }
      .setup-list {
        flex-direction: column;
        align-items: stretch;
      }
      .setup-list code {
        display: block;
        padding: 11px 12px;
        border-radius: 12px;
        background: rgba(2, 6, 23, 0.55);
        border: 1px solid var(--line);
      }
      .drawer {
        position: fixed;
        top: 0;
        right: 0;
        width: min(460px, 100vw);
        height: 100vh;
        background: rgba(8, 15, 31, 0.96);
        border-left: 1px solid var(--line);
        box-shadow: -24px 0 60px rgba(2, 6, 23, 0.45);
        transform: translateX(100%);
        transition: transform 160ms ease;
        z-index: 20;
        display: flex;
        flex-direction: column;
      }
      .drawer.open { transform: translateX(0); }
      .drawer header {
        display: flex;
        align-items: start;
        justify-content: space-between;
        gap: 12px;
        padding: 22px;
        border-bottom: 1px solid var(--line);
      }
      .drawer-body {
        padding: 22px;
        overflow: auto;
        display: grid;
        gap: 18px;
      }
      .drawer-card {
        border: 1px solid var(--line);
        border-radius: 14px;
        padding: 14px;
        background: rgba(15, 23, 42, 0.44);
      }
      .drawer-card dl {
        margin: 0;
        display: grid;
        grid-template-columns: 110px minmax(0, 1fr);
        gap: 8px 12px;
        font-size: 13px;
      }
      .drawer-card dt { color: var(--muted); }
      .drawer-card dd { margin: 0; word-break: break-word; }
      .footer-note {
        margin-top: 16px;
        color: var(--muted);
        font-size: 12px;
      }
      @media (max-width: 1080px) {
        .hero {
          grid-template-columns: 1fr;
        }
      }
      @media (max-width: 720px) {
        .shell { padding: 16px; }
        .hero, .panel { border-radius: 16px; }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <section class="hero">
        <div>
          <span class="eyebrow">Symphony status surface</span>
          <h1>Symphony Runtime Dashboard</h1>
          <p class="lede">
            Repo-local operator view for the current worktree. It reads <code>/api/v1/state</code>,
            stays cheap to run, and makes dry-run orchestration observable before you spend any model tokens.
          </p>
          <div class="badge-row" id="hero-badges">
            <span class="badge ${snapshot.health.status === 'healthy' ? 'good' : 'warn'}">
              <strong>Health</strong> <span>${escapeHtml(snapshot.health.status)}</span>
            </span>
            <span class="badge ${snapshot.runtime.no_token_spend ? 'good' : 'warn'}">
              <strong>Spend</strong> <span>${snapshot.runtime.no_token_spend ? 'No token spend' : 'Live execution'}</span>
            </span>
            <span class="badge">
              <strong>Tracker</strong> <span>${escapeHtml(snapshot.health.tracker_kind)}</span>
            </span>
            <span class="badge">
              <strong>Workflow</strong> <span>${escapeHtml(snapshot.workflow.workflow_path)}</span>
            </span>
          </div>
          <div class="stat-grid" id="summary-stats">
            <article class="stat">
              <label>Running sessions</label>
              <strong>${snapshot.counts.running}</strong>
              <span>Live agent sessions currently tracked.</span>
            </article>
            <article class="stat">
              <label>Retry queue</label>
              <strong>${snapshot.counts.retrying}</strong>
              <span>Scheduled retries waiting for another attempt.</span>
            </article>
            <article class="stat">
              <label>Dispatchable tasks</label>
              <strong>${snapshot.counts.dispatchable}</strong>
              <span>Tasks clear to run on the next orchestrator tick.</span>
            </article>
            <article class="stat">
              <label>Blocked tasks</label>
              <strong>${snapshot.counts.blocked}</strong>
              <span>Tasks waiting on unfinished dependencies.</span>
            </article>
          </div>
        </div>
        <div class="panel">
          <div class="toolbar">
            <button id="refresh-button" type="button">Refresh state</button>
            <a class="ghost-link" href="/api/v1/state" target="_blank" rel="noreferrer">Open JSON</a>
          </div>
          <div class="footer-note" id="status-line">
            Generated ${escapeHtml(snapshot.generated_at)}. Poll interval ${snapshot.health.poll_interval_ms}ms.
          </div>
          <div class="panel" style="margin-top:16px;padding:16px;border-radius:14px;background:rgba(15,23,42,0.44);">
            <h2 style="margin-bottom:10px;">Local setup</h2>
            <div class="setup-list" id="setup-commands">
              ${snapshot.runtime.local_setup_commands.map(command => `<code>${escapeHtml(command)}</code>`).join('')}
            </div>
            <p class="footer-note">
              ${snapshot.runtime.no_token_spend
                ? 'Dry run stays safe for demos and setup: flip agent.dry_run to false in WORKFLOW.md when you want live orchestration.'
                : 'Live orchestration is enabled, so this dashboard reflects real agent work and token activity.'}
            </p>
          </div>
        </div>
      </section>

      <div class="main-grid">
        <div class="column">
          <section class="panel">
            <h2>Running sessions</h2>
            <table>
              <thead><tr><th>Issue</th><th>Session</th><th>Last event</th><th>Total tokens</th><th>Updated</th></tr></thead>
              <tbody id="running-table">${tableRows(snapshot, 'running')}</tbody>
            </table>
          </section>

          <section class="panel">
            <h2>Dispatch readiness</h2>
            <div class="task-grid" id="task-grid">
              <section>
                <h3>Running</h3>
                ${issueListMarkup(snapshot.running_tasks, 'No running tasks.')}
              </section>
              <section>
                <h3>Dispatchable</h3>
                ${issueListMarkup(snapshot.dispatchable, 'No tasks are dispatchable.')}
              </section>
              <section>
                <h3>Blocked</h3>
                ${issueListMarkup(snapshot.blocked, 'No blockers right now.')}
              </section>
              <section>
                <h3>Ignored</h3>
                ${issueListMarkup(snapshot.ignored, 'Nothing is currently ignored.')}
              </section>
            </div>
          </section>
        </div>

        <div class="column">
          <section class="panel">
            <h2>Retry queue</h2>
            <table>
              <thead><tr><th>Issue</th><th>Attempt</th><th>Due</th><th>Error</th></tr></thead>
              <tbody id="retry-table">${tableRows(snapshot, 'retrying')}</tbody>
            </table>
          </section>

          <section class="panel">
            <h2>Runtime totals</h2>
            <div class="stat-grid" id="runtime-stats">
              <article class="stat">
                <label>Total tokens</label>
                <strong>${snapshot.codex_totals.total_tokens.toLocaleString()}</strong>
                <span>Aggregate token usage observed by the runtime.</span>
              </article>
              <article class="stat">
                <label>Seconds running</label>
                <strong>${Math.round(snapshot.codex_totals.seconds_running).toLocaleString()}</strong>
                <span>Sum of currently tracked live session runtime.</span>
              </article>
              <article class="stat">
                <label>Recent events</label>
                <strong>${snapshot.counts.recent_events}</strong>
                <span>Structured JSONL events available for inspection.</span>
              </article>
            </div>
          </section>

          <section class="panel">
            <h2>Health indicators</h2>
            <div id="health-list">${healthMarkup(snapshot)}</div>
          </section>
        </div>

        <div class="column">
          <section class="panel">
            <h2>Recent events</h2>
            <div id="recent-events">${recentEventsMarkup(snapshot)}</div>
          </section>
        </div>
      </div>
    </div>

    <aside class="drawer" id="issue-drawer" aria-hidden="true">
      <header>
        <div>
          <div class="eyebrow">Issue detail</div>
          <h2 id="drawer-title" style="margin:10px 0 0;font-size:24px;">Select an issue</h2>
        </div>
        <button id="drawer-close" type="button">Close</button>
      </header>
      <div class="drawer-body" id="drawer-body">
        <div class="drawer-card subtle">Issue detail appears here when you click a task or session.</div>
      </div>
    </aside>

    <script>
      const stateUrl = '/api/v1/state';
      const refreshUrl = '/api/v1/refresh';
      let snapshot = ${serializeBootstrap(snapshot)};

      function esc(value) {
        return String(value ?? '')
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;')
          .replaceAll("'", '&#39;');
      }

      function issueList(issues, emptyLabel) {
        if (!issues.length) return '<div class="empty">' + esc(emptyLabel) + '</div>';
        return '<ul class="issue-list">' + issues.map(issue => (
          '<li><button class="issue-chip" data-issue="' + esc(issue.issue_identifier) + '">' +
            '<span class="issue-key">' + esc(issue.issue_identifier) + '</span>' +
            '<span class="issue-title">' + esc(issue.title) + '</span>' +
          '</button></li>'
        )).join('') + '</ul>';
      }

      function runningRows(rows) {
        if (!rows.length) return '<tr><td colspan="5" class="empty-table">No active sessions.</td></tr>';
        return rows.map(row => (
          '<tr data-issue="' + esc(row.issue_identifier) + '">' +
            '<td><button class="table-link" data-issue="' + esc(row.issue_identifier) + '">' + esc(row.issue_identifier) + '</button></td>' +
            '<td>' + esc(row.session_id) + '</td>' +
            '<td>' + esc(row.last_event) + '</td>' +
            '<td>' + Number(row.tokens.total_tokens).toLocaleString() + '</td>' +
            '<td>' + esc(row.last_event_at) + '</td>' +
          '</tr>'
        )).join('');
      }

      function retryRows(rows) {
        if (!rows.length) return '<tr><td colspan="4" class="empty-table">Retry queue is empty.</td></tr>';
        return rows.map(row => (
          '<tr data-issue="' + esc(row.issue_identifier) + '">' +
            '<td><button class="table-link" data-issue="' + esc(row.issue_identifier) + '">' + esc(row.issue_identifier) + '</button></td>' +
            '<td>' + Number(row.attempt) + '</td>' +
            '<td>' + esc(row.due_at) + '</td>' +
            '<td>' + esc(row.error ?? 'Retry pending') + '</td>' +
          '</tr>'
        )).join('');
      }

      function healthRows(health) {
        return health.checks.map(check => (
          '<div class="health-row">' +
            '<span class="health-dot health-' + esc(check.status) + '"></span>' +
            '<div><strong>' + esc(check.name) + '</strong><p>' + esc(check.detail) + '</p></div>' +
          '</div>'
        )).join('');
      }

      function recentEvents(events) {
        if (!events.length) return '<div class="empty">No runtime events yet.</div>';
        return '<ul class="event-list">' + events.slice().reverse().map(event => (
          '<li class="event-item">' +
            '<div class="event-head"><strong>' + esc(event.event) + '</strong><span>' + esc(event.at) + '</span></div>' +
            '<div class="event-body">' + esc(event.issue_identifier ?? event.message ?? '') + '</div>' +
          '</li>'
        )).join('') + '</ul>';
      }

      async function fetchState() {
        const response = await fetch(stateUrl, { headers: { accept: 'application/json' } });
        if (!response.ok) throw new Error('state_fetch_failed');
        snapshot = await response.json();
        render();
      }

      async function openIssue(identifier) {
        const response = await fetch('/api/v1/' + encodeURIComponent(identifier), { headers: { accept: 'application/json' } });
        if (!response.ok) return;
        const issue = await response.json();
        const drawer = document.getElementById('issue-drawer');
        const title = document.getElementById('drawer-title');
        const body = document.getElementById('drawer-body');
        title.textContent = issue.issue_identifier;
        body.innerHTML = [
          '<section class="drawer-card"><dl>',
          '<dt>Status</dt><dd>' + esc(issue.status) + '</dd>',
          '<dt>Workspace</dt><dd>' + esc(issue.workspace?.path ?? 'Not allocated') + '</dd>',
          '<dt>Retry attempt</dt><dd>' + esc(issue.attempts?.current_retry_attempt ?? 0) + '</dd>',
          '<dt>Last error</dt><dd>' + esc(issue.last_error ?? 'None') + '</dd>',
          '</dl></section>',
          '<section class="drawer-card"><h3>Recent issue events</h3>' + recentEvents(issue.recent_events ?? []) + '</section>'
        ].join('');
        drawer.classList.add('open');
        drawer.setAttribute('aria-hidden', 'false');
      }

      function render() {
        document.getElementById('hero-badges').innerHTML = [
          '<span class="badge ' + (snapshot.health.status === 'healthy' ? 'good' : 'warn') + '"><strong>Health</strong> <span>' + esc(snapshot.health.status) + '</span></span>',
          '<span class="badge ' + (snapshot.runtime.no_token_spend ? 'good' : 'warn') + '"><strong>Spend</strong> <span>' + (snapshot.runtime.no_token_spend ? 'No token spend' : 'Live execution') + '</span></span>',
          '<span class="badge"><strong>Tracker</strong> <span>' + esc(snapshot.health.tracker_kind) + '</span></span>',
          '<span class="badge"><strong>Workflow</strong> <span>' + esc(snapshot.workflow.workflow_path) + '</span></span>'
        ].join('');
        document.getElementById('summary-stats').innerHTML = [
          ['Running sessions', snapshot.counts.running, 'Live agent sessions currently tracked.'],
          ['Retry queue', snapshot.counts.retrying, 'Scheduled retries waiting for another attempt.'],
          ['Dispatchable tasks', snapshot.counts.dispatchable, 'Tasks clear to run on the next orchestrator tick.'],
          ['Blocked tasks', snapshot.counts.blocked, 'Tasks waiting on unfinished dependencies.'],
        ].map(([label, value, detail]) => (
          '<article class="stat"><label>' + esc(label) + '</label><strong>' + Number(value).toLocaleString() + '</strong><span>' + esc(detail) + '</span></article>'
        )).join('');
        document.getElementById('status-line').textContent = 'Generated ' + snapshot.generated_at + '. Poll interval ' + snapshot.health.poll_interval_ms + 'ms.';
        document.getElementById('setup-commands').innerHTML = snapshot.runtime.local_setup_commands.map(command => '<code>' + esc(command) + '</code>').join('');
        document.getElementById('running-table').innerHTML = runningRows(snapshot.running);
        document.getElementById('retry-table').innerHTML = retryRows(snapshot.retrying);
        document.getElementById('task-grid').innerHTML = [
          '<section><h3>Running</h3>' + issueList(snapshot.running_tasks, 'No running tasks.') + '</section>',
          '<section><h3>Dispatchable</h3>' + issueList(snapshot.dispatchable, 'No tasks are dispatchable.') + '</section>',
          '<section><h3>Blocked</h3>' + issueList(snapshot.blocked, 'No blockers right now.') + '</section>',
          '<section><h3>Ignored</h3>' + issueList(snapshot.ignored, 'Nothing is currently ignored.') + '</section>'
        ].join('');
        document.getElementById('runtime-stats').innerHTML = [
          ['Total tokens', snapshot.codex_totals.total_tokens, 'Aggregate token usage observed by the runtime.'],
          ['Seconds running', Math.round(snapshot.codex_totals.seconds_running), 'Sum of currently tracked live session runtime.'],
          ['Recent events', snapshot.counts.recent_events, 'Structured JSONL events available for inspection.'],
        ].map(([label, value, detail]) => (
          '<article class="stat"><label>' + esc(label) + '</label><strong>' + Number(value).toLocaleString() + '</strong><span>' + esc(detail) + '</span></article>'
        )).join('');
        document.getElementById('health-list').innerHTML = healthRows(snapshot.health);
        document.getElementById('recent-events').innerHTML = recentEvents(snapshot.recent_events);
        wireIssueButtons();
      }

      function wireIssueButtons() {
        document.querySelectorAll('[data-issue]').forEach(node => {
          node.addEventListener('click', event => {
            event.preventDefault();
            const identifier = node.getAttribute('data-issue');
            if (identifier) void openIssue(identifier);
          });
        });
      }

      document.getElementById('refresh-button').addEventListener('click', async () => {
        await fetch(refreshUrl, { method: 'POST' });
        await fetchState();
      });
      document.getElementById('drawer-close').addEventListener('click', () => {
        const drawer = document.getElementById('issue-drawer');
        drawer.classList.remove('open');
        drawer.setAttribute('aria-hidden', 'true');
      });

      wireIssueButtons();
      window.setInterval(() => { void fetchState().catch(() => undefined); }, Math.max(3000, snapshot.health.poll_interval_ms));
    </script>
  </body>
</html>`;
}
