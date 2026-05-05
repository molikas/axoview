# ADR 0004 — Connector Name and Details Panel Parity

**Status:** Proposed
**Date:** 2026-05-03
**Supersedes:** none
**Superseded by:** none

## Context

Today the connector model in [packages/fossflow-lib/src/schemas/connector.ts](../../packages/fossflow-lib/src/schemas/connector.ts) has no notion of a primary "name." Identification on the canvas relies on the `labels[]` array (up to 256 positioned label entries per connector — see [packages/fossflow-lib/src/components/ItemControls/ConnectorControls/ConnectorControls.tsx](../../packages/fossflow-lib/src/components/ItemControls/ConnectorControls/ConnectorControls.tsx)). Practically, users type one label and never use the rest; the multi-label surface is power-user territory that most users do not reach for.

Nodes do the opposite: a node's `name` is the canonical identifier. F2 inline-rename works on it ([packages/fossflow-lib/src/components/SceneLayers/Nodes/Node/Node.tsx](../../packages/fossflow-lib/src/components/SceneLayers/Nodes/Node/Node.tsx)), the right-side panel is tabbed Details/Style/Notes ([NodePanel.tsx](../../packages/fossflow-lib/src/components/ItemControls/NodeControls/NodePanel/NodePanel.tsx)), and an empty `name` hides the canvas label entirely.

The asymmetry forces users to learn two different mental models for "the thing on the canvas." It also blocks F2-rename for connectors and prevents notes-on-connector, which is a natural extension of the node parity work.

This ADR makes connectors a first-class peer of nodes for the *name → canvas label → F2 rename* triangle, while preserving the existing multi-label feature for users who already rely on it.

## Decision

Add two fields to `connectorSchema`:

```ts
{
  // existing fields...
  name?: string,    // primary identifier; renders as canvas label when non-empty
  notes?: string    // rich-text HTML, same shape and constraints as ModelItem.notes
}
```

### Rendering rules

- The connector's `name`, when non-empty, is rendered as a **single label at the path midpoint** (position 50, line '1') by [ConnectorLabel.tsx](../../packages/fossflow-lib/src/components/SceneLayers/ConnectorLabels/ConnectorLabel.tsx) using the same `<Label>` component the existing per-position labels use.
- An empty or whitespace-only `name` hides the canvas name label entirely — mirroring node behaviour where empty `modelItem.name` hides the node label.
- `labels[]` continues to render as before. The name label and entries in `labels[]` coexist on the canvas; users opting in to multi-label keep their layout. Visual conflict (a `labels[]` entry near position 50) is acceptable — `labels[]` is treated as the "advanced" surface.

### F2 inline-rename

[packages/fossflow-lib/src/interaction/useInteractionManager.ts](../../packages/fossflow-lib/src/interaction/useInteractionManager.ts) extends the existing F2 dispatch to include `CONNECTOR` selections. The same `inlineEditNodeName` `CustomEvent` is reused (the event name is intentionally retained for symmetry rather than introducing a parallel `inlineEditConnectorName`). The connector's name label listens for the event by id.

### Right-sidebar panel

[ConnectorControls.tsx](../../packages/fossflow-lib/src/components/ItemControls/ConnectorControls/ConnectorControls.tsx) is restructured into a tabbed panel matching `NodePanel`:

- **Details** — Name (TextField, F2-focusable), Additional labels (current Add Label / position / line / height / font size / color / show line — verbatim, just relocated).
- **Style** — Line Color, Width, Line Style, Line Type, Show Arrow, Delete button.
- **Notes** — `RichTextEditor` bound to `connector.notes`.

The "Details" tab name is what `NodePanel` calls its first tab — preserving the contract documented in [docs/architecture.md](../../docs/architecture.md). The Notes tab title gains a primary-coloured asterisk/dot when notes are non-empty, mirroring `NodePanel`'s `notesModified` style.

### Backward compatibility

