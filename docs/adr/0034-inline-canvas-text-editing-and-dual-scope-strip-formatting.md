# ADR 0034 — Inline Canvas Text Editing & Dual-Scope Strip Formatting (Rich-Text Popup Retirement)

**Status:** Accepted
**Date:** 2026-07-03
**Supersedes:** none (amends [ADR 0030](0030-docked-style-controls-strip.md) §2 single-target list, [ADR 0031](0031-floating-label-entity-model.md) "rich text stays on plain TextBox" wording, [ADR 0033](0033-element-text-style-field-convention.md) text-box row)
**Superseded by:** none

## Context

The strip's "Rich text" popover (a Quill editor in a `StripButton`, formerly [`TopBarStyleControls.tsx`](../../packages/axoview-lib/src/components/TopBarStyleControls/TopBarStyleControls.tsx)) was the only editor of `textBox.content` — a popup in a product where every other text-bearing element already edits inline on canvas via the shared `useInlineRename` contract. Its toolbar (B/I/U/S, link, headers, lists, blockquote, code-block) duplicated the strip's own B/I/S and Link controls, and users could not tell why a text box formats in a popup while everything else formats from the strip.

A 2026-07-03 investigation (competitor scan + code audit; full record in the session artifact and `memory/richtext-popup-dedupe-2026-07-03.md`) established:

- **No competitor edits canvas text in a popup** (draw.io, Lucidchart, Miro, FigJam, tldraw, Excalidraw, Google Slides all edit inline). The market convention for a fixed top bar is **one text cluster, two scopes**: element selected → all its text; caret/range while editing → the run (Google Slides / PowerPoint / Figma / draw.io).
- **No competitor offers headers, blockquote, or code-block on canvas text**; the market ceiling is inline styles + lists + links. tldraw dropped blocks deliberately.
- Three S1 defects verified in the current code (see catalog): the strip wrote connector-label sizes the schema rejects (bricked saved diagrams on reload); the cross-type size stepper wrote the dead `nameLabel*` fields; the on-canvas plain-text editor destroyed all rich formatting on a zero-keystroke double-click + click-away.
- The text box's double-click editing was structurally unreachable: the TextBoxes SceneLayer mounts **below** the full-canvas interactions box ([`Renderer.tsx`](../../packages/axoview-lib/src/components/Renderer/Renderer.tsx)), which eats every press — the same failure mode the connector-labels layer documents.

## Decision

**The rich-text popup is retired. A text box is edited inline on the canvas (double-click / F2 / context-menu Rename / place-and-type) with a toolbar-less Quill editor; all formatting is driven from the strip, which becomes a single text cluster with two scopes.**

### 1. Inline editing contract (text box)

