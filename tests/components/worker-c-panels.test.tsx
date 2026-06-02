import { describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import React, { act } from 'react';
import { AuthCloudPanel } from '../../src/components/AuthCloudPanel.js';
import { AuthModal } from '../../src/components/AuthModal.js';
import { CodegenPanel } from '../../src/components/CodegenPanel.js';
import { MetricsPanel } from '../../src/components/MetricsPanel.js';
import { MetricsDrawer } from '../../src/components/MetricsDrawer.js';
import { FullCanvasShell } from '../../src/components/FullCanvasShell.js';
import { WorkspaceOverlayHost } from '../../src/components/workspace/WorkspaceOverlayHost.js';
import type { IOMDiagram } from '../../src/semantics/iom.js';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

describe('Worker C shell panels', () => {
  it('CodegenPanel exposes generation, copy, download, AST/IOM copy, and bundle hooks', () => {
    const onGenerate = vi.fn();
    const onCopyCode = vi.fn();
    const onDownloadCode = vi.fn();
    const onCopyInspectorJson = vi.fn();
    const onDownloadBundle = vi.fn();

    const { host, cleanup } = render(
      <CodegenPanel
        language="python"
        output={'class User:\n    pass\n'}
        inspectorJson='{"ast":{},"iom":{}}'
        diagramName="UserDiagram"
        onLanguageChange={vi.fn()}
        onGenerate={onGenerate}
        onCopyCode={onCopyCode}
        onDownloadCode={onDownloadCode}
        onCopyInspectorJson={onCopyInspectorJson}
        onDownloadBundle={onDownloadBundle}
      />,
    );

    const buttons = Array.from(host.querySelectorAll('button'));
    act(() => buttons.find(button => button.textContent === 'Generate')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    act(() => buttons.find(button => button.textContent === 'Copy code')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    act(() => buttons.find(button => button.textContent === 'Download')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    act(() => buttons.find(button => button.textContent === 'Copy AST/IOM JSON')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    act(() => buttons.find(button => button.textContent === 'Bundle')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(onGenerate).toHaveBeenCalledOnce();
    expect(onCopyCode).toHaveBeenCalledWith('class User:\n    pass\n');
    expect(onDownloadCode).toHaveBeenCalledWith({ language: 'python', output: 'class User:\n    pass\n', diagramName: 'UserDiagram' });
    expect(onCopyInspectorJson).toHaveBeenCalledWith('{"ast":{},"iom":{}}');
    expect(onDownloadBundle).toHaveBeenCalledOnce();
    cleanup();
  });

  it('CodegenPanel localizes unsupported-codegen state and removes the generate call to action', () => {
    const onGenerate = vi.fn();
    const { host, cleanup } = render(
      React.createElement(CodegenPanel, {
        language: 'python',
        uiLanguage: 'ro',
        output: '',
        inspectorJson: '{}',
        canGenerate: false,
        statusMessage: 'Generarea codului este disponibilă doar pentru diagrame de clase.',
        onLanguageChange: vi.fn(),
        onGenerate,
        onCopyCode: vi.fn(),
        onDownloadCode: vi.fn(),
        onCopyInspectorJson: vi.fn(),
      }),
    );

    const primary = host.querySelector('.iso-btn--primary') as HTMLButtonElement | null;
    expect(host.textContent).toContain('Generare cod');
    expect(host.textContent).toContain('Limbaj');
    expect(primary?.textContent).toBe('Indisponibil');
    expect(primary?.disabled).toBe(true);
    expect(host.querySelector('textarea')?.getAttribute('placeholder')).toBe('Tip de diagramă nesuportat');

    act(() => primary?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(onGenerate).not.toHaveBeenCalled();
    cleanup();
  });

  it('AuthCloudPanel renders signed-in remote files and save/signout actions', () => {
    const onSave = vi.fn();
    const onSignOut = vi.fn();
    const onOpenRemote = vi.fn();
    const { host, cleanup } = render(
      <AuthCloudPanel
        isConfigured
        userEmail="user@example.test"
        statusMessage="Saved UserDiagram."
        remoteDiagrams={[{ id: 'd1', title: 'Remote diagram', line_count: 12, updated_at: '2026-05-05T10:00:00.000Z' }]}
        onSave={onSave}
        onSignOut={onSignOut}
        onOpenRemote={onOpenRemote}
        authEmail=""
        authPassword=""
        onAuthEmailChange={vi.fn()}
        onAuthPasswordChange={vi.fn()}
        onSignIn={vi.fn()}
        onSignUp={vi.fn()}
      />,
    );

    const buttons = Array.from(host.querySelectorAll('button'));
    act(() => buttons.find(button => button.textContent === 'Save to Supabase')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    act(() => buttons.find(button => button.textContent === 'Sign out')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    act(() => buttons.find(button => button.textContent?.includes('Remote diagram'))?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(host.textContent).toContain('user@example.test');
    expect(onSave).toHaveBeenCalledOnce();
    expect(onSignOut).toHaveBeenCalledOnce();
    expect(onOpenRemote).toHaveBeenCalledWith(expect.objectContaining({ id: 'd1' }));
    cleanup();
  });

  it('AuthCloudPanel wraps credentials in a real form for browser password managers', () => {
    const { host, cleanup } = render(
      <AuthCloudPanel
        isConfigured
        remoteDiagrams={[]}
        authEmail="user@example.test"
        authPassword="secret"
        onAuthEmailChange={vi.fn()}
        onAuthPasswordChange={vi.fn()}
        onSignIn={vi.fn()}
        onSignUp={vi.fn()}
        onSave={vi.fn()}
        onSignOut={vi.fn()}
        onOpenRemote={vi.fn()}
      />,
    );

    const passwordInput = host.querySelector('input[type="password"]');
    expect(passwordInput?.closest('form')).not.toBeNull();
    cleanup();
  });

  it('AuthModal and cloud auth form localize account copy', () => {
    const { host, cleanup } = render(
      <AuthModal
        open
        uiLanguage="ru"
        onClose={vi.fn()}
        isConfigured={false}
        remoteDiagrams={[]}
        authEmail=""
        authPassword=""
        onAuthEmailChange={vi.fn()}
        onAuthPasswordChange={vi.fn()}
        onSignIn={vi.fn()}
        onSignUp={vi.fn()}
        onSave={vi.fn()}
        onSignOut={vi.fn()}
        onOpenRemote={vi.fn()}
      />,
    );

    expect(host.textContent).toContain('Аккаунт и облако');
    expect(host.textContent).toContain('Укажите переменные окружения Supabase для облачной синхронизации.');
    expect(host.querySelector('input[type="email"]')?.getAttribute('placeholder')).toBe('Эл. почта');
    expect(host.querySelector('input[type="password"]')?.getAttribute('placeholder')).toBe('Пароль');
    expect(host.textContent).toContain('Войти');
    expect(host.textContent).toContain('Зарегистрироваться');
    cleanup();
  });

  it('WorkspaceOverlayHost localizes dock labels and close action', () => {
    const { host, cleanup } = render(
      <WorkspaceOverlayHost
        uiLanguage="ro"
        activeOverlay="codegen"
        codegenPanel={<div>cod</div>}
        metricsPanel={<div>metrici</div>}
        onClose={vi.fn()}
        onSelectOverlay={vi.fn()}
      />,
    );

    expect(host.textContent).toContain('Cod generat');
    expect(host.textContent).toContain('Metrici');
    expect(host.querySelector('[aria-label="Închide panoul spațiului de lucru"]')).not.toBeNull();
    cleanup();
  });

  it('MetricsPanel shows compact report-ready numbers', () => {
    const { host, cleanup } = render(
      <MetricsPanel
        metrics={{
          compileLatencyMs: 12,
          saveLatencyMs: 34,
          codegenLatencyMs: 56,
          generatedLoc: 78,
          estimatedMinutesSaved: 35,
          copyCount: 2,
          pasteCount: 3,
          exportCount: 4,
        }}
      />,
    );

    expect(host.textContent).toContain('Compile');
    expect(host.textContent).toContain('12ms');
    expect(host.textContent).toContain('Generated LOC');
    expect(host.textContent).toContain('78');
    cleanup();
  });

  it('MetricsPanel exposes parse, analyze, render, and typing research metrics', () => {
    const { host, cleanup } = render(
      <MetricsPanel
        metrics={{
          parseLatencyMs: 11,
          analyzeLatencyMs: 22,
          renderLatencyMs: 33,
          typingDurationMs: 444,
          linesModified: 5,
        }}
      />,
    );

    expect(host.textContent).toContain('Parse');
    expect(host.textContent).toContain('11ms');
    expect(host.textContent).toContain('Analyze');
    expect(host.textContent).toContain('22ms');
    expect(host.textContent).toContain('Render');
    expect(host.textContent).toContain('33ms');
    expect(host.textContent).toContain('Typing duration');
    expect(host.textContent).toContain('444ms');
    expect(host.textContent).toContain('Lines modified');
    expect(host.textContent).toContain('5');
    cleanup();
  });

  it('FullCanvasShell exposes toolbar actions and mode changes', () => {
    const onModeChange = vi.fn();
    const onBack = vi.fn();
    const diagram: IOMDiagram = {
      name: 'CanvasDiagram',
      kind: 'class',
      entities: new Map(),
      relations: [],
      packages: [],
      notes: [],
      config: {},
      styles: {},
      fragments: [],
      activations: [],
      partitions: [],
    };
    const { host, cleanup } = render(
      <FullCanvasShell
        diagram={diagram}
        mode="move"
        onModeChange={onModeChange}
        onExportSVG={vi.fn()}
        onExportPNG={vi.fn()}
        onBack={onBack}
      />,
    );

    act(() => host.querySelector('[aria-label="Hand"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    act(() => Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'Back')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(host.querySelector('.iso-full-canvas-shell')).not.toBeNull();
    expect(onModeChange).toHaveBeenCalledWith('hand');
    expect(onBack).toHaveBeenCalledOnce();
    cleanup();
  });

  it('MetricsPanel localizes report labels', () => {
    const { host, cleanup } = render(
      <MetricsPanel
        uiLanguage="ru"
        metrics={{
          compileLatencyMs: 12,
          saveLatencyMs: 34,
          codegenLatencyMs: 56,
          generatedLoc: 78,
          estimatedMinutesSaved: 35,
          copyCount: 2,
          pasteCount: 3,
          exportCount: 4,
          lineCount: 91,
          entityCount: 5,
          relationCount: 6,
        }}
      />,
    );

    expect(host.querySelector('[aria-label="Метрики"]')).not.toBeNull();
    expect(host.textContent).toContain('Компиляция');
    expect(host.textContent).toContain('Сгенерированные строки кода');
    expect(host.textContent).toContain('Сэкономленное время');
    expect(host.textContent).toContain('Строки исходника');
    cleanup();
  });

  it('MetricsDrawer localizes dialog chrome', () => {
    const { host, cleanup } = render(
      <MetricsDrawer
        open
        uiLanguage="ro"
        onClose={vi.fn()}
        metrics={{ generatedLoc: 12 }}
      />,
    );

    expect(host.querySelector('[aria-label="Raport de metrici"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="Închide metricile"]')).not.toBeNull();
    expect(host.textContent).toContain('Metrici');
    cleanup();
  });

  it('FullCanvasShell exposes an Excalidraw-style floating tool palette', () => {
    const onModeChange = vi.fn();
    const diagram: IOMDiagram = {
      name: 'CanvasDiagram',
      kind: 'class',
      entities: new Map(),
      relations: [],
      packages: [],
      notes: [],
      config: {},
      styles: {},
      fragments: [],
      activations: [],
      partitions: [],
    };
    const { host, cleanup } = render(
      <FullCanvasShell
        diagram={diagram}
        mode="move"
        onModeChange={onModeChange}
        onExportSVG={vi.fn()}
        onExportPNG={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    for (const label of ['Lock tool', 'Select', 'Hand', 'Rectangle', 'Ellipse', 'Arrow', 'Line', 'Pen', 'Text', 'Image', 'Eraser', 'More tools']) {
      expect(host.querySelector(`[aria-label="${label}"]`)).not.toBeNull();
    }

    act(() => host.querySelector('[aria-label="Rectangle"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(onModeChange).toHaveBeenCalledWith('rectangle');
    expect(host.querySelector('.iso-full-canvas-shell')).not.toBeNull();
    expect(host.querySelector('.iso-full-canvas-toolbar')).not.toBeNull();
    cleanup();
  });
});
