import { Box, Typography } from '@mui/material';
import { useTranslation } from 'src/stores/localeStore';

// Subtle iso-grid backdrop (mirrors the app's EmptyStateScreen house style) so
// the gate reads as an Axoview "Screen" (ADR 0008 vocab), not a raw error page.
const isoGridBackground = [
  'repeating-linear-gradient(30deg,  rgba(128,128,128,0.13) 0, rgba(128,128,128,0.13) 1px, transparent 0, transparent 28px)',
  'repeating-linear-gradient(150deg, rgba(128,128,128,0.13) 0, rgba(128,128,128,0.13) 1px, transparent 0, transparent 28px)'
].join(', ');

// Unsupported-browser gate: WebGL2 is the sole render substrate (Phase C), so a
// browser without it can't display diagrams at all. Renderer swaps the whole
// canvas area for this opaque, full-area Screen instead of a blank canvas.
export function WebGLUnsupportedScreen() {
  const { t } = useTranslation('webglUnsupported');
  return (
    <Box
      data-axoview-id="screen-webgl-unsupported"
      sx={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        bgcolor: 'background.default',
        backgroundImage: isoGridBackground,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: 2,
        px: 4
      }}
    >
      <Typography variant="h5" color="text.primary">
        {t('title')}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 480 }}>
        {t('body')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 480 }}>
        {t('hint')}
      </Typography>
    </Box>
  );
}
