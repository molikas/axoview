import { z } from 'zod';
import { id, coords, constrainedStrings } from './common';

// Floating Label — a first-class billboard chip (ADR 0031), peer to TextBox /
// Node / Connector / Rectangle. Extracted from the retired textBox
// `variant:'label'`: the iso-projection and per-character rich text are removed,
// leaving a plain-text chip with whole-chip styling. Rendered on Canvas2D
// (LabelsCanvas) ABOVE the node layer, so a label can sit over a node; an
// explicit `zIndex` orders labels within that layer. Model-only — unlike a
// TextBox it carries no scene-size entry: the Canvas2D layer and the DOM
// hit-proxy each measure the chip themselves, exactly like node labels.
export const labelSchema = z.object({
  id,
  // The plain text the chip displays; also the label's identity (Layers / info
  // popover). Whole-chip B/I/S lives in the style fields below — a Label has no
  // per-character rich text (ADR 0031 §3, the two-layer-formatting fix).
  text: constrainedStrings.description,
  tile: coords,
  // First-class font size in PX (absent = LABEL_BASE_FONT_PX). Replaces the
  // variant chip's `fontSize × 24` heuristic with a real px size.
  fontSize: z.number().optional(),
  // Chip text colour (absent = the theme's default chip text colour).
  color: z.string().optional(),
  // Chip background colour (absent = the default white chip).
  backgroundColor: z.string().optional(),
  // Whole-chip text style (ADR 0033 B/I/S field convention).
  isBold: z.boolean().optional(),
  isItalic: z.boolean().optional(),
  isStrikethrough: z.boolean().optional(),
  // Stacking order WITHIN the Label layer (send-to-front/back). Absent = 0.
  // Cross-layer order vs nodes is structural (the layer mounts above
  // NodesCanvas — ADR 0031 §2), not expressed here.
  zIndex: z.number().int().optional(),
  layerId: id.optional(),
  // Off-grid positioning (ADR 0023): a floating billboard can sit at a px
  // residual off its tile anchor. Absent/snapped = the tile centre. `tile`
  // stays an integer tile; `offset` is the unprojected px residual.
  offset: coords.optional(),
  snap: z.boolean().optional()
});