- The editor is `ReactQuill` with `toolbar: false` and the existing `formats` whitelist, mounted **in place** inside the text box's projected container, only while editing.
- While a text box is being edited it is **promoted above the interactions box** (a dedicated SceneLayer after the interactions Box, mirroring the hybrid-node promotion) so pointer events reach the editor. The editing state is the store slice `uiState.editingTextBoxId` (renamed from the one-shot `inlineEditTextBoxId`; it now persists for the whole edit session).
- Commit semantics extend ADR 0022 §4: **left-click-away commits, right-click-away and Escape cancel**. Deliberate divergence from the single-line editors: **Enter inserts a newline** (multi-paragraph element; lists need Enter) — commit is click-away only. Clicks inside the strip or any MUI portal overlay (popovers opened from the strip) do **not** end the session.
- Commits are **sanitized write-side** (`sanitizeHtml`, keeping ADR 0029's read-side guard) and are **no-ops when nothing changed** (a dirty flag set on the first real Quill change — never compare plain text against stored HTML).
- Plain-text legacy content is escaped to HTML before seeding the editor (a literal leading `<` can no longer be misparsed). The lossy `htmlToPlain` seed/commit path is deleted.

### 2. Dual-scope strip formatting (the two-scope rule)

The strip's format cluster grows to **B / I / U / S** plus a **bulleted / numbered list** toggle pair, and acts with two scopes:

| Selection state | B/I/U/S + Lists target |
|---|---|
| Label-bearing element selected (node label, floating Label, connector label chip) | element-level boolean fields, as before (U: text-box-only for now — see TODO) |
| Text box **selected** | the **whole content** — the format is applied/removed across the full range **in the content HTML** (single source of truth; no element-level layer to fight) |
| Text box **being edited** | the **live caret/range** via the mounted Quill instance (`quill.format`) |
| Homogeneous bulk of text boxes | whole-content per box, fanned out in one transaction (closes the former bulk formatting dead-end) |

Scope is implied by selection state and never expressed as duplicate controls. A partially-formatted range renders the toggle unpressed; pressing applies the format to the whole target.

The **Link** control gains a text-range mode: while editing a text box with a non-collapsed selection it wraps the selection as an inline link; a selected (non-editing) text box shows a disabled state explaining the recipe. Element links (`headerLink`) are unchanged, and the bulk-node case now fans out like every other bulk write.

### 3. Authoring ceiling for canvas text

Canvas text authoring offers **bold, italic, underline, strike, bulleted/numbered lists, and links** — market parity. **Headers, blockquote, and code-block are retired from authoring** (no buttons anywhere) but remain **render-compatible forever**: the sanitizer allowlist, the canvas `richTextStyles`, and Quill's parse `formats` keep accepting them so legacy content never degrades or is silently rewritten. Text hierarchy is expressed with the text-size control. Notes (deck / view-mode popover prose) keep the full `RichTextEditor` — the ceiling applies to canvas text only.

### 4. Data-model consequences

- `connectorLabelSchema.fontSize` and `connector.nameLabelFontSize` caps lift **24 → 40** to match the ADR 0030 unified range (the strip could already write 26–40, which `safeParse` then rejected on load — a diagram-bricking bug).
- The legacy element-level `textBox.isBold/isItalic/isUnderline` flags are **folded into `content`** once at load (wrapping each block's inline content in `<strong>/<em>/<u>`, the `seedConnectorLabel` precedent), the renderer stops reading them, and creation stops persisting them. The fields stay schema-parseable for round-trip.
- The strip's `'__name__'` / `nameLabel*` styling branches are deleted (unreachable since the ADR 0032 connector decouple); the cross-type size stepper writes each connector's **`labels[].fontSize`** instead of the dead `nameLabelFontSize`.
- The strip's show/hide-label eye extends to connectors (`connector.showLabel` — already schema'd, rendered, and Layers-toggleable).

### 5. Strip behavior rules (ratified for every future control)

1. **Single surface** — all visual styling on the strip; no popup editors. Deck = identity + notes; Layers = structure.
2. **One cluster, two scopes** — element selected → whole text; editing caret/range → the run.
3. **Disabled, not hidden — honestly** — every disabled tooltip names the exact enabling selection and never points at another disabled control.
4. **No dead writes** — every strip write must be schema-legal at the write site and rendered by at least one visible surface.
5. **Same control, same meaning** — semantics (unit, write scope, persistence) identical across types or surfaced in the control; field *names* may diverge (ADR 0033), semantics may not.
6. **Bulk contract** — homogeneous fan-out in one transaction; single-target exceptions enumerated + tooltipped; a bulk-enabled control never writes a partial subset silently.
7. **Content fidelity** — any `textBox.content` editor round-trips losslessly; sanitizer allowlist ≥ editor format whitelist; commits sanitize write-side.

> **Resolved (2026-07-03, owner-directed):**
> **O1** — element-level underline landed for all three label types (`viewItem.labelUnderline` / `label.isUnderline` / `labels[].underline`, ADR 0033 nearest-sibling naming; optional fields, zero-migration). Rendered on both Canvas2D paths (drawn manually under the baseline, like the existing strikethrough rules — decoration-only, so the label layout caches are unaffected) and both DOM paths (combined `text-decoration`). The strip's U toggle now enables wherever B/I/S do.
> **O3** — the cross-type mixed-selection support covers **text color** as well as size: same label-bearing targets (node `labelColor` / floating-Label `color` / each connector `labels[].labelColor`), one transaction, `textColorAllSelected` tooltip.
> **O6** — while a **non-connector** creation tool is armed (rectangle / text / label / icon), every disabled style tooltip swaps to neutral copy naming the recipe (`armedToolPlaceFirst`: place first, then style) instead of "Select a …" non-sequiturs. Per-tool pre-draw defaults stores remain a possible follow-up if demand shows; the connector tool keeps its live pre-draw controls.

**2026-07-03 — Lucid-parity editing pass (owner-directed, same day).** Comparing the shipped inline editor against Lucid exposed that the three renderings of one `content` — the live editor (quill.snow.css), the resting canvas (`richTextStyles`), and the size measurement (`isoMath`) — each used **different formatting geometry**, and none was user-controllable:

- **One line-spacing knob.** Quill makes every line its own `<p>`, so the old `0.2em` p/li margins silently stacked onto `line-height: 1.3` (≈1.5 effective, vs Lucid's 1.2) while the editor used Quill's fixed `1.42`. Now: p/li carry **zero vertical margins**; line spacing is exactly the box's **`textBox.lineHeight`** multiplier (new optional schema field, absent = `TEXTBOX_LINE_HEIGHT` = **1.2**, deliberately unbounded like `fontSize` — the schema-cap S1 lesson). The strip's Text-size popover gains a **Line spacing** slider (0.8–2.5, step 0.1, text box only — Lucid groups it the same way); the editor inherits it live (`.ql-editor { line-height: inherit }` beats snow's 1.42).
- **One list geometry.** List text indents **`CANVAS_RICHTEXT_LIST_INDENT_EM` = 1.5em** in all three consumers (resting `ul/ol` padding; editor override collapsing Quill's 3em default with re-derived marker metrics; measurement adds `indentEm × fontSize` per `<li>`). The measurement previously counted **no** indent — a bulleted box was sized for its bare text and the gutter ate the content width ("one character per line").
- **Markdown list autofill restored — MQA #12 retired.** `- `/`* `/`1. `&nbsp;→ list, in both the inline editor and the Notes `RichTextEditor`, via one shared binding (`utils/quillListAutofill.ts`, a faithful port of Quill 2.0.3's default handler). The original complaint ("input erased") is addressed structurally: markers are visible on both surfaces, and the handler cuts a history entry before converting so **one Ctrl+Z restores the literal typed text**. The `[ ]`/`[x]` checkbox prefixes stay excluded — checked lists are outside the §3 authoring ceiling and the resting render has no checkbox styling. Re-sync the port on Quill upgrades.
- **The box grows as you type** (Lucid convention): the editor sizes `width: max-content` (min 100%) so the longest line extends the box rightward instead of wrapping at the stale committed width — which matches commit, since `isoMath` sizes the resting box to the longest line (content never soft-wraps).
- **No contradicting chrome mid-edit:** `TextBoxTransformControls` suppresses the dashed outline + anchors for the box being edited (its `size` only updates on commit); the editor's own border is the session's selection affordance.

## Consequences

**Positive:**
- One editing model (inline on canvas) and one formatting surface (the strip) across every element type; the popup's ten controls collapse into a U toggle + a list pair with no net strip-width growth (relevant to the F1 overflow slice).
- The confirmed data-loss path (zero-keystroke flatten) and the diagram-bricking size write are gone.
- Bulk text-box formatting works for the first time.

**Negative / risks:**
- Quill mounts inside a CSS-matrix-transformed container; its selection-dependent UI (`.ql-tooltip`) is disabled (links go through the strip) — any future Quill UI must be vetted under the transform.
- Whole-content formatting for a *selected* box is a DOM-transform of the stored HTML (no mounted editor); Quill re-normalizes on next edit. The transform emits only Quill-whitelisted tags to keep the round-trip safe.
- The editor keeps Quill's `getSemanticHTML` space→`&nbsp;` behavior (pre-existing; masked by auto-grow). Tracked as catalog item I-21, not fixed here.

## Implementation notes (non-binding)

- Promotion: `Renderer` filters the editing box out of the lower TextBoxes layer and renders it in a SceneLayer mounted after the interactions box (hybrid-node pattern).
- Strip ⇄ editor bridge: a module singleton (`textBoxEditorBridge`) holding `{ id, quill, lastRange }`; re-render is driven by the `editingTextBoxId` store slice; strip buttons `preventDefault` on mousedown so the editor selection survives.
- Whole-content transforms live in `utils/richTextTransform.ts` (pure DOMParser — no headless Quill, so jsdom tests don't need the Quill runtime); legacy fold-in lives in `utils/foldTextBoxStyleFlags.ts`, run in `useInitialDataManager`'s pre-parse normalization alongside `seedNodeLabel`.

## Acceptance criteria

- **Unit:** `richTextTransform` applies/removes/queries whole-content B/I/U/S + lists on HTML and plain-text content; `foldTextBoxStyleFlags` folds each flag combination into block-safe inline wrappers and clears the flags; connector schema accepts `fontSize` 40 and rejects 41.
- **e2e:** place-and-type drops into the on-canvas Quill editor; typing + click-away persists to `model.textBoxes[].content`; Escape cancels.
- **Manual:** double-click a text box → inline edit (no deck); strip B/I/U/S formats the live selection while editing and the whole content when merely selected; bulk text boxes format together; a connector label sized to 40px survives save + reload; legacy bold/underline text boxes render identically after fold-in; headers/lists in legacy content still render.
- **i18n:** `richText*` keys purged and new keys present across all 13 locales; i18n-completeness test green.
- **Unit (2026-07-03 addendum):** `countHtmlLines` weights p/li by the box's line-spacing multiplier (default pinned at 1.2) with legacy blocks fixed; `splitIntoMeasurableBlocks` emits `indentEm` = 1.5 for `<li>`; `quillListAutofill` converts `- `/`* `/`1. ` (bullet/ordered) with the history-cutoff undo contract, excludes checkbox prefixes, and both editors wire the shared binding.
- **e2e (2026-07-03 addendum):** typing `- ` in the inline editor autoformats to a live bullet list that commits as a real `<ul>` with the typed marker consumed.
- **Manual (2026-07-03 addendum):** a bulleted text box sizes to its content (no per-character wrap); line spacing reads visually identical mid-edit and after commit; the Line spacing slider reflows a multi-line box live; no dashed selection outline while editing.
