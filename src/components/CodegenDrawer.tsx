import { CodegenPanel, type CodegenPanelProps } from './CodegenPanel.js';

export interface CodegenDrawerProps extends CodegenPanelProps {
  open: boolean;
  onClose: () => void;
}

export function CodegenDrawer({ open, onClose, ...props }: CodegenDrawerProps) {
  if (!open) return null;
  return (
    <div className="iso-workspace-overlay" role="presentation" onMouseDown={onClose}>
      <section className="iso-workspace-modal" role="dialog" aria-modal="true" aria-label="Generated code" onMouseDown={event => event.stopPropagation()}>
        <div className="iso-workspace-modal-header">
          <strong>Generated Code</strong>
          <button type="button" className="iso-icon-button" onClick={onClose} aria-label="Close generated code">x</button>
        </div>
        <div className="iso-workspace-modal-body">
          <CodegenPanel {...props} />
        </div>
      </section>
    </div>
  );
}
