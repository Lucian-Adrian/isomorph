// ============================================================
// Isomorph — Main Application Component (v3 — SOLID refactor)
// ============================================================
// Orchestrates the IDE shell. Domain logic is delegated to:
//   - src/utils/exporter.ts       (SVG/PNG export)
//   - src/utils/error-formatter.ts (error display strings)
//   - src/data/examples.ts        (built-in snippets)
//   - src/components/Icons.tsx     (icon library)
//   - src/components/ShortcutsOverlay.tsx
// ============================================================

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { IsomorphEditor } from './editor/IsomorphEditor.js';
import type { LintDiagnostic } from './editor/IsomorphEditor.js';
import { DiagramView } from './components/DiagramView.js';
import { SplitPane } from './components/SplitPane.js';
import { ShortcutsOverlay } from './components/ShortcutsOverlay.js';
import { IconCode, IconDiagram, IconChevron, IconExport, IconNew, IconOpen, IconKeyboard } from './components/Icons.js';
import { parse } from './parser/index.js';
import { analyze } from './semantics/analyzer.js';
import { formatAllErrors } from './utils/error-formatter.js';
import { exportSVG, exportPNG } from './utils/exporter.js';
import { EXAMPLES } from './data/examples.js';
import type { IOMDiagram } from './semantics/iom.js';
import type { ParseError } from './parser/index.js';

const DEFAULT_SOURCE = EXAMPLES[0].source;

// ── App ──────────────────────────────────────────────────────

