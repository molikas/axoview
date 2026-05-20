import React from 'react';
import { Grid } from '@mui/material';
import { IconCollectionStateWithIcons, Icon } from 'src/types';
import { IconCollection } from './IconCollection';

interface Props {
  iconCategories: IconCollectionStateWithIcons[];
  onClick?: (icon: Icon) => void;
  onMouseDown?: (icon: Icon) => void;
  /** Per-icon delete handler — Icon.tsx only renders the badge for imported icons */
  onDelete?: (icon: Icon) => void;
  deleteTooltip?: string;
}

export const Icons = ({
  iconCategories,
  onClick,
  onMouseDown,
  onDelete,
  deleteTooltip
}: Props) => {
  return (
    <Grid container spacing={1} sx={{ py: 2 }}>
      {iconCategories.map((cat) => {
        return (
          <Grid size={12} key={`icon-collection-${cat.id ?? 'uncategorised'}`}>
            <IconCollection
              {...cat}
              onClick={onClick}
              onMouseDown={onMouseDown}
              onDelete={onDelete}
              deleteTooltip={deleteTooltip}
            />
          </Grid>
        );
      })}
    </Grid>
  );
};
