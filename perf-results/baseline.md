# Engine perf baseline

_Generated 2026-06-15T14:13:31.320Z by packages/axoview-e2e/perf/engine-perf.spec.ts_

**KR1: CERTIFIED (load-bearing regime)** — worst noise band 4.3% < 10% across all drag cells and spawn N≥100. Baseline is trustworthy for the optimization-relevant range. (All-cells worst = 18.6%; the excess is small-N spawn ≤50 — sub-100 ms operations at the 16.6 ms vsync quantization floor, not an optimization target.)

Median across 8 kept runs (3 per-cell warm-up runs + a global warm-up discarded first). Noise band = coefficient of variation (stddev/mean) of the per-run **continuous** headline metric (**spawn → settle time** = commit→idle wall time; **drag → mean frame time**) — a real run-to-run variance measure, robust to the vsync quantization that makes frame-time percentiles bimodal. Frame budget @60fps = 16.6 ms.

## spawn

| N | p50 (ms) | p95 (ms) | mean frame (ms) | longest frame (ms) | settle (ms) | long-task total (ms) | kept runs | noise band (CoV) |
|---|---|---|---|---|---|---|---|---|
| 25 | 16.7 | 16.78 | 16.67 | 16.8 | 83.35 | 0 | 8 | 18% |
| 50 | 16.7 | 28.73 | 19.25 | 33.3 | 116.6 | 0 | 8 | 18.6% |
| 100 | 16.7 | 33.37 | 21.43 | 33.4 | 150 | 76 | 8 | 4% |
| 200 | 16.7 | 64.17 | 29.76 | 66.7 | 208.35 | 250.5 | 8 | 4.3% |
| 500 | 16.7 | 136.67 | 50 | 141.7 | 350 | 566 | 8 | 4% |
| 1000 | 16.7 | 251.63 | 80.94 | 266.65 | 566.6 | 1074.5 | 8 | 1.9% |

## drag

| N | p50 (ms) | p95 (ms) | mean frame (ms) | longest frame (ms) | settle (ms) | long-task total (ms) | kept runs | noise band (CoV) |
|---|---|---|---|---|---|---|---|---|
| 25 | 16.7 | 16.71 | 16.67 | 16.8 | 1333.3 | 0 | 8 | 0% |
| 50 | 16.7 | 16.7 | 16.67 | 16.8 | 1333.3 | 0 | 8 | 0% |
| 100 | 16.7 | 16.71 | 16.67 | 16.8 | 1333.25 | 0 | 8 | 0% |
| 200 | 16.7 | 16.7 | 16.67 | 16.8 | 1333.3 | 0 | 8 | 0% |
| 500 | 16.7 | 16.7 | 16.67 | 16.8 | 1333.3 | 0 | 8 | 0% |
| 1000 | 16.7 | 16.8 | 17.29 | 50 | 1383.2 | 0 | 8 | 0.6% |

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
