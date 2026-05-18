# Tactical — MQA Design Shake-out

> **Read first:**
> - [docs/tactical/mqa-results.md](mqa-results.md) — full manual QA issue list (source of truth)
> - [docs/ux-principles.md](../ux-principles.md) — the FossFLOW design language; every decision below must trace back to a principle
> - [docs/adr/0004-connector-name-and-details-panel.md](../adr/0004-connector-name-and-details-panel.md) — relevant to #25 (preview interaction with notes + links)
> - [docs/adr/0002-icon-catalog-merge-on-load.md](../adr/0002-icon-catalog-merge-on-load.md) — relevant to #10 (new-icons-loaded feedback) and #26 (icon removal lifecycle)
>
> **Status:** Awaiting design proposals · **Owner:** Igor · **Last updated:** 2026-05-15
>
> Short-lived working doc. Delete after the work merges; durable decisions get ADR notes, not preserved here.

## Session startup checklist

1. Read this file fully — these are **design-shaped** issues, not bugs. Each one has multiple reasonable answers.
2. Read [ux-principles.md](../ux-principles.md). Decisions must trace back to a principle.
3. For each item below: write a brief proposal (1–3 options, 1 paragraph each, with a recommendation). **Wait for user nod before coding.** Cheaper to course-correct in prose.
4. Use `TodoWrite` once items are unlocked for implementation.
5. On completion, follow the "Wrap-up" section.

## Goal

Resolve the 9 design-shaped items from the 2026-05-15 manual QA pass. These need *decisions*, not just edits. The shake-out loop here is: **propose → align → implement → verify**, one item at a time.

**Out of scope:** the bug-fix bundles ([A](mqa-bundle-a.md), [B](mqa-bundle-b.md)) — those ship first to clear the field.

## Quality bar

- **Principle-anchored:** every design proposal cites the UX principle it satisfies. Proposals that conflict with a principle must say so and justify.
- **Smallest viable change:** prefer adjusting existing surfaces (panels, popovers, shortcuts) over inventing new ones.
- **Document the decision:** the *outcome* of each item lands in an ADR or an ADR-note. The proposal-and-deliberation lives in this file and gets deleted on wrap-up.

---

## Items

### #8 + #9 — Multi-select model (Ctrl+Click, Ctrl+A, edit-panel auto-hide)

**Asks:**
- Ctrl+Click adds/removes an item from the selection (sequential multi-select).
- Ctrl+A selects everything on the canvas.
- Node edit panel auto-hides when >1 item is selected.

