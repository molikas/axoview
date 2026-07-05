import React from 'react';
import { useTheme } from '@mui/material/styles';
import { useCanvasMode } from 'src/contexts/CanvasModeContext';
import { useLabel } from 'src/hooks/useLabel';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { measureLabelChipOffscreen, LABEL_CHIP_RADIUS } from 'src/utils/labelChip';

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
  const theme = useTheme();
  const moving = useUiStateStore((s) => s.labelMove?.id === id);

  if (!label || moving) return null;

  const chip = measureLabelChipOffscreen(label);
  if (!chip) return null;

  const pos = getTilePosition({ tile: label.tile, origin: 'CENTER' });
  const cx = pos.x + (label.offset?.x ?? 0);
  const cy = pos.y + (label.offset?.y ?? 0);
  const PAD = 2;

  return (
    <div
      style={{
        position: 'absolute',
        left: cx - chip.chipW / 2 - PAD,
        top: cy - chip.chipH / 2 - PAD,
        width: chip.chipW + PAD * 2,
        height: chip.chipH + PAD * 2,
        border: `2px solid ${theme.palette.primary.main}`,
        borderRadius: LABEL_CHIP_RADIUS + PAD,
        boxSizing: 'border-box',
        pointerEvents: 'none'
      }}
    />
  );
};
