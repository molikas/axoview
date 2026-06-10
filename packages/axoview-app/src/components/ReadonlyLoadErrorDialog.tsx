import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography
} from '@mui/material';
import { useTranslation } from 'react-i18next';

interface ReadonlyLoadErrorDialogProps {
  open: boolean;
  onDismiss: () => void;
}

export function ReadonlyLoadErrorDialog({
  open,
  onDismiss
}: ReadonlyLoadErrorDialogProps) {
  const { t } = useTranslation('app');

  return (
    <Dialog
      open={open}
      onClose={onDismiss}
      maxWidth="xs"
      fullWidth
      slotProps={{
        paper: {
          sx: { boxShadow: '0px 10px 20px -2px rgba(0,0,0,0.25)', borderRadius: 2 }
        }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Typography variant="h6" component="span">
          {t(
            'dialog.readonlyLoadError.headline',
            'Could not open this diagram.'
          )}
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ pt: 0 }}>
        <Typography variant="body2" color="text.secondary">
          {t(
            'dialog.readonlyLoadError.body',
            'The diagram may have been deleted, or you may not have access to it.'
          )}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, pb: 2.5, pt: 1 }}>
        <Button variant="contained" onClick={onDismiss} autoFocus>
          {t('dialog.readonlyLoadError.btnDismiss', 'Back to editor')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