**Design questions to resolve before coding:**
1. **Selection model:** does Ctrl+Click toggle (add if absent, remove if present) or only add? Industry standard (Figma, Sketch, VS Code) is toggle. Recommend toggle.
2. **Interaction with marquee/rubber-band select** (if it exists today): does Ctrl+marquee add to selection, or replace? Recommend add.
3. **Ctrl+A scope:** only items on the *active* layer, only *visible/unlocked* items, or literally everything? Recommend visible + unlocked only — locked-layer items should not be swept up (ties to #2 from Bundle A).
4. **Edit panel auto-hide:** when does it come back? Auto-show again when selection drops to 1, or require an explicit click? Recommend auto-show on 1.
5. **Multi-select bulk operations** in scope or deferred? (Move together — likely already works; delete-all — likely already works; bulk style — out of scope here, file as future enhancement.)

**Architecture note:** the existing selection state is probably `selectedId: string | null`. Moving to `selectedIds: string[]` is a contract change — touches reducers, item-controls panel mounting, drag, delete. Plan for a sweep, not a one-liner.

**ADR-worthy?** Yes — new selection contract is durable. Write a short ADR (or extend ADR-0004 with a selection section) once decided.

---

### #10 — Visual feedback when new icons load

**Ask:** users don't notice icons loaded; consider "soft blink" on the accordion.

**Design options:**
- **A. Soft pulse** on the accordion header for ~1.5s after load (CSS keyframe, low-key).
- **B. Auto-expand** the newly-loaded section (more intrusive but unambiguous).
- **C. Badge with count** ("12 new") on the accordion header that clears on expand.
- **D. Combined:** pulse + badge until first interaction with the section.

**Recommend D** for new-import sessions, **A only** when icons load from cached project import (less surprising). Aligns with UX principle of feedback proportional to the user's likely awareness state.

**Touchpoint:** [ADR-0002](../adr/0002-icon-catalog-merge-on-load.md) — add a "load-feedback" section.

---

### #11 — Rich text formatting redesign

**Asks (consolidated from user wording):**
- H1/H2/H3 don't render until Enter is pressed.
- Everything looks bold / header-y by default.
- Bullet-paragraph spacing is too large.
- Bullets don't have tab indentation on the canvas.
- Smallest text size is still too large.
- Overall: "I want it to behave like simple rich text."

**This is the largest item.** It's effectively a rewrite of the text-rendering contract on the canvas. Treat it as its own tactical plan once approved — not a shake-out fix.

**Design questions to resolve:**
1. What's the rendering pipeline today? Lexical/Prosemirror schema → HTML → canvas? Or schema → direct render?
2. Why does the in-editor preview diverge from the canvas render? (Likely two separate render paths with drifted styles.) Goal: **single source of truth** for typography between editor and canvas.
3. Define the typography scale for canvas text — likely 3–4 sizes (small, body, h3, h2, h1) tied to the existing typography contract (commit `4875541`).
4. Bullet rendering: define indent + spacing tokens. Match the in-editor render exactly.
5. The "first word with header style sticks" symptom suggests a marks-vs-block-types bug — investigate whether headers are being applied as inline marks instead of block types. This is a *bug* embedded in the larger redesign — call it out specifically.

**Recommend:** spin out `tactical/canvas-text-redesign.md` once the scope is confirmed. Do not attempt in this shake-out.

**ADR-worthy?** Yes — typography on canvas is a durable contract.

---

### #19 — Revise Settings / Controls / Shortcuts inventory  ✅ SHIPPED

**Asks:**
- Show shortcut hints on hover (e.g. "Element (N)").
- Review canvas controls — "all these controls look excessive."
- Audit shortcuts for what makes sense.

**Outcome (2026-05-16):**
- Tooltip-with-shortcut helper landed at `src/utils/tooltipWithShortcut.ts`, adopted by `ToolMenu`, `BottomDock`, `ZoomControls`, `LeftDock`.
- Hints surfaced: `Help (F1)`, `Zoom in/out (Wheel ↑/↓)`, `Elements (E)` / `Elements (N)` depending on the active hotkey profile.
- Dead `quickIconChange` dispatcher removed from `useInteractionManager.ts` — the `I`-key binding fired an event with no listeners, leftover from before the Elements side-panel landed.
- LeftDock Settings icon **kept** — it's the canonical entry; MainMenu is suppressed in the app via empty `MAIN_MENU_OPTIONS` (per ADR-0005).
- Canvas-control inventory found nothing else worth removing — current set is already minimalist (matches Excalidraw/tldraw baseline).
- ADR for the shortcut contract deferred until #8/#9 lands; both can be captured in a single ADR.

---

### #20 — Settings dialog redesign  ✅ SHIPPED

**Ask:** current tabular settings is excessive and hard to navigate; consider left-tabs.

**Outcome (2026-05-16):** Option A landed — left vertical rail (~200 px) with a divider above About/Diagnostics ("geeky tail"). Dialog now has a stable 60vh / min-480 height so switching tabs doesn't reflow. Each panel dropped its duplicate h6 title — the rail label is the title. Tab order: Keyboard shortcuts · Canvas · Connectors · Icon packs · Language ｜ About · Diagnostics. "Hotkeys" tab renamed to "Keyboard shortcuts" in en-US (other locales unchanged — value tweak, not a new key per ux-principles §7.1). Canvas tab now has internal `Section`s for Zoom and Labels.

**Retracted from proposal:** I claimed `PanSettings` subtitle2 rendered ALL CAPS — wrong, MUI default + theme override both leave it sentence case. No typography fix needed there.

**ADR:** deferred — same ADR can cover #19 + #20 + #8/#9 once selection contract lands.

---

### #25 — Preview-mode interaction with diagram-link + notes  ✅ SHIPPED (pre-session, 2026-05-15)

**Symptom:** Node has both a link-to-another-diagram and notes. Clicking opens the link → user can never see the notes.

**Outcome:** Solved by commit `d65f1a9` (2026-05-15, *fix: MQA #22/#25 panel UX polish*) — closer to **Option A** than the originally-recommended Option D. In `EXPLORABLE_READONLY`, left-click on the node opens the readOnly `NodePanel` instead of jumping straight to the link. The panel surfaces both content paths in one place:

- **Header:** node name renders as a clickable link when `headerLink` is set (URL surfaces via tooltip).
- **Body sections:** Caption → **Linked diagram** (clickable resolved-name link, or explicit `Cannot resolve linked diagram with id: <id>` error) → Notes. Dividers between adjacent sections only when both are present.

So clicking now reveals notes **and** keeps the linked diagram one click away in the same panel — no "pip" needed. Pinned by [`node.linkTooltipDedup.test.ts`](../../packages/fossflow-lib/src/__perf_refactor_regression__/node.linkTooltipDedup.test.ts) (header-name-as-link, LINKED DIAGRAM section, absence of the old icon-based affordances).

**Remaining (separate concern):** passive visual badges on the node body cover only `link` and `notes`, not `headerLink`-only or `description`-only nodes. Tracked in [`known_issues.md`](../../known_issues.md) — discoverability, not interaction.

---

### #26 — Allow deleting imported icons + in-use guardrails

**Ask:** remove imported icons. Warn if in use. What happens if user removes an in-use icon?

**Design questions:**
1. **Detection of in-use:** scan all diagrams in the project. Performance-OK because icon library is small.
2. **Warn vs block:** warn-and-allow (with a list of diagrams that reference it) or block until references are removed? Recommend **warn-and-allow** — blocks frustrate, warnings preserve user agency.
3. **What renders when an icon is missing?** Today: nothing? a placeholder? a tombstone? Recommend a **fallback tombstone glyph** with a tooltip "icon removed: <name>" so the user can recover by re-importing.
4. **Catalog vs imported scope:** can we delete built-in catalog icons? Recommend no — only user-imported.
5. **Undo:** is deletion undoable within session? Recommend yes — push into the history stack like any other destructive op.

**Touchpoint:** [ADR-0002](../adr/0002-icon-catalog-merge-on-load.md) and [ADR-0003](../adr/0003-session-storage-lean-icon-save.md). Likely a small new ADR or extension covering the lifecycle (import + delete + reference handling).

---

## Recommended order

1. **#19** inventory pass first (drives #20 and gives quick wins via tooltip-with-shortcut).
2. **#20** settings redesign — directly uses #19 output.
3. **#8 + #9** multi-select model — bounded scope, high user value, contract change that other features will start to depend on.
4. **#26** icon lifecycle — small surface, well-defined.
5. **#10** icon-load feedback — small, finishes the icon cluster.
6. **#25** preview interaction — needs ADR-0004 extension.
7. **#11** canvas text redesign — spin out as its own tactical plan when reached.

## Wrap-up

When all items are decided and implemented:

1. **ADR notes:** every item that changed a durable contract gets a dated note in the relevant ADR — or a new ADR if no existing one covers it.
2. **Tests:** items that change behavior (multi-select, icon delete, preview interaction) need regression tests.
3. **Commits:** one commit per item — these are independent design changes; coherent commits help future reviewers.
4. **`mqa-results.md`:** annotate each item with the commit hash and / or ADR reference; or strike through.
5. **Spinoff plans:** if #11 spawned `canvas-text-redesign.md`, that plan now lives independently — don't block this wrap-up on it.
6. **Delete this file** when all items merge (or, more likely, when the last non-spinoff item merges).

## Status checklist

- [x] #8 + #9 — Multi-select model + Ctrl+A + edit-panel auto-hide
- [ ] #10 — New-icons-loaded visual feedback
- [ ] #11 — Rich text / canvas typography redesign (spinoff plan likely)
- [x] #19 — Shortcut + canvas-control inventory + tooltip hints
- [x] #20 — Settings dialog redesign
- [x] #25 — Preview-mode notes vs diagram-link interaction (shipped 2026-05-15 in `d65f1a9`)
- [ ] #26 — Imported icon delete + in-use guardrails
