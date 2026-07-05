import {
  MuiColorButtonProps,
  MuiColorInput,
  MuiColorInputProps
} from 'mui-color-input';
import React from 'react';
import { ColorSwatch } from './ColorSwatch';

interface Props extends Omit<MuiColorInputProps, 'ref'> {}

const ColorButtonElement = ({ bgColor, onClick }: MuiColorButtonProps) => {
  return <ColorSwatch hex={bgColor} onClick={onClick} />;
};
export const ColorPicker = ({ value, onChange }: Props) => {
  return (
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
  );
};
