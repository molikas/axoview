import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography
} from '@mui/material';
import { useTranslation } from 'react-i18next';

// ADR 0011 — Error UX Contract. Failure-of-intent surface for a user-initiated
// save (Ctrl+S / toolbar Save) that could not be persisted. Dumb presenter:
// `onDismiss` clears the error and leaves editor state intact (ADR 0011 §3
// in-editor case — no navigation); `onRetry` re-runs the save.
interface SaveErrorDialogProps {
  open: boolean;
  onDismiss: () => void;
  onRetry: () => void;
}

export function SaveErrorDialog({ open, onDismiss, onRetry }: SaveErrorDialogProps) {
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
          'data-axoview-id': 'dialog-save-error'
        } as React.ComponentProps<'div'>
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Typography variant="h6" component="span">
          {t('dialog.saveError.headline', "Couldn't save.")}
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ pt: 0 }}>
        <Typography variant="body2" color="text.secondary">
          {t(
            'dialog.saveError.body',
            "Your changes weren't saved. Browser storage may be full. Try clearing space and saving again."
          )}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, pb: 2.5, pt: 1 }}>
        <Button
          variant="text"
          onClick={onRetry}
          data-axoview-id="dialog-save-error-retry"
        >
          {t('dialog.saveError.btnSecondary', 'Try again')}
        </Button>
        <Button
          variant="contained"
          onClick={onDismiss}
          autoFocus
          data-axoview-id="dialog-save-error-dismiss"
        >
          {t('dialog.saveError.btnDismiss', 'OK')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
