import React, { memo } from 'react';
import chroma from 'chroma-js';
import { useTheme } from '@mui/material';
import { IsoTileArea } from 'src/components/IsoTileArea/IsoTileArea';
import { useUiStateStore } from 'src/stores/uiStateStore';

export const Cursor = memo(() => {
  const theme = useTheme();
  const tile = useUiStateStore(
    (state) => state.mouse.position.tile,
    (a, b) => a.x === b.x && a.y === b.y
  );
  const zoom = useUiStateStore((state) => {
    return state.zoom;
  });

  return (
    <IsoTileArea
      from={tile}
      to={tile}
      // Outline + barely-there fill (was a solid alpha-0.5 diamond). The grid
      // cursor tracks the pointer in select / connector / placement modes, so it
      // must read as "pointer position," never as a placed node — a filled
      // diamond made empty clicks look like they spawned a node. (User feedback.)
      fill={chroma(theme.palette.primary.main).alpha(0.1).css()}
      stroke={{ width: 2, color: theme.palette.primary.main }}
      cornerRadius={10 * zoom}
    />
  );
});
