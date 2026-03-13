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
import type { CanvasTool } from './components/DiagramView.js';
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

type DiagramKind = IOMDiagram['kind'];

interface WorkspaceTab {
  id: string;
  name: string;
  source: string;
  activeDiagramIdx: number;
  diagramKindFilter: 'all' | DiagramKind;
}

const DIAGRAM_KINDS: Array<'all' | DiagramKind> = ['all', 'class', 'usecase', 'component', 'deployment', 'sequence', 'flow'];

const REL_TOKENS_BY_KIND: Record<string, string> = {
  association: '--',
  'directed-association': '-->',
  inheritance: '--|>',
  realization: '..|>',
  aggregation: '--o',
  composition: '--*',
  dependency: '..>',
  restriction: '--x',
};

function slugId() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function templateFor(kind: DiagramKind): string {
  const diagramName = `New${kind.charAt(0).toUpperCase()}${kind.slice(1)}Diagram`;
  if (kind === 'usecase') {
    return `diagram ${diagramName} : usecase {\n\n  actor User\n  usecase MainFlow\n\n  User --> MainFlow\n\n  @User at (80, 220)\n  @MainFlow at (360, 220)\n\n}\n`;
  }
  if (kind === 'component') {
    return `diagram ${diagramName} : component {\n\n  component Gateway\n  component Service\n\n  Gateway --> Service [label="calls"]\n\n  @Gateway at (120, 120)\n  @Service at (380, 120)\n\n}\n`;
  }
  if (kind === 'deployment') {
    return `diagram ${diagramName} : deployment {\n\n  node AppNode\n  component Api\n\n  AppNode --> Api [label="hosts"]\n\n  @AppNode at (120, 120)\n  @Api at (380, 120)\n\n}\n`;
  }
  if (kind === 'sequence') {
    return `diagram ${diagramName} : sequence {\n\n  actor User\n\n}\n`;
  }
  if (kind === 'flow') {
    return `diagram ${diagramName} : flow {\n\n  component Start\n\n}\n`;
  }
  return `diagram ${diagramName} : class {\n\n  class Entity {\n    + id: string\n  }\n\n}\n`;
}

function toolsetFor(kind?: DiagramKind): CanvasTool[] {
  if (!kind) return ['move', 'hand'];
  if (kind === 'sequence' || kind === 'flow') return ['hand'];
  return ['move', 'hand', 'edit-node', 'edit-edge'];
}

