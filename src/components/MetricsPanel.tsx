import { IconDiagram } from './Icons.js';

export interface ReportMetrics {
  compileLatencyMs?: number | null;
  saveLatencyMs?: number | null;
  codegenLatencyMs?: number | null;
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
}

function formatMs(value?: number | null): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value)}ms` : '-';
}

function formatNumber(value?: number | null): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(Math.round(value)) : '-';
}

export function MetricsPanel({ metrics }: MetricsPanelProps) {
  const rows = [
    ['Compile', formatMs(metrics.compileLatencyMs)],
    ['Save', formatMs(metrics.saveLatencyMs)],
    ['Codegen', formatMs(metrics.codegenLatencyMs)],
    ['Generated LOC', formatNumber(metrics.generatedLoc)],
    ['Time saved', metrics.estimatedMinutesSaved != null ? `${formatNumber(metrics.estimatedMinutesSaved)}m` : '-'],
    ['Copy / Paste / Export', `${formatNumber(metrics.copyCount)} / ${formatNumber(metrics.pasteCount)} / ${formatNumber(metrics.exportCount)}`],
  ];
  const contextRows = [
    ['Source lines', formatNumber(metrics.lineCount)],
    ['Entities', formatNumber(metrics.entityCount)],
    ['Relations', formatNumber(metrics.relationCount)],
  ];

  return (
    <section className="iso-sidebar" style={{ borderTop: '1px solid var(--iso-divider)' }} aria-label="Metrics">
      <div className="iso-panel-header" style={{ borderBottom: '1px solid var(--iso-divider)', padding: '0 12px' }}>
        <IconDiagram size={11} /> Metrics
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
