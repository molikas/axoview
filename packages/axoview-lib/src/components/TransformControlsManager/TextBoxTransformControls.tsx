import React, { useMemo, useCallback } from 'react';
import { getTextBoxEndTile } from 'src/utils';
import { useTextBox } from 'src/hooks/useTextBox';
import { useSceneActions } from 'src/hooks/useSceneActions';
import { useTranslation } from 'src/stores/localeStore';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { AnchorPosition, ProjectionOrientationEnum } from 'src/types';
import { TransformControls } from './TransformControls';

interface Props {
  id: string;
  // false on a locked layer: selection ring only, no resize/rotate handles
  // (see RectangleTransformControls — the "no direct edit on a locked layer"
  // invariant). Inline editing is already blocked on the gesture path.
  showHandles?: boolean;
}

export const TextBoxTransformControls = ({ id, showHandles = true }: Props) => {
  const textBox = useTextBox(id);
  const { updateTextBox } = useSceneActions();
  const { t } = useTranslation('topBarStyleControls');
  const uiStateActions = useUiStateStore((state) => state.actions);
  // During an edit session the editor publishes its live-measured footprint
  // (placeholder included while empty) — the dashed bounds track typing
  // instead of freezing at the last committed size (ADR 0034 addendum
  // 2026-07-04). Same store field drives the projected container in
  // TextBox.tsx, so bounds and box stay congruent.
  const previewSize = useUiStateStore((s) =>
    s.editingTextBoxId === id ? s.editingTextBoxSize : null
  );

  const to = useMemo(() => {
    if (!textBox) return { x: 0, y: 0 };
    return getTextBoxEndTile(textBox, previewSize ?? textBox.size);
  }, [textBox, previewSize]);

  const onAnchorMouseDown = useCallback(
    (key: AnchorPosition) => {
      uiStateActions.setMode({
        type: 'TEXTBOX.TRANSFORM',
        id,
        selectedAnchor: key,
        showCursor: true
      });
    },
    [id, uiStateActions]
  );

  // Quarter-turn = the iso-plane flip (a text box has exactly two
  // orientations, so ±90° are the same move). Replaces the strip's stranded
  // text-direction toggle (owner 2026-07-04: "de-dense the top control").
  // A plane flip changes which WORLD axis the run/row sizes mean — carrying a
  // manual size across read as a random big box, so it resets to auto.
  const onRotate = useCallback(() => {
    if (!textBox) return;
    updateTextBox(textBox.id, {
      orientation:
        textBox.orientation === ProjectionOrientationEnum.Y
          ? ProjectionOrientationEnum.X
          : ProjectionOrientationEnum.Y,
      width: undefined,
      height: undefined
    });
  }, [textBox, updateTextBox]);

  // Controls stay up DURING an edit session too (owner 2026-07-04, Lucid
  // parity — hiding them made place-and-type feel resize-less). The dashed
  // bounds show the last committed size; the promoted editor mounts ABOVE
  // this layer, so where an anchor overlaps the (often small) box the text
  // wins the click (caret placement), while each anchor's outer half sticks
  // out past the box edge and stays grabbable. Pressing one first commits the
  // session (the editor's capture-phase click-away fires before the anchor's
  // pointerdown), so a resize always starts from fresh bounds.
  if (!textBox) {
    return null;
  }

  // Full rectangle-style anchor set (ADR 0034 addendum 2026-07-04): run-axis
  // anchors set the wrap width, row-axis anchors the minimum height, corners
  // both — TransformTextBox maps each anchor per orientation.
  return (
    <TransformControls
      from={textBox.tile}
      to={to}
      onAnchorMouseDown={showHandles ? onAnchorMouseDown : undefined}
      onRotate={showHandles ? onRotate : undefined}
      rotateTooltip={t('rotate90')}
      offset={textBox.offset}
    />
  );
};
