import { describe, expect, it } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { BottomWorkbench } from '../../src/components/BottomWorkbench.js';
import { TopCommandBar } from '../../src/components/TopCommandBar.js';
import { WorkspaceShell } from '../../src/components/WorkspaceShell.js';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function render(element: React.ReactElement) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(element));
  return {
    host,
    cleanup: () => {
      act(() => root.unmount());
      host.remove();
    },
  };
}

describe('workspace shell components', () => {
  it('renders a compact command bar and floating bottom workbench', () => {
    const { host, cleanup } = render(
      <WorkspaceShell
        topBar={<TopCommandBar title="Isomorph" subtitle="model.isx" actions={<button type="button">Generate</button>} />}
        main={<div>Editor and diagram</div>}
        bottom={<BottomWorkbench metrics={[{ label: 'Lines', value: 42 }, { label: 'Entities', value: 3 }]} />}
      />,
    );

    expect(host.querySelector('.iso-command-bar')).not.toBeNull();
    expect(host.querySelector('.iso-bottom-workbench')).not.toBeNull();
    expect(host.textContent).toContain('Generate');
    expect(host.textContent).toContain('Lines');
    cleanup();
  });

  it('allows the bottom workbench status landmark to be localized', () => {
    const { host, cleanup } = render(
      <BottomWorkbench
        ariaLabel="Starea spațiului de lucru"
        metrics={[{ label: 'Linii', value: 42 }]}
      />,
    );

    expect(host.querySelector('[aria-label="Starea spațiului de lucru"]')).not.toBeNull();
    cleanup();
  });
});
