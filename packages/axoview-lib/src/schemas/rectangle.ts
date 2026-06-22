import { z } from 'zod';
import { id, coords } from './common';

export const rectangleSchema = z.object({
  id,
  name: z.string().max(200).optional(),
  color: id.optional(),
  customColor: z.string().optional(), // For custom RGB colors
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
