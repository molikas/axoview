import React from 'react';
import { Box, Button } from '@mui/material';
import { useTranslation } from 'src/stores/localeStore';

// "No color" swatch (white circle + red slash), matching ColorSwatch's
// footprint so it sits inline with the colour swatches. Used by the unified
// colour picker (ADR 0039) for the contextual Transparent / clear-fill action —
// offered only where clearing a colour is meaningful (fill / border / background),
// never for text colour. Moved out of TopBarStyleControls so the shared picker
// can reuse it.
export const NoColorSwatch = ({
  isActive,
  onClick
}: {
  isActive?: boolean;
  onClick: () => void;
}) => {
  const { t } = useTranslation('topBarStyleControls');
  return (
    <Button
      onClick={onClick}
      variant="text"
      size="small"
      aria-label={t('noColor')}
      aria-pressed={!!isActive}
      sx={{ width: 40, height: 40, minWidth: 'auto' }}
    >
      <Box
        sx={{
          position: 'relative',
          width: 28,
          height: 28,
          borderRadius: '100%',
          border: '1px solid',
          borderColor: 'grey.600',
          bgcolor: 'background.paper',
          overflow: 'hidden',
          transform: `scale(${isActive ? 1.25 : 1})`
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '-10%',
            width: '120%',
            height: '2px',
            bgcolor: 'error.main',
            transform: 'translateY(-50%) rotate(-45deg)'
          }}
        />
      </Box>
    </Button>
  );
};
