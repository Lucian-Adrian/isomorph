// ============================================================
// Isomorph — Main Application Component
// ============================================================

import { useState, useCallback, useMemo } from 'react';
import { IsomorphEditor } from './editor/IsomorphEditor.js';
import { DiagramView } from './components/DiagramView.js';
import { SplitPane } from './components/SplitPane.js';
import { parse } from './parser/index.js';
import { analyze } from './semantics/analyzer.js';
import type { IOMDiagram } from './semantics/iom.js';
import type { ParseError } from './parser/index.js';

const DEFAULT_SOURCE = `// ─────────────────────────────────────────────
// Isomorph DSL — Library System Example
// Edit the code; the diagram updates live!
// ─────────────────────────────────────────────

diagram LibrarySystem : class {

  package domain {

    abstract class Book <<Entity>> implements Borrowable {
      + title: string
      + isbn: string
      - stock: int = 0
      + checkOut(user: string): bool
      + getTitle(): string
    }

    class Library {
      + name: string
      + addBook(book: Book): void
      + search(query: string): List<Book>
    }

    interface Borrowable {
      + borrow(user: string): void
      + return(): void
    }

    enum BookStatus {
      AVAILABLE
      CHECKED_OUT
      RESERVED
    }

  }

  Library --* Book [label="contains", toMult="1..*"]
  Book ..|> Borrowable

  @Book at (100, 130)
  @Library at (400, 130)
  @Borrowable at (100, 360)
  @BookStatus at (400, 360)

}
`;

export default function App() {
  const [source, setSource] = useState(DEFAULT_SOURCE);
  const [activeDiagramIdx, setActiveDiagramIdx] = useState(0);

  // ── Parse + analyze on every keystroke ──────────────────────

  const parseResult = useMemo(() => {
    try {
      return parse(source);
    } catch {
      return null;
    }
  }, [source]);

  const analysisResult = useMemo(() => {
    if (!parseResult) return null;
    try {
      return analyze(parseResult.program);
    } catch {
      return null;
    }
  }, [parseResult]);

  const errors: ParseError[] = parseResult?.errors ?? [];
  const diagrams: IOMDiagram[] = analysisResult?.iom.diagrams ?? [];
  const activeDiagram = diagrams[activeDiagramIdx] ?? null;

  // ── Bidirectional: diagram drag → update @Entity at annotations ──

  const handleEntityMove = useCallback((name: string, x: number, y: number) => {
    // Update or insert @Name at (x, y) annotation in source
    const annotationRegex = new RegExp(`@${name}\\s+at\\s+\\([^)]+\\)`, 'g');
    const newAnnotation = `@${name} at (${x}, ${y})`;

    if (annotationRegex.test(source)) {
      setSource(s => s.replace(new RegExp(`@${name}\\s+at\\s+\\([^)]+\\)`, 'g'), newAnnotation));
    } else {
      // Append before closing } of the diagram
      setSource(s => {
        const lastBrace = s.lastIndexOf('}');
        return s.slice(0, lastBrace) + `  ${newAnnotation}\n` + s.slice(lastBrace);
      });
    }
  }, [source]);

  // ── Error count badge ────────────────────────────────────────

  const errorCount = errors.length + (analysisResult?.errors.length ?? 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f6f8fa' }}>
      {/* Header */}
      <header style={{
        height: 52,
        background: '#24292f',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        gap: 16,
        flexShrink: 0,
        boxShadow: '0 1px 0 #444c56',
      }}>
        <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.5px', fontFamily: 'sans-serif' }}>
          Isomorph
        </span>
        <span style={{ color: '#8b949e', fontSize: 12, fontFamily: 'sans-serif' }}>
          Bidirectional DSL Diagramming
        </span>

        {/* Diagram tabs */}
        {diagrams.length > 1 && (
          <div style={{ display: 'flex', gap: 6, marginLeft: 16 }}>
            {diagrams.map((d, i) => (
              <button
                key={d.name}
                onClick={() => setActiveDiagramIdx(i)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 4,
                  border: 'none',
                  cursor: 'pointer',
                  background: i === activeDiagramIdx ? '#388bfd' : '#444c56',
                  color: 'white',
                  fontSize: 12,
                  fontFamily: 'sans-serif',
                }}
              >
                {d.name} : {d.kind}
              </button>
            ))}
          </div>
        )}

        {/* Error badge */}
        {errorCount > 0 && (
          <div style={{
            marginLeft: 'auto',
            background: '#da3633',
            color: 'white',
            borderRadius: 12,
            padding: '2px 10px',
            fontSize: 12,
            fontFamily: 'sans-serif',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <span>⚠</span>
            {errorCount} {errorCount === 1 ? 'error' : 'errors'}
          </div>
        )}

        {errorCount === 0 && diagrams.length > 0 && (
          <div style={{
            marginLeft: 'auto',
            background: '#238636',
            color: 'white',
            borderRadius: 12,
            padding: '2px 10px',
            fontSize: 12,
            fontFamily: 'sans-serif',
          }}>
            ✓ Valid
          </div>
        )}
      </header>

      {/* Main split pane */}
      <div style={{ flex: 1, overflow: 'hidden', padding: 12 }}>
        <SplitPane
          left={
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 11, color: '#57606a', fontFamily: 'sans-serif', padding: '2px 4px' }}>
                ISOMORPH SOURCE&nbsp;
                {errors.length > 0 && <span style={{ color: '#cf222e' }}>— {errors.length} parse error{errors.length > 1 ? 's' : ''}</span>}
              </div>
              <div style={{ flex: 1 }}>
                <IsomorphEditor
                  value={source}
                  onChange={setSource}
                  errors={errors}
                />
              </div>
            </div>
          }
          right={
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 11, color: '#57606a', fontFamily: 'sans-serif', padding: '2px 4px' }}>
                DIAGRAM CANVAS&nbsp;
                {activeDiagram && (
                  <span style={{ color: '#0550ae' }}>
                    — {activeDiagram.name} : {activeDiagram.kind}
                    &nbsp;({activeDiagram.entities.size} entities, {activeDiagram.relations.length} relations)
                  </span>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <DiagramView
                  diagram={activeDiagram}
                  onEntityMove={handleEntityMove}
                />
              </div>
            </div>
          }
        />
      </div>

      {/* Status bar */}
      <footer style={{
        height: 26,
        background: '#0550ae',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        fontSize: 11,
        fontFamily: 'monospace',
        gap: 16,
        flexShrink: 0,
      }}>
        <span>Isomorph DSL v0.1.0</span>
        <span>·</span>
        <span>{source.split('\n').length} lines</span>
        {activeDiagram && <>
          <span>·</span>
          <span>{activeDiagram.entities.size} entities</span>
          <span>·</span>
          <span>{activeDiagram.relations.length} relations</span>
        </>}
        <span style={{ marginLeft: 'auto' }}>Team 02 · FAF-241</span>
      </footer>
    </div>
  );
}
