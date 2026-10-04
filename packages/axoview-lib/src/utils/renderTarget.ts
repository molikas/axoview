// Render-target size calculator (ADR 0025 §2).
//
// One shared, pure function used by BOTH the PNG (`exportAsImage`) and SVG
// (`exportAsSVG`) paths to clamp a requested export scale against the browser's
// hard canvas limits. At 4× a large diagram, `bounds.width × 4` can exceed the
// max canvas dimension (~16,384 px on Chrome, lower on Safari) and the total
// pixel-area cap — `dom-to-image-more` then silently yields a blank/failed
// canvas (issue #18). This computes the largest scale that still fits, so the
// caller can produce an image AND tell the user the achievable size.

export interface RenderTargetCaps {
  /** Max width or height of a single canvas, in device-independent px. */
  maxDimension: number;
  /** Max total pixel area (width × height) of a single canvas. */
  maxArea: number;
}

// Conservative cross-browser defaults. Chrome caps a side at 16,384 px;
// Safari/iOS are lower, but 16,384² area is a safe common ceiling that still
// protects the 4×-large-diagram case the ADR targets.
export const DEFAULT_RENDER_CAPS: RenderTargetCaps = {
  maxDimension: 16384,
  maxArea: 16384 * 16384
};

export interface RenderTarget {
  /** The scale actually used after clamping (≤ requested). */
  effectiveScale: number;
  /** Clamped output width in px (rounded, ≥ 1). */
  width: number;
  /** Clamped output height in px (rounded, ≥ 1). */
  height: number;
  /** True when the requested scale had to be reduced to fit the caps. */
  wasClamped: boolean;
  /** The scale that was requested (normalised; ≥ 0). */
  requestedScale: number;
  /** The largest scale these bounds permit under the caps. */
  maxScale: number;
}

/**
 * Clamp a requested export scale against the browser's canvas limits.
 *
 * @param bounds          unscaled content bounds (px)
 * @param requestedScale  the DPI multiplier the user asked for (e.g. 4)
 * @param caps            browser canvas limits (defaults to a safe ceiling)
 */
export function computeRenderTarget(
  bounds: { width: number; height: number },
  requestedScale: number,
  caps: RenderTargetCaps = DEFAULT_RENDER_CAPS
): RenderTarget {
  const baseW = Math.max(1, bounds.width || 0);
  const baseH = Math.max(1, bounds.height || 0);
  // Normalise a missing/garbage scale to 1× rather than producing a 0-px image.
  const reqScale =
    Number.isFinite(requestedScale) && requestedScale > 0 ? requestedScale : 1;

  // Largest scale that keeps BOTH the longest side and the total area in bounds.
  const dimScale = caps.maxDimension / Math.max(baseW, baseH);
  const areaScale = Math.sqrt(caps.maxArea / (baseW * baseH));
  const maxScale = Math.max(0, Math.min(dimScale, areaScale));

  const effectiveScale = Math.min(reqScale, maxScale);
  // Tolerance avoids flagging a clamp from floating-point dust.
  const wasClamped = effectiveScale < reqScale - 1e-6;

  return {
    effectiveScale,
    width: Math.max(1, Math.round(baseW * effectiveScale)),
    height: Math.max(1, Math.round(baseH * effectiveScale)),
    wasClamped,
    requestedScale: reqScale,
    maxScale
  };
}

/**
 * The Screenshot preset's pixel budget (ADR 0025 §4, 2026-10-04 note): one 8K
 * UHD frame. 2× of a large diagram is otherwise well past 100 MP, and encoding
 * that PNG is most of what made exporting one slow, for an image far beyond
 * anything a screenshot is pasted into.
 */
export const SCREENSHOT_MAX_PIXELS = 7680 * 4320;

/**
 * The Screenshot preset's scale: `preferred` (2×), lowered just enough to keep
 * the image within {@link SCREENSHOT_MAX_PIXELS}. Small and medium diagrams get
 * `preferred` unchanged. The explicit DPI presets and the custom slider do not
 * go through this — they mean exactly the scale they name, clamped only by the
 * browser caps in {@link computeRenderTarget}.
 */
export function screenshotScale(
  bounds: { width: number; height: number },
  preferred: number,
  maxPixels: number = SCREENSHOT_MAX_PIXELS
): number {
  const area = Math.max(1, bounds.width || 0) * Math.max(1, bounds.height || 0);
  return Math.min(preferred, Math.sqrt(maxPixels / area));
}

export interface BackingStore {
  /** Backing-store width in device px (clamped, rounded, ≥ 1). */
  width: number;
  /** Backing-store height in device px (clamped, rounded, ≥ 1). */
  height: number;
  /** Effective device-pixel-ratio after clamping (≤ the requested dpr). */
  dpr: number;
  /** True when dpr had to be reduced to fit the caps. */
  wasClamped: boolean;
}

/**
 * Clamp a bulk GPU layer's backing store (`cssW·dpr × cssH·dpr`) against the
 * browser's canvas caps (ADR 0038 §Deferred — backing-store viewport clamp).
 *
 * A very-high-DPI large viewport can push `W·dpr` past a canvas's max dimension
 * / total-area limit, at which point the browser hands back a blank or failed GL
 * surface (the same failure `computeRenderTarget` guards for export). This treats
 * `dpr` as the export path treats its scale multiplier: it returns the largest
 * effective dpr that still fits, degrading *resolution* rather than blanking.
 *
 * The caller MUST feed the returned `dpr` into the ENTIRE render path — the
 * `zoom·dpr` view scale AND the device origin (`(W/2 + scroll)·dpr`) — not just
 * the backing-store size, or the scene and its buffer desync (the CSS canvas size
 * stays `W×H`, so the browser upscales the smaller buffer to fill).
 *
 * Uses the conservative cross-browser `DEFAULT_RENDER_CAPS` rather than querying
 * live `MAX_VIEWPORT_DIMS` / `MAX_TEXTURE_SIZE`: one shared ceiling with export,
 * already the safe common floor, and no GL round-trip on the per-frame path.
 * They are not a guarantee, though — a GPU can still allocate less than they
 * allow — so SceneCanvas passes tighter caps once the drawing buffer it actually
 * got says so (`SpriteBatch.render`'s return).
 */
export function computeBackingStore(
  cssW: number,
  cssH: number,
  dpr: number,
  caps: RenderTargetCaps = DEFAULT_RENDER_CAPS
): BackingStore {
  const t = computeRenderTarget({ width: cssW, height: cssH }, dpr, caps);
  return {
    width: t.width,
    height: t.height,
    dpr: t.effectiveScale,
    wasClamped: t.wasClamped
  };
}
