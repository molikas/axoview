import React from 'react';
import { useCanvasMode } from 'src/contexts/CanvasModeContext';
import { useLabel } from 'src/hooks/useLabel';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { TRANSFORM_CONTROLS_COLOR } from 'src/config';
import {
  measureLabelChipOffscreen,
  LABEL_CHIP_RADIUS
} from 'src/utils/labelChip';
import { getRenderedTilePosition } from 'src/utils/renderedGeometry';

interface Props {
  id: string;
}

// Selection feedback for a floating Label (ADR 0031). A Label is an upright
// billboard chip (not the iso text box), so the iso resize/selection box doesn't
// apply — the outline tracks the CHIP rect instead, screen-aligned, with no
// resize anchors (labels carry a first-class px font, sized via the strip).
// Lives in the TransformControlsManager SceneLayer (canvas-px coords), so its
// CSS transform follows pan/zoom for free. Hidden while the label is being
// move-dragged — the chip itself follows the pointer on the canvas.
export const LabelTransformControls = ({ id }: Props) => {
  const label = useLabel(id);
  const { getTilePosition } = useCanvasMode();
  const moving = useUiStateStore((s) => s.labelMove?.id === id);

  if (!label || moving) return null;

  const chip = measureLabelChipOffscreen(label);
  if (!chip) return null;

  const { x: cx, y: cy } = getRenderedTilePosition(
    label,
    getTilePosition,
    'CENTER'
  );
  const PAD = 2;

  return (
    <div
      style={{
        position: 'absolute',
        left: cx - chip.chipW / 2 - PAD,
        top: cy - chip.chipH / 2 - PAD,
        width: chip.chipW + PAD * 2,
        height: chip.chipH + PAD * 2,
        border: `2px solid ${TRANSFORM_CONTROLS_COLOR}`,
        borderRadius: LABEL_CHIP_RADIUS + PAD,
        // Same language as the shared selection ring: a 1px white contrast edge
        // so the accent survives on any chip colour, plus a soft accent glow.
        boxShadow:
          '0 0 0 1px rgba(255,255,255,0.85), 0 0 7px 2px rgba(3,146,255,0.3)',
        boxSizing: 'border-box',
        pointerEvents: 'none'
      }}
    />
  );
};
