// PreviewLayerSwitcher — compact bottom-left layer control for view-only mode
// (ADR 0013). Per-layer visibility toggle + solo, applied as a UI-only
// override (uiState.previewLayerOverrides) that never mutates `layer.visible`,
// never dirties, never saves. Renders only in EXPLORABLE_READONLY with ≥2
// layers; the merge precedence lives in useLayerContext / isEntityVisibleInPreview.

import React from 'react';
import { Box, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import {
  VisibilityOutlined,
  VisibilityOffOutlined,
  CenterFocusStrongOutlined,
  CenterFocusWeakOutlined
} from '@mui/icons-material';
import { shallow } from 'zustand/shallow';
import { useLayerContext } from 'src/hooks/useLayerContext';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { useTranslation } from 'src/stores/localeStore';

export const PreviewLayerSwitcher = () => {
  const { t } = useTranslation('previewLayerSwitcher');
  const { layers } = useLayerContext();
  const { hiddenLayerIds, soloLayerId } = useUiStateStore(
    (s) => s.previewLayerOverrides,
    shallow
  );
  const actions = useUiStateStore((s) => s.actions);

  // ADR 0013: control appears only when there's a meaningful choice (≥2 layers).
  if (layers.length < 2) return null;

  const hasSolo = soloLayerId !== null;

  return (
    <Box
      data-axoview-id="preview-layer-switcher"
      onMouseDown={(e) => e.stopPropagation()}
      sx={{
        minWidth: 180,
        maxWidth: 260,
        borderRadius: 2,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'grey.400',
        boxShadow: 2,
        p: 1,
        // Presentation-friendly: recedes at rest, full opacity on hover (§2).
        opacity: 0.7,
        transition: 'opacity 120ms ease',
        '&:hover': { opacity: 1 }
      }}
    >
      <Typography
        variant="micro"
        color="text.secondary"
        sx={{ px: 0.5, display: 'block', mb: 0.5 }}
      >
        {t('layers')}
      </Typography>

      <Stack spacing={0}>
        {layers.map((layer) => {
          const isHidden = hiddenLayerIds.includes(layer.id);
          const isSolo = soloLayerId === layer.id;
          // Effective preview visibility mirrors isEntityVisibleInPreview at
          // layer granularity: solo wins; else base layer.visible minus hidden.
          const effectiveVisible = hasSolo
            ? isSolo
            : layer.visible && !isHidden;

          return (
            <Box
              key={layer.id}
              data-axoview-id="preview-layer-row"
              data-layer-name={layer.name}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                px: 0.5,
                py: 0.25,
                borderRadius: 1,
                opacity: effectiveVisible ? 1 : 0.45,
                '&:hover': { bgcolor: 'action.hover' }
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {layer.name}
              </Typography>

              <Tooltip
                title={effectiveVisible ? t('hideLayer') : t('showLayer')}
                placement="top"
              >
                <span>
                  <IconButton
                    size="small"
                    disabled={hasSolo}
                    onClick={() => actions.togglePreviewLayerHidden(layer.id)}
                    data-axoview-id="preview-layer-toggle-visibility"
                    sx={{ p: 0.25 }}
                  >
                    {effectiveVisible ? (
                      <VisibilityOutlined sx={{ fontSize: 14 }} />
                    ) : (
                      <VisibilityOffOutlined sx={{ fontSize: 14 }} />
                    )}
                  </IconButton>
                </span>
              </Tooltip>

              <Tooltip
                title={isSolo ? t('unsolo') : t('solo')}
                placement="top"
              >
                <IconButton
                  size="small"
                  onClick={() => actions.setPreviewSoloLayer(layer.id)}
                  aria-pressed={isSolo}
                  data-axoview-id="preview-layer-solo"
                  sx={{
                    p: 0.25,
                    color: isSolo ? 'primary.main' : 'action.active'
                  }}
                >
                  {isSolo ? (
                    <CenterFocusStrongOutlined sx={{ fontSize: 14 }} />
                  ) : (
                    <CenterFocusWeakOutlined sx={{ fontSize: 14 }} />
                  )}
                </IconButton>
              </Tooltip>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
};
