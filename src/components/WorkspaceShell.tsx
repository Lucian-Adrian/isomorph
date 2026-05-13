import type { ReactNode } from 'react';

export interface WorkspaceShellProps {
  topBar: ReactNode;
  main: ReactNode;
  overlays?: ReactNode;
  bottom?: ReactNode;
}

export function WorkspaceShell({ topBar, main, overlays, bottom }: WorkspaceShellProps) {
  return (
    <div className="iso-workspace-shell">
      {topBar}
      <main className="iso-workspace-shell-main">{main}</main>
      {bottom}
      {overlays}
    </div>
  );
}
