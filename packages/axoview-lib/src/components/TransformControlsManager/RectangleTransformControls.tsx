import React, { useCallback } from 'react';
import { useRectangle } from 'src/hooks/useRectangle';
import { useSceneActions } from 'src/hooks/useSceneActions';
import { useTranslation } from 'src/stores/localeStore';
import { AnchorPosition } from 'src/types';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { TransformControls } from './TransformControls';

interface Props {
  id: string;
  // false on a locked layer: render the selection ring only, no resize/rotate
  // handles (matches the codebase-wide "no direct edit on a locked layer"
  // invariant; industry parity — draw.io / PowerPoint / Canva).
  showHandles?: boolean;
}

export const RectangleTransformControls = ({ id, showHandles = true }: Props) => {
  const rectangle = useRectangle(id);
  const { updateRectangle } = useSceneActions();
  const { t } = useTranslation('topBarStyleControls');
  const uiStateActions = useUiStateStore((state) => {
    return state.actions;
  });

  const onAnchorMouseDown = useCallback(
    (key: AnchorPosition) => {
      if (!rectangle) return;
      uiStateActions.setMode({
        type: 'RECTANGLE.TRANSFORM',
        id: rectangle.id,
        selectedAnchor: key,
        showCursor: true
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional fine-grained dep on rectangle?.id; whole rectangle over-invalidates
    [rectangle?.id, uiStateActions]
  );

  // Quarter-turn (owner 2026-07-04, Lucid parity): transpose the footprint
  // about its center — width and height swap, the middle stays put. A square
  // is a fixpoint (skip the no-op write so it doesn't pollute undo).
  const onRotate = useCallback(() => {
    if (!rectangle) return;
    const minX = Math.min(rectangle.from.x, rectangle.to.x);
    const maxX = Math.max(rectangle.from.x, rectangle.to.x);
    const minY = Math.min(rectangle.from.y, rectangle.to.y);
    const maxY = Math.max(rectangle.from.y, rectangle.to.y);
    const spanX = maxX - minX;
    const spanY = maxY - minY;
    if (spanX === spanY) return;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const newMin = {
      x: Math.round(cx - spanY / 2),
      y: Math.round(cy - spanX / 2)
    };
    updateRectangle(rectangle.id, {
      from: newMin,
      to: { x: newMin.x + spanY, y: newMin.y + spanX }
    });
  }, [rectangle, updateRectangle]);

  if (!rectangle) {
    return null;
  }

  return (
    <TransformControls
      from={rectangle.from}
      to={rectangle.to}
      onAnchorMouseDown={showHandles ? onAnchorMouseDown : undefined}
      onRotate={showHandles ? onRotate : undefined}
      rotateTooltip={t('rotate90')}
    />
  );
};
