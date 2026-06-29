import { z } from 'zod';
import { id, coords } from './common';

export const rectangleSchema = z.object({
  id,
  name: z.string().max(200).optional(),
  color: id.optional(),
  customColor: z.string().optional(), // For custom RGB colors
  // Border (frame) overrides. Absent = the legacy look: a 1px solid stroke in a
  // darker shade derived from the fill. Set via the top-bar style strip.
  borderColor: z.string().optional(),
  borderWidth: z.number().optional(),
  borderStyle: z.enum(['SOLID', 'DOTTED', 'DASHED']).optional(),
  from: coords,
  to: coords,
  layerId: id.optional(),
  // Off-grid positioning (ADR 0023) — optional/absent = snapped. A single
  // unprojected-px `offset` translates both corners at render time; `from`/`to`
  // stay integer tiles. See viewItemSchema for the field semantics.
  offset: coords.optional(),
  snap: z.boolean().optional(),
  collides: z.boolean().optional()
});
