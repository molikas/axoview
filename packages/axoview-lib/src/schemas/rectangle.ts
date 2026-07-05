import { z } from 'zod';
import { id, coords, NOTES_MAX_LENGTH } from './common';

export const rectangleSchema = z.object({
  id,
  name: z.string().max(200).optional(),
  // Rich-text notes (2026-07-02) — parity with node/connector; every canvas
  // element can carry Notes. Optional → zero-migration addition.
  notes: z.string().max(NOTES_MAX_LENGTH).optional(),
  color: id.optional(),
  customColor: z.string().optional(), // For custom RGB colors
  // Border (frame) overrides. Absent = the legacy look: a 1px solid stroke in a
  // darker shade derived from the fill. Set via the top-bar style strip.
  borderColor: z.string().optional(),
  borderWidth: z.number().optional(),
  borderStyle: z.enum(['SOLID', 'DOTTED', 'DASHED']).optional(),
  // Fill + border opacity (0..1). Absent = 1 = fully opaque = the legacy look.
  // Rendered as SVG fill-opacity / stroke-opacity (declarative, GPU-cheap; the
  // same DOM feeds image export). Optional → zero-migration addition.
  fillOpacity: z.number().min(0).max(1).optional(),
  borderOpacity: z.number().min(0).max(1).optional(),
  from: coords,
  to: coords,
  // Stacking order AMONG rectangles (send-to-front/back). Absent = 0; higher
  // paints later (on top). Rectangles still paint structurally UNDER nodes/labels
  // (SceneLayer order); this only reorders rectangle-vs-rectangle. Mirrors the
  // Label/viewItem zIndex convention. Optional → zero-migration addition.
  zIndex: z.number().int().optional(),
  layerId: id.optional(),
  // Off-grid positioning (ADR 0023) — optional/absent = snapped. A single
  // unprojected-px `offset` translates both corners at render time; `from`/`to`
  // stay integer tiles. See viewItemSchema for the field semantics.
  offset: coords.optional(),
  snap: z.boolean().optional(),
  collides: z.boolean().optional()
});
