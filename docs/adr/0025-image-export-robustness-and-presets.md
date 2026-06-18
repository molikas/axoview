# ADR 0025 — Image Export Robustness & Presets

**Status:** Proposed
**Date:** 2026-06-18
**Supersedes:** none (error surfacing follows [ADR 0011](0011-error-ux-contract.md))
**Superseded by:** none

## Context

The export dialog ([`ExportImageDialog.tsx`](../../packages/axoview-lib/src/components/ExportImageDialog/ExportImageDialog.tsx)) renders a hidden `Axoview`, then exports PNG (`exportAsImage`, CSS-transform scale) and SVG (`exportAsSVG` → `optimizeSvgDataUrl`) via [`exportOptions.ts`](../../packages/axoview-lib/src/utils/exportOptions.ts). It already has DPI presets 1×–4× + a custom slider and an `expandLabels` toggle (default on). Three problems:

- **#9** — "Download as SVG" throws. Suspects: tainted/CORS icon images in `domtoimage.toSvg`; `btoa(unescape(encodeURIComponent(...)))` on Unicode content in [svgOptimizer.ts:386](../../packages/axoview-lib/src/utils/svgOptimizer.ts#L386); or `fetch()` on a very large data URL in `downloadSvgFile`.
- **#18** — 4× DPI produces no preview on large diagrams (3× is slow). At 4× the target is `bounds.width × 4`, which exceeds the browser **max canvas dimension** (~16,384 px Chrome; lower on Safari) and total-area cap — `dom-to-image-more` silently yields a blank/failed canvas.
- **#19** — Keep labels visible in export, and give a sensible **"screenshot"** preset (good default size/quality) instead of forcing users to reason about DPI.

## Decision

1. **SVG export must never silently throw.** Reproduce first, fix the identified cause, and on any residual failure surface an explicit Dialog ([ADR 0011](0011-error-ux-contract.md)) — not a console-only error.
2. **Respect the canvas dimension limit.** Extract **one** shared render-target-size calculator (used by PNG *and* SVG) that clamps the requested `scale` against the browser max-dimension / max-area. When the requested DPI would exceed the limit, **cap the effective scale, tell the user the achievable size, and still produce an image** — no silent blank at 4×.
3. **Labels in export.** Ensure node **name labels** render in the exported image (distinct from `expandLabels` rich descriptions); expose label visibility as an explicit export option.
4. **"Screenshot" preset.** A named default preset that yields on-screen-quality output in one click — proposed: **2× · fit-to-content · labels on · PNG** — selected by default. DPI presets remain available for power users.

## Consequences

**Positive:** robust, predictable export; large diagrams stop silently failing; the common "good screenshot" path is one click.

**Negative / risks:** preset config surface grows; the dimension cap means 4× on a very large diagram silently becomes (e.g.) 2.5× — this **must** be surfaced to the user, not hidden.

## Implementation notes (non-binding)

- The size calculator is pure and unit-testable (input: bounds + requested scale + browser caps → effective scale + dimensions + `wasClamped`).
- Reuse the hidden-`Axoview` render path; the preset only sets dialog state (scale / labels / crop).

## Acceptance criteria

- **Unit:** size-calculator clamp math (under-limit passes through; over-limit clamps + flags); `svgOptimizer` round-trips Unicode content without throwing.
- **e2e (extend `import-export`):** SVG downloads and parses as valid SVG; 4× on a large diagram yields an image or a clear dialog (never a blank); the screenshot preset exports with labels at the expected size.
- **Build clean.**
