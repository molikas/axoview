# Floating-label-heavy spawn — N DOM Label chips (B/I/U/S + colour + background)

_Generated 2026-06-30T07:52:56.512Z · 7 kept runs/cell (2 warm-up), cal 3.2 ms. N floating Labels (textBox variant:"label") over the realistic node/connector/rect base. Floating labels are DOM (the scaling surface ADR 0019 moved nodes off of), so this is the scenario that decides the Label render substrate (DOM vs Canvas2D) for ADR 0031 E3. labels=N/N anti-cheats that every chip rendered._

| N | drawn | commit (ms) | settle (ms) | p95 frame (ms) | longest (ms) | noise (CoV settle) |
|---|---|---|---|---|---|---|
| 200 | 200/200 labels=200/200 | 37.5 | 316.7 | 83.4 | 83.4 | 16.5% |
| 500 | 500/500 labels=500/500 | 199.3 | 316.6 | 66.7 | 66.7 | 9.8% |
| 1000 | 1000/1000 labels=1000/1000 | 814.4 | 599.9 | 184.96 | 199.9 | 1% |
