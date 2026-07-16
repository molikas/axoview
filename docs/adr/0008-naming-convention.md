# ADR 0008 — Naming Convention

**Status:** Accepted
**Date:** 2026-05-20
**Supersedes:** none (codifies existing patterns + closes real-finding gaps)
**Superseded by:** none

## Context

The productization audit ([docs/tactical/productization-audit.md](../tactical/productization-audit.md)) Phase A surfaced ~32 surface-level rows in the mode matrix (A.4) and 16 anomaly rows in the concept register (A.3), plus deployment-artifact and skill inventories in A.6 and A.9. Phase A synthesis Theme 5 noted that **Discovery is now richer than the original C.1 naming seed list** — most of the seeded surfaces (`AppToolbar`, `LayersPanel`, `BottomDock`, `StatusCluster`, `ExportPopover`, `ContextMenu`, `QuickAddPopover`) came up clean. The actual naming-decision shape that Discovery revealed centres on:

- **Two real name-collision bugs** ([A.3 anomaly #4 — dual `ExportDialog.tsx`](../tactical/productization-audit.md), [A.3 anomaly #5 — dual `StorageManager`](../tactical/productization-audit.md)) — IDE jump-to-definition cannot disambiguate without path context.
- **One real semantic-inversion bug** ([A.4 #C2 — `SessionModeBanner` is shown only in LOCAL mode](../tactical/productization-audit.md)) — the render gate is `!serverStorageAvailable`, so the name and the behaviour contradict.
- **A lib-vs-app surface question** ([A.3 #C7](../tactical/productization-audit.md)) — when a lib surface is app-unused but worth preserving for external lib consumers, how is it marked?
- **A provider-id discriminant pattern** ([A.4.4](../tactical/productization-audit.md)) — `'local' | 'google-drive'` is established; Phase 3B needs the extension story.
- **A modal-vs-dialog-vs-popover vocabulary drift** ([A.3 anomalies #4, #5, #6, #7](../tactical/productization-audit.md)) — five surfaces named `*Dialog` vary widely in shape (transient confirm, modal full-screen, popover-anchored).
- **A `data-axoview-id` decision deferred from M4** — testability gates Phase B + future Playwright E2E (C.5).
- **Naming patterns Discovery confirmed clean** — package naming (`axoview-<role>`), skill naming (`/<verb>` for cadence, `/<verb>-<noun>` for compound), Cloudflare-inherited filenames.

This ADR records the rules that **the findings prescribe**, not a top-down convention. Every rule below cites the finding that drove it.

## Decision

### 1. Component file names disambiguate when colliding; describe surface, not state

**Rule:** when two files in the same package share a basename, both are renamed to describe the visible surface they own — never the state they react to or the mode they fire in.

**Mandatory renames closed by this ADR:**

| Current | Renamed | Driving finding |
|---|---|---|
| [`packages/axoview-app/src/components/ExportDialog.tsx`](../../packages/axoview-app/src/components/ExportDialog.tsx) | `ExportSingleDiagramDialog.tsx` | A.3 anomaly #4 — name-collision with `fileExplorer/ExportDialog.tsx` |
| [`packages/axoview-app/src/components/fileExplorer/ExportDialog.tsx`](../../packages/axoview-app/src/components/fileExplorer/ExportDialog.tsx) | `ExportProjectZipDialog.tsx` | A.3 anomaly #4 — name-collision (the project-zip exporter) |
| [`packages/axoview-app/src/StorageManager.tsx`](../../packages/axoview-app/src/StorageManager.tsx) | `LocalStorageInspector.tsx` | A.3 anomaly #5 — name-collision with the `StorageManager` orchestrator class |
| [`packages/axoview-app/src/components/SessionModeBanner.tsx`](../../packages/axoview-app/src/components/SessionModeBanner.tsx) | `LocalModeBanner.tsx` | A.4 #C2 — semantic inversion (render gate is `!serverStorageAvailable`; banner text confirms it warns about LOCAL persistence loss) |

The `StorageManager` **class** ([packages/axoview-app/src/services/storage/StorageManager.ts](../../packages/axoview-app/src/services/storage/StorageManager.ts)) keeps its name — it is the provider-agnostic orchestrator and there is no collision once the modal renames. A.4 #C3's separate concern (the misleading `id = 'local' as const` field on the orchestrator) is a code-comment / field-deletion fix, not a name fix.

**Rationale (the rule, not the renames):** names describe *what you see on screen* or *what role this code plays*. They do not describe *which feature flag enabled them* or *which mode they fire in* — that information is the render gate's job, and the render gate can change without forcing a rename.

### 2. Modal vs Popover vs Dialog vs Panel — locked vocabulary

A.3 surfaced four interchangeable terms (`Dialog`, `Modal`, `Popover`, `Panel`) applied to surfaces with materially different shapes. The locked vocabulary:

| Term | Visual contract | Examples |
|---|---|---|
| **Dialog** | Centred overlay, focus-trapped, dismissible via Escape, requires explicit user action. Backdrop dims the canvas. | `ExportSingleDiagramDialog`, `ExportProjectZipDialog`, `ImportDialog`, `SettingsDialog`, `HelpDialog` |
| **Modal** | Same as Dialog. **Use `Dialog` in new code.** Existing names with `Modal` (none currently) should rename if encountered. | (none) |
| **Popover** | Anchored to a trigger element, dismisses on outside click, no backdrop. | `ExportPopover`, `QuickAddNodePopover` |
| **Panel** | Persistent or toggle-revealed region of the layout, not focus-trapped, lives inside the existing chrome. | `NodePanel`, `LayersPanel`, `FileExplorer` (left pane), `RightSidebar` |
| **Banner** | Inline horizontal callout occupying full layout width; advisory, not interactive. | `LocalModeBanner` (post-rename) |
| **Screen** | Full-area placeholder or state-when-empty. Occupies the canvas region; signals an absent or pre-content state rather than overlaying interactive content. | `EmptyStateScreen` |

**Rule:** new components pick the term that matches the visual contract. `Modal` is reserved as a synonym during transition only; do not introduce new `*Modal` names.

### 3. Lib-vs-app surface distinction is opt-in via `// LIB-ONLY` marker, forward-looking only

A.3 cross-cutting #1 proposed a `// LIB-ONLY` header comment on lib components that are app-unused but preserved for external `axoview-lib` consumers. The MainMenu locked-deletion ([A.3 #1](../tactical/productization-audit.md)) removed the immediate need for the marker, but the convention stands as the **forward-looking pattern** for the first real case (a published lib surface that the app retires post-1.0).

**Rule:**

- A lib component is **app-used** by default. No marker needed.
- When a lib component becomes app-unused but the lib intentionally retains it for external consumers, the file's top-of-file comment block gains `// LIB-ONLY — <one-line reason>` immediately after the file purpose comment.
- The marker is **discoverable, not enforced** — no build-time check, no test gate. Code review catches drift.
- The marker is **opt-in**, not retroactive — it does not apply to MainMenu (which is being deleted in C.2) or any existing lib surface.

The first real-world `// LIB-ONLY` case will appear when the published `axoview-lib` (per ADR 0009 npm-publish wiring) has a surface that `axoview-app` stops using.

### 4. Provider-id discriminant — kebab-case lowercase, extensible

A.4.4 inventoried the existing pattern: `id: 'local' | 'google-drive'` ([packages/axoview-app/src/services/storage/types.ts:26](../../packages/axoview-app/src/services/storage/types.ts#L26)).

**Rule:**

- New provider IDs are **kebab-case lowercase singular nouns**: `'local'`, `'google-drive'`, future candidates `'r2'`, `'d1'`, `'webdav'`, `'http-api'`.
- The discriminant union is extended in [types.ts](../../packages/axoview-app/src/services/storage/types.ts) only; the union is the single source of truth.
- The provider's class name is **PascalCase**: `LocalStorageProvider`, `GoogleDriveProvider`. The class name does not need to derive from the id by mechanical transform — `'local'` ↔ `LocalStorageProvider` is acceptable.
- Each provider id has a human label resolved via `providerIdToLabel` ([FileExplorer.tsx:82-85](../../packages/axoview-app/src/components/fileExplorer/FileExplorer.tsx#L82-L85)); the label is whatever reads best in UI ("Local browser", "Google Drive", "Cloudflare R2").

### 5. `data-axoview-id` attribute — selective, not blanket; reserved for E2E and trace harness anchors

M4 deferred the question of whether to retrofit `data-axoview-id` attributes on every surface. Discovery's evidence (A.3 + A.4 surface inventories) suggests a selective approach beats a blanket approach.

**Rule:**

- **`data-axoview-id` is the single product-namespaced attribute for both E2E selectors and trace-harness mounts.** Do not introduce `data-testid` in parallel — one anchor namespace, two consumers.
- A surface gets `data-axoview-id="<kebab-case>"` when (a) it is referenced by a test in `packages/axoview-e2e/` or `__perf_refactor_regression__/`, OR (b) it is named as a trace event mount in ADR 0007 (when accepted).
- The attribute value is **kebab-case, namespaced by surface family**: `toolbar-save`, `toolbar-share`, `panel-layers`, `dialog-export-single-diagram`, `popover-quick-add`, `banner-local-mode`.
- Forbidden: using the attribute for styling (use a class) or for logic gating (use a prop / context). One attribute, one purpose — selector + mount anchor.
- C.5 (Playwright E2E rewrite) inventories which surfaces actually need anchors; the retrofit happens lazily as tests are written, not as a sweep.

This decision satisfies M4's gate without committing to a blanket attribute retrofit.

### 6. Package naming — `axoview-<role>` where role is the established 4-set

The monorepo's four packages — `axoview-lib`, `axoview-app`, `axoview-worker`, `axoview-backend` — are 4-of-4 conformant ([A.5 + A.6 + A.7](../tactical/productization-audit.md)).

**Rule:**

- New packages within this monorepo follow the `axoview-<role>` pattern.
- The established roles are: `lib` (publishable React library), `app` (the SPA bundling consumer of `lib`), `worker` (Cloudflare-side runtime), `backend` (Node/Express-side runtime).
- Adding a fifth role requires explicit ADR or audit gate. Candidate names that would fit: `axoview-core` (if shared route layer ever leaves `axoview-backend/src/routes.js` — see [productization-audit P6](../tactical/productization-audit.md)), `axoview-e2e` (already exists; locked for deletion + rewrite per audit decision #4).
- Within each package, the `name` field in `package.json` is close to the directory but **not uniformly identical, and scoping is not uniformly absent**: `axoview-app`, `axoview-backend`, and `axoview-worker` match their dirs, but `axoview-lib`'s package name is `axoview` (unscoped, ≠ dir) and `axoview-e2e`'s is `@axoview/e2e` (scoped). Any future consolidation onto a single `@axoview/*` scope is a publication question, out of scope here.

### 7. Skill naming — verb for cadence; verb-noun for compound; `-check` for verification

A.9.1 inventoried the five in-scope skills (`/audit`, `/feature`, `/notes`, `/shake-out`, `/ship`) and A.9.4 catalogued nine deferred candidates ([/release-check, /trace, /deploy-check, /regression-snapshot, /workflow-check, /ux-baseline, /perf-baseline, …](../tactical/productization-audit.md)).

**Rule:**

- A **cadence-anchor skill** (one of the canonical session stages per [docs/workflow.md](../workflow.md)) is a **single short verb** with no hyphenation: `/audit`, `/notes`, `/ship`.
- A **compound-action skill** (a recognisable two-word action) uses a hyphenated form: `/shake-out`, `/feature start`, `/feature wrap`.
- A **verification skill** (asks "is X ready/correct?") uses the `-check` suffix: `/release-check`, `/deploy-check`, `/workflow-check`.
- A **trace-harness invocation** is `/trace <scenario>` (single verb with arg) — reserved for the trace harness post-ADR 0007.
- New skills are catalogued in workflow.md's "Process debt — deferred skills" section before being built. Building without cataloguing is anti-pattern per A.9.4's "0 build" disposition.

### 8. Code-level naming — boolean fields, render gates, deployment files

Three smaller rules surfaced from Discovery:

- **Boolean state fields use `is*` / `has*` / `*Enabled` prefixes when their meaning is non-obvious.** `serverStorageAvailable` ([AppToolbar.tsx](../../packages/axoview-app/src/components/AppToolbar.tsx)) is acceptable (descriptive); `serverStorage: boolean` is the cautionary example — its name doesn't communicate "is enabled" vs "is a path string" vs "is configured." ADR 0009 Decision 2 marks that `RuntimeConfig.serverStorage` field for removal, **but the removal has not landed**: it is still declared in [useRuntimeConfig.ts](../../packages/axoview-app/src/hooks/useRuntimeConfig.ts) and read by `AppStorageContext`. Future boolean fields prefer `serverStorageEnabled`, `gitBackupEnabled`, `driveProviderRegistered`.
- **Render gates are explicit predicates, not negations of negations.** Prefer `!serverStorageAvailable` over `!(hasServerStorage === true)`. A.4 surfaced no current offenders; this is preventative.
- **Deployment artifact filenames are Cloudflare-inherited and immutable.** `_routes.json`, `_headers`, `wrangler.toml`, `.dockerignore`, `Dockerfile`, `nginx.conf`, `compose.yml`, `compose.dev.yml` — these names are dictated by the platforms that consume them. The convention is to **never rename them**, and to keep them at the path each platform expects (root for Cloudflare-button consumption per ADR 0009 Decision 5).

## Consequences

### Positive

- The two real name-collision bugs (A.3 #4, #5) are fixed by a single C.2 row.
- The SessionModeBanner semantic-inversion bug (A.4 #C2) has a written-down rename target.
- The `// LIB-ONLY` convention exists in writing for the first published-lib post-1.0 case, without retro-applying to MainMenu (which is being deleted).
- The `data-axoview-id` decision satisfies M4 without committing the codebase to a blanket retrofit.
- Package + skill naming is codified, so future additions don't drift.

### Negative / open

- **Decision 1's rename list is finite and short.** Future name-collision discoveries are not pre-empted by this ADR — the *rule* is, but the discovery is per-case. The next audit catches drift.
- **Decision 2's vocabulary boundary is judgement-based** (when does a transient overlay become a "Dialog" vs a "Banner"?). Borderline cases get the visual-contract test in the table.
- **Decision 5's selective retrofit** means the trace harness (ADR 0007) and E2E suite (C.5) both have to declare their mount-point inventories. If C.5 lands before ADR 0007, the two inventories may overlap or contradict; this ADR doesn't pre-resolve that — it leaves the disambiguation to C.5 / ADR 0007's own scope.
- **Decision 3's `// LIB-ONLY` marker has no build-time enforcement.** A future audit could grep for it as a coverage check; this ADR doesn't require that gate.

## Files affected by adopting this ADR

The renames in Decision 1 land in the C.2 cleanup plan:

- [packages/axoview-app/src/components/ExportDialog.tsx](../../packages/axoview-app/src/components/ExportDialog.tsx) → `ExportSingleDiagramDialog.tsx`
- [packages/axoview-app/src/components/fileExplorer/ExportDialog.tsx](../../packages/axoview-app/src/components/fileExplorer/ExportDialog.tsx) → `ExportProjectZipDialog.tsx`
- [packages/axoview-app/src/StorageManager.tsx](../../packages/axoview-app/src/StorageManager.tsx) → `LocalStorageInspector.tsx`
- [packages/axoview-app/src/components/SessionModeBanner.tsx](../../packages/axoview-app/src/components/SessionModeBanner.tsx) → `LocalModeBanner.tsx`

Each rename touches: the source file (rename), every import site (grep + edit), and any test reference.

ux-principles.md gains a short cross-reference to this ADR's Decision 2 (locked vocabulary) so panel-vs-dialog-vs-popover terms stay coherent in design language.

## See also

- [productization-audit.md A.3](../tactical/productization-audit.md) — concept anomaly register (16 rows; anomalies #4, #5 drove Decision 1).
- [productization-audit.md A.4 #C2](../tactical/productization-audit.md) — `SessionModeBanner` semantic inversion (drove the rename).
- [productization-audit.md A.4.4](../tactical/productization-audit.md) — provider-id inventory (drove Decision 4).
- [productization-audit.md Theme 5](../tactical/productization-audit.md) — findings-drive-the-ADR principle.
- [docs/workflow.md](../workflow.md#process-debt--deferred-skills) — the deferred-skills catalogue that Decision 7's skill-naming rules govern. *(workflow.md does not itself cite ADR 0008 or "Decision 7"; the naming rules in this ADR are the authority — the link is one-way.)*
- ADR 0005 — Toolbar and dock layout contract (the surface-naming precedent: "top toolbar", "bottom dock", "left dock", "right sidebar" are locked by 0005; this ADR doesn't restate them).
- ADR 0009 — Deployment topology (Decision 2 deleted the dead `RuntimeConfig.serverStorage` field that motivated rule 8's boolean-field guidance).
