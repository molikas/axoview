import React, { memo, useMemo } from 'react';
import { useScene } from 'src/hooks/useScene';
import { useLayerContext } from 'src/hooks/useLayerContext';
import { TextBox } from './TextBox';

interface Props {
  textBoxes: ReturnType<typeof useScene>['textBoxes'];
}

export const TextBoxes = memo(({ textBoxes }: Props) => {
  const { visibleIds } = useLayerContext();

  const visibleTextBoxes = useMemo(() => {
    const filtered = textBoxes.filter(
      (t) => visibleIds.size === 0 || visibleIds.has(t.id)
    );
    // Higher zIndex paints later (on top). Array.sort is stable, so boxes with
    // an equal zIndex (the default 0) keep their prior reversed order — existing
    // diagrams stack exactly as before; only an explicit send-to-front/back moves.
    return [...filtered]
      .reverse()
      .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
  }, [textBoxes, visibleIds]);

  return (
    <>
      {visibleTextBoxes.map((textBox) => (
        <TextBox key={textBox.id} textBox={textBox} />
      ))}
    </>
  );
});
