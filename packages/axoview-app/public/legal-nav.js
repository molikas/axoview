/* Context-aware "Back" link for the static legal pages (privacy.html, terms.html).
 *
 * These pages are reached from three places, and "back" should mean different
 * things for each:
 *   - from the editor at /app  -> return to the editor
 *   - from the marketing landing at /  -> return to the landing
 *   - from outside (search, the Google OAuth consent screen, a shared link)
 *     -> go to the Axoview home rather than bouncing the user off-site
 *
 * The static pages carry no framework and the CSP is `script-src 'self'`, so this
 * ships as a same-origin external file (no inline script). Progressive
 * enhancement: the anchor already has href="/" in the markup, so it still works
 * as a "home" link if this script never runs.
 */
(function () {
  var el = document.querySelector('[data-legal-back]');
  if (!el) return;

  var fromSameOrigin = false;
  var fromApp = false;
  try {
    if (document.referrer) {
      var ref = new URL(document.referrer);
      fromSameOrigin = ref.origin === window.location.origin;
      // Basename-tolerant: /app, /app/, /app/display/…, /foo/app all count as
      // "the editor" (but not /appendix or /myapp).
      fromApp = fromSameOrigin && /(^|\/)app(\/|$)/.test(ref.pathname);
    }
  } catch (e) {
    /* malformed referrer — treat as external */
  }

  var label = el.querySelector('[data-legal-back-label]') || el;

  if (fromSameOrigin && window.history.length > 1) {
    // Came from within the site — return to exactly where they were (editor
    // state / landing scroll position) via history, labelled for the origin.
    el.setAttribute('href', fromApp ? '/app' : '/');
    label.textContent = fromApp ? 'Back to editor' : 'Back';
    el.addEventListener('click', function (e) {
      e.preventDefault();
      window.history.back();
    });
  } else {
    // From outside the site, or opened directly with no history — send them to
    // the marketing home (the anchor's default href) instead of off-site.
    el.setAttribute('href', '/');
    label.textContent = 'Axoview home';
  }
})();
