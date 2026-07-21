// MCP connect panel (ADR 0046 §1/§3) — the PRIMARY tier. The user points their own
// AI (Claude.ai / ChatGPT / Cursor, on their existing subscription) at Axoview as a
// remote MCP connector. This panel mints a pairing code, opens the WebSocket to the
// session Durable Object, registers the tab, and shows the endpoint URL + code to
// paste into the MCP client. No API key — inference runs in the user's own app.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Drawer,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  TextField,
  Typography
} from '@mui/material';
import type { AgentScope } from 'axoview';
import {
  Close as CloseIcon,
  ContentCopyOutlined as CopyIcon,
  LinkOff as DisconnectIcon
} from '@mui/icons-material';
import {
  connectMcp,
  defaultWorkerBaseUrl,
  McpSession,
  McpStatus
} from '../../services/agent/mcpConnection';

const STATUS_LABEL: Record<McpStatus, string> = {
  idle: 'Not connected',
  pairing: 'Requesting code…',
  connecting: 'Connecting…',
  connected: 'Connected',
  closed: 'Disconnected',
  error: 'Connection error'
};

export function McpConnectPanel({
  open,
  onClose
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [baseUrl, setBaseUrl] = useState(defaultWorkerBaseUrl());
  // Fail-safe default: read-only. The user opts INTO edits (Feature A).
  const [allowEdits, setAllowEdits] = useState(false);
  const [status, setStatus] = useState<McpStatus>('idle');
  const [detail, setDetail] = useState<string | null>(null);
  const [session, setSession] = useState<McpSession | null>(null);
  const [busy, setBusy] = useState(false);
  const sessionRef = useRef<McpSession | null>(null);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // Tear the socket down when the panel unmounts.
  useEffect(
    () => () => {
      sessionRef.current?.close();
    },
    []
  );

  const connect = useCallback(async () => {
    setBusy(true);
    setDetail(null);
    try {
      const scope: AgentScope = allowEdits ? 'write' : 'read';
      const s = await connectMcp({
        baseUrl: baseUrl.trim().replace(/\/$/, ''),
        scope,
        onStatus: (st, d) => {
          setStatus(st);
          if (d) setDetail(d);
        }
      });
      setSession(s);
    } catch (e) {
      setStatus('error');
      setDetail(e instanceof Error ? e.message : 'Failed to connect.');
    } finally {
      setBusy(false);
    }
  }, [baseUrl, allowEdits]);

  const disconnect = useCallback(() => {
    session?.close();
    setSession(null);
    setStatus('idle');
  }, [session]);

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).catch(() => undefined);
  };

  const connected = status === 'connected' && !!session;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: 420, maxWidth: '100vw' } } }}
      data-axoview-id="mcp-connect-panel"
    >
      <Stack sx={{ height: '100%' }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}
        >
          <Typography variant="subtitle1" fontWeight={600}>
            Connect your AI
          </Typography>
          <IconButton size="small" onClick={onClose} aria-label="Close panel">
            <CloseIcon />
          </IconButton>
        </Stack>

        <Box sx={{ p: 2, overflowY: 'auto', flex: 1 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            Point your own AI (Claude.ai, Cursor, an MCP client) at Axoview as a
            <strong> remote MCP connector</strong>. It reads and edits this canvas
            through your existing subscription — <strong>no API key</strong>.
          </Alert>

          <TextField
            size="small"
            fullWidth
            label="Axoview MCP server"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            disabled={connected || busy}
            helperText="Same origin in production; your local wrangler port in dev."
            sx={{ mb: 2 }}
          />

          {/* Permission scope (Feature A) — read-only by default; the user opts
              into edits. Locked once connected (reconnect to change). */}
          <Box sx={{ mb: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={allowEdits}
                  onChange={(e) => setAllowEdits(e.target.checked)}
                  disabled={connected || busy}
                  color="warning"
                />
              }
              label={allowEdits ? 'Allow edits (read-write)' : 'Read-only'}
            />
            <Typography variant="caption" color="text.secondary" display="block">
              {allowEdits
                ? 'The AI can create, edit, and delete on this canvas. Every AI action is one undo (Ctrl+Z).'
                : 'The AI can only read the canvas — it cannot edit or delete anything.'}
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            <Chip
              size="small"
              label={STATUS_LABEL[status]}
              color={
                connected ? 'success' : status === 'error' ? 'error' : 'default'
              }
              variant={connected ? 'filled' : 'outlined'}
            />
            {busy && <CircularProgress size={16} />}
          </Stack>

          {detail && status === 'error' && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {detail}
            </Alert>
          )}

          {!session ? (
            <Button
              variant="contained"
              fullWidth
              onClick={() => void connect()}
              disabled={busy || baseUrl.trim().length === 0}
            >
              Connect
            </Button>
          ) : (
            <Stack spacing={2}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Pairing code (keep this tab open)
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography
                    variant="h5"
                    sx={{ fontFamily: 'monospace', letterSpacing: 2 }}
                  >
                    {session!.code}
                  </Typography>
                  <IconButton size="small" onClick={() => copy(session!.code)}>
                    <CopyIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </Box>

              <Box>
                <Typography variant="caption" color="text.secondary">
                  MCP endpoint — add this as a remote connector in your AI app
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <TextField
                    size="small"
                    fullWidth
                    value={session!.mcpUrl}
                    slotProps={{
                      input: {
                        readOnly: true,
                        sx: { fontFamily: 'monospace', fontSize: 12 }
                      }
                    }}
                  />
                  <IconButton size="small" onClick={() => copy(session!.mcpUrl)}>
                    <CopyIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </Box>

              {connected ? (
                <Alert severity="success" sx={{ py: 0.5 }}>
                  Tab registered — tool calls from your AI now route to this
                  canvas. Paste the endpoint above into your MCP client.
                </Alert>
              ) : status === 'error' ? (
                <Alert severity="error" sx={{ py: 0.5 }}>
                  Socket didn’t open{detail ? `: ${detail}` : ''}. The endpoint is
                  valid, but tool calls will return “no active canvas” until the
                  tab registers. Check the worker is running and retry.
                </Alert>
              ) : (
                <Alert severity="info" sx={{ py: 0.5 }}>
                  Opening the canvas socket… the endpoint above is ready to paste.
                </Alert>
              )}

              <Button
                variant="outlined"
                color="inherit"
                startIcon={<DisconnectIcon />}
                onClick={disconnect}
              >
                Disconnect
              </Button>
            </Stack>
          )}

          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mt: 3 }}
          >
            Local testing: run the worker with{' '}
            <code>wrangler dev</code>, then point the{' '}
            <a
              href="https://github.com/modelcontextprotocol/inspector"
              target="_blank"
              rel="noreferrer"
            >
              MCP Inspector
            </a>{' '}
            at the endpoint above.
          </Typography>
        </Box>
      </Stack>
    </Drawer>
  );
}
