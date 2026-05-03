import { useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { stripDefaultIcons } from 'fossflow';
import { StorageProvider } from '../../services/storage';
import {
  exportProject,
  ExportScope
} from '../../services/project/projectZip';
import { downloadBlob } from '../../utils/downloadBlob';

interface Props {
  open: boolean;
  onClose: () => void;
  scope: Exclude<ExportScope, 'diagram'>;
  folderId?: string;
  folderName?: string;
  storage: StorageProvider;
  exporterTag: string;
  /** Called after a successful project-zip export so the caller can clear sessionWorkUnexported. */
  onProjectZipExported?: () => void;
}

export function ExportDialog({
  open,
  onClose,
  scope,
  folderId,
  folderName,
  storage,
  exporterTag,
  onProjectZipExported
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const heading =
    scope === 'project'
      ? 'Export project'
      : `Export folder${folderName ? ` "${folderName}"` : ''}`;

  const description =
    scope === 'project'
      ? 'Bundles every diagram, folder, and tree state into a single .zip you can re-import later.'
      : 'Bundles this folder and everything inside into a .zip you can re-import later.';

  const handleExport = async () => {
    setBusy(true);
    setError(null);
    try {
      const { blob, filename } = await exportProject(
        { storage, exporterTag },
        { scope, folderId }
      );
      downloadBlob(blob, filename);
      onProjectZipExported?.();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Export failed';
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ pb: 1, pr: 6 }}>
        {heading}
        <IconButton
          size="small"
          onClick={onClose}
          disabled={busy}
          sx={{ position: 'absolute', top: 12, right: 12, color: 'text.secondary' }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, pb: 2 }}>
        <Button onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleExport} disabled={busy}>
          {busy ? 'Exporting…' : 'Download .zip'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export { stripDefaultIcons };
