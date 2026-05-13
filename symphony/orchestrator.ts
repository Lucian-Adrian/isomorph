import type { DispatchPlan, Issue } from './types.js';

export interface OrchestratorOptions {
  maxConcurrentAgents: number;
  activeStates: string[];
  terminalStates: string[];
}

export function createOrchestrator(options: OrchestratorOptions) {
  const active = new Set(options.activeStates.map(state => state.toLowerCase()));
  const terminal = new Set(options.terminalStates.map(state => state.toLowerCase()));
  const claimed = new Set<string>();

  function isBlocked(issue: Issue): boolean {
    return issue.blocked_by.some(ref => !ref.state || !terminal.has(ref.state.toLowerCase()));
  }

  return {
    claimed,
    release(issueId: string) {
      claimed.delete(issueId);
    },
    planDispatch(issues: Issue[]): DispatchPlan {
      const plan: DispatchPlan = { dispatch: [], blocked: [], ignored: [] };
      for (const issue of issues) {
        const state = issue.state.toLowerCase();
        if (terminal.has(state) || !active.has(state) || claimed.has(issue.id)) {
          plan.ignored.push(issue);
          continue;
        }
        if (isBlocked(issue)) {
          plan.blocked.push(issue);
          continue;
        }
        if (plan.dispatch.length < options.maxConcurrentAgents) {
          plan.dispatch.push(issue);
          claimed.add(issue.id);
        } else {
          plan.ignored.push(issue);
        }
      }
      return plan;
    },
  };
}
