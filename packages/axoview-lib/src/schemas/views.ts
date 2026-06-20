import { z } from 'zod';
import { id, constrainedStrings, coords } from './common';
import { rectangleSchema } from './rectangle';
import { connectorSchema } from './connector';
import { textBoxSchema } from './textBox';
import { layersSchema } from './layer';

export const viewItemSchema = z.object({
  id,
  tile: coords,
  // Signed vertical offset of the name label from the node (ADR 0024): positive
  // = above the node (legacy behaviour), negative = below it. Doubles as the
  // stalk length.
  labelHeight: z.number().optional(),
  labelFontSize: z.number().optional(),
  labelColor: z.string().optional(),
  showLabel: z.boolean().optional(),
  zIndex: z.number().int().optional(),
  layerId: id.optional()
});

export const viewSchema = z.object({
  id,
  lastUpdated: z.string().datetime().optional(),
  name: constrainedStrings.name,
  description: constrainedStrings.description.optional(),
  items: z.array(viewItemSchema),
  rectangles: z.array(rectangleSchema).optional(),
  connectors: z.array(connectorSchema).optional(),
  textBoxes: z.array(textBoxSchema).optional(),
  layers: layersSchema.optional()
});

export const viewsSchema = z.array(viewSchema);
