import { z } from 'zod';
import { coords, id, constrainedStrings, NOTES_MAX_LENGTH, ARRAY_MAX } from './common';

export const connectorStyleOptions = ['SOLID', 'DOTTED', 'DASHED'] as const;
export const connectorLineTypeOptions = [
  'SINGLE',
  'DOUBLE',
  'DOUBLE_WITH_CIRCLE'
] as const;

export const connectorLabelSchema = z.object({
  id,
  text: constrainedStrings.description,
  position: z.number().min(0).max(100), // Percentage along the path (0-100)
  height: z.number().optional(), // Vertical offset
  line: z.enum(['1', '2']).optional(), // Which line for double line types (defaults to '1')
  showLine: z.boolean().optional(), // Show the dotted line connecting label to connector (defaults to true)
  // Font size in px. Max matches the strip's unified label range (10–40, ADR
  // 0030 / ADR 0034 §4) — the old 24 cap rejected sizes the strip itself wrote,
  // bricking the diagram on reload.
  fontSize: z.number().min(8).max(40).optional(),
  labelColor: z.string().optional(), // Text color (defaults to black)
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  strikethrough: z.boolean().optional(),
  // ADR 0034 O1 (2026-07-03): underline joins the trio (optional, zero-mig).
  underline: z.boolean().optional(),
  // External link (parity with node-label / connector headerLink, 2026-07-02).
  // When set, the label renders as a clickable link in view/read-only mode.
  headerLink: z.string().max(2048).optional()
});

export const anchorSchema = z.object({
  id,
  ref: z
    .object({
      item: id,
      anchor: id,
      tile: coords
    })
    .partial()
});

export const connectorSchema = z.object({
  id,
  name: z.string().max(200).optional(),
  notes: z.string().max(NOTES_MAX_LENGTH).optional(),
  headerLink: z.string().max(2048).optional(),
  showLabel: z.boolean().optional(),
  // Presentation of the primary `name` label (the Option-A midpoint label) so it
  // can be dragged / styled on canvas like a labels[] entry without being
  // promoted into labels[] (which would break its identity / F2 / Layers role).
  // All optional; absent = midpoint, on-line, default size/colour.
  nameLabelPosition: z.number().min(0).max(100).optional(),
  nameLabelHeight: z.number().optional(),
  nameLabelFontSize: z.number().min(8).max(40).optional(),
  nameLabelColor: z.string().optional(),
  nameLabelBold: z.boolean().optional(),
  nameLabelItalic: z.boolean().optional(),
  nameLabelStrikethrough: z.boolean().optional(),
  // Migration marker (2026-07-02, ADR 0032 connector amendment): once a load
  // has run seedConnectorLabel, this is `true`. It (a) makes the name→label seed
  // idempotent and (b) marks the connector as living in the decoupled model, so
  // `name` is identity-only (Layers-renamed, never drawn) and a later name edit
  // is never re-seeded into a canvas label.
  nameSeeded: z.boolean().optional(),
  // Legacy label fields (for backward compatibility)
  description: constrainedStrings.description.optional(),
  startLabel: constrainedStrings.description.optional(),
  endLabel: constrainedStrings.description.optional(),
  startLabelHeight: z.number().optional(),
  centerLabelHeight: z.number().optional(),
  endLabelHeight: z.number().optional(),
  // New flexible labels array
  labels: z.array(connectorLabelSchema).max(256).optional(),
  color: id.optional(),
  customColor: z.string().optional(), // For custom RGB colors
  width: z.number().optional(),
  style: z.enum(connectorStyleOptions).optional(),
  lineType: z.enum(connectorLineTypeOptions).optional(),
  showArrow: z.boolean().optional(),
  anchors: z.array(anchorSchema).max(ARRAY_MAX.connectorAnchors),
  layerId: id.optional()
});
