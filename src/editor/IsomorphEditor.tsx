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
          '&': { height: '100%', fontSize: '13px', background: 'var(--iso-bg-editor)' },
          '.cm-scroller': { fontFamily: '"DM Mono","Cascadia Code","Fira Code","JetBrains Mono",monospace', overflow: 'auto' },
          '.cm-content': { minHeight: '200px', caretColor: 'var(--iso-brand-dark)', padding: '8px 0' },
          '.cm-gutters': { backgroundColor: 'var(--iso-bg-editor)', borderRight: '1px solid var(--iso-divider)', color: 'var(--ink-mid)' },
          '.cm-lineNumbers .cm-gutterElement': { color: 'var(--ink-mid)', paddingRight: '12px' },
          '.cm-activeLine': { backgroundColor: 'var(--iso-bg-hover)' },
          '.cm-activeLineGutter': { backgroundColor: 'var(--iso-bg-hover)', color: 'var(--ink)' },
          '.cm-selectionBackground, ::selection': { backgroundColor: 'rgba(0,0,0,0.08)' },
          '.cm-cursor': { borderLeftColor: 'var(--iso-brand-dark)', borderLeftWidth: '2px' },
          '.cm-matchingBracket': { background: 'var(--stone)', borderRadius: '2px' },
          // Lint gutter styling (light theme)
          '.cm-lintRange-error': { backgroundImage: 'none', borderBottom: '2px wavy var(--iso-error)' },
          '.cm-lintRange-warning': { backgroundImage: 'none', borderBottom: '2px wavy var(--iso-warning)' },
          '.cm-lint-marker-error': { content: '""', color: 'var(--iso-error)' },
          '.cm-lint-marker-warning': { content: '""', color: 'var(--iso-warning)' },
          '.cm-tooltip-lint': { backgroundColor: 'var(--white)', border: '1px solid var(--iso-border-strong)', borderRadius: '6px', color: 'var(--ink)', boxShadow: 'var(--iso-shadow)' },
          // Autocomplete styling
          '.cm-tooltip-autocomplete': {
            backgroundColor: 'var(--white)',
            border: '1px solid var(--iso-border-strong)',
            borderRadius: '6px',
            color: 'var(--ink)',
            boxShadow: 'var(--iso-shadow)',
          },
          '.cm-tooltip-autocomplete > ul > li': {
            color: 'var(--ink)',
          },
          '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
            backgroundColor: 'var(--iso-brand)',
            color: 'var(--white)',
          },
          '.cm-completionLabel': { color: 'var(--ink)' },
          '.cm-completionMatchedText': { textDecoration: 'underline', color: 'var(--iso-brand-dark)' },
          '.cm-completionDetail': { color: 'var(--ink-mid)', fontStyle: 'italic', marginLeft: '8px' },
          '.cm-completionInfo': { padding: '4px 8px', fontStyle: 'italic', color: 'var(--ink-mid)' },
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

type IsomorphCompletion = Completion & { contexts?: string[] };

/**
 * Rich snippet completions with full apply strings for the most commonly-
 * typed Isomorph constructs.  The `apply` field inserts a ready-to-use
 * template so the user only has to fill in names.
 */
