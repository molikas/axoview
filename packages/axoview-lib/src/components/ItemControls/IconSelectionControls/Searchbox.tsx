import React from 'react';
import { TextField, InputAdornment } from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import { useTranslation } from 'src/stores/localeStore';

interface Props {
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  size?: 'small' | 'medium';
}

export const Searchbox = ({ value, onChange, autoFocus, size }: Props) => {
  const { t } = useTranslation('searchbox');
  return (
    <TextField
      fullWidth
      placeholder={t('placeholder')}
      value={value}
      onChange={(e) => {
        return onChange(e.target.value as string);
      }}
      autoFocus={autoFocus}
      size={size}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          )
        }
      }}
    />
  );
};
