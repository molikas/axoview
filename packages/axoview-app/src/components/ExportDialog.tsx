import { useTranslation } from 'react-i18next';
import {
  Alert,
  AlertTitle,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

interface Props {
  onExport: () => void;
  onClose: () => void;
}

export function ExportDialog({ onExport, onClose }: Props) {
  const { t } = useTranslation('app');

  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { boxShadow: '0px 10px 20px -2px rgba(0,0,0,0.25)', borderRadius: 2 } }}
    >
      <DialogTitle sx={{ pb: 1, pr: 6 }}>
        <Typography variant="h6" component="span">
          {t('dialog.export.title')}
        </Typography>
        <IconButton
          size="small"
          onClick={onClose}
          sx={{ position: 'absolute', top: 12, right: 12, color: 'text.secondary' }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 0 }}>
        <Alert severity="success" sx={{ mt: 1 }}>
          <AlertTitle sx={{ mb: 0.5 }}>
            {t('dialog.export.recommendedTitle')}
          </AlertTitle>
          <Typography variant="body2">
            {t('dialog.export.recommendedMessage')}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            {t('dialog.export.noteMessage')}
          </Typography>
        </Alert>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, pb: 2.5, pt: 1 }}>
        <Button variant="text" onClick={onClose}>
          {t('dialog.export.btnCancel')}
        </Button>
        <Button variant="contained" onClick={onExport} autoFocus>
          {t('dialog.export.btnDownload')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
