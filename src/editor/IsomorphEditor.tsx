// ============================================================
// IsomorphEditor — CodeMirror 6 React Component
// ============================================================

import { useEffect, useRef, useMemo } from 'react';
import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, drawSelection, dropCursor, highlightSpecialChars } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { indentOnInput, bracketMatching, foldGutter, syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { closeBrackets, autocompletion, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import { lintKeymap, lintGutter, setDiagnostics } from '@codemirror/lint';
import type { Diagnostic } from '@codemirror/lint';
import { isomorphLanguage, isomorphSyntax } from './isomorph.lang.js';

/** A single editor diagnostic (parse error or semantic error). */
export interface LintDiagnostic {
  message: string;
  line: number;
  col: number;
  severity?: 'error' | 'warning' | 'info';
}

interface IsomorphEditorProps {
  value: string;
  onChange: (value: string) => void;
  errors?: LintDiagnostic[];
  readOnly?: boolean;
}

/** Compartment for toggling read-only mode at runtime */
const readOnlyCompartment = new Compartment();

export function IsomorphEditor({ value, onChange, errors = [], readOnly = false }: IsomorphEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef      = useRef<EditorView | null>(null);
  const onChangeRef  = useRef(onChange);
  onChangeRef.current = onChange;

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
        // Lint gutter — populated via setDiagnostics in the errors useEffect below
        lintGutter(),
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
          // Lint gutter styling (dark theme)
          '.cm-lintRange-error': { backgroundImage: 'none', borderBottom: '2px wavy #f85149' },
          '.cm-lintRange-warning': { backgroundImage: 'none', borderBottom: '2px wavy #d29922' },
          '.cm-lint-marker-error': { content: '""', color: '#f85149' },
          '.cm-lint-marker-warning': { content: '""', color: '#d29922' },
          '.cm-tooltip-lint': { backgroundColor: '#161b22', border: '1px solid #30363d', borderRadius: '6px', color: '#c9d1d9' },
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

  // Sync parse/semantic errors → CodeMirror lint diagnostics (red squiggles + gutter markers)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const diagnostics: Diagnostic[] = (errors ?? []).flatMap(e => {
      const lineNum = Math.max(1, Math.min(e.line, view.state.doc.lines));
      const line = view.state.doc.line(lineNum);
      const from = line.from + Math.max(0, (e.col ?? 1) - 1);
      const to = Math.min(from + 1, line.to);
      return [{ from, to, severity: (e.severity ?? 'error') as Diagnostic['severity'], message: e.message }];
    });
    view.dispatch(setDiagnostics(view.state, diagnostics));
  }, [errors]);

  return (
    <div
      ref={containerRef}
      style={{ height: '100%', overflow: 'hidden', border: '1px solid #d0d7de', borderRadius: '6px' }}
    />
  );
}

// ─── Autocomplete ────────────────────────────────────────────

import type { CompletionContext, Completion } from '@codemirror/autocomplete';

/**
 * Rich snippet completions with full apply strings for the most commonly-
 * typed Isomorph constructs.  The `apply` field inserts a ready-to-use
 * template so the user only has to fill in names.
 */
