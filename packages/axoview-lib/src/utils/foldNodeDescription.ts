import { stripHtmlTags } from 'src/utils/stripHtml';

/**
 * Block separator inserted between any prior notes and the folded-in
 * description, so the two stay distinct blocks instead of running together
 * inline (the old `${notes}${description}` concatenation had no separator).
 * DOMPurify's `html` profile (sanitizeHtml) preserves <hr>, so it survives the
 * render-time and on-import sanitization.
 */
export const NOTES_FOLD_SEPARATOR = '<hr />';

type RawObject = Record<string, unknown>;

const isObj = (v: unknown): v is RawObject =>
  typeof v === 'object' && v !== null;

/**
 * Option A name/caption/label fold (ADR 0032). A node's rich `description` was
 * the on-canvas "caption" — a second text competing with the `name`. It folds
 * into `notes` (the canvas now shows only the name) and is then dropped from the
 * working model; the field stays in the schema for external round-trip.
 *
 * Idempotent: once `description` is removed a re-run is a no-op, so loading an
 * already-folded diagram never double-appends. An empty/whitespace-only
 * description is skipped (no fold, no separator, `notes` untouched, and the
 * empty `description` is left as-is for round-trip). Pure — safe to unit-test in
 * isolation and to `map` over `rawData.items` on load.
 */
export const foldNodeDescription = (item: unknown): unknown => {
  if (!isObj(item)) return item;
  const description =
    typeof item.description === 'string' ? item.description : '';
  if (!stripHtmlTags(description).trim()) return item;
  const notes = typeof item.notes === 'string' ? item.notes : '';
  const merged = stripHtmlTags(notes).trim()
    ? `${notes}${NOTES_FOLD_SEPARATOR}${description}`
    : description;
  const next: RawObject = { ...item, notes: merged };
  delete next.description;
  return next;
};
