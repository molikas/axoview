type RawObject = Record<string, unknown>;

const isObj = (v: unknown): v is RawObject =>
  typeof v === 'object' && v !== null;

/**
 * ADR 0032 amendment (2026-06-30) — node label↔name decouple seed.
 *
 * The on-canvas text is now the model item's `label`, decoupled from the
 * identity `name` (which is Layers-only and hidden from the canvas). Existing
 * saved nodes have a `name` that currently draws on canvas but no `label`, so
 * on load we seed `label = name` — every saved node then carries an explicit
 * on-canvas label and renaming `name` in Layers no longer moves the canvas
 * text. No diagram visibly changes (the seeded label equals the name that was
 * already drawn).
 *
 * Pure + idempotent: seeds only when `name` is a non-empty string and `label`
 * is absent. Once `label` is present (already-seeded or user-edited, including
 * an explicit empty string that hides the label) it is a no-op. Safe to `map`
 * over `rawData.items` on load alongside foldNodeDescription.
 */
export const seedNodeLabel = (item: unknown): unknown => {
  if (!isObj(item)) return item;
  if (typeof item.label === 'string') return item;
  const name = typeof item.name === 'string' ? item.name : '';
  if (!name) return item;
  return { ...item, label: name };
};
