// MEASURE driver (ADR 0047 §3 MEASURE, the metric of record). Replays the task
// suite with a REAL model in the loop, counts tool calls, and structurally diffs
// the result against the golden. It costs API tokens (a dev/CI cost, unrelated to
// how end users pay — they use their own subscription, ADR 0046) so it is NOT a
// jest test; it is a function a dev script wires to an AI SDK model.
//
// The lib stays SDK-free: the caller injects a `solve` that, given a prompt + the
// harness surface, drives the model's tool-calling loop (e.g. via runAgentTurn +
// buildAgentTools in axoview-app, or the MCP transport). This module owns the
// measurement protocol; the transport/model is pluggable. Skill A/B (ADR 0047 axis
// 3) = run with `withSkill: true|false`.

import { makeHarness, EVAL_VIEW_ID, replay } from './harness';
import { normalize, diff } from './structuralDiff';
import { TASK_SUITE, EvalTask } from './taskSuite';
import { AgentSurface } from '../createAgentSurface';

export interface TaskRecord {
  task: string;
  prompt: string;
  roundTrips: number;
  budget: number;
  withinBudget: boolean;
  correct: boolean;
  verdict: 'PASS' | 'FAIL';
  diffSummary?: string;
}

// The injected model driver: run the prompt against the surface (which counts
// round-trips) and return when done. Its return value is ignored — the resulting
// canvas is read from the surface.
export type Solve = (params: {
  prompt: string;
  surface: AgentSurface;
  withSkill: boolean;
}) => Promise<void>;

export const runMeasure = async (
  solve: Solve,
  opts: { withSkill?: boolean; tasks?: EvalTask[] } = {}
): Promise<TaskRecord[]> => {
  const withSkill = opts.withSkill ?? true;
  const tasks = opts.tasks ?? TASK_SUITE;
  const records: TaskRecord[] = [];

  for (const task of tasks) {
    const h = makeHarness();
    if (task.setup) replay(h, task.setup);
    h.resetCount();

    await solve({ prompt: task.prompt, surface: h.surface, withSkill });

    const graph = normalize(h.model(), EVAL_VIEW_ID);
    const d = diff(graph, task.golden);
    const roundTrips = h.callCount();
    const withinBudget = roundTrips <= task.roundTripBudget;
    const correct = d.equal;

    records.push({
      task: task.name,
      prompt: task.prompt,
      roundTrips,
      budget: task.roundTripBudget,
      withinBudget,
      correct,
      verdict: withinBudget && correct ? 'PASS' : 'FAIL',
      diffSummary: d.equal
        ? undefined
        : `missing nodes [${d.missingNodes}] extra [${d.extraNodes}] missing edges [${d.missingEdges.join('|')}]`
    });
  }

  return records;
};
