// ============================================================
// Isomorph — Source Manipulation Utilities
// ============================================================
// Pure functions for manipulating ISX diagram source text.
// No React hooks, no JSX, no component state.
// Extracted from App.tsx during demonolith decomposition.
// ============================================================

import type { DiagramKind, SequenceMessageType } from '../types/index.js';
import type { CanvasTool } from '../components/DiagramView.js';
import { ENTITY_KINDS_RX, REL_TOKENS_BY_KIND } from '../constants.js';

// ── Tiny helpers ──────────────────────────────────────────────

export function slugId(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

export function escapeAttrValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function inferSequenceMessageType(kind: string, from?: string, to?: string): SequenceMessageType {
  if (from && to && from === to) return 'self-call';
  if (kind === 'dependency') return 'response';
  if (kind === 'inheritance') return 'asynchronous';
  return 'synchronous';
}

export function toolsetFor(kind?: DiagramKind): CanvasTool[] {
  if (!kind) return ['move', 'hand'];
  return ['move', 'hand', 'add-edge', 'edit-node', 'edit-edge'];
}

// ── Diagram block finding ─────────────────────────────────────

export function findDiagramBlock(source: string): { start: number; openBrace: number; closeBrace: number } | null {
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

// ── Insertion helpers ─────────────────────────────────────────

export function insertBeforeAnnotations(source: string, insertion: string): string {
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

export function insertIntoPackage(source: string, targetPackage: string, declaration: string): string {
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

export function insertRelation(source: string, insertion: string): string {
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

export function insertAtEnd(source: string, insertion: string): string {
  const lastBrace = source.lastIndexOf('}');
  if (lastBrace < 0) return source;
  let prefix = source.slice(0, lastBrace);
  if (!prefix.endsWith('\n')) prefix += '\n';
  return prefix + insertion + '\n' + source.slice(lastBrace);
}

// (Formatting and sequence-to-collaboration functions have been extracted to src/utils/formatting.ts)

// ── Entity position / annotation ──────────────────────────────

export function updateEntityPosition(source: string, name: string, x: number, y: number, w?: number, h?: number): string {
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

export function removeLayoutAnnotation(source: string, entityName: string): string {
  const annoRx = new RegExp(`^[ \\t]*@${escapeRegex(entityName)}[ \\t]+at[ \\t]*\\([^)]+\\)[ \\t]*\\n?`, 'gm');
  return source.replace(annoRx, '');
}

// ── Relation position / attributes ────────────────────────────

export function parseRelationAttrs(attrs: string): Map<string, string> {
  const attrMap = new Map<string, string>();
  const attrRx = /([A-Za-z_][\w]*)\s*=\s*"((?:\\"|[^"])*)"/g;
  let match: RegExpExecArray | null = attrRx.exec(attrs);
  while (match) {
    attrMap.set(match[1], match[2].replace(/\\"/g, '"'));
    match = attrRx.exec(attrs);
  }
  return attrMap;
}

export function updateRelationVerticalPosition(source: string, relationId: string, y: number): string {
  const idxRaw = relationId.replace('rel_', '');
  const relationIdx = Number.parseInt(idxRaw, 10);
  if (!Number.isInteger(relationIdx) || relationIdx < 0) return source;

  const relRegex = /^(\s*)([A-Za-z_][\w]*)\s+(--\(\)|--\(|--\|>|\.\.\|>|<\|--|<\|\.\.|<\.\.|o--|\*--|-->|->|\.\.>|--o|--\*|--x|--)\s+(?:(create|destroy|new|delete)\s+)?([A-Za-z_][\w]*)(\s*\[[^\]]*\])?\s*$/gm;
  const matches = [...source.matchAll(relRegex)];
  const match = matches[relationIdx];
  if (!match || match.index == null) return source;

  const [full, indent, fromRaw, opRaw, actionRaw, toRaw, attrsRaw = ''] = match;
  const yValue = String(Math.max(0, Math.round(y)));
  let suffix = attrsRaw || '';

  if (!suffix.trim()) {
    suffix = ` [y="${yValue}"]`;
  } else if (/\by\s*=\s*"(?:\\"|[^"])*"/.test(suffix)) {
    suffix = suffix.replace(/(\by\s*=\s*")((?:\\"|[^"])*)"/, `$1${yValue}"`);
  } else {
    suffix = suffix.replace(/\]\s*$/, `, y="${yValue}"]`);
  }

  const actionStr = actionRaw ? `${actionRaw} ` : '';
  const replacement = `${indent}${fromRaw} ${opRaw} ${actionStr}${toRaw}${suffix}`;

  return source.slice(0, match.index) + replacement + source.slice(match.index + full.length);
}

export function updateRelationVerticalPositions(source: string, relationYs: Record<string, number>): string {
  let next = source;
  for (const [relationId, y] of Object.entries(relationYs)) {
    next = updateRelationVerticalPosition(next, relationId, y);
  }
  return next;
}

export function updateRelationById(
  source: string,
  relationId: string,
  updates: { label?: string; kind?: string; direction?: 'forward' | 'reverse'; fromMult?: string; toMult?: string; seqMessageType?: SequenceMessageType },
  diagramKind?: DiagramKind,
): string {
  const idxRaw = relationId.replace('rel_', '');
  const relationIdx = Number.parseInt(idxRaw, 10);
  if (!Number.isInteger(relationIdx) || relationIdx < 0) return source;

  const relRegex = /^(\s*)([A-Za-z_][\w]*)\s+(--\(\)|--\(|--\|>|\.\.\|>|<\|--|<\|\.\.|<\.\.|o--|\*--|-->|->|\.\.>|--o|--\*|--x|--)\s+(?:(create|destroy|new|delete)\s+)?([A-Za-z_][\w]*)(\s*\[[^\]]*\])?\s*$/gm;
  const matches = [...source.matchAll(relRegex)];
  const match = matches[relationIdx];
  if (!match || match.index == null) return source;

  const [full, indent, fromRaw, opRaw, actionRaw, toRaw, attrsRaw = ''] = match;
  let from = fromRaw;
  let to = toRaw;

  if (updates.direction === 'reverse') {
    const tmp = from;
    from = to;
    to = tmp;
  }

  const attrs = attrsRaw.trim().replace(/^\[|\]$/g, '');
  const attrMap = parseRelationAttrs(attrs);
  const isSequence = diagramKind === 'sequence';

  let op = REL_TOKENS_BY_KIND[updates.kind ?? ''] ?? opRaw;
  if (isSequence) {
    const inferredKind = (opRaw === '..>' || opRaw === '<..')
      ? 'dependency'
      : (opRaw === '--|>' || opRaw === '<|--' ? 'inheritance' : 'directed-association');
    const nextType = updates.seqMessageType ?? inferSequenceMessageType(inferredKind, from, to);
    if (nextType === 'response') op = '..>';
    else if (nextType === 'asynchronous') op = '--|>';
    else op = '-->';
    if (nextType === 'self-call') {
      to = from;
      op = '-->';
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
  const actionPart = actionRaw ? `${actionRaw} ` : '';
  const replacement = `${indent}${from} ${op} ${actionPart}${to}${suffix}`;

  return source.slice(0, match.index) + replacement + source.slice(match.index + full.length);
}

export function insertSequenceLifecycleAfterRelation(
  source: string,
  relationId: string,
  action: 'create' | 'destroy',
): string {
  const idxRaw = relationId.replace('rel_', '');
  const relationIdx = Number.parseInt(idxRaw, 10);
  if (!Number.isInteger(relationIdx) || relationIdx < 0) return source;

  const relRegex = /^(\s*)([A-Za-z_][\w]*)\s+(--\(\)|--\(|--\|>|\.\.\|>|<\|--|<\|\.\.|<\.\.|o--|\*--|-->|->|\.\.>|--o|--\*|--x|--)\s+(?:create\s+|destroy\s+|new\s+|delete\s+)?([A-Za-z_][\w]*)(\s*\[[^\]]*\])?\s*$/gm;
  const matches = [...source.matchAll(relRegex)];
  const match = matches[relationIdx];
  if (!match || match.index == null) return source;

  const [full, indent, from, op, to, attrs] = match;

  const replacement = `${indent}${from} ${op} ${action} ${to}${attrs || ''}`;
  const insertPos = match.index;
  return source.slice(0, insertPos) + replacement + source.slice(insertPos + full.length);
}

// ── Entity declaration helpers ────────────────────────────────

export function hasEntityDeclaration(source: string, entityName: string): boolean {
  const declRx = new RegExp(`^[ \\t]*(?:abstract[ \\t]+|static[ \\t]+|final[ \\t]+)*${ENTITY_KINDS_RX}[ \\t]+${escapeRegex(entityName)}\\b`, 'm');
  return declRx.test(source);
}

export function getEntityDeclarationKind(source: string, entityName: string): string | null {
  const declRx = new RegExp(`^[ \\t]*(?:abstract[ \\t]+|static[ \\t]+|final[ \\t]+)*(${ENTITY_KINDS_RX})[ \\t]+${escapeRegex(entityName)}\\b`, 'm');
  const match = source.match(declRx);
  return match?.[1] ?? null;
}

export function nextAvailableName(source: string, baseName: string): string {
  let idx = 1;
  let candidate = baseName;
  while (hasEntityDeclaration(source, candidate)) {
    candidate = `${baseName}${idx}`;
    idx++;
  }
  return candidate;
}

export function ensureUseCaseBoundaryDeclaration(source: string, preferredName: string): { source: string; name: string } {
  const raw = preferredName.trim();
  const safePreferred = /^[A-Za-z_]\w*$/.test(raw) ? raw : 'System';
  const existingKind = getEntityDeclarationKind(source, safePreferred);
  if (existingKind === 'system' || existingKind === 'boundary') return { source, name: safePreferred };
  const name = hasEntityDeclaration(source, safePreferred)
    ? nextAvailableName(source, `${safePreferred}Boundary`)
    : safePreferred;
  return { source: insertBeforeAnnotations(source, `  system ${name}`), name };
}

export function findEntityBounds(source: string, entityName: string): { start: number, end: number, bodyStart: number, bodyEnd: number } | null {
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
  let finalEnd = -1;
  for (let i = searchStart; i < source.length; i++) {
    if (source[i] === '{') {
      braceCount++;
    } else if (source[i] === '}') {
      braceCount--;
      if (braceCount === 0) {
        let currentEnd = i + 1;
        // Check for 'else' block immediately following the closing brace
        const afterBrace = source.slice(currentEnd);
        const elseMatch = afterBrace.match(/^\s*else\s*\{/);
        if (elseMatch) {
          // Move the search forward to inside the 'else' block's brace
          i = currentEnd + elseMatch.index! + elseMatch[0].length - 1;
          braceCount = 1;
          continue;
        }

        finalEnd = currentEnd;
        if (source[finalEnd] === '\r') finalEnd++;
        if (source[finalEnd] === '\n') finalEnd++;
        return { start: match.index, end: finalEnd, bodyStart, bodyEnd: i };
      }
    }
  }
  return { start: match.index, end: source.length, bodyStart, bodyEnd: source.length };
}

export function extractEntityBody(source: string, entityName: string): string | null {
  const bounds = findEntityBounds(source, entityName);
  if (!bounds || bounds.bodyStart === -1) return null;
  return source.slice(bounds.bodyStart, bounds.bodyEnd).replace(/^\n/, '').replace(/\n\s*$/, '');
}

export function extractEntityDeclaration(source: string, entityName: string): string | null {
  const bounds = findEntityBounds(source, entityName);
  if (!bounds) return null;
  return source.slice(bounds.start, bounds.end);
}

export function removeEntityDeclaration(source: string, entityName: string): string {
  const bounds = findEntityBounds(source, entityName);
  if (!bounds) return source;
  return source.slice(0, bounds.start) + source.slice(bounds.end);
}

export function replaceEntityBody(source: string, entityName: string, newBody: string): string {
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

export function entitySupportsBody(kind?: string): boolean {
  if (!kind) return false;
  return ['class', 'interface', 'enum', 'component', 'node', 'device', 'artifact', 'environment', 'state', 'composite', 'concurrent', 'usecase', 'package', 'note'].includes(kind);
}

export function entitySupportsStereotype(kind?: string): boolean {
  if (!kind) return false;
  return !['partition', 'system', 'boundary'].includes(kind);
}

export function updateEntityDeclaration(
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

export function normalizePartitionDeclaration(source: string, partitionName: string): string {
  const bounds = findEntityBounds(source, partitionName);
  if (!bounds) return source;

  const declNoBody = source.slice(bounds.start, bounds.bodyStart === -1 ? bounds.end : bounds.bodyStart - 1);
  const indent = declNoBody.match(/^\s*/)?.[0] ?? '';
  const nameMatch = declNoBody.match(/\bpartition\s+([A-Za-z_][\w]*)\b/);
  if (!nameMatch) return source;

  const normalized = `${indent}partition ${nameMatch[1]}\n`;
  return source.slice(0, bounds.start) + normalized + source.slice(bounds.end);
}

export function normalizeBoundaryDeclaration(source: string, boundaryName: string, boundaryKind: 'system' | 'boundary'): string {
  const bounds = findEntityBounds(source, boundaryName);
  if (!bounds) return source;

  const declNoBody = source.slice(bounds.start, bounds.bodyStart === -1 ? bounds.end : bounds.bodyStart - 1);
  const indent = declNoBody.match(/^\s*/)?.[0] ?? '';
  const nameMatch = declNoBody.match(/\b(?:system|boundary)\s+([A-Za-z_][\w]*)\b/);
  if (!nameMatch) return source;

  const normalized = `${indent}${boundaryKind} ${nameMatch[1]}\n`;
  return source.slice(0, bounds.start) + normalized + source.slice(bounds.end);
}
