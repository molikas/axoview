# Behavioural-Contract Regression Suite

> Folder name is historical (`__perf_refactor_regression__`). These tests began
> as guards for the performance refactoring (the Canvas2D → WebGL substrate work,
> ADR 0019 → ADR 0038, shipped 2026-07-08). That refactoring is **done**; the
> folder is now a general **behavioural-contract** regression suite and is no
> longer frozen. (A rename to `__regression__` is a safe follow-up — nothing
> outside the folder references the name; jest discovers tests by glob.)

## What lives here

Tests that pin **cross-cutting behavioural contracts** — store/reducer shapes,
subscription ownership, undo/redo, interaction-mode logic, i18n completeness,
render isolation — as opposed to the single-unit tests in `src/**/__tests__/`.
Keeping them together makes the "what must not regress" surface reviewable.

## Rules

- These are contract tests: change one only when the contract it pins is
  **intentionally** changing, and note why in the diff/commit (e.g.
  `connector.renderIsolation` was re-pointed when the `useScene` subscription
  moved from `Connectors` up to `Renderer` in the GPU fold).
- All tests here must be green on `master` / `integration`.
- Run: `npm test --workspace=packages/axoview-lib -- --testPathPattern=__perf_refactor_regression__`
