# Engine perf baseline

_Generated 2026-06-15T23:32:34.996Z by packages/axoview-e2e/perf/engine-perf.spec.ts_

**KR1: NOT CERTIFIED** — worst load-bearing noise band 13.5% ≥ 10%. Numbers below are directional only (see perf-results/decision-log.md).

Median across 8 kept runs (3 per-cell warm-up runs + a global warm-up discarded first). Noise band = coefficient of variation (stddev/mean) of the per-run **continuous** headline metric (**spawn → settle time** = commit→idle wall time; **drag → mean frame time**) — a real run-to-run variance measure, robust to the vsync quantization that makes frame-time percentiles bimodal. Frame budget @60fps = 16.6 ms.

**Scene (realistic, per N):** N nodes (5 icon types ≈1.7 KB each, varied label colours, ~20% with a description, ~12% with notes) + ~N connectors (⅓ labelled) + grouping rectangles. **Spawn** commits the whole scene in one store write (paste / import / diagram-open). **Drag** drags a connected in-grid node through OCCUPIED tiles → per-frame collision checks + connector re-route. (Text boxes excluded — their scene-side size derivation is incompatible with a bulk model.set.)

**Machine calibration index: 3.3 ms** (fixed CPU workload, this session). Cross-session machine drift was measured at ~22% (≫ the ~2% within-run noise), so absolute numbers are comparable only between runs with a similar index — **keep/revert decisions must be same-session A/B**, never a fresh run vs a prior-session baseline.

## spawn

| N | p50 (ms) | p95 (ms) | mean frame (ms) | longest frame (ms) | settle (ms) | long-task total (ms) | kept runs | noise band (CoV) |
|---|---|---|---|---|---|---|---|---|
| 25 | 16.7 | 16.7 | 16.66 | 16.7 | 83.3 | 0 | 8 | 0.1% |
| 50 | 16.7 | 16.7 | 16.66 | 16.7 | 83.3 | 0 | 8 | 0.1% |
| 100 | 16.7 | 16.7 | 16.68 | 16.7 | 83.4 | 0 | 8 | 0.1% |
| 200 | 16.7 | 16.7 | 16.66 | 16.7 | 83.3 | 0 | 8 | 13.5% |
| 500 | 16.7 | 41.67 | 22.22 | 50 | 133.3 | 0 | 8 | 0% |
| 1000 | 16.7 | 66.65 | 27.77 | 83.3 | 166.6 | 74 | 8 | 0% |

## drag

| N | p50 (ms) | p95 (ms) | mean frame (ms) | longest frame (ms) | settle (ms) | long-task total (ms) | kept runs | noise band (CoV) |
|---|---|---|---|---|---|---|---|---|
| 25 | 16.7 | 16.7 | 16.67 | 16.8 | 1333.3 | 0 | 8 | 0% |
| 50 | 16.7 | 16.7 | 16.67 | 16.8 | 1333.3 | 0 | 8 | 0.4% |
| 100 | 16.7 | 16.75 | 16.67 | 16.8 | 1333.3 | 0 | 8 | 0% |
| 200 | 16.7 | 16.71 | 16.67 | 16.8 | 1333.3 | 0 | 8 | 0% |
| 500 | 16.7 | 16.8 | 17.08 | 33.35 | 1366.6 | 0 | 8 | 0.6% |
| 1000 | 16.7 | 16.75 | 17.29 | 66.7 | 1383.3 | 67 | 8 | 0.9% |

## Guardrail — idle floor (KR3)

**KR3: PASS** — 60s with zero entities on canvas. Charter bar: idle heap flat ±5% (retained after GC) AND zero long tasks.

| metric | value |
|---|---|
| heap start | 82.4 MB |
| heap peak | 82.4 MB |
| heap after final GC | 82.4 MB |
| retained growth (leak) | 0 MB (0%) |
| long tasks at idle | 0 |
| idle frame p95 / max | 16.8 / 33.4 ms |
