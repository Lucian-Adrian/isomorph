// ============================================================
// IsomorphEditor — CodeMirror 6 React Component
// ============================================================

import { useEffect, useRef, useMemo } from 'react';
import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, drawSelection, dropCursor, highlightSpecialChars } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { indentOnInput, bracketMatching, foldGutter, syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { closeBrackets, autocompletion, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import { lintKeymap } from '@codemirror/lint';
import { isomorphLanguage, isomorphSyntax } from './isomorph.lang.js';
import type { ParseError } from '../parser/index.js';

interface IsomorphEditorProps {
  value: string;
  onChange: (value: string) => void;
  errors?: ParseError[];
  readOnly?: boolean;
}

/** Compartment for toggling read-only mode at runtime */
const readOnlyCompartment = new Compartment();

export function IsomorphEditor({ value, onChange, errors = [], readOnly = false }: IsomorphEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef      = useRef<EditorView | null>(null);
  const onChangeRef  = useRef(onChange);
  onChangeRef.current = onChange;

  // Suppress unused-prop warning — errors prop reserved for future lint gutter
  void errors;

  const updateListener = useMemo(
    () =>
      EditorView.updateListener.of(update => {
        if (update.docChanged) {
          onChangeRef.current(update.state.doc.toString());
        }
      }),
    [],
  );

  // Initial editor setup
  useEffect(() => {
    if (!containerRef.current) return;

    const startState = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        history(),
        foldGutter(),
        drawSelection(),
        dropCursor(),
        EditorState.allowMultipleSelections.of(true),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        autocompletion({
          override: [isomorphCompletions],
        }),
        // Isomorph language + highlighting
        isomorphLanguage,
        isomorphSyntax,
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...historyKeymap,
          ...completionKeymap,
          ...lintKeymap,
        ]),
        readOnlyCompartment.of(EditorState.readOnly.of(readOnly)),
        updateListener,
        EditorView.theme({
          '&': { height: '100%', fontSize: '14px', background: '#0d1117' },
          '.cm-scroller': { fontFamily: '"Cascadia Code","Fira Code","JetBrains Mono","Consolas",monospace', overflow: 'auto' },
          '.cm-content': { minHeight: '200px', caretColor: '#818cf8', padding: '8px 0' },
          '.cm-gutters': { backgroundColor: '#0d1117', borderRight: '1px solid #21262d', color: '#30363d' },
          '.cm-lineNumbers .cm-gutterElement': { color: '#484f58', paddingRight: '12px' },
          '.cm-activeLine': { backgroundColor: 'rgba(99,102,241,0.06)' },
          '.cm-activeLineGutter': { backgroundColor: 'rgba(99,102,241,0.08)', color: '#818cf8' },
          '.cm-selectionBackground, ::selection': { backgroundColor: 'rgba(99,102,241,0.25)' },
          '.cm-cursor': { borderLeftColor: '#818cf8', borderLeftWidth: '2px' },
          '.cm-matchingBracket': { background: 'rgba(99,102,241,0.2)', borderRadius: '2px' },
        }),
      ],
    });

    viewRef.current = new EditorView({
      state: startState,
      parent: containerRef.current,
    });

    return () => {
      viewRef.current?.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external value changes (e.g. from diagram drag)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }
  }, [value]);

  // Sync readOnly toggle
  useEffect(() => {
    viewRef.current?.dispatch({
      effects: readOnlyCompartment.reconfigure(EditorState.readOnly.of(readOnly)),
    });
  }, [readOnly]);

  return (
    <div
      ref={containerRef}
      style={{ height: '100%', overflow: 'hidden', border: '1px solid #d0d7de', borderRadius: '6px' }}
    />
  );
}

// ─── Autocomplete ────────────────────────────────────────────

import type { CompletionContext } from '@codemirror/autocomplete';

const SNIPPET_COMPLETIONS = [
  {
    label: 'diagram',
    type: 'keyword',
    info: 'Declare a new diagram',
    apply: 'diagram Name : class {\n  \n}',
  },
  { label: 'class',     type: 'keyword', detail: 'entity' },
  { label: 'interface', type: 'keyword', detail: 'entity' },
  { label: 'enum',      type: 'keyword', detail: 'entity' },
  { label: 'abstract',  type: 'keyword' },
  { label: 'package',   type: 'keyword', detail: 'namespace' },
  { label: 'import',    type: 'keyword' },
  { label: 'extends',   type: 'keyword' },
  { label: 'implements',type: 'keyword' },
  { label: 'note',      type: 'keyword' },
  { label: 'int',       type: 'type' },
  { label: 'float',     type: 'type' },
  { label: 'bool',      type: 'type' },
  { label: 'string',    type: 'type' },
  { label: 'void',      type: 'type' },
  { label: 'List',      type: 'type' },
  { label: 'Map',       type: 'type' },
  { label: 'Set',       type: 'type' },
];

function isomorphCompletions(context: CompletionContext) {
  const word = context.matchBefore(/\w*/);
  if (!word || (word.from === word.to && !context.explicit)) return null;
  return {
    from: word.from,
    options: SNIPPET_COMPLETIONS,
  };
}
