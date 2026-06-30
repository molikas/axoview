# UX sweep — verified triage & cut-line (2026-06-30)

**Source:** the 5-persona ADR 0028 walkthrough (Maya/Devin/Priya/Tomás/Sam) + the 11 owner field items ([owner-field-feedback-2026-06-30.md](owner-field-feedback-2026-06-30.md)). **Every claim below was code-verified** against the repo via the ADR 0028 gate (two `ux-finding-verification` workflows, 15 read-only verifiers, `file:line` evidence). Findings are signal; these verdicts are the proof pass. Verdicts: REAL / PARTIAL / ARTIFACT / BY_DESIGN / NEEDS_REPRO / KNOWN.

## The one time-sensitive call: the zero-migration window
Only **two** items reshape persisted schema, so only these two are gated by the integration→master merge (the window stays open until then):
- **#2 rectangle z-order** — needs a new `zIndex` on `rectangleSchema` (currently absent).
- **#4 decouple node label ↔ name** — needs a new on-canvas-label field distinct from `name`.

Both are "free now" as *additions* on the unpushed branch, **but** ADR 0032 §Context warns node data already has an installed base, so any reshape must **preserve existing saved `name` content**. Everything else in this triage is **schema-free** and can land any time, before or after master. **Decision needed:** do #2 and/or #4 go into this window, or defer past master (and lose the free-migration property)?

## Lane A — This-session bug lane (verified REAL, fix in hand)

| ID | Owner/persona | Verdict | Sev | Effort | ZeroMig | Anchor | Fix |
|---|---|---|---|---|---|---|---|
| #2 rect z-order | owner#2, Priya-P3-3 | PARTIAL(REAL gap) | **S2** | M | **YES** | `rectangle.ts` (no zIndex); `CanvasContextMenu.tsx:335` canZOrder excludes RECTANGLE | add `zIndex` to rectangleSchema, include RECTANGLE in `canZOrder`, sort `Rectangles.tsx` by zIndex |
| A2 connector selected-state | owner#9 | **REAL** | S3 | M | no | `Connector.tsx:229-247` no selected branch; only `ConnectorAnchorOverlay` dots | render a wider semi-transparent highlight polyline under the selected connector |
| A1 node selected-state | owner#1, Maya | PARTIAL | S3 | M | no | `TransformControls.tsx:20,100-108` = 2px dashed single-tile box, no fill/glow | stronger ring / glow / icon scrim on selection |
| A3 hover highlight | Maya-M2 | PARTIAL | S4 | M | no | `Cursor.ts:543-546` cursor→pointer works; no highlight decoration | add a faint hover outline (cursor already changes) |
| #5 connector hit-halo | owner#5 | PARTIAL(REAL) | S3 | M | no | `hitDetection.ts:113-120` ±1-tile Chebyshev halo on every segment; #54 fixed only node-endpoints | narrow click-selection to exact tile / sub-tile px distance (keep halo for hover/reconnect) |
| #7 bulk styling | owner#7 | BY_DESIGN | S3 | M | no | `uiStateStore.tsx:220-230` itemControls=null for >1; `useScene().transaction` exists (delete path) | amend ADR 0030 §2: enable strip on homogeneous multi-select, fan writes through transaction |
| #11 bulk label font-size | owner#11 | REAL | S3 | M | no | `TopBarStyleControls.tsx:559-566` single-target; no +/- stepper | rides on #7 + add a relative +/− size stepper |
| M2 view-mode left-drag pan | Tomás-T2 | PARTIAL(REAL) | **S2** | M | no | `Pan.ts:72-84` no left-button slop; `RIGHT_DRAG_THRESHOLD` guards right only | add a left-button drag threshold in view-mode PAN |
| M1 annotation palette persists | Tomás-T1 | REAL | S3 | S | no | `uiStateStore.tsx:105-115` setEditorMode doesn't reset `annotation.open` | reset `open:false` on mode switch (keep strokes) |
| L2 default strings i18n | Sam-S3 | REAL | S3 | M | no | `config.ts:119,201`; `RightSidebar.tsx:108` hardcoded literals | add lib i18n keys; translate at render, not in persisted JSON |
| L3-ampm clock i18n | Sam-S8 | REAL | S3 | S | no | `StatusCluster.tsx:17,20` `toLocaleTimeString([])` → OS locale | pass `i18n.language` to Intl calls |
| B1/B2 placement-mode cue | Maya-M1/M3 | PARTIAL | S3 | M | no | no ghost for TEXTBOX/LABEL (`UiOverlay.tsx:55-70`); ToolMenu omits placement modes | add ghost preview + generalize the mode-hint pill (cursor already crosshair) |

