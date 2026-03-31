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
import { IconCode, IconDiagram, IconChevron, IconExport, IconNew, IconOpen, IconKeyboard, IconSave, IconTheme } from './components/Icons.js';
import { parse } from './parser/index.js';
import { analyze } from './semantics/analyzer.js';
import { formatAllErrors } from './utils/error-formatter.js';
import { exportSVG, exportPNG } from './utils/exporter.js';
import { EXAMPLES } from './data/examples.js';
import type { IOMDiagram, IOMEntity } from './semantics/iom.js';
import type { ParseError } from './parser/index.js';
import { LANGUAGE_OPTIONS, getStoredLanguage, setStoredLanguage, tText, type Language } from './i18n.js';

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
  provides: '--()',
  requires: '--(',
};

function slugId() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function escapeAttrValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function sequenceToCollaborationSource(diagram: IOMDiagram): string {
  const collabName = `${diagram.name}Collaboration`;
  const lines: string[] = [];
  lines.push(`diagram ${collabName} : collaboration {`);
  lines.push('');

  for (const ent of diagram.entities.values()) {
    const declKind = ent.kind === 'actor' ? 'actor' : 'object';
    lines.push(`  ${declKind} ${ent.name}`);
  }

  if (diagram.entities.size > 0) {
    lines.push('');
  }

  diagram.relations.forEach((rel, idx) => {
    const attrs: string[] = [];
    if (rel.label) attrs.push(`label="${escapeAttrValue(rel.label)}"`);
    attrs.push(`msg="${idx + 1}"`);
    const suffix = attrs.length > 0 ? ` [${attrs.join(', ')}]` : '';
    lines.push(`  ${rel.from} --> ${rel.to}${suffix}`);
  });

  if (diagram.relations.length > 0) {
    lines.push('');
  }

  for (const ent of diagram.entities.values()) {
    if (!ent.position) continue;
    const { x, y, w, h } = ent.position;
    if (Number.isFinite(w) && Number.isFinite(h)) {
      lines.push(`  @${ent.name} at (${Math.round(x)}, ${Math.round(y)}, ${Math.round(w!)}, ${Math.round(h!)})`);
    } else {
      lines.push(`  @${ent.name} at (${Math.round(x)}, ${Math.round(y)})`);
    }
  }

  lines.push('');
  lines.push('}');
  lines.push('');
  return lines.join('\n');
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

function insertIntoPackage(source: string, targetPackage: string, declaration: string) {
  const rx = new RegExp('package\\s+' + targetPackage + '\\s*\\{', 'g');
  const match = rx.exec(source);
  if (!match) return insertBeforeAnnotations(source, declaration);
  let depth = 1;
  for (let i = match.index + match[0].length; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}') {
      depth--;
      if (depth === 0) {
        let prefix = source.substring(0, i);
        if (!prefix.endsWith('\n')) prefix += '\n';
        return prefix + '  ' + declaration + '\n' + source.substring(i);
      }
    }
  }
  return insertBeforeAnnotations(source, declaration);
}

function findDiagramBlock(source: string): { start: number; openBrace: number; closeBrace: number } | null {
  const headerRx = /(^|\n)[ \t]*diagram\s+\S+\s*:\s*\S+\s*\{/m;
  const match = headerRx.exec(source);
  if (!match) return null;

  const start = (match.index ?? 0) + (match[1]?.length ?? 0);
  const openBrace = source.indexOf('{', start);
  if (openBrace < 0) return null;

  let depth = 1;
  for (let i = openBrace + 1; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}') {
      depth--;
      if (depth === 0) return { start, openBrace, closeBrace: i };
    }
  }
  return null;
}

function insertBeforeAnnotations(source: string, insertion: string): string {
  const block = findDiagramBlock(source);
  if (!block) return source;

  const header = source.slice(block.start, block.openBrace + 1);
  const body = source.slice(block.openBrace + 1, block.closeBrace);
  const suffix = source.slice(block.closeBrace);
  const lines = body.split('\n');
  const entityDeclRx = new RegExp(`^\\s*(?:abstract\\s+|static\\s+|final\\s+)*${ENTITY_KINDS_RX}\\s+`, 'm');
  const packageRx = /^\s*package\s+/;
  const relRx = /^\s*[A-Za-z_]\w*\s+(--\|>|\.\.\|>|<\|--|<\|\.\.|<\.\.|o--|\*--|-->|->|\.\.>|--o|--\*|--x|--)\s+[A-Za-z_]\w*/;
  const annoRx = /^\s*@[A-Za-z_]\w*\s+at\s*\(/;

  let lastDeclEnd = -1;
  let firstRel = -1;
  let firstAnno = -1;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      i++;
      continue;
    }

    if (firstRel === -1 && relRx.test(line)) firstRel = i;
    if (firstAnno === -1 && annoRx.test(line)) firstAnno = i;

    if (entityDeclRx.test(line) || packageRx.test(line)) {
      let end = i + 1;
      if (trimmed.includes('{') && !trimmed.includes('}')) {
        let braceCount = (trimmed.match(/\{/g) || []).length - (trimmed.match(/\}/g) || []).length;
        end = i + 1;
        while (end < lines.length && braceCount > 0) {
          const inner = lines[end].trim();
          braceCount += (inner.match(/\{/g) || []).length - (inner.match(/\}/g) || []).length;
          end++;
        }
      }
      lastDeclEnd = end;
      i = end;
      continue;
    }

    i++;
  }

  const insertAt = lastDeclEnd >= 0
    ? lastDeclEnd
    : (firstRel >= 0 ? firstRel : (firstAnno >= 0 ? firstAnno : lines.length));

  const nextLines = [...lines.slice(0, insertAt), insertion, ...lines.slice(insertAt)];
  return source.slice(0, block.start) + header + nextLines.join('\n') + suffix;
}

function insertRelation(source: string, insertion: string): string {
  const block = findDiagramBlock(source);
  if (!block) return source;

  const header = source.slice(block.start, block.openBrace + 1);
  const body = source.slice(block.openBrace + 1, block.closeBrace);
  const suffix = source.slice(block.closeBrace);
  const lines = body.split('\n');
  const relRx = /^\s*[A-Za-z_]\w*\s+(--\|>|\.\.\|>|<\|--|<\|\.\.|<\.\.|o--|\*--|-->|->|\.\.>|--o|--\*|--x|--)\s+[A-Za-z_]\w*/;
  const annoRx = /^\s*@[A-Za-z_]\w*\s+at\s*\(/;

  let lastRel = -1;
  let firstAnno = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (firstAnno === -1 && annoRx.test(line)) firstAnno = i;
    if (relRx.test(line)) lastRel = i;
  }

  const insertAt = lastRel >= 0 ? lastRel + 1 : (firstAnno >= 0 ? firstAnno : lines.length);
  const nextLines = [...lines.slice(0, insertAt), insertion, ...lines.slice(insertAt)];
  return source.slice(0, block.start) + header + nextLines.join('\n') + suffix;
}

function insertAtEnd(source: string, insertion: string): string {
  const lastBrace = source.lastIndexOf('}');
  if (lastBrace < 0) return source;
  let prefix = source.slice(0, lastBrace);
  if (!prefix.endsWith('\n')) prefix += '\n';
  return prefix + insertion + '\n' + source.slice(lastBrace);
}

/**
 * Canvas-operation formatter:
 * keep one blank line between header, relations, and footer annotations.
 * This intentionally runs only on canvas-triggered rewrites, not manual typing.
 */
function formatDiagramSource(source: string): string {
  const s = source.replace(/\t/g, '  ');
  const block = findDiagramBlock(s);
  if (!block) return s;
  const header = s.slice(block.start, block.openBrace + 1);
  const body = s.slice(block.openBrace + 1, block.closeBrace);
  const suffix = s.slice(block.closeBrace);

  const headerLines: string[] = [];
  const relationLines: string[] = [];
  const annotationLines: string[] = [];

  const entityDeclRx = new RegExp(`^\\s*(?:abstract\\s+|static\\s+|final\\s+)*${ENTITY_KINDS_RX}\\s+`, 'm');
  const relRx = /^\s*[A-Za-z_]\w*\s+(--\|>|\.\.\|>|<\|--|<\|\.\.|<\.\.|o--|\*--|-->|->|\.\.>|--o|--\*|--x|--)\s+[A-Za-z_]\w*/;
  const annoRx = /^\s*@[A-Za-z_]\w*\s+at\s*\(/;
  const packageRx = /^\s*package\s+/;
  const closeBraceRx = /^\s*\}\s*$/;

  const lines = body.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) { i++; continue; }

    if (annoRx.test(line)) {
      annotationLines.push('  ' + trimmed);
      i++;
    } else if (relRx.test(line)) {
      relationLines.push('  ' + trimmed);
      i++;
    } else if (entityDeclRx.test(line) || packageRx.test(line)) {
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
      headerLines.push(block);
    } else if (closeBraceRx.test(line)) {
      i++;
    } else {
      headerLines.push('  ' + trimmed);
      i++;
    }
  }

  const sections: string[][] = [];
  if (headerLines.length > 0) sections.push(headerLines);
  if (relationLines.length > 0) sections.push(relationLines);
  if (annotationLines.length > 0) sections.push(annotationLines);

  const newBody = sections.map(sec => sec.join('\n')).join('\n\n');

  return s.slice(0, block.start) + header + '\n\n' + newBody + '\n\n' + suffix;
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
        { label: 'Package', keyword: 'package' },
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

function updateEntityPosition(source: string, name: string, x: number, y: number, w?: number, h?: number): string {
  const hasSize = Number.isFinite(w) && Number.isFinite(h);
  const newAnnotation = hasSize
    ? `@${name} at (${x}, ${y}, ${Math.round(w!)}, ${Math.round(h!)})`
    : `@${name} at (${x}, ${y})`;
  const pattern = new RegExp(`@${escapeRegex(name)}\\s+at\\s*\\([^)]+\\)`);
  if (pattern.test(source)) {
    return source.replace(pattern, newAnnotation);
  }
  const lastBrace = source.lastIndexOf('}');
  return lastBrace < 0 ? source : source.slice(0, lastBrace) + `  ${newAnnotation}\n` + source.slice(lastBrace);
}

