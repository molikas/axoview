# ADR 0051 — View Rotation: Default Angle, Sharing & Export

**Status:** Proposed
**Date:** 2026-10-03
**Supersedes:** none
**Superseded by:** none

*(Non-supersession context: sibling of [ADR 0049](0049-view-rotation-camera-and-projection-model.md) (camera model, controls) and [ADR 0050](0050-view-rotation-render-and-legibility-policy.md) (render policy). Adds an optional zero-migration view field in the pattern of [ADR 0023 §1](0023-off-grid-positioning-and-collision.md). Applies the ephemeral view-control rule of [ux-principles §8.10](../guidelines/ux-principles.md) and [ADR 0013](0013-preview-mode-layer-switcher.md), extends the export dialog of [ADR 0025](0025-image-export-robustness-and-presets.md), and behaves consistently across the share routes of [ADR 0042](0042-drive-native-sharing-and-readonly-preview.md).)*

## Context

The POC keeps the angle in `uiState` only. So it resets on reload and never reaches a share link or Present. Because export renders a fresh instance, it never reaches an exported image either. The owner asked three things: whether the angle should persist, whether viewers of a shared diagram get the control, and whether export should capture the current view or the default one. The investigation (2026-10-03) established:

- **Camera state is never persisted today.** Zoom and scroll live in the instance's `uiState`, not in the model, browser storage or the URL.
  - Every open fits to content, because the app always saves `fitToScreen: true`.
  - Switching pages keeps zoom and scroll ([`useInitialDataManager.ts`](../../packages/axoview-lib/src/hooks/useInitialDataManager.ts)).
  - The iso/2D choice is a per-user preference in localStorage ([`persistedSettings.ts`](../../packages/axoview-lib/src/config/persistedSettings.ts)), which viewers may not write.
- **Only model changes dirty a diagram or enter undo.** uiState has no history stack. Dirty tracking, autosave and the leave-page prompt all subscribe to the model.
- **A per-view field survives old clients.** It is kept through load and re-save, for these reasons:
  - The zod schemas strip unknown keys by default, but the loader stores the raw object it validated rather than the stripped result.
  - Views pass by reference through every save path.
  - The Express backend and the worker do not validate the body.
  - The project zip and Drive store the blob verbatim.

  An optional key on a view therefore survives an old client's load and re-save. A top-level key would be dropped.
- **Viewers already get the dock.** Display, share and Present routes run `EXPLORABLE_READONLY`, and the BottomDock renders there unless "Hide controls" is on. Viewers may pan, zoom and use the viewer-classed keys of [`readonlyPolicy.ts`](../../packages/axoview-lib/src/interaction/readonlyPolicy.ts). They may never write the model (VIEW-08).
- **Present reloads the page.** It navigates to the display route, so anything held only in the editor's uiState is lost.
- **Share links carry no view parameters**, and an old client would ignore one.
- **Export is editor-only.** The dialog is offered from the editor toolbar and the file explorer, not from display or Present. It renders a hidden instance from the model.

**Owner decisions (2026-10-03):**
- an explicit per-page default angle;
- viewers get the rotation controls;
- export uses the angle as viewed, with the page default selectable.

## Decision

### 1. The live angle is ephemeral; the page default is the only persisted angle

- **Rotating never writes the model**, in any mode: no dirty flag, no undo step, no autosave.
- **A view (page) may carry an authored default.** Add to [`viewSchema`](../../packages/axoview-lib/src/schemas/views.ts):

  ```ts
  // Page default view rotation (ADR 0051): degrees in (-180, 180], rounded to 0.1.
  // Absent = 0, i.e. today's view byte-for-byte. Positive = floor turned
  // counter-clockwise as seen from above (ADR 0049 §1).
  defaultRotation: z.number().gt(-180).lte(180).optional()
  ```
- **Zero-migration.**
  - Old files have no field.
  - Old clients open at 0° and save the field back intact.
  - Snapshot shares freeze it at share time; Drive shares read it live.
  - A self-hosted deployment pinned to an older version shows 0°.

### 2. Setting the default is an explicit, undoable edit

- **Editor only.** In EDITABLE, the rotation widget offers **Set as page default** whenever θ differs from the page default.
- **The pin is a toggle (2026-10-03).** While the view sits on a pinned, non-zero default, the pin shows filled and pressed, and clicking it **unpins** the default, so the page opens at 0° again. The camera stays where it is. Without this, a pinned angle could only be undone with Ctrl+Z or by rotating back to 0° and pinning that. The pin never disappears; it is disabled in place at 0° with no default, so the dock does not reflow as the view turns.
- **Confirmed in words (2026-10-03, UX review).** Pinning and unpinning change the page for everyone, so each shows a notice naming the effect and that undo reverts it, instead of relying on hover text. There is no confirm dialog: the change is one undo step.
- **An ordinary edit.** It writes `defaultRotation` through the normal view update: one undo step, marked dirty, autosaved like any other edit. Setting the default to 0 removes the field, and so does unpinning.
- **Nowhere else.** It is never offered in view-only, Present or `NON_INTERACTIVE` instances.