## Lane B — Decision lane (owner sign-off before coding)

| ID | Item | Verdict | Note |
|---|---|---|---|
| #4 decouple name↔label, hide name, rename via Layers | owner#4, Devin-D1/D11, Tomás-T3 | KNOWN/by-design | **The #1 cross-persona confusion.** Reverses ADR 0032 Option A; adds a schema field (**zero-mig**). The big design pass — own ADR 0032 amendment. |
| #8 sticky vs default tool style | owner#8 | BY_DESIGN (connector-only) | Only connectors are sticky (`connectorDefaults`, ADR 0030 §2); rect/text/label already reset. P2 (ex-draw.io) *expects* sticky → reset-after-draw vs keep-sticky+surface-armed-style. |
| connector-color discoverability | Priya-P3-2 vs Sam | exists | Control exists (`TopBarStyleControls.tsx:961-980`), greyed until selected. Decide: label/pulse/right-click bridge, or leave. S3. |
| E2 absolute z-order UX | Priya-P3-3 | PARTIAL | Only relative nudge in context menu; no Bring-to-Front/Back, no strip affordance, Ctrl+]/[ gated to ITEM. Pairs with #2. |
| N2 session badge copy/color | Maya-M5/M9 | BY_DESIGN | Warning-orange + no "Auto-saved" wording is intentional. Copy/color decision. |

## Lane C — Already tracked / scheduled (no new action)
- **L1 strip tooltips i18n = the tracked D1 item** (`integration-productization-plan.md:124-125`), S2, effort L. Already sequenced.
- **Priya "export drops icons" = ADR 0025 QA#10 — already fixed** (`waitForIconsDrawn` + recapture + e2e #10). Distinct from the known iso-export-connectors issue. NEEDS_REPRO only if a fresh post-fix drop appears.

## Lane D — Debunked / no-op / clarify
- **#6 long right-drag → Windows menu → ARTIFACT/NEEDS_REPRO.** Swallow has no hold gate; pointer-capture keeps target in-renderer; e2e pins it. Optional belt-and-suspenders: also `preventDefault` while panning. Needs a real browser repro first.
- **Devin "fill button deselects" → ARTIFACT** (disabled button, no onClick; outside-click clear mis-attributed).
- **Devin "marquee broken" → ARTIFACT** (Select-drag auto-transitions to LASSO after 8px; tested).
- **Maya "session badge moved shape" → ARTIFACT** (toolbar doesn't overlap canvas; window listeners gated by `isRendererInteraction`).
- **Sam "missing focus rings" (K2) → ARTIFACT** (theme.ts:181-187 applies a 3px focus-visible ring to every button; mouse-focus shows none by design).
- **#3 "click connection offset" → NEEDS_REPRO** — either the cosmetic arrowhead-one-tile-short render offset (distinct, S4) or the same as #5. Need a one-line repro.
- **K1 keyboard-unreachable strip → S2, root cause = canvas items aren't keyboard-selectable** (`L` effort, roving tabindex; Layers panel is the current keyboard entry). Bigger a11y track.
- **B3 rectangle no min/max size → S4 polish.**
- **D3 node has no fill control → by-design** (node body is an icon). Note vs the locked "unified element direction" — revisit only if that direction changes.

## Recommended cut-line
1. **Decide the window now (#2, #4).** If yes, schedule the two schema additions before master; if no, they're deferred past the free-migration window — that's the only irreversible timing call.
2. **Schema-free quick wins this session** (all S/M, no window risk): #10 Shift-select (S), M1 annotation reset (S), L3-ampm (S), then the selection-affordance trio (A1/A2/A3) and #5 hit-halo as one "selection clarity" slice, and #7+#11 bulk styling as one slice.
3. **M2 view-mode pan threshold** (S2) — small, high annoyance.
4. **Decision-lane items** (#8, connector-color, N2, E2) — resolve with this doc's data when ready; #4 opens its own ADR pass.
5. **Don't touch** Lane D except optional #6 insurance; close #3 with a repro.
