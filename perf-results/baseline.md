# Engine perf baseline

_Generated 2026-06-15T16:02:59.656Z by packages/axoview-e2e/perf/engine-perf.spec.ts_

**KR1: CERTIFIED (load-bearing regime)** — worst noise band 5.4% < 10% across all drag cells and spawn N≥100. Baseline is trustworthy for the optimization-relevant range. (All-cells worst = 17.8%; the excess is small-N spawn ≤50 — sub-100 ms operations at the 16.6 ms vsync quantization floor, not an optimization target.)

Median across 8 kept runs (3 per-cell warm-up runs + a global warm-up discarded first). Noise band = coefficient of variation (stddev/mean) of the per-run **continuous** headline metric (**spawn → settle time** = commit→idle wall time; **drag → mean frame time**) — a real run-to-run variance measure, robust to the vsync quantization that makes frame-time percentiles bimodal. Frame budget @60fps = 16.6 ms.

**Scene (realistic, per N):** N nodes (5 icon types ≈1.7 KB each, varied label colours, ~20% with a description, ~12% with notes) + ~N connectors (⅓ labelled) + grouping rectangles. **Spawn** commits the whole scene in one store write (paste / import / diagram-open). **Drag** drags a connected in-grid node through OCCUPIED tiles → per-frame collision checks + connector re-route. (Text boxes excluded — their scene-side size derivation is incompatible with a bulk model.set.)

**Machine calibration index: 3.2 ms** (fixed CPU workload, this session). Cross-session machine drift was measured at ~22% (≫ the ~2% within-run noise), so absolute numbers are comparable only between runs with a similar index — **keep/revert decisions must be same-session A/B**, never a fresh run vs a prior-session baseline.

## spawn

| N | p50 (ms) | p95 (ms) | mean frame (ms) | longest frame (ms) | settle (ms) | long-task total (ms) | kept runs | noise band (CoV) |
|---|---|---|---|---|---|---|---|---|
| 25 | 16.7 | 22.93 | 18.06 | 25 | 100 | 0 | 8 | 17.8% |
| 50 | 16.7 | 29.23 | 19.45 | 33.4 | 116.7 | 0 | 8 | 0.1% |
| 100 | 16.7 | 41.69 | 22.22 | 50 | 133.3 | 81.5 | 8 | 0% |
| 200 | 16.7 | 66.65 | 27.77 | 83.3 | 166.6 | 238 | 8 | 5.4% |
| 500 | 16.7 | 129.2 | 41.67 | 166.7 | 250 | 627.5 | 8 | 3.4% |
| 1000 | 16.7 | 241.64 | 66.67 | 316.6 | 400 | 1405.5 | 8 | 2.2% |

## drag

| N | p50 (ms) | p95 (ms) | mean frame (ms) | longest frame (ms) | settle (ms) | long-task total (ms) | kept runs | noise band (CoV) |
|---|---|---|---|---|---|---|---|---|
| 25 | 16.7 | 16.7 | 16.67 | 16.8 | 1333.3 | 0 | 8 | 0% |
| 50 | 16.7 | 16.7 | 16.67 | 16.8 | 1333.3 | 0 | 8 | 0% |
| 100 | 16.7 | 16.71 | 16.67 | 16.8 | 1333.3 | 0 | 8 | 0% |
| 200 | 16.7 | 16.7 | 16.67 | 16.8 | 1333.25 | 0 | 8 | 1.8% |
| 500 | 33.3 | 42.11 | 30.21 | 50.1 | 2416.55 | 118.5 | 8 | 1.4% |
| 1000 | 16.7 | 16.8 | 16.87 | 33.3 | 1349.95 | 0 | 8 | 0% |

## Guardrail — idle floor (KR3)

**KR3: PASS** — 60s with zero entities on canvas. Charter bar: idle heap flat ±5% (retained after GC) AND zero long tasks.

| metric | value |
|---|---|
| heap start | 77.6 MB |
| heap peak | 77.6 MB |
| heap after final GC | 77.6 MB |
| retained growth (leak) | 0 MB (0%) |
| long tasks at idle | 0 |
| idle frame p95 / max | 16.7 / 33.3 ms |