### 3. Where the default applies

- **θ takes the page default:**
  - when a diagram loads, with no carry-over from the previous diagram (the POC carried it over);
  - when switching pages (zoom and scroll still carry over, as today);
  - on every display, share and Present route.
- **Reset returns to the page default**, not to 0°. The widget's tooltip names both. The angle readout is the reset button and carries a reset glyph, so it reads as one. **It has exactly one target and is disabled once there (2026-10-03, UX review).** A version that went on to 0° from a pinned default made a double-click land on 0°, contradicting the tooltip. After pinning, the way back to 0° is unpin, then reset.
- **A load-time hint can override it.** `initialData.viewRotation`, alongside `view` and `fitToView`, overrides the default. The export instance uses it (§5), and embedders may too.
- **2D:** the default is retained but not applied (ADR 0049 §1).

### 4. Viewers rotate freely and locally

- **Same controls, minus one action.** In EXPLORABLE_READONLY the widget, Q/E and Alt+drag behave as in the editor, except that **Set as page default** is absent.
- **The angle stays with that viewer** and resets on reload.
- **Classification.** Q/E are classified `viewer` in `readonlyPolicy.ts`, and its contract test enforces that.
- **Hide controls.** "Hide controls" hides the widget along with the dock. The keys and the gesture keep working, as arrow-key panning does.
- **No share-link parameter in v1.** The page default covers the need to share a perspective. A per-link angle could later use `initialData.viewRotation`.

> **TODO (owner):** should Present launched from the editor open at the presenter's live angle instead of the page default? The angle would ride in router state, the way `fromEditor` already does.

### 5. Export: as viewed by default, page default selectable

- **The default is the live angle.** The export dialog renders at the live θ.
- **When they differ, offer both.** If θ differs from the page default, the dialog's Appearance group offers **Angle: As viewed (θ°) / Page default (d°)**.
- **No live canvas, no live angle.** Exports started from the file explorer use the page default.
- **Wiring.**
  - The chosen angle reaches the hidden instance through `initialData.viewRotation`.
  - Export bounds are computed at that angle; today they are taken from the main instance.
  - The option joins the re-capture dependencies.
- **JSON and project-zip exports** carry `defaultRotation` as part of the model. They never carry the live angle.

## Consequences

**Positive:**
- **Authors control the opening angle** for recipients, Present and exports.
- **Looking around never dirties a diagram** or pollutes undo.
- **Compatible both ways** with no migration.
- **Viewers get parity** with editors.
- **Export is what-you-see-is-what-you-get**, with a deliberate alternative.

**Negative / risks:**
- **A permanent schema field.**
- **Two angle concepts**, live and default, that the widget must keep legible.
- **Each page's default is set separately.**
- **Older pinned deployments show 0°.**
- **Present opens at the default** unless the TODO above resolves otherwise.

## Implementation notes (non-binding)

- **Lean save.** Omit `defaultRotation` when it is 0, in the same way the other optional view fields are omitted.
- **Undo.** The set-default action is a timestamped `UPDATE_VIEW`, one history entry.
- **Load and page switch.** Apply the default in `useInitialDataManager` (load) and in the `setView` path (page switch). Clear any viewer-local angle on both.
- **Export dialog.** `ExportImageDialog` needs the angle in its hidden instance's `initialData`, its bounds call, and its re-capture dependency list.

## Acceptance criteria

- **Unit tests:**
  - The schema round-trips with and without the field.
  - An old-client simulation (raw load, re-save) keeps the field.
  - Set-default adds exactly one undo entry and marks the diagram dirty; rotating adds none.
  - On a pinned default the pin is pressed and unpins (one undo entry); pin and unpin each raise a notice. Reset goes to the default when off it and is disabled on it.
  - Load and page switch apply the page default.
  - `initialData.viewRotation` wins over the default.
  - Q/E are classified `viewer` (readonly-surfaces contract).
- **E2E:**
  - A display route opens at the page default.
  - A viewer rotates with no dirty state and no save request.
  - An export at θ ≠ default offers both angles, and the two PNGs differ.
- **Manual verification:**
  - A Drive share recipient sees the default.
  - A snapshot share keeps the angle frozen at share time.
