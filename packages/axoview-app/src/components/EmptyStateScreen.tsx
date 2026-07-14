import { useTranslation } from 'react-i18next';
import { Box, Button, CardActionArea, Link, Paper, Typography } from '@mui/material';
import { AddCircleOutline as AddIcon, FileUploadOutlined as ImportIcon } from '@mui/icons-material';
import { GoogleGIcon } from './GoogleGIcon';
import { isoGridBackground } from '../utils/isoGridBackground';

const SKY_BLUE = '#0ea5e9';

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
   * Sign-in identity strip (owner picks 2026-07-06: nudge not gate; then
   * hierarchy-strip not peer-card — the cards are the verbs, identity is one
   * quiet line beneath; "continue in this session" is copy, the cards ARE
   * the continue action). Shown on the storage-less deploy while signed out.
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
        position: 'relative',
        bgcolor: 'background.default',
        backgroundImage: isoGridBackground.backgroundImage,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4
      }}
    >
      <Box sx={{ display: 'flex', gap: 3 }}>
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
      </Box>

      {showSignIn && onSignIn && (
        <Box
          data-axoview-id="screen-empty-signin-strip"
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1,
            maxWidth: 440,
            textAlign: 'center',
            borderTop: 1,
            borderColor: 'divider',
            pt: 2.5,
            px: 2,
            minWidth: 360
          }}
        >
          <Button
            variant="outlined"
            size="small"
            onClick={onSignIn}
            startIcon={<GoogleGIcon size={16} />}
            data-axoview-id="screen-empty-signin"
            sx={{ textTransform: 'none', bgcolor: 'background.paper' }}
          >
            {t('auth.signIn', 'Sign in with Google')}
          </Button>
          <Typography variant="caption" color="text.secondary">
            {t(
              'emptyState.signInStripCaption',
              'Save your diagrams to Google Drive — or continue in this session and move them to Drive anytime.'
            )}
          </Typography>
        </Box>
      )}

      {/* Legal footer: keeps the privacy/terms pages discoverable from the app
          itself (Google OAuth verification wants the policy reachable from the
          home page, not only linked on the consent screen). Links, not buttons,
          so the "exactly two interactive cards" contract above still holds. */}
      <Box
        component="footer"
        data-axoview-id="screen-empty-footer"
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 1.5,
          py: 2
        }}
      >
        <Link
          href="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          variant="caption"
          underline="hover"
          color="text.secondary"
          data-axoview-id="screen-empty-privacy-link"
        >
          {t('legal.privacy', 'Privacy')}
        </Link>
        <Typography variant="caption" color="text.disabled" aria-hidden>
          ·
        </Typography>
        <Link
          href="/terms"
          target="_blank"
          rel="noopener noreferrer"
          variant="caption"
          underline="hover"
          color="text.secondary"
          data-axoview-id="screen-empty-terms-link"
        >
          {t('legal.terms', 'Terms')}
        </Link>
      </Box>
    </Box>
  );
}
