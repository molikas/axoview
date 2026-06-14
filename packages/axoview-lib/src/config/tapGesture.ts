// Touch / pen + trackpad gesture threshold (ADR 0018 Decision 5). Pixel-based,
// NOT tile-based — a tile-based threshold swallowed sub-tile trackpad drags (the
// `pointerType:'mouse'` precision-touchpad bug). A press that lifts within
// TAP_SLOP_PX is a tap; beyond it, a drag/pan.
//
// In a config module (mirroring config/hotkeys.ts), not inline constants, so the
// threshold is tunable in one place.

import { Coords } from 'src/types';

/** Max screen-pixel travel between pointerdown and pointerup for a tap. */
export const TAP_SLOP_PX = 8;

/**
 * True when the pointer has travelled beyond the tap slop radius — i.e. the
 * gesture is a drag/pan, not a tap. Pure + zoom-independent (operates on raw
 * screen pixels), so it is the single drag-start classifier for every mode
 * (mouse drag-start in Cursor, and touch tap-vs-pan in the gesture machine).
 */
export const exceedsTapSlop = (
  from: Coords,
  to: Coords,
  slop: number = TAP_SLOP_PX
): boolean => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return dx * dx + dy * dy > slop * slop;
};
