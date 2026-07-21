// The golden-replay GATE (ADR 0047 §3 GATE, §5). Runs in CI with NO model in the
// loop and zero token cost: each task's recorded transcript is replayed through
// the live verb layer; the resulting Model is structurally diffed against the
// golden and the round-trip count is asserted within budget. Fails the build on a
// round-trip-count regression OR a correctness diff — exactly what a regression
// gate should pin (contract + layout + surface wiring, not a model's choices).

import { makeHarness, replay, EVAL_VIEW_ID } from './harness';
import { normalize, diff } from './structuralDiff';
import { TASK_SUITE, EvalTask } from './taskSuite';
import { ApplyOpsResult } from '../types';

const runTask = (task: EvalTask) => {
  const h = makeHarness();
  if (task.setup) replay(h, task.setup);
  h.resetCount(); // only the measured calls count toward the budget

  const measured = task.build(h.model());
  const last = replay(h, measured);

  return {
    roundTrips: h.callCount(),
    graph: normalize(h.model(), EVAL_VIEW_ID),
    last: last as ApplyOpsResult
  };
};

describe('agent-interaction GATE — golden-transcript replay (ADR 0047)', () => {
  it.each(TASK_SUITE.map((t) => [t.name, t] as const))(
    'task "%s": correct Model within round-trip budget',
    (_name, task) => {
      const { roundTrips, graph, last } = runTask(task);

      // Axis 1 — round-trips within budget (no regression to UI-emulation crawl).
      expect(roundTrips).toBeLessThanOrEqual(task.roundTripBudget);

      // Axis 4 — structural correctness vs the golden.
      const d = diff(graph, task.golden);
      if (!d.equal) {
        throw new Error(
          `structural diff for "${task.name}":\n` +
            `  missing nodes: ${d.missingNodes.join(', ') || '—'}\n` +
            `  extra nodes:   ${d.extraNodes.join(', ') || '—'}\n` +
            `  missing edges: ${d.missingEdges.join(', ') || '—'}\n` +
            `  extra edges:   ${d.extraEdges.join(', ') || '—'}`
        );
      }
      expect(d.equal).toBe(true);

      // Recovery tasks must surface the failed op (invariant 6), not swallow it.
      if (task.expectErrors) {
        expect(last.errors.length).toBeGreaterThan(0);
      }
    }
  );

  it('every task declares a positive round-trip budget (suite hygiene)', () => {
    for (const t of TASK_SUITE) {
      expect(t.roundTripBudget).toBeGreaterThan(0);
    }
  });
});
