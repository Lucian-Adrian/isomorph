import type { IOMDiagram } from '../../semantics/iom.js';

type DiagramKind = IOMDiagram['kind'];

export interface DiagramStencil {
  label: string;
  keyword: string;
}

export function getStencilsForKind(kind?: DiagramKind): DiagramStencil[] {
  switch (kind) {
    case 'class':
      return [
        { label: 'Class', keyword: 'class' },
        { label: 'Abstract Class', keyword: 'abstract class' },
        { label: 'Interface', keyword: 'interface' },
        { label: 'Enum', keyword: 'enum' },
        { label: 'Package', keyword: 'package' },
      ];
    case 'usecase':
      return [
        { label: 'Actor', keyword: 'actor' },
        { label: 'Use Case', keyword: 'usecase' },
        { label: 'System', keyword: 'system' },
      ];
    case 'component':
      return [
        { label: 'Component', keyword: 'component' },
        { label: 'Interface', keyword: 'interface' },
      ];
    case 'deployment':
      return [
        { label: 'Node', keyword: 'node' },
        { label: 'Component', keyword: 'component' },
        { label: 'Device', keyword: 'node <<device>>' },
        { label: 'Artifact', keyword: 'artifact' },
        { label: 'Environment', keyword: 'environment' },
      ];
    case 'sequence':
      return [
        { label: 'Actor', keyword: 'actor' },
        { label: 'Participant', keyword: 'participant' },
        { label: 'Alt Fragment', keyword: 'alt' },
        { label: 'Loop Fragment', keyword: 'loop' },
        { label: 'Opt Fragment', keyword: 'opt' },
        { label: 'Par Fragment', keyword: 'par' },
        { label: 'Break Fragment', keyword: 'break' },
        { label: 'Critical Fragment', keyword: 'critical' },
      ];
    case 'state':
      return [
        { label: 'State', keyword: 'state' },
        { label: 'Start Node', keyword: 'start' },
        { label: 'Final Node', keyword: 'stop' },
        { label: 'Decision', keyword: 'decision' },
        { label: 'Fork', keyword: 'fork' },
        { label: 'Join', keyword: 'join' },
        { label: 'History', keyword: 'history' },
        { label: 'Concurrent', keyword: 'concurrent' },
        { label: 'Composite', keyword: 'composite' },
      ];
    case 'activity':
      return [
        { label: 'Action', keyword: 'action' },
        { label: 'Start Node', keyword: 'start' },
        { label: 'Activity Final', keyword: 'stop' },
        { label: 'Decision', keyword: 'decision' },
        { label: 'Merge', keyword: 'merge' },
        { label: 'Fork', keyword: 'fork' },
        { label: 'Join', keyword: 'join' },
        { label: 'Partition', keyword: 'partition' },
      ];
    case 'collaboration':
      return [
        { label: 'Object', keyword: 'object' },
        { label: 'Actor', keyword: 'actor' },
        { label: 'Multiobject', keyword: 'multiobject' },
        { label: 'Active Object', keyword: 'active_object' },
        { label: 'Composite Obj', keyword: 'composite_object' },
      ];
    case 'flow':
      return [
        { label: 'Process', keyword: 'action' },
        { label: 'Decision', keyword: 'decision' },
        { label: 'Start', keyword: 'start' },
        { label: 'End', keyword: 'stop' },
        { label: 'Fork', keyword: 'fork' },
        { label: 'Join', keyword: 'join' },
      ];
    default:
      return [];
  }
}
