import { IconCode } from './Icons.js';
import type { CodegenLanguage } from '../codegen/index.js';

export interface CodeDownloadPayload {
  language: CodegenLanguage;
  output: string;
  diagramName?: string;
}

export interface CodegenPanelProps {
  language: CodegenLanguage;
  output: string;
  inspectorJson: string;
  diagramName?: string;
  canGenerate?: boolean;
  isGenerating?: boolean;
  statusMessage?: string;
  onLanguageChange: (language: CodegenLanguage) => void;
  onGenerate: () => void;
  onCopyCode: (output: string) => void;
  onDownloadCode: (payload: CodeDownloadPayload) => void;
  onCopyInspectorJson: (json: string) => void;
  onDownloadBundle?: () => void;
}

const LANGUAGE_LABELS: Record<CodegenLanguage, string> = {
  python: 'Python',
  java: 'Java',
};

export function CodegenPanel({
  language,
  output,
  inspectorJson,
  diagramName,
  canGenerate = true,
  isGenerating = false,
  statusMessage,
  onLanguageChange,
  onGenerate,
  onCopyCode,
  onDownloadCode,
  onCopyInspectorJson,
  onDownloadBundle,
}: CodegenPanelProps) {
  const hasOutput = output.trim().length > 0;
  const hasInspectorJson = inspectorJson.trim().length > 0;

  return (
    <section className="iso-sidebar" style={{ borderTop: '1px solid var(--iso-divider)' }} aria-label="Codegen">
      <div className="iso-panel-header" style={{ borderBottom: '1px solid var(--iso-divider)', padding: '0 12px' }}>
        <IconCode size={11} /> Codegen
      </div>
      <div className="iso-sidebar-body" style={{ gap: 8 }}>
        <label className="iso-panel-info" htmlFor="isomorph-codegen-language" style={{ marginLeft: 0 }}>
          Language
        </label>
        <select
          id="isomorph-codegen-language"
          className="iso-select"
          value={language}
          onChange={event => onLanguageChange(event.target.value as CodegenLanguage)}
          disabled={isGenerating}
        >
          {Object.entries(LANGUAGE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        <button type="button" className="iso-btn iso-btn--primary" onClick={onGenerate} disabled={!canGenerate || isGenerating}>
          {isGenerating ? 'Generating...' : 'Generate'}
        </button>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <button type="button" className="iso-btn" onClick={() => onCopyCode(output)} disabled={!hasOutput}>
            Copy code
          </button>
          <button
            type="button"
            className="iso-btn"
            disabled={!hasOutput}
            onClick={() => onDownloadCode({ language, output, diagramName })}
          >
            Download
          </button>
        </div>

        {onDownloadBundle && (
          <button type="button" className="iso-btn" onClick={onDownloadBundle} disabled={!hasOutput}>
            Bundle
          </button>
        )}

        <textarea
          className="iso-select"
          value={output}
          readOnly
          rows={8}
          aria-label="Generated code"
          placeholder="Generated code appears here"
          style={{ fontFamily: 'monospace', resize: 'vertical', minHeight: 144, lineHeight: 1.4 }}
        />

        <button type="button" className="iso-btn" onClick={() => onCopyInspectorJson(inspectorJson)} disabled={!hasInspectorJson}>
          Copy AST/IOM JSON
        </button>

        {statusMessage && <div className="iso-panel-info" style={{ marginLeft: 0 }}>{statusMessage}</div>}
      </div>
    </section>
  );
}
