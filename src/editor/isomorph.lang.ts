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

/** Isomorph syntax highlighting theme — tuned for the dark (#0d1117) editor */
export const isomorphHighlightStyle = HighlightStyle.define([
  { tag: t.keyword,       color: '#ff7b72', fontWeight: 'bold' },   // GitHub Dark — red/orange keywords
  { tag: t.typeName,      color: '#79c0ff' },                        // light blue entity names
  { tag: t.variableName,  color: '#c9d1d9' },                        // default light foreground
  { tag: t.string,        color: '#a5d6ff' },                        // light blue strings
  { tag: t.number,        color: '#f2cc60' },                        // gold numbers
  { tag: t.comment,       color: '#8b949e', fontStyle: 'italic' },   // muted gray comments
  { tag: t.operator,      color: '#ff7b72', fontWeight: 'bold' },    // red relation operators
  { tag: t.meta,          color: '#ffa657' },                        // orange stereotype brackets / visibility
  { tag: t.atom,          color: '#79c0ff' },                        // light blue color literals
  { tag: t.punctuation,   color: '#8b949e' },                        // muted gray punctuation
]);

export const isomorphSyntax = syntaxHighlighting(isomorphHighlightStyle);
