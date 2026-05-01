import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  Radio,
  RadioGroup,
  Stack,
  Typography
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import {
  exportAsJSON,
  exportAsCompactJSON,
  stripDefaultIcons,
  mergeBundledFixtures
} from 'fossflow';
import { StorageProvider } from '../../services/storage';
import {
  exportProject,
  ExportScope
} from '../../services/project/projectZip';
import { downloadBlob } from '../../utils/downloadBlob';

export type ExportFormat = 'json' | 'compactJson' | 'png' | 'svg' | 'projectZip';

interface Props {
  open: boolean;
  onClose: () => void;
  scope: ExportScope;
  folderId?: string;
  diagramId?: string;
  diagramName?: string;
  folderName?: string;
  storage: StorageProvider;
  exporterTag: string;
  /** Provided when scope='diagram' AND that diagram is currently loaded on the canvas. */
  canvasExportImage?: (format: 'png' | 'svg') => Promise<void>;
  /** Called after a successful project-zip export so the caller can clear sessionWorkUnexported. */
  onProjectZipExported?: () => void;
}

interface FormatOption {
  value: ExportFormat;
  label: string;
  validScopes: ExportScope[];
  needsCanvas?: boolean;
}

const FORMATS: FormatOption[] = [
  { value: 'json', label: 'JSON', validScopes: ['diagram'] },
  { value: 'compactJson', label: 'Compact JSON (LLM-friendly)', validScopes: ['diagram'] },
  { value: 'png', label: 'PNG image', validScopes: ['diagram'], needsCanvas: true },
  { value: 'svg', label: 'SVG image', validScopes: ['diagram'], needsCanvas: true },
  { value: 'projectZip', label: 'Project zip (.zip)', validScopes: ['project', 'folder'] }
];

const defaultFormatForScope = (scope: ExportScope): ExportFormat =>
  scope === 'diagram' ? 'json' : 'projectZip';

export function ExportDialog({
  open,
  onClose,
  scope,
  folderId,
  diagramId,
  diagramName,
  folderName,
  storage,
  exporterTag,
  canvasExportImage,
  onProjectZipExported
}: Props) {
  const [format, setFormat] = useState<ExportFormat>(() => defaultFormatForScope(scope));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setFormat(defaultFormatForScope(scope));
      setError(null);
    }
  }, [open, scope]);

  const isOptionEnabled = useMemo(() => {
    return (opt: FormatOption) => {
      if (!opt.validScopes.includes(scope)) return false;
      if (opt.needsCanvas && !canvasExportImage) return false;
      return true;
    };
  }, [scope, canvasExportImage]);

  const heading = useMemo(() => {
    if (scope === 'project') return 'Export project';
    if (scope === 'folder') return `Export folder${folderName ? ` "${folderName}"` : ''}`;
    return `Export "${diagramName ?? 'diagram'}"`;
  }, [scope, folderName, diagramName]);

  const handleExport = async () => {
    setBusy(true);
    setError(null);
    try {
      if (format === 'projectZip') {
        const { blob, filename } = await exportProject(
          { storage, exporterTag },
          { scope, folderId, diagramId }
        );
        downloadBlob(blob, filename);
        onProjectZipExported?.();
        onClose();
        return;
      }

      if (format === 'png' || format === 'svg') {
        if (!canvasExportImage) {
          setError('Image export requires the diagram to be open on the canvas.');
          return;
        }
        await canvasExportImage(format);
        onClose();
        return;
      }

      // JSON / compact JSON — load diagram from storage and serialize
      if (!diagramId) {
        setError('No diagram selected.');
        return;
      }
      const raw = await storage.loadDiagram(diagramId);
      // Re-merge bundled fixtures so the JSON is portable, then strip defaults
      // so the file stays small (exportAsJSON does its own strip — merge first
      // to ensure user-overridden fixtures are not silently dropped).
      const model = mergeBundledFixtures(raw as any);
      if (format === 'json') exportAsJSON(model);
      else exportAsCompactJSON(model);
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
            Choose a format. Project zips include diagrams, folders, and tree state.
          </Typography>
          <FormControl>
            <RadioGroup
              value={format}
              onChange={(_, v) => setFormat(v as ExportFormat)}
            >
              {FORMATS.map((opt) => {
                const enabled = isOptionEnabled(opt);
                return (
                  <FormControlLabel
                    key={opt.value}
                    value={opt.value}
                    disabled={!enabled}
                    control={<Radio size="small" />}
                    label={
                      <Box>
                        <Typography variant="body2">{opt.label}</Typography>
                        {opt.needsCanvas && !canvasExportImage && opt.validScopes.includes(scope) && (
                          <Typography variant="caption" color="text.secondary">
                            Open the diagram first to export an image.
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                );
              })}
            </RadioGroup>
          </FormControl>
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, pb: 2 }}>
        <Button onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleExport} disabled={busy}>
          {busy ? 'Exporting…' : 'Export'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export { stripDefaultIcons };
