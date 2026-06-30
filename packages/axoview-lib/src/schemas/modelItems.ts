import { z } from 'zod';
import { id, constrainedStrings, ARRAY_MAX } from './common';

export const modelItemSchema = z.object({
  id,
  // Identity string — shown/renamed in Layers, used for search; HIDDEN from the
  // canvas (ADR 0032 amendment 2026-06-30). The on-canvas text is `label`.
  name: constrainedStrings.name,
  // On-canvas label text (ADR 0032 amendment). Absent = fall back to `name` at
  // render; seeded `= name` at load so saved diagrams keep their visible text.
  // Optional → zero-migration addition on the unpushed branch.
  label: constrainedStrings.name.optional(),
  description: constrainedStrings.description.optional(),
  notes: z.string().optional(),
  headerLink: z.string().max(2048).optional(),
  link: z.string().max(256).optional(),
  icon: id.optional()
});

export const modelItemsSchema = z.array(modelItemSchema).max(ARRAY_MAX.modelItems);