function updateRelationVerticalPosition(source: string, relationId: string, y: number): string {
  const idxRaw = relationId.replace('rel_', '');
  const relationIdx = Number.parseInt(idxRaw, 10);
  if (!Number.isInteger(relationIdx) || relationIdx < 0) return source;

  const relRegex = /^(\s*)([A-Za-z_][\w]*)\s+(--\|>|\.\.\|>|<\|--|<\|\.\.|<\.\.|o--|\*--|-->|->|\.\.>|--o|--\*|--x|--)\s+([A-Za-z_][\w]*)(\s*\[[^\]]*\])?\s*$/gm;
  const matches = [...source.matchAll(relRegex)];
  const match = matches[relationIdx];
  if (!match || match.index == null) return source;

  const [full, indent, fromRaw, opRaw, toRaw, attrsRaw = ''] = match;
  const yValue = String(Math.max(0, Math.round(y)));
  let suffix = attrsRaw || '';

  if (!suffix.trim()) {
    suffix = ` [y="${yValue}"]`;
  } else if (/\by\s*=\s*"(?:\\"|[^"])*"/.test(suffix)) {
    suffix = suffix.replace(/(\by\s*=\s*")((?:\\"|[^"])*)"/, `$1${yValue}"`);
  } else {
    suffix = suffix.replace(/\]\s*$/, `, y="${yValue}"]`);
  }

  const replacement = `${indent}${fromRaw} ${opRaw} ${toRaw}${suffix}`;

  return source.slice(0, match.index) + replacement + source.slice(match.index + full.length);
}

function updateRelationVerticalPositions(source: string, relationYs: Record<string, number>): string {
  let next = source;
  for (const [relationId, y] of Object.entries(relationYs)) {
    next = updateRelationVerticalPosition(next, relationId, y);
  }
  return next;
}

function parseRelationAttrs(attrs: string): Map<string, string> {
  const attrMap = new Map<string, string>();
  const attrRx = /([A-Za-z_][\w]*)\s*=\s*"((?:\\"|[^"])*)"/g;
  let match: RegExpExecArray | null = attrRx.exec(attrs);
  while (match) {
    attrMap.set(match[1], match[2].replace(/\\"/g, '"'));
    match = attrRx.exec(attrs);
  }
  return attrMap;
}

function hasEntityDeclaration(source: string, entityName: string): boolean {
  const declRx = new RegExp(`^[ \\t]*(?:abstract[ \\t]+|static[ \\t]+|final[ \\t]+)*${ENTITY_KINDS_RX}[ \\t]+${escapeRegex(entityName)}\\b`, 'm');
  return declRx.test(source);
}

function getEntityDeclarationKind(source: string, entityName: string): string | null {
  const declRx = new RegExp(`^[ \\t]*(?:abstract[ \\t]+|static[ \\t]+|final[ \\t]+)*(${ENTITY_KINDS_RX})[ \\t]+${escapeRegex(entityName)}\\b`, 'm');
  const match = source.match(declRx);
  return match?.[1] ?? null;
}

function nextAvailableName(source: string, baseName: string): string {
  let idx = 1;
  let candidate = baseName;
  while (hasEntityDeclaration(source, candidate)) {
    candidate = `${baseName}${idx}`;
    idx++;
  }
  return candidate;
}

function ensureUseCaseBoundaryDeclaration(source: string, preferredName: string): { source: string; name: string } {
  const raw = preferredName.trim();
  const safePreferred = /^[A-Za-z_]\w*$/.test(raw) ? raw : 'System';
  const existingKind = getEntityDeclarationKind(source, safePreferred);
  if (existingKind === 'system' || existingKind === 'boundary') return { source, name: safePreferred };
  const name = hasEntityDeclaration(source, safePreferred)
    ? nextAvailableName(source, `${safePreferred}Boundary`)
    : safePreferred;
  return { source: insertBeforeAnnotations(source, `  system ${name}`), name };
}

function removeLayoutAnnotation(source: string, entityName: string): string {
  const annoRx = new RegExp(`^[ \\t]*@${escapeRegex(entityName)}[ \\t]+at[ \\t]*\\([^)]+\\)[ \\t]*\\n?`, 'gm');
  return source.replace(annoRx, '');
}

const ENTITY_KINDS_RX = '(?:package|class|interface|enum|actor|usecase|component|node|participant|partition|decision|merge|fork|join|start|stop|action|state|composite|concurrent|choice|history|device|artifact|environment|boundary|system|multiobject|active_object|collaboration|composite_object)';

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
      return { start: match.index, end: lineEndIndex, bodyStart: -1, bodyEnd: -1 };
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
  updates: { name?: string; stereotype?: string; isAbstract?: boolean; kind?: string },
): string {
  const entityLine = new RegExp(`(^[ \\t]*(?:abstract[ \\t]+|static[ \\t]+|final[ \\t]+)*${ENTITY_KINDS_RX}[ \\t]+)${escapeRegex(entityName)}(\\b[^\\n]*)`, 'm');
  let next = source;

  next = next.replace(entityLine, (_match, prefix: string, rest: string) => {
    let newPrefix = prefix;
    const isPartition = updates.kind === 'partition';
    const isBoundaryKind = updates.kind === 'system' || updates.kind === 'boundary';
    if (updates.isAbstract !== undefined) {
      if (updates.isAbstract && !/abstract\s+/.test(newPrefix)) {
        newPrefix = newPrefix.replace(/^(\s*)/, '$1abstract ');
      } else if (!updates.isAbstract) {
        newPrefix = newPrefix.replace(/abstract\s+/, '');
      }
    }
    if (isPartition) {
      const indent = newPrefix.match(/^\s*/)?.[0] ?? '';
      newPrefix = `${indent}partition `;
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
    if (isPartition) {
      nextRest = nextRest.replace(/\s*<<[^>]+>>/g, '').replace(/\s*\{\s*$/, '');
    }
    if (isBoundaryKind) {
      nextRest = nextRest.replace(/\s*<<[^>]+>>/g, '').replace(/\s*\{\s*$/, '');
    }
    return `${newPrefix}${updates.name || entityName}${nextRest}`;
  });

  if (updates.name && updates.name !== entityName) {
    const identPattern = new RegExp(`\\b${escapeRegex(entityName)}\\b`, 'g');
    next = next.replace(identPattern, updates.name);
  }

  return next;
}

function normalizePartitionDeclaration(source: string, partitionName: string): string {
  const bounds = findEntityBounds(source, partitionName);
  if (!bounds) return source;

  const declNoBody = source.slice(bounds.start, bounds.bodyStart === -1 ? bounds.end : bounds.bodyStart - 1);
  const indent = declNoBody.match(/^\s*/)?.[0] ?? '';
  const nameMatch = declNoBody.match(/\bpartition\s+([A-Za-z_][\w]*)\b/);
  if (!nameMatch) return source;

  const normalized = `${indent}partition ${nameMatch[1]}\n`;
  return source.slice(0, bounds.start) + normalized + source.slice(bounds.end);
}

function normalizeBoundaryDeclaration(source: string, boundaryName: string, boundaryKind: 'system' | 'boundary'): string {
  const bounds = findEntityBounds(source, boundaryName);
  if (!bounds) return source;

  const declNoBody = source.slice(bounds.start, bounds.bodyStart === -1 ? bounds.end : bounds.bodyStart - 1);
  const indent = declNoBody.match(/^\s*/)?.[0] ?? '';
  const nameMatch = declNoBody.match(/\b(?:system|boundary)\s+([A-Za-z_][\w]*)\b/);
  if (!nameMatch) return source;

  const normalized = `${indent}${boundaryKind} ${nameMatch[1]}\n`;
  return source.slice(0, bounds.start) + normalized + source.slice(bounds.end);
}

function updateRelationById(
  source: string,
  relationId: string,
  updates: { label?: string; kind?: string; direction?: 'forward' | 'reverse'; fromMult?: string; toMult?: string },
): string {
  const idxRaw = relationId.replace('rel_', '');
  const relationIdx = Number.parseInt(idxRaw, 10);
  if (!Number.isInteger(relationIdx) || relationIdx < 0) return source;

  const relRegex = /^(\s*)([A-Za-z_][\w]*)\s+(--\(\)|--\(|--\|>|\.\.\|>|<\|--|<\|\.\.|<\.\.|o--|\*--|-->|->|\.\.>|--o|--\*|--x|--)\s+([A-Za-z_][\w]*)(\s*\[[^\]]*\])?\s*$/gm;
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
  const attrMap = parseRelationAttrs(attrs);

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
  const [language, setLanguage] = useState<Language>(() => getStoredLanguage());
  const [tabs, setTabs] = useState<WorkspaceTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');
  const [newDiagramKind, setNewDiagramKind] = useState<DiagramKind>('class');
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [tabToClose, setTabToClose] = useState<string | null>(null);
  const [examplesOpen, setExamplesOpen]     = useState(false);
  const [shortcutsOpen, setShortcutsOpen]   = useState(false);
  const [isUMLCompliant, setIsUMLCompliant] = useState(true);
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>(() => {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  });
  const [isMobileLayout, setIsMobileLayout] = useState(false);
  const [mobilePane, setMobilePane] = useState<'code' | 'diagram'>('code');
  const [editingEntity, setEditingEntity]   = useState<(IOMEntity & { bodyText?: string; origName?: string }) | null>(null);
  const [editingText, setEditingText] = useState<{ oldName: string, newName: string, type: 'diagram' | 'package' } | null>(null);
  const [editingRelation, setEditingRelation] = useState<{ relationId: string, label: string, kind: string, direction: 'forward' | 'reverse', fromMult?: string, toMult?: string } | null>(null);
  const [errorsCopied, setErrorsCopied] = useState(false);
  const [renamingTabId, setRenamingTabId]   = useState<string | null>(null);
  const [pendingMobileDropKeyword, setPendingMobileDropKeyword] = useState<string | null>(null);
  const examplesRef                         = useRef<HTMLDivElement>(null);
  const fileInputRef                        = useRef<HTMLInputElement>(null);

  const [selectedItems, setSelectedItems] = useState<{ type: 'entity' | 'relation', id: string }[]>([]);
  const t = useCallback((key: string, vars?: Record<string, string | number>) => tText(language, key, vars), [language]);

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
    function handleOutsideInteraction(e: Event) {
      if (examplesRef.current && !examplesRef.current.contains(e.target as Node)) {
        setExamplesOpen(false);
      }
    }
    if (examplesOpen) {
      document.addEventListener('click', handleOutsideInteraction);
    }
    return () => {
      document.removeEventListener('click', handleOutsideInteraction);
    };
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
    const media = window.matchMedia('(max-width: 900px)');
    const apply = (matches: boolean) => {
      setIsMobileLayout(matches);
    };
    apply(media.matches);
    const listener = (event: MediaQueryListEvent) => apply(event.matches);
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    }
    media.addListener(listener);
    return () => media.removeListener(listener);
  }, []);

  useEffect(() => {
    setStoredLanguage(language);
    document.documentElement.setAttribute('lang', language);
  }, [language]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== 'isomorph-language') return;
      const next = event.newValue;
      if (next === 'en' || next === 'ro' || next === 'ru') {
        setLanguage(next);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (!activeTab) return;
    if (safeDiagramIdx !== activeDiagramIdx) {
      updateActiveTab(tab => ({ ...tab, activeDiagramIdx: safeDiagramIdx }));
    }
  }, [activeTab, safeDiagramIdx, activeDiagramIdx, updateActiveTab]);

  const getPlacedItemPosition = useCallback((name: string) => {
    const partitionPos = activeDiagram?.partitions.find(p => p.name === name)?.position;
    if (partitionPos) return partitionPos;
    return activeDiagram?.entities.get(name)?.position;
  }, [activeDiagram]);

  // ── Bidirectional: drag entity → update @Entity at ───────
  const handleEntityMove = useCallback((name: string, x: number, y: number, dragDx?: number, dragDy?: number, seedPositions?: Record<string, { x: number; y: number; w?: number; h?: number }>) => {
    updateActiveTab(tab => {
      let src = tab.source;

      if (seedPositions) {
        for (const [entityName, pos] of Object.entries(seedPositions)) {
          const current = getPlacedItemPosition(entityName);
          if (!current) continue;
          src = updateEntityPosition(
            src,
            entityName,
            Math.round(pos.x),
            Math.round(pos.y),
            Number.isFinite(pos.w) ? Math.round(pos.w as number) : current?.w,
            Number.isFinite(pos.h) ? Math.round(pos.h as number) : current?.h,
          );
        }
      }

      if (activeDiagram) {
        const pkg = activeDiagram.packages.find(p => p.name === name);
        if (pkg) {
          const dx = dragDx ?? 0;
          const dy = dragDy ?? 0;

          // Compute final package position from IOM annotation + cursor delta
          const oldPkgX = pkg.position?.x ?? 100;
          const oldPkgY = pkg.position?.y ?? 100;
          const newPkgX = Math.round(oldPkgX + dx);
          const newPkgY = Math.round(oldPkgY + dy);
          const pkgW = pkg.position?.w;
          const pkgH = pkg.position?.h;
          src = updateEntityPosition(src, name, newPkgX, newPkgY, pkgW, pkgH);

          // Shift all nested entities by the same cursor delta
          if (dx !== 0 || dy !== 0) {
            for (const eName of pkg.entityNames) {
              const ent = activeDiagram.entities.get(eName);
              if (ent && ent.position) {
                src = updateEntityPosition(src, eName, Math.round(ent.position.x + dx), Math.round(ent.position.y + dy), ent.position.w, ent.position.h);
              }
            }
          }
          return { ...tab, source: formatDiagramSource(src) };
        }
      }
      let targetName = name;
      if (activeDiagram?.kind === 'usecase' && !activeDiagram.entities.has(name)) {
        const promoted = ensureUseCaseBoundaryDeclaration(src, name);
        src = removeLayoutAnnotation(promoted.source, name);
        targetName = promoted.name;
      }

      const moved = seedPositions?.[name];
      const movedW = Number.isFinite(moved?.w) ? Math.round(moved!.w as number) : getPlacedItemPosition(name)?.w;
      const movedH = Number.isFinite(moved?.h) ? Math.round(moved!.h as number) : getPlacedItemPosition(name)?.h;

      return {
        ...tab,
        source: formatDiagramSource(updateEntityPosition(src, targetName, x, y, movedW, movedH)),
      };
    });
  }, [updateActiveTab, activeDiagram, getPlacedItemPosition]);

  const handleEntityResize = useCallback((name: string, w: number, h: number, x?: number, y?: number) => {
    updateActiveTab(tab => {
      let src = tab.source;
      let targetName = name;

      if (activeDiagram?.kind === 'usecase' && !activeDiagram.entities.has(name)) {
        const promoted = ensureUseCaseBoundaryDeclaration(src, name);
        src = removeLayoutAnnotation(promoted.source, name);
        targetName = promoted.name;
      }

      const current = getPlacedItemPosition(name);
      const resizeX = Number.isFinite(x) ? Math.round(x as number) : Math.round(current?.x ?? 40);
      const resizeY = Number.isFinite(y) ? Math.round(y as number) : Math.round(current?.y ?? 40);
      return {
        ...tab,
        source: formatDiagramSource(updateEntityPosition(src, targetName, resizeX, resizeY, Math.round(w), Math.round(h))),
      };
    });
  }, [updateActiveTab, getPlacedItemPosition, activeDiagram]);

  const handleRelationVerticalMove = useCallback((relationId: string, y: number, seedRelationYs?: Record<string, number>) => {
    updateActiveTab(tab => {
      let src = tab.source;
      if (seedRelationYs && Object.keys(seedRelationYs).length > 0) {
        src = updateRelationVerticalPositions(src, seedRelationYs);
      }
      src = updateRelationVerticalPosition(src, relationId, y);
      return { ...tab, source: formatDiagramSource(src) };
    });
  }, [updateActiveTab]);

  const handleCopyErrors = useCallback(async () => {
    if (allErrors.length === 0) return;
    const text = allErrors.join('\n');
    let copied = false;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        copied = true;
      }
    } catch {
      copied = false;
    }

    if (!copied) {
      try {
        const area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', 'true');
        area.style.position = 'fixed';
        area.style.left = '-9999px';
        document.body.appendChild(area);
        area.select();
        copied = document.execCommand('copy');
        document.body.removeChild(area);
      } catch {
        copied = false;
      }
    }

    if (copied) {
      setErrorsCopied(true);
      window.setTimeout(() => setErrorsCopied(false), 1400);
    }
  }, [allErrors]);

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

  const handleTextRenameRequest = useCallback((oldName: string, _newName: string, type: 'diagram' | 'package') => { setEditingText({ oldName, newName: oldName, type }); }, []);
  const handleRelationAddRequest = useCallback((fromEntity: string, toEntity: string) => {
    updateActiveTab(tab => {
      let newSource = insertRelation(tab.source, `  ${fromEntity} --> ${toEntity}`);
      newSource = formatDiagramSource(newSource);
      return { ...tab, source: newSource };
    });
  }, [updateActiveTab]);

  const handleEntityEdit = useCallback((entityName: string, updates: { name?: string; stereotype?: string; isAbstract?: boolean; bodyText?: string; kind?: string }) => {
    updateActiveTab(tab => {
      let sourceIn = tab.source;
      const nextName = updates.name || entityName;
      if ((updates.kind === 'system' || updates.kind === 'boundary') && !hasEntityDeclaration(sourceIn, entityName)) {
        const promoted = ensureUseCaseBoundaryDeclaration(sourceIn, nextName);
        sourceIn = removeLayoutAnnotation(promoted.source, entityName);
      }

      let source = updateEntityDeclaration(sourceIn, entityName, updates);
      if (updates.kind === 'partition') {
        source = normalizePartitionDeclaration(source, updates.name || entityName);
      } else if (updates.kind === 'system' || updates.kind === 'boundary') {
        source = normalizeBoundaryDeclaration(source, updates.name || entityName, updates.kind);
      } else if (updates.bodyText !== undefined) {
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

  const handleDropEntity = useCallback((keyword: string, x: number, y: number, targetPackage?: string) => {
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

        if (targetPackage) { src = insertIntoPackage(src, targetPackage, declaration); } else { src = insertBeforeAnnotations(src, declaration); }
      src = insertAtEnd(src, `  @${name} at (${Math.round(x)}, ${Math.round(y)})`);
      src = formatDiagramSource(src);
      return { ...tab, source: src };
    });
  }, [updateActiveTab]);

  const handleStencilInsert = useCallback((keyword: string) => {
    if (isMobileLayout) {
      setPendingMobileDropKeyword(keyword);
      setMobilePane('diagram');
      return;
    }
    const entityCount = activeDiagram?.entities.size ?? 0;
    const x = 120 + (entityCount % 4) * 110;
    const y = 110 + Math.floor(entityCount / 4) * 90;
    handleDropEntity(keyword, x, y);
    setMobilePane('diagram');
  }, [activeDiagram, handleDropEntity, isMobileLayout]);

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
                const rxRel = new RegExp(`^[ \\t]*(?:${escapeRegex(item.id)}[ \\t]+(?:--\\|>|\\.\\.\\|>|<\\|--|<\\|\\.\\.|<\\.\\.|o--|\\*--|-->|->|\\.\\.>|--o|--\\*|--x|--)[ \\t]+[A-Za-z_][\\w]*|[A-Za-z_][\\w]*[ \\t]+(?:--\\|>|\\.\\.\\|>|<\\|--|<\\|\\.\\.|<\\.\\.|o--|\\*--|-->|->|\\.\\.>|--o|--\\*|--x|--)[ \\t]+${escapeRegex(item.id)})(?:[ \\t]*\\[[^\\]]*\\])?[ \\t]*\\n?`, 'gm');
                nextSource = nextSource.replace(rxRel, '');
              } else if (item.type === 'relation') {
                const idxRaw = item.id.replace('rel_', '');
                const relationIdx = Number.parseInt(idxRaw, 10);
                if (Number.isInteger(relationIdx) && relationIdx >= 0) {
                  const relRegex = /^([ \t]*)([A-Za-z_][\w]*)[ \t]+(--\|>|\.\.\|>|<\|--|<\|\.\.|<\.\.|o--|\*--|-->|->|\.\.>|--o|--\*|--x|--)[ \t]+([A-Za-z_][\w]*)([ \t]*\[[^\]]*\])?[ \t]*$/gm;
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
              if (!activeDiagram.entities.has(item.id) && !activeDiagram.packages.find(p => p.name === item.id)) continue;
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
            pasteText = pasteText.replace(/@(\w+)\s+at\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)(\s*,\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?)?\s*\)/g, (_, n, x, y, sizeSuffix) => {
              return `@${n} at (${Math.round(parseFloat(x) + 30)}, ${Math.round(parseFloat(y) + 30)}${sizeSuffix || ''})`;
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
                if (!activeDiagram.entities.has(item.id) && !activeDiagram.packages.find(p => p.name === item.id)) continue;
                
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
                const rxRel = new RegExp(`^[ \\t]*(?:${escapeRegex(item.id)}[ \\t]+(?:--\\|>|\\.\\.\\|>|<\\|--|<\\|\\.\\.|<\\.\\.|o--|\\*--|-->|->|\\.\\.>|--o|--\\*|--x|--)[ \\t]+[A-Za-z_][\\w]*|[A-Za-z_][\\w]*[ \\t]+(?:--\\|>|\\.\\.\\|>|<\\|--|<\\|\\.\\.|<\\.\\.|o--|\\*--|-->|->|\\.\\.>|--o|--\\*|--x|--)[ \\t]+${escapeRegex(item.id)})(?:[ \\t]*\\[[^\\]]*\\])?[ \\t]*\\n?`, 'gm');
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
  const executeNewDiagram = useCallback((kind: DiagramKind) => {
    const id = `tab-${slugId()}`;
    setTabs(prev => [
      ...prev,
      {
        id,
        name: `untitled-${prev.length + 1}.isx`,
        source: templateFor(kind),
        activeDiagramIdx: 0,
        diagramKindFilter: 'all',
      },
    ]);
    setActiveTabId(id);
    setIsNewModalOpen(false);
  }, []);

  const handleNew = useCallback(() => {
    setIsNewModalOpen(true);
  }, []);

  const handleTransformToCollaboration = useCallback(() => {
    if (!activeDiagram || activeDiagram.kind !== 'sequence') return;
    const id = `tab-${slugId()}`;
    const baseName = activeTab?.name?.replace(/\.(isx|iso|txt)$/i, '') || activeDiagram.name || 'diagram';
    const nextName = `${baseName}-collaboration.isx`;
    const transformedSource = sequenceToCollaborationSource(activeDiagram);

    setTabs(prev => [
      ...prev,
      {
        id,
        name: nextName,
        source: transformedSource,
        activeDiagramIdx: 0,
        diagramKindFilter: 'collaboration',
      },
    ]);
    setActiveTabId(id);
  }, [activeDiagram, activeTab?.name]);

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
      if (e.key === 'Escape') {
        if (editingEntity) { setEditingEntity(null); return; }
        if (editingRelation) { setEditingRelation(null); return; }
        if (editingText) { setEditingText(null); return; }
        if (isNewModalOpen) { setIsNewModalOpen(false); return; }
        if (tabToClose) { setTabToClose(null); return; }
        if (shortcutsOpen) { setShortcutsOpen(false); return; }
      }
      if (e.ctrlKey && !e.shiftKey && e.key === 'n') { e.preventDefault(); handleNew(); }
      if (e.ctrlKey && !e.shiftKey && e.key === 'o') { e.preventDefault(); fileInputRef.current?.click(); }
      if (e.ctrlKey && !e.shiftKey && e.key === 'e') { e.preventDefault(); handleExportSVG(); }
      if (e.ctrlKey && e.shiftKey && e.key === 'E') { e.preventDefault(); handleExportPNG(); }
      if (e.ctrlKey && e.key === '/') { e.preventDefault(); setShortcutsOpen(o => !o); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleNew, handleExportSVG, handleExportPNG, shortcutsOpen, editingEntity, editingRelation, editingText, isNewModalOpen, tabToClose]);

  useEffect(() => {
    const handleModalEnter = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      const target = e.target as HTMLElement | null;
      if (target?.tagName === 'TEXTAREA') return;

      if (editingEntity) {
        e.preventDefault();
        const isNameOnlyBoundary = editingEntity.kind === 'partition' || editingEntity.kind === 'system' || editingEntity.kind === 'boundary';
        handleEntityEdit(editingEntity.origName || editingEntity.id, {
          name: editingEntity.name,
          stereotype: isNameOnlyBoundary ? undefined : editingEntity.stereotype,
          isAbstract: editingEntity.isAbstract,
          bodyText: editingEntity.bodyText,
          kind: editingEntity.kind,
        });
        return;
      }

      if (editingRelation) {
        e.preventDefault();
        handleRelationEdit(editingRelation.relationId, {
          label: editingRelation.label,
          kind: editingRelation.kind,
          direction: editingRelation.direction,
          fromMult: editingRelation.fromMult,
          toMult: editingRelation.toMult,
        });
        return;
      }

      if (isNewModalOpen) {
        e.preventDefault();
        executeNewDiagram(newDiagramKind);
        return;
      }

      if (tabToClose) {
        e.preventDefault();
        setTabs(prev => {
          const next = prev.filter(t => t.id !== tabToClose);
          if (activeTabId === tabToClose) setActiveTabId(next[Math.max(0, next.length - 1)]?.id ?? '');
          return next;
        });
        setTabToClose(null);
      }
    };

    window.addEventListener('keydown', handleModalEnter);
    return () => window.removeEventListener('keydown', handleModalEnter);
  }, [
    editingEntity,
    editingRelation,
    isNewModalOpen,
    tabToClose,
    newDiagramKind,
    handleEntityEdit,
    handleRelationEdit,
    executeNewDiagram,
    activeTabId,
  ]);

  const statusClass = allErrors.length > 0
    ? 'iso-status iso-status--err'
    : diagrams.length > 0
      ? 'iso-status iso-status--ok'
      : 'iso-status iso-status--idle';
  const statusLabel = allErrors.length > 0
    ? allErrors.length > 1
      ? t('status.error_many', { count: allErrors.length })
      : t('status.error_one', { count: allErrors.length })
    : diagrams.length > 0
      ? t('status.valid')
      : t('status.ready');
  const statusAriaLabel = allErrors.length > 0
    ? allErrors.length > 1
      ? t('status.error_many', { count: allErrors.length })
      : t('status.error_one', { count: allErrors.length })
    : t('status.diagram_valid');

  const shapesPane = activeDiagram?.kind && getStencilsForKind(activeDiagram.kind).length > 0 ? (
    <div className="iso-sidebar">
      <div className="iso-panel-header" style={{ borderBottom: '1px solid var(--iso-divider)', padding: '0 12px' }}>
        <IconDiagram size={11} /> {t('ui.shapes')}
      </div>
      <div className="iso-sidebar-body">
        {getStencilsForKind(activeDiagram.kind).map(stencil => (
          <div
            key={stencil.label}
            draggable
            onDragStart={e => {
              e.dataTransfer.setData('text/plain', stencil.keyword);
              e.dataTransfer.effectAllowed = 'copy';
            }}
            className="iso-stencil"
          >
            {stencil.label}
          </div>
        ))}
      </div>
    </div>
  ) : null;

  const sourcePane = (
    <div className="iso-panel" style={{ height: '100%' }}>
      <div className="iso-panel-header">
        <IconCode size={11} />
        {t('ui.source')}
        <span className="iso-panel-info" aria-live="polite">
          {parseErrors.length > 0
            ? parseErrors.length > 1
              ? ` - ${t('status.parse_error_many', { count: parseErrors.length })}`
              : ` - ${t('status.parse_error_one', { count: parseErrors.length })}`
            : source.trim() ? ` - ${t('ui.ok')}` : ''}
        </span>
        <span className="iso-panel-spacer" />
        <span style={{ fontSize: 10, color: 'var(--iso-text-faint)', fontFamily: 'monospace' }}>
          {t('status.lines', { count: source.split('\n').length })}
        </span>
      </div>
      <div className="iso-panel-body">
        <IsomorphEditor
          value={source}
          onChange={value => updateActiveTab(tab => ({ ...tab, source: value }))}
          errors={editorDiagnostics}
        />
      </div>
      {allErrors.length > 0 && (
        <div className="iso-error-panel" role="log" aria-label={t('ui.errors')}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
            <strong style={{ fontSize: '0.78rem', color: 'var(--iso-text-muted)' }}>{t('ui.errors')}</strong>
            <button
              type="button"
              className="iso-btn"
              onClick={handleCopyErrors}
              style={{ padding: '2px 8px', fontSize: '0.72rem' }}
            >
              {errorsCopied ? t('ui.copied') : t('ui.copy_errors')}
            </button>
          </div>
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
                {allErrors.length - 8 > 1
                  ? t('status.more_error_many', { count: allErrors.length - 8 })
                  : t('status.more_error_one', { count: allErrors.length - 8 })}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const canvasPane = (
    <div className="iso-panel iso-panel--canvas" style={{ height: '100%' }}>
      <div className="iso-panel-header">
        <IconDiagram size={11} />
        {t('ui.canvas')}
        <span className="iso-panel-info" aria-live="polite">
          {activeDiagram
            ? ` - ${activeDiagram.name} · ${t('status.entities', { count: activeDiagram.entities.size })} · ${t('status.relations', { count: activeDiagram.relations.length })}`
            : ''}
        </span>
        <span className="iso-panel-spacer" />
        {diagrams.length > 0 && (
          <span style={{ fontSize: 10, color: '#6e7781', fontFamily: 'monospace' }}>
            {t('ui.drag_reposition')}
          </span>
        )}
      </div>
      <div className="iso-panel-body">
        <DiagramView
          diagram={activeDiagram}
          language={language}
          onEntityMove={handleEntityMove}
          onEntityResize={handleEntityResize}
          onRelationVerticalMove={handleRelationVerticalMove}
          onEntityEditRequest={handleEntityEditRequest}
          onRelationEditRequest={handleRelationEditRequest}
          onRelationAddRequest={handleRelationAddRequest}
          onTextRenameRequest={handleTextRenameRequest}
          onExportSVG={handleExportSVG}
          onDropEntity={handleDropEntity}
          pendingDropKeyword={isMobileLayout ? pendingMobileDropKeyword : null}
          onConsumePendingDrop={() => setPendingMobileDropKeyword(null)}
          availableTools={toolsetFor(activeDiagram?.kind)}
          selectedItems={selectedItems}
          onSelectionChange={setSelectedItems}
        />
      </div>
    </div>
  );

  const mobileStencilRail = activeDiagram?.kind && getStencilsForKind(activeDiagram.kind).length > 0 ? (
    <div className="iso-mobile-stencil-rail" role="toolbar" aria-label={t('ui.insert_shapes')}>
      {getStencilsForKind(activeDiagram.kind).map(stencil => (
        <button
          key={stencil.label}
          type="button"
          className="iso-mobile-stencil"
          onClick={() => handleStencilInsert(stencil.keyword)}
        >
          {stencil.label}
        </button>
      ))}
    </div>
  ) : null;

  const mobileCanvasPane = (
    <div className="iso-mobile-canvas-pane">
      {mobileStencilRail}
      {canvasPane}
    </div>
  );

  const applyExample = useCallback((ex: (typeof EXAMPLES)[number]) => {
    updateActiveTab(tab => ({
      ...tab,
      source: ex.source,
      activeDiagramIdx: 0,
      diagramKindFilter: ex.kind as DiagramKind,
    }));
    setExamplesOpen(false);
  }, [updateActiveTab]);

  const examplesDropdown = (
    <div className="iso-dropdown" ref={examplesRef}>
      <button
        type="button"
        className="iso-btn"
        onPointerDown={e => {
          e.preventDefault();
          e.stopPropagation();
          setExamplesOpen(o => !o);
        }}
        aria-haspopup="menu"
        aria-expanded={examplesOpen}
        aria-label={t('ui.load_example')}
      >
        {t('ui.examples')}
        <IconChevron dir={examplesOpen ? 'up' : 'down'} />
      </button>
      {examplesOpen && (
        <div className="iso-dropdown-menu" role="menu" aria-label={t('ui.example_diagrams')}>
          {EXAMPLES.map(ex => (
            <button
              key={ex.label}
              type="button"
              className="iso-dropdown-item"
              role="menuitem"
              onPointerDown={e => {
                e.preventDefault();
                e.stopPropagation();
                applyExample(ex);
              }}
            >
              <span className="iso-dropdown-item-icon" aria-hidden="true">
                ⭕
              </span>
              {ex.label}
              <span className="iso-dropdown-item-meta">{ex.kind}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  if (tabs.length === 0) {
    return (
      <div className="iso-shell">
        <header className="iso-header">
          <button type="button" className="iso-logo" aria-label={t('ui.isomorph_home')}>
            <span className="iso-logo-name">Isomorph</span>
          </button>
        </header>
        <div className="iso-empty-state">
          <h1 className="iso-empty-title">{t('welcome.title')}</h1>
          <p className="iso-empty-copy">{t('welcome.description')}</p>
          <div className="iso-empty-actions">
            <div className="iso-empty-group">
                <select className="iso-modal-select" style={{ marginBottom: 0, padding: '8px 12px' }} value={newDiagramKind} onChange={e => setNewDiagramKind(e.target.value as DiagramKind)}>
                  {DIAGRAM_KINDS.filter(k => k !== 'all').map(k => (
                    <option key={k} value={k}>{t(`diagram_type.${k}`)}</option>
                  ))}
                </select>
                <button className="iso-btn iso-btn--primary" style={{ padding: '8px 16px', justifyContent: 'center' }} onClick={() => executeNewDiagram(newDiagramKind)}>
                  {t('welcome.create_new')}
                </button>
              </div>
            <div className="iso-empty-divider" aria-hidden="true"></div>
            <div className="iso-empty-group iso-empty-group--secondary">
              <button className="iso-btn" style={{ padding: '8px 16px', minHeight: '36px', justifyContent: 'center' }} onClick={() => fileInputRef.current?.click()}>
                {t('welcome.open_existing')}
              </button>
            </div>
          </div>
          <input ref={fileInputRef} type="file" accept=".isx,.iso,.txt" onChange={handleFileOpen} style={{ display: 'none' }} tabIndex={-1} />
        </div>

        {/* ──────────────── MODALS (Empty State) ───────────────── */}
        {isNewModalOpen && (
          <div className="iso-modal-overlay" onClick={() => setIsNewModalOpen(false)}>
            <div className="iso-modal" onClick={e => e.stopPropagation()}>
              <h2 className="iso-modal-title">{t('welcome.create_new')}</h2>
              <p className="iso-modal-desc">{t('Select the type of diagram you\'d like to create.')}</p>
              <select className="iso-modal-select" value={newDiagramKind} onChange={e => setNewDiagramKind(e.target.value as DiagramKind)}>
                {DIAGRAM_KINDS.filter(k => k !== 'all').map(k => (
                  <option key={k} value={k}>{t(`diagram_type.${k}`)}</option>
                ))}
              </select>
              <div className="iso-modal-actions">
                <button className="iso-modal-btn cancel" onClick={() => setIsNewModalOpen(false)}>{t('ui.cancel')}</button>
                <button className="iso-modal-btn confirm" onClick={() => executeNewDiagram(newDiagramKind)}>{t('ui.create')}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="iso-shell">
      {/* ──────────────── HEADER ──────────────────────────── */}
      <header className="iso-header">
        {/* Logo */}
        <button type="button" className="iso-logo" aria-label={t('ui.isomorph_home')} onClick={e => e.preventDefault()}>
          <span className="iso-logo-name">Isomorph</span>
        </button>

        <div className="iso-header-sep iso-mobile-hide" aria-hidden="true" />

        {/* File breadcrumb */}
        <div className="iso-breadcrumb iso-mobile-hide">
          <span className="iso-breadcrumb-name">{fileName}</span>
        </div>

        {isMobileLayout && (
            <div
              className="iso-mobile-title"
              title={fileName}
              onPointerDown={e => {
                e.preventDefault();
                e.stopPropagation();
                setRenamingTabId(activeTab?.id ?? null);
              }}
              onDoubleClick={() => setRenamingTabId(activeTab?.id ?? null)}
              onClick={() => setRenamingTabId(activeTab?.id ?? null)}
            >
              {renamingTabId === activeTab?.id ? (
                <span style={{ display: "flex", alignItems: "center" }}>
                  <input
                    autoFocus
                    defaultValue={fileName.includes(".") ? fileName.substring(0, fileName.lastIndexOf(".")) : fileName}
                    className="iso-tab-rename-input"
                    style={{ background: "transparent", border: "none", color: "inherit", fontFamily: "inherit", fontSize: "inherit", outline: "none", width: "100%", borderBottom: "1px solid currentColor" }}
                    onBlur={(e) => {
                      if (isMobileLayout) return;
                      const ext = fileName.includes(".") ? fileName.substring(fileName.lastIndexOf(".")) : "";
                      const newName = e.target.value ? e.target.value + ext : fileName;
                      if (activeTab) setTabs(prev => prev.map(t => t.id === activeTab.id ? { ...t, name: newName } : t));
                      setRenamingTabId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const ext = fileName.includes(".") ? fileName.substring(fileName.lastIndexOf(".")) : "";
                        const newName = e.currentTarget.value ? e.currentTarget.value + ext : fileName;
                        if (activeTab) setTabs(prev => prev.map(t => t.id === activeTab.id ? { ...t, name: newName } : t));
                        setRenamingTabId(null);
                      }
                      if (e.key === "Escape") setRenamingTabId(null);
                    }}
                    onClick={e => e.stopPropagation()}
                  />
                  <span>{fileName.includes(".") ? fileName.substring(fileName.lastIndexOf(".")) : ""}</span>
                </span>
              ) : (
                fileName
              )}
            </div>
          )}

        <div className="iso-header-sep iso-mobile-hide" aria-hidden="true" />

        {/* Diagram tabs */}
        {diagrams.length > 1 && (
          <nav className="iso-tabs iso-mobile-hide" aria-label={t('ui.diagrams')} style={{ flex: '1 1 auto', minWidth: 0, overflowX: 'auto' }}>
            {filteredDiagrams.map((d, i) => (
              <button
                key={d.name}
                className={`iso-tab${i === safeDiagramIdx ? ' iso-tab--active' : ''}`}
                type="button"
                onClick={() => updateActiveTab(tab => ({ ...tab, activeDiagramIdx: i }))}
                aria-pressed={i === safeDiagramIdx}
                aria-label={t('tabs.switch', { name: d.name, kind: d.kind })}
              >
                {d.name}
                <span className="iso-tab-kind">{d.kind}</span>
              </button>
            ))}
          </nav>
        )}

        <div className="iso-header-spacer" />

        <div className="iso-mobile-hide" style={{ display: 'flex', alignItems: 'center', flex: '0 1 30%', minWidth: 0, overflow: 'hidden' }}>
          <button 
            type="button" 
            style={{ background: 'transparent', border: 'none', color: 'var(--iso-text)', cursor: 'pointer', padding: '0 4px', opacity: 0.6 }} 
            onClick={e => e.currentTarget.nextElementSibling?.scrollBy({ left: -150, behavior: 'smooth' })}
            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
            onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
          >
            ◀
          </button>
          <nav className="iso-tabs" aria-label={t('tabs.open_files')} style={{ flex: '1 1 auto', overflowX: 'auto', display: 'flex', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {tabs.map(tab => (
              <div
                key={tab.id}
                className={`iso-tab${tab.id === activeTab?.id ? ' iso-tab--active' : ''}`}
                onClick={() => setActiveTabId(tab.id)}
                onDoubleClick={() => setRenamingTabId(tab.id)}
                aria-label={t('tabs.open_name', { name: tab.name })}
                style={{ paddingRight: tabs.length > 1 ? '4px' : '10px' }}
              >
                {renamingTabId === tab.id ? (
                  <span style={{ display: 'flex', alignItems: 'center' }}>
                    <input
                      autoFocus
                      defaultValue={tab.name.includes('.') ? tab.name.substring(0, tab.name.lastIndexOf('.')) : tab.name}
                      className="iso-tab-rename-input"
                      style={{ background: 'transparent', border: 'none', color: 'inherit', fontFamily: 'inherit', fontSize: 'inherit', outline: 'none', width: '80px', borderBottom: '1px solid currentColor' }}
                      onBlur={(e) => {
                        const ext = tab.name.includes('.') ? tab.name.substring(tab.name.lastIndexOf('.')) : '';
                        const newName = e.target.value ? e.target.value + ext : tab.name;
                        setTabs(prev => prev.map(t => t.id === tab.id ? { ...t, name: newName } : t));
                        setRenamingTabId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur();
                        if (e.key === 'Escape') setRenamingTabId(null);
                      }}
                      onClick={e => e.stopPropagation()}
                    />
                    <span>{tab.name.includes('.') ? tab.name.substring(tab.name.lastIndexOf('.')) : ''}</span>
                  </span>
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
                      setTabToClose(tab.id);
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </nav>
          <button 
            type="button" 
            style={{ background: 'transparent', border: 'none', color: 'var(--iso-text)', cursor: 'pointer', padding: '0 4px', opacity: 0.6 }} 
            onClick={e => e.currentTarget.previousElementSibling?.scrollBy({ left: 150, behavior: 'smooth' })}
            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
            onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
          >
            ▶
          </button>
        </div>

        {activeDiagram && (
          <div className={isMobileLayout ? 'iso-kind-badge iso-kind-badge--mobile iso-mobile-hide' : 'iso-kind-badge'}>
            {activeDiagram.kind}
          </div>
        )}

        {!isMobileLayout && (
          <div className="iso-header-actions">
            <button type="button" className="iso-btn" onClick={handleNew} aria-label={t('menu.new_diagram')} data-tooltip={t('menu.new_shortcut')}>
              <IconNew />
              {t('menu.new')}
            </button>

            <button type="button" className="iso-btn" onClick={() => fileInputRef.current?.click()} aria-label={t('menu.open_isx')} data-tooltip={t('menu.open_shortcut')}>
              <IconOpen />
              {t('menu.open')}
            </button>

            {examplesDropdown}

            {activeDiagram?.kind === 'sequence' && (
              <button
                type="button"
                className="iso-btn"
                onClick={handleTransformToCollaboration}
                aria-label={t('menu.transform_seq_collab')}
                data-tooltip={t('menu.transform_collab')}
              >
                <IconDiagram />
                {t('menu.transform')}
              </button>
            )}

            <button
              type="button"
              className="iso-btn"
              onClick={() => {
                if (!activeTab) return;
                const blob = new Blob([activeTab.source], { type: 'application/octet-stream' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = activeTab.name || 'diagram.isx';
                a.click();
                URL.revokeObjectURL(url);
              }}
              disabled={!activeTab}
              aria-label={t('menu.export_source')}
              data-tooltip={t('menu.save_isx')}
            >
              <IconSave />
              {t('menu.save_isx_ext')}
            </button>

            <button
              type="button"
              className="iso-btn"
              onClick={handleExportSVG}
              disabled={!activeDiagram}
              aria-label={t('menu.export_svg_shortcut')}
              data-tooltip={t('menu.export_svg_short')}
            >
              <IconExport />
              SVG
            </button>
            <button
              type="button"
              className="iso-btn"
              onClick={handleExportPNG}
              disabled={!activeDiagram}
              aria-label={t('menu.export_png_shortcut')}
              data-tooltip={t('menu.export_png_short')}
            >
              <IconExport />
              PNG
            </button>

            <div className="iso-header-sep" aria-hidden="true" />

            <button
              type="button"
              className="iso-btn iso-btn--icon"
              onClick={() => setShortcutsOpen(o => !o)}
              aria-label={t('ui.shortcuts')}
              data-tooltip={t('menu.shortcuts')}
            >
              <IconKeyboard />
            </button>
          </div>
        )}

        <input ref={fileInputRef} type="file" accept=".isx,.iso,.txt" onChange={handleFileOpen} style={{ display: 'none' }} tabIndex={-1} />

        <select
          className="iso-select iso-mobile-hide"
          aria-label={t('ui.language')}
          value={language}
          onChange={e => setLanguage(e.target.value as Language)}
          style={{ width: 'auto', marginLeft: 'auto', marginRight: '8px' }}
        >
          {LANGUAGE_OPTIONS.map(option => (
            <option key={option.code} value={option.code}>{option.label}</option>
          ))}
        </select>

        <button
          type="button"
          className="iso-btn iso-btn--icon iso-mobile-hide"
          onClick={() => {
            const next = themeMode === 'light' ? 'dark' : 'light';
            setThemeMode(next);
            document.documentElement.setAttribute('data-theme', next);
            localStorage.setItem('isomorph-theme', next);
          }}
          aria-label={t('ui.toggle_theme')}
          data-tooltip={themeMode === 'light' ? t('ui.dark_mode') : t('ui.light_mode')}
          style={{ marginRight: '8px' }}
        >
          <IconTheme />
        </button>

        {/* Status */}
        <output
          className={`${statusClass}${isMobileLayout ? ' iso-mobile-hide' : ''}`}
          aria-live="polite"
          aria-label={statusAriaLabel}
        >
          <div className="iso-status-dot" aria-hidden="true" />
          {statusLabel}
        </output>

        <div className="iso-header-sep iso-mobile-hide" aria-hidden="true" />
        <label className="iso-mobile-hide" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '13px', color: 'var(--iso-text)' }}>
          <input type="checkbox" checked={isUMLCompliant} onChange={e => setIsUMLCompliant(e.target.checked)} />
          {t('ui.strict_uml')}
        </label>
      </header>

      {isMobileLayout && (
        <>
          <div className="iso-mobile-meta">
            {activeDiagram && (
              <div className="iso-kind-badge iso-kind-badge--mobile">
                {activeDiagram.kind}
              </div>
            )}
            <output
              className={`${statusClass} iso-mobile-status`}
              aria-live="polite"
              aria-label={statusAriaLabel}
            >
              <div className="iso-status-dot" aria-hidden="true" />
              {statusLabel}
            </output>
          </div>

          {tabs.length > 1 && (
            <div className="iso-mobile-strip">
              <nav className="iso-tabs" aria-label={t('tabs.open_files')}>
                {tabs.map(tab => (
                  <div
                    key={tab.id}
                    className={`iso-tab${tab.id === activeTab?.id ? ' iso-tab--active' : ''}`}
                    onClick={() => {
                      setActiveTabId(tab.id);
                    }}
                    onDoubleClick={() => setRenamingTabId(tab.id)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    {renamingTabId === tab.id ? (
                      <span style={{ display: 'flex', alignItems: 'center' }}>
                        <input
                          autoFocus
                          defaultValue={tab.name.includes('.') ? tab.name.substring(0, tab.name.lastIndexOf('.')) : tab.name}
                          className="iso-tab-rename-input"
                          style={{ background: 'transparent', border: 'none', color: 'inherit', fontFamily: 'inherit', fontSize: 'inherit', outline: 'none', width: '80px', borderBottom: '1px solid currentColor' }}
                          onBlur={(e) => {
                            const ext = tab.name.includes('.') ? tab.name.substring(tab.name.lastIndexOf('.')) : '';
                            const newName = e.target.value ? e.target.value + ext : tab.name;
                            setTabs(prev => prev.map(t => t.id === tab.id ? { ...t, name: newName } : t));
                            setRenamingTabId(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') e.currentTarget.blur();
                            if (e.key === 'Escape') setRenamingTabId(null);
                          }}
                          onClick={e => e.stopPropagation()}
                        />
                        <span>{tab.name.includes('.') ? tab.name.substring(tab.name.lastIndexOf('.')) : ''}</span>
                      </span>
                    ) : (
                      <>
                        <span>{tab.name}</span>
                        {tabs.length > 1 && (
                          <button
                            type="button"
                            aria-label={t('tabs.close_name', { name: tab.name })}
                            style={{ all: 'unset', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: 4, opacity: 0.75, fontSize: 13, lineHeight: 1, cursor: 'pointer' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setTabToClose(tab.id);
                            }}
                          >
                            ×
                          </button>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </nav>
            </div>
          )}

          {diagrams.length > 1 && (
            <div className="iso-mobile-strip iso-mobile-strip--muted">
              <nav className="iso-tabs" aria-label={t('ui.diagrams')}>
                {filteredDiagrams.map((d, i) => (
                  <button
                    key={d.name}
                    type="button"
                    className={`iso-tab${i === safeDiagramIdx ? ' iso-tab--active' : ''}`}
                    onClick={() => updateActiveTab(tab => ({ ...tab, activeDiagramIdx: i }))}
                  >
                    {d.name}
                    <span className="iso-tab-kind">{d.kind}</span>
                  </button>
                ))}
              </nav>
            </div>
          )}

          <div className="iso-mobile-actions">
            <div className="iso-mobile-actions-group">
              <button type="button" className="iso-btn" onClick={handleNew}>
                <IconNew />
                {t('menu.new')}
              </button>
              <button type="button" className="iso-btn" onClick={() => fileInputRef.current?.click()}>
                <IconOpen />
                {t('menu.open')}
              </button>
              {examplesDropdown}
              {activeDiagram?.kind === 'sequence' && (
                <button type="button" className="iso-btn" onClick={handleTransformToCollaboration}>
                  <IconDiagram />
                  {t('menu.transform')}
                </button>
              )}
            </div>
            <div className="iso-mobile-actions-group iso-mobile-actions-group--secondary">
              <button
                type="button"
                className="iso-btn"
                onClick={() => {
                  if (!activeTab) return;
                  const blob = new Blob([activeTab.source], { type: 'application/octet-stream' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = activeTab.name || 'diagram.isx';
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                disabled={!activeTab}
              >
                <IconSave />
                {t('menu.save')}
              </button>
              <button
                type="button"
                className="iso-btn"
                onClick={handleExportSVG}
                onPointerDown={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleExportSVG();
                }}
                disabled={!activeDiagram}
              >
                <IconExport />
                SVG
              </button>
              <button
                type="button"
                className="iso-btn"
                onClick={handleExportPNG}
                onPointerDown={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleExportPNG();
                }}
                disabled={!activeDiagram}
              >
                <IconExport />
                PNG
              </button>
              <button type="button" className="iso-btn iso-btn--icon" onClick={() => setShortcutsOpen(o => !o)} aria-label={t('ui.shortcuts')}>
                <IconKeyboard />
              </button>
              <select
                className="iso-select"
                aria-label={t('ui.language')}
                value={language}
                onChange={e => setLanguage(e.target.value as Language)}
                style={{ width: 'auto', minHeight: 32 }}
              >
                {LANGUAGE_OPTIONS.map(option => (
                  <option key={option.code} value={option.code}>{option.label}</option>
                ))}
              </select>
              <button
                type="button"
                className="iso-btn iso-btn--icon"
                onClick={() => {
                  const next = themeMode === 'light' ? 'dark' : 'light';
                  setThemeMode(next);
                  document.documentElement.setAttribute('data-theme', next);
                  localStorage.setItem('isomorph-theme', next);
                }}
                aria-label={t('ui.toggle_theme')}
              >
                <IconTheme />
              </button>
              <label className="iso-mobile-toggle">
                <input type="checkbox" checked={isUMLCompliant} onChange={e => setIsUMLCompliant(e.target.checked)} />
                {t('ui.strict_uml')}
              </label>
            </div>
          </div>
        </>
      )}

      {isMobileLayout && (
        <div className="iso-mobile-bar">
          <button
            type="button"
            className={`iso-mobile-tab${mobilePane === 'code' ? ' iso-mobile-tab--active' : ''}`}
            onClick={() => setMobilePane('code')}
          >
            {t('ui.source')}
          </button>
          <button
            type="button"
            className={`iso-mobile-tab${mobilePane === 'diagram' ? ' iso-mobile-tab--active' : ''}`}
            onClick={() => setMobilePane('diagram')}
          >
            {t('ui.canvas')}
          </button>
        </div>
      )}

      {/* ──────────────── MAIN ────────────────────────────── */}
      <main className="iso-main">
        {isMobileLayout ? (
          <div className="iso-mobile-main">
            {mobilePane === 'code' && sourcePane}
            {mobilePane === 'diagram' && mobileCanvasPane}
          </div>
        ) : (
          <>
            {shapesPane}
            <SplitPane left={sourcePane} right={canvasPane} separatorLabel={t('tool.resize_panels')} />
          </>
        )}
      </main>

      {editingEntity && (
        <div className="iso-modal-overlay" onClick={() => setEditingEntity(null)}>
          <div className="iso-modal" onClick={e => e.stopPropagation()}>
            <h3>{t('edit.entity_title')}</h3>
            <div className="iso-modal-field">
              <label>{t('edit.name')}</label>
              <input type="text" value={editingEntity.name} onChange={e => setEditingEntity({ ...editingEntity, name: e.target.value })} autoFocus={!isMobileLayout} />
            </div>
            <div className="iso-modal-field">
              <label>{t('edit.kind')}</label>
              <span style={{ padding: '0.4rem', border: '1px solid transparent' }}>{editingEntity.kind}</span>
            </div>
            {!['partition', 'system', 'boundary'].includes(editingEntity.kind) && (
              <div className="iso-modal-field">
                <label>{t('edit.stereotype')}</label>
                <input type="text" value={editingEntity.stereotype} onChange={e => setEditingEntity({ ...editingEntity, stereotype: e.target.value })} placeholder={t('edit.eg_device')} />
              </div>
            )}
            {['class', 'interface'].includes(editingEntity.kind) && (
              <div className="iso-modal-field">
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '0.5rem' }}>
                  <input type="checkbox" checked={editingEntity.isAbstract} onChange={e => setEditingEntity({ ...editingEntity, isAbstract: e.target.checked })} style={{ margin: 0 }} />
                  {t('edit.abstract')}
                </label>
              </div>
            )}
            {editingEntity.kind === 'interface' && ['component', 'deployment'].includes(activeDiagram?.kind || '') && (
              <div className="iso-modal-field">
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '0.5rem' }}>
                  <input type="checkbox" checked={editingEntity.stereotype === 'lollipop'} onChange={e => setEditingEntity({ ...editingEntity, stereotype: e.target.checked ? 'lollipop' : '' })} style={{ margin: 0 }} />
                  {t('edit.lollipop')}
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
                  <label>{t('edit.body')}</label>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {['enum'].includes(editingEntity.kind) && (
                        <button type="button" className="iso-btn" style={{fontSize: 10, padding: '2px 6px'}} onClick={(e) => { e.stopPropagation(); setEditingEntity(e => e ? { ...e, bodyText: (e.bodyText ? e.bodyText + '\n' : '') + 'NEW_VALUE' } : null); }}>{t('edit.enum_value')}</button>
                    )}
                    {['usecase'].includes(editingEntity.kind) && (
                        <button type="button" className="iso-btn" style={{fontSize: 10, padding: '2px 6px'}} onClick={(e) => { e.stopPropagation(); setEditingEntity(e => e ? { ...e, bodyText: (e.bodyText ? e.bodyText + '\n' : '') + 'extensionPoint' } : null); }}>{t('edit.ext_pt')}</button>
                    )}
                    {['class', 'interface'].includes(editingEntity.kind) && (
                       <>
                         <button type="button" className="iso-btn" style={{fontSize: 10, padding: '2px 6px'}} onClick={(e) => { e.stopPropagation(); setEditingEntity(e => e ? { ...e, bodyText: (e.bodyText ? e.bodyText + '\n' : '') + '+ newField : string' } : null); }}>{t('edit.pub_field')}</button>
                         <button type="button" className="iso-btn" style={{fontSize: 10, padding: '2px 6px'}} onClick={(e) => { e.stopPropagation(); setEditingEntity(e => e ? { ...e, bodyText: (e.bodyText ? e.bodyText + '\n' : '') + '- newField : string' } : null); }}>{t('edit.priv_field')}</button>
                         <button type="button" className="iso-btn" style={{fontSize: 10, padding: '2px 6px'}} onClick={(e) => { e.stopPropagation(); setEditingEntity(e => e ? { ...e, bodyText: (e.bodyText ? e.bodyText + '\n' : '') + '+ newMethod() : void' } : null); }}>{t('edit.pub_method')}</button>
                       </>
                    )}
                    {['node', 'device', 'environment', 'component'].includes(editingEntity.kind) && (
                       <>
                         <button type="button" className="iso-btn" style={{fontSize: 10, padding: '2px 6px'}} onClick={(e) => { e.stopPropagation(); setEditingEntity(e => e ? { ...e, bodyText: (e.bodyText ? e.bodyText + '\n' : '') + 'node NewNode' } : null); }}>{t('edit.node')}</button>
                         <button type="button" className="iso-btn" style={{fontSize: 10, padding: '2px 6px'}} onClick={(e) => { e.stopPropagation(); setEditingEntity(e => e ? { ...e, bodyText: (e.bodyText ? e.bodyText + '\n' : '') + 'artifact NewArtifact' } : null); }}>{t('edit.artifact')}</button>
                         <button type="button" className="iso-btn" style={{fontSize: 10, padding: '2px 6px'}} onClick={(e) => { e.stopPropagation(); setEditingEntity(e => e ? { ...e, bodyText: (e.bodyText ? e.bodyText + '\n' : '') + '+ port1 : provided' } : null); }}>{t('edit.port_prov')}</button>
                         <button type="button" className="iso-btn" style={{fontSize: 10, padding: '2px 6px'}} onClick={(e) => { e.stopPropagation(); setEditingEntity(e => e ? { ...e, bodyText: (e.bodyText ? e.bodyText + '\n' : '') + '+ port2 : required' } : null); }}>{t('edit.port_req')}</button>
                       </>
                    )}
                    {['state', 'composite', 'concurrent'].includes(editingEntity.kind) && (
                       <>
                         <button type="button" className="iso-btn" style={{fontSize: 10, padding: '2px 6px'}} onClick={(e) => { e.stopPropagation(); setEditingEntity(e => e ? { ...e, bodyText: (e.bodyText ? e.bodyText + '\n' : '') + 'entry() : void' } : null); }}>{t('edit.entry')}</button>
                         <button type="button" className="iso-btn" style={{fontSize: 10, padding: '2px 6px'}} onClick={(e) => { e.stopPropagation(); setEditingEntity(e => e ? { ...e, bodyText: (e.bodyText ? e.bodyText + '\n' : '') + 'exit() : void' } : null); }}>{t('edit.exit')}</button>
                         <button type="button" className="iso-btn" style={{fontSize: 10, padding: '2px 6px'}} onClick={(e) => { e.stopPropagation(); setEditingEntity(e => e ? { ...e, bodyText: (e.bodyText ? e.bodyText + '\n' : '') + 'do() : void' } : null); }}>{t('edit.do')}</button>
                         <button type="button" className="iso-btn" style={{fontSize: 10, padding: '2px 6px'}} onClick={(e) => { e.stopPropagation(); setEditingEntity(e => e ? { ...e, bodyText: (e.bodyText ? e.bodyText + '\n' : '') + 'state SubState' } : null); }}>{t('edit.substate')}</button>
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
              <button type="button" className="iso-btn" onClick={(e) => { e.stopPropagation(); setEditingEntity(null); }}>{t('ui.cancel')}</button>
              <button type="button" className="iso-btn iso-btn--primary" onClick={(e) => { e.stopPropagation(); const isNameOnlyBoundary = editingEntity.kind === 'partition' || editingEntity.kind === 'system' || editingEntity.kind === 'boundary'; handleEntityEdit(editingEntity.origName || editingEntity.id, { name: editingEntity.name, stereotype: isNameOnlyBoundary ? undefined : editingEntity.stereotype, isAbstract: editingEntity.isAbstract, bodyText: editingEntity.bodyText, kind: editingEntity.kind }); }}>{t('menu.save')}</button>
            </div>
          </div>
        </div>
      )}

      {editingRelation && (
        <div className="iso-modal-overlay" onClick={() => setEditingRelation(null)}>
          <div className="iso-modal" onClick={e => e.stopPropagation()}>
            <h3>{t('edit.relation_title')}</h3>
            <div className="iso-modal-field">
              <label>{t('edit.role_label')}</label>
              <div style={{ display: 'flex', gap: '4px', width: '100%' }}>
                <input type="text" style={{ flex: 1 }} value={editingRelation.label} onChange={e => setEditingRelation({ ...editingRelation, label: e.target.value })} autoFocus={!isMobileLayout} />
                {['state', 'activity'].includes(activeDiagram?.kind || '') && (
                  <button className="iso-btn" onClick={() => setEditingRelation(r => r ? { ...r, label: r.label.includes('[') ? r.label : `[${r.label || 'guard'}]` } : null)}>{t('edit.guard')}</button>
                )}
              </div>
            </div>
            {['class'].includes(activeDiagram?.kind || '') && (
              <div style={{ display: 'flex', gap: '16px', width: '100%' }}>
                <div className="iso-modal-field" style={{ flex: 1, minWidth: 0 }}>
                  <label>{t('edit.from_mult')}</label>
                  <input type="text" value={editingRelation.fromMult || ''} onChange={e => setEditingRelation({ ...editingRelation, fromMult: e.target.value })} />
                </div>
                <div className="iso-modal-field" style={{ flex: 1, minWidth: 0 }}>
                  <label>{t('edit.to_mult')}</label>
                  <input type="text" value={editingRelation.toMult || ''} onChange={e => setEditingRelation({ ...editingRelation, toMult: e.target.value })} />
                </div>
              </div>
            )}
            <div className="iso-modal-field">
              <label>{t('edit.kind')}</label>
              <select className="iso-select" value={editingRelation.kind} onChange={e => setEditingRelation({ ...editingRelation, kind: e.target.value })}>
                <option value="association">{t('rel.association')}</option>
                <option value="directed-association">{t('rel.directed_association')}</option>
                <option value="inheritance">{t('rel.inheritance')}</option>
                <option value="realization">{t('rel.realization')}</option>
                <option value="aggregation">{t('rel.aggregation')}</option>
                <option value="composition">{t('rel.composition')}</option>
                <option value="dependency">{t('rel.dependency')}</option>
                <option value="restriction">{t('rel.restriction')}</option>
                {['component', 'deployment'].includes(activeDiagram?.kind || '') && (
                  <>
                    <option value="provides">{t('rel.provides')}</option>
                    <option value="requires">{t('rel.requires')}</option>
                  </>
                )}
              </select>
            </div>
            <div className="iso-modal-field">
              <label>{t('edit.direction')}</label>
              <select className="iso-select" value={editingRelation.direction} onChange={e => setEditingRelation({ ...editingRelation, direction: e.target.value as 'forward' | 'reverse' })}>
                <option value="forward">{t('edit.forward')}</option>
                <option value="reverse">{t('edit.reverse')}</option>
              </select>
            </div>
            <div className="iso-modal-actions">
              <button className="iso-btn" onClick={() => setEditingRelation(null)}>{t('ui.cancel')}</button>
              <button className="iso-btn iso-btn--primary" onClick={() => handleRelationEdit(editingRelation.relationId, { label: editingRelation.label, kind: editingRelation.kind, direction: editingRelation.direction, fromMult: editingRelation.fromMult, toMult: editingRelation.toMult })}>{t('menu.save')}</button>
            </div>
          </div>
        </div>
      )}

      {editingText && ( <div className="iso-modal-overlay" onClick={() => setEditingText(null)}> <div className="iso-modal" onClick={e => e.stopPropagation()}> <h3>{editingText.type === 'diagram' ? t('edit.diagram_name') : t('edit.package_name')}</h3> <div className="iso-modal-field"> <label>{t('edit.name')}</label> <input type="text" style={{ width: '100%', padding: '0.4rem' }} value={editingText.newName} onChange={e => setEditingText({ ...editingText, newName: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') { updateActiveTab(tab => { let src = tab.source; if (editingText.type === 'diagram') { src = src.replace(new RegExp('diagram\\s+' + editingText.oldName), 'diagram ' + editingText.newName); } else { src = src.replace(new RegExp('package\\s+' + editingText.oldName + '\\b'), 'package ' + editingText.newName); src = src.replace(new RegExp('@' + editingText.oldName + '\\s+at'), '@' + editingText.newName + ' at'); } return { ...tab, source: src }; }); setEditingText(null); } }} autoFocus={!isMobileLayout} /> </div> <div className="iso-modal-actions"> <button className="iso-btn" onClick={() => setEditingText(null)}>{t('ui.cancel')}</button> <button className="iso-btn iso-btn--primary" onClick={() => { updateActiveTab(tab => { let src = tab.source; if (editingText.type === 'diagram') { src = src.replace(new RegExp('diagram\\s+' + editingText.oldName), 'diagram ' + editingText.newName); } else { src = src.replace(new RegExp('package\\s+' + editingText.oldName + '\\b'), 'package ' + editingText.newName); src = src.replace(new RegExp('@' + editingText.oldName + '\\s+at'), '@' + editingText.newName + ' at'); } return { ...tab, source: src }; }); setEditingText(null); }}>{t('menu.save')}</button> </div> </div> </div> )} {/* ──────────────── STATUS BAR ──────────────────────── */}
      <footer className="iso-statusbar">
        <span className="iso-statusbar-item">{t('ui.isomorph_dsl')}</span>
        <span className="iso-statusbar-sep">·</span>
        <span className="iso-statusbar-item" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {t('status.lines', { count: source.split('\n').length })}
        </span>
        {activeDiagram && (
          <>
            <span className="iso-statusbar-sep">·</span>
            <span className="iso-statusbar-item" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {t('status.entities', { count: activeDiagram.entities.size })}
            </span>
            <span className="iso-statusbar-sep">·</span>
            <span className="iso-statusbar-item" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {t('status.relations', { count: activeDiagram.relations.length })}
            </span>
            <span className="iso-statusbar-sep">·</span>
            <span className="iso-statusbar-item">{activeDiagram.kind}</span>
          </>
        )}
        <span className="iso-statusbar-sep" style={{ marginLeft: 'auto' }}>·</span>
        <span className="iso-statusbar-item">FAF-241 · Team 02</span>
      </footer>

      {/* ──────────────── SHORTCUTS OVERLAY ───────────────── */}
      <ShortcutsOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} t={t} />

      {/* ──────────────── MODALS ───────────────── */}
      {isNewModalOpen && (
        <div className="iso-modal-overlay" onClick={() => setIsNewModalOpen(false)}>
          <div className="iso-modal" onClick={e => e.stopPropagation()}>
            <h2 className="iso-modal-title">{t('welcome.create_new')}</h2>
            <p className="iso-modal-desc">{t('Select the type of diagram you\'d like to create.')}</p>
            <select className="iso-modal-select" value={newDiagramKind} onChange={e => setNewDiagramKind(e.target.value as DiagramKind)}>
              {DIAGRAM_KINDS.filter(k => k !== 'all').map(k => (
                <option key={k} value={k}>{`${k.charAt(0).toUpperCase() + k.slice(1)} ${t('welcome.diagram')}`}</option>
              ))}
            </select>
            <div className="iso-modal-actions">
              <button className="iso-modal-btn cancel" onClick={() => setIsNewModalOpen(false)}>{t('ui.cancel')}</button>
              <button className="iso-modal-btn confirm" onClick={() => executeNewDiagram(newDiagramKind)}>{t('ui.create')}</button>
            </div>
          </div>
        </div>
      )}

      {tabToClose && (
        <div className="iso-modal-overlay" onClick={() => setTabToClose(null)}>
          <div className="iso-modal" onClick={e => e.stopPropagation()}>
            <h2 className="iso-modal-title">{t('dialog.close_title')}</h2>
            <p className="iso-modal-desc">{t('dialog.close_desc', { name: tabs.find(t => t.id === tabToClose)?.name ?? '' })}</p>
            <div className="iso-modal-actions">
              <button className="iso-modal-btn cancel" onClick={() => setTabToClose(null)}>{t('ui.cancel')}</button>
              <button className="iso-modal-btn danger" onClick={() => {
                setTabs(prev => {
                  const next = prev.filter(t => t.id !== tabToClose);
                  if (activeTabId === tabToClose) setActiveTabId(next[Math.max(0, next.length - 1)]?.id ?? '');
                  return next;
                });
                setTabToClose(null);
              }}>{t('ui.close')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}







