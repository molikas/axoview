# Connector parity slice — decouple name↔label + connector-label links

> **Cold-start brief (2026-07-02).** Bring connectors to parity with the node
> S2 decouple. Two interdependent parts (#3 decouple, #4 label links), one
> slice. Owner decisions are **locked** (below). Branch `integration`, do NOT
> ship to master. Commit per part; add tests; keep the seed idempotent.

## Owner decisions (locked)
- **Decouple** connector `name` from the on-canvas label, exactly like the node
  S2 decouple ([ADR 0032](../adr/0032-node-name-caption-label-model.md) amendment).
- `name` becomes **identity only**, edited in the **Layers panel only** (like a
  node's `name` post-S2). Hidden from the canvas.
- On-canvas text = the connector's `labels[]` entries.
- **F2 on a selected connector = add a new label at the midpoint AND immediately
  inline-edit it** (type text, Enter commits).
- **Seed** each existing connector's `name` into a `labels[]` entry at load, so
  diagrams keep their visible text. Zero-migration addition on the unpushed branch.
- **#4:** adding a link to a connector label works the same as node-label links.

## Current model (verified)
- `connectorSchema` (`schemas/connector.ts`): `name` (identity, max 200),
  `headerLink` (whole-connector link, already exists), `showLabel`, and
  `nameLabel*` fields (`nameLabelPosition/Height/FontSize/Color/Bold/Italic/
  Strikethrough`) that style the **synthetic** name label. Plus `labels[]`
  (`connectorLabelSchema`: id, text, position 0–100, height, line, showLine,
  fontSize, labelColor, bold/italic/strikethrough — **no headerLink yet**).
- The on-canvas name is a **synthetic `__name__` label** assembled in
  [`ConnectorLabel.tsx:382-395`](../../packages/axoview-lib/src/components/SceneLayers/ConnectorLabels/ConnectorLabel.tsx#L382-L395)
  from `name` + `nameLabel*`, prepended to `getConnectorLabels(connector)`
  (`utils/connectorLabels.ts`). `showLabel` gates it.
- Strip already resolves a selected connector label via `selectedConnectorLabel`
  → `isNameLabel` (`__name__`) / `activeLabel` (a `labels[]` entry) in
  `TopBarStyleControls.tsx`.

## Part A — #3 decouple (do first)
1. **Stop rendering the synthetic name label.** In `ConnectorLabel.tsx`, return
   `baseLabels` only (drop the `__name__` synthetic prepend). `name` no longer
   draws. Keep the `nameLabel*` fields in the schema for round-trip.
2. **Seed util** `utils/seedConnectorLabel.ts` (mirror `seedNodeLabel.ts`):
   pure + **idempotent**. For a connector with a non-empty `name` and no seed
   marker, push a `labels[]` entry `{ id: generateId(), text: name, position:
   nameLabelPosition ?? 50, height: nameLabelHeight ?? 0, fontSize:
   nameLabelFontSize, labelColor: nameLabelColor, bold/italic/strikethrough:
   nameLabel* }` and set an explicit **`nameSeeded: true`** marker (add
   `nameSeeded: z.boolean().optional()` to `connectorSchema`). Idempotent via the
   flag. Wire it in `useInitialDataManager` right after `foldNodeDescription` /
   `seedNodeLabel`, mapping over each view's connectors. NB new connectors have
   **no** `name` (createConnectorAt doesn't set one), so the seed only touches
   existing ones.
3. **F2 = add label + inline-edit** (owner pick). The F2 dispatcher
   (`useInteractionManager.ts:~390` `inlineEditNodeName`) currently fires for
   CONNECTOR too, editing the name via `ConnectorLabel.commitName`. Change the
   CONNECTOR F2 path to: `scene.updateConnector(id, { labels: [...labels, {id,
   text:'', position:50}] })` then enter inline rename on that new label (reuse
   the ConnectorLabel inline-edit machinery keyed on the new label id). Remove
   the old name-edit-on-F2 behaviour.
4. **Name → Layers only.** Verify the Layers row renames a connector's `name`
   (it should — same row machinery as nodes). Remove any connector **Details**
   "Name"/on-canvas-name editing that now conflicts (check
   `ConnectorControls.tsx`); the connector Details panel should manage labels,
   not draw `name` on canvas. Mirror the S2 NodeInfoTab treatment.
5. **ADR:** add a dated amendment to ADR 0032 (or a short connector note) —
   "connector name↔label decouple, F2 adds a label, seed name→label."
6. **Tests:** seed idempotency unit (seed once, re-run no-op, no dup labels);
   render-source (name not drawn; labels[] drawn); F2-adds-label e2e (F2 on a
   connector → new label + editing); a seeded-existing-connector round-trip.

## Part B — #4 connector-label links
1. Add `headerLink: z.string().max(2048).optional()` to `connectorLabelSchema`.
   Exempt it from any `Required<Omit>` default (search `CONNECTOR_LABEL` defaults).
2. Render a connector label as a clickable link in **view mode** when it has a
   `headerLink` (mirror the node label `<a>` in `Node.tsx`; the connector label
   is DOM in `ConnectorLabel.tsx`, so this is a straight `<a>` wrap +
   `OpenInNewIcon` — the label already shows a link icon when `linkActive`).
3. **Strip Link control:** when a connector **label** is the active target
   (`activeLabel`), the strip's Link control should write that label's
   `headerLink` (via `updateActiveLabel({ headerLink })`), not the connector's.
   The nameLabel (`isNameLabel`) is gone after the decouple; the whole-connector
   `headerLink` control still applies when the connector itself (no label) is
   selected. Wire `linkValue`/`onLinkChange` to include the `activeLabel` branch.
4. Surface the label link in the view popover if desired (optional; connectors
   already surface `headerLink` there).
5. **Tests:** connectorLabel schema headerLink round-trip; strip writes the
   active label's link; e2e link on a connector label.

## Guardrails
- Perf: connector labels are DOM (not the Canvas2D hot path) — no ADR 0020 gate.
- Keep the seed isolated + idempotent so the zero-migration claim is verifiable.
- One commit per part; unit + e2e each. Don't land red.
