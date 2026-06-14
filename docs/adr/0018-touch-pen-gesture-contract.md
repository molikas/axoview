# ADR 0018 — Touch / Pen Canvas Gesture Contract

**Status:** Accepted (shipped 2026-06-14)
**Date:** 2026-06-13
**Supersedes:** none
**Superseded by:** none

> **Implementation deviation (2026-06-14) — listener surface is `window`, not
> `rendererEl`.** Resolved decision (3) bound the pointer listeners to the
> Renderer container. Implementation found this is *incorrect* for cross-boundary
> gestures: a mouse drag that STARTS off-canvas (the Elements-panel drag-to-place,
> or a node drag released over a panel) takes implicit pointer capture to the
> off-canvas element, so its `pointermove`/`pointerup` retarget there and bubble
> to `window` — never reaching `rendererEl` (or the inner box). `setPointerCapture`
> cannot help a gesture the canvas never saw begin. The whole desktop e2e suite
> depends on panel-drag-to-place, so this is a correctness requirement, not a
> preference. **Resolution:** pointer listeners bind to `window` (a superset of
> the container that also covers the sibling anchor/label SceneLayers the
> rendererEl correction cared about); `setPointerCapture` is still taken on the
> interactions box, but only for **canvas-initiated** presses (gated on
> `rendererEl.contains(e.target)`) so off-canvas button/toolbar clicks are never
> stolen; the `isRendererInteraction` gate still scopes canvas reactions; and the
> four CSS guardrails (Decision 7) stay on the **container**. Everything else in
> the contract is unchanged — Pointer Events replace the mouse+touch-synthesis
> path, `pointerType` carries the device class, the (0,0) drop bug is gone.

## Context

The canvas has **no touch/pen interaction model.** It runs entirely on `window`
**mouse** events, with touch "supported" by synthesizing fake mouse events. Both
"move a node" and "place a node" assume the desktop press-drag-release sequence.
This breaks on every non-mouse input path:

