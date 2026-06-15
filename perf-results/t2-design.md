# T2 design — Canvas2D render layer (decoupled from React + viewport culling)

Charter: `docs/tactical/perf-charter.md` (T2 = SSB 2,000 / LEB60 200, "Canvas2D
layer decoupled from React + viewport culling"). This is the **RED architectural
move** — human sign-off is on file (cold-start-t2.md). Per the charter this doc +
a **measured proof-of-concept finding** must be presented BEFORE committing to a
multi-session overhaul. This file is that design; the finding is appended at the
bottom once the PoC is measured.

---

## 1. What the renderer is today (ground truth, read from source)

The scene is DOM/SVG reconciled by React, in `Renderer.tsx`:

- **Pan/zoom is already off the React path.** Each `<SceneLayer>` wraps its
  children in a div and, on mount, subscribes to `uiStateStore` and writes
  `transform: translateX/Y scale()` directly to `element.style` on scroll/zoom —
  **no React render on pan/zoom** (`SceneLayer.tsx:16-37`). The layer div sits at
  `top:50% left:50%`, so children position in centred tile-space.
- **Viewport culling already exists**, coarse-tile-bounded:
  `Renderer.computeTileBounds` projects the 4 viewport corners to tile space (+4
  tiles padding), and `visibleItems` / `visibleConnectors` filter to that box. The
  bounds only change (and re-render) when the user pans far enough to expose new
  tiles. **T2 reuses this** — it is the "viewport culling" half of the unlock.
- **Each connector is a React subtree** (`Connector.tsx`): an absolutely-positioned
  MUI `<Box>` (via `useIsoProjection` → `left/top/width/height` + the iso CSS
  matrix) containing an `<svg>` with **2 polylines for SINGLE** (white halo +
  coloured core), **4 for DOUBLE**, plus optional dash arrays, a direction-arrow
  `<polygon>`, and a `DOUBLE_WITH_CIRCLE` `<ellipse>` pair. Per-connector it
  subscribes granularly to `sceneStore.connectors[id]` (Iter 6) and to model
  colours via `useColor` (Iter 6).
- **The iso projection is a fixed affine matrix**:
  `matrix(0.707, -0.409, 0.707, 0.409, 0, -0.816)` (X-orientation), applied as CSS
  `transform` on the connector box; polyline points are in
  `tile * UNPROJECTED_TILE_SIZE (=100) + halfTile` grid-pixel space
  (`CanvasModeContext.getProjectionCss`, `Connector.pathString`). 2D mode uses no
  matrix. This matrix + the SceneLayer translate/scale is the **entire** transform
  chain a canvas must replicate.

**Cost shape (from the committed baseline + decision log):**

- **Spawn N=1000 = 283 ms settle / 200 ms longest frame**, DOM-volume/layout/paint
  bound (Iter 4 proved JS is sub-noise). Labels-off floor = 175 ms — i.e. the
  icon + **connector** + rect DOM is ~175 ms of it. Connectors are ~N−√N subtrees
  (~968 @1000), each ≥2 SVG polyline nodes ⇒ a large share of that DOM volume.
- **Drag = ~16.7 ms / 60 fps at EVERY N already** (Iter 6 killed the connector
  re-render storm). **There is no React fan-out left to remove on drag.**

## 2. Consequence for layer ordering — connectors win on SPAWN, not drag

The cold-start suggests connectors first as the cheapest decoupling. That holds for
**de-risking the approach**, but note the prize is **spawn-only**: replacing ~968
connector SVG subtrees with one `<canvas>` + ~968 polyline draw calls should cut
the connector share of the 283 ms spawn settle and reduce DOM node count / memory.
Drag is already at budget, so a connector-canvas will (at best) hold drag flat — it
cannot show a drag win. **The proof metric is therefore spawn longest-frame +
settle at N=1000/2000, with drag measured only as a no-regression guard.**

**De-risk before building (LOOP step 7 — instrument, don't guess):** measure the
connector contribution to spawn settle FIRST via a `PERF_NOCONN=1` diagnostic
(scene built with connectors omitted, same harness, same-session A/B vs full
scene). This sizes the maximum achievable connector-canvas win:

- If connectors are a large share (say ≥60 ms @1000), the spike is well-justified.
- If they are small (≲25 ms), the connector layer is the **wrong** first move; pivot
  the PoC straight to the node layer (where SSB-2000 actually lives) — and that
  pivot, backed by the number, is itself a charter-worthy finding.

## 3. Canvas2D connector layer — design (if the prize justifies it)

**Element.** One `<canvas>` `<SceneLayer order=connectors>`-equivalent, full
renderer size (1440×900 × devicePixelRatio backing store), positioned like the
other layers. Do NOT put the canvas inside the CSS-transformed SceneLayer div —
instead let the canvas own its transform so 1px strokes stay crisp under zoom:
each frame `ctx.setTransform(zoom,0,0,zoom, W/2+scroll.x, H/2+scroll.y)` (mirrors
the SceneLayer transform), then `ctx.transform(0.707,-0.409,0.707,0.409,0,-0.816)`
for the iso matrix (skip in 2D mode), then draw each visible connector's polyline
in the existing `tile*100+50` grid-pixel coordinates — i.e. **reuse
`Connector.pathString` math verbatim**, just `ctx.moveTo/lineTo` instead of an SVG
`points` string.

**Subscription (imperative, no React render).** A `useEffect` in the canvas
component subscribes to:
- `uiStateStore` scroll/zoom/rendererSize → schedule a redraw (rAF-coalesced).
- `sceneStore.connectors` → schedule a redraw (this is the per-frame drag-preview
  write; the canvas redraws the visible connectors — O(visible), not O(N) React).
- the model `currentView.connectors` + colours → redraw (structural changes).
All redraws are coalesced into one rAF callback (`if (!pending) raf(draw)`); the
draw reads the *current* store state, so multiple writes in a frame ⇒ one draw.

**Culling.** Reuse `visibleConnectors` (already computed in `Renderer` from the
tile-bounds cull). The canvas draws only those. Drawing cost scales with VISIBLE
connectors, not total — the second half of the T2 unlock.

**Draw fidelity (PoC vs production).** The PoC draws the **SINGLE-line** case only
(white halo polyline + coloured-core polyline + direction arrow) — that is the
representative weight (the perf scene is all SINGLE, SOLID). DOUBLE / dashed /
circle / unroutable are deferred to the production pass; they are draw-call
variations, not architectural risk. The PoC's job is to measure the *cost* of the
canvas path, not to be pixel-complete.

**Hit-testing / selection / drag stay in the DOM/stores untouched.** Interaction
already runs off `sceneStore` (`hitConnectors`, `getItemAtTile`) and the invisible
`canvas-interactions` box — none of it reads connector DOM. Selection highlight and
the connector controls overlay remain DOM. So the canvas is **draw-only**; no
interaction code changes. (This is why connectors are the safe first spike: unlike
nodes, they carry no editable text or inline interaction.)

**CSS-var drag preview (MQA #7).** The drag preview re-routes the dragged
connector and writes its path to `sceneStore.connectors[id].path` each frame — the
canvas subscription already redraws on that. No CSS-var bridge needed for
connectors (that concern is the *node* label-colour preview, a node-layer problem).

## 4. Reversibility + flag

- Behind a runtime flag, default OFF: `localStorage 'axoview-canvas-connectors'`
  read in `Renderer`, choosing `<Connectors>` (DOM, unchanged) vs
  `<ConnectorsCanvas>`. DOM path is byte-identical when off ⇒ the committed
  baseline and the whole correctness gate stay green with the flag off.
- Harness plumbs it via `PERF_CANVAS=1` → localStorage in `bootApp`, so the
  same-session A/B is flag-off (reference, == HEAD) vs flag-on (treatment),
  calibration-index-checked, back-to-back. Pure-additive ⇒ the reference run IS
  the current renderer.
- Do NOT delete the DOM connector renderer until a canvas path passes the full
  correctness gate in canvas mode (verified visually via `.scratch/verify-scene`).

## 5. Proof metric (what makes this a go / no-go)

Same-session, calibration-checked, `PERF_N=500,1000,2000`:

| metric | DOM (ref) | canvas (treat) | go bar |
|---|---|---|---|
| spawn settle @1000 | 283 ms | ? | beat by ≫ noise (≥ ~30 ms) |
| spawn longest @1000 | 200 ms | ? | beat by ≫ noise |
| spawn settle @2000 | (measure) | ? | scales sub-linearly vs DOM |
| drag mean @1000 | 16.7 ms | ? | **no regression** (≤ ~17.5 ms) |
| rendered connectors | N−√N DOM | 0 DOM / 1 canvas | DOM node count drops |

**Go** = canvas beats DOM spawn beyond noise AND holds drag flat AND can stay
correct (visual parity on the SINGLE case). **No-go / pivot** = canvas does not beat
DOM spawn beyond noise → the connector layer is not the bottleneck; pivot to nodes
and write the finding (architectural-ceiling-style result, charter LOOP).

## 6. Beyond the connector spike (the real T2, node layer) — sketch only

The SSB-2000 prize is the **node layer** (icon + label + badges = ~14 DOM
elements/node × N). This is where T2 must ultimately land, and where it is hardest:
editable label text, the readable-labels counter-scale, inline F2 edit. The
pragmatic T2 is likely a **hybrid**: canvas for the icon/shape/connector strata,
DOM retained only for the *editable* label (which is sparse — only the
selected/edited node needs a live DOM input; the rest can be canvas-drawn text). The
connector spike validates the imperative-draw + store-subscription + cull
machinery that the node layer will reuse. Sequencing and the node-layer design are
deferred to after the connector PoC finding.

---

## FINDING (Iter 7 — connector prize sizing, DECISIVE NEGATIVE → pivot to nodes)

**The connector layer is the WRONG T2 first move. Do not build a connector canvas.**

### Evidence — same-session A/B, cal 3.2 both runs (zero machine drift)

`PERF_NOCONN=1` builds the identical scene with connectors omitted. Spawn,
N=1000/2000, full scene vs connectors-omitted:

| N | settle full | settle no-conn | longest full | longest no-conn | connectors removed |
|---|---|---|---|---|---|
| 1000 | 283.3 ms | **283.3 ms** | 200 ms | **200 ms** | 968 |
| 2000 | 466.6 ms | **466.6 ms** | 383.3 ms | **383.3 ms** | 1955 |

Removing ~968 / ~1955 connectors moved spawn settle and longest-frame by **0 ms**
(byte-identical). Both runs calibrated at 3.2 ms ⇒ no drift; this is not noise
masking a small effect, it is exactly zero. Combined with **drag already at 60 fps
/ 16.7 ms at every N** (Iter 6), a connector→Canvas2D rewrite has **no prize on
either axis**.

### Root cause (code-path confirmed, not inferred)

Connectors carry no rendered path during the harness spawn, so they cost ~nothing:

- A `<Connector>` early-returns `null` unless its scene path has tiles
  (`Connector.tsx:160`). The path comes from `sceneStore.connectors[id].path`.
- That entry is populated by connector **routing**, which runs in exactly two
  places: `changeView` → `syncScene` (synchronous, on initial-data `load()` /
  view-switch — `useView.ts:17`, `useInitialDataManager.ts:175`), and
  `computePathsAsync` (rAF-batched 25/frame, on **paste** — `useSceneActions.ts:834`).
- The harness spawn commits via a **raw `model.actions.set({items, views})`**
  (`engine-perf.spec.ts:602`), which bypasses BOTH. So no connector is ever routed
  → all render `null` → ~0 DOM, ~0 paint. Hence the 0 ms delta.

### Why this also holds in the real app (not just a harness artifact)

Even on a real paste/open, connector routing is **deferred and amortized**:
`computePathsAsync` processes 25 connectors per `requestAnimationFrame`, *after*
the model commit — so connectors never block the initial scene paint; their cost
spreads across post-settle idle frames. Connectors are architecturally **not on the
spawn critical path**. (This is good existing design, not a bug.)

### Harness caveat (must fix before any future connector-canvas work)

The harness spawn does **not** exercise connector routing+paint at all (bypasses
both routing paths). The committed baseline's scene note ("~N connectors, ⅓
labelled") overstates the connector contribution to the *spawn* number — they are
present in the model but render null. If a connector canvas is ever revisited, the
harness must first route connectors on spawn (call `changeView`/`computePathsAsync`
post-set) so the work is actually measured. **Do not trust the 0 as "connectors are
free to paint" — trust it as "the harness spawn never paints them."** The drag
scenario *does* route the dragged connector (preview path), and drag is at budget.

### Decision → pivot the T2 PoC to the NODE layer

With connectors out (0 change) and labels-off floor = 175 ms @1000 (decision log),
the 283 ms spawn settle is **nodes (icons + labels) + rectangles**:
- icons + rects ≈ 175 ms (labels-off floor)
- labels ≈ 108 ms (283 − 175)

That is where the spawn prize and SSB-2000 live — and it matches the charter
(T2 unlock names the node layer implicitly; SSB measures static structures = nodes).
The Canvas2D **machinery** designed above (imperative store-subscribed draw +
rAF-coalesce + reuse of the `visibleItems` tile-cull + the fixed iso matrix) is
still the right architecture — it just must target the **node layer** first, not
connectors.

**Next (RED — present before starting; this is the multi-session overhaul the
charter gates):** a node-layer Canvas2D PoC. Hardest part is the editable label
(readable-labels counter-scale, inline F2 edit) → pragmatic T2 = **hybrid**: canvas
draws icon + shape + static label text + rectangles + connectors; DOM retained only
for the *selected/editing* node's live label input (sparse — one at a time). PoC
scope: draw the icon image + static label text to canvas for all N, measure spawn
settle/longest A/B at N=1000/2000 vs DOM, behind the same `axoview-canvas-*` flag.
The connector polyline draw is then trivial to fold in (same canvas, same cull) once
the harness routes connectors.

_Status: connector-canvas direction REJECTED with evidence. Node-layer-hybrid
direction PROPOSED, awaiting go-ahead before the overhaul (RED gate)._

---

## FINDING (Iter 8 — node-layer Canvas2D PoC, DECISIVE GO)

**A Canvas2D node layer (icon bitmap + static label text) beats the DOM node
renderer on spawn by ~40–50% beyond noise, holds drag flat at 60 fps, and scales
sub-linearly. The T2 node-layer direction is validated — proceed to the
production hybrid.**

### What was built (PoC, behind `localStorage axoview-canvas-nodes`, default OFF)

`NodesCanvas.tsx` — an imperative, draw-only `<canvas>` that replaces the per-node
React DOM subtree (~14 elements × N) with one canvas + O(visible) draw calls:

- **Icon-bitmap cache** — one decoded `HTMLImageElement` per icon URL, drawn N
  times (vs N DOM `<img>` decodes). 5 distinct icons in the perf scene ⇒ 5 decodes
  total. This is the key spawn win.
- **Static label** — white rounded chip + border + centered bold name text
  (`ctx.fillText`), honouring `labelColor` / `labelFontSize` / `showLabel`, with
  the readable-labels counter-scale ported to `ctx` transforms.
- **Transform model (§3)** — the canvas owns its transform: `setTransform(zoom·dpr,
  0,0, zoom·dpr, (W/2+scroll.x)·dpr, (H/2+scroll.y)·dpr)` mirrors the `<SceneLayer>`
  CSS; non-iso icons in ISO mode additionally get the fixed iso matrix per icon
  (mirrors `NonIsometricIcon`). rAF-coalesced redraw on `uiStateStore` (scroll/zoom/
  size/readableLabels) + `modelStore` (items/icons) + the `nodes` prop (the spawn
  path). Reuses the existing `visibleItems` tile-cull and the `resolveRenderOrder`
  painter sort.
- Harness plumbed: `PERF_CANVAS=1` → sets the localStorage flag in `bootApp`
  (mirrors `PERF_NOLABEL`/`PERF_NOCONN`).

### Evidence — same-session A/B, calibration index 3.1 ms BOTH runs (zero drift)

| metric | DOM (ref) | canvas (treat) | Δ | go bar |
|---|---|---|---|---|
| spawn settle @500 | 200.0 | 133.4 | **−33%** | ✓ (≥30 ms) |
| spawn settle @1000 | 283.4 | **166.6** | **−41% (−117 ms)** | ✓✓ |
| spawn longest @1000 | 200.0 | **83.3** | **−58%** | ✓✓ |
| spawn settle @2000 | 466.6 | **233.4** | **−50%** | ✓ sub-linear |
| spawn longest @2000 | 383.3 | 150.0 | **−61%** | ✓ |
| long-task total @1000 | 1099 ms | **72 ms** | **−93%** | — |
| drag mean @1000 | 16.87 | 16.67 | flat (60 fps) | ✓ no-reg |
| drag mean @2000 | 17.29 | 16.67 | flat (60 fps) | ✓ no-reg |
| rendered DOM nodes @1000 | 1000 | **0** | shells gone | ✓ |

Both runs calibrated at 3.1 ms ⇒ no machine drift; the deltas are ≫ the ~5% noise
band. (An earlier ref run at cal 3.8 was discarded — re-ran warm at 3.1 for a clean
same-cal A/B, per the measurement protocol.) **Scaling:** DOM settle 1000→2000 grows
×1.65; canvas grows ×1.40 — the canvas is sub-linear, the SSB-2000 unlock the tier
ladder names.

**The win is real canvas-vs-DOM, not an artifact of dropped elements:** canvas
settle @1000 (166.6 ms) is BELOW the DOM **labels-off floor** (175 ms, decision
log) — i.e. the canvas icon+label draw is cheaper than DOM icons drawn *without
any labels at all*. The icon-bitmap cache + canvas text genuinely beats the DOM
node subtree.

### Visual parity

`.scratch/verify-canvas-nodes.mjs` captures the same 16-node scene DOM vs canvas:
icons land on the correct tiles (iso-skewed), labels centered above, colours
correct, **0 page errors**. DOM markers: DOM mode = 16 shells / 16 labels / 17
imgs; canvas mode = 0 shells / 0 labels / 1 canvas element. Screenshots:
`.scratch/canvas-nodes-{dom,canvas}.png`.

### Correctness gate — flag OFF: 13/13 GREEN

DOM path is byte-identical when the flag is off (the only addition is a one-time
localStorage read + a render ternary), so the committed baseline and the full gate
stay green. Gate flag-ON is deferred until the editing-node hybrid is built (below).

### PoC scope omissions (honest accounting — charter anti-cheat)

The PoC draws the **representative case** (icon + static name label), mirroring the
connector-PoC's "SINGLE-only" scope. **Deferred to the production hybrid:**
- description RichTextEditor (~20% of nodes), notes/link badges (~12% / readonly).
  Dropping the RichTextEditor removes some label cost — but see above: canvas still
  beats the DOM *labels-off* floor, so the step-change does not depend on it.
- the editing-node **DOM hybrid** — F2 inline edit + the live readable-labels
  counter-scale. This is why the flag-ON correctness gate (`rename`,
  `readable-labels`) is deferred: those specs need a DOM label to edit/measure.
- **drag-preview movement on canvas** — the DOM path moves the dragged node via
  `--ff-drag` CSS vars (compositor-only); the canvas PoC does not redraw the dragged
  node per preview frame (the CSS-preview drag writes no store the canvas subscribes
  to). The drag A/B therefore measures "the rest of the scene renders flat with the
  canvas present" (it does — 60 fps), NOT canvas drag-preview movement. Production
  hybrid: redraw O(visible) on the preview tick (cheap).

### Harness note (mirror of Iter-7's caveat)

In canvas mode the spawn anti-cheat `rendered = document.querySelectorAll(
'[data-drag-id]')` is **0/N** (the DOM shells are gone) — expected for a draw-only
canvas; the full scene is still committed (connectors/rects present in the model).
The drag grab `nodeClientCenter` falls back to `tileToClient` (no DOM `<img>` to
hit) and **engaged 5/5** at every N. A production default-on canvas would want an
anti-cheat that counts canvas draws (e.g. a debug draw-count) instead of DOM shells.

### Decision → GO. Build the production node-layer hybrid (still RED-gated work)

The imperative-draw + store-subscription + iso-matrix + tile-cull machinery is
validated. Next moves (each same-session A/B + gate + visual): (1) the editing-node
DOM hybrid (sparse — one live DOM label at a time) to pass the flag-ON gate; (2)
fold in description text + badges (measure the residual); (3) canvas drag-preview
redraw; (4) fold the connector polyline draw into the same canvas (trivial — same
cull) once the harness routes connectors on spawn (Iter-7 caveat). Do NOT delete
the DOM node renderer until the canvas path passes the full correctness gate in
canvas mode.

_Status: node-layer Canvas2D direction VALIDATED with a measured GO (spawn −41%
@1000, drag flat, gate green flag-off). PoC committed behind a default-off flag._

---

## FINDING (Iter 9 — editing/dragging-node DOM hybrid, FULL gate GREEN flag-ON)

**The production hybrid passes the full correctness gate flag-ON (13/13) with the
Iter-8 spawn win preserved exactly. The canvas path is now correctness-complete for
the gated behaviors — the charter RED milestone for proposing canvas as default.**

### What was built

- **Sparse DOM overlay for the actively-manipulated nodes.** In canvas mode the
  `Renderer` lifts the *selected* node (`itemControls`, the single-selection signal)
  **and the drag set** (`mode.items` while `mode==='DRAG_ITEMS'`) into DOM `<Node>`
  overlays; `NodesCanvas` skips those ids (`skipNodes`) so nothing draws twice. Both
  signals are sparse (0–few) and empty during bulk spawn, so the spawn path is
  unchanged. This gives the selected node its DOM affordances (F2 inline-rename
  contentEditable, readable-labels counter-scale wrapper) and the dragged node a real
  `[data-drag-id]` for the `--ff-drag` compositor preview — i.e. **the canvas drag
  preview is the existing DOM path for free** (the deferred "canvas drag-preview
  redraw" is unnecessary for the selected/dragged node).
- **Renderer-aware readable-labels observation.** No per-node DOM label exists for an
  *unselected* canvas node, so `NodesCanvas` publishes the *applied* counter-scale as
  `data-label-scale` on the `<canvas>` (the exact value fed to `ctx.scale`), and the
  spec helper reads it renderer-agnostically (DOM wrapper when present — flag-off
  identical; else the canvas attr). Re-introducing N DOM labels was rejected (it would
  erase the win). Same feature, same value, different observation surface.
- **Gate switch:** `AXOVIEW_CANVAS_NODES=1` → localStorage in the e2e fixtures
  (mirrors `PERF_CANVAS`; off ⇒ committed gate byte-identical).

### Evidence

- **flag-ON gate 13/13 GREEN** (was 10/13 on Iter-8 HEAD: only `css-preview-mid-drag`
  + both `readable-labels` failed — exactly the DOM-node-dependent specs). **flag-OFF
  gate 13/13 GREEN** (DOM path byte-identical).
- **Spawn A/B preserved exactly** (DOM cal 3.2 ↔ canvas cal 3.1): settle @1000
  283.3→**166.6** (−41%), longest 200→83.3 (−58%), long-task 1127→72. Identical to
  Iter-8 ⇒ the DOM overlay adds zero spawn cost.

### Still deferred (honest accounting)

- **Description text + notes/link badges** on canvas: an unselected node with a
  description shows only its name (the full RichText appears when selected, via the DOM
  `<Node>`). Close next; measure the residual vs −41%.
- **Connector polyline draw** on the canvas (after the harness routes connectors on
  spawn — Iter-7 caveat).
- **Making canvas the default / retiring the DOM renderer** — RED-gated; present the
  GO + this flag-ON gate evidence first. A default-on canvas wants a draw-count
  anti-cheat (DOM-shell spawn count reads 0/N in canvas mode).

_Status: production hybrid passes the full correctness gate flag-ON AND flag-OFF;
spawn win preserved. Canvas remains behind the default-off flag; DOM renderer intact._
