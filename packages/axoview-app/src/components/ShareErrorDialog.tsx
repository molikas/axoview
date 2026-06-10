import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography
} from '@mui/material';
import { useTranslation } from 'react-i18next';

// ADR 0011 — Error UX Contract. Failure-of-intent surface for a share-link
// creation that failed from a bare action (the file-tree "Copy share link"
// context-menu item) — i.e. outside any dialog, where the in-dialog-inline
// carve-out does not apply. The popover + DiagramManager share paths keep their
// inline error states (ADR 0011 §1 carve-out). Dumb presenter; `onDismiss`
// closes the dialog, `onRetry` re-runs the share POST.
interface ShareErrorDialogProps {
  open: boolean;
  onDismiss: () => void;
  onRetry: () => void;
}

export function ShareErrorDialog({ open, onDismiss, onRetry }: ShareErrorDialogProps) {
  const { t } = useTranslation('app');

  return (
    <Dialog
      open={open}
      onClose={onDismiss}
      maxWidth="xs"
      fullWidth
      slotProps={{
        paper: {
          sx: { boxShadow: '0px 10px 20px -2px rgba(0,0,0,0.25)', borderRadius: 2 },
          'data-axoview-id': 'dialog-share-error'
        } as React.ComponentProps<'div'>
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Typography variant="h6" component="span">
          {t('dialog.shareError.headline', "Couldn't create share link.")}
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ pt: 0 }}>
        <Typography variant="body2" color="text.secondary">
          {t('dialog.shareError.body', 'Something went wrong. Try again in a moment.')}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, pb: 2.5, pt: 1 }}>
        <Button
          variant="text"
          onClick={onRetry}
          data-axoview-id="dialog-share-error-retry"
        >
          {t('dialog.shareError.btnSecondary', 'Try again')}
        </Button>
        <Button
          variant="contained"
          onClick={onDismiss}
          autoFocus
          data-axoview-id="dialog-share-error-dismiss"
        >
          {t('dialog.shareError.btnDismiss', 'OK')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
