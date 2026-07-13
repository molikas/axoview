import { useEffect } from 'react';
import { dismissBootScreens } from '../utils/bootScreen';
import { APP_BASENAME } from '../appBase';

/**
 * Graceful 404 for any route the SPA is served on but does not recognise
 * (e.g. a mistyped `/whatever.html`). It is the catch-all `<Route path="*">`.
 *
 * Why it exists: `try_files … /index.html` (nginx) and Cloudflare Pages' SPA
 * fallback both serve `index.html` for unknown paths, so the SPA boots — but
 * with no matching `<Route>`, nothing mounted, and the boot splash from
 * `public/index.html` was never cleared, so the page appeared to spin forever.
 * This component mounts on any unmatched route, clears the splash, and offers a
 * way back. It deliberately renders WITHOUT the storage/auth providers (it does
 * not need them), so it is instant and cannot itself get stuck initialising.
 *
 * Styling is inline (no MUI) to match the splash / static legal pages and to
 * stay independent of the app theme provider.
 */
export function NotFound() {
  useEffect(() => {
    dismissBootScreens();
    // A soft 404 (200 index.html). Hint the correct status to crawlers.
    document.title = 'Page not found — Axoview';
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        padding: 24,
        textAlign: 'center',
        background: '#ffffff',
        color: '#1f2937',
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
      }}
    >
      <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: '0.02em' }}>
        Axo<span style={{ color: '#2563eb' }}>view</span>
      </div>
      <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1, color: '#0f172a' }}>404</div>
      <div style={{ fontSize: 18, color: '#475569', maxWidth: 440 }}>
        That page doesn’t exist. It may have been moved, or the link was mistyped.
      </div>
      <a
        href={APP_BASENAME}
        data-axoview-id="notfound-home"
        style={{
          marginTop: 4,
          display: 'inline-block',
          background: '#2563eb',
          color: '#fff',
          fontWeight: 600,
          fontSize: 15,
          padding: '11px 24px',
          borderRadius: 10,
          textDecoration: 'none'
        }}
      >
        Go to Axoview →
      </a>
    </div>
  );
}
