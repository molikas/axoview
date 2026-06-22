import { z } from 'zod';

// Reject NaN / ±Infinity. Every legitimate position (integer tile base, or the
// ADR 0023 sub-tile px offset) is finite; a non-finite coord in an imported or
// pasted diagram poisons the TileIndex / projection math and renders the scene
// off-screen or blank. `.finite()` is a pure-safety bound — no valid diagram
// carries a non-finite coordinate.
export const coords = z.object({
  x: z.number().finite(),
  y: z.number().finite()
});

export const id = z.string();

export const NOTES_MAX_LENGTH = 50000;

export const constrainedStrings = {
  name: z.string().max(100),
  description: z.string().max(50000)
};
