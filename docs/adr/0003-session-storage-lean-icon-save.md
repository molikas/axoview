# ADR 0003 — Lean Icon Save (Strip Default Catalog)

**Status:** Accepted
**Date:** 2026-04-30
**Supersedes:** none
**Superseded by:** none

## Context

`LocalStorageProvider.sessionSaveDiagram` and the server save paths persist the full Axoview model, including the entire `icons[]` array. The `icons[]` array conflates two concerns (see [ADR 0002](0002-icon-catalog-merge-on-load.md)) — the side-dock catalog and per-diagram persistence.

Today every saved diagram carries a copy of the bundled icon catalog. For default icons (`{ id, name, url: 'https://...' }`) the cost is small but non-zero — a few hundred bytes per icon, dozens of icons, persisted in every diagram, every save. For session storage the budget is ~5 MB total, shared across all diagrams; this overhead matters. For exports it bloats every JSON download.

The bundled catalog already exists in code at [packages/axoview-lib/src/fixtures/icons.ts](../../packages/axoview-lib/src/fixtures/icons.ts). Persisting it is pure redundancy.

## Decision

Always strip default-catalog icons from `model.icons` before writing.

This applies to **every write path**:

- Session storage (`sessionStorage.setItem` for diagrams).
- Server storage (`PUT /api/diagrams/:id`, both fs and R2 backends — strip before the network call).
- Export JSON (single-diagram and within project zips).

The strip rule:

```
keep icon  ⟺  icon.id ∉ bundledFixtures.byId
              ∨  icon differs from bundledFixtures.byId[icon.id] in any user-visible field
```

In other words: drop an icon iff it is a *pure* duplicate of a bundled fixture. Custom icons (unknown id) and overridden defaults (same id, different metadata) are preserved verbatim.

Load-time rehydration is handled by [ADR 0002](0002-icon-catalog-merge-on-load.md) — the loader unions `bundledFixtures` back in before populating the model store.

**2026-05-02:** Lean-save now also persists `requiredPacks: string[]` — the unique non-isoflow/imported collections referenced by `items`. Loaders consult it to lazy-fetch the right icon packs before the merge in ADR 0002 runs; without this signal, items end up pointing at icon ids that nothing in the loaded catalog can resolve. The field is **preserved** (not re-derived) when the input is already lean — otherwise a round-trip through storage wipes the list to `[]`. Authoritative re-derivation only runs when every `item.icon` resolves against `model.icons`.

## Consequences

**Positive:**

- Session-mode workspaces hold materially more diagrams within the ~5 MB budget — empirically the icon array dominates per-diagram size for diagrams with few items.
- Export JSON files shrink, especially for small diagrams (the icon catalog can be larger than the diagram content itself).
- Server payloads shrink → faster auto-save round-trips.
- The catalog-rehydration path runs on every load, so it cannot bit-rot — no class of bug where "load works for new diagrams but not old saves" can develop quietly.

**Negative / risks:**

- **Reliance on ADR 0002.** If the load-merge contract is broken, the side dock empties after load. Mitigated by the unit test required in ADR 0002.
- **Backward compatibility of older saves.** Saves made before this change still contain the bundled catalog. They must continue to load. The merge in ADR 0002 is union-by-id — duplicate entries from old saves collapse harmlessly.
- **Catalog version drift.** If we ship a build where `bundledFixtures` is missing an icon that older saves persisted as a "default," that icon now becomes effectively a custom icon (preserved on save because its id no longer matches the catalog). This is the desired behavior — we never silently lose a user's icon.

## Implementation notes (non-binding)

- The strip helper lives in `packages/axoview-lib/src/utils/leanSave.ts` (new) so server, session, and export call sites share one implementation.
- `bundledFixtures.byId` is a memoized `Map<string, Icon>` derived from the fixture array.
- "Differs in any user-visible field" compares: `name`, `url`, `collection`, `category` — but **not** any future runtime-only fields (e.g. cached SVG dimensions). Keep the comparison conservative — a diff defaults to "keep."
- The opposite of strip — the merge — already has its home in [useInitialDataManager](../../packages/axoview-lib/src/hooks/useInitialDataManager.ts) per ADR 0002.

## Acceptance criteria

- **Unit test:** model with `icons` = `bundledFixtures` (verbatim), passed through `leanSave`, produces `icons: []`.
- **Unit test:** model with `icons` = `[...bundledFixtures, customIcon]` produces `icons: [customIcon]`.
- **Unit test:** model with `icons[0]` = bundled fixture but `name` changed → fixture is preserved (override wins).
- **Round-trip test:** session-save then session-load produces a model whose merged `icons` array is element-wise equal to the pre-save merged array.
- **Manual verification:** the side dock after load shows the full bundled catalog (covered by ADR 0002 tests; called out here because the bug history lives in this surface).
