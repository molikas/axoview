import { useTranslation } from 'react-i18next';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Typography
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

interface Props {
  diagramName: string;
  onNameChange: (name: string) => void;
  onSave: () => void;
  onClose: () => void;
}

export function SaveDialog({ diagramName, onNameChange, onSave, onClose }: Props) {
  const { t } = useTranslation('app');

  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      slotProps={{ paper: { sx: { boxShadow: '0px 10px 20px -2px rgba(0,0,0,0.25)', borderRadius: 2 } } }}
    >
      <DialogTitle sx={{ pb: 1, pr: 6 }}>
        <Typography variant="h6" component="span">
          {t('dialog.save.title')}
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
        <TextField
          fullWidth
          autoFocus
          size="small"
          placeholder={t('dialog.save.placeholder')}
          value={diagramName}
          onChange={(e) => onNameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onSave();
            }
          }}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 2.5, pb: 2.5, pt: 1 }}>
        <Button variant="text" onClick={onClose}>
          {t('dialog.save.btnCancel')}
        </Button>
        <Button variant="contained" onClick={onSave} disabled={!diagramName.trim()}>
          {t('dialog.save.btnSave')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
