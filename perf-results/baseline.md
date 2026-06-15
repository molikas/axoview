# Engine perf baseline

_Generated 2026-06-15T03:30:45.602Z by packages/axoview-e2e/perf/engine-perf.spec.ts_

**KR1: NOT CERTIFIED (PROVISIONAL)** — worst noise band 100% ≥ 10%. Numbers below are directional only until the harness noise floor is < 10% (see perf-results/decision-log.md).

Median across kept runs (first of 8 discarded as warm-up). Headline noise band = (max−min)/median of the per-run headline metric (spawn→longest frame, drag→p95). Frame budget @60fps = 16.6 ms.

## spawn

| N | p50 (ms) | p95 (ms) | longest frame (ms) | long-task total (ms) | kept runs | noise band |
|---|---|---|---|---|---|---|
| 25 | 16.7 | 16.8 | 216.7 | 482 | 7 | 23.1% |
| 50 | 16.7 | 16.8 | 283.3 | 632 | 7 | 88.2% |
| 100 | 16.7 | 16.8 | 233.4 | 499 | 7 | 50% |
| 200 | 808.3 | 1096.54 | 1133.2 | 1655 | 7 | 50% |
| 500 | 891.7 | 1247.37 | 1283.3 | 1787 | 7 | 50.6% |
| 1000 | 824.95 | 1042.44 | 1066.6 | 1294 | 7 | 100% |

## drag

| N | p50 (ms) | p95 (ms) | longest frame (ms) | long-task total (ms) | kept runs | noise band |
|---|---|---|---|---|---|---|
| 25 | 16.7 | 16.8 | 50 | 63 | 7 | 0.6% |
| 50 | 16.7 | 16.71 | 33.3 | 57 | 7 | 0.6% |
| 100 | 16.7 | 16.8 | 50 | 241 | 7 | 98.8% |
| 200 | 16.7 | 33.31 | 183.2 | 393 | 7 | 49.9% |
| 500 | 16.7 | 34.22 | 116.7 | 370 | 7 | 97% |
| 1000 | 16.7 | 34.23 | 133.2 | 320 | 7 | 48.8% |
