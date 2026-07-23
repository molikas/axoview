// Resolve an agent-supplied `kind` string to a real icon id from the catalog
// (ADR 0002 / ADR 0045 §3). An unresolved kind is a per-op error at the call
// site — this returns null and never throws.
//
// DETERMINISM (ADR 0045 §4, load-bearing for ADR 0047 goldens): every tie-break
// is a stable sort — no Set-iteration or insertion-order dependency. The same
// (kind, catalog) always resolves to the same icon id.

import { Icon } from 'src/types';

export const resolveKind = (kind: string, icons: Icon[]): string | null => {
  const trimmed = kind.trim();
  if (trimmed.length === 0) return null;

  // 1. Exact id match (the agent passed a real icon id).
  const byId = icons.find((i) => i.id === trimmed);
  if (byId) return byId.id;

  const needle = trimmed.toLowerCase();

  // 2. Exact (case-insensitive) name match — deterministic pick of the
  //    lexicographically-first id when several icons share a name.
  const exactName = icons
    .filter((i) => i.name.toLowerCase() === needle)
    .sort((a, b) => a.id.localeCompare(b.id));
  if (exactName.length > 0) return exactName[0].id;

  // 3. Substring match on name — sorted by name then id so the choice is stable.
  const contains = icons
    .filter((i) => i.name.toLowerCase().includes(needle))
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  if (contains.length > 0) return contains[0].id;

  return null;
};
