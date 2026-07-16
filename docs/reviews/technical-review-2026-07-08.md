# Axoview Technical Review — 2026-07-08 (WebGL2 render-substrate fold)

> **Status:** Focused review of the **WebGL2 render-substrate productization** (the T4 GPU fold), measured against `integration` @ `2cfb10c`, shipping via open **[PR #63](https://github.com/molikas/axoview/pull/63)** (`integration → master`, title `feat(canvas): instance node/label + fold connector/rectangle layers onto WebGL2`). Version `3.4.1` → merge cuts **3.5.0** (feat = minor). This is a scoped companion to the quarterly [2026-07 review](technical-review-2026-07.md); it does not restate the whole system. Method: the `/audit` mechanical gates + adversarial verification of every load-bearing [ADR 0038](../adr/0038-webgl-instanced-render-substrate.md) claim against code — and, per the 2026-07 review's §14 lesson, **live PR CI state, not just local**. §4 records the fixes applied in this same session (the before/after).

## Table of contents

- [1. Executive summary + verdict](#1-executive-summary--verdict)
- [1a. Health scorecard](#1a-health-scorecard)
- [2. What was verified green](#2-what-was-verified-green)
- [3. Findings (as reviewed, pre-fix)](#3-findings-as-reviewed-pre-fix)
- [4. Fixes applied this session — before / after](#4-fixes-applied-this-session--before--after)
- [5. Still deferred (with rationale)](#5-still-deferred-with-rationale)
- [6. Post-fix verification](#6-post-fix-verification)

---

## 1. Executive summary + verdict

The fold makes **WebGL2 the sole bulk render substrate** — `glSpriteBatch` draws nodes, floating labels, connector bodies and rectangle bodies as one `drawArraysInstanced` per layer per frame, with the tile→screen transform in the vertex shader; navigation is **O(1) on the CPU at any N**. The prior Canvas2D/DOM bulk fallback and the `__axoviewNoGpuFold` A/B knob were **removed**, and a browser without WebGL2 gets the `WebGLUnsupportedScreen` gate (ADR 0038, superseding ADR 0019 for the substrate decision; ADR 0020 amended for the GPU anti-cheat).

**Verdict (pre-fix): ship-ready on the numbers; sound engineering with one concentrated robustness hole.** Every gate is green, every load-bearing ADR 0038 claim holds in code, the perf win is real and machine-checked, and — the trust question for a fold like this — the anti-cheat was **not** softened to pass (it was *strengthened*). The debt that shipped was concentrated and mostly cataloged, with two items that deserved sharper framing than "deferred": a **silent-blank failure cluster** and a **shipped visual regression** in styled connectors.

**Post-fix (this session):** the failure cluster's root cause is closed — all four GPU layers now recover from WebGL2 context loss, the capability probe no longer leaks a GL context, and the previously-silent post-gate failure now logs. The styled-connector regression is release-noted (the GPU fix stays the owner-chosen P2). Full hygiene sweep applied. See [§4](#4-fixes-applied-this-session--before--after).

### 1a. Health scorecard

| Dimension | Pre-fix | Post-fix | Basis |
|---|---|---|---|
| Performance (the goal) | **A** | **A** | O(1)/60fps pan verified; `buildDelta===0` machine-checked ([engine-perf.spec.ts:1547](../../packages/axoview-e2e/perf/engine-perf.spec.ts#L1547)) |
| Anti-cheat integrity | **A** | **A** | Re-point PRESERVED/STRENGTHENED exact-equality (`painted == committed`, [engine-perf.spec.ts:2641](../../packages/axoview-e2e/perf/engine-perf.spec.ts#L2641)); no test deleted/skipped/loosened |
| Rendering correctness | **B−** | **B+** | Chips pixel-identical; GPU line-styles (dashed/dotted/double/circle), stroke-width fidelity, and arrow outline now match the DOM ([§7](#7-followup-line-styles--width-fidelity--arrows-same-session)) |
| Robustness / failure handling | **C+** | **B+** | Context-loss recovery + probe-leak fix + null-surface `console.warn` close the silent-blank cluster's root cause |
| Test coverage | **B−** | **B−** | Anti-cheat strong + e2e green, but `webgl/` still has no unit tests and the gate is untested (ts-jest transform blocker) |
| Docs / ADR discipline | **B+** | **A−** | 4 stale fallback comments + wrong ADR cite swept; ADR 0038 §Decision 2 / §Deferred corrected |
| Release readiness | **A−** | **A−** | All gates green; squash hazard already mitigated (conventional `feat` title + title-lint); `mergeStateStatus: CLEAN` |

---

## 2. What was verified green

**Mechanical gates (pre-fix, local):** `tsc --noEmit` clean · jest **145 suites / 1483 pass + 1 skip** · eslint 0 errors / 8 warnings · lib build clean (CJS 1612 kB + ESM 1503 kB, both formats).

**Live PR #63 CI — fully green** (the check the 2026-07 review's §14a nearly missed): Playwright chromium (19m24s), engine perf-smoke anti-cheats, test 22.x/24.x, CodeQL, conventional-title-lint, Cloudflare Pages. `mergeStateStatus: CLEAN`.

**All 6 ADR 0038 decisions confirmed in code** (adversarial verification):

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 1 | WebGL2 sole substrate; `__axoviewNoGpuFold` knob removed | CONFIRMED | Gate at [Renderer.tsx:436](../../packages/axoview-lib/src/components/Renderer/Renderer.tsx#L436); knob grep hits only ADR text |
| 2 | DOM/GPU hybrid boundary | CONFIRMED (ADR wording sharpened, [§4](#4-fixes-applied-this-session--before--after)) | `hybridNodes`/`connectorHybridIds`/`rectHybridIds` in Renderer; the ADR under-stated it (label-drag node + all connector labels are DOM) |
| 3 | Picking stays geometric | CONFIRMED | `getItemAtTile` over scene data; **zero `readPixels`** anywhere |
| 4 | Export depends on `preserveDrawingBuffer` | CONFIRMED | [glSpriteBatch.ts](../../packages/axoview-lib/src/webgl/glSpriteBatch.ts) `preserveDrawingBuffer: true`; export captures the container's GL canvases |
| 5 | Atlas 8192²→4096²@dpr≥2 + `MAX_TEXTURE_SIZE`; chip dpr clamped at 2 | CONFIRMED | [NodesCanvas.tsx:247](../../packages/axoview-lib/src/components/SceneLayers/Nodes/NodesCanvas.tsx#L247); `Math.min(atlasSize, MAX)`; `CHIP_SUPERSAMPLE=2 × Math.min(dpr,2)` |
| 6 | No per-frame CPU geometry; buildCount published | CONFIRMED | buildInstances gated by geomDirty/LOD; pan subscribers don't dirty; `buildDelta===0` asserted |

**Anti-cheat is honest, not a cover.** The suspicion change (`791704b`, "re-point GPU-fold anti-cheats at the WebGL draw-count") moved the *data source* (DOM query → `dataset.drawCount`) but kept the assertion at **exact equality** — the old DOM connector count went to 0 once bulk moved to the GPU (a guaranteed red gate), and the re-point restored a real conservation equality (`painted == scene.connectors.length`, fails on both under-draw and double-paint; DOM/GPU sets are provably disjoint). `connector.renderIsolation.test.tsx` was *strengthened* (old regex matched even `import type`). No test deleted, skipped, or loosened.

---

## 3. Findings (as reviewed, pre-fix)

Ranked; §4 records disposition.

**1 — Silent-blank failure cluster (MED-HIGH).** Three paths converged on the *same* untyped failure — a blank/partial canvas with full chrome, no message, no recovery short of reload — because the only guard was a one-shot, memoized probe strictly weaker than the real requirement:
- **Context loss** — no `webglcontextlost` handler; the memoized gate wouldn't re-fire; the scene *appeared to vanish* and export produced blank images. Data recoverable (stores render-independent; geometric picking), so "deferred" was defensible but understated.
- **Probe-true / create-null** — the probe checked `getContext` + `createVertexArray` on a throwaway canvas; `createSpriteBatch` additionally needs shader compile/link + an 8192² texture on the *real* canvas, ×4 layers, with a bare `if (!batch) return` → silent blank.
- **Context exhaustion** — the probe leaked a context; each Renderer opens 4; [ExportImageDialog](../../packages/axoview-lib/src/components/ExportImageDialog/ExportImageDialog.tsx) mounts a second hidden `<Axoview>` (→ 8+ contexts vs the browser's ~16 cap; oldest force-lost → unhandled `contextlost`).

**2 — Styled connectors/rectangles render solid until selected (MED; shipped visual regression).** `ConnectorsCanvas` emits solid single lines only — 8 of 9 `style`×`lineType` combos draw wrong on load *and in export* (exports are taken unselected). Cosmetic (model preserved; the DOM path renders correctly on selection); default diagrams clean. The GPU fix is the owner-chosen direction (P2).

**3 — Zero unit coverage on new load-bearing infra (MED).** `webgl/` (glSpriteBatch 555 LOC + itemRaster) has no unit tests and nothing tests the gate; e2e + perf-harness are PR-only. ADR 0038 records the ts-jest transform blocker.

**4 — Hygiene (LOW).** ESLint 6→8 (two self-inflicted unused `eslint-disable` in glSpriteBatch); four stale "Canvas2D fallback" comments contradicting the architecture; one wrong ADR cite; ADR 0038 §Decision 2 under-describing the DOM hybrid.

---

## 4. Fixes applied this session — before / after

| # | Finding | Before | After | Verified |
|---|---|---|---|---|
| 1a | Context loss blanks permanently | No `webglcontextlost`/`restored` handler in any layer; memoized gate never re-fires → permanent blank until page reload | All 4 GPU layers `preventDefault` on loss + rebuild the `SpriteBatch` on restore (fresh atlas/program/VAO/VBO; ConnectorsCanvas re-packs its arrow UV), via new shared [`webgl/contextLoss.ts`](../../packages/axoview-lib/src/webgl/contextLoss.ts). Draw-only — no scene state touched | tsc + jest green; **manual `WEBGL_lose_context` smoke pending** (jsdom has no WebGL2) |
| 1b | Probe leaks a GL context | `isWebGL2Supported` called `getContext('webgl2')` twice and never released the probe context → a persistent extra slot against the ~16 cap | Single `getContext`; probe context released via `WEBGL_lose_context` immediately | tsc + jest green |
| 1c | Post-gate `createSpriteBatch` null was silent | `if (!batch) return;` in each layer → blank layer, no signal | Each layer logs `console.warn('… WebGL2 sprite batch unavailable …')` before bailing | eslint (console.warn allowed) |
| 2 | Styled connectors regression undocumented as such | Framed only as "deferred" GPU work | Release-noted as a known shipped visual regression (this doc + [known_issues.md](../../known_issues.md)); GPU fix stays P2 | doc |
| 4a | ESLint 8 warnings | Two unused `eslint-disable no-console` in glSpriteBatch (`166`, `216`) | Removed | eslint **8 → 6** |
| 4b | Stale "Canvas2D fallback" comments (×4) | `glSpriteBatch.ts` probe doc, `ConnectorsCanvas.tsx:110`, `waitForIconsDrawn.ts`, `Renderer.tsx` cite "ADR 0019" | All corrected to describe the WebGL2-sole architecture; cite → ADR 0038 | grep + tsc |
| 4c | ADR 0038 §Decision 2 under-described the hybrid | Omitted the name-label-drag node; said "the selected connector's labels" | Now names the label-drag node and states **all** connector labels are DOM (no GPU connector-label layer) | doc |
| — | ADR 0038 §Deferred / Consequences + known_issues | Context-loss listed as top deferred follow-up | Marked IMPLEMENTED (pending manual verification); added a GL-context-budget consequence | doc |

**Not changed (deliberately):** the GPU dashed/dotted/double line-styles (owner-chosen P2, needs pixel verification), the export Renderer's context teardown (invasive; follow-up), and the `webgl/` unit tests (blocked on the ts-jest transform).

---

## 5. Still deferred (with rationale)

- **GPU dashed/dotted/double connector + dashed/rounded rectangle styles** — owner-chosen to implement on the GPU (mirror `<Connector>` geometry), needs visual verification. Until then, styled elements draw solid until selected — now release-noted.
- **`webgl/` unit tests + gate test** — blocked on the ts-jest transform for `src/webgl/__tests__/`; the new `contextLoss.ts` and the recovery path also want coverage once it clears.
- **Export Renderer context teardown** — the hidden-instance export doubles live GL contexts; tearing them down on dialog close is the remaining half of the exhaustion mitigation.
- **Backing-store viewport clamp**, **premultiplied-alpha mip fringing** — as recorded in ADR 0038 §Deferred.

---

## 6. Post-fix verification

Re-run locally against the fix commit:

| Gate | Result |
|---|---|
| `tsc --noEmit` (lib) | **clean** |
| jest (lib) | **145 suites / 1483 pass + 1 skip** (unchanged — no regression from the `let batch` + listener changes) |
| eslint (lib) | **0 errors / 6 warnings** (was 8; the two glSpriteBatch unused-disables gone) |
| lib build | clean, both formats |

**Note on the untestable path:** the context-loss recovery cannot be exercised in CI (jsdom has no WebGL2; the perf/e2e suites can't force a loss). The change is *monotonic* — on the happy path the new listeners never fire and drawing is byte-identical; the recovery path can only improve on today's permanent-blank. Recommended before relying on it: a manual `WEBGL_lose_context().loseContext()` / `.restoreContext()` smoke in a real browser, and a unit test once the `webgl/` ts-jest blocker clears.

---

---

## 7. Follow-up: line-styles + width fidelity + arrows (same session)

Finding #2 was framed as a *release-noted deferral* (ship the solid-line bulk, fix the GPU styles as P2). Owner call reversed it — styling connectors is core, so it must be in this PR. Landed on top of the fix commit:

| Issue (owner-reported) | Before | After |
|---|---|---|
| Connector styles not applied until selected | `ConnectorsCanvas` drew every connector as a solid single line | Full DOM matrix on the GPU: `style` DASHED/DOTTED (dash-walked) + `lineType` DOUBLE / DOUBLE_WITH_CIRCLE (two offset polylines + a mid-path ellipse ring), mirroring `<Connector>` |
| Rectangle border not applied + too thick | `borderStyle` ignored (solid); raw width | Dashed/dotted borders (dash-walked around the edge loop), matching `<Rectangle>`'s `3w 2w` / `w 2w` |
| **Strokes too thick / inconsistent across elements** | Authored widths (unprojected tile-px) applied raw in projected scene space → ~1.22× too thick in iso; connectors and rectangles diverged | A single `widthScale`, measured from `getTilePosition` (== the DOM's `getProjectionCss` factor; 0.817 iso / 1.0 2D), scales **all** bulk stroke widths — connectors and rectangles now consistent and DOM-matched |
| Arrows hard to see | Arrow drawn with a `(0,0,0,1)` black tint that zeroed its baked white outline | White `(1,1,1,1)` tint preserves the black fill + white outline → visible on dark lines |

New shared module [`webgl/lineStyle.ts`](../../packages/axoview-lib/src/webgl/lineStyle.ts) (`walkDots` / `walkDashes`) keeps the two layers' dash geometry identical. Gates after: tsc clean, jest **145 / 1483 + 1 skip**, eslint 0/6, build clean.

**Verification caveat (unchanged):** WebGL can't render under jsdom/SwiftShader in CI, so these are matched to the DOM's exact formulas and need a real-browser visual confirmation. The perf anti-cheat still holds — `dataset.drawCount` is one increment per connector regardless of style, and SOLID/SINGLE (the perf-harness default) emits the same instances as before.

---

*Measured 2026-07-08, `integration` @ `2cfb10c` (pre-fix) + this session's fix commits. Companion to [2026-07](technical-review-2026-07.md) (v3.0.3 snapshot). Fold ADR: [0038](../adr/0038-webgl-instanced-render-substrate.md).*
