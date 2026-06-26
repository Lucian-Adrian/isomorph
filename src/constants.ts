// ============================================================
// Isomorph — Centralized Constants
// ============================================================
// All shared constants extracted from App.tsx.
// ============================================================

import type { DiagramKind } from './types/index.js';

/** All diagram kind values (including 'all' for filter dropdowns). */
export const DIAGRAM_KINDS: Array<'all' | DiagramKind> = [
  'all', 'class', 'usecase', 'component', 'deployment',
  'sequence', 'activity', 'state', 'collaboration', 'flow',
];

/** Maps semantic relation kind → source-text token. */
export const REL_TOKENS_BY_KIND: Record<string, string> = {
  association: '--',
  'directed-association': '-->',
  inheritance: '--|>',
  realization: '..|>',
  aggregation: '--o',
  composition: '--*',
  dependency: '..>',
  restriction: '--x',
  provides: '--()',
  requires: '--(',
};

/**
 * Regex alternation matching all entity declaration keywords.
 * Used by source-manipulation utilities for parsing.
 */
export const ENTITY_KINDS_RX = '(?:package|class|interface|enum|actor|usecase|component|node|participant|partition|decision|merge|fork|join|start|stop|action|state|composite|concurrent|choice|history|device|artifact|environment|boundary|system|multiobject|active_object|collaboration|composite_object|alt|loop|opt|break|critical|par|note)';
