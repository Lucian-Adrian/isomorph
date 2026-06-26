// ============================================================
// Isomorph — Diagram Stencils (UI Icons)
// ============================================================
// Pure SVG stencils for the sidebar shape selector.
// Extracted from App.tsx during demonolith decomposition.
// ============================================================

import React from 'react';
import type { DiagramKind } from '../types/index.js';

export function getStencilsForKind(kind?: DiagramKind): { label: string; keyword: string; icon?: React.JSX.Element }[] {
  const SvgClass = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line></svg>;
  const SvgAbstractClass = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line></svg>;
  const SvgInterface = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>;
  const SvgEnum = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>;
  const SvgPackage = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>;
  const SvgNote = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>;
  const SvgActor = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="7" r="4"></circle><path d="M5.5 21v-2a4 4 0 0 1 4-4h5a4 4 0 0 1 4 4v2"></path></svg>;
  const SvgUseCase = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="12" rx="10" ry="6"></ellipse></svg>;
  const SvgSystem = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>;
  const SvgComponent = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect></svg>;
  const SvgNode = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>;
  const SvgArtifact = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>;
  const SvgEnvironment = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>;

  const SvgParticipant = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>;
  const SvgFragment = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>;
  const SvgState = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="8" ry="8"></rect></svg>;
  const SvgStart = <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="12" cy="12" r="10"></circle></svg>;
  const SvgEnd = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="5" fill="currentColor"></circle></svg>;
  const SvgDecision = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 22 12 12 22 2 12 12 2"></polygon></svg>;
  const SvgFork = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="6"><line x1="2" y1="12" x2="22" y2="12"></line></svg>;

  switch (kind) {
    case 'class':
      return [
        { label: 'Class', keyword: 'class', icon: SvgClass },
        { label: 'Abstract Class', keyword: 'abstract class', icon: SvgAbstractClass },
        { label: 'Interface', keyword: 'interface', icon: SvgInterface },
        { label: 'Enum', keyword: 'enum', icon: SvgEnum },
        { label: 'Package', keyword: 'package', icon: SvgPackage },
        { label: 'Note', keyword: 'note', icon: SvgNote },
      ];
    case 'usecase':
      return [
        { label: 'Actor', keyword: 'actor', icon: SvgActor },
        { label: 'Use Case', keyword: 'usecase', icon: SvgUseCase },
        { label: 'System', keyword: 'system', icon: SvgSystem },
        { label: 'Note', keyword: 'note', icon: SvgNote },
      ];
    case 'component':
      return [
        { label: 'Component', keyword: 'component', icon: SvgComponent },
        { label: 'Interface', keyword: 'interface', icon: SvgInterface },
        { label: 'Note', keyword: 'note', icon: SvgNote },
      ];
    case 'deployment':
      return [
        { label: 'Node', keyword: 'node', icon: SvgNode },
        { label: 'Component', keyword: 'component', icon: SvgComponent },
        { label: 'Device', keyword: 'node <<device>>', icon: SvgNode },
        { label: 'Artifact', keyword: 'artifact', icon: SvgArtifact },
        { label: 'Environment', keyword: 'environment', icon: SvgEnvironment },
        { label: 'Note', keyword: 'note', icon: SvgNote },
      ];
    case 'sequence':
      return [
        { label: 'Actor', keyword: 'actor', icon: SvgActor },
        { label: 'Participant', keyword: 'participant', icon: SvgParticipant },
        { label: 'Alt Fragment', keyword: 'alt', icon: SvgFragment },
        { label: 'Loop Fragment', keyword: 'loop', icon: SvgFragment },
        { label: 'Opt Fragment', keyword: 'opt', icon: SvgFragment },
        { label: 'Par Fragment', keyword: 'par', icon: SvgFragment },
        { label: 'Break Fragment', keyword: 'break', icon: SvgFragment },
        { label: 'Critical Fragment', keyword: 'critical', icon: SvgFragment },
        { label: 'Note', keyword: 'note', icon: SvgNote },
      ];
    case 'state':
      return [
        { label: 'State', keyword: 'state', icon: SvgState },
        { label: 'Start Node', keyword: 'start', icon: SvgStart },
        { label: 'Final Node', keyword: 'stop', icon: SvgEnd },
        { label: 'Decision', keyword: 'decision', icon: SvgDecision },
        { label: 'Fork', keyword: 'fork', icon: SvgFork },
        { label: 'Join', keyword: 'join', icon: SvgFork },
        { label: 'History', keyword: 'history', icon: SvgState },
        { label: 'Concurrent', keyword: 'concurrent', icon: SvgState },
        { label: 'Composite', keyword: 'composite', icon: SvgState },
        { label: 'Note', keyword: 'note', icon: SvgNote },
      ];
    case 'activity':
      return [
        { label: 'Action', keyword: 'action', icon: SvgState },
        { label: 'Start Node', keyword: 'start', icon: SvgStart },
        { label: 'Activity Final', keyword: 'stop', icon: SvgEnd },
        { label: 'Decision', keyword: 'decision', icon: SvgDecision },
        { label: 'Merge', keyword: 'merge', icon: SvgDecision },
        { label: 'Fork', keyword: 'fork', icon: SvgFork },
        { label: 'Join', keyword: 'join', icon: SvgFork },
        { label: 'Partition', keyword: 'partition', icon: SvgSystem },
        { label: 'Note', keyword: 'note', icon: SvgNote },
      ];
    case 'collaboration':
      return [
        { label: 'Object', keyword: 'object', icon: SvgParticipant },
        { label: 'Actor', keyword: 'actor', icon: SvgActor },
        { label: 'Multiobject', keyword: 'multiobject', icon: SvgSystem },
        { label: 'Active Object', keyword: 'active_object', icon: SvgParticipant },
        { label: 'Composite Obj', keyword: 'composite_object', icon: SvgState },
        { label: 'Note', keyword: 'note', icon: SvgNote },
      ];
    case 'flow':
      return [
        { label: 'Process', keyword: 'action', icon: SvgState },
        { label: 'Decision', keyword: 'decision', icon: SvgDecision },
        { label: 'Start', keyword: 'start', icon: SvgStart },
        { label: 'End', keyword: 'stop', icon: SvgEnd },
        { label: 'Fork', keyword: 'fork', icon: SvgFork },
        { label: 'Join', keyword: 'join', icon: SvgFork },
        { label: 'Note', keyword: 'note', icon: SvgNote },
      ];
    default:
      return [];
  }
}
