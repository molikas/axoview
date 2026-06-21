import { Box, Stack, Typography } from '@mui/material';
import { CallMade as ConnectorIcon } from '@mui/icons-material';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { useTranslation } from 'src/stores/localeStore';

// F-11: a transient mode hint so an active tool is unmistakable and its exit is
// discoverable. Shown only in CONNECTOR mode — the tool users reported getting
// "stuck" in before the Esc-exits-tool-mode fix (F-01) — and it names the Esc
// escape hatch explicitly. A floating top-centre pill, click-through
// (pointerEvents: none) so it never intercepts a connection drag.
//
// Isolated component (mirrors PlaceIconLayer) so it subscribes to the mode slice
// itself and UiOverlay doesn't re-render when the hint shows/hides.
export const ConnectorModeHint = () => {
  const { t } = useTranslation('modeHints');
  const modeType = useUiStateStore((s) => s.mode.type);
  const rendererWidth = useUiStateStore((s) => s.rendererSize.width);

  if (modeType !== 'CONNECTOR') return null;

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
        <ConnectorIcon sx={{ fontSize: 16 }} />
        <Typography
          variant="caption"
          sx={{ fontWeight: 500, whiteSpace: 'nowrap' }}
        >
          {t('connector')}
        </Typography>
      </Stack>
    </Box>
  );
};