- The unified listener attaches to `window` and translates `touchstart/move/end`
  → synthetic `mousedown/move/up`
  ([`useInteractionManager.ts`](../../packages/axoview-lib/src/interaction/useInteractionManager.ts#L867-L897)).
  `onTouchEnd` hardcodes `clientX: 0, clientY: 0`
  ([L889-L897](../../packages/axoview-lib/src/interaction/useInteractionManager.ts#L889-L897)),
  so a touch-drag commits at tile `(0,0)` — the node jumps to the corner.
- The drag-start threshold in
  [`Cursor.mousemove`](../../packages/axoview-lib/src/interaction/modes/Cursor.ts#L501-L505)
  is a **whole tile** (`CoordsUtils.isEqual` on tile coords), and the
  click-vs-clear decision on
  [`Cursor.mouseup`](../../packages/axoview-lib/src/interaction/modes/Cursor.ts#L561-L571)
  keys off `hasMovedTile`. On a **laptop trackpad** — which emits mouse/pointer
  events, *not* `TouchEvent`s — a tap is `down`+`up` with no tile movement, so it
  is read as click-select and never as a drag. "Tap node, lift, move, tap to
  drop" therefore just clears the selection.
- There is no `pointercancel` / multi-touch handling: when the OS reclaims the
  gesture (scroll, zoom, system edge-swipe) the canvas is left mid-drag.
- The canvas interaction surface
  ([`Renderer.tsx` `canvas-interactions` Box, L221-231](../../packages/axoview-lib/src/components/Renderer/Renderer.tsx#L221-L231))
  sets **no** `touch-action`, `user-select`, or `-webkit-touch-callout`, so the
  browser's native pan/zoom/long-press-callout fight the canvas for every touch.

A `changedTouches[0]` drop-coordinate fix for `onTouchEnd` was **tried and
reverted** (see [known_issues.md](../../known_issues.md)) — it patched one
touchscreen symptom and did nothing for trackpads or the pickup model. The root
cause is the **absence of a gesture contract**, not the drop coordinate. This ADR
defines that contract so implementation starts from a locked decision rather than
ad-hoc patching.

The repo already has the pattern this should converge on:
[`AnnotationLayer.tsx`](../../packages/axoview-lib/src/components/AnnotationLayer/AnnotationLayer.tsx#L403-L407)
is **Pointer Events based** (`onPointerDown`) and already sets
`touchAction: 'none'`. It is the in-repo precedent for the rewrite.

## Decision

### 1. Foundation — Pointer Events unification

Replace the `window` mouse-listener + touch-synthesis path with a single
**Pointer Events** layer bound to the canvas interaction surface
(`canvas-interactions` Box). One handler set —
`pointerdown`/`pointermove`/`pointerup`/`pointercancel` — drives all input.
`setPointerCapture` keeps a gesture attached to the canvas across element
boundaries. This mirrors `AnnotationLayer`'s already-shipped approach.

> The native mouse/touch listeners on `window` are removed. There is no longer a
> mouse→touch synthesis step; `pointerType` carries the device class natively.

> **Revision — 2026-06-14 (B): direct manipulation supersedes tap-to-place
> (Decisions 3/4) after real-device testing.** Device testing showed tap→tap‑to‑
> grab→tap‑to‑place fought users' muscle memory and overloaded long‑press
> (move vs context menu). The touch model is now **direct manipulation**, the
> Figma/Miro/Lucidchart standard, disambiguated by what is **under the finger at
> pointerdown**:
> - down on a **draggable target** (an interactable node, or a connector anchor
>   handle) → the whole gesture is forwarded as mouse events to the existing
>   modes: a **tap selects**, a **drag moves** the node (`DRAG_ITEMS` CSS‑preview)
>   or **reconnects** the anchor (`RECONNECT_ANCHOR`) — identical to desktop.
> - down on **empty canvas** → tap clears selection; drag **pans**.
> - **two fingers** → pinch‑zoom + pan (unchanged, D‑12).
>
> There is no `CARRY_ITEM` mode and no tap‑to‑place. **Long‑press is no longer
> overloaded** (move is a drag, not a hold): the OS `contextmenu` from a
> long‑press opens the per‑item **NodeActionBar** for the pressed node — reliable
> now because the touch pointerdown seeds `uiState.mouse.position`. That also
> closes the earlier D‑6 gap (delete / z‑order are reachable on touch via the
> long‑press action bar). Decisions 3, 4 and 6 below are **superseded** by this
> revision; the foundation (Pointer Events, `pointerType` branch, px tap‑vs‑pan
> threshold, guardrails, pinch) is unchanged.

### 2. Branch on `pointerType` — do **not** replace the desktop model

| `pointerType` | Gesture model |
|---|---|
| `mouse` | **Unchanged.** Today's press-drag-release (`Cursor` → `DragItems`). |
| `touch` | **Tap-to-select / tap-to-place** state machine (Decision 4). |
| `pen` | Same as `touch` (Apple Pencil, Surface Pen, etc.). |

The desktop press-drag-release model is correct for a mouse and stays. The new
state machine is an **additive branch** gated on `pointerType !== 'mouse'`, not a
wholesale replacement. A precision trackpad reports `pointerType: 'mouse'`, so it
keeps the desktop model — but with the pan/tap threshold fix from Decision 5,
which is what was actually broken for it.

### 3. Device coverage matrix

| Device / engine | Events fired | `pointerType` | Model | Platform-specific note |
|---|---|---|---|---|
| PC touchscreen (Win 11, Chrome/Edge) | Pointer + legacy Touch | `touch` | tap-to-place | Pen digitizer reports `pen`. |
| iPad / Safari (incl. Apple Pencil) | Pointer | `touch` / `pen` | tap-to-place | `-webkit-touch-callout: none` required to kill the text/callout menu; `touch-action: none` to kill rubber-band scroll & double-tap zoom. |
| Android / Chrome | Pointer | `touch` | tap-to-place | Native long-press context menu is why long-press-to-grab is rejected (Decision 6). |
| External mouse | Pointer (mouse) | `mouse` | press-drag-release | Unchanged. |
| Laptop trackpad / precision touchpad | Pointer (mouse) | `mouse` | press-drag-release | **Not** a TouchEvent source — fixed by the px-based threshold (Decision 5), not by the touch branch. |

### 4. Tap-to-place state machine (`pointerType` ∈ {`touch`, `pen`})

Three canvas states drive a node move: **SELECT → GRAB → PLACE**. No node ever
follows the finger between taps (touch has no hover), so the move is
"tap to pick up, tap to drop" — the same click-to-place precedent already used by
[`PlaceIcon`](../../packages/axoview-lib/src/interaction/modes/PlaceIcon.ts) for
new nodes (commit on `mouseup` to the nearest unoccupied tile).

```
                 tap empty
        ┌──────────────────────────────┐
        ▼                               │
   ┌─────────┐  tap item   ┌──────────┐ │ tap same    ┌──────────┐
   │  IDLE   │────────────▶│  SELECT  │─┼────────────▶│   GRAB   │
   │(no sel) │             │ (1 item) │ │ selected     │(carrying)│
   └─────────┘◀────────────└──────────┘ │ item         └────┬─────┘
        ▲   tap empty (clears)   ▲       │                   │
        │                        │       │ tap target tile   │
        │                        └───────┼───────────────────┘
        │                                │  PLACE → node moves to nearest
   pointercancel / 2nd finger ───────────┘  unoccupied tile, returns to SELECT
   (abort carry, node stays at origin)
```

Transition rules:

- **Tap an unselected item** → `SELECT` (selects it, opens Properties as a
  single-selection does today). No move yet.
- **Tap the already-selected item again** → `GRAB` (enters "carrying"). The
  two-step pickup is deliberate: it prevents an accidental relocation on a
  fat-finger tap and gives the user a clear "I am now moving this" moment.
- **Tap any tile while in `GRAB`** → `PLACE`: the carried item moves to the
  nearest unoccupied tile under the tap (reusing `findNearestUnoccupiedTile`,
  the `PlaceIcon` rule), then returns to `SELECT` at its new location.
- **Tap a different item** (from `SELECT`) → selects that one (replaces
  selection), per the §4.4 left-click-replaces rule.
- **Tap empty canvas** from `SELECT` → clears selection → `IDLE`.
- **`pointercancel`, or a second finger touching down** during `GRAB` →
  **abort**: the node stays at its origin, state returns to `SELECT`. The OS
  reclaiming the gesture must never leave a half-placed node.

Tap-vs-pan disambiguation (Decision 5) gates *every* "tap" above: a press that
moves beyond the pan threshold before lift is a **canvas pan**, not a tap, and
does not advance the state machine.

**"Carrying" visual affordance.** The grabbed node renders a picked-up
treatment — elevation shadow + slight scale/opacity lift on the node itself — so
the `GRAB` state is unmistakable. This is **not a new surface**: it is canvas
drag-preview chrome and reuses the `DragItems` CSS-preview path
([`DragItems.ts`](../../packages/axoview-lib/src/interaction/modes/DragItems.ts))
and the §8.8 screen-pixel-stable canvas-anchored-chrome rule. Per ADR 0008
Decision 2 the locked surface vocabulary (Modal/Dialog/Popover/Panel/Banner/
Screen) is **not** extended — none of those terms apply to an in-canvas preview,
and we do not invent a sixth.

### 5. Tap-vs-pan threshold (replaces the whole-tile threshold)

Disambiguation is **pixel-based on the raw pointer delta**, not tile-based:

- A press that lifts within `TAP_SLOP_PX` of its `pointerdown` point (default
  ~8-10 screen px) **and** within `TAP_TIME_MS` is a **tap**.
- A press that moves beyond `TAP_SLOP_PX` before lift is a **drag/pan** — canvas
  pan for empty space, press-drag-release move for `mouse`.

This single change is what unbreaks the laptop trackpad: the current whole-tile
([`Cursor.ts:501-505`](../../packages/axoview-lib/src/interaction/modes/Cursor.ts#L501-L505))
threshold means a sub-tile trackpad drag is invisible to drag detection. The
px-slop threshold applies to **all** `pointerType`s.

### 6. Rejected: long-press-to-grab

Long-press-to-grab was **considered and rejected.** On every touch OS a sustained
press fires the native long-press affordance — text callout / context menu /
haptic-touch — which would require per-platform suppression
(`-webkit-touch-callout`, `contextmenu` preventDefault, Android timing hacks)
that is fragile and never fully reliable across Safari/Chrome/WebView. Tap-to-
place needs no timing primitive, collides with no OS gesture, and is the
device-agnostic choice. This rejection is recorded so it is not re-proposed.

### 7. Shared guardrails (identical on every platform)

These are not per-device; they apply to the one canvas interaction surface:

1. **`touch-action: none`** on the canvas interaction surface — currently
   missing. Must live on the element that *receives* the touch (the
   `canvas-interactions` Box / renderer container), **not** on `window` where the
   listeners historically lived.
2. **`user-select: none`** + **`-webkit-touch-callout: none`** on the canvas, to
   stop text selection and the iOS callout menu hijacking a drag.
3. **`preventDefault` on `contextmenu`** (already on `window`) **and during a
   grab**, so a long press in `GRAB` cannot raise the OS menu.
4. **`pointercancel` handling** to abort a `GRAB` (carrying) state when the OS
   reclaims the gesture (Decision 4's abort transition).

## Consequences

**Positive:**

- One input path (Pointer Events) replaces the dual mouse-listener +
  touch-synthesis path; `pointerType` distinguishes device class natively, so the
  `(0,0)` drop bug and the synthesis layer disappear by construction.
- Touch and pen get a deliberate, OS-collision-free move gesture; trackpads get a
  working drag via the px threshold.
- The desktop mouse experience is untouched (additive branch).
- Converges the canvas onto the same Pointer-Events + `touch-action: none`
  pattern `AnnotationLayer` already ships.

**Negative / risks:**

- Rewriting the core input layer touches the most interaction-sensitive code in
  the app; regressions there are high-visibility. Mitigated by keeping the
  `mouse` branch behaviourally identical and phasing the work (tactical plan).
- The two-step tap-to-grab is one extra tap vs a hypothetical one-tap grab;
  accepted as the cost of preventing accidental moves (revisit only if user
  testing says otherwise).
- `touch-action: none` disables browser pan/zoom on the surface — the canvas must
  own pan/zoom itself for touch. It does: **one-finger drag pans, two-finger
  pinch zooms + pans** (Resolved decision D-12, 2026-06-14), routed through
  `setScroll`/`setZoom` exactly like wheel-zoom/`Pan.mousemove` so the
  `SceneLayer` direct-DOM subscription stays React-render-free. The on-screen
  `ZoomControls` `+`/`−` remain a tappable button path. No hand-tool selection is
  required for touch navigation.

## Implementation notes (non-binding)

- **Listener surface = the Renderer container (`rendererEl`), NOT the inner
  `canvas-interactions` Box.** Pointer listeners must bind to the container at
  [`Renderer.tsx`](../../packages/axoview-lib/src/components/Renderer/Renderer.tsx#L167-L181)
  (`uiState.rendererEl`), not the inner Box at
  [L221-231](../../packages/axoview-lib/src/components/Renderer/Renderer.tsx#L221-L231).
  Connector-anchor reconnect, waypoint drag, and linked-label clicks live in the
  **sibling** `ConnectorAnchorOverlay` / `ConnectorLabels` SceneLayers — they are
  descendants of `rendererEl` but **not** of the interactions Box, so binding to
  the Box alone breaks them. `setPointerCapture` is taken on the interactions Box
  to keep the `isRendererInteraction` gate true mid-gesture. The four CSS
  guardrails (Decision 7) go on the **container** so they also cover the `auto`
  anchor/label elements. Full proof:
  [canvas-interaction-baseline.md §6.2/§8](../tactical/canvas-interaction-baseline.md)
  and [behavior-map §5.3](../tactical/canvas-interaction-behavior-map.md).
  *(This corrects the earlier shorthand that named the `canvas-interactions` Box.
  **Authoritative as of 2026-06-14:** wherever Decision 1 / 7.1 say "the
  `canvas-interactions` Box", read "the Renderer container (`rendererEl`)". See
  Resolved decision (3) below.)*
- Rewrite target:
  [`useInteractionManager.ts`](../../packages/axoview-lib/src/interaction/useInteractionManager.ts)
  — drop `onTouchStart/Move/End` + the `window` mouse listeners; add pointer
  handlers carrying `pointerType` into the mode `State`.
- The mode `State` (consumed by every mode) gains the originating `pointerType`
  so `Cursor` can branch. The tap-to-place machine can be a dedicated mode
  (e.g. `CarryItem`) alongside `DragItems`, or a sub-state of `Cursor` — left to
  implementation.
- `findNearestUnoccupiedTile` + the `PlaceIcon` commit path are the reuse target
  for `PLACE`.
- Thresholds (`TAP_SLOP_PX`, `TAP_TIME_MS`) belong in a config module, not inline
  constants.

## Acceptance criteria

- **Unit test:** tap-vs-pan classifier returns "tap" for a sub-`TAP_SLOP_PX`
  delta and "pan/drag" beyond it, independent of tile size.
- **Unit test:** the SELECT → GRAB → PLACE state machine moves a node to the
  tapped tile and a `pointercancel` mid-`GRAB` leaves the node at its origin.
- **Manual verification (per device in the matrix):**
  - PC touchscreen, iPad/Safari, Android/Chrome: tap a node → tap again → tap a
    free tile; node relocates there (not to the corner). Second finger / app
    switch mid-carry aborts cleanly.
  - Laptop trackpad: a short tap selects; a small drag moves the node (no longer
    swallowed by the whole-tile threshold).
  - External mouse: press-drag-release move is byte-for-byte unchanged.
  - No native callout / context menu / text-selection appears on any touch
    gesture over the canvas.

## Resolved contract decisions (2026-06-14)

The questions surfaced 2026-06-13 by the pre-rewrite mapping
([behavior-map §5.4](../tactical/canvas-interaction-behavior-map.md)) are now
**resolved by the ADR owner.** These bind the implementation; the execution
sequence is in the [tactical plan](../tactical/touch-pen-gesture-contract.md).

1. **D-6 — Per-item actions on touch route through the Properties panel.** The
   floating NodeActionBar stays **desktop / right-click-only**; tap-on-selected
   remains GRAB (Decision 4, unchanged). On touch, the per-item actions
   (delete, assign-layer, start-connector, z-order, edit name/style/notes/link)
   are reached through the right-hand **Properties panel**, which already opens on
   selection. No new gesture, no new canvas chrome. Implementation must confirm
   every NodeActionBar action has a Properties-panel route on touch and file a
   follow-up for any that don't.

2. **D-2 — "Node stays at origin" is scoped to the CSS-preview node carry only.**
   Decision 4 / 7.4's abort applies to the touch **node carry**, which already
   aborts-to-origin naturally (preview discarded, model never written until
   commit). **No `rollbackDragTransaction` is added in this feature.** The
   reducer-path modes (anchor reconnect, rectangle, textbox) mutate per frame and
   are **out of scope** for uniform abort — revisit with a future rollback
   primitive (which would also address D-1, the per-mode Escape inconsistency).
   Decision 4/7.4 should be read as "the carried node stays at origin."

3. **Listener surface = `rendererEl` (applied).** Wherever Decision 1 / 7.1 say
   "the `canvas-interactions` Box", read **"the Renderer container
   (`rendererEl`)"** — binding to the inner Box alone breaks connector-anchor
   reconnect, waypoint drag, and linked-label clicks (sibling subtrees; see
   Implementation notes + behavior-map §5.3). The four CSS guardrails go on the
   container. `setPointerCapture` is taken on the interactions Box to keep
   `isRendererInteraction` true mid-gesture.

4. **D-12 — Touch navigation: one-finger pan + two-finger pinch-zoom (pinch now
   IN scope).** This supersedes the earlier "pinch-zoom is a follow-on" framing.
   The touch navigation model is:
   - **Tap** (< `TAP_SLOP_PX`) → select / place (Decision 4).
   - **One-finger drag** (> `TAP_SLOP_PX`) → **pan** (via `setScroll`). No hand
     tool required.
   - **Two fingers** (outside a GRAB) → **pinch-zoom + two-finger pan**: track the
     pointers' centroid + distance; distance ratio → `setZoom` (zoom-to-centroid,
     mirroring wheel zoom-to-cursor), centroid shift → `setScroll`. Both routed
     through the `SceneLayer`-subscribed store so zoom/pan stay React-render-free.
     Clamp to `MIN_ZOOM`/`MAX_ZOOM`. The on-screen `ZoomControls` `+`/`−` remain a
     button path.
   - **Second finger *during* a GRAB** → **abort** the carry (Decision 4/7.4) — it
     does **not** zoom; the grab is a modal state and takes precedence.
   - **Graceful degradation:** a 2nd pointer landing must immediately suspend an
     in-flight single-finger pan so the canvas never lurches.
   Out of scope: multi-touch beyond pinch / two-finger pan / second-finger-abort
   (3-finger gestures, rotate).

5. **D-7 sequencing (pre-rewrite).** The confirmed live P0 dual-stack undo skew
   ([behavior-map §4.5](../tactical/canvas-interaction-behavior-map.md)) is fixed
   via sequence-stamping as **commit 1 of the rewrite branch**, before the input
   rewrite, because the rewrite makes paired drag-commits the hot path.
