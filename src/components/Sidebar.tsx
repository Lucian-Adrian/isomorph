// ============================================================
// Isomorph — Shape Sidebar Component
// ============================================================
// Renders the draggable shape stencil list.
// Extracted from App.tsx during demonolith decomposition.
// ============================================================

import type { IOMDiagram } from '../semantics/iom.js';
import type { WorkspaceTab } from '../types/index.js';
import { getStencilsForKind } from '../utils/stencils.js';
import { ENTITY_KINDS_RX } from '../constants.js';
import { IconShapes } from './Icons.js';

interface SidebarProps {
  activeDiagram: IOMDiagram | null;
  activeTab: WorkspaceTab | null;
  t: (key: string, vars?: any) => string;
}

export function Sidebar({ activeDiagram, activeTab, t }: SidebarProps) {
  if (!activeDiagram) {
    return null;
  }

  const stencils = getStencilsForKind(activeDiagram.kind);
  if (stencils.length === 0) {
    return null;
  }

  return (
    <div className="iso-sidebar">
      <div
        className="iso-panel-header"
        style={{ borderBottom: '1px solid var(--iso-divider)', padding: '0 12px' }}
      >
        <IconShapes size={11} /> {t('ui.shapes')}
      </div>
      <div className="iso-sidebar-body">
        {stencils.map((stencil) => (
          <div
            key={stencil.label}
            draggable
            onDragStart={(e) => {
              const baseName = stencil.keyword.split(' ')[0];
              const prefixName = baseName.charAt(0).toUpperCase() + baseName.slice(1);

              let index = 1;
              let name = `${prefixName}${index}`;
              const src = activeTab?.source || '';
              while (new RegExp(`${ENTITY_KINDS_RX}[ \\t]+${name}\\b`).test(src)) {
                index++;
                name = `${prefixName}${index}`;
              }

              let expandedCode = stencil.keyword;
              const BRACE_KINDS = [
                'class',
                'interface',
                'component',
                'node',
                'state',
                'usecase',
                'package',
                'composite',
                'concurrent',
                'environment',
                'artifact',
                'device',
                'enum',
                'note',
              ];
              const FRAGMENT_KINDS = ['alt', 'loop', 'opt', 'par', 'break', 'critical'];

              if (BRACE_KINDS.includes(baseName)) {
                expandedCode = `${stencil.keyword} ${name} {\n\n}`;
              } else if (FRAGMENT_KINDS.includes(baseName)) {
                if (baseName === 'alt') {
                  expandedCode = `${stencil.keyword} ${name} {\n\n} else {\n\n}`;
                } else {
                  expandedCode = `${stencil.keyword} ${name} {\n\n}`;
                }
              } else if (['start', 'stop', 'fork', 'join', 'decision', 'merge'].includes(baseName)) {
                expandedCode = `${stencil.keyword} ${name}`;
              } else if (baseName === 'action') {
                expandedCode = `action ${name}`;
              } else {
                expandedCode = `${stencil.keyword} ${name}`;
              }

              e.dataTransfer.setData('text/plain', expandedCode);
              e.dataTransfer.setData('application/x-isomorph-stencil', stencil.keyword);
              e.dataTransfer.effectAllowed = 'copy';
            }}
            className="iso-stencil"
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: '12px',
              padding: '10px 12px',
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            {stencil.icon && (
              <div style={{ color: 'var(--iso-text)', display: 'flex' }}>{stencil.icon}</div>
            )}
            <div style={{ fontSize: '12px', fontWeight: 500 }}>{stencil.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
