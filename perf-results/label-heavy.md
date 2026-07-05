# Label-heavy node spawn — B/I/S + colour + varied px on every node label

_Generated 2026-06-30T07:50:39.058Z · 7 kept runs/cell (2 warm-up), cal 3.2 ms. Every node label carries bold/italic/strikethrough + a non-default colour + a varied font size — the heaviest Canvas2D label-draw path. Compare settle/p95 vs the bare-node spawn baseline (baseline.md) to gate the node-label styling surface._

| N | drawn | commit (ms) | settle (ms) | p95 frame (ms) | longest (ms) | noise (CoV settle) |
|---|---|---|---|---|---|---|
| 200 | 200/200 | 24.4 | 116.7 | 29.22 | 33.3 | 10.6% |
| 500 | 500/500 | 121.5 | 150 | 54.2 | 66.7 | 5.7% |
| 1000 | 1000/1000 | 512.6 | 199.9 | 79.99 | 100.1 | 6.5% |