const SNIPPET_COMPLETIONS: IsomorphCompletion[] = [
  // ── Diagrams ──────────────────────────────────────────────
  {
    label: 'diagram',
    type: 'keyword',
    detail: 'declaration',
    info: 'Declare a diagram',
    apply: 'diagram MyDiagram : class {\n\n  class Entity {\n    + id: string\n  }\n\n}',
    boost: 10,
    contexts: ['global', 'class', 'usecase', 'component', 'sequence', 'deployment', 'flow'],
  },
  // ── Entity declarations ───────────────────────────────────
  {
    label: 'class',
    type: 'keyword',
    detail: 'entity',
    info: 'Declare a class',
    apply: 'class ClassName {\n  + id: string\n  # name: string\n}',
    boost: 8,
    contexts: ['class'],
  },
  {
    label: 'abstract class',
    type: 'keyword',
    detail: 'entity',
    info: 'Declare an abstract class',
    apply: 'abstract class AbstractName {\n  + operation(): void\n}',
    boost: 7,
    contexts: ['class'],
  },
  {
    label: 'interface',
    type: 'keyword',
    detail: 'entity',
    info: 'Declare an interface',
    apply: 'interface IName {\n  + method(): void\n}',
    boost: 7,
    contexts: ['class', 'component', 'deployment'],
  },
  {
    label: 'enum',
    type: 'keyword',
    detail: 'entity',
    info: 'Declare an enumeration',
    apply: 'enum EnumName {\n  VALUE_A\n  VALUE_B\n  VALUE_C\n}',
    boost: 6,
    contexts: ['class'],
  },
  {
    label: 'package',
    type: 'keyword',
    detail: 'namespace',
    info: 'Group entities into a package',
    apply: 'package domain {\n  \n}',
    boost: 5,
    contexts: ['class', 'usecase', 'component'],
  },
  // ── Relation snippets ─────────────────────────────────────
  { label: 'extends',    type: 'keyword', detail: 'inheritance', contexts: ['class', 'usecase', 'component'] },
  { label: 'implements', type: 'keyword', detail: 'realization', contexts: ['class', 'component'] },
  { label: 'import',     type: 'keyword', detail: 'import path', contexts: ['class', 'usecase', 'component', 'deployment', 'sequence', 'flow'] },
  { label: 'note',       type: 'keyword', detail: 'annotation' }, // applies to all
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
  { label: 'int',    type: 'type', detail: 'primitive', boost: 2, contexts: ['class'] },
  { label: 'float',  type: 'type', detail: 'primitive', boost: 2, contexts: ['class'] },
  { label: 'bool',   type: 'type', detail: 'primitive', boost: 2, contexts: ['class'] },
  { label: 'string', type: 'type', detail: 'primitive', boost: 2, contexts: ['class'] },
  { label: 'void',   type: 'type', detail: 'return type', boost: 1, contexts: ['class'] },
  // ── Generic collection types ──────────────────────────────
  { label: 'List',     type: 'type', detail: 'collection', apply: 'List<T>',       boost: 3, contexts: ['class'] },
  { label: 'Map',      type: 'type', detail: 'collection', apply: 'Map<K, V>',     boost: 3, contexts: ['class'] },
  { label: 'Set',      type: 'type', detail: 'collection', apply: 'Set<T>',        boost: 3, contexts: ['class'] },
  { label: 'optional', type: 'type', detail: 'nullable',   apply: 'optional<T>',   boost: 2, contexts: ['class'] },
  // ── Visibility (for member declarations) ─────────────────
  { label: 'static', type: 'keyword', detail: 'modifier', contexts: ['class'] },
  { label: 'final',  type: 'keyword', detail: 'modifier', contexts: ['class'] },
  { label: 'abstract', type: 'keyword', detail: 'modifier', contexts: ['class'] },
  // ── Entities for specific diagrams ────────────────────────
  { label: 'usecase',    type: 'keyword', detail: 'use-case entity', contexts: ['usecase'] },
  { label: 'actor',      type: 'keyword', detail: 'use-case entity', contexts: ['usecase'] },
  { label: 'component',  type: 'keyword', detail: 'component entity', contexts: ['component', 'deployment'] },
  { label: 'node',       type: 'keyword', detail: 'deployment entity', contexts: ['deployment'] },
  
  // ── Diagram kinds ───────────────────────────────────────── (used inside 'diagram X : <kind>')
  { label: 'usecase',    type: 'keyword', detail: 'diagram kind', contexts: ['global'] },
  { label: 'component',  type: 'keyword', detail: 'diagram kind', contexts: ['global'] },
  { label: 'sequence',   type: 'keyword', detail: 'diagram kind', contexts: ['global'] },
  { label: 'deployment', type: 'keyword', detail: 'diagram kind', contexts: ['global'] },
  { label: 'flow',       type: 'keyword', detail: 'diagram kind', contexts: ['global'] },
  { label: 'class',      type: 'keyword', detail: 'diagram kind', contexts: ['global'] },
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

  // Retrieve document text up to the cursor
  const docToCursor = context.state.sliceDoc(0, context.pos);
  
  // Match "diagram <Name> : <type>" patterns
  const diagramMatches = [...docToCursor.matchAll(/diagram\s+\w+\s*:\s*(\w+)/g)];
  let currentDiagramType = 'global'; // default to global context
  
  if (diagramMatches.length > 0) {
    // Determine diagram type from the most recent declaration before cursor
    currentDiagramType = diagramMatches[diagramMatches.length - 1][1].toLowerCase();
  }

  // Determine if cursor is right after "diagram MyName :" or "diagram MyName: "
  const isDeclaringKind = /diagram\s+\w+\s*:\s*[\w]*$/.test(docToCursor);

  // Filter completions based on context
  const filteredOptions = SNIPPET_COMPLETIONS.filter(snippet => {
    // If declaring a diagram kind, ONLY show diagram kinds
    if (isDeclaringKind) {
      return snippet.detail === 'diagram kind';
    }

    // Unrestricted snippets appear everywhere (except when declaring a diagram kind)
    if (!snippet.contexts || snippet.contexts.length === 0) {
      return true;
    }

    // Show snippets that match the current diagram type
    return snippet.contexts.includes(currentDiagramType);
  });

  return {
    from: word.from,
    options: filteredOptions,
    validFor: /^[\w<>|.!-]*$/,
  };
}
