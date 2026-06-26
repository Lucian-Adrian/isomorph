// ============================================================
// Isomorph — Diagram Templates
// ============================================================

import type { DiagramKind } from '../types/index.js';

/** Returns a starter source template for a given diagram kind. */
export function templateFor(kind: DiagramKind): string {
  const diagramName = `New${kind.charAt(0).toUpperCase()}${kind.slice(1)}Diagram`;
  if (kind === 'usecase') {
    return `diagram ${diagramName} : usecase {\n\n  actor User\n  usecase MainFlow\n\n  User --> MainFlow\n\n  @User at (80, 220)\n  @MainFlow at (360, 220)\n\n}\n`;
  }
  if (kind === 'component') {
    return `diagram ${diagramName} : component {\n\n  component Gateway\n  component Service\n\n  Gateway --> Service [label="calls"]\n\n  @Gateway at (120, 120)\n  @Service at (380, 120)\n\n}\n`;
  }
  if (kind === 'deployment') {
    return `diagram ${diagramName} : deployment {\n\n  node AppNode\n  component Api\n\n  AppNode --> Api [label="hosts"]\n\n  @AppNode at (120, 120)\n  @Api at (380, 120)\n\n}\n`;
  }
  if (kind === 'sequence') {
    return `diagram ${diagramName} : sequence {\n\n  actor User\n\n}\n`;
  }
  if (kind === 'flow') {
    return `diagram ${diagramName} : flow {\n\n  start Begin\n  action Process\n  stop End\n\n  Begin --> Process\n  Process --> End\n\n  @Begin at (200, 60)\n  @Process at (170, 180)\n  @End at (200, 300)\n\n}\n`;
  }
  if (kind === 'state') {
    return `diagram ${diagramName} : state {\n\n  start Initial\n  state Active\n  stop Final\n\n  Initial --> Active\n  Active --> Final\n\n  @Initial at (200, 60)\n  @Active at (170, 180)\n  @Final at (200, 300)\n\n}\n`;
  }
  if (kind === 'activity') {
    return `diagram ${diagramName} : activity {\n\n  start Begin\n  action DoWork\n  stop End\n\n  Begin --> DoWork\n  DoWork --> End\n\n  @Begin at (200, 60)\n  @DoWork at (170, 180)\n  @End at (200, 300)\n\n}\n`;
  }
  if (kind === 'collaboration') {
    return `diagram ${diagramName} : collaboration {\n\n  object Client\n  object Server\n\n  Client --> Server [label="1: request"]\n\n  @Client at (100, 120)\n  @Server at (380, 120)\n\n}\n`;
  }
  return `diagram ${diagramName} : class {\n\n  class Entity {\n    + id: string\n  }\n\n}\n`;
}
