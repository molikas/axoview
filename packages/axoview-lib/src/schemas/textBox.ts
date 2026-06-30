import { z } from 'zod';
import { ProjectionOrientationEnum } from 'src/types/common';
import { id, coords, constrainedStrings } from './common';

export const textBoxSchema = z.object({
  id,
  name: z.string().max(200).optional(),
  tile: coords,
  content: constrainedStrings.description,
  fontSize: z.number().optional(),
  color: z.string().optional(),
  isBold: z.boolean().optional(),
  isItalic: z.boolean().optional(),
  isUnderline: z.boolean().optional(),
  orientation: z
    .union([
      z.literal(ProjectionOrientationEnum.X),
      z.literal(ProjectionOrientationEnum.Y)
    ])
    .optional(),
  layerId: id.optional(),
  // Off-grid positioning (ADR 0023) — optional/absent = snapped. See
  // viewItemSchema for the field semantics; `tile` stays an integer tile.
  offset: coords.optional(),
  snap: z.boolean().optional(),
  collides: z.boolean().optional()
});
