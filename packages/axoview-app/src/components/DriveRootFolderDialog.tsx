import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Radio,
  RadioGroup,
  TextField,
  Typography,
  type PaperProps
} from '@mui/material';
import { DEFAULT_ROOT_NAME } from '../services/storage/providers/GoogleDriveProvider';

interface Props {
  open: boolean;
  onConfirm: (folderName: string) => Promise<void> | void;
  onCancel: () => void;
}

/**
 * First-connect Google Drive root-folder chooser (ADR 0036 §2). Default folder
 * name is `axoview-diagrams`; the user may pick a custom name instead. The
 * chosen folder is stamped with a marker in Drive so the choice travels with the
 * account. Cancelling reverts to local storage.
 */
export function DriveRootFolderDialog({ open, onConfirm, onCancel }: Props) {
  const { t } = useTranslation('app');
  const [mode, setMode] = useState<'default' | 'custom'>('default');
  const [customName, setCustomName] = useState('');
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm(
        mode === 'default' ? DEFAULT_ROOT_NAME : customName.trim() || DEFAULT_ROOT_NAME
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      maxWidth="xs"
      fullWidth
      onClose={(_e, reason) => {
        if (reason === 'backdropClick') return; // force an explicit choice
        onCancel();
      }}
      onKeyDown={(e) => {
        // §3.2 — Enter confirms (Escape is MUI-native), except from a focused
        // button/link, which keeps its own Enter activation (Cancel must not
        // confirm). Radios and the custom-name TextField confirm — the
        // natural flow for both.
        if (e.key !== 'Enter' || busy) return;
        const target = e.target as HTMLElement;
        if (target.closest('button, a, [role="button"]')) return;
        e.preventDefault();
        void handleConfirm();
      }}
      slotProps={{
        paper: {
          'data-axoview-id': 'drive-root-dialog',
          sx: { boxShadow: '0px 10px 20px -2px rgba(0,0,0,0.25)', borderRadius: 2 }
        } as PaperProps
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Typography variant="h6" component="span">
          {t('driveRoot.title', 'Choose your Google Drive folder')}
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ pt: 0 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t(
            'driveRoot.body',
            'Axoview keeps your diagrams in one folder in your Google Drive. It can only see the files it creates there — nothing else in your Drive.'
          )}
        </Typography>
        <RadioGroup
          value={mode}
          onChange={(e) => setMode(e.target.value as 'default' | 'custom')}
        >
          <FormControlLabel
            value="default"
            control={<Radio size="small" />}
            label={t('driveRoot.defaultOption', {
              defaultValue: 'Default folder ({{name}})',
              name: DEFAULT_ROOT_NAME
            })}
          />
          <FormControlLabel
            value="custom"
            control={<Radio size="small" />}
            label={t('driveRoot.customOption', 'Custom folder name')}
          />
        </RadioGroup>
        {mode === 'custom' && (
          <TextField
            autoFocus
            fullWidth
            size="small"
            placeholder={t('driveRoot.customPlaceholder', 'My Diagrams')}
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            sx={{ mt: 1 }}
            inputProps={{ 'data-axoview-id': 'drive-root-custom-name' }}
          />
        )}
      </DialogContent>
      <DialogActions sx={{ px: 2.5, pb: 2.5, pt: 1 }}>
        <Button variant="text" onClick={onCancel} disabled={busy}>
          {t('driveRoot.cancel', 'Cancel')}
        </Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={busy}
          data-axoview-id="drive-root-confirm"
        >
          {busy ? t('driveRoot.confirmBusy', 'Setting up…') : t('driveRoot.confirm', 'Continue')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
