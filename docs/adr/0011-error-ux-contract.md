# ADR 0011 — Error UX Contract

**Status:** Proposed
**Date:** 2026-05-22
**Supersedes:** none
**Superseded by:** none

## Context

Two failure-of-intent surfaces shipped between [commit cff3942](../../packages/axoview-app/src/components/LocalModeShareErrorDialog.tsx) (B2, 2026-05-21) and [commit 2a04061](../../packages/axoview-app/src/components/ReadonlyLoadErrorDialog.tsx) (B-1 follow-up, 2026-05-22) converged independently on the same component shape — same MUI primitives, same prop interface, same styling sx, same i18n namespace layout, same dismiss semantics. The convergence was not coordinated; each landed in response to a specific bug ([A.4 #C5](../tactical/productization-audit.md) for the share-link case, [B-1 baseline finding #3](../tactical/productization-audit.md) for the owner-readonly case) and arrived at the contract by following the path of least surprise.

The [productization-audit B-9a investigation](../tactical/productization-audit.md) catalogued the two precedents and inventoried the SPA's remaining error surfaces. Findings (2026-05-22):

- **6 already-correct surfaces** — the two named dialogs plus four in-context inline error states (ImportDialog, AppToolbar share popover, ExportImageDialog, ExportProjectZipDialog).
- **20 silent-failure surfaces** — failure-of-intent paths that surface only via `notificationStore.push()` toasts (S1–S20 in B-9a) or fully-swallowed `.catch(() => {})` handlers.
- **5 intentional-silent surfaces** — boot-time probes, fire-and-forget rehydration, thumbnail dynamic-import, the ADR 0009 D2 `/api/config` fallback, service-worker registration.

The accidental convergence of the two existing dialogs is evidence that the contract is *latent in the project's MUI + i18n + React Router conventions*. This ADR writes it down so future error surfaces inherit it on purpose rather than by accident, and so existing toast-only paths have an explicit target to be retrofitted against (catalogued as the [audit's B-9b](../tactical/productization-audit.md) row, gated on T1).

Cross-cutting references that this ADR formalises:

