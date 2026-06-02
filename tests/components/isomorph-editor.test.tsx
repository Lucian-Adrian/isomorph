import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { IsomorphEditor } from '../../src/editor/IsomorphEditor.js';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function render(element: React.ReactElement) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(element));
  return {
    host,
    rerender: (next: React.ReactElement) => act(() => root.render(next)),
    cleanup: () => {
      act(() => root.unmount());
      host.remove();
    },
  };
}

describe('IsomorphEditor', () => {
  it('does not echo external value synchronization through onChange', () => {
    const onChange = vi.fn();
    const view = render(<IsomorphEditor value="class A" onChange={onChange} />);

    onChange.mockClear();
    view.rerender(<IsomorphEditor value="class B" onChange={onChange} />);

    expect(view.host.textContent).toContain('class B');
    expect(onChange).not.toHaveBeenCalled();
    view.cleanup();
  });
});
