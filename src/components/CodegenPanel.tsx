import { IconCode } from './Icons.js';
import type { CodegenLanguage } from '../codegen/index.js';
import { tText, type Language } from '../i18n.js';

export interface CodeDownloadPayload {
  language: CodegenLanguage;
  output: string;
  diagramName?: string;
}

export interface CodegenPanelProps {
  language: CodegenLanguage;
  uiLanguage?: Language;
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
  uiLanguage = 'en',
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
  const t = (key: string) => tText(uiLanguage, key);
  const generateLabel = isGenerating
    ? t('codegen.generating')
    : canGenerate
      ? t('codegen.generate')
      : t('ui.unavailable');

  return (
    <section className="iso-sidebar" style={{ borderTop: '1px solid var(--iso-divider)' }} aria-label={t('codegen.title')}>
      <div className="iso-panel-header" style={{ borderBottom: '1px solid var(--iso-divider)', padding: '0 12px' }}>
        <IconCode size={11} /> {t('codegen.title')}
      </div>
      <div className="iso-sidebar-body" style={{ gap: 8 }}>
        <label className="iso-panel-info" htmlFor="isomorph-codegen-language" style={{ marginLeft: 0 }}>
          {t('codegen.language')}
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
          {generateLabel}
        </button>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <button type="button" className="iso-btn" onClick={() => onCopyCode(output)} disabled={!hasOutput}>
            {t('codegen.copy_code')}
          </button>
          <button
            type="button"
            className="iso-btn"
            disabled={!hasOutput}
            onClick={() => onDownloadCode({ language, output, diagramName })}
          >
            {t('codegen.download')}
          </button>
        </div>

        {onDownloadBundle && (
          <button type="button" className="iso-btn" onClick={onDownloadBundle} disabled={!hasOutput}>
            {t('codegen.bundle')}
          </button>
        )}

        {statusMessage ? (
          <div className="iso-status iso-status--err" style={{ borderRadius: 8, padding: '10px 12px', whiteSpace: 'normal', lineHeight: 1.4 }}>
            {statusMessage}
          </div>
        ) : null}

        <textarea
          className="iso-select"
          value={output}
          readOnly
          rows={8}
          aria-label={t('codegen.generated_code')}
          placeholder={statusMessage ? t('codegen.unsupported_placeholder') : t('codegen.placeholder')}
          style={{ 
            fontFamily: 'monospace', 
            resize: 'vertical', 
            minHeight: 144, 
            lineHeight: 1.4,
            opacity: statusMessage ? 0.5 : 1
          }}
        />

        <button type="button" className="iso-btn" onClick={() => onCopyInspectorJson(inspectorJson)} disabled={!hasInspectorJson}>
          {t('codegen.copy_iom')}
        </button>
      </div>
    </section>
  );
}
