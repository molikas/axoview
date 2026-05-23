import React, { useMemo } from 'react';
import { Button, Box, useTheme } from '@mui/material';
import Tooltip, { TooltipProps } from '@mui/material/Tooltip';

interface Props {
  name: string;
  Icon: React.ReactNode;
  isActive?: boolean;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  tooltipPosition?: TooltipProps['placement'];
  disabled?: boolean;
  /** Optional `data-axoview-id` value forwarded to the underlying <button>.
   *  Per ADR 0008 Decision 5 (lazy retrofit), callers add this on the spot
   *  for E2E coverage; existing call sites continue to work without it. */
  dataAxoviewId?: string;
}

export const IconButton = ({
  name,
  Icon,
  onClick,
  isActive = false,
  disabled = false,
  tooltipPosition = 'bottom',
  dataAxoviewId
}: Props) => {
  const theme = useTheme();
  const iconColor = useMemo(() => {
    if (isActive) {
      return 'grey.200'; // light on coloured background
    }
    if (disabled) {
      return 'grey.400'; // muted — cannot act
    }
    return 'grey.700'; // prominent — can act
  }, [disabled, isActive]);

  return (
    <Tooltip
      title={name}
      placement={tooltipPosition}
      enterDelay={1000}
      enterNextDelay={1000}
      arrow
      sx={{ bgcolor: 'primary.main' }}
    >
      {/* span wrapper lets the Tooltip receive hover even when Button is disabled */}
      <span
        style={{
          display: 'inline-flex',
          cursor: disabled ? 'default' : 'pointer'
        }}
      >
        <Button
          variant="text"
          onClick={onClick}
          disabled={disabled}
          data-axoview-id={dataAxoviewId}
          sx={{
            borderRadius: 0,
            height: theme.customVars.toolMenu.height,
            width: theme.customVars.toolMenu.height,
            maxWidth: '100%',
            minWidth: 'auto',
            bgcolor: isActive ? 'primary.light' : undefined,
            p: 0,
            m: 0,
            '&.Mui-disabled': { opacity: 1 } // we control opacity via icon color
          }}
        >
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              svg: {
                color: iconColor,
                transition: 'color 0.15s'
              }
            }}
          >
            {Icon}
          </Box>
        </Button>
      </span>
    </Tooltip>
  );
};
