import {
  resolveLabelPlacement,
  resolveDraggedOffset,
  clampLabelOffset,
  LABEL_OFFSET_MIN,
  LABEL_OFFSET_MAX
} from '../labelPosition';

describe('labelPosition', () => {
  describe('resolveLabelPlacement', () => {
    it('places the chip ABOVE for a positive offset (legacy behaviour)', () => {
      const p = resolveLabelPlacement(50, 'BOTTOM');
      expect(p.isBelow).toBe(false);
      expect(p.showStalk).toBe(true);
      expect(p.stalkTop).toBe(-50);
      expect(p.stalkLength).toBe(50);
      expect(p.chipTop).toBe(-50);
      expect(p.chipTranslateY).toBe('-100%');
      expect(p.transformOrigin).toBe('bottom center');
    });

    it('uses a -50% translate for the CENTER (connector-label) direction', () => {
      expect(resolveLabelPlacement(50, 'CENTER').chipTranslateY).toBe('-50%');
    });

    it('places the chip BELOW for a negative offset and flips the origin', () => {
      const p = resolveLabelPlacement(-30, 'BOTTOM');
      expect(p.isBelow).toBe(true);
      expect(p.showStalk).toBe(true);
      expect(p.stalkTop).toBe(0);
      expect(p.stalkLength).toBe(30);
      expect(p.chipTop).toBe(30);
      expect(p.chipTranslateY).toBe('0%');
      // Origin flips so the counter-scale holds the (top) attachment point fixed.
      expect(p.transformOrigin).toBe('top center');
    });

    it('draws no stalk at exactly zero offset', () => {
      const p = resolveLabelPlacement(0, 'BOTTOM');
      expect(p.showStalk).toBe(false);
      expect(p.stalkLength).toBe(0);
      expect(p.isBelow).toBe(false);
    });
  });

  describe('clampLabelOffset', () => {
    it('clamps to the offset bounds', () => {
      expect(clampLabelOffset(99999)).toBe(LABEL_OFFSET_MAX);
      expect(clampLabelOffset(-99999)).toBe(LABEL_OFFSET_MIN);
      expect(clampLabelOffset(40)).toBe(40);
    });
  });

  describe('resolveDraggedOffset', () => {
    it('lowers the label as the pointer drags down (canvas px = screen / zoom)', () => {
      // start 40 above, drag down 40 screen px at zoom 1 → 0 (at the node).
      expect(
        resolveDraggedOffset({ startOffset: 40, pointerDeltaScreenY: 40, zoom: 1 })
      ).toBe(0);
    });

    it('crosses zero into below-node placement', () => {
      // drag down past the node → negative offset (below).
      expect(
        resolveDraggedOffset({ startOffset: 10, pointerDeltaScreenY: 60, zoom: 1 })
      ).toBe(-50);
    });

    it('scales the screen delta by 1/zoom', () => {
      // at zoom 0.5 a 40px screen drag is an 80px canvas move.
      expect(
        resolveDraggedOffset({ startOffset: 40, pointerDeltaScreenY: 40, zoom: 0.5 })
      ).toBe(-40);
    });

    it('clamps to the lower offset bound', () => {
      expect(
        resolveDraggedOffset({
          startOffset: 0,
          pointerDeltaScreenY: 100000,
          zoom: 1
        })
      ).toBe(LABEL_OFFSET_MIN);
    });

    it('is a no-op for a degenerate zoom', () => {
      expect(
        resolveDraggedOffset({ startOffset: 40, pointerDeltaScreenY: 40, zoom: 0 })
      ).toBe(40);
    });
  });
});
