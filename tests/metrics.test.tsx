import { describe, expect, it } from 'vitest';
import { aggregateTelemetryMetrics } from '../src/services/metrics.js';
import { createRoot } from 'react-dom/client';
import React, { act } from 'react';
import { MetricsPanel } from '../src/components/MetricsPanel.js';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function render(element: React.ReactElement) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(element));
  return {
    host,
    cleanup: () => {
      act(() => root.unmount());
      host.remove();
    },
  };
}

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

describe('MetricsPanel Component', () => {
  it('localizes latency, saved time and workflow profile headers correctly in RO and RU', () => {
    const { host: hostRo, cleanup: cleanupRo } = render(
      <MetricsPanel
        uiLanguage="ro"
        metrics={{
          typingDurationMs: 120,
          canvasDurationMs: 360,
        }}
      />
    );
    expect(hostRo.textContent).toContain('Latență (ms)');
    expect(hostRo.textContent).toContain('PROFIL DE WORKFLOW');
    cleanupRo();

    const { host: hostRu, cleanup: cleanupRu } = render(
      <MetricsPanel
        uiLanguage="ru"
        metrics={{
          typingDurationMs: 120,
          canvasDurationMs: 360,
        }}
      />
    );
    expect(hostRu.textContent).toContain('Задержка (мс)');
    expect(hostRu.textContent).toContain('ПРОФИЛЬ РАБОЧЕГО ПРОЦЕССА');
    cleanupRu();
  });

  it('calculates the visual vs text activity split using actual measured durations', () => {
    const { host, cleanup } = render(
      <MetricsPanel
        metrics={{
          typingDurationMs: 200,
          canvasDurationMs: 800,
        }}
      />
    );
    expect(host.textContent).toContain('20% Text');
    expect(host.textContent).toContain('80% Visual');
    cleanup();
  });

  it('does not invent visual activity when measured canvas duration is zero', () => {
    const { host, cleanup } = render(
      <MetricsPanel
        metrics={{
          typingDurationMs: 1000,
          canvasDurationMs: 0,
        }}
      />
    );
    expect(host.textContent).toContain('100% Text');
    expect(host.textContent).toContain('0% Visual');
    cleanup();
  });
});
