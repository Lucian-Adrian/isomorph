import type { ReactNode } from 'react';

export interface TopCommandBarProps {
  title: string;
  subtitle?: string;
  status?: ReactNode;
  actions?: ReactNode;
  tabs?: ReactNode;
}

export function TopCommandBar({ title, subtitle, status, actions, tabs }: TopCommandBarProps) {
  return (
    <header className="iso-command-bar" aria-label="Workspace commands">
      <div className="iso-command-title">
        <strong>{title}</strong>
        {subtitle ? <span>{subtitle}</span> : null}
      </div>
      {tabs ? <nav className="iso-command-tabs" aria-label="Open workspace tabs">{tabs}</nav> : null}
      <div className="iso-command-spacer" />
      {status}
      {actions ? <div className="iso-command-actions">{actions}</div> : null}
    </header>
  );
}
