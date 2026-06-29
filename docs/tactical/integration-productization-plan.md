# Tactical — Integration-Branch Productization (Labels & Text-Styling UX)

> **Read first:**
> - [ADR 0030 — Docked style-controls strip as the canonical styling surface](../adr/0030-docked-style-controls-strip.md)
> - [ADR 0031 — Floating Label as a first-class entity](../adr/0031-floating-label-entity-model.md)
> - [ADR 0032 — Node name/caption/label model (Option A)](../adr/0032-node-name-caption-label-model.md)
> - [ADR 0033 — Element text-style (B/I/S) field convention](../adr/0033-element-text-style-field-convention.md)
> - [ADR 0005 — Toolbar & dock layout contract](../adr/0005-toolbar-and-dock-layout-contract.md) · [ADR 0006 — Canvas selection contract](../adr/0006-canvas-selection-contract.md) · [ADR 0027 — Canvas context menu](../adr/0027-canvas-context-menu.md)
> - [ADR 0019 — Canvas2D node render layer](../adr/0019-canvas2d-node-render-layer.md) · [ADR 0020 — Engine perf harness & measurement protocol](../adr/0020-engine-perf-harness-and-measurement-protocol.md) · [perf-charter.md](./perf-charter.md) (ENG-PAN R1 is active)
> - [docs/workflow.md](../workflow.md) · [docs/ux-principles.md](../ux-principles.md)
>
> **Status:** Not started · **Owner:** molikas · **Last updated:** 2026-06-29
>
> This is a **short-lived working doc.** Delete it after the work merges; the ADRs are the durable record. PLAN.md gets a one-line entry referencing the ADRs once shipped — see "Wrap-up".

## Cold-start prompt (paste into a fresh session on `integration`)

> First-session kickoff. Lands the unblocked bug fixes + the perf harness and resolves the open Slice 0 decisions; the heavy slices (C1 Label extraction, D1 i18n) follow in later sessions.

````text
# Executive Summary
**Objective:** Begin productizing the labels & text-styling UX spike on `integration` — land the confirmed bug fixes, stand up the performance-regression harness for the new surfaces, and resolve the two open Slice 0 UX decisions with me.

**Key Results (binary-verifiable):**
- KR1 — Pressing `t` then clicking the canvas creates EXACTLY ONE text box; placeTextBoxAt / textbox-ops e2e green. (Slice B1)
- KR2 — A large fit-to-view image export renders node NAME LABELS (not dropped below the 0.25 LOD cutoff). (Slice B2)
- KR3 — A 30px rectangle border is NOT clipped on canvas or in export, with a render regression test added. (Slice B3)
- KR4 — The ADR 0020 perf harness runs NEW label-heavy / connector-label-heavy / floating-label-heavy / background-heavy + `measurePan` scenarios and commits integration-vs-master p95 numbers under `perf-results/`. (Slice E1/E2)
- KR5 — The Slice 0 decisions (X1 on-canvas caption disposition; X2 Name-field location) are RECORDED in ADR 0032 / 0030 — resolved, or explicitly deferred with rationale.

**Do NOT `/ship` to master this session** — the zero-migration window stays open until every data-model slice lands.

