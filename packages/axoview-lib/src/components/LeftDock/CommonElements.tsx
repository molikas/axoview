import React, { useCallback } from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { useTranslation } from 'src/stores/localeStore';
import {
  RectangleSvg,
  TextSvg,
  LabelSvg,
  ConnectorSvg
} from '../elementTypeIcons';

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
