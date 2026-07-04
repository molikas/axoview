import { z } from 'zod';
import { ProjectionOrientationEnum } from 'src/types/common';
import { id, coords, constrainedStrings, NOTES_MAX_LENGTH } from './common';

export const textBoxSchema = z.object({
  id,
  name: z.string().max(200).optional(),
  // Rich-text notes (2026-07-02) — parity across all canvas elements. The
  // `content` field is the on-canvas text; `notes` is separate metadata.
  notes: z.string().max(NOTES_MAX_LENGTH).optional(),
  tile: coords,
  content: constrainedStrings.description,
  fontSize: z.number().optional(),
  // Line-spacing multiplier (ADR 0034 addendum 2026-07-03); absent = the
  // TEXTBOX_LINE_HEIGHT default. Deliberately unbounded like fontSize — a
  // schema cap tighter than what the strip can write bricks saved diagrams
  // on reload (the connector-label fontSize S1).
  lineHeight: z.number().optional(),
  // Manual size in tile units (ADR 0034 addendum 2026-07-03, Lucid parity):
  // absent = auto. width: box hugs the widest line, never soft-wraps;
  // present = fixed width set by anchor resize — text wraps, height grows.
  // height: a MINIMUM box height (content still grows past it — text never
  // clips). Unbounded for the same reason as fontSize/lineHeight.
  width: z.number().optional(),
  height: z.number().optional(),
  // Box fill behind the text (ADR 0034 addendum 2026-07-04); absent =
  // transparent (today's look). Naming follows the floating-Label sibling.
  backgroundColor: z.string().optional(),
  // Vertical alignment of the content inside the box footprint (ADR 0034
  // addendum 2026-07-04) — meaningful once a manual height makes the box
  // taller than its content. Absent = top.
  verticalAlign: z
    .union([z.literal('top'), z.literal('middle'), z.literal('bottom')])
    .optional(),
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