## Context (read before acting)
- This productizes an exploratory UX spike: 3 unpushed commits on `integration` (92b853d1 → 894cb3b2 → ae090ddc). A verify pass found the code largely sound; the debt is docs / i18n / 4 bugs / unmeasured perf.
- Read fully, in order: `docs/tactical/integration-productization-plan.md` (this plan), then `docs/adr/0030`–`0033`, then skim ADR 0019/0020 + `docs/tactical/perf-charter.md` (perf protocol) and `docs/workflow.md` (cadence + 7 principles).
- Governing constraints: zero-migration window (branch unpushed — every data-model slice must land before the master merge; don't /ship early) · full gate (all must-ship slices before master) · the top-bar strip is the CANONICAL styling surface (never re-add styling to a panel).

## This session
1. Confirm scope with me, then `TodoWrite` the sub-tasks.
2. SLICE 0 (with me): work out X1 (caption: retire / limited plain subtitle / present-only — note the new floating Label can serve un-attached annotation) and X2 (Name in Details vs Layers+F2 only — resolve the link-button + show/hide-toggle home FIRST). Update ADR 0032/0030. If the call isn't obvious, run a short design exploration first.
3. UNBLOCKED in parallel (no decision needed): B1 (`t` arm-only + e2e), B2 (export labels), B3 (rectangle border clip + honest width slider). Verify each in the REAL app (restart `npm run dev` after `npm run build:lib`).
4. SLICE E1/E2: extend `packages/axoview-e2e/perf/engine-perf.spec.ts` with the new stress scenarios + `measurePan` (coordinate with ENG-PAN R1 on `fix/large-diagram-pan-perf` — don't build a parallel pan harness); capture the regression numbers vs the master baseline.
5. Commit each slice separately on `integration` (conventional commits). Leave C1 (Label extraction), D1 (i18n), F1/F2 for later sessions per the plan's sequencing.

## Watch-outs
- App reads lib from `dist/` — restart dev after `build:lib`, or rsbuild desyncs.
- Never `Set-Content -Encoding utf8` on non-ASCII locale files (PS 5.1 BOM/mojibake).
- The Label render-substrate choice (DOM vs Canvas2D) for C1 depends on the Slice E perf numbers — capture them cleanly.
````

---

## Session startup checklist

1. Read this file fully.
2. Read each linked ADR.
3. Skim `PLAN.md` Phase Status Dashboard **for context only** — do not modify it during this work.
4. `TodoWrite` the sub-tasks of the slice you're taking.
5. Mark `[x]` as work completes.
6. On completion, follow "Wrap-up".

## Goal

Productize an exploratory UX session — 3 **unpushed** commits on `integration` (`92b853d1` → `894cb3b2` → `ae090ddc`, 68 files, +3497/−1294) — into a proper, mergeable set of improvements: floating **Labels**, the **top-bar style strip** as the canonical styling surface, **B/I/S** across all label types, **rectangle borders/backgrounds**, **connector UX**, and the **Option-A** node naming model.

A 19-agent map→verify→synthesize pass found the **code is largely sound** (every new schema field `.optional()` with compile-time defaults; ADR-0006 single-select gating respected; the old "strip writes label[0]" flatten contradiction is **dead in HEAD**). The debt is concentrated in: **(1)** docs that now lie (§5.1/§5.2 describe a deleted Style tab; the strip has no ADR), **(2)** a primary surface shipped **un-localized**, **(3)** four real defects, and **(4)** the new styling surfaces are **entirely unmeasured for performance**.

**Strategy (decided with the user):** keep the 3 spike commits as the base — **do not rewrite history** — ratify the two architectural forks behind ADRs, and productize on top in PR-sized slices. **Not a goal:** re-implementing from scratch; touching unrelated phases.

The **zero-migration window** is the governing constraint: the branch is unpushed, so reshaping the Label data model is free **now** and a permanent load-time migration after first ship. Every data-model decision must land **before** the integration→master merge.

## Scope

### In scope
- The 4 ADRs above + the doc amendments (ux-principles §5.1/§5.2/§2.4/§2.5).
- The Label entity **extraction** (chosen over keep-variant).
- The 4 confirmed defects; strip i18n + dead-key purge; toolbar overflow; a regression-test floor.
- **A performance-regression gate** over the new label/connector-label/floating-label/background surfaces (the user's explicit requirement), incl. extending the ADR 0020 harness.

### Out of scope
- ENG-T3/T4 (deferred simulation/WebGL — unchanged by this work).
- Cloud/auth phases (3A–4A).
- Rewriting the export crop UX beyond the label-legibility fix (ADR 0025 already governs export).
- The deferred-catalogue items (land as fast-follow PRs after master).

## Locked decisions (design discussion 2026-06-29)

| # | Decision | Source |
|---|---|---|
| 1 | **Label = dedicated first-class entity** (extract), not a text-box variant. Done before master (zero-migration window). | User · ADR 0031 |
| 2 | **Docked style strip = canonical styling surface.** Per-type Style tab retired for good; amend §5.1/§5.2/§2.4. | User · ADR 0030 |
| 3 | **Full proper gate:** all must-ship slices land on `integration` before the master merge. | User |
| 4 | **B/I/S:** accept the four flat field conventions (no unification). | Recommended default · ADR 0033 |
| 5 | **Node label-height:** accept canvas-drag as the sole path (no strip slider); fix the stale e2e comment + ADR 0024 note. | Recommended default |
| 6 | **Node caption + Name-field:** ⚠️ **REOPENED 2026-06-29.** On-canvas caption disposition (retire / limited subtitle / present-only) **and** whether the Name field stays in Details vs moves to Layers-only are **open** UX decisions. Resolve in **Slice 0** before A1/A3/C1. | User · ADR 0032 · ADR 0030 |
| 7 | **Performance is a release gate:** the new surfaces must show **no p95 regression beyond the ADR 0020 <10% noise band** (spawn + pan, N∈{200,500,1000}) vs the master baseline. Label render-substrate (DOM vs Canvas2D) is chosen by this measurement. | User · ADR 0031 §6 · ADR 0020 |

> Decisions 4–5 are **recommended defaults** the user saw and did not override; ratify on first review. **Decision 6 is reopened** (2026-06-29): the on-canvas caption disposition + the Name-field location are unresolved and gate the doc/Label slices — see **Slice 0**.

## Sub-tasks

> Slices are **PR-sized**; land them on `integration`. Every slice below is **must-ship-before-master** (Decision 3). Deferred items are catalogued separately (not in this list).

### 0. Naming-surface UX decisions (resolve FIRST — gates A1, A3, C1)
> Genuinely open (user, 2026-06-29). Do **not** finalize A1/A3 doc amendments or build C1 until both are settled. If the call isn't obvious, tee up a short design exploration (the Option-A investigation pattern).
- [ ] **X1 — On-canvas node caption disposition.** Decide: **(a)** full retire (Option A; the floating Label serves extra annotation) · **(b)** keep a limited **plain-text subtitle** line, strip-styled · **(c)** caption in **view/present mode only**. Weigh identity clarity, **Canvas2D perf** (rich on-canvas text is the expensive path — pairs with Slice E), and *attachment* (does the use-case need text bound to the node — a floating Label is not). Output rewrites ADR 0032 points 2–5 + retires/repoints `PLAN.md` L904.
- [ ] **X2 — Node Name-field location.** Decide whether Details keeps the **Name** field or delegates rename to **Layers + F2** (panel → Notes + type-specific). **Resolve the ripple first:** the Name row co-hosts the **inline link button** + **show/hide-name toggle** — give them a home before removing Name. Output finalizes the §5.1 amendment wording in A1.

### A. Documentation & ADR reconciliation
- [ ] **A1 — ADR 0030 + doc amendments (M).** Accept ADR 0030. Amend ux-principles §5.1 (canonical panel = Details/Notes; Delete → context menu), §5.2 (drop "Style" from connector tabs), §2.4:191 ("canonical styling surface", not "mirrors a side panel"). Fix the false `TopBarStyleControls.tsx` header comment. **AC:** `grep -rn "Details / Style / Notes\|Style tab" docs/` returns zero stale hits.
- [ ] **A2 — Accept ADR 0031** on review (the Label-entity decision of record; implementation is slice C1).
- [ ] **A3 — ADR 0032 + Option-A fold hardening (M).** Accept ADR 0032. Insert a **block separator** between `notes` and the folded `description` (currently concatenated with none). Add fold unit tests (idempotency / both-present / empty-skip / description-deleted). Retire `PLAN.md` L904. **AC:** ADR 0032 does **not** claim to amend ADR 0004; fold is idempotent on re-load.
- [ ] **A4 — Accept ADR 0033** (B/I/S convention; no code change).
- [ ] **A5 — Extend ADR 0020 (S).** Dated addendum documenting the new perf scenarios (slice E). `/feature extend 0020`.

### B. Correctness bug fixes (regressions vs master)
- [ ] **B1 — `t` hotkey arm-only + e2e repair (M).** `useInteractionManager.ts:455–481` still eager-creates a text box while the rewritten `TextBox.ts` mode also creates one on canvas mouseup → **two boxes** (regression vs master; turns `placeTextBoxAt` e2e red). Convert the hotkey to **arm-only** (`setMode TEXTBOX showCursor:true id:null variant:'text'`); delete the eager `createTextBox` block + `viewportCenterTile` use/import (**keep `screenToTile`**). **AC:** press `t` + click = exactly **one** box; textbox/shapes e2e green.
- [ ] **B2 — Export label legibility restore (S).** The export renderer no longer passes `readableLabels` (`ExportImageDialog.tsx` ~L906–915); since it gates the 0.25-LOD draw cutoff, large fit-to-view exports **drop name labels entirely** (regresses ADR 0025). Re-add `readableLabels: true`. Update `rendererProps.ts` doc. **AC:** a large fit-to-view export renders name labels.
- [ ] **B3 — Rectangle border clip + honest width slider + no-color (M).** A ≤30px stroke centred on the rect edge clips ~15px/side. Inset the IsoTileArea rect by `strokeWidth/2` (canvas + export). Align the Width slider readout with the rendered width; treat only explicit TRANSPARENT as no-color (absent = derived) without regressing fill/background pickers. Add a 30px-border render regression test. **AC:** a 30px border is not clipped on canvas or export.

### C. Label data-model (the architectural slice — keep isolated)
- [ ] **C1 — Extract dedicated Label entity per ADR 0031 (L).** New `Label` schema/reducers/render-layer **above the node layer** (fixes z-order); **full-chip DOM hit-proxy** (mirror `NodeLabelHitLayer`); **plain text + whole-chip B/I/S** edit model (drop the rich-text editor + the `TextBox.tsx:224–229` rich-HTML branch for labels — resolves the two-layer conflict); **Details/Notes** panel parity; first-class **px** font model; remove `variant`/label fields from `textBox.ts`. **No migration** (verify against the unpushed baseline). Render substrate (DOM vs Canvas2D) is decided by slice **E** and recorded in an ADR 0031 addendum. **Keep the schema diff in one reviewable commit.** **AC:** label renders above a node; full chip is clickable; single edit model; zero migration code.

### D. Internationalization
- [ ] **D1 — i18n TopBarStyleControls + dead-key purge (L).** Add a `topBarStyleControls` namespace (en-US + 13 locales + `AxoviewTranslations` type); wire `useTranslation`; replace all ~30 hardcoded strings + localize Slider/enum aria-labels. Delete the ~22 dead keys orphaned by the de-dup (`nodeStyleTab` namespace, `nodePanel`/`nodeInfoTab` caption keys, 13 `connectorControls` style keys, `textBoxControls.{bold,backgroundColor,removeBackground,textSize,textColor,alignment}`, `rectangleControls.{color,useCustomColor}`, `expandDescriptions`) — touch **only** dead namespaces (the identically-named **live** `connectorControls` color/useCustomColor at en-US.ts:324/328 must stay). i18n the RightSidebar "Collapse panel" tooltip (reuse `leftDock.collapsePanel`). **Depends on C1** (final label/textbox string set). **AC:** zero hardcoded user-facing strings in the strip; all 14 locales carry the namespace; **no PS 5.1 `Set-Content -Encoding utf8` on non-ASCII locale files** (BOM/mojibake — see memory).

### E. Performance regression gate ⚠️ (the user's explicit requirement)
> The new surfaces are **unmeasured**: the ADR 0020 harness ([`engine-perf.spec.ts`](../../packages/axoview-e2e/perf/engine-perf.spec.ts)) measures spawn+drag on **bare nodes only**, has **no pan scenario** (ENG-PAN R1 is adding `measurePan`), and exercises **no** label/style surfaces. Node labels draw in Canvas2D (B/I/S + hand-drawn strikethrough = extra per-frame cost); connector labels + floating labels are **DOM** (the scaling cliff ADR 0019 moved nodes *off of*); backgrounds/borders add overdraw. The fear is well-founded.
- [ ] **E1 — New harness scenarios (M).** Extend [`engine-perf.spec.ts`](../../packages/axoview-e2e/perf/engine-perf.spec.ts) with: **label-heavy nodes** (B/I/S + strikethrough), **connector-label-heavy** (name + additional, styled), **floating-label-heavy**, **background/border-heavy** (rect fills + ≤30px borders, text/label backgrounds). Add the **`measurePan`** scenario — coordinate with ENG-PAN R1 (`fix/large-diagram-pan-perf`); **do not duplicate** it. Keep the same N set + median-of-≥7 + <10% noise-band protocol (ADR 0020 KR1/KR2).
- [ ] **E2 — Baseline compare + gate (M).** Capture `integration` numbers vs the master baseline ([`perf-results/baseline.md`](../../perf-results/baseline.md)) at N∈{200,500,1000} for spawn + pan. **Gate the merge** on no p95 regression beyond the <10% noise band. File results under `perf-results/`. If a surface regresses, fix before master (e.g. cull/virtualize labels, cheaper strikethrough, memo backgrounds).
- [ ] **E3 — Decide the Label render substrate (S).** From E1/E2: if the DOM floating-label layer regresses pan/spawn p95, render the Label layer on **Canvas2D** (billboard + culling) or virtualize. **Record the chosen substrate as an ADR 0031 addendum.** This gates C1's render-layer implementation — sequence E1/E2 against a prototype label layer before finalizing C1.

### F. Robustness, overflow & test floor
- [ ] **F1 — Toolbar overflow fix (M).** The right cluster (toolbar-right + strip, `flexShrink:0`) clips on narrow viewports — Present/Share/sidebar-toggle become unreachable (the strip is now the **sole** styling surface, so it must never be clipped). **Measure the breakpoint first**, then add overflow handling (kebab menu absorbing strip controls below a breakpoint, or strip scroll); guarantee Group 3 + Group 4 always reachable. Verify ≤1024px. **Depends on D1.**
- [ ] **F2 — Regression test floor (M).** `Cursor.ts getAnchorOrdering` off-path nearest-tile fallback (no-throw + nearest index); panel-shape parity test (node+connector render exactly Details+Notes); 3–5 Playwright strip smokes (text-color write, rectangle border, connector pre-draw inherit, no-color background). **Depends on B1/B3/C1.**

### Suggested sequencing
**Slice 0 (decide X1 caption + X2 name-field)** → A1 → (B1, B2, B3 in parallel) → **E1/E3 prototype → C1** (substrate decided before the Label layer is finalized) → D1 → E2 (full gate) → F1 → F2 → A3/A4/A5 doc accepts → **/ship**.

## Deferred (catalogued — land as fast-follow PRs after master)

> Per the triage convention, every item is **explicitly destinationed**; default disposition is drop unless there's a forcing function.

**→ PLAN.md Deferred register:**
- Connector add-label cap divergence (unify both entry points behind one capped helper). *Forcing function: already drifted once.*
- Drop dead `isUnderline` textBox field (no writer). *Bundle into a schema-tidy pass.*
- `labelHeight` precise control: accept canvas-drag (Decision 5) but fix the stale `label-drag.spec.ts:8` comment + ADR 0024 note.
- Connector stale/removed `defaults.color` → invisible connector; validate against `scene.colors`. *Narrow session-only edge.*
- Pre-draw connectorDefaults "armed" indicator (discoverability). *Headline feature is invisible without it; pure polish.*
- Connector inline-editor B/I/S flicker (`ConnectorNameEditor` hardcodes `fontWeight 400`).
- Auto-arm inline edit on Text/Label placement (cross-type parity decision).
- Text-box double rich-text editor (panel body vs strip popover) for **plain** text boxes (Label case resolved in C1).
- Extend `i18n.localeCompleteness` test to per-key parity / dead-key detection. *Sequence AFTER D1 or it fails on the existing dead keys.*
- `UiOverlay` "Toggle Properties panel" hardcoded English (pre-existing).
- Broader border/export/label test coverage (schema round-trips, crop interaction, screenshot-preset e2e).

**→ Drop (with rationale):**
- Canvas2D node-label strikethrough vs DOM parity guard — geometry is sound; drop unless a screenshot shows a visible jump (be-screenshot-driven).
- Label size-derivation redundancy (`getTextBoxDimensions` on labels) — resolves naturally when Label extracts (C1).
- Strike the stale "strip reads label[0]/flattens all labels" finding — **verified dead in HEAD**; drop so it stops costing future agents a re-investigation.
- Codify the edge collapse-tab as a sanctioned §2.3/§8 sub-pattern — works + bug-free; no forcing function.
- Drop vestigial `_inPreview` param in `previewLabelVisibility` — trivial; fix opportunistically.

## Wrap-up

When all must-ship slices are `[x]` and the smoke + perf gate pass:

1. Add a single line under the appropriate `PLAN.md` phase:
   ```
   - Labels & text-styling productization shipped — see docs/adr/0030..0033 (+ ADR 0020 addendum) and this file's git history.
   ```
2. Catalogue the "→ PLAN.md Deferred register" items above into PLAN.md's deferred list.
3. `/ship` integration → master (the migration window closes here — confirm all data-model slices landed).
4. Delete this file.
5. Update memory: correct `project_naming_model_decision` (the "amends ADR 0004" claim is false → ADR 0032); retire this tactical's pointer.

## Notes for Claude

- **Two packages, `dist/` coupling.** axoview-app reads axoview-lib from `dist/` — restart `npm run dev` after `npm run build:lib`, or rsbuild desyncs (memory `project_dev_lib_rebuild`). Verify every UI slice in the real app, not just tests.
- **Keep C1 (Label extraction) one isolated commit** — its schema diff is the only place the zero-migration claim is verifiable.
- **Sequence E before finalizing C1** — the render-substrate decision (E3) determines how C1 builds the Label layer. A prototype label layer measured against E1 beats building DOM-first and discovering a regression.
- **i18n encoding hazard** — never `Set-Content -Encoding utf8` on non-ASCII locale files in PS 5.1 (memory `feedback_powershell_encoding_hazard`).
- **Perf coordination** — ENG-PAN R1 is mid-flight on `fix/large-diagram-pan-perf` adding `measurePan`; reconcile E1 with it rather than building a parallel pan harness.
- **Don't re-add styling to any panel** — ADR 0030 makes the strip the single writer; a re-added Style control is a regression.
