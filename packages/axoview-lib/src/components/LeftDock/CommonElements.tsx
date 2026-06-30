import React, { useCallback } from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { useTranslation } from 'src/stores/localeStore';

// Simple flat SVG thumbnails matching the tool icons
const RectangleSvg = () => (
  <svg
    viewBox="0 0 28 28"
    width="28"
    height="28"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="3"
      y="3"
      width="22"
      height="22"
      rx="2"
      stroke="currentColor"
      strokeWidth="1.5"
      fill="none"
    />
  </svg>
);

const TextSvg = () => (
  <svg
    viewBox="0 0 28 28"
    width="28"
    height="28"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <text
      x="7"
      y="20"
      fontFamily="serif"
      fontSize="18"
      fill="currentColor"
      fontWeight="bold"
    >
      T
    </text>
  </svg>
);

const LabelSvg = () => (
  <svg
    viewBox="0 0 28 28"
    width="28"
    height="28"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="3"
      y="8"
      width="22"
      height="12"
      rx="3"
      stroke="currentColor"
      strokeWidth="1.5"
      fill="none"
    />
    <line
      x1="7"
      y1="14"
      x2="21"
      y2="14"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

const ConnectorSvg = () => (
  <svg
    viewBox="0 0 28 28"
    width="28"
    height="28"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <line
      x1="5"
      y1="14"
      x2="20"
      y2="14"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <polyline
      points="16,10 22,14 16,18"
      stroke="currentColor"
      strokeWidth="1.5"
      fill="none"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  </svg>
);

interface ElementCardProps {
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  onMouseDown: () => void;
}

const ElementCard = ({
  label,
  icon,
  isActive,
  onMouseDown
}: ElementCardProps) => (
  <Tooltip title={label} placement="top">
    <Box
      onMouseDown={onMouseDown}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0.5,
        p: 1,
        borderRadius: 1,
        cursor: 'pointer',
        border: '1px solid',
        borderColor: isActive ? 'primary.main' : 'divider',
        bgcolor: isActive ? 'action.selected' : 'background.paper',
        color: isActive ? 'primary.main' : 'text.secondary',
        userSelect: 'none',
        '&:hover': {
          bgcolor: 'action.hover',
          borderColor: 'text.disabled'
        },
        transition: 'all 0.15s ease'
      }}
    >
      {icon}
      <Typography
        variant="caption"
        sx={{ fontSize: 10, lineHeight: 1, color: 'inherit' }}
      >
        {label}
      </Typography>
    </Box>
  </Tooltip>
);

export const CommonElements = () => {
  // D9 — labels were hardcoded English; route through i18n. Rectangle/Text/
  // Connector reuse the existing toolMenu.* keys; "Common" is a new toolMenu key.
  const { t } = useTranslation('toolMenu');
  const uiStateActions = useUiStateStore((s) => s.actions);
  const mode = useUiStateStore((s) => s.mode);

  const handleRectangleMouseDown = useCallback(() => {
    uiStateActions.setMode({
      type: 'RECTANGLE.DRAW',
      showCursor: true,
      id: null
    });
  }, [uiStateActions]);

  // Point-and-click placement (like Rectangle / a node icon): arm the mode with
  // nothing created; the next canvas click drops the element and a right-click
  // cancels (handled by the TextBox / Label mode + usePanHandlers).
  const handleTextMouseDown = useCallback(() => {
    uiStateActions.setMode({
      type: 'TEXTBOX',
      showCursor: true,
      id: null
    });
  }, [uiStateActions]);

  const handleLabelMouseDown = useCallback(() => {
    uiStateActions.setMode({
      type: 'LABEL',
      showCursor: true,
      id: null
    });
  }, [uiStateActions]);

  const handleConnectorMouseDown = useCallback(() => {
    uiStateActions.setMode({
      type: 'CONNECTOR',
      id: null,
      showCursor: true,
      returnToCursor: true
    });
  }, [uiStateActions]);

  return (
    <Box sx={{ px: 1.5, pt: 1.5, pb: 1 }}>
      <Typography
        variant="overline"
        sx={{ display: 'block', mb: 1, color: 'text.disabled' }}
      >
        {t('common')}
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 0.75
        }}
      >
        <ElementCard
          label={t('rectangle')}
          icon={<RectangleSvg />}
          isActive={mode.type === 'RECTANGLE.DRAW'}
          onMouseDown={handleRectangleMouseDown}
        />
        <ElementCard
          label={t('text')}
          icon={<TextSvg />}
          isActive={mode.type === 'TEXTBOX'}
          onMouseDown={handleTextMouseDown}
        />
        <ElementCard
          label={t('label')}
          icon={<LabelSvg />}
          isActive={mode.type === 'LABEL'}
          onMouseDown={handleLabelMouseDown}
        />
        <ElementCard
          label={t('connector')}
          icon={<ConnectorSvg />}
          isActive={mode.type === 'CONNECTOR'}
          onMouseDown={handleConnectorMouseDown}
        />
      </Box>
    </Box>
  );
};
