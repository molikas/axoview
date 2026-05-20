import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography
} from '@mui/material';
import { useTranslation } from 'react-i18next';

interface LocalModeShareErrorDialogProps {
  open: boolean;
  onDismiss: () => void;
}

export function LocalModeShareErrorDialog({
  open,
  onDismiss
}: LocalModeShareErrorDialogProps) {
  const { t } = useTranslation('app');

  return (
    <Dialog
      open={open}
      onClose={onDismiss}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: { boxShadow: '0px 10px 20px -2px rgba(0,0,0,0.25)', borderRadius: 2 }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Typography variant="h6" component="span">
          {t(
            'dialog.localModeShareError.headline',
            'This share link needs a session backend.'
          )}
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ pt: 0 }}>
        <Typography variant="body2" color="text.secondary">
          {t(
            'dialog.localModeShareError.body',
            'Share links can only be opened from an Axoview instance running with server storage. Deploy via Docker or Cloudflare to view shared diagrams.'
          )}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, pb: 2.5, pt: 1 }}>
        <Button variant="contained" onClick={onDismiss} autoFocus>
          {t('dialog.localModeShareError.btnDismiss', 'OK')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