const SNIPPET_COMPLETIONS: Completion[] = [
  // ── Diagrams ──────────────────────────────────────────────
  {
    label: 'diagram',
    type: 'keyword',
    detail: 'declaration',
    info: 'Declare a class diagram named MyDiagram',
    apply: 'diagram MyDiagram : class {\n\n  class Entity {\n    + id: string\n  }\n\n}',
    boost: 10,
  },
  // ── Entity declarations ───────────────────────────────────
  {
    label: 'class',
    type: 'keyword',
    detail: 'entity',
    info: 'Declare a class',
    apply: 'class ClassName {\n  + id: string\n  # name: string\n}',
    boost: 8,
  },
  {
    label: 'abstract class',
    type: 'keyword',
    detail: 'entity',
    info: 'Declare an abstract class',
    apply: 'abstract class AbstractName {\n  + operation(): void\n}',
    boost: 7,
  },
  {
    label: 'interface',
    type: 'keyword',
    detail: 'entity',
    info: 'Declare an interface',
    apply: 'interface IName {\n  + method(): void\n}',
    boost: 7,
  },
  {
    label: 'enum',
    type: 'keyword',
    detail: 'entity',
    info: 'Declare an enumeration',
    apply: 'enum EnumName {\n  VALUE_A\n  VALUE_B\n  VALUE_C\n}',
    boost: 6,
  },
  {
    label: 'package',
    type: 'keyword',
    detail: 'namespace',
    info: 'Group entities into a package',
    apply: 'package domain {\n  \n}',
    boost: 5,
  },
  // ── Relation snippets ─────────────────────────────────────
  { label: 'extends',    type: 'keyword', detail: 'inheritance' },
  { label: 'implements', type: 'keyword', detail: 'realization' },
  { label: 'import',     type: 'keyword', detail: 'import path' },
  { label: 'note',       type: 'keyword', detail: 'annotation' },
  // ── Notes / Style ─────────────────────────────────────────
  {
    label: 'note on',
    type: 'keyword',
    detail: 'annotation',
    info: 'Attach a note to an entity',
    apply: 'note on EntityName {\n  "Annotation text"\n}',
  },
  {
    label: 'style',
    type: 'keyword',
    detail: 'visual',
    info: 'Override visual styling for an entity',
    apply: 'style EntityName { color: #4f46e5 bg: #ede9fe }',
  },
  // ── Primitive types ───────────────────────────────────────
  { label: 'int',    type: 'type', detail: 'primitive', boost: 2 },
  { label: 'float',  type: 'type', detail: 'primitive', boost: 2 },
  { label: 'bool',   type: 'type', detail: 'primitive', boost: 2 },
  { label: 'string', type: 'type', detail: 'primitive', boost: 2 },
  { label: 'void',   type: 'type', detail: 'return type', boost: 1 },
  // ── Generic collection types ──────────────────────────────
  { label: 'List',     type: 'type', detail: 'collection', apply: 'List<T>',       boost: 3 },
  { label: 'Map',      type: 'type', detail: 'collection', apply: 'Map<K, V>',     boost: 3 },
  { label: 'Set',      type: 'type', detail: 'collection', apply: 'Set<T>',        boost: 3 },
  { label: 'optional', type: 'type', detail: 'nullable',   apply: 'optional<T>',   boost: 2 },
  // ── Visibility (for member declarations) ─────────────────
  { label: 'static', type: 'keyword', detail: 'modifier' },
  { label: 'final',  type: 'keyword', detail: 'modifier' },
  { label: 'abstract', type: 'keyword', detail: 'modifier' },
  // ── Diagram kinds ─────────────────────────────────────────
  { label: 'usecase',    type: 'keyword', detail: 'diagram kind' },
  { label: 'component',  type: 'keyword', detail: 'diagram kind' },
  { label: 'sequence',   type: 'keyword', detail: 'diagram kind' },
  { label: 'deployment', type: 'keyword', detail: 'diagram kind' },
  { label: 'flow',       type: 'keyword', detail: 'diagram kind' },
  { label: 'actor',      type: 'keyword', detail: 'use-case entity' },
  { label: 'node',       type: 'keyword', detail: 'deployment entity' },
  // ── Relation operators (typed as operator completions) ────
  { label: '--|>',  type: 'operator', detail: 'inheritance',          boost: 4 },
  { label: '..|>',  type: 'operator', detail: 'realization',          boost: 4 },
  { label: '--*',   type: 'operator', detail: 'composition',          boost: 3 },
  { label: '--o',   type: 'operator', detail: 'aggregation',          boost: 3 },
  { label: '-->',   type: 'operator', detail: 'directed association', boost: 3 },
  { label: '--',    type: 'operator', detail: 'association',          boost: 2 },
  { label: '..>',   type: 'operator', detail: 'dependency',           boost: 2 },
];

function isomorphCompletions(context: CompletionContext) {
  const word = context.matchBefore(/[\w<>|.!-]*/);
  if (!word || (word.from === word.to && !context.explicit)) return null;
  return {
    from: word.from,
    options: SNIPPET_COMPLETIONS,
    validFor: /^[\w<>|.!-]*$/,
  };
}
