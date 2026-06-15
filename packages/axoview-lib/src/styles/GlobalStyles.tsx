import React from 'react';
import { GlobalStyles as MUIGlobalStyles } from '@mui/material';
import 'react-quill-new/dist/quill.snow.css';

export const GlobalStyles = () => {
  return (
    <MUIGlobalStyles
      styles={{
        div: {
          boxSizing: 'border-box'
        },
        // Kill the mobile WebKit/Blink default tap highlight — a translucent grey
        // box that flashes over the tapped/long-pressed element on touch and
        // reads as the whole screen "dimming" on every control press. Touch-only
        // (never paints for mouse), which is why it only showed on touchscreen.
        '*': {
          WebkitTapHighlightColor: 'transparent'
        }
      }}
    />
  );
};
