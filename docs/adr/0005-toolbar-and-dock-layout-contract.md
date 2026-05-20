# ADR 0005 — Toolbar and Dock Layout Contract

**Status:** Proposed
**Date:** 2026-05-09
**Supersedes:** none
**Superseded by:** none

## Context

Three signals drove this revision:

1. **The burger menu in the top toolbar is a junk drawer.** [`MainMenu.tsx`](../../packages/axoview-lib/src/components/MainMenu/MainMenu.tsx) currently mixes `New / Open / Clear canvas` (lifecycle) with `Settings` (system) with `GitHub / Version` (footer-class info) with `Export JSON / Compact / Image` (document actions). The app portals it into the top-left zone of [`AppToolbar.tsx`](../../packages/axoview-app/src/components/AppToolbar.tsx). Each item has a better natural home elsewhere; co-locating them under one icon hurts discoverability.

2. **The file-explorer toggle lives in the wrong region.** It's currently in the top-left of [`AppToolbar.tsx`](../../packages/axoview-app/src/components/AppToolbar.tsx), but it semantically opens a left-side navigation panel and belongs in the same strip as Elements + Layers — see [`LeftDock.tsx`](../../packages/axoview-lib/src/components/LeftDock/LeftDock.tsx). Industry convention (VS Code, Figma, Linear) co-locates all panel toggles in a single vertical activity strip.

3. **Future controls (text/node sizing, focus mode, annotation overlay, format toggles) need a reserved place.** Without a layout contract, every new toolbar control gets bolted on ad hoc, repeating the burger-junk-drawer pattern. We need named regions with stable ownership rules so future ADRs can say "this control goes in the View modes group" without re-litigating the layout.

This decision is purely about the **shell** — top toolbar, left strip, and where each class of control lives. Per-panel internals (file-tree controls, layers row controls, elements catalog) are out of scope; existing UX principles in [`docs/ux-principles.md`](../ux-principles.md) continue to govern those.

## Decision

The application chrome has four shells, each with a defined ownership rule. Any control that needs to be added in the future picks its shell + group based on its semantic class.

### 1. Top toolbar — three zones, only RIGHT is used

The diagram name is rendered on the canvas (existing behavior); the toolbar does not duplicate it. With no center anchor, LEFT and CENTER zones are intentionally empty. All controls collapse into the RIGHT zone, organized into four groups separated by dividers, ordered left → right:

