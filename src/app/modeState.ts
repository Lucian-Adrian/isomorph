export type WorkspaceMode = 'ide' | 'canvas';
export type ProductMode = 'home' | WorkspaceMode;

export interface WorkspaceModeState {
  mode: WorkspaceMode;
  route: '#/app' | '#/canvas';
  enteredAt: number;
  previousMode?: WorkspaceMode;
}

export function modeFromHash(routeHash: string): WorkspaceMode {
  return routeHash.includes('#/canvas') ? 'canvas' : 'ide';
}

export function resolveProductMode(routeHash: string, hasOpenFile: boolean): ProductMode {
  if (routeHash.includes('#/canvas')) return 'canvas';
  if (!hasOpenFile) return 'home';
  return modeFromHash(routeHash);
}

export function routeForMode(mode: WorkspaceMode): '#/app' | '#/canvas' {
  return mode === 'canvas' ? '#/canvas' : '#/app';
}

export function createWorkspaceModeState(routeHash: string, enteredAt = Date.now()): WorkspaceModeState {
  const mode = modeFromHash(routeHash);
  return {
    mode,
    route: routeForMode(mode),
    enteredAt,
  };
}

export function transitionWorkspaceMode(
  state: WorkspaceModeState,
  nextMode: WorkspaceMode,
  enteredAt = Date.now(),
): WorkspaceModeState {
  return {
    mode: nextMode,
    route: routeForMode(nextMode),
    enteredAt,
    previousMode: state.mode,
  };
}

export function shouldRenderIdeChrome(mode: ProductMode): boolean {
  return mode === 'ide';
}

export function shouldRenderCanvasChrome(mode: ProductMode): boolean {
  return mode === 'canvas';
}
