# ADR 0029 — Sanitize User-Authored HTML Before Rendering

**Status:** Accepted
**Date:** 2026-06-21
**Supersedes:** none
**Superseded by:** none

## Context

Axoview renders user-authored rich text (Quill HTML). The one genuine
`dangerouslySetInnerHTML` sink in the codebase is the read view of a text box —
[TextBox.tsx](../../packages/axoview-lib/src/components/SceneLayers/TextBoxes/TextBox.tsx)
renders `textBox.content` raw whenever it begins with `<`. A shared or imported
diagram whose text-box content carries `<img src=x onerror=…>` / `<svg onload=…>`
executes script in the viewer's origin — a **stored XSS**. This is pre-existing
debt surfaced by the PR #50 audit + security review (2026-06-21), not introduced
by #50.

No sanitizer existed anywhere in the library (`grep -rn "DOMPurify|sanitize"`
returned nothing in `axoview-lib`). Two systemic patterns recurred:

1. **The sink above** — raw `innerHTML` of model content.
2. **Incomplete strips** — several sibling sites used a single-pass
   `/<[^>]*>/g` strip for a truthiness test ("does this note have any text?").
   CodeQL flags that shape as `js/incomplete-multi-character-sanitization`
   (HIGH): a reassembled `<scr<script>ipt>` survives one pass. The repo already
   shipped the correct **fixpoint** helper
   [stripHtmlTags](../../packages/axoview-lib/src/utils/stripHtml.ts) (loops
   until stable), but most callers were never migrated to it.

This decision is the durable record for sub-task A of the post-#50
security-hardening follow-up.

## Decision

Sanitize `textBox.content` with **DOMPurify** before it reaches
`dangerouslySetInnerHTML`, through a single shared helper
[sanitizeHtml.ts](../../packages/axoview-lib/src/utils/sanitizeHtml.ts):

```ts
DOMPurify.sanitize(content, { USE_PROFILES: { html: true } })
```

Sanitize at **two layers**:

1. **Render (authoritative boundary):** the TextBox read view sanitizes
   immediately before the sink (memoised — TextBox sits in the drag hot path).
2. **Import (defense-in-depth):** `useInitialDataManager` sanitizes every
   `textBox.content` once on load, so a malicious diagram is cleaned on the way
   in and the stored/exported model stays clean.

**Rejected alternative — route the read view through the existing read-only
`RichTextEditor` (Quill), adding no dependency.** Rejected because (a) Quill is
explicitly *not* a security sanitizer — setting its `value` does not strip
`<img onerror>` — so it would not reliably close the hole, and (b) it would
mount a full Quill instance per canvas text box, which sits in the
perf-sensitive drag hot path.

Separately, **migrate the remaining single-pass `/<[^>]*>/g` strips to the
fixpoint `stripHtmlTags`** to clear the baseline CodeQL HIGH alerts:
`ConnectorControls.tsx` (×2), `NodeInfoTab.tsx` (×2), `useLayerContext.ts` (×1).
These sites feed truthiness tests / labels (non-HTML sinks), so the migration is
hygiene + static-analysis cleanliness, not a second XSS fix. (The `Pan.ts` and
`NodeActionBar.helpers.ts` matches are comments and are left untouched.)

## Consequences

**Positive:**
- The one real XSS sink is closed with the purpose-built, battle-tested standard.
- The visual render is unchanged — sanitized HTML still renders in the same span.
- Defense-in-depth: content is cleaned at import *and* at render.
- The CodeQL `js/incomplete-multi-character-sanitization` HIGH alerts clear.

**Negative / risks:**
- Adds one runtime dependency (`dompurify`, ~20 KB, no transitive deps) to
  `axoview-lib`.
- DOMPurify requires a DOM. This is fine in the browser and under jsdom (the
  lib's jest environment). If `axoview-lib` is ever rendered in a bare-Node/SSR
  context, `sanitizeHtml` would need a jsdom shim — not a current use.

## Implementation notes (non-binding)

- Helper: `packages/axoview-lib/src/utils/sanitizeHtml.ts` → `sanitizeHtml(html)`.
- Sink: `TextBox.tsx` wraps content in `useMemo(() => sanitizeHtml(content), [content])`.
- Import: `useInitialDataManager.ts` sanitizes `view.textBoxes[].content` during
  the existing normalisation pass.
- Strip migration: replace `.replace(/<[^>]*>/g, '')` with `stripHtmlTags(…)`.

## Acceptance criteria

- **Unit test:** `sanitizeHtml('<script>…')` and `'<img src=x onerror=…>'`
  produce inert output (no `<script`, no `onerror`); the reassembly
  `<scr<script>ipt>` leaves no `<script`.
- **Unit test:** the fixpoint stripper leaves no complete tag (already covered by
  `stripHtml.test.ts`); the migrated call sites use it.
- **Manual verification:** import a diagram whose text-box content is
  `<img src=x onerror=alert(1)>`; the canvas renders an inert image with no
  alert and no `onerror` attribute in the DOM.
