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

// Import-DoS guardrails (ADR 0029 / security-hardening follow-up). A crafted
// import with a multi-million-element array freezes the editor in O(N)
// validate + render before any content paints. These ceilings reject such a
// payload at parse time — surfaced to the user via useInitialDataManager's
// §6.3 notification path (a rejected import never loads silently). Each bound is
// ~an order of magnitude above any real diagram, so a genuine large diagram
// still loads; only weaponised arrays are rejected.
export const ARRAY_MAX = {
  modelItems: 50000,
  viewItems: 50000,
  rectangles: 50000,
  connectors: 50000,
  textBoxes: 50000,
  connectorAnchors: 1000
} as const;
