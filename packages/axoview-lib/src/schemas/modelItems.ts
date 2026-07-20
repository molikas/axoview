import { z } from 'zod';
import { id, constrainedStrings, ARRAY_MAX } from './common';

// A node's persisted model. NOTE: this is the data shape, NOT a panel spec.
// Styling — icon here, plus label colour/size/weight on the viewItem (views.ts)
// — is edited on the TOP-BAR style strip (ADR 0030 / 0034), never in the
// right-hand deck. The deck edits identity only: `label` (on-canvas text),
// `notes`, and `name`. Hanging a styling panel off these fields would recreate
// the retired monolithic node panel (color/font/icon/link/delete in one deck) —
// don't; that split is deliberate.
export const modelItemSchema = z.object({
  id,
  // Identity string — shown/renamed in Layers, used for search; HIDDEN from the
  // canvas (ADR 0032 amendment 2026-06-30). The on-canvas text is `label`.
  name: constrainedStrings.name,
  // On-canvas label text (ADR 0032 amendment). Absent = fall back to `name` at
  // render; seeded `= name` at load so saved diagrams keep their visible text.
  // Optional → zero-migration addition on the unpushed branch.
  label: constrainedStrings.name.optional(),
  // @deprecated legacy on-canvas "caption" (ADR 0032). Folded into `notes` at
  // load (foldNodeDescription) and never written by the UI; retained only so
  // old saved diagrams round-trip. Do not render it or add an editor for it.
  description: constrainedStrings.description.optional(),
  notes: z.string().optional(),
  headerLink: z.string().max(2048).optional(),
  link: z.string().max(256).optional(),
  icon: id.optional()
});

export const modelItemsSchema = z.array(modelItemSchema).max(ARRAY_MAX.modelItems);
