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
  canvasDurationMs?: number | null;
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

  const parseVal = metrics.parseLatencyMs ?? 0;
  const analyzeVal = metrics.analyzeLatencyMs ?? 0;
  const renderVal = metrics.renderLatencyMs ?? 0;
  const maxVal = Math.max(1, parseVal, analyzeVal, renderVal);

  // Latency Chart calculations
  const parseH = (parseVal / maxVal) * 50;
  const analyzeH = (analyzeVal / maxVal) * 50;
  const renderH = (renderVal / maxVal) * 50;

  // Time Saved Gauge calculations
  const minsSaved = metrics.estimatedMinutesSaved ?? 0;
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const targetMins = 60;
  const percentage = Math.min(100, Math.max(0, (minsSaved / targetMins) * 100));
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  // Activity Breakdown calculations
  const textTime = metrics.typingDurationMs ?? 0;
  const visualTime = metrics.canvasDurationMs ?? 0;
  const totalActTime = textTime + visualTime || 1;
  const textPct = Math.round((textTime / totalActTime) * 100);
  const visualPct = 100 - textPct;

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
      <div className="iso-sidebar-body" style={{ gap: 12, padding: '12px' }}>

        {/* Visual Charts Container */}
        <div className="iso-metrics-charts" style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 6 }}>

          {/* Row 1: Latency Bars + Time Saved Ring */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>

            {/* Latency Chart */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 10, color: 'var(--iso-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {t('metrics.latency_ms')}
              </div>
              <svg width="100%" height="80" style={{ background: 'rgba(0,0,0,0.02)', borderRadius: 6, padding: '6px 8px 4px 8px', boxSizing: 'border-box' }}>
                {/* Parse Bar */}
                <rect x="10%" y={60 - parseH} width="16%" height={parseH} rx="2" fill="#228be6" />
                <text x="18%" y="72" textAnchor="middle" fontSize="8" fill="var(--iso-text-muted)">P</text>
                <text x="18%" y={56 - parseH} textAnchor="middle" fontSize="7" fill="var(--iso-text)" fontWeight="600">{Math.round(parseVal)}</text>

                {/* Analyze Bar */}
                <rect x="42%" y={60 - analyzeH} width="16%" height={analyzeH} rx="2" fill="#12b886" />
                <text x="50%" y="72" textAnchor="middle" fontSize="8" fill="var(--iso-text-muted)">A</text>
                <text x="50%" y={56 - analyzeH} textAnchor="middle" fontSize="7" fill="var(--iso-text)" fontWeight="600">{Math.round(analyzeVal)}</text>

                {/* Render Bar */}
                <rect x="74%" y={60 - renderH} width="16%" height={renderH} rx="2" fill="#7950f2" />
                <text x="82%" y="72" textAnchor="middle" fontSize="8" fill="var(--iso-text-muted)">R</text>
                <text x="82%" y={56 - renderH} textAnchor="middle" fontSize="7" fill="var(--iso-text)" fontWeight="600">{Math.round(renderVal)}</text>
              </svg>
            </div>

            {/* Time Saved Ring */}
            <div style={{ width: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ fontSize: 10, color: 'var(--iso-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>
                {t('metrics.time_saved')}
              </div>
              <div style={{ position: 'relative', width: 60, height: 60 }}>
                <svg width="60" height="60" viewBox="0 0 60 60">
                  <circle cx="30" cy="30" r={radius} fill="none" stroke="var(--iso-divider)" strokeWidth="4" />
                  <circle
                    cx="30"
                    cy="30"
                    r={radius}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="4"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    transform="rotate(-90 30 30)"
                    style={{ transition: 'stroke-dashoffset 0.35s' }}
                  />
                </svg>
                <div style={{
                  position: 'absolute',
                  top: 0, left: 0, right: 0, bottom: 0,
                  display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
                  fontSize: 10, fontWeight: 'bold', color: 'var(--iso-text)'
                }}>
                  <span>{minsSaved}m</span>
                </div>
              </div>
            </div>

          </div>

          {/* Row 2: Activity Breakdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--iso-text-muted)' }}>
              <span>{t('metrics.workflow_profile')}</span>
              <strong>{textPct}% {t('metrics.text')} / {visualPct}% {t('metrics.visual')}</strong>
            </div>
            <div style={{ height: 10, display: 'flex', borderRadius: 5, overflow: 'hidden', background: 'var(--iso-divider)' }}>
              <div style={{ width: `${textPct}%`, background: '#228be6', transition: 'width 0.3s' }} title="Text Editing" />
              <div style={{ width: `${visualPct}%`, background: '#f59e0b', transition: 'width 0.3s' }} title="Visual Drawing" />
            </div>
          </div>

        </div>

        {/* Tabular list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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

      </div>
    </section>
  );
}