`name` and `notes` are optional. Existing diagrams load unchanged. The first time a user types into the new Name field, only `name` is mutated — `labels[]` is not touched. Saved diagrams without a `name` continue to render exactly as today.

No migration of existing `labels[]` content into `name` runs at load time. The user can manually copy the text if they want it promoted; doing this automatically would risk silently dropping label-position metadata.

## Consequences

**Positive:**
- Connectors gain F2-rename, single-name canvas label, and a Notes tab — full parity with nodes.
- Right-sidebar UX is consistent: every selectable item type now uses the Details/Style/Notes tabbed shape.
- Net-new users learn one mental model instead of two.

**Negative / risks:**
- Two label surfaces (`name` and `labels[]`) coexist. Power users who set both can produce visual overlap at position ~50; mitigated by treating `labels[]` as advanced and documenting the rule.
- Connector model gains two optional fields that must be persisted through every write path (server save, session save, export JSON, project zip). Lean-save (ADR 0003) needs no change — these are top-level connector fields, not part of the icon catalog.
- The Style tab in the new layout buries the Delete button below color/width/style/type — slightly less discoverable than the bottom-of-flat-panel position today. Mitigated by keeping it in Style (where node Style tab also has destructive controls) rather than scattering it.

## Implementation notes (non-binding)

- Connector schema: append `name: z.string().max(200).optional()` and `notes: z.string().max(NOTES_MAX_LENGTH).optional()` to [connector.ts](../../packages/fossflow-lib/src/schemas/connector.ts). Reuse the same `NOTES_MAX_LENGTH` constant nodes use.
- Render the name label by extending `ConnectorLabel.tsx` to compose a synthetic label `{ id: '__name__', text: name, position: 50, line: '1', height: 0 }` when `connector.name?.trim()` is non-empty, prepended to `labels`. Skip the name label entirely if `labels[]` already contains an entry near position 50 — no, *don't* — coexistence is fine; spec says they are allowed to overlap.
- F2 dispatch: in `useInteractionManager.ts` the `e.key === 'F2'` branch, allow `ctrl?.type === 'CONNECTOR'` in addition to `'ITEM' | 'TEXTBOX'`.
- Inline edit on canvas: connector name listener can live in `ConnectorLabel.tsx` (or a new `ConnectorNameLabel.tsx` if cleaner) — it must commit `name` via `useScene().updateConnector`, Enter to commit, Escape to cancel.
- `ConnectorControls.tsx`: reorganise into the tabbed shape used by `NodePanel`. The `TabPanel` helper there is small enough to either extract to `src/components/ItemControls/components/TabPanel.tsx` or duplicate inline — extraction is preferable to keep the two panels in lock-step visually.
- Notes locale strings: reuse `nodePanel.notes` / `nodePanel.notesModified` for connector — but only if no other locale strings collide. Otherwise add `connectorControls.notes` etc. to all locales (the existing locales already have `connectorControls` keys).

## Acceptance criteria

- **Unit test:** `connectorSchema.safeParse({ id, anchors, name: 'X' }).success === true`; with `name` over 200 chars → fails.
- **Unit test:** `connectorSchema.safeParse({ id, anchors, notes: '<p>x</p>' }).success === true`.
- **Unit test:** Round-trip save/load of a connector with `name` and `notes` preserves both fields verbatim.
- **Manual verification:** Select a connector, press F2 → an inline edit cursor appears on the canvas at the connector midpoint. Enter commits, Escape cancels.
- **Manual verification:** Empty `name` (whitespace only) hides the canvas name label; non-empty shows it.
- **Manual verification:** Right sidebar for a selected connector shows three tabs (Details / Style / Notes); Style tab has Delete; Notes tab title gains a dot/asterisk when notes are non-empty.
- **Manual verification:** A connector with both `name` and entries in `labels[]` renders both — no automatic deduplication, no migration of `labels[0].text` into `name`.
