// PreviewLabelsToggle — compact top-left present-mode "hide labels" control
// (ADR 0013, 2026-06-18 addendum). A UI-only toggle (uiState.previewHideLabels)
// that hides node + connector name labels live while presenting; it never
// mutates the model's `showLabel`, never dirties/saves, and clears on leaving
// present mode. Sits in the same top-left presentation chrome as the
// PreviewLayerSwitcher and shares its semi-transparent-at-rest affordance (§2).
// Shown in EXPLORABLE_READONLY only (gated by UiOverlay); unlike the layer
// switcher it does not depend on layer count.

import React from 'react';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import {
  LabelOutlined,
  LabelOffOutlined
} from '@mui/icons-material';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { useTranslation } from 'src/stores/localeStore';

export const PreviewLabelsToggle = () => {
  const { t } = useTranslation('previewLabelsToggle');
  const hideLabels = useUiStateStore((s) => s.previewHideLabels);
  const actions = useUiStateStore((s) => s.actions);

  const actionLabel = hideLabels ? t('showLabels') : t('hideLabels');

  return (
    <Box
      data-axoview-id="preview-labels-toggle"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={() => actions.setPreviewHideLabels(!hideLabels)}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        cursor: 'pointer',
        borderRadius: 2,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'grey.400',
        boxShadow: 2,
        pl: 0.75,
        pr: 1,
        py: 0.25,
        // Presentation-friendly: recedes at rest, full opacity on hover (§2).
        opacity: 0.7,
        transition: 'opacity 120ms ease',
        '&:hover': { opacity: 1 }
      }}
    >
      <Tooltip title={actionLabel} placement="top">
        <IconButton
          size="small"
          aria-pressed={hideLabels}
          data-axoview-id="preview-labels-toggle-button"
          // The whole pill is clickable; the button is the affordance icon.
          tabIndex={-1}
          sx={{ p: 0.25, pointerEvents: 'none' }}
        >
          {hideLabels ? (
            <LabelOffOutlined sx={{ fontSize: 16 }} />
          ) : (
            <LabelOutlined sx={{ fontSize: 16 }} />
          )}
        </IconButton>
      </Tooltip>
      <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
        {actionLabel}
      </Typography>
    </Box>
  );
};
