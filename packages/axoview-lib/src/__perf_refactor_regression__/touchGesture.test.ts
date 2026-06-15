/**
 * ADR 0018 — touch tap-vs-pan classifier (the one pure unit of the touch layer).
 *
 * Direct manipulation (Option A) decides by what is under the finger at
 * pointerdown and forwards the gesture to the existing mouse modes, so the rest
 * of the touch machine is DOM/pointer-capture dependent and covered by the e2e
 * touch project. The pixel slop classifier — shared by the mouse drag-start
 * (Cursor) and the touch tap-vs-pan branch — stays unit-tested here.
 */

import { TAP_SLOP_PX, exceedsTapSlop } from 'src/config/tapGesture';

describe('tapGesture pixel slop classifier (ADR 0018 Decision 5)', () => {
  it('a sub-slop delta is a tap (independent of tile size)', () => {
    expect(exceedsTapSlop({ x: 0, y: 0 }, { x: 5, y: 5 })).toBe(false); // ~7.07px
  });

  it('a delta beyond the slop radius is a drag/pan', () => {
    expect(exceedsTapSlop({ x: 0, y: 0 }, { x: TAP_SLOP_PX + 2, y: 0 })).toBe(
      true
    );
  });

  it('is radial (diagonal travel counts)', () => {
    // 6,6 → ~8.49px > 8 slop.
    expect(exceedsTapSlop({ x: 0, y: 0 }, { x: 6, y: 6 })).toBe(true);
  });

  it('respects an explicit slop override', () => {
    expect(exceedsTapSlop({ x: 0, y: 0 }, { x: 12, y: 0 }, 20)).toBe(false);
    expect(exceedsTapSlop({ x: 0, y: 0 }, { x: 25, y: 0 }, 20)).toBe(true);
  });
});