> **Amendment 2026-05-19** — LEFT zone now carries a subtle brand mark: 18px favicon SVG + muted `Axoview` wordmark (body2, `text.secondary`). Non-interactive. Reads as a quiet header, does not compete with canvas diagram name. CENTER remains empty.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ TOP TOOLBAR                                                                  │
│                                                                              │
│  (LEFT empty)   (CENTER empty)         𝐀 ◐ │ 💾 [status] │ ⬇ 🔗 👁 │ ≡    │
│                                        ─┬─   ──────┬─────  ─┬─┬─┬─    │     │
│                                         │          │         │           │  │
│                                    Group 1     Group 2     Group 3   Group 4│
│                                    View         Save        Document  Sidebar│
│                                    modes        group       actions   toggle│
└─────────────────────────────────────────────────────────────────────────────┘
```

| Group | Owns | Members | Visibility |
|---|---|---|---|
| **1. View modes** | View/format toggles that change how the document is rendered or styled globally | `𝐀 Format` (text/node sizing), `◐ View` (focus mode, annotation overlay) | Reserved slot — buttons not rendered until their feature ADR ships. The position is locked; future ADRs add the controls here. |
| **2. Save group** | Save action and save state, read as a cohesive unit | `💾 Save` (session mode only, primary-tinted) + status cluster | Status cluster always visible. Save action visible only when `!serverStorageAvailable`. |
| **3. Document actions** | One-shot operations on the current diagram | `⬇ Export` (popover: JSON / Compact JSON / Image), `🔗 Share`, `👁 Preview` | Always rendered; Share/Preview disabled in session mode. |
| **4. Sidebar toggle** | Right Properties panel toggle | `≡` | Always visible in editable modes. |

**Status cluster contents:**
- Server mode: `saved 14:32` / `⟳ saving…` / `⚠ save failed [Retry]`
- Session mode: `unsaved •` (or `saved 14:32`) `· SESSION · 12% 0.6/5MB`. Background gets a faint warning tint to reinforce the "manual save needed" mode. The gauge chip stays clickable and opens the existing per-diagram breakdown popover (preserved from [`SessionStorageGauge.tsx`](../../packages/axoview-app/src/components/fileExplorer/SessionStorageGauge.tsx)).

**Save action and save state are visually adjacent.** The Save button sits flush against the status cluster in session mode so a user reads "💾 unsaved · SESSION · 12% 0.6/5MB" as one group. Action and state must be in the same visual cluster.

**Read-only URL mode** continues to hide all top-toolbar interactions except the read-only chip. No change to that behavior.

### 2. Left strip — two regions plus a system anchor

The strip is reorganized into named regions with a visual separator between them:

```
┌────┐
│ 📁 │  region: navigation (independent toggle)
├────┤  (region separator — 1px line, narrow)
│ ⊞  │  region: working panels (mutex pair)
│ ≣  │
│ ⋮  │  (mt: auto)
│ ⚙  │  system anchor
└────┘
```

| Position | Region | Members | Behavior |
|---|---|---|---|
| Top | **Navigation** | `📁 File Explorer` | Independent toggle. Co-occurs with one working panel. |
| Middle | **Working panels** | `⊞ Elements`, `≣ Layers` | Mutex pair — clicking one closes the other. Same mutex as today. |
| Bottom (`mt: auto`) | **System anchor** | `⚙ Settings` | Always visible; opens existing SettingsDialog. |

**Navigation + one working panel can be open simultaneously.** This preserves today's behavior — the current accidentally-correct two-panel pairing (file explorer + Elements/Layers) becomes the explicit contract.

**No accordion, no draggable splits.** Each panel renders as today; the only changes are which icons live in which region and the visual separator between regions.

### 3. Floating ToolMenu — unchanged

[`ToolMenu.tsx`](../../packages/axoview-lib/src/components/ToolMenu/ToolMenu.tsx) keeps its current contents (undo/redo, select/lasso/freehand-lasso/pan/connector, ISO↔2D toggle). Its purpose is *canvas-tool mode selection* — mutually exclusive states the user cycles between while editing. That is a different mental model from document-level actions and view modes, and it stays separated visually by living as a centered floating control over the canvas.

### 4. BottomDock — unchanged

[`BottomDock.tsx`](../../packages/axoview-lib/src/components/BottomDock/BottomDock.tsx) keeps its current right-aligned cluster (zoom controls + help). Reserved for future viewport-state controls (fit-to-view, minimap toggle).

### 5. Burger redistribution

The burger (`MainMenu` portal in AppToolbar) is removed from the application's chrome. The lib's `MainMenu` component remains for other consumers; the app simply stops portaling it.

| Item (was in burger) | New home |
|---|---|
| `New diagram` | Removed from toolbar. File tree handles diagram lifecycle in both modes. |
| `Open file` (load JSON) | Removed from toolbar. File tree's `Import` button covers this. |
| `Clear canvas` | Removed from toolbar. File tree handles deletion. |
| `Export JSON` / `Export Compact JSON` / `Export Image` | Top toolbar Group 3 — single `⬇ Export` button with popover listing all three formats. |
| `Settings` | Strip bottom — `⚙` icon, opens existing SettingsDialog. |
| `GitHub` link | SettingsDialog → new **About** tab. |
| `Version` | SettingsDialog → new **About** tab. |

### 5b. Panel-header toolbar visibility — hover-reveal (added 2026-05-15)

Panel headers (file explorer, Layers panel) host clusters of secondary actions — new file/folder/import/export/refresh/collapse on the file explorer, add-layer/delete-layer on Layers. These don't belong in the left strip (they're scoped to a panel, not document-level) but they crowd the panel header chrome when always visible.

**Rule:** secondary action clusters in a panel header are rendered with `opacity: 0`, fading in (`120ms ease`) on the panel container's `:hover` or `:focus-within`. They keep their DOM space — the cluster is invisible, not removed — so layout doesn't reflow on reveal. VS Code / Figma / Linear behave the same way.

Implementation pattern: parent panel container declares the reveal selector (`&:hover .ff-…-actions, &:focus-within .ff-…-actions { opacity: 1 }`); the action cluster sets the base opacity + transition. Keyboard focus on any cluster icon reveals via `:focus-within`, so the pattern is keyboard-accessible. mqa-results.md #27.

### 6. Settings dialog gains two tabs

To absorb redistributed burger items and to surface developer affordances that today live behind a dev-only prop, [`SettingsDialog.tsx`](../../packages/axoview-lib/src/components/SettingsDialog/SettingsDialog.tsx) adds:

- **About** tab — GitHub link, version string.
- **Diagnostics** tab — debug overlay toggle (writes `enableDebugTools` via `uiStateStore.actions.setEnableDebugTools`), model JSON dump (download current model), session storage dump (re-homed from the gauge popover; gauge keeps its per-diagram breakdown but the dump action lives only in Diagnostics).

This co-locates all developer/diagnostic gestures under one tab — no need to remember they're scattered across a hidden popover button and a build-time prop.

## Consequences

**Positive:**
- Each region has one ownership rule. Future toolbar additions are routed mechanically: text-formatting → View modes group; presentation/annotation → View modes group; new view filter → View modes group; collaboration cursor → status cluster; etc.
- Save action and save state become a unified visual group, eliminating the "save button on left, save status on right" split that confused the eye in earlier iterations.
- Burger junk-drawer debt resolved. GitHub/version stop competing for chrome real estate; Export becomes a one-click affordance.
- File-explorer toggle moves into the strip where users already look for navigation panel toggles. Aligns with VS Code / Figma / Linear conventions.
- The "navigation + working panel" pairing that worked accidentally today becomes the explicit contract. No new mental model to teach.
- Settings → Diagnostics tab makes the lib's existing `DebugUtils` overlay reachable from the app for the first time.

**Negative / risks:**
- Existing muscle memory shifts. Users who reach top-left for the burger will need to adapt; mitigated by the file-explorer toggle continuing to be visible (just in a different position) and by the Export button being more discoverable than the burger ever was.
- Tests and locale strings that reference the burger's `MAIN_MENU` portal targets will need updates.
- The lib's `MainMenu` component becomes unused in the app but remains exported. Lib consumers (if any) that rely on `mainMenuOptions` continue to work.
- New SettingsDialog tabs add three new locale-string clusters (× 14 languages each).

## Implementation notes (non-binding)

- **AppToolbar.tsx** restructured into `RIGHT`-only zone with four groups separated by `tb-divider`. LEFT and CENTER zones become empty `<Box>` placeholders (kept for grid alignment).
- A new `StatusCluster` component (or inline `<Box>`) bundles save state, SESSION pill, and storage gauge. Mode-aware via `serverStorageAvailable`. Existing [`SessionStorageGauge.tsx`](../../packages/axoview-app/src/components/fileExplorer/SessionStorageGauge.tsx) integrates inside it.
- A new `ExportPopover` component holds the three export options (replaces three separate burger items).
- `LeftDock.tsx` adds a `region` prop or simply a CSS-based separator between top and middle items, plus a `mt: auto` Settings button. The 📁 File Explorer toggle moves out of `AppToolbar.tsx` into here, wired to the existing `fileExplorerOpen` state in [`DiagramLifecycleProvider.tsx`](../../packages/axoview-app/src/providers/DiagramLifecycleProvider.tsx).
- `SettingsDialog.tsx` gains two tabs:
  - `About` renders GitHub link + `PACKAGE_VERSION` constant.
  - `Diagnostics` renders three controls: debug overlay toggle (drives `useUiStateStore.actions.setEnableDebugTools`), model dump button, session dump button.
- The app stops passing `mainMenuOptions` to `<Axoview>` (or passes `[]`), causing `MainMenu` to short-circuit (`if (mainMenuOptions.length === 0) return null;`). The portal `toolbarPortalTarget` becomes unused; the prop stays in the lib's API for backward compatibility.
- The diagram name is *not* added to the toolbar — the canvas already shows it via [`UiOverlay`'s VIEW_TITLE](../../packages/axoview-lib/src/components/UiOverlay/UiOverlay.tsx).
- View modes group (`𝐀 Format`, `◐ View`) renders no buttons in this phase. The position is reserved; future ADRs (formatting, presentation/annotation) add the buttons.
- Read-only URL mode rendering is unchanged — its branch in `AppToolbar` already short-circuits all interactive content.

## Acceptance criteria

- **Manual:**
  - Top toolbar in server mode shows: View-modes slot (empty) · status cluster (`saved 14:32`) · Export/Share/Preview · Properties toggle. No burger, no file-explorer toggle, no diagram name.
  - Top toolbar in session mode adds: 💾 Save button flush against status cluster; cluster shows `unsaved/saved · SESSION · gauge`; warning tint visible.
  - Left strip shows 📁 → separator → ⊞ ≣ → spacer → ⚙ from top to bottom.
  - Clicking 📁 opens the file explorer panel; clicking ⊞ opens Elements; both can be open simultaneously; clicking ≣ closes Elements and opens Layers.
  - Settings → About tab shows GitHub link + version.
  - Settings → Diagnostics tab → Debug overlay toggle on → `DebugUtils` overlay appears at canvas bottom-left; toggle off → it disappears.
  - Settings → Diagnostics → Session dump downloads the existing dump format.
  - Storage gauge in status cluster opens the existing per-diagram breakdown popover.
  - Export ⬇ popover offers JSON / Compact JSON / Image; each downloads correctly.
- **Unit / component:**
  - `SettingsDialog` test asserts About + Diagnostics tabs render.
  - `AppToolbar` snapshot/render test in both modes asserts the four-group structure.
  - Storage-gauge test continues to pass (no behavior change).
- **Build:** `yarn build` clean across all packages.
