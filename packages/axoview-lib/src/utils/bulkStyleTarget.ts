import { ItemReference } from 'src/types';

export interface BulkStyleTarget {
  type: ItemReference['type'];
  ids: string[];
}

/**
 * ADR 0030 §2 amendment (2026-06-30) — bulk styling gate. A `>1` selection is a
 * bulk-style target IFF every selected item shares a `.type` (homogeneous).
 * Returns the shared type + ids, or null for a single/empty/heterogeneous
 * selection (the strip stays disabled for those). Pure — the docked style strip
 * fans its writers out over `ids` in one transaction.
 */
export const resolveHomogeneousBulk = (
  selectedIds: ItemReference[]
): BulkStyleTarget | null => {
  if (selectedIds.length < 2) return null;
  const type = selectedIds[0].type;
  if (!selectedIds.every((r) => r.type === type)) return null;
  return { type, ids: selectedIds.map((r) => r.id) };
};
