import { Box, Stack, Typography } from '@mui/material';
import {
  TextFields as TextIcon,
  LocalOfferOutlined as LabelIcon,
  CropSquare as RectangleIcon
} from '@mui/icons-material';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { useTranslation } from 'src/stores/localeStore';

// B1/B2 — a transient mode-hint pill for the placement tools (text box / label /
// rectangle), mirroring ConnectorModeHint. Names what the next click/drag does
// and the Esc escape hatch, so an armed placement tool is unmistakable (the
// cursor is already a crosshair — this adds the "what"). Click-through pill,
// isolated so UiOverlay doesn't re-render when it shows/hides.

const HINT_BY_MODE: Record<
  string,
  { key: 'textBox' | 'label' | 'rectangle'; Icon: typeof TextIcon }
> = {
  TEXTBOX: { key: 'textBox', Icon: TextIcon },
  LABEL: { key: 'label', Icon: LabelIcon },
  'RECTANGLE.DRAW': { key: 'rectangle', Icon: RectangleIcon }
};

export const PlacementModeHint = () => {
  const { t } = useTranslation('modeHints');
  const modeType = useUiStateStore((s) => s.mode.type);
  const rendererWidth = useUiStateStore((s) => s.rendererSize.width);

  const hint = HINT_BY_MODE[modeType];
  if (!hint) return null;
  const { Icon, key } = hint;

  return (
    <Box
      sx={{
        position: 'absolute',
        transform: 'translateX(-50%)',
        pointerEvents: 'none',
        zIndex: 14
      }}
      style={{ left: rendererWidth / 2, top: 64 }}
      role="status"
    >
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{
          bgcolor: 'rgba(33, 33, 33, 0.88)',
          color: 'common.white',
          px: 1.5,
          py: 0.5,
          borderRadius: 999,
          boxShadow: 3
        }}
      >
        <Icon sx={{ fontSize: 16 }} />
        <Typography
          variant="caption"
          sx={{ fontWeight: 500, whiteSpace: 'nowrap' }}
        >
          {t(key)}
        </Typography>
      </Stack>
    </Box>
  );
};