- [ADR 0008 Decision 2](0008-naming-convention.md#2-modal-vs-popover-vs-dialog-vs-panel--locked-vocabulary) — "Dialog" = centred overlay, focus-trapped, requires explicit user action. Both error surfaces in scope are Dialogs per this vocabulary.
- [ADR 0008 Decision 1](0008-naming-convention.md#1-component-file-names-disambiguate-when-colliding-describe-surface-not-state) — per-scenario file naming. `LocalModeShareErrorDialog`, `ReadonlyLoadErrorDialog` are already conformant; future error dialogs follow the same `<Scenario>ErrorDialog.tsx` pattern.
- [ADR 0009 Decision 3](0009-deployment-topology.md#3-readonly--share-link-is-a-session-mode-only-overlay-local-mode-must-error-explicitly) + its 2026-05-22 addendum — the share-link / owner-readonly explicit-error contract. This ADR generalises that decision's "no silent empty state" framing across all failure-of-intent paths.

## Decision

### 1. Every failure-of-intent surfaces an explicit Dialog

When a user-initiated action fails — they clicked a button, typed a URL, dragged a file, pressed Enter on a rename — and the failure prevents the action from completing, the SPA surfaces an explicit **Dialog** per [ADR 0008 Decision 2's vocabulary](0008-naming-convention.md#2-modal-vs-popover-vs-dialog-vs-panel--locked-vocabulary): centred, focus-trapped, requires explicit dismissal.

**Forbidden patterns:**

- Silent redirect on failure (`window.location.href = '/'`, `navigate('/')` inside a `catch` without user-visible cause). [Closed by B-1 in 2026-05-22.](../tactical/productization-audit.md#b-1-investigation-findings-2026-05-22)
- Silent dismiss (`.catch(() => {})` or `setShow*(false)` in a catch arm) when the user initiated the action.
- Notification-only handling (a `notificationStore.push({ severity: 'error', ... })` toast as the sole UI signal) for failures that prevent the intended action from completing.

**Carve-out — toasts remain valid for side-effect failures.** Background sync, autosave retry, rehydration writes, thumbnail generation, boot-time probes — failures of *side-effect* operations are not failures-of-intent and continue to use [notificationStore](../../packages/axoview-app/src/stores/notificationStore.ts) or console logging. The discriminator is *"did the user just click/type/drag to trigger this?"* — if yes, the failure is failure-of-intent.

**Carve-out — in-dialog inline error states are valid.** When the user is already inside a Dialog (Import, Export, share popover) and the in-dialog action fails, an inline error region inside the same Dialog is the correct affordance — the user's recovery context is the dialog itself; spawning a second Dialog over it is jarring. [ImportDialog.tsx](../../packages/axoview-app/src/components/fileExplorer/ImportDialog.tsx#L118), [AppToolbar share popover](../../packages/axoview-app/src/components/AppToolbar.tsx#L75-L88), and [ExportImageDialog](../../packages/axoview-lib/src/components/ExportImageDialog/ExportImageDialog.tsx#L149) all follow this in-dialog-inline pattern and are contract-conformant without spawning a child Dialog.

### 2. Dialog shape — locked

Every failure-of-intent Dialog follows the shape both existing precedents (LocalModeShareErrorDialog, ReadonlyLoadErrorDialog) converged on independently:

```tsx
<Dialog open={open} onClose={onDismiss} maxWidth="xs" fullWidth
  PaperProps={{ sx: { boxShadow: '0px 10px 20px -2px rgba(0,0,0,0.25)', borderRadius: 2 } }}>
  <DialogTitle sx={{ pb: 1 }}>
    <Typography variant="h6" component="span">{headline}</Typography>
  </DialogTitle>
  <DialogContent sx={{ pt: 0 }}>
    <Typography variant="body2" color="text.secondary">{body}</Typography>
  </DialogContent>
  <DialogActions sx={{ px: 2.5, pb: 2.5, pt: 1 }}>
    {secondaryAction && (
      <Button variant="text" onClick={secondaryAction.onClick}>{secondaryAction.label}</Button>
    )}
    <Button variant="contained" onClick={onDismiss} autoFocus>{primaryLabel}</Button>
  </DialogActions>
</Dialog>
```

**Locked constraints:**

- **Headline:** one line, ≤ 60 characters, sentence case, ends with a period. Names the failure in the user's vocabulary, not the API's.
- **Body:** 1–3 lines. Names the likely cause(s) and, if known, the user's recovery affordance. No stack traces, no error codes, no HTTP status numbers in the visible copy.
- **Primary dismiss action:** one Button, `variant="contained"`, `autoFocus`. Default label is "OK"; per-scenario labels are encouraged when a more specific verb fits (e.g., "Back to editor" for the owner-readonly case).
- **Optional secondary action:** at most one. `variant="text"`. Used for "Retry", "Open settings", "Back to <context>" affordances. Renders to the left of the primary.
- **Visual primitives:** MUI `Dialog` + `DialogTitle` + `DialogContent` + `DialogActions` + `Typography` + `Button`. No raw `<div>` overlays, no custom focus traps — let MUI own the a11y semantics.
- **Sizing:** `maxWidth="xs" fullWidth`. The error message is short by definition; a wider Dialog signals an interactive form, not an error.

### 3. Dismiss semantics — return to a sensible base state

Dismiss clears the failure state **and** routes the user back to a context they can act from. The two existing dialogs settled on `navigate('/', { replace: true })` because both fired during diagram-load failures where the canvas was empty. Other scenarios may dismiss to a different base state:

- **Boot-time / load failures:** dismiss returns to the root route (`/`) with `replace: true` so the failed URL doesn't survive in browser history.
- **In-editor action failures (e.g., a Save failure):** dismiss closes the Dialog but leaves the editor state intact so the user can retry; no navigation.
- **External-context failures (e.g., a clipboard write or external service failure):** dismiss closes the Dialog; if a partial state was created (a snapshot row was inserted before the share-link generation failed), the dismiss handler is responsible for the rollback or for surfacing the partial state to the user as a recoverable item.

**Rule:** the dismiss handler is the dialog's parent (or its hook), not the dialog component. The dialog is a dumb presenter; `onDismiss` is wired by the mount site to whatever base-state restoration is correct for the scenario.

### 4. Per-scenario component naming and file layout

Every failure-of-intent dialog is its own component file at [packages/axoview-app/src/components/](../../packages/axoview-app/src/components/) named `<Scenario>ErrorDialog.tsx` per [ADR 0008 Decision 1](0008-naming-convention.md#1-component-file-names-disambiguate-when-colliding-describe-surface-not-state).

**Scenario naming convention (locked):**

- The `<Scenario>` is **PascalCase**, **describes the failure surface**, and is short enough to compose: `LocalModeShareError`, `ReadonlyLoadError`, `PublicShareLoadError`, `SaveError`, `ImportError`.
- The scenario describes *what failed*, not *why*. `SaveError` is correct; `NetworkError` is not (network is a cause, save is the surface).
- The file owns one Dialog. If two scenarios share copy, that is a hint that the contract's scope is wrong — split, don't share.

**Rationale for per-scenario over a generic `<ErrorDialog>`:** the two existing dialogs converged on identical shells precisely because the shape is small (~55 lines including imports). A generic `<ErrorDialog headline body primaryLabel onDismiss />` would save ~45 LOC per scenario but lose the discoverability that grep-for-`<ScenarioName>ErrorDialog` provides. Per-scenario files also let each error keep its scenario-specific i18n key tree without a runtime prop-drilling layer.

A future audit may extract a shared base if the per-scenario count grows large (≥ 6 dialogs) and the convergence remains exact. That extraction is its own ADR.

### 5. State management — dumb component, smart parent

Each error dialog is a **dumb component**. Its props are exactly `{ open: boolean; onDismiss: () => void }` plus any scenario-specific data the body needs to render (rare; most scenarios encode the data in the i18n string).

State ownership pattern (the contract):

- **Boolean error state** — the parent (or a hook in the parent's tree) holds a `<scenario>Error: boolean` or `<scenario>ErrorDetails: ScenarioErrorDetails | null` state.
- **Setter / clearer** — the parent exposes a `set<Scenario>Error(value)` or `clear<Scenario>Error()` setter. The clearer is what the dialog's `onDismiss` calls (often together with the navigation handler).
- **Context exposure** — if multiple components need to trigger the error, the state lives in a Context (`DiagramLifecycleContext` for diagram-lifecycle failures, `AppStorageContext` for storage failures, etc.) with both the state value and the setter exposed via the context interface.
- **Mount site** — the dialog is mounted once at a stable point in the tree (typically [App.tsx](../../packages/axoview-app/src/App.tsx), near the existing two precedents) with its `open` prop derived from the state and its `onDismiss` wired to the clear-setter + any extra base-state restoration.

The [ReadonlyLoadErrorDialog precedent](../../packages/axoview-app/src/providers/DiagramLifecycleProvider.tsx#L83-L84) demonstrates the pattern end-to-end: `readonlyLoadFailed: boolean` + `clearReadonlyLoadFailed: () => void` on `DiagramLifecycleContext`, consumed at [App.tsx:377-383](../../packages/axoview-app/src/App.tsx#L377-L383) with the dismiss handler wired to clearer + `navigate('/', { replace: true })`.

### 6. i18n namespace — `dialog.<scenario>.*`

Every error-dialog string lives in [packages/axoview-app/src/i18n/en-US.json](../../packages/axoview-app/src/i18n/en-US.json) under a `dialog.<scenario>.*` key tree, mirroring the two existing precedents:

```json
"dialog": {
  "<scenario>": {
    "headline": "...",
    "body": "...",
    "btnDismiss": "..."
  }
}
```

Optional keys:

- `btnSecondary` — when the dialog has a secondary action.
- Per-scenario detail keys when the body needs interpolation (e.g., `"body": "Could not open \"{{name}}\"."` with the diagram name interpolated).

Every key has a default English fallback at the call site via `t('dialog.<scenario>.headline', 'Default English headline.')` — this lets non-English locales fall back gracefully without requiring every locale file to be in lockstep with new error scenarios. The 7 other locale files (`fr-FR.json`, `zh-CN.json`, …) catch up on the next translation pass.

The `<scenario>` segment in the key tree matches the `<Scenario>` in the component name, lowercased and camel-cased: `LocalModeShareErrorDialog` → `dialog.localModeShareError.*`. This is mechanical so a future grep for the scenario name surfaces both the component and the strings.

### 7. What this contract does NOT cover

- **Toast notifications for side-effect failures** — autosave retries, background sync, fire-and-forget rehydration, thumbnail generation. These continue to use [`notificationStore`](../../packages/axoview-app/src/stores/notificationStore.ts) as today.
- **In-dialog inline error states** — when the user is already inside a Dialog (Import, Export, share popover) and the in-dialog action fails. Inline `setError` state inside the same dialog is correct; do not spawn a child Dialog.
- **Boot-time fallback paths** — the [`/api/config` Local-mode fallback](../../packages/axoview-app/src/hooks/useRuntimeConfig.ts#L36-L44) per [ADR 0009 D2](0009-deployment-topology.md#2-mode-detection-collapses-to-a-single-probe-runtimeconfigserverstorage-is-removed) is an explicit non-user-facing fallback with a console warning. That contract stands.
- **Validation errors in editable forms** — these are inline form-field error states (red helper text, etc.), not error Dialogs. The contract is specifically about failures of asynchronous actions that have already been committed by the user (clicked Save, dropped a file, typed a URL).

### 8. Acceptance criteria

- The two existing dialogs ([LocalModeShareErrorDialog.tsx](../../packages/axoview-app/src/components/LocalModeShareErrorDialog.tsx), [ReadonlyLoadErrorDialog.tsx](../../packages/axoview-app/src/components/ReadonlyLoadErrorDialog.tsx)) conform to Decisions 1–6 after the retrofit verification in the audit's B-9a row. Any drift discovered (i18n key shape, dismiss semantics, prop interface) is corrected in the same commit.
- The S1 surface from B-9a (public-share `/api/public/diagrams/<uuid>` load failure) is retrofitted to surface an explicit `PublicShareLoadErrorDialog` instead of the current `notificationStore` toast — same shape, same contract.
- Future error-handling commits reference this ADR in their commit messages when introducing a new error surface, so reviewers can verify contract conformance.

## Consequences

### Positive

- The contract is *latent in the codebase already* — both precedents arrived at it without coordination. Writing it down formalises it without imposing a new shape.
- Future error surfaces inherit the shape automatically; reviewers have a written gate to push back against drift (raw `<div>` overlays, headline + body shape, dismiss semantics).
- The audit's B-9b row gains a concrete target. The 20 toast-only paths in [B-9a's inventory](../tactical/productization-audit.md) are now classified surfaces with a defined retrofit shape, not unstructured technical debt.
- Cross-ADR coherence: [ADR 0008 D1](0008-naming-convention.md#1-component-file-names-disambiguate-when-colliding-describe-surface-not-state) + [D2](0008-naming-convention.md#2-modal-vs-popover-vs-dialog-vs-panel--locked-vocabulary) + [ADR 0009 D3](0009-deployment-topology.md#3-readonly--share-link-is-a-session-mode-only-overlay-local-mode-must-error-explicitly) now compose into a single explicit contract for failure-of-intent UX.

### Negative / open

- **The dialog-vs-toast judgement for inline tree operations is deferred.** Many of the B-9a S-surfaces (rename, delete, drag-move) live inside the file explorer where a modal Dialog would interrupt the user's recovery context. This ADR leaves the per-surface call to B-9b post-T1; the contract permits both in principle (Decision 1's carve-outs) but does not enumerate the dividing line. The carve-out language is the load-bearing part of this gap.
- **No build-time enforcement.** A future audit could grep for `notificationStore.push.*severity: 'error'` in non-side-effect contexts; this ADR does not require that gate today. Code review is the enforcement mechanism until B-9b execution surfaces a need for tooling.
- **Per-scenario duplication.** Each new error dialog is ~55 lines of MUI shell. The ADR explicitly rejects extracting a shared base (Decision 4's rationale) to preserve grep-discoverability and per-scenario i18n key freedom. If the scenario count grows large (≥ 6) and the shells remain exactly aligned, a future ADR may re-decide.
- **The 7 non-English locales lag behind.** Every new error scenario adds keys only to `en-US.json` initially; other locales catch up on the next translation pass via the `t(key, defaultEnglish)` fallback. This is by design — the alternative (block every error-scenario PR on a full translation pass) would slow shipping for marginal a11y benefit while the lib is pre-1.0.

## Implementation notes (non-binding)

- The current MUI version's `Dialog` API is stable; no API churn expected.
- A future shared-base extraction (if Decision 4's rejection is overturned) would land as `ErrorDialog.tsx` taking `{ open, onDismiss, headline, body, primaryLabel, secondaryAction? }` and per-scenario files becoming 8–12 line wrappers. The migration would touch every conformant dialog file but no consumer state — the props on each `<ScenarioErrorDialog>` instance stay the same.
- The B-9a inventory's intentional-silent rows (I1–I5) are not affected by this ADR. They remain documented carve-outs in the audit doc.

## Files affected by adopting this ADR

- [packages/axoview-app/src/components/LocalModeShareErrorDialog.tsx](../../packages/axoview-app/src/components/LocalModeShareErrorDialog.tsx) — retrofit verification (likely no edits; already conformant).
- [packages/axoview-app/src/components/ReadonlyLoadErrorDialog.tsx](../../packages/axoview-app/src/components/ReadonlyLoadErrorDialog.tsx) — retrofit verification (likely no edits; already conformant).
- [packages/axoview-app/src/components/PublicShareLoadErrorDialog.tsx](../../packages/axoview-app/src/components/PublicShareLoadErrorDialog.tsx) — new file. Mirrors the two precedents. Replaces the [DiagramLifecycleProvider.tsx:417-422](../../packages/axoview-app/src/providers/DiagramLifecycleProvider.tsx#L417-L422) toast.
- [packages/axoview-app/src/providers/DiagramLifecycleProvider.tsx](../../packages/axoview-app/src/providers/DiagramLifecycleProvider.tsx) — new `publicShareLoadFailed` state + clearer on the context, replacing the toast at line 418.
- [packages/axoview-app/src/App.tsx](../../packages/axoview-app/src/App.tsx) — new `<PublicShareLoadErrorDialog>` mount.
- [packages/axoview-app/src/i18n/en-US.json](../../packages/axoview-app/src/i18n/en-US.json) — new `dialog.publicShareLoadError.*` key tree.
- [docs/tactical/productization-audit.md](../tactical/productization-audit.md) — B-9a row marked done with this ADR + commit hashes; B-9b row queued with the S2–S20 enumeration as its working catalogue.

The actual edits land in the B-9a commits that this ADR accompanies. B-9b's edits land in a future session, gated on T1's scenario catalogue.

## See also

- [productization-audit.md B-9a](../tactical/productization-audit.md) — the investigation that produced the two-dialog catalogue and the 20-surface silent-failure inventory.
- [ADR 0008 Decision 1](0008-naming-convention.md#1-component-file-names-disambiguate-when-colliding-describe-surface-not-state) — per-scenario file naming (`<Scenario>ErrorDialog.tsx`).
- [ADR 0008 Decision 2](0008-naming-convention.md#2-modal-vs-popover-vs-dialog-vs-panel--locked-vocabulary) — "Dialog" vocabulary lock (focus-trapped, explicit user action, centred overlay).
- [ADR 0009 Decision 3](0009-deployment-topology.md#3-readonly--share-link-is-a-session-mode-only-overlay-local-mode-must-error-explicitly) — the share-link / owner-readonly explicit-error contract this ADR generalises (and its 2026-05-22 addendum naming the share-vs-owner-readonly distinction).
