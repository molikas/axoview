import DOMPurify from 'dompurify';

/**
 * Force safe `rel` on every rendered anchor (security review 2026-07-05). A link
 * inside a shared/imported diagram is attacker-controlled; if it ever opens a new
 * browsing context, `noopener` severs the `window.opener` back-handle (reverse
 * tabnabbing) and `noreferrer` stops the URL leaking via `Referer`. We apply it
 * unconditionally rather than only on `target="_blank"` so the guarantee does not
 * depend on DOMPurify's (version-specific) `target` handling. Registered once at
 * module load on DOMPurify's singleton.
 */
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && (node as Element).hasAttribute('href')) {
    (node as Element).setAttribute('rel', 'noopener noreferrer');
  }
});

/**
 * Sanitize rich-text (Quill) HTML before it reaches a `dangerouslySetInnerHTML`
 * sink (ADR 0029). The one genuine user-HTML sink in the app is the read view of
 * a TextBox; a shared or imported diagram can otherwise smuggle
 * `<img src=x onerror=…>` / `<svg onload=…>` payloads that execute in the
 * viewer's origin (stored XSS).
 *
 * `USE_PROFILES.html` keeps the formatting Quill emits (bold/italic/underline/
 * strike, headers, ordered/bullet lists, links, blockquote, code) while
 * stripping scripts, inline event-handler attributes, and dangerous elements.
 *
 * DOMPurify needs a DOM — fine in the browser and under jsdom (the lib's jest
 * environment); it must not be called from a bare-Node/SSR context without a
 * DOM shim.
 */
export const sanitizeHtml = (html: string): string =>
  DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
