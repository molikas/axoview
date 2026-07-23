import { z } from 'zod';
import { id, constrainedStrings, coords, ARRAY_MAX } from './common';
import { rectangleSchema } from './rectangle';
import { connectorSchema } from './connector';
import { textBoxSchema } from './textBox';
import { labelSchema } from './label';
import { layersSchema } from './layer';

export const viewItemSchema = z.object({
  id,
  tile: coords,
  // Signed vertical offset of the name label from the node (ADR 0024): positive
  // = above the node (legacy behaviour), negative = below it. Doubles as the
  // stalk length.
  labelHeight: z.number().optional(),
  // label* visual styling (size / colour / weight / show-hide) is edited on the
  // TOP-BAR style strip (ADR 0030 / 0034), not the right-hand deck — see the note
  // on modelItemSchema (modelItems.ts). All optional / lean-saved.
  labelFontSize: z.number().optional(),
  labelColor: z.string().optional(),
  labelBold: z.boolean().optional(),
  labelItalic: z.boolean().optional(),
  labelStrikethrough: z.boolean().optional(),
  // ADR 0034 O1 (2026-07-03): element-level underline joins the trio so the
  // strip's B/I/U/S cluster means the same thing on every label type. Optional
  // → zero-migration addition, ADR 0033 nearest-sibling naming.
  labelUnderline: z.boolean().optional(),
  showLabel: z.boolean().optional(),
  zIndex: z.number().int().optional(),
  layerId: id.optional(),
  // Off-grid positioning (ADR 0023). All optional/absent = today's behaviour
  // byte-for-byte. `offset` is a SceneLayer-px residual relative to the tile
  // anchor (the renderer applies it as a final translate AFTER projection); the
  // integer `tile` stays the engine's source of truth. `snap` (default true) =
  // false commits the px offset instead of rounding; `collides` (default true)
  // = false excludes the item from the TileIndex. Lean-save omits the defaults.
  offset: coords.optional(),
  snap: z.boolean().optional(),
  collides: z.boolean().optional(),
  // Per-node icon scale multiplier (ADR 0044). Optional / absent = fall back to
  // the shared icon asset's `scale` (icons[].scale), i.e. today's behaviour
  // byte-for-byte. When set it overrides icons[].scale for THIS node only,
  // driven by the on-canvas resize handles. Same hard bounds as icons[].scale.
  iconScale: z.number().min(0.1).max(3).optional()
});

export const viewSchema = z.object({
  id,
  lastUpdated: z.string().datetime().optional(),
  name: constrainedStrings.name,
  description: constrainedStrings.description.optional(),
  items: z.array(viewItemSchema).max(ARRAY_MAX.viewItems),
  rectangles: z.array(rectangleSchema).max(ARRAY_MAX.rectangles).optional(),
  connectors: z.array(connectorSchema).max(ARRAY_MAX.connectors).optional(),
  textBoxes: z.array(textBoxSchema).max(ARRAY_MAX.textBoxes).optional(),
  labels: z.array(labelSchema).max(ARRAY_MAX.labels).optional(),
  layers: layersSchema.optional()
});

export const viewsSchema = z.array(viewSchema);
