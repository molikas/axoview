import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Chip,
  IconButton,
  Popover,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography
} from '@mui/material';
import { DeleteOutline as DeleteIcon } from '@mui/icons-material';

const SESSION_DIAGRAM_PREFIX = 'fossflow_diagram_';
const SESSION_DIAGRAMS_KEY = 'fossflow_diagrams';

// Session storage budget is browser-dependent; ~5 MB per origin is the common
// floor (Chromium/Firefox/Safari). The gauge is informational, not a hard limit.
const APPROX_LIMIT_BYTES = 5 * 1024 * 1024;

interface DiagramRow {
  id: string;
  name: string;
  sizeBytes: number;
  lastModified?: string;
}

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const computeRows = (): { rows: DiagramRow[]; totalBytes: number } => {
  if (typeof sessionStorage === 'undefined') return { rows: [], totalBytes: 0 };

  // Build a name/lastModified lookup from the index, if present.
  const indexById = new Map<string, { name: string; lastModified?: string }>();
  try {
    const raw = sessionStorage.getItem(SESSION_DIAGRAMS_KEY);
    if (raw) {
      const list = JSON.parse(raw) as Array<{
        id: string;
        name: string;
        lastModified?: string;
      }>;
      for (const d of list) indexById.set(d.id, { name: d.name, lastModified: d.lastModified });
    }
  } catch {
    // ignore — index missing or malformed
  }

  let totalBytes = 0;
  const rows: DiagramRow[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (!key || !key.startsWith('fossflow_')) continue;
    const value = sessionStorage.getItem(key) ?? '';
    // UTF-16 code units × 2 bytes is the rough storage cost in browsers.
    const bytes = (key.length + value.length) * 2;
    totalBytes += bytes;

    if (key.startsWith(SESSION_DIAGRAM_PREFIX)) {
      const id = key.slice(SESSION_DIAGRAM_PREFIX.length);
      const meta = indexById.get(id);
      rows.push({
        id,
        name: meta?.name ?? id,
        sizeBytes: bytes,
        lastModified: meta?.lastModified
      });
    }
  }
  rows.sort((a, b) => b.sizeBytes - a.sizeBytes);
  return { rows, totalBytes };
};

interface Props {
  onDeleteDiagram?: (id: string) => Promise<void> | void;
}


export function SessionStorageGauge({ onDeleteDiagram }: Props) {
  const [{ rows, totalBytes }, setState] = useState(() => computeRows());
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const refresh = useCallback(() => setState(computeRows()), []);

  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener('fossflow-session-changed', handler);
    return () => window.removeEventListener('fossflow-session-changed', handler);
  }, [refresh]);

  const usedLabel = useMemo(() => formatBytes(totalBytes), [totalBytes]);
  const limitLabel = useMemo(() => formatBytes(APPROX_LIMIT_BYTES), []);
  const ratio = totalBytes / APPROX_LIMIT_BYTES;
  const percentLabel =
    totalBytes === 0
      ? '0%'
      : ratio < 0.01
        ? '<1%'
        : `${Math.round(ratio * 100)}%`;
  const color: 'default' | 'warning' | 'error' =
    ratio > 0.9 ? 'error' : ratio > 0.6 ? 'warning' : 'default';

  return (
    <>
      <Tooltip
        title={`Session storage: ${percentLabel} used (${usedLabel} of ~${limitLabel}) — click for breakdown`}
        placement="bottom"
      >
        <Chip
          size="small"
          label={`${percentLabel} · ${usedLabel}`}
          color={color}
          variant={color === 'default' ? 'outlined' : 'filled'}
          onClick={(e) => setAnchor(e.currentTarget)}
          sx={{
            height: 18,
            fontSize: '0.625rem',
            cursor: 'pointer',
            '& .MuiChip-label': { px: 0.75 }
          }}
        />
      </Tooltip>

      <Popover
        open={!!anchor}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { p: 1.5, minWidth: 320, maxWidth: 480 } } }}
      >
        <Stack spacing={1}>
          <Typography variant="subtitle2">Session storage</Typography>
          <Typography variant="caption" color="text.secondary">
            {usedLabel} used of approximately {limitLabel}. Your work lives in this browser tab only.
          </Typography>

          {rows.length === 0 ? (
            <Typography variant="caption" color="text.secondary">
              No diagrams stored.
            </Typography>
          ) : (
            <TableContainer sx={{ maxHeight: 280 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell align="right">Size</TableCell>
                    <TableCell align="right">Modified</TableCell>
                    <TableCell padding="none" />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.name}
                      </TableCell>
                      <TableCell align="right">{formatBytes(row.sizeBytes)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                        {row.lastModified ? new Date(row.lastModified).toLocaleDateString() : '—'}
                      </TableCell>
                      <TableCell padding="none">
                        {onDeleteDiagram && (
                          <Tooltip title="Delete diagram" placement="left">
                            <IconButton
                              size="small"
                              onClick={async () => {
                                await onDeleteDiagram(row.id);
                                refresh();
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          <Typography variant="caption" color="text.secondary">
            Export your project to keep this work safely. For raw diagnostics, use Settings → Diagnostics.
          </Typography>
        </Stack>
      </Popover>
    </>
  );
}
