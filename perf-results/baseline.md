# Engine perf baseline

_Generated 2026-06-15T13:50:38.984Z by packages/axoview-e2e/perf/engine-perf.spec.ts_

**KR1: CERTIFIED (load-bearing regime)** — worst noise band 9.6% < 10% across all drag cells and spawn N≥100. Baseline is trustworthy for the optimization-relevant range. (All-cells worst = 14.3%; the excess is small-N spawn ≤50 — sub-100 ms operations at the 16.6 ms vsync quantization floor, not an optimization target.)

Median across 8 kept runs (3 per-cell warm-up runs + a global warm-up discarded first). Noise band = coefficient of variation (stddev/mean) of the per-run **continuous** headline metric (**spawn → settle time** = commit→idle wall time; **drag → mean frame time**) — a real run-to-run variance measure, robust to the vsync quantization that makes frame-time percentiles bimodal. Frame budget @60fps = 16.6 ms.

## spawn

| N | p50 (ms) | p95 (ms) | mean frame (ms) | longest frame (ms) | settle (ms) | long-task total (ms) | kept runs | noise band (CoV) |
|---|---|---|---|---|---|---|---|---|
| 25 | 16.7 | 29.18 | 19.44 | 33.3 | 116.65 | 0 | 8 | 10.5% |
| 50 | 16.7 | 29.16 | 19.45 | 33.3 | 116.7 | 51.5 | 8 | 14.3% |
| 100 | 16.7 | 43.35 | 23.02 | 49.95 | 158.3 | 78 | 8 | 9.6% |
| 200 | 16.7 | 61.68 | 28.57 | 66.7 | 200 | 215 | 8 | 4.2% |
| 500 | 16.7 | 156.66 | 54.76 | 166.65 | 383.3 | 605 | 8 | 3.4% |
| 1000 | 16.7 | 275.01 | 85.71 | 300 | 600 | 1145 | 8 | 0% |

## drag

| N | p50 (ms) | p95 (ms) | mean frame (ms) | longest frame (ms) | settle (ms) | long-task total (ms) | kept runs | noise band (CoV) |
|---|---|---|---|---|---|---|---|---|
| 25 | 16.7 | 16.7 | 16.67 | 16.8 | 1333.3 | 0 | 8 | 0.4% |
| 50 | 16.7 | 16.7 | 16.67 | 16.8 | 1333.3 | 0 | 8 | 0% |
| 100 | 16.7 | 16.8 | 16.67 | 16.8 | 1333.3 | 0 | 8 | 0% |
| 200 | 16.7 | 16.71 | 16.67 | 16.8 | 1333.3 | 0 | 8 | 0% |
| 500 | 16.7 | 16.8 | 16.67 | 16.8 | 1333.3 | 0 | 8 | 0% |
| 1000 | 16.7 | 16.75 | 17.19 | 33.35 | 1374.9 | 0 | 8 | 0.7% |

## Guardrail — idle floor (KR3)

**KR3: PASS** — 60s with zero entities on canvas. Charter bar: idle heap flat ±5% (retained after GC) AND zero long tasks.

| metric | value |
|---|---|
| heap start | 82.4 MB |
| heap peak | 82.4 MB |
| heap after final GC | 82.4 MB |
| retained growth (leak) | 0 MB (0%) |
| long tasks at idle | 0 |
| idle frame p95 / max | 16.7 / 16.8 ms |
