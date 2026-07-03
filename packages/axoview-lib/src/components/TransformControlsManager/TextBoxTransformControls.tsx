import React, { useMemo } from 'react';
import { getTextBoxEndTile } from 'src/utils';
import { useTextBox } from 'src/hooks/useTextBox';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { TransformControls } from './TransformControls';

interface Props {
  id: string;
}

export const TextBoxTransformControls = ({ id }: Props) => {
  const textBox = useTextBox(id);
  // While the box is in an on-canvas edit session the editor grows live with
  // the typed content but `size` only updates on commit — the dashed outline
  // would sit stale/contradicting the editor's own border. The editor outline
  // is the session's selection affordance (ADR 0034 addendum 2026-07-03).
  const isEditing = useUiStateStore((s) => s.editingTextBoxId === id);

  const to = useMemo(() => {
    if (!textBox) return { x: 0, y: 0 };
    return getTextBoxEndTile(textBox, textBox.size);
  }, [textBox]);

  if (!textBox || isEditing) {
    return null;
  }

  return <TransformControls from={textBox.tile} to={to} />;
};
