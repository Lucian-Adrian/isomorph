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
import { IconCode, IconDiagram, IconChevron, IconExport, IconNew, IconOpen, IconKeyboard, IconSave } from './components/Icons.js';
import { parse } from './parser/index.js';
import { analyze } from './semantics/analyzer.js';
import { formatAllErrors } from './utils/error-formatter.js';
import { exportSVG, exportPNG } from './utils/exporter.js';
import { EXAMPLES } from './data/examples.js';
import type { IOMDiagram, IOMEntity } from './semantics/iom.js';
import type { ParseError } from './parser/index.js';

type DiagramKind = IOMDiagram['kind'];

interface WorkspaceTab {
  id: string;
  name: string;
  source: string;
  activeDiagramIdx: number;
  diagramKindFilter: 'all' | DiagramKind;
  undoStack?: string[];
  redoStack?: string[];
}

const DIAGRAM_KINDS: Array<'all' | DiagramKind> = ['all', 'class', 'usecase', 'component', 'deployment', 'sequence', 'activity', 'state', 'collaboration', 'flow'];

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
    return `diagram ${diagramName} : flow {\n\n  start Begin\n  action Process\n  stop End\n\n  Begin --> Process\n  Process --> End\n\n  @Begin at (200, 60)\n  @Process at (170, 180)\n  @End at (200, 300)\n\n}\n`;
  }
  if (kind === 'state') {
    return `diagram ${diagramName} : state {\n\n  start Initial\n  state Active\n  stop Final\n\n  Initial --> Active\n  Active --> Final\n\n  @Initial at (200, 60)\n  @Active at (170, 180)\n  @Final at (200, 300)\n\n}\n`;
  }
  if (kind === 'activity') {
    return `diagram ${diagramName} : activity {\n\n  start Begin\n  action DoWork\n  stop End\n\n  Begin --> DoWork\n  DoWork --> End\n\n  @Begin at (200, 60)\n  @DoWork at (170, 180)\n  @End at (200, 300)\n\n}\n`;
  }
  if (kind === 'collaboration') {
    return `diagram ${diagramName} : collaboration {\n\n  object Client\n  object Server\n\n  Client --> Server [label="1: request"]\n\n  @Client at (100, 120)\n  @Server at (380, 120)\n\n}\n`;
  }
  return `diagram ${diagramName} : class {\n\n  class Entity {\n    + id: string\n  }\n\n}\n`;
}

function insertBeforeAnnotations(source: string, insertion: string): string {
  const lastBrace = source.lastIndexOf('}');
  if (lastBrace < 0) return source;
  const diagramBody = source.slice(0, lastBrace);
  const firstAtMatch = diagramBody.match(/^[ \t]*@[A-Za-z0-9_]+[ \t]+at[ \t]+\(/m);
  
  if (firstAtMatch && firstAtMatch.index !== undefined) {
    return source.slice(0, firstAtMatch.index) + insertion + '\n' + source.slice(firstAtMatch.index);
  }
  return source.slice(0, lastBrace) + insertion + '\n' + source.slice(lastBrace);
}

function insertAtEnd(source: string, insertion: string): string {
  const lastBrace = source.lastIndexOf('}');
  if (lastBrace < 0) return source;
  return source.slice(0, lastBrace) + insertion + '\n' + source.slice(lastBrace);
}

/** Normalize indentation and ordering inside diagram blocks. */
function formatDiagramSource(source: string): string {
  // Replace tabs with 2 spaces globally
  let s = source.replace(/\t/g, '  ');
  // Find the diagram block
  const diagramMatch = s.match(/^(diagram\s+\S+\s*:\s*\S+\s*\{)(\n[\s\S]*?)(\n\s*\}\s*)$/m);
  if (!diagramMatch) return s;
  const header = diagramMatch[1];
  const body = diagramMatch[2];

  const entityLines: string[] = [];
  const relationLines: string[] = [];
  const annotationLines: string[] = [];
  const commentLines: string[] = [];
  const otherLines: string[] = [];

  const entityDeclRx = new RegExp(`^\\s*(?:abstract\\s+|static\\s+|final\\s+)*${ENTITY_KINDS_RX}\\s+`, 'm');
  const relRx = /^\s*[A-Za-z_]\w*\s+(--|-->|--\|>|\.\.\|>|<\|-|-|<\|\.\.|<\.\.|o--|\*--|\.\.>|--o|--\*|--x)\s+[A-Za-z_]\w*/;
  const annoRx = /^\s*@[A-Za-z_]\w*\s+at\s*\(/;
  const commentRx = /^\s*\/\//;
  const packageRx = /^\s*package\s+/;
  const closeBraceRx = /^\s*\}\s*$/;

  // Collect multi-line entity blocks (with braces)
  const lines = body.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) { i++; continue; }

    if (annoRx.test(line)) {
      annotationLines.push('  ' + trimmed);
      i++;
    } else if (commentRx.test(line)) {
      commentLines.push('  ' + trimmed);
      i++;
    } else if (relRx.test(line)) {
      relationLines.push('  ' + trimmed);
      i++;
    } else if (entityDeclRx.test(line) || packageRx.test(line)) {
      // Collect the entity including its brace block if present
      let block = '  ' + trimmed;
      if (trimmed.includes('{') && !trimmed.includes('}')) {
        let braceCount = (trimmed.match(/\{/g) || []).length - (trimmed.match(/\}/g) || []).length;
        i++;
        while (i < lines.length && braceCount > 0) {
          const innerLine = lines[i].trim();
          braceCount += (innerLine.match(/\{/g) || []).length - (innerLine.match(/\}/g) || []).length;
          block += '\n    ' + innerLine;
          i++;
        }
      } else {
        i++;
      }
      entityLines.push(block);
    } else if (closeBraceRx.test(line)) {
      // Stray closing brace — skip
      i++;
    } else {
      otherLines.push('  ' + trimmed);
      i++;
    }
  }

  // Rebuild body
  const sections: string[][] = [];
  if (commentLines.length > 0) sections.push(commentLines);
  if (entityLines.length > 0) sections.push(entityLines);
  if (otherLines.length > 0) sections.push(otherLines);
  if (relationLines.length > 0) sections.push(relationLines);
  if (annotationLines.length > 0) sections.push(annotationLines);

  const newBody = sections.map(sec => sec.join('\n')).join('\n\n');

  return header + '\n\n' + newBody + '\n\n}';
}

