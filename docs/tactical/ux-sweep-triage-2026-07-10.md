# UX sweep — verified triage (2026-07-10)

**Source:** an ad-hoc ADR 0028 persona sweep (Sonnet via Claude for Chrome) against the
`integration.axoview.pages.dev` preview — **Maya** (P1, beginner), **Devin** (P2, ex-draw.io),
**Priya** (P3, expert), **Nadia** (P4, Drive/sync). Every S1/S2 was code-verified through the ADR 0028
gate (two read-only `general-purpose` verifiers with `file:line` evidence). Verdicts: REAL / PARTIAL /
ARTIFACT / BY_DESIGN / NEEDS_REPRO.

**Headline:** the floating-Label entity (ADR 0031) was under-wired for interaction — it couldn't be
deleted or right-clicked, and selecting it auto-opened a Notes-only deck that read as "the text editor."
Four small, schema-free fixes shipped. The two loudest persona calls (Maya "Delete does nothing" S1,
Devin "connectors vanish" S2) both held up only partially and not for the reasons claimed.

## Shipped this session (all on `integration`, schema-free)

| ID | Finding | Verdict | Sev | Fix (file:line) |
|---|---|---|---|---|
| **L-1** | A selected floating Label couldn't be deleted (select → Delete was a no-op) | REAL | S2 | The single-item delete dispatcher had no `LABEL` branch. Extracted `handleDeleteOrBackspace`/`deleteItemControlsTarget` to [`handleDeleteKey.ts`](../../packages/axoview-lib/src/interaction/handleDeleteKey.ts) (testable in isolation, like `handleEscapeKey.ts`) + added the `LABEL` branch → `deleteLabel`. Unit: [`handleDeleteKey.test.ts`](../../packages/axoview-lib/src/interaction/__tests__/handleDeleteKey.test.ts). |
| **L-2** | Right-click on a Label opened Notes + swallowed the context menu (no Delete/Rename menu) | REAL | S2 | [`LabelHitLayer.tsx`](../../packages/axoview-lib/src/components/SceneLayers/Labels/LabelHitLayer.tsx) `onPointerDown` now ignores non-primary buttons; a new `onContextMenu` opens the item menu (`variant:'item'`, `target:{type:'LABEL'}`). Added `LABEL` to `INLINE_RENAMEABLE` + a `handleRename` LABEL branch (→ `setInlineEditLabelId`) in [`CanvasContextMenu.tsx`](../../packages/axoview-lib/src/components/CanvasContextMenu/CanvasContextMenu.tsx). |
| **L-3** | Selecting a Label auto-opened the Notes-only deck, which read as "the editor" | PARTIAL (discoverability) | S3 | `LabelHitLayer.onPointerDown` selects with `{ openPanel: false }` (ADR 0022 §3 select-only), matching text-box treatment. Notes stays reachable via right-click → Add note. |
| **L-4** | Place-and-type / F2 / double-click silently no-op'd when zoomed out (< `HIT_MIN_ZOOM` 0.4) | REAL | S3 | The whole `LabelHitLayer` returned null below 0.4. Now the inline editor mounts whenever `inlineEditLabelId` is set (edit mode only); the hit proxies stay zoom-gated. |

E2E for L-1/L-2/L-3 added to [`label-entity.spec.ts`](../../packages/axoview-e2e/tests/label-entity.spec.ts) (runs in PR CI).

## Deferred / NEEDS_REPRO (not actioned this session — need a real-browser or DevTools capture)

| ID | Finding | Verdict | Note |
|---|---|---|---|
| **C-1** | Connectors disappear after select / tool-toggle (only diamonds remain) | PARTIAL · NEEDS_REPRO | Not a "hide-on-select" bug — the render logic promotes a selected connector to a *more*-visible DOM layer. Maps to the already-tracked **GPU stacked-canvas composite-blanking** class ([canvas-rendering-guidelines.md §14](../canvas-rendering-guidelines.md); `CanvasCompositorOverlay` owner-confirmed on one GPU only). Needs the reporter's browser to confirm; candidate belt-and-suspenders fix = force-repaint `ConnectorsCanvas` on selection/mode change. |
| **C-2** | After Ctrl+Z one connector stayed invisible | PARTIAL | The open **D-9** cross-view (page-switch) undo residual in [known_issues.md](../../known_issues.md) — only if a page switch was involved. The "queri/quer" partial labels are normal undo granularity, not a render bug. |
| **Drive** | Nadia's run threw **"rate limit exceeded"** | NEEDS_REPRO | Google's own 403/429 message surfaced after the 3-retry backoff ([GoogleDriveProvider.ts:141](../../packages/axoview-app/src/services/storage/providers/GoogleDriveProvider.ts#L141)). Sign-in succeeded (so the OAuth origin is fine on the preview) and autosave is debounced (2 s, single-slot — [useAutoSave.ts:25](../../packages/axoview-app/src/hooks/useAutoSave.ts#L25)), so the app is not storming. Leading cause: the GCP project's Drive-API quota/config for the preview's client. Confirm with a DevTools Network capture of the failing request (status + `error.errors[0].reason`: `userRateLimitExceeded` = per-user burst → possible client-side jitter/concurrency fix; `rateLimitExceeded`/`dailyLimitExceeded` = project quota → Cloud Console). |

## Declined (deliberate, with rationale)

- **D-1 — "silent delete" (no toast, unlike copy/paste), Devin S4.** Declined. Deletion already carries
  inherent feedback — the item visibly vanishes — and is undoable; copy/paste toast because the clipboard
  action is otherwise invisible. A toast on every delete would be notification noise. The S4 inconsistency
  is accepted.
- **M-1 — no persistent "where does my work live" indicator, Maya S2 → S3.** The session badge is
  intentional (prior triage **N2**, 2026-06-30). A clearer place indicator for non-technical users is a
  design decision, not a bug — left for an owner call.

## Debunked (ARTIFACT / BY_DESIGN — do not re-file)

- "F2 opened details" / "double-click showed Notes not the editor" → **ARTIFACT**: both routes DO open the
  inline editor; the tester saw a Notes deck left open by the prior selecting click (root cause of L-3).
- "Escape reverted my text" → **BY_DESIGN**: Esc = cancel in the shared inline-rename contract. The real
  gap is the invisible commit/cancel cue (an optional future "Enter saves · Esc cancels" hint; not shipped).
- Devin "panel-not-inline editing is a convention shift" → **BY_DESIGN** (he called it elegant himself).
