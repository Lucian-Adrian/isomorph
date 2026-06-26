// ============================================================
// Isomorph — Formatting Utilities
// ============================================================
// Functions to format diagram source code.
// Extracted from App.tsx during demonolith decomposition.
// ============================================================

import type { IOMDiagram } from '../semantics/iom.js';
import { ENTITY_KINDS_RX } from '../constants.js';
import { findDiagramBlock, escapeAttrValue } from './source-manipulation.js';

/**
 * Canvas-operation formatter:
 * keep one blank line between header, relations, and footer annotations.
 * This intentionally runs only on canvas-triggered rewrites, not manual typing.
 */
export function formatDiagramSource(source: string): string {
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
    } else if (trimmed.includes('{') && !trimmed.includes('}')) {
      let blockContent = '  ' + trimmed;
      let braceCount = (trimmed.match(/\{/g) || []).length - (trimmed.match(/\}/g) || []).length;
      i++;
      while (i < lines.length && braceCount > 0) {
        const innerLine = lines[i].trim();
        braceCount += (innerLine.match(/\{/g) || []).length - (innerLine.match(/\}/g) || []).length;
        blockContent += '\n    ' + innerLine;
        i++;
      }

      const isFragment = /^\s*(?:alt|loop|opt|par|break|critical)\b/.test(trimmed);
      if (isFragment) {
        relationLines.push(blockContent);
      } else {
        headerLines.push(blockContent);
      }
    } else if (entityDeclRx.test(line) || packageRx.test(line)) {
      headerLines.push('  ' + trimmed);
      i++;
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

export function sequenceToCollaborationSource(diagram: IOMDiagram): string {
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
