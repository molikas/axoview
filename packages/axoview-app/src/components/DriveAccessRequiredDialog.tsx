import { useTranslation } from 'react-i18next';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography
} from '@mui/material';
import { CloudOffOutlined as NoDriveIcon } from '@mui/icons-material';
import { useAppStorage } from '../providers/AppStorageContext';
import { useAuthStore } from '../stores/authStore';
import { GoogleGIcon } from './GoogleGIcon';

/**
 * Hard stop for a checkbox-less Google sign-in (ADR 0035 §6). Signing in exists
 * only to reach Google Drive, so a grant that withheld the drive.file scope is
 * not a usable session — the auth store parks it in DRIVE_ACCESS_REQUIRED and
 * this blocking dialog is the only way forward: re-consent (with the Drive
 * checkbox) or back out to session-only mode. Also surfaces when a Drive call
 * 403s for insufficient scopes mid-session (markDriveScopeMissing).
 */
export function DriveAccessRequiredDialog() {
  const { t } = useTranslation('app');
  const { googleDriveConfigured } = useAppStorage();
  const status = useAuthStore((s) => s.status);
  const grantDriveAccess = useAuthStore((s) => s.grantDriveAccess);
  const signOut = useAuthStore((s) => s.signOut);

  if (!googleDriveConfigured) return null;

  return (
    <Dialog
      open={status === 'DRIVE_ACCESS_REQUIRED'}
      // A required decision, not a toast — no backdrop-click / Escape dismissal.
      disableEscapeKeyDown
      maxWidth="xs"
      fullWidth
      slotProps={{
        paper: {
          'data-axoview-id': 'drive-access-required-dialog',
          sx: { boxShadow: '0px 10px 20px -2px rgba(0,0,0,0.25)', borderRadius: 2 }
        } as never
      }}
    >
      <DialogTitle sx={{ pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
        <NoDriveIcon color="warning" />
        <Typography variant="h6" component="span" fontWeight={600}>
          {t('driveAccess.title', 'Google Drive access is required')}
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ pt: 0 }}>
        <Typography variant="body2" color="text.secondary">
          {t(
            'driveAccess.body',
            'Axoview signs you in only to store your diagrams in your own Google Drive. Without the Drive permission there is nothing to sign in for — every save and open would fail.'
          )}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          {t(
            'driveAccess.instruction',
            'Please continue and tick the checkbox that lets Axoview "see, edit, create and delete only the specific files you use with it."'
          )}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, pb: 2.5, pt: 1 }}>
        <Button
          variant="text"
          onClick={() => signOut()}
          data-axoview-id="drive-access-cancel"
        >
          {t('driveAccess.cancel', 'Continue without Drive')}
        </Button>
        <Button
          variant="contained"
          startIcon={<GoogleGIcon size={16} />}
          onClick={() => grantDriveAccess()}
          data-axoview-id="drive-access-grant"
          sx={{ textTransform: 'none' }}
        >
          {t('driveAccess.grant', 'Grant Drive access')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