export default function App() {
  const [source, setSource]                 = useState(DEFAULT_SOURCE);
  const [activeDiagramIdx, setActiveDiagramIdx] = useState(0);
  const [examplesOpen, setExamplesOpen]     = useState(false);
  const [fileName, setFileName]             = useState('untitled.isx');
  const [shortcutsOpen, setShortcutsOpen]   = useState(false);
  const examplesRef                         = useRef<HTMLDivElement>(null);
  const fileInputRef                        = useRef<HTMLInputElement>(null);

  // ── Close dropdown on outside click ──────────────────────
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (examplesRef.current && !examplesRef.current.contains(e.target as Node)) {
        setExamplesOpen(false);
      }
    }
    if (examplesOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [examplesOpen]);

  // ── Parse + analyze on every keystroke ───────────────────
  const parseResult = useMemo(() => {
    try { return parse(source); } catch { return null; }
  }, [source]);

  const analysisResult = useMemo(() => {
    if (!parseResult) return null;
    try { return analyze(parseResult.program); } catch { return null; }
  }, [parseResult]);

  const parseErrors: ParseError[] = parseResult?.errors ?? [];
  const semanticErrors = analysisResult?.errors ?? [];
  const allErrors: string[] = formatAllErrors(parseErrors, semanticErrors);

  // Combined parse + semantic diagnostics for the editor lint gutter
  const editorDiagnostics: LintDiagnostic[] = [
    ...parseErrors.map(e => ({ message: e.message, line: e.line, col: e.col, severity: 'error' as const })),
    ...semanticErrors
      .filter((e): e is typeof e & { line: number; col: number } => e.line != null)
      .map(e => ({ message: `(${e.rule}) ${e.message}`, line: e.line, col: e.col ?? 1, severity: 'error' as const })),
  ];
  const diagrams: IOMDiagram[] = analysisResult?.iom.diagrams ?? [];
  const activeDiagram = diagrams[activeDiagramIdx] ?? null;

  // ── Bidirectional: drag entity → update @Entity at ───────
  const handleEntityMove = useCallback((name: string, x: number, y: number) => {
    const newAnnotation = `@${name} at (${x}, ${y})`;
    setSource(s => {
      const pattern = new RegExp(`@${name}\\s+at\\s+\\([^)]+\\)`);
      const replaced = s.replace(pattern, newAnnotation);
      if (replaced !== s) return replaced;
      const lastBrace = s.lastIndexOf('}');
      return lastBrace < 0 ? s : s.slice(0, lastBrace) + `  ${newAnnotation}\n` + s.slice(lastBrace);
    });
  }, []);

  // ── Export callbacks (delegated to exporter module) ───────
  const handleExportSVG = useCallback(() => {
    exportSVG(activeDiagram?.name ?? 'diagram');
  }, [activeDiagram]);

  const handleExportPNG = useCallback(() => {
    exportPNG(activeDiagram?.name ?? 'diagram');
  }, [activeDiagram]);

  // ── New file ──────────────────────────────────────────────
  const handleNew = useCallback(() => {
    setSource('// New Isomorph diagram\ndiagram MyDiagram : class {\n\n  class Entity {\n    + id: string\n  }\n\n}\n');
    setActiveDiagramIdx(0);
  }, []);

  // ── Open file from disk ───────────────────────────────────
  const handleFileOpen = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setSource(reader.result);
        setActiveDiagramIdx(0);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, []);

  // ── Global keyboard shortcuts ─────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && !e.shiftKey && e.key === 'n') { e.preventDefault(); handleNew(); }
      if (e.ctrlKey && !e.shiftKey && e.key === 'o') { e.preventDefault(); fileInputRef.current?.click(); }
      if (e.ctrlKey && !e.shiftKey && e.key === 'e') { e.preventDefault(); handleExportSVG(); }
      if (e.ctrlKey && e.shiftKey && e.key === 'E') { e.preventDefault(); handleExportPNG(); }
      if (e.ctrlKey && e.key === '/') { e.preventDefault(); setShortcutsOpen(o => !o); }
      if (e.key === 'Escape' && shortcutsOpen) setShortcutsOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleNew, handleExportSVG, handleExportPNG, shortcutsOpen]);

  const statusClass = allErrors.length > 0
    ? 'iso-status iso-status--err'
    : diagrams.length > 0
      ? 'iso-status iso-status--ok'
      : 'iso-status iso-status--idle';

  return (
    <div className="iso-shell">
      {/* ──────────────── HEADER ──────────────────────────── */}
      <header className="iso-header">
        {/* Logo */}
        <button type="button" className="iso-logo" aria-label="Isomorph home" onClick={e => e.preventDefault()}>
          <div className="iso-logo-mark" aria-hidden="true">Is</div>
          <span className="iso-logo-name">Isomorph</span>
        </button>

        <div className="iso-header-sep" aria-hidden="true" />

        {/* File breadcrumb */}
        <div className="iso-breadcrumb">
          <span className="iso-breadcrumb-name">{fileName}</span>
        </div>

        <div className="iso-header-sep" aria-hidden="true" />

        {/* Diagram tabs */}
        {diagrams.length > 1 && (
          <nav className="iso-tabs" aria-label="Diagrams" style={{ overflowX: 'auto', flexShrink: 1 }}>
            {diagrams.map((d, i) => (
              <button
                key={d.name}
                className={`iso-tab${i === activeDiagramIdx ? ' iso-tab--active' : ''}`}
                type="button"
                onClick={() => setActiveDiagramIdx(i)}
                aria-pressed={i === activeDiagramIdx}
                aria-label={`Switch to ${d.name} (${d.kind} diagram)`}
              >
                {d.name}
                <span className="iso-tab-kind">{d.kind}</span>
              </button>
            ))}
          </nav>
        )}

        <div className="iso-header-spacer" />

        {/* Action: New */}
        <button type="button" className="iso-btn" onClick={handleNew} aria-label="New diagram (Ctrl+N)" data-tooltip="New (Ctrl+N)">
          <IconNew />
          New
        </button>

        {/* Action: Open file */}
        <button type="button" className="iso-btn" onClick={() => fileInputRef.current?.click()} aria-label="Open .isx file (Ctrl+O)" data-tooltip="Open (Ctrl+O)">
          <IconOpen />
          Open
        </button>
        <input ref={fileInputRef} type="file" accept=".isx,.iso,.txt" onChange={handleFileOpen} style={{ display: 'none' }} tabIndex={-1} />

        {/* Action: Examples */}
        <div className="iso-dropdown" ref={examplesRef}>
          <button
            type="button"
            className="iso-btn"
            onClick={() => setExamplesOpen(o => !o)}
            aria-haspopup="menu"
            aria-expanded={examplesOpen}
            aria-label="Load example diagram"
          >
            Examples
            <IconChevron dir={examplesOpen ? 'up' : 'down'} />
          </button>
          {examplesOpen && (
            <div className="iso-dropdown-menu" role="menu" aria-label="Example diagrams">
              {EXAMPLES.map(ex => (
                <button
                  key={ex.label}
                  type="button"
                  className="iso-dropdown-item"
                  role="menuitem"
                  onClick={() => {
                    setSource(ex.source);
                    setActiveDiagramIdx(0);
                    setExamplesOpen(false);
                  }}
                >
                  <span className="iso-dropdown-item-icon" aria-hidden="true">
                    {ex.kind === 'class' ? '⬜' : '⭕'}
                  </span>
                  {ex.label}
                  <span className="iso-dropdown-item-meta">{ex.kind}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Action: Export */}
        <button
          type="button"
          className="iso-btn"
          onClick={handleExportSVG}
          disabled={!activeDiagram}
          aria-label="Export diagram as SVG (Ctrl+E)"
          data-tooltip="Export SVG (Ctrl+E)"
        >
          <IconExport />
          SVG
        </button>
        <button
          type="button"
          className="iso-btn"
          onClick={handleExportPNG}
          disabled={!activeDiagram}
          aria-label="Export diagram as PNG (Ctrl+Shift+E)"
          data-tooltip="Export PNG (Ctrl+Shift+E)"
        >
          <IconExport />
          PNG
        </button>

        <div className="iso-header-sep" aria-hidden="true" />

        {/* Action: Keyboard shortcuts */}
        <button
          type="button"
          className="iso-btn iso-btn--icon"
          onClick={() => setShortcutsOpen(o => !o)}
          aria-label="Keyboard shortcuts (Ctrl+/)"
          data-tooltip="Shortcuts (Ctrl+/)"
        >
          <IconKeyboard />
        </button>

        <div className="iso-header-sep" aria-hidden="true" />

        {/* Status */}
        <output
          className={statusClass}
          aria-live="polite"
          aria-label={allErrors.length > 0 ? `${allErrors.length} error${allErrors.length > 1 ? 's' : ''}` : 'Diagram valid'}
        >
          <div className="iso-status-dot" aria-hidden="true" />
          {allErrors.length > 0
            ? `${allErrors.length} error${allErrors.length > 1 ? 's' : ''}`
            : diagrams.length > 0 ? 'Valid' : 'Ready'}
        </output>
      </header>

      {/* ──────────────── MAIN ────────────────────────────── */}
      <main className="iso-main">
        <SplitPane
          left={
            <div className="iso-panel" style={{ height: '100%' }}>
              <div className="iso-panel-header">
                <IconCode size={11} />
                Source
                <span className="iso-panel-info" aria-live="polite">
                  {parseErrors.length > 0
                    ? ` — ${parseErrors.length} parse error${parseErrors.length > 1 ? 's' : ''}`
                    : source.trim() ? ' — OK' : ''}
                </span>
                <span className="iso-panel-spacer" />
                <span style={{ fontSize: 10, color: 'var(--iso-text-faint)', fontFamily: 'monospace' }}>
                  {source.split('\n').length} lines
                </span>
              </div>
              <div className="iso-panel-body">
                <IsomorphEditor
                  value={source}
                  onChange={setSource}
                  errors={editorDiagnostics}
                />
              </div>
              {/* Inline error list */}
              {allErrors.length > 0 && (
                <div className="iso-error-panel" role="log" aria-label="Errors">
                  {allErrors.slice(0, 8).map((msg, i) => (
                    <div key={`err-${msg.slice(0, 20)}-${i}`} className="iso-error-item">
                      <span className="iso-error-icon" aria-hidden="true">✖</span>
                      <span className="iso-error-msg">{msg}</span>
                    </div>
                  ))}
                  {allErrors.length > 8 && (
                    <div className="iso-error-item">
                      <span className="iso-error-icon" aria-hidden="true">…</span>
                      <span className="iso-error-msg" style={{ color: 'var(--iso-text-muted)' }}>
                        +{allErrors.length - 8} more error{allErrors.length - 8 > 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          }
          right={
            <div className="iso-panel iso-panel--canvas" style={{ height: '100%' }}>
              <div className="iso-panel-header">
                <IconDiagram size={11} />
                Canvas
                <span className="iso-panel-info" aria-live="polite">
                  {activeDiagram
                    ? ` — ${activeDiagram.name} · ${activeDiagram.entities.size} entities · ${activeDiagram.relations.length} relations`
                    : ''}
                </span>
                <span className="iso-panel-spacer" />
                {diagrams.length > 0 && (
                  <span style={{ fontSize: 10, color: '#6e7781', fontFamily: 'monospace' }}>
                    drag to reposition
                  </span>
                )}
              </div>
              <div className="iso-panel-body">
                <DiagramView
                  diagram={activeDiagram}
                  onEntityMove={handleEntityMove}
                  onExportSVG={handleExportSVG}
                />
              </div>
            </div>
          }
        />
      </main>

      {/* ──────────────── STATUS BAR ──────────────────────── */}
      <footer className="iso-statusbar">
        <span className="iso-statusbar-item">Isomorph DSL</span>
        <span className="iso-statusbar-sep">·</span>
        <span className="iso-statusbar-item" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {source.split('\n').length} lines
        </span>
        {activeDiagram && (
          <>
            <span className="iso-statusbar-sep">·</span>
            <span className="iso-statusbar-item" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {activeDiagram.entities.size} entities
            </span>
            <span className="iso-statusbar-sep">·</span>
            <span className="iso-statusbar-item" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {activeDiagram.relations.length} relations
            </span>
            <span className="iso-statusbar-sep">·</span>
            <span className="iso-statusbar-item">{activeDiagram.kind}</span>
          </>
        )}
        <span className="iso-statusbar-sep" style={{ marginLeft: 'auto' }}>·</span>
        <span className="iso-statusbar-item">FAF-241 · Team 02</span>
      </footer>

      {/* ──────────────── SHORTCUTS OVERLAY ───────────────── */}
      <ShortcutsOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
}
