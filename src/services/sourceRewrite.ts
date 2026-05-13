export const RELATION_TOKENS = [
  '--()',
  '--(',
  '--|>',
  '..|>',
  '<|--',
  '<|..',
  '<..',
  'o--',
  '*--',
  '-->',
  '->',
  '..>',
  '--o',
  '--*',
  '--x',
  '--',
] as const;

export const RELATION_TOKEN_PATTERN = RELATION_TOKENS
  .map(token => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|');

const ENTITY_KINDS = [
  'class',
  'interface',
  'enum',
  'actor',
  'usecase',
  'component',
  'node',
  'participant',
  'object',
  'partition',
  'decision',
  'merge',
  'fork',
  'join',
  'start',
  'stop',
  'action',
  'activity',
  'state',
  'composite',
  'concurrent',
  'choice',
  'history',
  'device',
  'artifact',
  'environment',
  'boundary',
  'system',
  'multiobject',
  'active_object',
  'collaboration',
  'composite_object',
].join('|');

export interface DiagramBlock {
  start: number;
  openBrace: number;
  closeBrace: number;
  name: string;
}

export interface RelationRewriteUpdates {
  label?: string;
  kind?: string;
  direction?: 'forward' | 'reverse';
  fromMult?: string;
  toMult?: string;
}

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

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeAttrValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function findDiagramBlock(source: string, diagramName?: string): DiagramBlock | null {
  const headerRx = /(^|\n)[ \t]*diagram\s+([A-Za-z_][\w]*)\s*:\s*\S+\s*\{/gm;
  for (const match of source.matchAll(headerRx)) {
    const start = (match.index ?? 0) + (match[1]?.length ?? 0);
    const name = match[2];
    if (diagramName && name !== diagramName) continue;
    const openBrace = source.indexOf('{', start);
    if (openBrace < 0) continue;

    let depth = 1;
    for (let i = openBrace + 1; i < source.length; i++) {
      if (source[i] === '{') depth++;
      if (source[i] === '}') {
        depth--;
        if (depth === 0) return { start, openBrace, closeBrace: i, name };
      }
    }
  }
  return null;
}

function rewriteDiagramBody(source: string, rewrite: (body: string, block: DiagramBlock) => string, diagramName?: string): string {
  const block = findDiagramBlock(source, diagramName);
  if (!block) return source;
  const header = source.slice(block.start, block.openBrace + 1);
  const body = source.slice(block.openBrace + 1, block.closeBrace);
  const suffix = source.slice(block.closeBrace);
  return source.slice(0, block.start) + header + rewrite(body, block) + suffix;
}

function parseRelationAttrs(attrs: string): Map<string, string> {
  const out = new Map<string, string>();
  const body = attrs.trim().replace(/^\[|\]$/g, '');
  const rx = /(\w+)\s*=\s*"((?:\\"|[^"])*)"/g;
  for (const match of body.matchAll(rx)) {
    out.set(match[1], match[2].replace(/\\"/g, '"').replace(/\\\\/g, '\\'));
  }
  return out;
}

export function serializeRelationAttrs(attrs: Map<string, string>): string {
  const serialized = [...attrs.entries()]
    .filter(([, value]) => value !== '')
    .map(([key, value]) => `${key}="${escapeAttrValue(value)}"`)
    .join(', ');
  return serialized ? ` [${serialized}]` : '';
}

function relationRegex(global = true): RegExp {
  return new RegExp(
    `^(\\s*)([A-Za-z_]\\w*)\\s+(${RELATION_TOKEN_PATTERN})\\s+(?:(create|destroy|new|delete)\\s+)?([A-Za-z_]\\w*)(\\s*\\[[^\\]]*\\])?\\s*$`,
    global ? 'gm' : '',
  );
}

export function formatDiagramSource(source: string, diagramName?: string): string {
  return rewriteDiagramBody(source.replace(/\t/g, '  '), (body) => {
    const headerLines: string[] = [];
    const relationLines: string[] = [];
    const annotationLines: string[] = [];
    const entityDeclRx = new RegExp(`^\\s*(?:abstract\\s+|static\\s+|final\\s+)*(?:${ENTITY_KINDS})\\s+`);
    const relRx = relationRegex(false);
    const annoRx = /^\s*@[A-Za-z_]\w*\s+at\s*\(/;
    const packageRx = /^\s*package\s+/;
    const lines = body.split('\n');

    let i = 0;
    while (i < lines.length) {
      const trimmed = lines[i].trim();
      if (!trimmed || trimmed === '}') {
        i++;
        continue;
      }

      if (annoRx.test(lines[i])) {
        annotationLines.push(`  ${trimmed}`);
        i++;
      } else if (relRx.test(lines[i])) {
        relationLines.push(`  ${trimmed}`);
        i++;
      } else if (trimmed.includes('{') && !trimmed.includes('}')) {
        let block = `  ${trimmed}`;
        let braceCount = (trimmed.match(/\{/g) || []).length - (trimmed.match(/\}/g) || []).length;
        i++;
        while (i < lines.length && braceCount > 0) {
          const inner = lines[i].trim();
          braceCount += (inner.match(/\{/g) || []).length - (inner.match(/\}/g) || []).length;
          block += `\n    ${inner}`;
          i++;
        }
        headerLines.push(block);
      } else if (entityDeclRx.test(lines[i]) || packageRx.test(lines[i])) {
        headerLines.push(`  ${trimmed}`);
        i++;
      } else {
        headerLines.push(`  ${trimmed}`);
        i++;
      }
    }

    const sections = [headerLines, relationLines, annotationLines].filter(section => section.length > 0);
    return sections.length > 0 ? `\n${sections.map(section => section.join('\n')).join('\n\n')}\n` : '\n';
  }, diagramName);
}

export function updateEntityPosition(
  source: string,
  name: string,
  x: number,
  y: number,
  w?: number,
  h?: number,
  diagramName?: string,
): string {
  return rewriteDiagramBody(source, (body) => {
    const hasSize = Number.isFinite(w) && Number.isFinite(h);
    const annotation = hasSize
      ? `@${name} at (${Math.round(x)}, ${Math.round(y)}, ${Math.round(w!)}, ${Math.round(h!)})`
      : `@${name} at (${Math.round(x)}, ${Math.round(y)})`;
    const pattern = new RegExp(`@${escapeRegex(name)}\\s+at\\s*\\([^)]+\\)`);
    if (pattern.test(body)) return body.replace(pattern, annotation);
    return body.endsWith('\n') ? `${body}  ${annotation}\n` : `${body}\n  ${annotation}\n`;
  }, diagramName);
}

export function updateRelationById(
  source: string,
  relationId: string,
  updates: RelationRewriteUpdates,
  diagramName?: string,
): string {
  const relationIdx = Number.parseInt(relationId.replace('rel_', ''), 10);
  if (!Number.isInteger(relationIdx) || relationIdx < 0) return source;

  return rewriteDiagramBody(source, (body) => {
    const matches = [...body.matchAll(relationRegex(true))];
    const match = matches[relationIdx];
    if (!match || match.index == null) return body;

    const [full, indent, fromRaw, opRaw, actionRaw, toRaw, attrsRaw = ''] = match;
    let from = fromRaw;
    let to = toRaw;
    if (updates.direction === 'reverse') {
      from = toRaw;
      to = fromRaw;
    }

    const attrs = parseRelationAttrs(attrsRaw);
    if (updates.label !== undefined) updates.label ? attrs.set('label', updates.label) : attrs.delete('label');
    if (updates.fromMult !== undefined) updates.fromMult ? attrs.set('fromMult', updates.fromMult) : attrs.delete('fromMult');
    if (updates.toMult !== undefined) updates.toMult ? attrs.set('toMult', updates.toMult) : attrs.delete('toMult');

    const op = REL_TOKENS_BY_KIND[updates.kind ?? ''] ?? opRaw;
    const actionPart = actionRaw ? `${actionRaw} ` : '';
    const replacement = `${indent}${from} ${op} ${actionPart}${to}${serializeRelationAttrs(attrs)}`;
    return body.slice(0, match.index) + replacement + body.slice(match.index + full.length);
  }, diagramName);
}

export function removeEntityAndRelations(source: string, entityName: string, diagramName?: string): string {
  return rewriteDiagramBody(source, (body) => {
    const escaped = escapeRegex(entityName);
    const annotationLine = new RegExp(`^\\s*@${escaped}\\s+at\\s*\\([^)]+\\)\\s*\\n?`, 'gm');
    const entityLine = new RegExp(`^\\s*(?:abstract\\s+|static\\s+|final\\s+)*(?:${ENTITY_KINDS})\\s+${escaped}(?:\\s*\\{[^}]*\\}|\\b[^\\n]*)?$`);
    const relRx = relationRegex(false);
    const lines = body.replace(annotationLine, '').split('\n');
    const kept = lines.filter(line => {
      if (entityLine.test(line)) return false;
      const rel = relRx.exec(line);
      relRx.lastIndex = 0;
      return !(rel && (rel[2] === entityName || rel[5] === entityName));
    });
    return kept.join('\n');
  }, diagramName);
}
