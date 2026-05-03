# ADR 0002 — Icon Catalog Merge on Load

**Status:** Accepted
**Date:** 2026-04-30
**Supersedes:** none
**Superseded by:** none

## Context

The FossFLOW model carries an `icons[]` array. This array is two things conflated:

1. **The side-dock catalog** — what the user can drag onto the canvas.
2. **The persistence shape** — what gets saved to JSON when a diagram is exported or written to storage.

Conflating these has produced at least one regression historically: loading a saved diagram replaced the side-dock catalog with `model.icons`, so the user lost access to bundled (default) icons that weren't already on the diagram. The dock would shrink to just the icons referenced in the saved file.

[ADR 0003](0003-session-storage-lean-icon-save.md) makes this worse on paper — it strips default-catalog icons from saves entirely. Without an explicit merge contract on load, the side dock would always be empty after loading a stripped diagram.

We need to lock the relationship between the bundled fixture catalog, the model's `icons[]`, and the side dock so the bug cannot return.

## Decision

The side-dock icon catalog is **always** computed as:

```
sideDockCatalog = bundledFixtures ∪ model.icons
```

Where:

- `bundledFixtures` is the static array exported from [packages/fossflow-lib/src/fixtures/icons.ts](../../packages/fossflow-lib/src/fixtures/icons.ts). **As of 2026-05-01 this array is empty by design** — the real catalog is supplied by the consuming app (the FossFlow PWA injects `@isoflow/isopacks` into the model at create-time). The merge contract still holds: an empty `bundledFixtures` makes the union `≡ model.icons`, and any future library-bundled defaults can be added to the file without changing call sites.
- `model.icons` is whatever was loaded from JSON (post-strip, may be empty or contain only custom icons).
- Union is by `id`, with `model.icons` taking precedence on collision (so a user override of a default icon's metadata wins).

`model.icons` **never replaces** the catalog. The load path must merge.

### Where the merge happens

The merge belongs in the loader, not in every consumer. Consumers (the side dock, item-rendering hooks) read from a single derived selector that has already merged.

Concretely:

- The `load(modelData)` flow in [useInitialDataManager](../../packages/fossflow-lib/src/hooks/useInitialDataManager.ts) is the single entry point for hydrating the model store.
- Before writing to `useModelStore`, `load` merges `bundledFixtures` into `modelData.icons` per the rule above.
- Every other consumer reads `useModelStore(state => state.icons)` and gets the merged array. No consumer reaches into `bundledFixtures` directly.

### Save path (mirror)

When writing the model out (to storage, to export JSON), the lean-save pass strips any icon whose `id` exists in `bundledFixtures` and whose metadata is unchanged. Custom icons and user-overridden defaults are preserved. See [ADR 0003](0003-session-storage-lean-icon-save.md).

## Consequences

**Positive:**

- The side dock is always complete regardless of what's saved.
- ADR 0003's lean-save is safe to ship — load-time merge guarantees no side-dock regression.
- Future icon catalogs (custom packs, user uploads) plug into this contract by extending the union, not by changing consumers.
- The `model.icons` field can shrink to zero in stripped saves without breaking anything.

**Negative:**

- A test must enforce the contract; without it, a future refactor of the load path could silently break this again. We add the test as part of accepting this ADR.
- A user who *deletes* a bundled icon cannot persist that deletion — the merge will always re-add it. This is intentional. If we later want "hide bundled icons," it goes in user preferences, not the model.

## Acceptance criteria

- **Unit test (must exist):** load a diagram whose `icons[]` is empty; assert `useModelStore.getState().icons` contains every entry from `bundledFixtures`.
- **Unit test:** load a diagram whose `icons[]` contains one custom icon; assert the merged array has `bundledFixtures.length + 1` entries and the custom icon is present.
- **Unit test:** load a diagram whose `icons[]` contains an entry with the same `id` as a bundled icon but different metadata; assert the loaded version wins.
- **Integration test:** export-then-import a diagram with a custom icon; assert the side dock contains both the custom icon and all defaults.
