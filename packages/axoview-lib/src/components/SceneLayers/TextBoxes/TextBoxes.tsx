import React, { memo, useMemo } from 'react';
import { useScene } from 'src/hooks/useScene';
import { useLayerContext } from 'src/hooks/useLayerContext';
import { TextBox } from './TextBox';

interface Props {
  textBoxes: ReturnType<typeof useScene>['textBoxes'];
}

export const TextBoxes = memo(({ textBoxes }: Props) => {
  const { visibleIds, layers } = useLayerContext();

  const visibleTextBoxes = useMemo(() => {
    const filtered = textBoxes.filter(
      (t) => layers.length === 0 || visibleIds.has(t.id)
    );
    return [...filtered].reverse();
  }, [textBoxes, visibleIds, layers]);

  return (
    <>
      {visibleTextBoxes.map((textBox) => (
        <TextBox key={textBox.id} textBox={textBox} />
      ))}
    </>
  );
});
