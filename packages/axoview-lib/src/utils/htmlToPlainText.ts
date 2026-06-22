import { stripHtmlTags } from './stripHtml';

/**
 * HTML-entity decode + tag-strip for non-HTML text sinks (Canvas2D `fillText`,
 * width measurement) — the step the canvas node/label path omitted.
 *
 * Quill stores rich text as HTML, so a literal `&nbsp;` / `&amp;` survives a
 * tag-strip and reaches `ctx.fillText` verbatim. The DOM/popover path renders
 * the HTML so the browser decodes for free; the canvas does not, which is why a
 * caption showed a literal `&nbsp;` on the default node layer (ADR 0019 / 0028).
 *
 * Two entry points so the right amount of work is applied per source:
 * - {@link htmlToPlainText} — strip tags **and** decode. For genuine HTML
 *   sources (a node's rich-text description, text-box content).
 * - {@link decodeHtmlEntities} — decode only, **no** tag-strip. For plain-text
 *   fields that are rendered verbatim by the DOM (a node's `name`, committed via
 *   `innerText`). Stripping those would corrupt a legitimate name like `List<T>`
 *   and diverge from the DOM overlay it must match (ADR 0019 hybrid parity).
 */

// Named entities Quill emits in stored rich text. Its numeric siblings (e.g.
// `&#39;` for an apostrophe) are handled by the numeric branch below.
const NAMED_ENTITIES: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'"
};

const ENTITY_RE = /&(nbsp|amp|lt|gt|quot|apos|#x?[0-9a-fA-F]+);/g;

/**
 * Decode HTML entities in a single left-to-right pass, so a decoded `&` can't be
 * re-read as the head of another entity (`&amp;lt;` → `&lt;`, never `<`).
 */
export const decodeHtmlEntities = (text: string | undefined): string => {
  if (!text) return '';
  return text.replace(ENTITY_RE, (match, body: string) => {
    if (body.charCodeAt(0) === 35 /* '#' */) {
      const code =
        body[1] === 'x' || body[1] === 'X'
          ? parseInt(body.slice(2), 16)
          : Number(body.slice(1));
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[body] ?? match;
  });
};

/** Strip rich-text tags (shared fixpoint stripper) then decode the entities a
 * tag-strip leaves behind. The one shared converge point for the previously
 * ad-hoc `&nbsp;` replacers. */
export const htmlToPlainText = (html: string | undefined): string => {
  if (!html) return '';
  return decodeHtmlEntities(stripHtmlTags(html));
};
