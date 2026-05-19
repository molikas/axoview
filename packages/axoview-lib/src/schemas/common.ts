import { z } from 'zod';

export const coords = z.object({
  x: z.number(),
  y: z.number()
});

export const id = z.string();
export const color = z.string();

export const NOTES_MAX_LENGTH = 50000;

export const constrainedStrings = {
  name: z.string().max(100),
  description: z.string().max(50000)
};
