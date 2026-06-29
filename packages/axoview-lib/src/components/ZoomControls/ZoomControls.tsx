import React from 'react';
import { Stack, Typography, Divider, IconButton, Tooltip } from '@mui/material';
import { LabelOutlined, LabelOffOutlined } from '@mui/icons-material';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { useDiagramUtils } from 'src/hooks/useDiagramUtils';
import { MAX_ZOOM, MIN_ZOOM } from 'src/config';
import { useTranslation } from 'src/stores/localeStore';
import { tooltipWithShortcut } from 'src/utils/tooltipWithShortcut';

// Minimal 16px inline SVG icons matching Lucid's style
const MinusIcon = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
    <path d="M3 7.5a.5.5 0 01.5-.5h9a.5.5 0 010 1h-9a.5.5 0 01-.5-.5z" />
  </svg>
);

const PlusIcon = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M7 12.5a.5.5 0 001 0V8h4.5a.5.5 0 000-1H8V2.5a.5.5 0 00-1 0V7H2.5a.5.5 0 000 1H7v4.5z"
    />
  </svg>
);

// Compress-to-fit: corner arrows pointing inward
const FitIcon = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
    <path d="M5.72 9.59a.5.5 0 01.63.76L3.71 13H5a.5.5 0 010 1H2.5a.5.5 0 01-.5-.5V11a.5.5 0 011 0v1.29l2.65-2.65.07-.06zM9.65 9.65a.5.5 0 01.76.63L13 12.29V11a.5.5 0 011 0v2.5a.5.5 0 01-.5.5H11a.5.5 0 010-1h1.29l-2.65-2.65-.06-.08a.5.5 0 01.07-.62zM5 2a.5.5 0 010 1H3.71l2.64 2.65a.5.5 0 01-.7.7L3 3.71V5a.5.5 0 01-1 0V2.5A.5.5 0 012.5 2H5zm8.5 0a.5.5 0 01.5.5V5a.5.5 0 01-1 0V3.71l-2.65 2.64a.5.5 0 01-.7-.7L12.29 3H11a.5.5 0 010-1h2.5z" />
  </svg>
);

const btnSx = {
  borderRadius: 1,
  p: 0.5,
  color: 'text.secondary',
  '&:hover': { bgcolor: 'action.hover', color: 'text.primary' },
  '&:disabled': { opacity: 0.35 }
} as const;

export const ZoomControls = () => {
  const { t } = useTranslation('zoomControls');
  // The hide-labels toggle reuses the existing (already-translated) labels-toggle
  // strings; it moved here from the presentation-only chrome and is now global.
  const { t: tLabels } = useTranslation('previewLabelsToggle');
  const uiStateStoreActions = useUiStateStore((s) => s.actions);
  const zoom = useUiStateStore((s) => s.zoom);
  const readableLabels = useUiStateStore((s) => s.readableLabels);
  const hideLabels = useUiStateStore((s) => s.previewHideLabels);
  const { fitToView } = useDiagramUtils();

  return (
    <Stack direction="row" spacing={0} alignItems="center">
      <Tooltip title={tooltipWithShortcut(t('zoomOut'), 'Wheel ↓')} placement="top">
        <span>
          <IconButton
            size="small"
            onClick={uiStateStoreActions.decrementZoom}
            disabled={zoom <= MIN_ZOOM}
            sx={btnSx}
            data-axoview-id="canvas-zoom-out"
          >
            <MinusIcon />
          </IconButton>
        </span>
      </Tooltip>

      <Typography
        variant="body2"
        sx={{
          minWidth: 40,
          textAlign: 'center',
          fontSize: 11,
          color: 'text.secondary',
          userSelect: 'none',
          fontVariantNumeric: 'tabular-nums'
        }}
        data-axoview-id="canvas-zoom-percent"
      >
        {Math.ceil(zoom * 100)}%
      </Typography>

      <Tooltip title={tooltipWithShortcut(t('zoomIn'), 'Wheel ↑')} placement="top">
        <span>
          <IconButton
            size="small"
            onClick={uiStateStoreActions.incrementZoom}
            disabled={zoom >= MAX_ZOOM}
            sx={btnSx}
            data-axoview-id="canvas-zoom-in"
          >
            <PlusIcon />
          </IconButton>
        </span>
      </Tooltip>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.75 }} />

      <Tooltip title={t('fitToScreen')} placement="top">
        <IconButton
          size="small"
          onClick={fitToView}
          sx={btnSx}
          data-axoview-id="canvas-zoom-fit"
        >
          <FitIcon />
        </IconButton>
      </Tooltip>

      <Tooltip title={t('keepLabelsReadable')} placement="top">
        <IconButton
          size="small"
          onClick={() =>
            uiStateStoreActions.setReadableLabels(!readableLabels)
          }
          aria-pressed={readableLabels}
          sx={{
            ...btnSx,
            ...(readableLabels && {
              bgcolor: 'action.selected',
              color: 'text.primary'
            })
          }}
          data-axoview-id="canvas-readable-labels"
        >
          <Typography
            component="span"
            sx={{
              fontSize: 13,
              fontWeight: 700,
              lineHeight: 1,
              letterSpacing: '-0.02em'
            }}
          >
            Aa
          </Typography>
        </IconButton>
      </Tooltip>

      <Tooltip
        title={hideLabels ? tLabels('showLabels') : tLabels('hideLabels')}
        placement="top"
      >
        <IconButton
          size="small"
          onClick={() =>
            uiStateStoreActions.setPreviewHideLabels(!hideLabels)
          }
          aria-pressed={hideLabels}
          sx={{
            ...btnSx,
            ...(hideLabels && {
              bgcolor: 'action.selected',
              color: 'text.primary'
            })
          }}
          data-axoview-id="canvas-hide-labels"
        >
          {hideLabels ? (
            <LabelOffOutlined sx={{ fontSize: 16 }} />
          ) : (
            <LabelOutlined sx={{ fontSize: 16 }} />
          )}
        </IconButton>
      </Tooltip>
    </Stack>
  );
};
