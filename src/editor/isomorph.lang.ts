// ============================================================
// Isomorph CodeMirror 6 Language Support
// ============================================================
// Provides syntax highlighting using a simple token-based
// highlighter (no Lezer grammar — avoids the Lezer generator
// toolchain requirement).
// ============================================================

import { StreamLanguage } from '@codemirror/language';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

/**
 * Isomorph DSL stream language definition for CodeMirror 6.
 * Uses the StreamLanguage adapter from @codemirror/language.
 */
export const isomorphLanguage = StreamLanguage.define({
  name: 'isomorph',
  token(stream) {
    // Whitespace
    if (stream.eatSpace()) return null;

    // Comments
    if (stream.match('//')) { stream.skipToEnd(); return 'comment'; }
    if (stream.match('/*')) {
      while (!stream.eol()) {
        if (stream.match('*/')) break;
        stream.next();
      }
      return 'comment';
    }

    // String literals
    if (stream.match('"')) {
      while (!stream.eol() && !stream.match('"', true)) {
        if (stream.peek() === '\\') stream.next();
        stream.next();
      }
      return 'string';
    }

    // Numbers
    if (stream.match(/^-?[0-9]+(\.[0-9]+)?/)) return 'number';

    // Color literals  #RRGGBB
    if (stream.match(/^#[0-9a-fA-F]{6}\b/)) return 'atom';

    // Relation operators (longest match first)
    if (stream.match(/^(--|>|\.\.(\|>|>)|<\|--|<\|\.\.|\*--|o--|<\.\.)/)) return 'operator';
    if (stream.match(/^(-->|--o|--\*|--x|--)/)) return 'operator';
    if (stream.match(/^(<<|>>)/)) return 'meta';

    // Keywords
    const keywords = [
      'diagram','class','interface','enum','abstract','package','import',
      'note','style','on','extends','implements','at','static','final',
      'void','for','actor','usecase','component','node','sequence',
      'flow','deployment','list','map','set','optional',
    ];
    const typeKeywords = ['int','float','bool','string'];
    const word = stream.match(/^[a-zA-Z_][a-zA-Z0-9_]*/);
    if (word) {
      const w = typeof word === 'object' ? word[0] : stream.current();
      if (keywords.includes(w)) return 'keyword';
      if (typeKeywords.includes(w)) return 'typeName';
      if (/^[A-Z]/.test(w)) return 'typeName'; // UpperCamelCase → type
      return 'variableName';
    }

    // Visibility operators
    if (stream.match(/^[+\-#~]/)) return 'meta';

    // Punctuation
    if (stream.match(/^[@:,;.(){}\[\]<>=|]/)) return 'punctuation';

    stream.next();
    return null;
  },
});

/** Isomorph syntax highlighting theme */
export const isomorphHighlightStyle = HighlightStyle.define([
  { tag: t.keyword,       color: '#0550ae', fontWeight: 'bold' },
  { tag: t.typeName,      color: '#8250df' },
  { tag: t.variableName,  color: '#1a1a1a' },
  { tag: t.string,        color: '#0a3069' },
  { tag: t.number,        color: '#116329' },
  { tag: t.comment,       color: '#6e7781', fontStyle: 'italic' },
  { tag: t.operator,      color: '#cf222e', fontWeight: 'bold' },
  { tag: t.meta,          color: '#953800' },
  { tag: t.atom,          color: '#116329' },
  { tag: t.punctuation,   color: '#555555' },
]);

export const isomorphSyntax = syntaxHighlighting(isomorphHighlightStyle);
