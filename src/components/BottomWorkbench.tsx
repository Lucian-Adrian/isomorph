export interface BottomWorkbenchMetric {
  label: string;
  value: string | number;
}

export interface BottomWorkbenchProps {
  metrics: BottomWorkbenchMetric[];
  teamLabel?: string;
}

export function BottomWorkbench({ metrics, teamLabel = 'FAF-241 · Team 02' }: BottomWorkbenchProps) {
  return (
    <aside className="iso-bottom-workbench" aria-label="Workspace status">
      {metrics.map(metric => (
        <span key={metric.label} className="iso-status-pill">
          <span>{metric.label}</span>
          <strong>{metric.value}</strong>
        </span>
      ))}
      <span className="iso-status-pill iso-status-pill--muted">{teamLabel}</span>
    </aside>
  );
}
