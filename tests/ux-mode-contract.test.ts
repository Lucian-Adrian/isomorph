import { describe, expect, it } from 'vitest';
import {
  createWorkspaceModeState,
  modeFromHash,
  routeForMode,
  shouldRenderCanvasChrome,
  shouldRenderIdeChrome,
  transitionWorkspaceMode,
} from '../src/app/modeState.js';
import { rightRailModeForSelection, selectionBelongsToDiagramSurface, selectionLabel } from '../src/app/selectionState.js';
import { evaluateWorkspaceCommand, evaluateWorkspaceCommands, isCodegenSupportedDiagram } from '../src/app/workspaceCommands.js';
import type { IOMDiagram, IOMEntity } from '../src/semantics/iom.js';

describe('workspace mode contract', () => {
  it('maps supported hash routes to the correct work mode', () => {
    expect(modeFromHash('#/app')).toBe('ide');
    expect(modeFromHash('#/canvas')).toBe('canvas');
    expect(modeFromHash('/isomorph/app/#/canvas')).toBe('canvas');
    expect(routeForMode('ide')).toBe('#/app');
    expect(routeForMode('canvas')).toBe('#/canvas');
  });

  it('transitions without leaking IDE chrome into canvas mode', () => {
    const initial = createWorkspaceModeState('#/app', 100);
    const canvas = transitionWorkspaceMode(initial, 'canvas', 200);

    expect(canvas).toEqual({
      mode: 'canvas',
      route: '#/canvas',
      enteredAt: 200,
      previousMode: 'ide',
    });
    expect(shouldRenderIdeChrome(canvas.mode)).toBe(false);
    expect(shouldRenderCanvasChrome(canvas.mode)).toBe(true);
  });
});

describe('selection to rail mapping', () => {
  it('maps source, entity, relation, canvas, and error selections to deterministic rail modes', () => {
    expect(rightRailModeForSelection({ type: 'none' })).toBe('stencils');
    expect(rightRailModeForSelection({ type: 'source', range: { from: 0, to: 10 } })).toBe('stencils');
    expect(rightRailModeForSelection({ type: 'entity', id: 'User' })).toBe('entity-properties');
    expect(rightRailModeForSelection({ type: 'relation', id: 'User--Order' })).toBe('relation-editor');
    expect(rightRailModeForSelection({ type: 'canvas-element', id: 'box-1', elementKind: 'rectangle' })).toBe('canvas-style');
    expect(rightRailModeForSelection({ type: 'error', id: 'parse-1', message: 'Unexpected token' })).toBe('fix-suggestions');
  });

  it('labels selections and identifies diagram-surface ownership', () => {
    expect(selectionBelongsToDiagramSurface({ type: 'entity', id: 'Account' })).toBe(true);
    expect(selectionBelongsToDiagramSurface({ type: 'source' })).toBe(false);
    expect(selectionLabel({ type: 'error', id: 'e1', message: 'Missing brace', line: 12 })).toBe('Problem on line 12');
  });
});

describe('workspace command availability', () => {
  const baseContext = {
    mode: 'ide' as const,
    hasDiagram: true,
    hasSource: true,
    supportsCodegen: true,
    isAuthenticated: true,
    selection: { type: 'none' as const },
  };

  it('keeps canvas-only commands out of IDE mode and IDE-only commands out of Canvas mode', () => {
    expect(evaluateWorkspaceCommand('fit-canvas', baseContext)).toMatchObject({
      enabled: false,
      reason: 'Available in Canvas mode only.',
    });
    expect(evaluateWorkspaceCommand('generate', { ...baseContext, mode: 'canvas' })).toMatchObject({
      enabled: false,
      reason: 'Available in IDE mode only.',
    });
  });

  it('requires source, diagram, and auth prerequisites only where they matter', () => {
    expect(evaluateWorkspaceCommand('generate', { ...baseContext, hasSource: false }).enabled).toBe(false);
    expect(evaluateWorkspaceCommand('export', { ...baseContext, hasDiagram: false }).enabled).toBe(false);
    expect(evaluateWorkspaceCommand('sync', { ...baseContext, isAuthenticated: false })).toMatchObject({
      enabled: false,
      reason: 'Sign in to use cloud features.',
    });
    expect(evaluateWorkspaceCommand('open-account', { ...baseContext, isAuthenticated: false }).enabled).toBe(true);
  });

  it('does not expose codegen when a diagram has no codegen-compatible entities', () => {
    expect(evaluateWorkspaceCommand('generate', { ...baseContext, supportsCodegen: false })).toMatchObject({
      enabled: false,
      reason: 'Code generation is available for class, interface, and enum models only.',
    });
  });

  it('keeps codegen available for interface-only and enum-only diagrams', () => {
    function diagramWith(entity: Pick<IOMEntity, 'kind' | 'name'>): IOMDiagram {
      return {
        name: `${entity.name}Diagram`,
        kind: 'component',
        entities: new Map([[entity.name, {
          ...entity,
          id: entity.name,
          fields: [],
          methods: [],
          enumValues: entity.kind === 'enum' ? [{ name: 'ACTIVE' }] : [],
          extendsNames: [],
          implementsNames: [],
          package: undefined,
          stereotype: undefined,
          isAbstract: entity.kind === 'interface',
          styles: {},
          children: [],
          regions: [],
        } satisfies IOMEntity]]),
        relations: [],
        packages: [],
        notes: [],
        config: {},
        styles: {},
        fragments: [],
        activations: [],
        partitions: [],
      };
    }

    expect(isCodegenSupportedDiagram(diagramWith({ kind: 'interface', name: 'Repository' }))).toBe(true);
    expect(isCodegenSupportedDiagram(diagramWith({ kind: 'enum', name: 'Status' }))).toBe(true);
    expect(isCodegenSupportedDiagram(diagramWith({ kind: 'component', name: 'Gateway' }))).toBe(false);
  });

  it('evaluates command groups for top bars and menus', () => {
    expect(
      evaluateWorkspaceCommands(['generate', 'generate', 'enter-canvas'], baseContext).map(command => command.enabled),
    ).toEqual([true, true, true]);
  });
});
