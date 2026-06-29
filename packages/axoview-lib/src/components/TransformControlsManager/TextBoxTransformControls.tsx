import React, { useMemo } from 'react';
import { getTextBoxEndTile } from 'src/utils';
import { useTextBox } from 'src/hooks/useTextBox';
import { TransformControls } from './TransformControls';

interface Props {
  id: string;
}

export const TextBoxTransformControls = ({ id }: Props) => {
  const textBox = useTextBox(id);

  const to = useMemo(() => {
    if (!textBox) return { x: 0, y: 0 };
    return getTextBoxEndTile(textBox, textBox.size);
  }, [textBox]);

  // A label is an upright billboard chip (not the iso text box), so the iso
  // resize/selection box doesn't apply — its selection outline lives on the chip.
  if (!textBox || textBox.variant === 'label') {
    return null;
  }

  return <TransformControls from={textBox.tile} to={to} />;
};
