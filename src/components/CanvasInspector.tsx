export interface CanvasInspectorProps {
  open: boolean;
  title: string;
  rows: Array<[string, string | number | null | undefined]>;
}

export function CanvasInspector({ open, title, rows }: CanvasInspectorProps) {
  if (!open) return null;
  return (
    <aside className="iso-canvas-inspector" aria-label="Canvas inspector">
      <strong>{title}</strong>
      {rows.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <span>{value ?? '-'}</span>
        </div>
      ))}
    </aside>
  );
}