function toolsetFor(kind?: DiagramKind): CanvasTool[] {
  if (!kind) return ['move', 'hand'];
  return ['move', 'hand', 'add-edge', 'edit-node', 'edit-edge'];
}

function getStencilsForKind(kind?: DiagramKind) {
  switch (kind) {
    case 'class':
      return [
        { label: 'Class', keyword: 'class' },
        { label: 'Abstract Class', keyword: 'abstract class' },
        { label: 'Interface', keyword: 'interface' },
        { label: 'Enum', keyword: 'enum' },
      ];
    case 'usecase':
      return [
        { label: 'Actor', keyword: 'actor' },
        { label: 'Use Case', keyword: 'usecase' },
        { label: 'System', keyword: 'system' },
      ];
    case 'component':
      return [
        { label: 'Component', keyword: 'component' },
        { label: 'Interface', keyword: 'interface' },
        { label: 'Artifact', keyword: 'artifact' },
        { label: 'Node', keyword: 'node' },
      ];
    case 'deployment':
      return [
        { label: 'Node', keyword: 'node' },
        { label: 'Component', keyword: 'component' },
        { label: 'Device', keyword: 'node <<device>>' },
        { label: 'Artifact', keyword: 'artifact' },
        { label: 'Environment', keyword: 'environment' },
      ];
    case 'sequence':
      return [
        { label: 'Actor', keyword: 'actor' },
        { label: 'Participant', keyword: 'participant' },
      ];
    case 'state':
      return [
        { label: 'State', keyword: 'state' },
        { label: 'Start Node', keyword: 'start' },
        { label: 'Final Node', keyword: 'stop' },
        { label: 'Decision', keyword: 'decision' },
        { label: 'Fork', keyword: 'fork' },
        { label: 'Join', keyword: 'join' },
        { label: 'History', keyword: 'history' },
        { label: 'Concurrent', keyword: 'concurrent' },
        { label: 'Composite', keyword: 'composite' },
      ];
    case 'activity':
      return [
        { label: 'Action', keyword: 'action' },
        { label: 'Start Node', keyword: 'start' },
        { label: 'Activity Final', keyword: 'stop' },
        { label: 'Decision', keyword: 'decision' },
        { label: 'Merge', keyword: 'merge' },
        { label: 'Fork', keyword: 'fork' },
        { label: 'Join', keyword: 'join' },
        { label: 'Partition', keyword: 'partition' },
      ];
    case 'collaboration':
      return [
        { label: 'Object', keyword: 'object' },
        { label: 'Actor', keyword: 'actor' },
        { label: 'Multiobject', keyword: 'multiobject' },
        { label: 'Active Object', keyword: 'active_object' },
        { label: 'Composite Obj', keyword: 'composite_object' },
      ];
    case 'flow':
      return [
        { label: 'Process', keyword: 'action' },
        { label: 'Decision', keyword: 'decision' },
        { label: 'Start', keyword: 'start' },
        { label: 'End', keyword: 'stop' },
        { label: 'Fork', keyword: 'fork' },
        { label: 'Join', keyword: 'join' },
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

function changeDiagramKind(source: string, diagramName: string, newKind: string): string {
  const rx = new RegExp(`(diagram\\s+${escapeRegex(diagramName)}\\s*:\\s*)[a-zA-Z]+\\b`);
  return source.replace(rx, `$1${newKind}`);
}

const ENTITY_KINDS_RX = '(?:class|interface|enum|actor|usecase|component|node|participant|partition|decision|merge|fork|join|start|stop|action|state|composite|concurrent|choice|history|device|artifact|environment|boundary|system|multiobject|active_object|collaboration|composite_object)';

function findEntityBounds(source: string, entityName: string): { start: number, end: number, bodyStart: number, bodyEnd: number } | null {
  const sigRx = new RegExp(`^[ \\t]*(?:abstract[ \\t]+|static[ \\t]+|final[ \\t]+)*${ENTITY_KINDS_RX}[ \\t]+${escapeRegex(entityName)}\\b`, 'm');
  const match = sigRx.exec(source);
  if (!match) return null;
  
  let lineEndIndex = source.indexOf('\n', match.index);
  if (lineEndIndex === -1) lineEndIndex = source.length;

  const sigLine = source.slice(match.index, lineEndIndex);
  const inlineBraceIdx = sigLine.indexOf('{');
  
  let searchStart = lineEndIndex;
  let bodyStart = -1;
  
  if (inlineBraceIdx === -1) {
    const after = source.slice(lineEndIndex);
    const braceMatch = after.match(/^\s*\{/);
    if (!braceMatch) {
      const nextLineStart = source.indexOf('\n', lineEndIndex);
      return { start: match.index, end: nextLineStart === -1 ? source.length : nextLineStart + 1, bodyStart: -1, bodyEnd: -1 };
    }
    searchStart = lineEndIndex + braceMatch.index! + braceMatch[0].length;
    bodyStart = searchStart;
  } else {
    searchStart = match.index + inlineBraceIdx + 1;
    bodyStart = searchStart;
  }

  let braceCount = 1;
  for (let i = searchStart; i < source.length; i++) {
    if (source[i] === '{') {
      braceCount++;
    } else if (source[i] === '}') {
      braceCount--;
      if (braceCount === 0) {
        let end = i + 1;
        if (source[end] === '\r') end++;
        if (source[end] === '\n') end++;
        return { start: match.index, end, bodyStart, bodyEnd: i };
      }
    }
  }
  return { start: match.index, end: source.length, bodyStart, bodyEnd: source.length };
}

function extractEntityBody(source: string, entityName: string): string | null {
  const bounds = findEntityBounds(source, entityName);
  if (!bounds || bounds.bodyStart === -1) return null;
  return source.slice(bounds.bodyStart, bounds.bodyEnd).replace(/^\n/, '').replace(/\n\s*$/, '');
}

function extractEntityDeclaration(source: string, entityName: string): string | null {
  const bounds = findEntityBounds(source, entityName);
  if (!bounds) return null;
  return source.slice(bounds.start, bounds.end);
}

function removeEntityDeclaration(source: string, entityName: string): string {
  const bounds = findEntityBounds(source, entityName);
  if (!bounds) return source;
  return source.slice(0, bounds.start) + source.slice(bounds.end);
}

function replaceEntityBody(source: string, entityName: string, newBody: string): string {
  const bounds = findEntityBounds(source, entityName);
  if (!bounds) return source;
  if (bounds.bodyStart === -1) {
    const sigEnd = bounds.end;
    const innerBody = ' {\n  ' + newBody.split('\n').join('\n  ') + '\n}';
    return source.slice(0, sigEnd) + innerBody + source.slice(sigEnd);
  }
  const innerBody = '\n  ' + newBody.split('\n').join('\n  ') + '\n';
  return source.slice(0, bounds.bodyStart) + innerBody + source.slice(bounds.bodyEnd);
}



function updateEntityDeclaration(
  source: string,
  entityName: string,
  updates: { name?: string; stereotype?: string; isAbstract?: boolean },
): string {
  const entityLine = new RegExp(`(^[ \\t]*(?:abstract[ \\t]+|static[ \\t]+|final[ \\t]+)*${ENTITY_KINDS_RX}[ \\t]+)${escapeRegex(entityName)}(\\b[^\\n]*)`, 'm');
  let next = source;

  next = next.replace(entityLine, (_match, prefix: string, rest: string) => {
    let newPrefix = prefix;
    if (updates.isAbstract !== undefined) {
      if (updates.isAbstract && !/abstract\s+/.test(newPrefix)) {
        newPrefix = newPrefix.replace(/^(\s*)/, '$1abstract ');
      } else if (!updates.isAbstract) {
        newPrefix = newPrefix.replace(/abstract\s+/, '');
      }
    }
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
    return `${newPrefix}${updates.name || entityName}${nextRest}`;
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
  updates: { label?: string; kind?: string; direction?: 'forward' | 'reverse'; fromMult?: string; toMult?: string },
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

  if (updates.toMult !== undefined && updates.toMult === '') attrMap.delete('toMult');
  else if (updates.toMult !== undefined) attrMap.set('toMult', updates.toMult);
  if (updates.fromMult !== undefined && updates.fromMult === '') attrMap.delete('fromMult');
  else if (updates.fromMult !== undefined) attrMap.set('fromMult', updates.fromMult);

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
  const [isUMLCompliant, setIsUMLCompliant] = useState(true);
  const [editingEntity, setEditingEntity]   = useState<(IOMEntity & { bodyText?: string; origName?: string }) | null>(null);
  const [editingRelation, setEditingRelation] = useState<{ relationId: string, label: string, kind: string, direction: 'forward' | 'reverse', fromMult?: string, toMult?: string } | null>(null);
  const [renamingTabId, setRenamingTabId]   = useState<string | null>(null);
  const examplesRef                         = useRef<HTMLDivElement>(null);
  const fileInputRef                        = useRef<HTMLInputElement>(null);

  const [selectedItems, setSelectedItems] = useState<{ type: 'entity' | 'relation', id: string }[]>([]);

  const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId) ?? tabs[0], [tabs, activeTabId]);
  const source = activeTab?.source ?? '';
  const fileName = activeTab?.name ?? 'untitled.isx';

  const updateActiveTab = useCallback((update: (tab: WorkspaceTab) => WorkspaceTab, saveHistory = true) => {
    setTabs(prev => prev.map(tab => {
      if (tab.id === (activeTab?.id ?? '')) {
        const result = update(tab);
        if (saveHistory && result.source !== tab.source) {
          result.undoStack = [...(tab.undoStack || []), tab.source];
          result.redoStack = [];
        }
        return result;
      }
      return tab;
    }));
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
  const rawSemanticErrors = analysisResult?.errors ?? [];

  // Rules that enforce strict UML semantics
  const strictUmlRules = ['SS-4', 'SS-5', 'SS-6', 'SS-11'];
  const semanticErrors = rawSemanticErrors.filter(e => isUMLCompliant || !strictUmlRules.includes(e.rule));

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

  const handleEntityEditRequest = useCallback((entity: IOMEntity) => {
    let body = '';
    if (activeTab) {
      body = extractEntityBody(activeTab.source, entity.name) ?? '';
    }
    // Strip leading uniform indentation and tabs from body for display
    if (body) {
      body = body.replace(/\t/g, '  ');
      const bodyLines = body.split('\n');
      // Find minimum leading spaces
      const minIndent = bodyLines.filter(l => l.trim()).reduce((min, l) => {
        const match = l.match(/^(\s*)/);
        return match ? Math.min(min, match[1].length) : min;
      }, Infinity);
      if (minIndent > 0 && minIndent < Infinity) {
        body = bodyLines.map(l => l.slice(minIndent)).join('\n');
      }
    }
    setEditingEntity({ ...entity, bodyText: body, origName: entity.name });
  }, [activeTab]);

  const handleRelationEditRequest = useCallback((relationId: string, label: string, kind: string) => {
    // Also extract multiplicities from the source for editing
    const rel = activeDiagram?.relations.find(r => r.id === relationId);
    setEditingRelation({ relationId, label, kind, direction: 'forward', fromMult: rel?.fromMult || '', toMult: rel?.toMult || '' });
  }, [activeDiagram]);

  const handleRelationAddRequest = useCallback((fromEntity: string, toEntity: string) => {
    updateActiveTab(tab => {
      let newSource = insertBeforeAnnotations(tab.source, `  ${fromEntity} --> ${toEntity}`);
      newSource = formatDiagramSource(newSource);
      return { ...tab, source: newSource };
    });
  }, [updateActiveTab]);

  const handleEntityEdit = useCallback((entityName: string, updates: { name?: string; stereotype?: string; isAbstract?: boolean; bodyText?: string }) => {
    updateActiveTab(tab => {
      let source = updateEntityDeclaration(tab.source, entityName, updates);
      if (updates.bodyText !== undefined) {
        source = replaceEntityBody(source, updates.name || entityName, updates.bodyText);
      }
      source = formatDiagramSource(source);
      return { ...tab, source };
    });
    setEditingEntity(null);
  }, [updateActiveTab]);

  const handleRelationEdit = useCallback((
    relationId: string,
    updates: { label?: string; kind?: string; direction?: 'forward' | 'reverse'; fromMult?: string; toMult?: string },
  ) => {
    updateActiveTab(tab => {
      let src = updateRelationById(tab.source, relationId, updates);
      src = formatDiagramSource(src);
      return { ...tab, source: src };
    });
    setEditingRelation(null);
  }, [updateActiveTab]);

  const handleDropEntity = useCallback((keyword: string, x: number, y: number) => {
    updateActiveTab(tab => {
      let src = tab.source.trim();
      if (!src || src.lastIndexOf('}') < 0) {
        const dk = tab.diagramKindFilter === 'all' ? 'class' : (tab.diagramKindFilter || 'class');
        src = `diagram NewDiagram : ${dk} {\n\n}\n`;
      }

      const baseName = keyword.split(' ')[0]; // for "node <<device>>", baseName is "node"
      
      let index = 1;
      const prefixName = baseName.charAt(0).toUpperCase() + baseName.slice(1);
      let name = `${prefixName}${index}`;
      while (new RegExp(`${ENTITY_KINDS_RX}[ \\t]+${name}\\b`).test(src)) {
        index++;
        name = `${prefixName}${index}`;
      }

      const BRACE_KINDS = ['class', 'interface', 'component', 'node', 'state', 'usecase', 'package', 'composite', 'concurrent', 'environment', 'artifact', 'device', 'enum'];
      let declaration = `  ${keyword} ${name}`;
      if (BRACE_KINDS.includes(baseName)) {
        declaration += ' {\n\n  }';
      }

      src = insertBeforeAnnotations(src, declaration);
      src = insertAtEnd(src, `  @${name} at (${Math.round(x)}, ${Math.round(y)})`);
      src = formatDiagramSource(src);
      return { ...tab, source: src };
    });
  }, [updateActiveTab]);

  // ── Keyboard shortcuts ────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if user is focused on CodeMirror editor or an input/textarea
      const ae = document.activeElement;
      const isInEditor = ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.closest?.('.cm-content') || ae.closest?.('.cm-editor'));

      // Deletion of selected items
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (isInEditor) return;
        
        if (selectedItems.length > 0) {
          updateActiveTab(tab => {
            let nextSource = tab.source;

            for (const item of selectedItems) {
              if (item.type === 'entity') {
                // Wipe entity block properly considering nested braces
                nextSource = removeEntityDeclaration(nextSource, item.id);
                // Wipe annotations
                const rxAnno = new RegExp(`^[ \\t]*@${escapeRegex(item.id)}[ \\t]+at[ \\t]*\\([^)]+\\)[ \\t]*\\n?`, 'gm');
                nextSource = nextSource.replace(rxAnno, '');
                // Wipe relations connected to this
                const rxRel = new RegExp(`^[ \\t]*(?:${escapeRegex(item.id)}[ \\t]+(?:--\\|>|\\.\\.\\|>|<\\|--|<\\|\\.\\.|<\\.\\.|o--|\\*--|-->|\\.\\.>|--o|--\\*|--x|--)[ \\t]+[A-Za-z_][\\w]*|[A-Za-z_][\\w]*[ \\t]+(?:--\\|>|\\.\\.\\|>|<\\|--|<\\|\\.\\.|<\\.\\.|o--|\\*--|-->|\\.\\.>|--o|--\\*|--x|--)[ \\t]+${escapeRegex(item.id)})(?:[ \\t]*\\[[^\\]]*\\])?[ \\t]*\\n?`, 'gm');
                nextSource = nextSource.replace(rxRel, '');
              } else if (item.type === 'relation') {
                const idxRaw = item.id.replace('rel_', '');
                const relationIdx = Number.parseInt(idxRaw, 10);
                if (Number.isInteger(relationIdx) && relationIdx >= 0) {
                  const relRegex = /^([ \t]*)([A-Za-z_][\w]*)[ \t]+(--\|>|\.\.\|>|<\|--|<\|\.\.|<\.\.|o--|\*--|-->|\.\.>|--o|--\*|--x|--)[ \t]+([A-Za-z_][\w]*)([ \t]*\[[^\]]*\])?[ \t]*$/gm;
                  const matches = [...nextSource.matchAll(relRegex)];
                  const match = matches[relationIdx];
                  if (match && match.index != null) {
                    nextSource = nextSource.slice(0, match.index) + nextSource.slice(match.index + match[0].length + 1);
                  }
                }
              }
            }
            return { ...tab, source: nextSource };
          });
          setSelectedItems([]);
        }
      }

      // Undo / Redo (skip when CodeMirror has focus — it has its own undo/redo)
      if ((e.ctrlKey || e.metaKey) && !isInEditor) {
        if (e.key === 'z') {
          e.preventDefault();
          updateActiveTab(tab => {
            if (!tab.undoStack || tab.undoStack.length === 0) return tab;
            const newUndo = [...tab.undoStack];
            const previousSource = newUndo.pop()!;
            return {
              ...tab,
              source: previousSource,
              undoStack: newUndo,
              redoStack: [...(tab.redoStack || []), tab.source]
            };
          }, false);
        } else if (e.key === 'y') {
          e.preventDefault();
          updateActiveTab(tab => {
            if (!tab.redoStack || tab.redoStack.length === 0) return tab;
            const newRedo = [...tab.redoStack];
            const nextSource = newRedo.pop()!;
            return {
              ...tab,
              source: nextSource,
              undoStack: [...(tab.undoStack || []), tab.source],
              redoStack: newRedo
            };
          }, false);
        }

        // Copy selected items
        if (e.key === 'c' && selectedItems.length > 0 && activeDiagram) {
          e.preventDefault();
          const snippets: string[] = [];
          for (const item of selectedItems) {
            if (item.type === 'entity') {
              const entity = activeDiagram.entities.get(item.id);
              if (!entity) continue;
              // Reconstruct the entity declaration from the source using exact boundaries
              const extracted = extractEntityDeclaration(activeTab!.source, item.id);
              if (extracted) snippets.push(extracted.trim());
              
              // Also copy annotations
              const annoRx = new RegExp(`^\\s*@${escapeRegex(item.id)}\\s+at\\s*\\([^)]+\\)`, 'gm');
              const annoMatches = activeTab?.source.match(annoRx);
              if (annoMatches) snippets.push(...annoMatches);
            }
          }
          if (snippets.length > 0) {
            navigator.clipboard.writeText(snippets.join('\n')).catch(() => {});
          }
        }

        // Paste from clipboard
        if (e.key === 'v') {
          e.preventDefault();
          navigator.clipboard.readText().then(text => {
            if (!text.trim()) return;
            // Auto-rename pasted entities to avoid collisions
            let pasteText = text;
            const entityNameRx = new RegExp(`${ENTITY_KINDS_RX}\\s+([A-Za-z_]\\w*)`, 'g');
            const namesToReplace = [...new Set([...pasteText.matchAll(entityNameRx)].map(m => m[1]))];
            
            for (const name of namesToReplace) {
              const baseMatch = name.match(/^([A-Za-z_]+)(\d*)$/);
              const baseStr = baseMatch ? baseMatch[1] : name;
              
              let newName = baseStr + '1';
              let i = 2;
              
              const isNameTaken = (n: string) => {
                const rx = new RegExp(`\\b${escapeRegex(n)}\\b`);
                return rx.test(activeTab?.source || '') || rx.test(pasteText);
              };

              let emergencyBreak = 0;
              while (isNameTaken(newName) && emergencyBreak < 1000) {
                newName = baseStr + i;
                i++;
                emergencyBreak++;
              }
              pasteText = pasteText.replace(new RegExp(`\\b${escapeRegex(name)}\\b`, 'g'), newName);
            }
            // Offset positions by 30px
            pasteText = pasteText.replace(/@(\w+)\s+at\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/g, (_, n, x, y) => {
              return `@${n} at (${parseInt(x) + 30}, ${parseInt(y) + 30})`;
            });
            updateActiveTab(tab => {
              let src = insertBeforeAnnotations(tab.source, pasteText.trim());
              src = formatDiagramSource(src);
              return { ...tab, source: src };
            });
          }).catch(() => {});
        }
        
        // Cut selected items
        if (e.key === 'x' && selectedItems.length > 0 && activeDiagram) {
          e.preventDefault();
          const snippets: string[] = [];
          
          updateActiveTab(tab => {
            let nextSource = tab.source;
            for (const item of selectedItems) {
              if (item.type === 'entity') {
                const entity = activeDiagram.entities.get(item.id);
                if (!entity) continue;
                
                const extracted = extractEntityDeclaration(nextSource, item.id);
                if (extracted) snippets.push(extracted.trim());

                // Wipe entity block properly considering nested braces
                nextSource = removeEntityDeclaration(nextSource, item.id);
                
                // Also copy & wipe annotations
                const annoRx = new RegExp(`^[ \\t]*@${escapeRegex(item.id)}[ \\t]+at[ \\t]*\\([^)]+\\)[ \\t]*\\n?`, 'gm');
                const annoMatches = nextSource.match(annoRx);
                if (annoMatches) snippets.push(...annoMatches.map(s => s.trim()));
                nextSource = nextSource.replace(annoRx, '');
                
                // Wipe relations connected to this
                const rxRel = new RegExp(`^[ \\t]*(?:${escapeRegex(item.id)}[ \\t]+(?:--\\|>|\\.\\.\\|>|<\\|--|<\\|\\.\\.|<\\.\\.|o--|\\*--|-->|\\.\\.>|--o|--\\*|--x|--)[ \\t]+[A-Za-z_][\\w]*|[A-Za-z_][\\w]*[ \\t]+(?:--\\|>|\\.\\.\\|>|<\\|--|<\\|\\.\\.|<\\.\\.|o--|\\*--|-->|\\.\\.>|--o|--\\*|--x|--)[ \\t]+${escapeRegex(item.id)})(?:[ \\t]*\\[[^\\]]*\\])?[ \\t]*\\n?`, 'gm');
                nextSource = nextSource.replace(rxRel, '');
              }
            }
            if (snippets.length > 0) {
              navigator.clipboard.writeText(snippets.join('\n')).catch(() => {});
            }
            return { ...tab, source: nextSource };
          });
        }
      }
    };
    
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedItems, updateActiveTab, activeDiagram, activeTab]);

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
            <div
              key={tab.id}
              className={`iso-tab${tab.id === activeTab?.id ? ' iso-tab--active' : ''}`}
              onClick={() => setActiveTabId(tab.id)}
              onDoubleClick={() => setRenamingTabId(tab.id)}
              aria-label={`Open ${tab.name}`}
              style={{ paddingRight: tabs.length > 1 ? '4px' : '10px' }}
            >
              {renamingTabId === tab.id ? (
                <input
                  autoFocus
                  defaultValue={tab.name}
                  className="iso-tab-rename-input"
                  style={{ background: 'transparent', border: 'none', color: 'inherit', fontFamily: 'inherit', fontSize: 'inherit', outline: 'none', width: '80px', borderBottom: '1px solid currentColor' }}
                  onBlur={(e) => {
                    setTabs(prev => prev.map(t => t.id === tab.id ? { ...t, name: e.target.value || t.name } : t));
                    setRenamingTabId(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                    if (e.key === 'Escape') setRenamingTabId(null);
                  }}
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                tab.name
              )}
              {tabs.length > 1 && (
                <button
                  type="button"
                  style={{ all: 'unset', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '16px', height: '16px', borderRadius: '4px', marginLeft: '4px', cursor: 'pointer', opacity: 0.6 }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '0.6'; e.currentTarget.style.background = 'transparent'; }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Are you sure you want to close "${tab.name}"? Unsaved changes may be lost.`)) {
                      setTabs(prev => {
                        const next = prev.filter(t => t.id !== tab.id);
                        if (activeTabId === tab.id) setActiveTabId(next[Math.max(0, next.length - 1)].id);
                        return next;
                      });
                    }
                  }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </nav>

        <select
          className="iso-select"
            value={activeDiagram?.kind ?? 'class'}
            onChange={e => {
              const next = e.target.value as DiagramKind;
              if (activeDiagram) {
                updateActiveTab(tab => ({
                  ...tab,
                  source: changeDiagramKind(tab.source, activeDiagram.name, next)
                }));
              }
            }}
            aria-label="Change Active Diagram Type"
            title="Change active diagram type"
            disabled={!activeDiagram}
          >
            {DIAGRAM_KINDS.filter(k => k !== 'all').map(k => (
              <option key={k} value={k}>{k}</option>              ))}
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

        {/* Action: Export ISX */}
        <button
          type="button"
          className="iso-btn"
          onClick={() => {
            if (!activeTab) return;
            const blob = new Blob([activeTab.source], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = activeTab.name || 'diagram.isx';
            a.click();
            URL.revokeObjectURL(url);
          }}
          disabled={!activeTab}
          aria-label="Export source code (.isx)"
          data-tooltip="Save ISX"
        >
          <IconSave />
          Save .isx
        </button>

        {/* Action: Export SVG */}
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

        <div className="iso-header-sep" aria-hidden="true" />
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '13px', color: 'var(--iso-text)' }}>
          <input type="checkbox" checked={isUMLCompliant} onChange={e => setIsUMLCompliant(e.target.checked)} />
          Strict UML
        </label>
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
                  onRelationAddRequest={handleRelationAddRequest}
                  onExportSVG={handleExportSVG}
                  onDropEntity={handleDropEntity}
                  availableTools={toolsetFor(activeDiagram?.kind)}
                  selectedItems={selectedItems}
                  onSelectionChange={setSelectedItems}
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
              <label>Kind</label>
              <span style={{ padding: '0.4rem', border: '1px solid transparent' }}>{editingEntity.kind}</span>
            </div>
            <div className="iso-modal-field">
              <label>Stereotype</label>
              <input type="text" value={editingEntity.stereotype} onChange={e => setEditingEntity({ ...editingEntity, stereotype: e.target.value })} placeholder="e.g. device" />
            </div>
            {['class', 'interface'].includes(editingEntity.kind) && (
              <div className="iso-modal-field">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input type="checkbox" checked={editingEntity.isAbstract} onChange={e => setEditingEntity({ ...editingEntity, isAbstract: e.target.checked })} />
                  Abstract
                </label>
              </div>
            )}
            {[
              'class', 'interface', 'enum', 'struct', 'component', 'node', 'device', 
              'environment', 'state', 'activity', 'usecase', 'actor', 'multiobject', 
              'active_object', 'collaboration', 'composite', 'concurrent', 'artifact'
            ].includes(editingEntity.kind) && (
              <div className="iso-modal-field" style={{ alignItems: 'flex-start', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '4px' }}>
                  <label>Body</label>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {['enum'].includes(editingEntity.kind) && (
                       <button type="button" className="iso-btn" style={{fontSize: 10, padding: '2px 6px'}} onClick={(e) => { e.stopPropagation(); setEditingEntity(e => e ? { ...e, bodyText: (e.bodyText ? e.bodyText + '\n' : '') + '  NEW_VALUE' } : null); }}>+ Enum Value</button>
                    )}
                    {['usecase'].includes(editingEntity.kind) && (
                       <button type="button" className="iso-btn" style={{fontSize: 10, padding: '2px 6px'}} onClick={(e) => { e.stopPropagation(); setEditingEntity(e => e ? { ...e, bodyText: (e.bodyText ? e.bodyText + '\n' : '') + '  extensionPoint' } : null); }}>+ Ext Pt</button>
                    )}
                    {['class', 'interface'].includes(editingEntity.kind) && (
                       <>
                         <button type="button" className="iso-btn" style={{fontSize: 10, padding: '2px 6px'}} onClick={(e) => { e.stopPropagation(); setEditingEntity(e => e ? { ...e, bodyText: (e.bodyText ? e.bodyText + '\n' : '') + '  + newField : string' } : null); }}>+ Pub Field</button>
                         <button type="button" className="iso-btn" style={{fontSize: 10, padding: '2px 6px'}} onClick={(e) => { e.stopPropagation(); setEditingEntity(e => e ? { ...e, bodyText: (e.bodyText ? e.bodyText + '\n' : '') + '  - newField : string' } : null); }}>+ Priv Field</button>
                         <button type="button" className="iso-btn" style={{fontSize: 10, padding: '2px 6px'}} onClick={(e) => { e.stopPropagation(); setEditingEntity(e => e ? { ...e, bodyText: (e.bodyText ? e.bodyText + '\n' : '') + '  + newMethod() : void' } : null); }}>+ Pub Method</button>
                       </>
                    )}
                    {['node', 'device', 'environment', 'component'].includes(editingEntity.kind) && (
                       <>
                         <button type="button" className="iso-btn" style={{fontSize: 10, padding: '2px 6px'}} onClick={(e) => { e.stopPropagation(); setEditingEntity(e => e ? { ...e, bodyText: (e.bodyText ? e.bodyText + '\n' : '') + '  node NewNode' } : null); }}>+ Node</button>
                         <button type="button" className="iso-btn" style={{fontSize: 10, padding: '2px 6px'}} onClick={(e) => { e.stopPropagation(); setEditingEntity(e => e ? { ...e, bodyText: (e.bodyText ? e.bodyText + '\n' : '') + '  artifact NewArtifact' } : null); }}>+ Artifact</button>
                         <button type="button" className="iso-btn" style={{fontSize: 10, padding: '2px 6px'}} onClick={(e) => { e.stopPropagation(); setEditingEntity(e => e ? { ...e, bodyText: (e.bodyText ? e.bodyText + '\n' : '') + '  + port1 : provided' } : null); }}>+ Port (prov)</button>
                         <button type="button" className="iso-btn" style={{fontSize: 10, padding: '2px 6px'}} onClick={(e) => { e.stopPropagation(); setEditingEntity(e => e ? { ...e, bodyText: (e.bodyText ? e.bodyText + '\n' : '') + '  + port2 : required' } : null); }}>+ Port (req)</button>
                       </>
                    )}
                    {['state', 'composite', 'concurrent'].includes(editingEntity.kind) && (
                       <>
                         <button type="button" className="iso-btn" style={{fontSize: 10, padding: '2px 6px'}} onClick={(e) => { e.stopPropagation(); setEditingEntity(e => e ? { ...e, bodyText: (e.bodyText ? e.bodyText + '\n' : '') + '  entry() : void' } : null); }}>+ Entry</button>
                         <button type="button" className="iso-btn" style={{fontSize: 10, padding: '2px 6px'}} onClick={(e) => { e.stopPropagation(); setEditingEntity(e => e ? { ...e, bodyText: (e.bodyText ? e.bodyText + '\n' : '') + '  exit() : void' } : null); }}>+ Exit</button>
                         <button type="button" className="iso-btn" style={{fontSize: 10, padding: '2px 6px'}} onClick={(e) => { e.stopPropagation(); setEditingEntity(e => e ? { ...e, bodyText: (e.bodyText ? e.bodyText + '\n' : '') + '  do() : void' } : null); }}>+ Do</button>
                         <button type="button" className="iso-btn" style={{fontSize: 10, padding: '2px 6px'}} onClick={(e) => { e.stopPropagation(); setEditingEntity(e => e ? { ...e, bodyText: (e.bodyText ? e.bodyText + '\n' : '') + '  state SubState' } : null); }}>+ SubState</button>
                       </>
                    )}
                  </div>
                </div>
                <textarea 
                  value={editingEntity.bodyText ?? ''} 
                  onChange={e => setEditingEntity({ ...editingEntity, bodyText: e.target.value })}
                  style={{ width: '100%', minHeight: '120px', fontFamily: 'monospace', padding: '0.5rem', resize: 'vertical' }}
                />
              </div>
            )}
            <div className="iso-modal-actions">
              <button type="button" className="iso-btn" onClick={(e) => { e.stopPropagation(); setEditingEntity(null); }}>Cancel</button>
              <button type="button" className="iso-btn iso-btn--primary" onClick={(e) => { e.stopPropagation(); handleEntityEdit(editingEntity.origName || editingEntity.id, { name: editingEntity.name, stereotype: editingEntity.stereotype, isAbstract: editingEntity.isAbstract, bodyText: editingEntity.bodyText }); }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {editingRelation && (
        <div className="iso-modal-overlay">
          <div className="iso-modal">
            <h3>Edit Relation</h3>
            <div className="iso-modal-field">
              <label>Role / Label</label>
              <div style={{ display: 'flex', gap: '4px', width: '100%' }}>
                <input type="text" style={{ flex: 1 }} value={editingRelation.label} onChange={e => setEditingRelation({ ...editingRelation, label: e.target.value })} autoFocus />
                {['state', 'activity'].includes(activeDiagram?.kind || '') && (
                  <button className="iso-btn" onClick={() => setEditingRelation(r => r ? { ...r, label: r.label.includes('[') ? r.label : `[${r.label || 'guard'}]` } : null)}>+ Guard</button>
                )}
              </div>
            </div>
            {['class'].includes(activeDiagram?.kind || '') && (
              <div style={{ display: 'flex', gap: '16px' }}>
                <div className="iso-modal-field" style={{ flex: 1 }}>
                  <label>From Mult (e.g. 1)</label>
                  <input type="text" value={editingRelation.fromMult || ''} onChange={e => setEditingRelation({ ...editingRelation, fromMult: e.target.value })} />
                </div>
                <div className="iso-modal-field" style={{ flex: 1 }}>
                  <label>To Mult (e.g. 0..*)</label>
                  <input type="text" value={editingRelation.toMult || ''} onChange={e => setEditingRelation({ ...editingRelation, toMult: e.target.value })} />
                </div>
              </div>
            )}
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
              <button className="iso-btn iso-btn--primary" onClick={() => handleRelationEdit(editingRelation.relationId, { label: editingRelation.label, kind: editingRelation.kind, direction: editingRelation.direction, fromMult: editingRelation.fromMult, toMult: editingRelation.toMult })}>Save</button>
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
