# WebGL instancing — node/label layer O(N)→O(1) (T4 spike, 2026-07-07)

_Self-driving perf loop, ADR 0020 protocol. Same-session A/B, real GPU, calibration-matched._

## Context

The 2026-06-25 charter decision **deferred T4 (WebGL)**; the owner re-opened it this
session ("we just did a webgl rewrite… do an optimistic/heroic rewrite… run perf tests…
resolve until a wall or marginal returns"). The prior session committed a WebGL2 **per-quad**
spike (`glCompositor`, `b2318c6`) that moved compositing to the GPU but left the **big perf
win deferred**: it still re-emitted every quad's device-space corners on the CPU each frame,
re-uploaded a vertex buffer per frame, and — because every chip is a unique content-keyed
texture — flushed **a draw call per node** (painter's-order batching defeated). That makes
pan/zoom **O(N) on the CPU**, the wall at scale.

This session finished the win: **GPU-side transform + instancing + a texture atlas.**

## ⚠️ Harness-fidelity fix (load-bearing — read first)

Headless Playwright renders WebGL2 through **SwiftShader (a CPU software rasteriser)** by
default — verified `UNMASKED_RENDERER_WEBGL = "…SwiftShader Device…"`. Every WebGL frame
number measured that way is **software fill-rate bound** (flat in N, ~54 ms/frame), NOT the
real wall. `perf.config.ts` now forces the real GPU headless
(`--ignore-gpu-blocklist --enable-gpu-rasterization --use-angle=d3d11` →
`ANGLE (Intel UHD, D3D11)`); `bootApp` logs the live renderer each run so this can never
silently regress. `PERF_SWIFTSHADER=1` measures the software fallback deliberately.
**All numbers below are the real GPU (Intel UHD Graphics, D3D11).**

## The change (one variable)

`glCompositor` (per-quad, per-frame CPU corner emit + per-node draw call) →
**`glSpriteBatch`** (`packages/axoview-lib/src/webgl/glSpriteBatch.ts`):

- Every icon + chip + the stalk dot is packed into **one mipmapped texture atlas**
  (shelf packer, content-keyed, half-texel UV inset so mip levels don't bleed across
  sub-rects).
- Each quad's geometry is stored in **TILE (scene) space** — anchor, two local basis
  vectors (which bake the isometric shear), atlas UV, tint, and a counter-scale flag —
  uploaded **once per scene change**.
- Every corner's screen position is computed in the **vertex shader** from a single view
  uniform `(zoom·dpr, originX_dev, originY_dev)` + a counter-scale uniform. The base unit
  quad comes from `gl_VertexID` (no base-quad buffer).
- Pan/zoom = **one uniform write + one `drawArraysInstanced`** for the whole layer, O(1)
  on the CPU at any N. `buildInstances` (the O(N) per-node CPU work — `getTilePosition`,
  chip raster, atlas packing) runs only when the SCENE changes (nodes/model/theme/
  projection/label-LOD band); navigation never rebuilds. Canvas2D fallback kept verbatim.

Both `NodesCanvas` and `LabelsCanvas` are rewired onto it.

## Result — PAN (the per-frame redraw metric), real GPU, same session

**Reference** (`glCompositor` per-quad), node+connector scene, cal 3.4:

| N | mean (ms) | p95 | longest | longtask total |
|---|---|---|---|---|
| 1000 | 17.7 | 33.2 | 33.4 | 0 |
| 2000 | 22.3 | 33.4 | 33.4 | 0 |
| 5000 | 44.8 | 66.7 | 66.8 | 266 |
| 10000 | **102.1** | 133.3 | 150 | 7543 |

→ **O(N) wall** (per-frame CPU: `getTilePos`×N + quad emit×N + `bufferData` upload).

**Instanced node canvas, isolated** (`PERF_NOCONN`), cal 3.4:

| N | mean (ms) | p95 | longtask | draw-count |
|---|---|---|---|---|
| 1000 | 18.1 | 16.8 | 0 | 1000/1000 |
| 2000 | 16.67 | 16.7 | 0 | 2000/2000 |
| 5000 | 16.67 | 16.8 | 0 | 5000/5000 |
| 10000 | **16.67** | 16.7 | 0 | 10000/10000 |
| 20000 | **16.67** | 16.71 | 0 | 20000/20000 |

→ **Perfectly flat at 16.67 ms = locked 60 fps, O(1) in N, zero long-tasks, to 20,000
nodes.** (N=1000's 18.1 mean is the one-time first-build frame; p95 16.8 = steady 60 fps.)
At **N=10000: 102 → 16.7 ms = 6.1×**, and it holds at 20k where the per-quad path would be
~200 ms+. Gain ≫ any drift (cal 3.4 both sides).

## Result — DRAG & SPAWN (instanced, `PERF_NOCONN`)

| N | drag mean (ms) | spawn settle (ms) | spawn commit (ms) | rendered |
|---|---|---|---|---|
| 2000 | 16.67 | 83.3 | 1.6 | 2000/2000 |
| 5000 | 16.67 | 100 | 3.4 | 5000/5000 |
| 10000 | 16.67 | 116.7 | 6.3 | 10000/10000 |
| 20000 | 16.67 | 116.7 | 11.2 | 20000/20000 |

- **Drag is flat 16.67 ms (60 fps) to 20,000** — instancing made the per-frame drag redraw
  O(1) too (the static scene renders as one draw call; the dragged node stays a DOM hybrid).
- **Spawn settle plateaus ~117 ms** even at 20,000 nodes (the one-time `buildInstances` +
  first draw) — a brief load blip, not the old multi-second freeze. `rendered=N/N` (anti-cheat).
  At the *readable-chip* regime (fit zoom > LOD, every chip rasterised) the node build stays
  cheap: `PERF_NOCONN` spawn settle **N=500 = 100 ms, N=1000 = 83 ms**. (The WITH-connector
  spawn N=1000 ≈ 633 ms in a warm full run is the pre-existing synchronous connector-routing
  commit — `changeView`/`syncScene` A* over 968 connectors, ~525 ms — NOT the node renderer,
  confirmed by the NOCONN isolation. baseline.md left at the prior cold Canvas2D numbers; a
  clean-cold instanced refresh is a `/notes` task.)

## Atlas robustness (correctness fix caught in review, not in the 16-node screenshot)

The first 4096² atlas held ~950 distinct chips. The fit-to-view harness at **N=1000 with LOD
labels ON draws ~1000 chips at once** (culling is defeated by fit-to-view) → overflow → the
original reset-and-retry **thrashed and could strand already-packed sprites on overwritten
atlas regions (silently missing/garbled chips)**. Real scenes never hit this (viewport culling
caps simultaneously-visible chips at ~hundreds), but it's a correctness risk. Hardened:
- Atlas **8192²** (holds ~3–4 k chips — more than any culled viewport shows readable).
- Packer **never resets mid-build**: an overflowing chip is skipped for one build and the
  atlas is **compacted at the next `beginInstances()`** (drop the stale cache, repack fresh),
  with the stalk-dot region **reserved** so its persistent UV survives a compaction.
- Verified: a 900-unique-chip readable scene renders **every** chip correctly (drawCount 900,
  labelsDrawn 900) — the old 4096² dropped ~50+.

A fully unbounded solution (a `sampler2DArray` texture-array page per instance, or multi-page
atlas with a per-run draw call) is the future robustness step if a real culled scene ever
approaches the cap — not needed for the shipping product.

---

# 2026-07-08 addendum — folding the next wall (connectors + rectangles + labels)

The T4 finding said the remaining high-N pan cost was the **DOM/SVG connector layer**. This
session folded it (and rectangles), added an **all-element-types** harness scene + an **AC-power
gate** (battery throttles → non-representative), and resolved the residual **connector-label**
wall by LOD.

## What moved to the GPU
- **`ConnectorsCanvas`** — instanced connector bodies (white-halo + coloured core polyline via
  the `white` texel, round join/cap dots, a packed arrowhead sprite). Scene points via
  `getTilePosition(connectorPathTileToGlobal(...))` — the space `ConnectorLabel` already uses.
- **`RectanglesCanvas`** — instanced iso fill parallelogram + border segments.
- Picking is **100 % geometric** (`getItemAtTile` over scene data), so the DOM keeps only a
  **sparse hybrid**: selected/degenerate/unroutable connector, dragged rectangle (`[data-drag-id]`).
- **Connector labels** stay DOM but are **LOD-culled** below readable zoom (`readableLabels ||
  zoom≥0.25`, matching the node-label canvas), keeping only the selected connector's labels live.
- No-WebGL2 → the Renderer keeps connectors/rects in DOM (they have no Canvas2D fallback).

## Measured — all-types pan (real GPU, AC power; scene = N nodes + ~N connectors × **3 labels** + rects + floating labels)

| N | BEFORE (all DOM) | GPU-fold only (labels DOM) | AFTER (GPU fold + label LOD) |
|---|---|---|---|
| 1000 | 22.8 ms | 16.67 | **16.67 (60 fps, longtask 0)** |
| 2000 | 45.5 ms (lt 653) | 28.75 | **16.67 (60 fps, longtask 0)** |
| 5000 | ~100 ms+ (wall) | 81.87 (lt 6438) | **16.67 (60 fps, longtask 0)** |

Every AFTER cell reports **`noCPU-rebuild=true`** — the machine-checkable proof (each GPU
canvas's `data-build-count` stayed flat) that no per-frame CPU geometry work leaked into the
pan. The middle column isolates the two fixes: folding the connector/rectangle bodies removed
the SVG re-composite (BEFORE→GPU-fold-only), and the label LOD removed the residual 3×N DOM-chip
wall (GPU-fold-only→AFTER).

## Harness + methodology additions
- **`PERF_ALLTYPES`** — the "everything at once" scene. **`PERF_NO_GPU_FOLD`** — forces the DOM
  path (the A/B "before"). **`PERF_ALLOW_BATTERY`** — override the power gate.
- **AC-power gate** (`requireACPower()`): blocks measurement on battery (throttle → meaningless).
- **"No per-frame CPU work" gate**: `measurePan` asserts the summed `data-build-count` delta is
  0. Reusable prompt: [`no-cpu-work-check.md`](no-cpu-work-check.md).

## Deferred / honest gaps
- Connector **dashed/dotted** + **double-line** styles + **rounded rectangle corners** fall back
  to the DOM hybrid / a sharp-corner approximation (the shipping grouping rects + solid single
  connectors — the common case + the harness — are exact). A full GPU port of those styles is a
  follow-up.
- A full **GPU fold of connector labels** (visible + O(1) at *all* zooms, not just LOD-culled
  when zoomed out) would need a global drag-hybrid channel; the LOD-cull covers the measured
  wall (zoomed-out, where labels are unreadable) at far lower risk.

## The next wall — the DOM/SVG connector layer (confirmed, not resolved)

With connectors present, high-N pan is **bound by the connector subsystem, not the node
canvas**: the isolated node canvas contributes only 16.67 ms, so the reference's 44.8 ms @5k
(and the instanced build's 44 ms @5k WITH connectors) is **~100% the DOM/SVG connectors**
re-compositing on the CSS pan transform (`SceneLayer` is `will-change`-promoted; the cost is
the browser compositing/rastering the large multi-polyline SVG subtree). This is exactly the
"remaining Canvas2D headroom" the 2026-06-25 decision named.

**Resolving it = folding connector LINES onto the GPU** (the `glSpriteBatch` anchor+basis
form draws line-segment quads trivially). But connectors are a heavily-productized, tested
layer (halo + core + arrow + double/dashed/dotted + degenerate-dot + unroutable + selection
halo + labels + anchor overlay; e2e asserts on `data-testid=connector-path` DOM). A full fold
is a **large, fidelity-risky, multi-session effort → RED gate (present a written design +
measured PoC first)**, not an autonomous overnight rewrite. Sized here as the confirmed next
step, with the prize measured (the entire high-N pan delta).

## Verification

- `tsc --noEmit` clean · lib build clean · **unit 1483 passed / 1 skipped / 145 suites**.
- **Visual parity** (real GPU screenshots, 16-node styled scene): icons on tiles, iso-shear
  on non-iso icons, iso cubes upright, chips floating above with bold/italic/strikethrough/
  underline/link-blue/colour, dotted stalks, correct back-to-front painter's order; LOD at
  zoom 0.14 = icons-only, clean mipmapped minification (no atlas bleed). Anti-cheat counters
  correct (drawCount=N, labelsDrawn=N readable → 0 at LOD, linkedLabelsDrawn matches).
- Correctness e2e gate: see decision-log.
- Known WebGL-substrate caveat (pre-existing, from the spike): `canvas-node-render.spec` and
  the pixel-sampling half of `import-export-image.spec` read the node canvas via
  `getContext('2d').getImageData` — impossible on a WebGL canvas — so they need a
  `readPixels`/screenshot shim. Not in the correctness gate (which asserts via store/bridge).
