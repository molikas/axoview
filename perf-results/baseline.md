# Engine perf baseline

_Generated 2026-06-15T04:52:57.018Z by packages/axoview-e2e/perf/engine-perf.spec.ts_

**KR1: CERTIFIED (load-bearing regime)** — worst noise band 5.5% < 10% across all drag cells and spawn N≥100. Baseline is trustworthy for the optimization-relevant range. (All-cells worst = 6.5%; the excess is small-N spawn ≤50 — sub-100 ms operations at the 16.6 ms vsync quantization floor, not an optimization target.)

Median across 8 kept runs (3 per-cell warm-up runs + a global warm-up discarded first). Noise band = coefficient of variation (stddev/mean) of the per-run **continuous** headline metric (**spawn → settle time** = commit→idle wall time; **drag → mean frame time**) — a real run-to-run variance measure, robust to the vsync quantization that makes frame-time percentiles bimodal. Frame budget @60fps = 16.6 ms.

## spawn

| N | p50 (ms) | p95 (ms) | mean frame (ms) | longest frame (ms) | settle (ms) | long-task total (ms) | kept runs | noise band (CoV) |
|---|---|---|---|---|---|---|---|---|
| 25 | 16.7 | 41.69 | 22.22 | 50 | 133.3 | 0 | 8 | 0% |
| 50 | 16.7 | 45.04 | 23.81 | 50.05 | 166.65 | 99 | 8 | 6.5% |
| 100 | 16.7 | 72.46 | 32.14 | 74.95 | 224.95 | 268.5 | 8 | 5.5% |
| 200 | 16.7 | 131.67 | 47.61 | 141.65 | 333.3 | 500.5 | 8 | 5.2% |
| 500 | 16.7 | 306.64 | 97.61 | 316.7 | 683.3 | 1221.5 | 8 | 2.7% |
| 1000 | 16.7 | 594.1 | 172.61 | 633.3 | 1208.3 | 2383 | 8 | 2.8% |

## drag

| N | p50 (ms) | p95 (ms) | mean frame (ms) | longest frame (ms) | settle (ms) | long-task total (ms) | kept runs | noise band (CoV) |
|---|---|---|---|---|---|---|---|---|
| 25 | 16.7 | 16.7 | 16.67 | 16.8 | 1333.25 | 0 | 8 | 0% |
| 50 | 16.7 | 16.7 | 16.67 | 16.8 | 1333.25 | 0 | 8 | 0% |
| 100 | 16.7 | 16.7 | 16.67 | 16.8 | 1333.3 | 0 | 8 | 0% |
| 200 | 16.7 | 16.8 | 16.67 | 16.8 | 1333.3 | 0 | 8 | 0% |
| 500 | 16.7 | 16.8 | 17.19 | 33.4 | 1374.95 | 0 | 8 | 0.9% |
| 1000 | 16.7 | 17.63 | 18.13 | 83.3 | 1450 | 144.5 | 8 | 2.8% |

## Guardrail — idle floor (KR3)

**KR3: PASS** — 60s with zero entities on canvas. Charter bar: idle heap flat ±5% (retained after GC) AND zero long tasks.

| metric | value |
|---|---|
| heap start | 82.4 MB |
| heap peak | 82.4 MB |
| heap after final GC | 82.4 MB |
| retained growth (leak) | 0 MB (0%) |
| long tasks at idle | 0 |
| idle frame p95 / max | 16.8 / 66.6 ms |
