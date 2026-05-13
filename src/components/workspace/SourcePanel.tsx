import { IsomorphEditor, type LintDiagnostic } from '../../editor/IsomorphEditor.js';
import { IconCode } from '../Icons.js';

interface SourcePanelProps {
  title: string;
  value: string;
  diagnostics: LintDiagnostic[];
  statusText: string;
  lineCountText: string;
  onChange: (value: string) => void;
}

export function SourcePanel({
  title,
  value,
  diagnostics,
  statusText,
  lineCountText,
  onChange,
}: SourcePanelProps) {
  return (
    <section className="iso-panel iso-workspace-pane">
      <div className="iso-panel-header">
        <IconCode size={11} />
        {title}
        <span className="iso-panel-info" aria-live="polite">
          {statusText}
        </span>
        <span className="iso-panel-spacer" />
        <span className="iso-pane-metric">
          {lineCountText}
        </span>
      </div>
      <div className="iso-panel-body">
        <IsomorphEditor value={value} onChange={onChange} errors={diagnostics} />
      </div>
    </section>
  );
}
