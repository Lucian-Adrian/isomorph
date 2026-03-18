const fs = require('fs');

const ENTITY_KINDS_RX = '(?:class|interface|enum|actor|usecase|component|node|participant|partition|decision|merge|fork|join|start|stop|action|state|composite|concurrent|choice|history|device|artifact|environment|boundary|system|multiobject|active_object|collaboration|composite_object)';

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findEntityBounds(source, entityName) {
  const sigRx = new RegExp(`^\\s*(?:abstract\\s+|static\\s+|final\\s+)*${ENTITY_KINDS_RX}\\s+${escapeRegex(entityName)}\\b`, 'm');
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
    searchStart = lineEndIndex + braceMatch.index + braceMatch[0].length;
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

const src = `diagram NewClassDiagram : class {

  class Class1 {
    // head

    // body

    // footer
  }
  @Class1 at (213, 120)
}`;

console.log('Bounds:', findEntityBounds(src, 'Class1'));

function extractEntityBody(source, entityName) {
  const bounds = findEntityBounds(source, entityName);
  if (!bounds || bounds.bodyStart === -1) return null;
  return source.slice(bounds.bodyStart, bounds.bodyEnd).replace(/^\n/, '').replace(/\n\s*$/, '');
}
console.log('Extract body:', extractEntityBody(src, 'Class1'));

