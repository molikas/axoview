# Phaser 4 Render-Engine Evaluation — Performance Findings (2026-07-19)

**Verdict: 🔴 NO-GO.** Phaser 4 cannot replace the bespoke WebGL2 instanced
substrate ([ADR 0038](../adr/0038-webgl-instanced-render-substrate.md)) as
Axoview's bulk renderer. A timeboxed go/no-go performance spike measured a
batched Phaser scene against the live substrate on real GPU hardware; Phaser's
pan/zoom cost is **O(visible objects) per frame** where the substrate is
**O(1)**, so it misses 60 fps above ~1,000 nodes and is ~9× slower at 20k. The
finding is architectural, not tunable. This note is the durable record; the
spike code, the `phaser` dependency, and the scaffolded ADRs were reverted.

## What was evaluated, and why

The idea: replace the hand-rolled WebGL2 substrate (`glSpriteBatch` — O(1)-CPU
pan, 60 fps to ~20k nodes, but ~1,000 LOC of private GL engine we maintain
alone) with **Phaser 4.2.1** as the bulk renderer, on the hypothesis that a
continuously-optimized game engine would *sustainably out-optimize* what we can
build part-time. Per the repo's discipline
([ADR 0020](../adr/0020-engine-perf-harness-and-measurement-protocol.md) §7 — a
measured proof precedes an architectural overhaul), that hypothesis was put to a
gate before any porting.

