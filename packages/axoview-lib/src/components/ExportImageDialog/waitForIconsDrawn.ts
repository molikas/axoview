// A2: the export snapshots the hidden Axoview's Canvas2D node layer, but icon
// bitmaps decode asynchronously (NodesCanvas.getImage creates an Image and only
// paints it once `complete`). Waiting on model-ready + one rAF isn't enough — the
// first frame can paint before any icon has decoded, dropping every icon node
// from the capture (connectors are DOM/SVG, so they survive). NodesCanvas
// publishes `data-all-icons-drawn="true"` once a frame painted with every icon
// bitmap available; poll that here before capturing.
//
// Resolves true once the canvas is mounted AND reports ready; false once the
// timeout elapses (so export never hangs — the caller captures anyway, then
// recaptures). See ExportImageDialog's capture effect.
export const waitForIconsDrawn = (
  container: HTMLElement | null,
  timeoutMs: number
): Promise<boolean> =>
  new Promise((resolve) => {
    const start = performance.now();
    const poll = () => {
      const canvas = container?.querySelector<HTMLElement>(
        '[data-testid="axoview-nodes-canvas"]'
      );
      // Ready only when the canvas is mounted AND a frame painted with every
      // icon bitmap available.
      if (canvas && canvas.dataset.allIconsDrawn === 'true') {
        resolve(true);
        return;
      }
      // Timed out → capture anyway (best effort); the caller's recapture pass
      // tries once more after a longer wait. Reached when the canvas never drew
      // in time OR there is genuinely no canvas (a DOM-only render).
      if (performance.now() - start >= timeoutMs) {
        resolve(false);
        return;
      }
      // QA #10: a not-yet-mounted canvas must NOT short-circuit to "ready". The
      // hidden export Axoview can mount a tick after axoviewReadySignal fires
      // (more so on slower/deployed mounts); treating an absent canvas as
      // "nothing to wait for" resolved true immediately, captured a blank frame
      // before NodesCanvas existed, AND (because it returned true) made the
      // caller skip its recapture — so the icons were dropped for good. Keep
      // polling until the canvas mounts and draws, or the timeout fires (which
      // resolves false and DOES trigger the recapture).
      requestAnimationFrame(poll);
    };
    requestAnimationFrame(poll);
  });
