// ============================================================
// Isomorph — Main Application Component (v2 — polished IDE)
// ============================================================

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { IsomorphEditor } from './editor/IsomorphEditor.js';
import type { LintDiagnostic } from './editor/IsomorphEditor.js';
import { DiagramView } from './components/DiagramView.js';
import { SplitPane } from './components/SplitPane.js';
import { parse } from './parser/index.js';
import { analyze } from './semantics/analyzer.js';
import type { IOMDiagram } from './semantics/iom.js';
import type { ParseError } from './parser/index.js';

// ── Example snippets ─────────────────────────────────────────

const EXAMPLES: { label: string; kind: string; source: string }[] = [
  {
    label: 'Library System',
    kind: 'class',
    source: `// Library System — class diagram
diagram LibrarySystem : class {

  package domain {

    abstract class Book <<Entity>> implements Borrowable {
      + title: string
      + isbn: string
      - stock: int = 0
      + checkOut(user: string): bool
      + getTitle(): string
    }

    class Library {
      + name: string
      + addBook(book: Book): void
      + search(query: string): List<Book>
    }

    interface Borrowable {
      + borrow(user: string): void
      + return(): void
    }

    enum BookStatus {
      AVAILABLE
      CHECKED_OUT
      RESERVED
    }

  }

  Library --* Book [label="contains", toMult="1..*"]
  Book ..|> Borrowable

  @Book at (100, 130)
  @Library at (400, 130)
  @Borrowable at (100, 360)
  @BookStatus at (400, 360)

}
`,
  },
  {
    label: 'E-Commerce',
    kind: 'class',
    source: `// E-Commerce platform — class diagram
diagram ECommerce : class {

  abstract class User {
    + id: string
    + email: string
    + createdAt: string
    + login(password: string): bool
  }

  class Customer extends User {
    + address: string
    + placeOrder(items: List<CartItem>): Order
  }

  class Admin extends User {
    + role: string
    + manageProduct(p: Product): void
  }

  class Product {
    + id: string
    + name: string
    + price: float
    + stock: int
  }

  class Order {
    + id: string
    + total: float
    + status: OrderStatus
    + confirm(): void
  }

  enum OrderStatus {
    PENDING
    CONFIRMED
    SHIPPED
    DELIVERED
  }

  Customer --> Order [label="places", toMult="0..*"]
  Order --* Product [label="contains", toMult="1..*"]
  Admin --> Product [label="manages", toMult="0..*"]

  @User at (300, 60)
  @Customer at (100, 220)
  @Admin at (500, 220)
  @Product at (500, 400)
  @Order at (100, 400)
  @OrderStatus at (300, 540)

}
`,
  },
  {
    label: 'Use-Case',
    kind: 'usecase',
    source: `// Library use-case diagram
diagram LibraryUseCase : usecase {

  actor Student
  actor Librarian
  actor System

  usecase SearchBooks
  usecase BorrowBook
  usecase ReturnBook
  usecase ManageCatalog
  usecase GenerateReport

  Student --> SearchBooks
  Student --> BorrowBook
  Student --> ReturnBook
  Librarian --> ManageCatalog
  Librarian --> GenerateReport
  System --> GenerateReport [label="schedules"]

  @Student at (80, 300)
  @Librarian at (80, 480)
  @SearchBooks at (350, 180)
  @BorrowBook at (350, 300)
  @ReturnBook at (350, 420)
  @ManageCatalog at (650, 360)
  @GenerateReport at (650, 480)

}
`,
  },
];

const DEFAULT_SOURCE = EXAMPLES[0].source;

// ── Icons (inline SVG) ───────────────────────────────────────

function IconCode({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <polyline points="5,4 1,8 5,12"/>
      <polyline points="11,4 15,8 11,12"/>
    </svg>
  );
}

function IconDiagram({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="1" y="1" width="5" height="4" rx="1"/>
      <rect x="10" y="1" width="5" height="4" rx="1"/>
      <rect x="5" y="11" width="6" height="4" rx="1"/>
      <line x1="3.5" y1="5" x2="3.5" y2="9"/>
      <line x1="12.5" y1="5" x2="12.5" y2="9"/>
      <line x1="3.5" y1="9" x2="8" y2="9"/>
      <line x1="12.5" y1="9" x2="8" y2="9"/>
      <line x1="8" y1="9" x2="8" y2="11"/>
    </svg>
  );
}

function IconChevron({ size = 12, dir = 'down' }: { size?: number; dir?: 'down'|'up' }) {
  const r = dir === 'up' ? 'rotate(180)' : undefined;
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" style={{ transform: r }}>
      <polyline points="2,4 6,8 10,4"/>
    </svg>
  );
}

function IconExport({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M2 10v4h12v-4"/>
      <line x1="8" y1="2" x2="8" y2="10"/>
      <polyline points="5,7 8,10 11,7"/>
    </svg>
  );
}

function IconNew({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M9 2H3a1 1 0 00-1 1v10a1 1 0 001 1h10a1 1 0 001-1V7"/>
      <polyline points="9,2 9,7 14,7"/>
      <line x1="13" y1="2" x2="13" y2="7" stroke="none"/>
    </svg>
  );
}

// ── App ──────────────────────────────────────────────────────

export default function App() {
  const [source, setSource]                 = useState(DEFAULT_SOURCE);
  const [activeDiagramIdx, setActiveDiagramIdx] = useState(0);
  const [examplesOpen, setExamplesOpen]     = useState(false);
  const [fileName]                          = useState('untitled.isx');
  const examplesRef                         = useRef<HTMLDivElement>(null);

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
  const allErrors: string[] = [
    ...parseErrors.map(e => `[${e.line}:${e.col}] ${e.message}`),
    ...(analysisResult?.errors ?? []).map(e =>
      e.line != null
        ? `[${e.line}:${e.col}] (${e.rule}) ${e.message}`
        : `(${e.rule}) ${e.message}`
    ),
  ];

  // Combined parse + semantic diagnostics for the editor lint gutter
  const editorDiagnostics: LintDiagnostic[] = [
    ...parseErrors.map(e => ({ message: e.message, line: e.line, col: e.col, severity: 'error' as const })),
    ...(analysisResult?.errors ?? [])
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

  // ── Export diagram as SVG ─────────────────────────────────
  const handleExportSVG = useCallback(() => {
    const svgEl = document.querySelector('.iso-canvas-wrap svg');
    if (!svgEl) return;
    const svgStr = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeDiagram?.name ?? 'diagram'}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }, [activeDiagram]);

  // ── New file ──────────────────────────────────────────────
  const handleNew = useCallback(() => {
    setSource('// New Isomorph diagram\ndiagram MyDiagram : class {\n\n  class Entity {\n    + id: string\n  }\n\n}\n');
    setActiveDiagramIdx(0);
  }, []);

  // Keyboard shortcut: Ctrl+N → new file (MF-4)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'n') { e.preventDefault(); handleNew(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleNew]);

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
        <button type="button" className="iso-btn" onClick={handleNew} aria-label="New diagram (Ctrl+N)" data-tooltip="New file">
          <IconNew />
          New
        </button>

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
          aria-label="Export diagram as SVG"
          data-tooltip="Export SVG"
        >
          <IconExport />
          Export
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
    </div>
  );
}

