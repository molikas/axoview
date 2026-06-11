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
// direct file import (the empty-tree file chooser) that could not be parsed.
// Dumb presenter; `onDismiss` closes the dialog and leaves the tree intact —
// no navigation, no retry (re-picking a file is the recovery affordance).
interface ImportErrorDialogProps {
  open: boolean;
  onDismiss: () => void;
}

export function ImportErrorDialog({ open, onDismiss }: ImportErrorDialogProps) {
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
          'data-axoview-id': 'dialog-import-error'
        } as React.ComponentProps<'div'>
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Typography variant="h6" component="span">
          {t('dialog.importError.headline', "Couldn't import.")}
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ pt: 0 }}>
        <Typography variant="body2" color="text.secondary">
          {t(
            'dialog.importError.body',
            "This file isn't a valid Axoview diagram. Make sure it's a .json or .zip exported from Axoview."
          )}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, pb: 2.5, pt: 1 }}>
        <Button
          variant="contained"
          onClick={onDismiss}
          autoFocus
          data-axoview-id="dialog-import-error-dismiss"
        >
          {t('dialog.importError.btnDismiss', 'OK')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