function getStencilsForKind(kind?: DiagramKind) {
  switch (kind) {
    case 'class':
      return [
        { label: 'Class', keyword: 'class' },
        { label: 'Interface', keyword: 'interface' },
        { label: 'Enum', keyword: 'enum' },
      ];
    case 'usecase':
      return [
        { label: 'Actor', keyword: 'actor' },
        { label: 'Use Case', keyword: 'usecase' },
      ];
    case 'component':
      return [
        { label: 'Component', keyword: 'component' },
        { label: 'Interface', keyword: 'interface' },
      ];
    case 'deployment':
      return [
        { label: 'Node', keyword: 'node' },
        { label: 'Component', keyword: 'component' },
        { label: 'Device', keyword: 'node <<device>>' },
      ];
    case 'sequence':
      return [
        { label: 'Actor', keyword: 'actor' },
        { label: 'Participant', keyword: 'participant' },
      ];
    case 'flow':
      return [
        { label: 'Action', keyword: 'component' },
      ];
    default:
      return [];
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function updateEntityPosition(source: string, name: string, x: number, y: number): string {
  const newAnnotation = `@${name} at (${x}, ${y})`;
  const pattern = new RegExp(`@${escapeRegex(name)}\\s+at\\s+\\([^)]+\\)`);
  if (pattern.test(source)) {
    return source.replace(pattern, newAnnotation);
  }
  const lastBrace = source.lastIndexOf('}');
  return lastBrace < 0 ? source : source.slice(0, lastBrace) + `  ${newAnnotation}\n` + source.slice(lastBrace);
}

function updateEntityDeclaration(
  source: string,
  entityName: string,
  updates: { name?: string; stereotype?: string },
): string {
  const entityLine = new RegExp(`(^\\s*(?:abstract\\s+|static\\s+|final\\s+)*(?:class|interface|enum|actor|usecase|component|node)\\s+)${escapeRegex(entityName)}(\\b[^\\n]*)`, 'm');
  let next = source;

  next = next.replace(entityLine, (_match, prefix: string, rest: string) => {
    const hasStereo = /<<[^>]+>>/.test(rest);
    let nextRest = rest;
    if (updates.stereotype !== undefined) {
      if (updates.stereotype) {
        if (hasStereo) {
          nextRest = nextRest.replace(/<<[^>]+>>/, `<<${updates.stereotype}>>`);
        } else {
          nextRest = ` <<${updates.stereotype}>>${nextRest}`;
        }
      } else {
        nextRest = nextRest.replace(/\s*<<[^>]+>>/, '');
      }
    }
    return `${prefix}${updates.name || entityName}${nextRest}`;
  });

  if (updates.name && updates.name !== entityName) {
    const identPattern = new RegExp(`\\b${escapeRegex(entityName)}\\b`, 'g');
    next = next.replace(identPattern, updates.name);
  }

  return next;
}

function updateRelationById(
  source: string,
  relationId: string,
  updates: { label?: string; kind?: string; direction?: 'forward' | 'reverse' },
): string {
  const idxRaw = relationId.replace('rel_', '');
  const relationIdx = Number.parseInt(idxRaw, 10);
  if (!Number.isInteger(relationIdx) || relationIdx < 0) return source;

  const relRegex = /^(\s*)([A-Za-z_][\w]*)\s+(--\|>|\.\.\|>|<\|--|<\|\.\.|<\.\.|o--|\*--|-->|\.\.>|--o|--\*|--x|--)\s+([A-Za-z_][\w]*)(\s*\[[^\]]*\])?\s*$/gm;
  const matches = [...source.matchAll(relRegex)];
  const match = matches[relationIdx];
  if (!match || match.index == null) return source;

  const [full, indent, fromRaw, opRaw, toRaw, attrsRaw = ''] = match;
  let from = fromRaw;
  let to = toRaw;
  let op = REL_TOKENS_BY_KIND[updates.kind ?? ''] ?? opRaw;

  if (updates.direction === 'reverse') {
    const tmp = from;
    from = to;
    to = tmp;
  }

  const attrs = attrsRaw.trim().replace(/^\[|\]$/g, '');
  const attrMap = new Map<string, string>();
  if (attrs) {
    for (const pair of attrs.split(',')) {
      const [k, v] = pair.split('=').map(s => s.trim());
      if (!k || v == null) continue;
      attrMap.set(k, v.replace(/^"|"$/g, ''));
    }
  }

  if (updates.label !== undefined) {
    if (updates.label) attrMap.set('label', updates.label);
    else attrMap.delete('label');
  }

  const attrsSerialized = [...attrMap.entries()].map(([k, v]) => `${k}="${v}"`).join(', ');
  const suffix = attrsSerialized ? ` [${attrsSerialized}]` : '';
  const replacement = `${indent}${from} ${op} ${to}${suffix}`;

  return source.slice(0, match.index) + replacement + source.slice(match.index + full.length);
}

// ── App ──────────────────────────────────────────────────────

export default function App() {
  const [tabs, setTabs] = useState<WorkspaceTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');
  const [newDiagramKind, setNewDiagramKind] = useState<DiagramKind>('class');
  const [examplesOpen, setExamplesOpen]     = useState(false);
  const [shortcutsOpen, setShortcutsOpen]   = useState(false);
  const [editingEntity, setEditingEntity]   = useState<{ entityName: string, name: string, stereotype: string } | null>(null);
  const [editingRelation, setEditingRelation] = useState<{ relationId: string, label: string, kind: string, direction: 'forward' | 'reverse' } | null>(null);
  const examplesRef                         = useRef<HTMLDivElement>(null);
  const fileInputRef                        = useRef<HTMLInputElement>(null);

  const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId) ?? tabs[0], [tabs, activeTabId]);
  const source = activeTab?.source ?? '';
  const fileName = activeTab?.name ?? 'untitled.isx';

  const updateActiveTab = useCallback((update: (tab: WorkspaceTab) => WorkspaceTab) => {
    setTabs(prev => prev.map(tab => (tab.id === (activeTab?.id ?? '') ? update(tab) : tab)));
  }, [activeTab]);

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
  const filteredDiagrams = useMemo(() => {
    if (!activeTab || activeTab.diagramKindFilter === 'all') return diagrams;
    return diagrams.filter(d => d.kind === activeTab.diagramKindFilter);
  }, [diagrams, activeTab]);
  const activeDiagramIdx = activeTab?.activeDiagramIdx ?? 0;
  const safeDiagramIdx = Math.max(0, Math.min(activeDiagramIdx, Math.max(filteredDiagrams.length - 1, 0)));
  const activeDiagram = filteredDiagrams[safeDiagramIdx] ?? null;

  useEffect(() => {
    if (!activeTab) return;
    if (safeDiagramIdx !== activeDiagramIdx) {
      updateActiveTab(tab => ({ ...tab, activeDiagramIdx: safeDiagramIdx }));
    }
  }, [activeTab, safeDiagramIdx, activeDiagramIdx, updateActiveTab]);

  // ── Bidirectional: drag entity → update @Entity at ───────
  const handleEntityMove = useCallback((name: string, x: number, y: number) => {
    updateActiveTab(tab => ({
      ...tab,
      source: updateEntityPosition(tab.source, name, x, y),
    }));
  }, [updateActiveTab]);

  const handleEntityEditRequest = useCallback((entityName: string, name: string, stereotype: string) => {
    setEditingEntity({ entityName, name, stereotype });
  }, []);

  const handleRelationEditRequest = useCallback((relationId: string, label: string, kind: string) => {
    setEditingRelation({ relationId, label, kind, direction: 'forward' });
  }, []);

  const handleEntityEdit = useCallback((entityName: string, updates: { name?: string; stereotype?: string }) => {
    updateActiveTab(tab => ({
      ...tab,
      source: updateEntityDeclaration(tab.source, entityName, updates),
    }));
    setEditingEntity(null);
  }, [updateActiveTab]);

  const handleRelationEdit = useCallback((
    relationId: string,
    updates: { label?: string; kind?: string; direction?: 'forward' | 'reverse' },
  ) => {
    updateActiveTab(tab => ({
      ...tab,
      source: updateRelationById(tab.source, relationId, updates),
    }));
    setEditingRelation(null);
  }, [updateActiveTab]);

  const handleDropEntity = useCallback((keyword: string, x: number, y: number) => {
    updateActiveTab(tab => {
      let src = tab.source;
      const baseName = keyword.split(' ')[0]; // for "node <<device>>", baseName is "node"
      const name = `${baseName.charAt(0).toUpperCase() + baseName.slice(1)}${Math.floor(Math.random() * 1000)}`;
      
      let declaration = `\n  ${keyword} ${name}`;
      if (keyword === 'class' || keyword === 'interface' || keyword === 'enum') {
        declaration += ' {\n  }\n';
      } else {
        declaration += '\n';
      }

      const lastBrace = src.lastIndexOf('}');
      if (lastBrace >= 0) {
        src = src.slice(0, lastBrace) + declaration + `  @${name} at (${Math.round(x)}, ${Math.round(y)})\n` + src.slice(lastBrace);
      }
      return { ...tab, source: src };
    });
  }, [updateActiveTab]);

  // ── Export callbacks (delegated to exporter module) ───────
  const handleExportSVG = useCallback(() => {
    exportSVG(activeDiagram?.name ?? 'diagram');
  }, [activeDiagram]);

  const handleExportPNG = useCallback(() => {
    exportPNG(activeDiagram?.name ?? 'diagram');
  }, [activeDiagram]);

  // ── New file ──────────────────────────────────────────────
  const handleNew = useCallback(() => {
    const id = `tab-${slugId()}`;
    setTabs(prev => [
      ...prev,
      {
        id,
        name: `untitled-${prev.length + 1}.isx`,
        source: templateFor(newDiagramKind),
        activeDiagramIdx: 0,
        diagramKindFilter: 'all',
      },
    ]);
    setActiveTabId(id);
  }, [newDiagramKind]);

  // ── Open file from disk ───────────────────────────────────
  const handleFileOpen = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const text = reader.result;
        const id = `tab-${slugId()}`;
        setTabs(prev => [
          ...prev,
          {
            id,
            name: file.name,
            source: text,
            activeDiagramIdx: 0,
            diagramKindFilter: 'all',
          },
        ]);
        setActiveTabId(id);
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

  if (tabs.length === 0) {
    return (
      <div className="iso-shell">
        <header className="iso-header">
          <button type="button" className="iso-logo" aria-label="Isomorph home">
            <div className="iso-logo-mark" aria-hidden="true">Is</div>
            <span className="iso-logo-name">Isomorph</span>
          </button>
          <div className="iso-header-sep" />
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select
              className="iso-select"
              value={newDiagramKind}
              onChange={e => setNewDiagramKind(e.target.value as DiagramKind)}
              aria-label="Template type for new tab"
            >
              {DIAGRAM_KINDS.filter(k => k !== 'all').map(k => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
            <button type="button" className="iso-btn" onClick={handleNew}><IconNew /> New</button>
            <button type="button" className="iso-btn" onClick={() => fileInputRef.current?.click()}><IconOpen /> Open</button>
          </div>
        </header>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--iso-bg-app)', color: 'var(--iso-text)' }}>
          <h1 style={{ fontWeight: 300, marginBottom: '24px' }}>Welcome to Isomorph</h1>
          <p style={{ color: 'var(--iso-text-muted)', marginBottom: '32px' }}>Open an existing diagram or create a new one to get started.</p>
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <select
                className="iso-select"
                style={{ padding: '8px', fontSize: '14px', minHeight: '36px' }}
                value={newDiagramKind}
                onChange={e => setNewDiagramKind(e.target.value as DiagramKind)}
              >
                {DIAGRAM_KINDS.filter(k => k !== 'all').map(k => (
                  <option key={k} value={k}>{k.charAt(0).toUpperCase() + k.slice(1)} Diagram</option>
                ))}
              </select>
              <button className="iso-btn iso-btn--primary" style={{ padding: '8px 16px', justifyContent: 'center' }} onClick={handleNew}>
                Create New Diagram
              </button>
            </div>
            <div style={{ borderLeft: '1px solid var(--iso-border)' }}></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="iso-btn" style={{ padding: '8px 16px', minHeight: '36px', justifyContent: 'center' }} onClick={() => fileInputRef.current?.click()}>
                Open Existing File...
              </button>
            </div>
          </div>
          <input ref={fileInputRef} type="file" accept=".isx,.iso,.txt" onChange={handleFileOpen} style={{ display: 'none' }} tabIndex={-1} />
        </div>
      </div>
    );
  }

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
            {filteredDiagrams.map((d, i) => (
              <button
                key={d.name}
                className={`iso-tab${i === safeDiagramIdx ? ' iso-tab--active' : ''}`}
                type="button"
                onClick={() => updateActiveTab(tab => ({ ...tab, activeDiagramIdx: i }))}
                aria-pressed={i === safeDiagramIdx}
                aria-label={`Switch to ${d.name} (${d.kind} diagram)`}
              >
                {d.name}
                <span className="iso-tab-kind">{d.kind}</span>
              </button>
            ))}
          </nav>
        )}

        <div className="iso-header-spacer" />

        <nav className="iso-tabs" aria-label="Open files" style={{ maxWidth: 360, overflowX: 'auto' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`iso-tab${tab.id === activeTab?.id ? ' iso-tab--active' : ''}`}
              type="button"
              onClick={() => setActiveTabId(tab.id)}
              aria-label={`Open ${tab.name}`}
            >
              {tab.name}
            </button>
          ))}
        </nav>

        <select
          className="iso-select"
          value={newDiagramKind}
          onChange={e => setNewDiagramKind(e.target.value as DiagramKind)}
          aria-label="Template type for new tab"
          title="New tab diagram type"
        >
          {DIAGRAM_KINDS.filter(k => k !== 'all').map(k => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>

        <select
          className="iso-select"
          value={activeTab?.diagramKindFilter ?? 'all'}
          onChange={e => {
            const next = e.target.value as 'all' | DiagramKind;
            updateActiveTab(tab => ({ ...tab, diagramKindFilter: next, activeDiagramIdx: 0 }));
          }}
          aria-label="Diagram kind filter"
          title="Filter diagrams by type"
        >
          {DIAGRAM_KINDS.map(k => (
            <option key={k} value={k}>{k === 'all' ? 'all types' : k}</option>
          ))}
        </select>

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
                    updateActiveTab(tab => ({
                      ...tab,
                      source: ex.source,
                      activeDiagramIdx: 0,
                      diagramKindFilter: ex.kind as DiagramKind,
                    }));
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
        {activeDiagram?.kind && getStencilsForKind(activeDiagram.kind).length > 0 && (
          <div className="iso-sidebar" style={{ width: 160, borderRight: '1px solid var(--iso-divider)', background: 'var(--iso-bg-sidebar)', display: 'flex', flexDirection: 'column' }}>
            <div className="iso-panel-header" style={{ borderBottom: '1px solid var(--iso-divider)', padding: '0 12px' }}>
              <IconDiagram size={11} /> Shapes
            </div>
            <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {getStencilsForKind(activeDiagram.kind).map(stencil => (
                <div
                  key={stencil.label}
                  draggable
                  onDragStart={e => {
                    e.dataTransfer.setData('text/plain', stencil.keyword);
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  style={{
                    padding: '8px', background: 'var(--iso-bg-header)', border: '1px solid var(--iso-border)',
                    borderRadius: '4px', cursor: 'grab', fontSize: '12px', textAlign: 'center', userSelect: 'none'
                  }}
                >
                  {stencil.label}
                </div>
              ))}
            </div>
          </div>
        )}
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
                  onChange={value => updateActiveTab(tab => ({ ...tab, source: value }))}
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
                  onEntityEditRequest={handleEntityEditRequest}
                  onRelationEditRequest={handleRelationEditRequest}
                  onExportSVG={handleExportSVG}
                  onDropEntity={handleDropEntity}
                  availableTools={toolsetFor(activeDiagram?.kind)}
                />
              </div>
            </div>
          }
        />
      </main>

      {editingEntity && (
        <div className="iso-modal-overlay">
          <div className="iso-modal">
            <h3>Edit Entity</h3>
            <div className="iso-modal-field">
              <label>Name</label>
              <input type="text" value={editingEntity.name} onChange={e => setEditingEntity({ ...editingEntity, name: e.target.value })} autoFocus />
            </div>
            <div className="iso-modal-field">
              <label>Stereotype</label>
              <input type="text" value={editingEntity.stereotype} onChange={e => setEditingEntity({ ...editingEntity, stereotype: e.target.value })} placeholder="e.g. device" />
            </div>
            <div className="iso-modal-actions">
              <button className="iso-btn" onClick={() => setEditingEntity(null)}>Cancel</button>
              <button className="iso-btn iso-btn--primary" onClick={() => handleEntityEdit(editingEntity.entityName, { name: editingEntity.name, stereotype: editingEntity.stereotype })}>Save</button>
            </div>
          </div>
        </div>
      )}

      {editingRelation && (
        <div className="iso-modal-overlay">
          <div className="iso-modal">
            <h3>Edit Relation</h3>
            <div className="iso-modal-field">
              <label>Label</label>
              <input type="text" value={editingRelation.label} onChange={e => setEditingRelation({ ...editingRelation, label: e.target.value })} autoFocus />
            </div>
            <div className="iso-modal-field">
              <label>Kind</label>
              <select className="iso-select" value={editingRelation.kind} onChange={e => setEditingRelation({ ...editingRelation, kind: e.target.value })}>
                <option value="association">Association</option>
                <option value="directed-association">Directed Association</option>
                <option value="inheritance">Inheritance</option>
                <option value="realization">Realization</option>
                <option value="aggregation">Aggregation</option>
                <option value="composition">Composition</option>
                <option value="dependency">Dependency</option>
                <option value="restriction">Restriction</option>
              </select>
            </div>
            <div className="iso-modal-field">
              <label>Direction</label>
              <select className="iso-select" value={editingRelation.direction} onChange={e => setEditingRelation({ ...editingRelation, direction: e.target.value as 'forward' | 'reverse' })}>
                <option value="forward">Forward</option>
                <option value="reverse">Reverse</option>
              </select>
            </div>
            <div className="iso-modal-actions">
              <button className="iso-btn" onClick={() => setEditingRelation(null)}>Cancel</button>
              <button className="iso-btn iso-btn--primary" onClick={() => handleRelationEdit(editingRelation.relationId, { label: editingRelation.label, kind: editingRelation.kind, direction: editingRelation.direction })}>Save</button>
            </div>
          </div>
        </div>
      )}

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