The spike implemented the batched object model a Phaser port would require (not
idiomatic per-item containers, which don't scale): **one texture atlas → a
`Blitter` of bobs for nodes**, **viewport-chunked `Graphics` for connectors**
(with integer-indexed dash/dot walkers), and **counter-scaled `Image` sprites
for labels**. It was measured against the real WebGL substrate rendering a
comparable scene (N nodes + connectors + labels).

## Method

- **Same-session A/B**, real GPU (**NVIDIA RTX 4070 Laptop / D3D11**), AC power,
  [ADR 0020](../adr/0020-engine-perf-harness-and-measurement-protocol.md)
  protocol: median-of-6, warm-up discarded, coefficient-of-variation reported,
  machine calibration index matched (3.1–3.8 ms; the repo baseline session was
  3.3 ms). CoV was < 4 % on every pan/zoom cell.
- **Fit-to-view** so all N objects are drawn each frame (the static-structures
  regime the substrate is built for), with a draw-count anti-cheat asserting
  both substrates actually painted all N.
- Phaser booted through the **real production build pipeline** (rslib/rsbuild)
  under the deployed CSP.

## Findings

### 1. CSP — PASS (not a blocker)

Phaser 4.2.1 boots and renders (its WebGL renderer, exercising Blitter +
Graphics + Image paths) under the exact deployed strict CSP
(`script-src 'self'`, **no `unsafe-eval`**) with **zero**
`securitypolicyviolation`s. There is no `eval` / `Function` / WebAssembly in the
render path — the single `new Function('return this')` in the bundle is
dead code behind a `typeof globalThis === 'object'` guard. CSP does not block
Phaser.

### 2. Bundle cost — +1.37 MB raw / +355 kB gzip (not a blocker on its own)

Phaser adds ≈355 kB gzip to the `/app` editor bundle, which rsbuild
auto-code-splits into its own async chunk (so it is lazy-loadable). Material but
not disqualifying by itself.

### 3. Pan/zoom at scale — the decisive result

Fit-to-view, all N drawn, p95 frame time (ms), 60 fps budget = 16.7 ms:

| N | WebGL pan / zoom | Phaser pan / zoom | Phaser fps | Phaser main-thread long-tasks* |
|---|---|---|---|---|
| 1,000 | 16.7 / 16.8 | **16.7 / 16.7** | 60 | 0 |
| 2,000 | 16.8 / 17.6 | **33.4 / 33.4** | 30 | 0 |
| 5,000 | 16.8 / 16.8 | **50 / 50** | 20 | 0 |
| 10,000 | 16.7 / 16.7 | **83 / 83** | 12 | 5.8 s |
| 20,000 | 16.8 / 16.7 | **150 / 150** | 6–7 | 10.6 s |

*long-tasks accumulated over a single ~13 s sustained-pan measurement.

- **The WebGL substrate is flat 16.7 ms (60 fps) at every N** — its geometry
  build-count stays 0 across a pan (`buildΔ = 0`): pan/zoom is a **single
  uniform write** against a static instance buffer, O(1) CPU.
- **Phaser scales linearly, O(N)** — 60 fps only to ~1,000 nodes; 3× the budget
  at 5k; ~9× at 20k. From 10k up the main thread is **saturated with
  long-tasks** (5.8 s, then 10.6 s of a 13 s window) — the editor would be
  visibly frozen, not merely slow.

**Root cause:** Phaser is a game engine — every frame it re-transforms and
re-batches every visible object. The substrate is O(1) because it uploads
instance geometry once and moves the viewport with one uniform; it exploits the
fact that a diagram is *static* (render-on-change). This is the property the
whole "keep everything above the substrate seam, swap only the renderer" plan
depended on, and it is exactly what a retained-mode game loop does not provide.

*(Calibration note: during this run the machine was marginally **faster** while
Phaser was measured than while WebGL was — i.e. Phaser had the benefit of the
drift and still lost ~9×. The O(N)-vs-O(1) shape is unaffected by machine
state.)*

### 4. Even a *motionless* scene renders continuously

Phaser's spawn "settle" never falls below 20 ms/frame at N ≥ 2,000 — a **static,
un-touched 2,000-object scene renders at ~30 fps forever**, because Phaser
renders every frame unconditionally. The WebGL substrate settles to ~0-cost idle
(render-on-change). For a mostly-static editor this is a fundamental impedance
mismatch: continuous CPU/GPU/battery burn to display unchanged content.

### 5. Culling does **not** rescue it

The "real editing" regime — zoomed into a working area, most objects off-screen
— was measured with a hard viewport cull and a fixed zoom (~242 objects
visible):

| Total N | Visible | Phaser pan p95 | fps |
|---|---|---|---|
| 20,000 | ~242 | 150 ms | <20 |
| 50,000 | ~242 | 350 ms | <20 |
| 100,000 | ~242 | 683 ms | <20 |

Pan cost scales with **total N**, not with the (constant) visible count —
because Phaser iterates its entire display list every frame regardless of
visibility; culling saves the *draw*, not the *iteration*. Only true
virtualization (create/destroy objects on pan) would scale — a fundamentally
different architecture than a substrate swap. (These three cells were captured
on the Intel iGPU during the GPU incident below, but O(total-N) scaling reflects
list iteration, not fill rate, so it is GPU-independent.)

### 6. Phaser's one genuine advantage: build speed

Phaser builds the scene in **3–10 ms** (direct object creation) versus the
substrate's **0.5–14 s** React reconcile at 1k–5k. Real, but nowhere near enough
to offset a steady-state cost that is 9× over budget — and diagrams are built
once and navigated many times.

### 7. Escalation ladder — assessed, none rescue parity

The named escalations tune constants, not the complexity class:
- **Harder cull** — moot fit-to-view (nothing is off-screen); and even in the
  culled regime it is O(total N) per §5.
- **Connectors → mesh** — connectors are already cached chunked `Graphics`
  (`buildΔ = 0`, not re-tessellated per frame); they are not the dominant cost.
  Nodes (Blitter) and labels (Images) are, and they are O(N) by construction.
- **LOD-band label scaling** — trims the O(N) counter-scale on *zoom* only; pan
  is equally O(N) with zero label scaling involved.

The gap is O(visible)/frame vs O(1)/frame; no constant-factor tuning closes it.

## Decision

**Reject the Phaser render-engine swap.** The WebGL2 substrate
([ADR 0038](../adr/0038-webgl-instanced-render-substrate.md)) stands as the sole
bulk renderer. The evaluation's spike, the `phaser` dependency, and the
scaffolded engine-swap ADRs/tactical were reverted; this note is the record. If
the engine question is reopened, it must start from a *different* premise than a
substrate swap — Phaser's model requires object virtualization to reach these
scales, which is not "keep everything above the seam."

The one thing genuinely worth carrying forward is Phaser's fast scene build
(§6) — if diagram-open latency at scale ever becomes the priority, the win is in
the React-reconcile path (the substrate's real cost), not the GL renderer.

## Incidental finding — the perf harness can silently measure the wrong GPU

`packages/axoview-e2e/perf/perf.config.ts` forces ANGLE/D3D11 but does **not**
force the discrete GPU. On an Optimus laptop, when the NVIDIA dGPU is asleep (no
app holding it awake), ANGLE selects the **Intel iGPU** — and the iGPU path
**coalesces frames under load**, reporting a bogus flat 16.7 ms for scenes that
actually run at 150 ms. This surfaced when closing background apps (to reduce
noise) let the dGPU sleep, and a "cleaner" re-run silently landed on the iGPU
with physically impossible numbers (a *weaker* GPU appearing 10× faster).

**Recommendation:** add `--force-high-performance-gpu` to `perf.config.ts`'s
`launchOptions.args`. Verified: that flag deterministically selects the dGPU; the
Windows per-app GPU-preference registry key and a WebGL `powerPreference:
'high-performance'` hint were **not** sufficient on their own. Without it, any
perf baseline is only trustworthy if the logged `[perf] WebGL renderer:` line is
checked for `NVIDIA` (guidelines §11 already says SwiftShader numbers are void —
this extends the same caution to the iGPU).
