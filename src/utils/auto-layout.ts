// ============================================================
// Auto Layout Algorithms
// ============================================================
// Pure-function layout computations for Feature 17.
// These are extracted from App.tsx to be independently testable.
// ============================================================

export type LayoutMode = 'left-right' | 'snowflake' | 'compact';

export interface LayoutEntity {
  name: string;
}

export interface LayoutRelation {
  from: string;
  to: string;
}

export interface LayoutResult {
  positions: Map<string, { x: number; y: number }>;
}

const GAP_X = 240;
const GAP_Y = 180;

/**
 * Left-Right layout: topological sort assigns entities to columns
 * based on directed relation flow. Good for pipelines.
 */
export function layoutLeftRight(entities: LayoutEntity[], relations: LayoutRelation[]): LayoutResult {
  const positions = new Map<string, { x: number; y: number }>();
  if (entities.length === 0) return { positions };

  const adj = new Map<string, string[]>();
  const inDeg = new Map<string, number>();
  for (const e of entities) { adj.set(e.name, []); inDeg.set(e.name, 0); }
  for (const rel of relations) {
    if (adj.has(rel.from) && inDeg.has(rel.to)) {
      adj.get(rel.from)!.push(rel.to);
      inDeg.set(rel.to, (inDeg.get(rel.to) || 0) + 1);
    }
  }

  const layers: string[][] = [];
  const visited = new Set<string>();
  const queue = entities.filter(e => (inDeg.get(e.name) || 0) === 0).map(e => e.name);
  if (queue.length === 0) queue.push(entities[0].name);

  let currentLayer = [...queue];
  while (currentLayer.length > 0) {
    const layer: string[] = [];
    const nextLayer: string[] = [];
    for (const name of currentLayer) {
      if (visited.has(name)) continue;
      visited.add(name);
      layer.push(name);
      for (const neighbor of (adj.get(name) || [])) {
        if (!visited.has(neighbor)) nextLayer.push(neighbor);
      }
    }
    if (layer.length > 0) layers.push(layer);
    currentLayer = [...new Set(nextLayer)];
  }

  // Add unvisited entities to the last layer
  for (const e of entities) {
    if (!visited.has(e.name)) {
      if (layers.length === 0) layers.push([]);
      layers[layers.length - 1].push(e.name);
    }
  }

  for (let col = 0; col < layers.length; col++) {
    for (let row = 0; row < layers[col].length; row++) {
      positions.set(layers[col][row], { x: 80 + col * GAP_X, y: 80 + row * GAP_Y });
    }
  }

  return { positions };
}

/**
 * Snowflake layout: radial placement with most-connected entity at center,
 * others in concentric rings. Good for data warehouses.
 */
export function layoutSnowflake(entities: LayoutEntity[], relations: LayoutRelation[]): LayoutResult {
  const positions = new Map<string, { x: number; y: number }>();
  if (entities.length === 0) return { positions };

  const degree = new Map<string, number>();
  for (const e of entities) degree.set(e.name, 0);
  for (const rel of relations) {
    degree.set(rel.from, (degree.get(rel.from) || 0) + 1);
    degree.set(rel.to, (degree.get(rel.to) || 0) + 1);
  }

  const sorted = entities.slice().sort((a, b) => (degree.get(b.name) || 0) - (degree.get(a.name) || 0));
  const cx = 500, cy = 400;
  positions.set(sorted[0].name, { x: cx, y: cy });

  const ringCapacity = 8;
  let ring = 1;
  let idx = 0;

  for (let i = 1; i < sorted.length; i++) {
    const capacity = ring * ringCapacity;
    const angle = (idx / capacity) * 2 * Math.PI - Math.PI / 2;
    const radius = ring * 220;
    positions.set(sorted[i].name, {
      x: Math.round(cx + Math.cos(angle) * radius),
      y: Math.round(cy + Math.sin(angle) * radius),
    });
    idx++;
    if (idx >= capacity) { ring++; idx = 0; }
  }

  return { positions };
}

/**
 * Compact layout: dense rectangular grid, left-to-right, top-to-bottom.
 * Good for diagrams with few relationships.
 */
export function layoutCompact(entities: LayoutEntity[]): LayoutResult {
  const positions = new Map<string, { x: number; y: number }>();
  if (entities.length === 0) return { positions };

  const cols = Math.ceil(Math.sqrt(entities.length));
  for (let i = 0; i < entities.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    positions.set(entities[i].name, { x: 80 + col * GAP_X, y: 80 + row * GAP_Y });
  }

  return { positions };
}

/**
 * Dispatch to the appropriate layout algorithm.
 */
export function computeLayout(
  mode: LayoutMode,
  entities: LayoutEntity[],
  relations: LayoutRelation[]
): LayoutResult {
  switch (mode) {
    case 'left-right': return layoutLeftRight(entities, relations);
    case 'snowflake': return layoutSnowflake(entities, relations);
    case 'compact': return layoutCompact(entities);
  }
}
