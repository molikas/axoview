// Touch / pen gesture thresholds (ADR 0018 Decision 5). Pixel-based, NOT
// tile-based — a tile-based threshold swallowed sub-tile trackpad drags (the
// `pointerType:'mouse'` precision-touchpad bug). These apply to ALL pointer
// types: a press that lifts within TAP_SLOP_PX (and TAP_TIME_MS) is a tap;
// beyond it, a drag/pan.
//
// In a config module (mirroring config/hotkeys.ts), not inline constants, so the
// thresholds are tunable in one place.

import { Coords } from 'src/types';

/** Max screen-pixel travel between pointerdown and pointerup for a tap. */
export const TAP_SLOP_PX = 8;

/** Max duration (ms) between pointerdown and pointerup for a tap. */
export const TAP_TIME_MS = 500;

/**
 * True when the pointer has travelled beyond the tap slop radius — i.e. the
 * gesture is a drag/pan, not a tap. Pure + zoom-independent (operates on raw
 * screen pixels), so it is the single drag-start classifier for every mode.
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

/**
 * True when a press qualifies as a tap: it stayed within the slop radius AND
 * lifted within the time limit. Pure + unit-testable (ADR 0018 acceptance
 * criteria).
 */
export const isTapGesture = (args: {
  downScreen: Coords;
  upScreen: Coords;
  downTime: number;
  upTime: number;
  slop?: number;
  timeMs?: number;
}): boolean => {
  const slop = args.slop ?? TAP_SLOP_PX;
  const timeMs = args.timeMs ?? TAP_TIME_MS;
  if (exceedsTapSlop(args.downScreen, args.upScreen, slop)) return false;
  return args.upTime - args.downTime <= timeMs;
};
