/**
 * Fade out and remove the boot splash (`#ax-splash`) injected by
 * `app-shell.html`.
 *
 * Called once the SPA has decided what to render — the editor (after storage
 * init) or a graceful fallback such as the 404 page. Extracted so every mount
 * point clears the splash identically; a route that forgot to call this is why
 * an unknown URL used to spin forever (no matched route → the splash was never
 * cleared).
 *
 * Idempotent and null-safe: safe to call more than once and after the splash is
 * already gone.
 */
export function dismissBootScreens(): void {
  // Two RAFs ≈ first paint has flushed before we fade, so there is no flash of
  // un-styled app behind the splash.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const splash = document.getElementById('ax-splash');
      if (splash) {
        splash.classList.add('ax-splash-hidden');
        window.setTimeout(() => splash.remove(), 250);
      }
    });
  });
}
