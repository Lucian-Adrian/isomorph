import { IconDiagram } from './Icons.js';
import { tText, type Language } from '../i18n.js';

export interface ReportMetrics {
  compileLatencyMs?: number | null;
  parseLatencyMs?: number | null;
  analyzeLatencyMs?: number | null;
  renderLatencyMs?: number | null;
  saveLatencyMs?: number | null;
  codegenLatencyMs?: number | null;
  typingDurationMs?: number | null;
  linesModified?: number | null;
  generatedLoc?: number | null;
  estimatedMinutesSaved?: number | null;
  copyCount?: number | null;
  pasteCount?: number | null;
  exportCount?: number | null;
  lineCount?: number | null;
  entityCount?: number | null;
  relationCount?: number | null;
}

export interface MetricsPanelProps {
  metrics: ReportMetrics;
  uiLanguage?: Language;
}

function formatMs(value?: number | null): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value)}ms` : '-';
}

function formatNumber(value?: number | null): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(Math.round(value)) : '-';
}

export function MetricsPanel({ metrics, uiLanguage = 'en' }: MetricsPanelProps) {
  const t = (key: string) => tText(uiLanguage, key);
  const rows = [
    [t('metrics.compile'), formatMs(metrics.compileLatencyMs)],
    [t('metrics.parse'), formatMs(metrics.parseLatencyMs)],
    [t('metrics.analyze'), formatMs(metrics.analyzeLatencyMs)],
    [t('metrics.render'), formatMs(metrics.renderLatencyMs)],
    [t('metrics.save'), formatMs(metrics.saveLatencyMs)],
    [t('metrics.codegen'), formatMs(metrics.codegenLatencyMs)],
    [t('metrics.typing_duration'), formatMs(metrics.typingDurationMs)],
    [t('metrics.lines_modified'), formatNumber(metrics.linesModified)],
    [t('metrics.generated_loc'), formatNumber(metrics.generatedLoc)],
    [t('metrics.time_saved'), metrics.estimatedMinutesSaved != null ? `${formatNumber(metrics.estimatedMinutesSaved)}m` : '-'],
    [t('metrics.copy_paste_export'), `${formatNumber(metrics.copyCount)} / ${formatNumber(metrics.pasteCount)} / ${formatNumber(metrics.exportCount)}`],
  ];
  const contextRows = [
    [t('metrics.source_lines'), formatNumber(metrics.lineCount)],
    [t('metrics.entities'), formatNumber(metrics.entityCount)],
    [t('metrics.relations'), formatNumber(metrics.relationCount)],
  ];

  return (
    <section className="iso-sidebar" style={{ borderTop: '1px solid var(--iso-divider)' }} aria-label={t('metrics.title')}>
      <div className="iso-panel-header" style={{ borderBottom: '1px solid var(--iso-divider)', padding: '0 12px' }}>
        <IconDiagram size={11} /> {t('metrics.title')}
      </div>
      <div className="iso-sidebar-body" style={{ gap: 6 }}>
        {[...rows, ...contextRows].map(([label, value]) => (
          <div
            key={label}
            className="iso-panel-info"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 8,
              marginLeft: 0,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <span>{label}</span>
            <strong style={{ color: 'var(--iso-text)', fontWeight: 600 }}>{value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
