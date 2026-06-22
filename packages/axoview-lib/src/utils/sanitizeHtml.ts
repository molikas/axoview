import DOMPurify from 'dompurify';

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
