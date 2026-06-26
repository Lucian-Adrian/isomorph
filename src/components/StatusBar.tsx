// ============================================================
// Isomorph — Status Bar Component
// ============================================================
// Renders the bottom information bar of the IDE shell.
// Extracted from App.tsx during demonolith decomposition.
// ============================================================

import type { IOMDiagram } from '../semantics/iom.js';

interface StatusBarProps {
  source: string;
  activeDiagram: IOMDiagram | null;
  t: (key: string, vars?: any) => string;
}

export function StatusBar({ source, activeDiagram, t }: StatusBarProps) {
  const lineCount = source.split('\n').length;

  return (
    <footer className="iso-statusbar">
      <span className="iso-statusbar-item">{t('ui.isomorph_dsl')}</span>
      <span className="iso-statusbar-sep">·</span>
      <span className="iso-statusbar-item" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {t(lineCount === 1 ? 'status.line' : 'status.lines', { count: lineCount })}
      </span>
      {activeDiagram && (
        <>
          <span className="iso-statusbar-sep">·</span>
          <span className="iso-statusbar-item" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {t(activeDiagram.entities.size === 1 ? 'status.entity' : 'status.entities', {
              count: activeDiagram.entities.size,
            })}
          </span>
          <span className="iso-statusbar-sep">·</span>
          <span className="iso-statusbar-item" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {t(activeDiagram.relations.length === 1 ? 'status.relation' : 'status.relations', {
              count: activeDiagram.relations.length,
            })}
          </span>
          <span className="iso-statusbar-sep">·</span>
          <span className="iso-statusbar-item">{activeDiagram.kind}</span>
        </>
      )}
    </footer>
  );
}
