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
  { tag: t.keyword,       color: 'var(--syn-kw)', fontWeight: '500' },
  { tag: t.typeName,      color: 'var(--syn-type)', fontWeight: '500' },
  { tag: t.variableName,  color: 'var(--syn-var)' },
  { tag: t.string,        color: 'var(--syn-str)' },
  { tag: t.number,        color: 'var(--syn-num)' },
  { tag: t.comment,       color: 'var(--syn-comment)', fontStyle: 'italic' },
  { tag: t.operator,      color: 'var(--syn-op)', fontWeight: '500' },
  { tag: t.meta,          color: 'var(--syn-meta)' },
  { tag: t.atom,          color: 'var(--syn-atom)' },
  { tag: t.punctuation,   color: 'var(--syn-punct)' },
]);

export const isomorphSyntax = syntaxHighlighting(isomorphHighlightStyle);
