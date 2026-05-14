import { updateEntityPosition, updateRelationById, type RelationRewriteUpdates } from '../services/sourceRewrite.js';

export type IsxCanvasCommand =
  | { type: 'move-entity'; entityName: string; x: number; y: number; width?: number; height?: number; diagramName?: string }
  | { type: 'update-relation'; relationId: string; updates: RelationRewriteUpdates; diagramName?: string };

export function applyIsxCanvasCommand(source: string, command: IsxCanvasCommand): string {
  if (command.type === 'move-entity') {
    return updateEntityPosition(source, command.entityName, command.x, command.y, command.width, command.height, command.diagramName);
  }
  return updateRelationById(source, command.relationId, command.updates, command.diagramName);
}
