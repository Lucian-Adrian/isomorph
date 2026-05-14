import { describe, expect, it } from 'vitest';
import { aggregateTelemetryMetrics } from '../src/services/metrics.js';

describe('report-ready telemetry metrics', () => {
  it('aggregates latency, productivity, time split, and canvas tool usage', () => {
    expect(
      aggregateTelemetryMetrics([
        { event_type: 'parse', payload: { latency_ms: 10 } },
        { event_type: 'analyze', payload: { latency_ms: 20 } },
        { event_type: 'render', payload: { latency_ms: 30 } },
        { event_type: 'codegen', payload: { latency_ms: 40, generated_loc: 80, estimated_minutes_saved: 36 } },
        { event_type: 'save', payload: { latency_ms: 50 } },
        { event_type: 'copy', payload: {} },
        { event_type: 'paste', payload: {} },
        { event_type: 'export', payload: {} },
        { event_type: 'editor_typing', payload: { duration_ms: 60000, lines_modified: 12 } },
        { event_type: 'diagram_drag', payload: { duration_ms: 30000 } },
        { event_type: 'relation_edit', payload: { duration_ms: 30000, lines_modified: 2 } },
        { event_type: 'canvas_tool', payload: { tool: 'rectangle' } },
        { event_type: 'canvas_tool', payload: { tool: 'rectangle' } },
        { event_type: 'canvas_tool', payload: { tool: 'arrow' } },
      ]),
    ).toEqual({
      averageCompileLatencyMs: 40,
      averageSaveLatencyMs: 50,
      averageParseLatencyMs: 10,
      averageAnalyzeLatencyMs: 20,
      averageRenderLatencyMs: 30,
      generatedLoc: 80,
      estimatedBoilerplateMinutesSaved: 36,
      linesModifiedPerMinute: 7,
      editsPerMinute: 1,
      timeSplitMs: {
        editing: 60000,
        diagramming: 60000,
        other: 0,
      },
      counts: {
        copy: 1,
        paste: 1,
        export: 1,
        codegen: 1,
        save: 1,
      },
      canvasToolUsage: {
        rectangle: 2,
        arrow: 1,
      },
    });
  });
});
