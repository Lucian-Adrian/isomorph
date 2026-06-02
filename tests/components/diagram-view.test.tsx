import React, { act, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { DiagramView } from '../../src/components/DiagramView.js';
import { parse } from '../../src/parser/index.js';
import { analyze } from '../../src/semantics/analyzer.js';
import type { IOMDiagram } from '../../src/semantics/iom.js';

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

function diagramFixture(): IOMDiagram {
  const parsed = parse(`diagram QaHarness : class {
  class Gateway
  class Service
  Gateway --> Service
}`);
  if (parsed.errors.length > 0) throw new Error(parsed.errors[0].message);
  const analyzed = analyze(parsed.program);
  const diagram = analyzed.iom.diagrams[0];
  if (!diagram) throw new Error('Expected fixture diagram');
  return diagram;
}

function cloneDiagram(diagram: IOMDiagram): IOMDiagram {
  return {
    ...diagram,
    entities: new Map(diagram.entities),
    relations: [...diagram.relations],
    packages: [...diagram.packages],
    partitions: [...diagram.partitions],
    fragments: [...diagram.fragments],
  };
}

describe('DiagramView render telemetry', () => {
  it('does not report unchanged rendered SVG again when telemetry causes a parent rerender', () => {
    const onRender = vi.fn();
    const baseDiagram = diagramFixture();

    function Harness() {
      const [rerenders, setRerenders] = useState(0);
      const diagram = useMemo(() => cloneDiagram(baseDiagram), [rerenders]);
      return (
        <DiagramView
          diagram={diagram}
          showToolRail={false}
          showZoomControls={false}
          onRender={(stats) => {
            onRender(stats);
            if (rerenders < 3) setRerenders(count => count + 1);
          }}
        />
      );
    }

    const { cleanup } = render(<Harness />);

    expect(onRender).toHaveBeenCalledTimes(1);
    cleanup();
  });
});
