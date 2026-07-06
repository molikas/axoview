import { useTranslation } from 'react-i18next';
import { Box, Button, CardActionArea, Paper, Typography } from '@mui/material';
import { AddCircleOutline as AddIcon, FileUploadOutlined as ImportIcon } from '@mui/icons-material';
import { GoogleGIcon } from './GoogleGIcon';

const SKY_BLUE = '#0ea5e9';

const isoGridBackground = {
  backgroundImage: [
    'repeating-linear-gradient(30deg,  rgba(128,128,128,0.13) 0, rgba(128,128,128,0.13) 1px, transparent 0, transparent 28px)',
    'repeating-linear-gradient(150deg, rgba(128,128,128,0.13) 0, rgba(128,128,128,0.13) 1px, transparent 0, transparent 28px)'
  ].join(', ')
} as const;

const cardSx = {
  width: 220,
  borderRadius: 3,
  // Clip the CardActionArea ripple/hover overlay to the rounded corners.
  overflow: 'hidden'
} as const;

// The whole card is the single interactive element (CardActionArea → <button>),
// so the inner blue "button" is purely a visual label — no button-inside-button.
const cardActionSx = {
  py: 4,
  px: 3,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 2
} as const;

const labelSx = {
  bgcolor: SKY_BLUE,
  px: 4,
  borderRadius: 2,
  textTransform: 'none',
  fontWeight: 600,
  fontSize: '1rem',
  // Demoted to a label: never the click target, never focusable, never hovers
  // independently of the card.
  pointerEvents: 'none'
} as const;

interface Props {
  onCreate: () => void;
  onImport: () => void;
  /**
   * Sign-in nudge card (owner pick 2026-07-06 — nudge instead of a blocking
   * first-run gate): shown on the storage-less deploy while signed out.
   */
  showSignIn?: boolean;
  onSignIn?: () => void;
}

export function EmptyStateScreen({ onCreate, onImport, showSignIn, onSignIn }: Props) {
  // D11: translate both the visible card labels and their aria-labels.
  const { t } = useTranslation('app');
  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        bgcolor: 'background.default',
        backgroundImage: isoGridBackground.backgroundImage,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3
      }}
    >
      <Paper elevation={3} sx={cardSx}>
        <CardActionArea
          onClick={onCreate}
          aria-label={t('emptyState.newDiagram')}
          data-axoview-id="screen-empty-create"
          sx={cardActionSx}
        >
          <AddIcon sx={{ fontSize: 72, color: SKY_BLUE }} />
          <Button
            component="span"
            variant="contained"
            size="large"
            disableRipple
            tabIndex={-1}
            aria-hidden
            sx={labelSx}
          >
            {t('emptyState.newDiagram')}
          </Button>
        </CardActionArea>
      </Paper>

      <Paper elevation={3} sx={cardSx}>
        <CardActionArea
          onClick={onImport}
          aria-label={t('emptyState.import')}
          data-axoview-id="screen-empty-import"
          sx={cardActionSx}
        >
          <ImportIcon sx={{ fontSize: 72, color: SKY_BLUE }} />
          <Button
            component="span"
            variant="contained"
            size="large"
            disableRipple
            tabIndex={-1}
            aria-hidden
            sx={labelSx}
          >
            {t('emptyState.import')}
          </Button>
        </CardActionArea>
      </Paper>

      {showSignIn && onSignIn && (
        <Paper elevation={3} sx={cardSx}>
          <CardActionArea
            onClick={onSignIn}
            aria-label={t('auth.signIn', 'Sign in with Google')}
            data-axoview-id="screen-empty-signin"
            sx={{ ...cardActionSx, gap: 1.5 }}
          >
            <Box sx={{ height: 72, display: 'flex', alignItems: 'center' }}>
              <GoogleGIcon size={56} />
            </Box>
            <Button
              component="span"
              variant="contained"
              size="large"
              disableRipple
              tabIndex={-1}
              aria-hidden
              sx={labelSx}
            >
              {t('emptyState.signIn', 'Sign in')}
            </Button>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ textAlign: 'center', px: 1 }}
            >
              {t('emptyState.signInCaption', 'Keep your diagrams in Google Drive')}
            </Typography>
          </CardActionArea>
        </Paper>
      )}
    </Box>
  );
}
