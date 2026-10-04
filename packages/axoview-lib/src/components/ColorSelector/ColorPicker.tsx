import type { MuiColorButtonProps, MuiColorInputProps } from 'mui-color-input';
import React, { lazy, Suspense } from 'react';
import { ColorSwatch } from './ColorSwatch';

interface Props extends Omit<MuiColorInputProps, 'ref'> {}

// The picker library loads off the editor's boot path (the bundle budget,
// scripts/bundle-budget.json: code that is not needed to show a diagram goes
// behind import()). It is fetched once the page is idle, so it is in hand long
// before a style panel opens; until then the swatch stands in for it.
const loadColorInput = () => import('mui-color-input');
const MuiColorInput = lazy(() =>
  loadColorInput().then((m) => ({ default: m.MuiColorInput }))
);
if (typeof window !== 'undefined') {
  const preload = () => void loadColorInput().catch(() => undefined);
  if ('requestIdleCallback' in window) window.requestIdleCallback(preload);
  else setTimeout(preload, 1);
}

const ColorButtonElement = ({ bgColor, onClick }: MuiColorButtonProps) => {
  return <ColorSwatch hex={bgColor} onClick={onClick} />;
};
export const ColorPicker = ({ value, onChange }: Props) => {
  return (
    <Suspense
      fallback={<ColorSwatch hex={String(value)} onClick={undefined} />}
    >
      <MuiColorInput
        size="small"
        variant="standard"
        format="hex"
        // Colours are stored as opaque hex, so the alpha channel is dropped on
        // change — the alpha slider can't move (it snaps back to fully opaque) and
        // reads as broken. Hide it; the picker is hue + saturation only.
        isAlphaHidden
        value={value}
        onChange={onChange}
        slotProps={{ input: { disableUnderline: true, type: 'hidden' } }}
        Adornment={ColorButtonElement}
      />
    </Suspense>
  );
};
