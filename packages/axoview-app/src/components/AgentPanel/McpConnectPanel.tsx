// MCP connect panel (ADR 0046 §1/§3) — the PRIMARY tier. The user points their own
// AI (Claude.ai / ChatGPT / Cursor, on their existing subscription) at Axoview as a
// remote MCP connector. This panel mints a pairing code, opens the WebSocket to the
// session Durable Object, registers the tab, and shows the endpoint URL + code to
// paste into the MCP client. No API key — inference runs in the user's own app.

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
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
  disconnectMcp,
  subscribeMcp,
  getMcpState,
  defaultWorkerBaseUrl,
  fetchConfiguredMcpUrl,
  McpStatus
} from '../../services/agent/mcpConnection';

const STATUS_LABEL: Record<McpStatus, string> = {
  idle: 'Not connected',
  pairing: 'Requesting code…',
  connecting: 'Connecting…',
  connected: 'Connected',
  reconnecting: 'Reconnecting…',
  closed: 'Disconnected',
  error: 'Connection error'
};

// The copy-paste prompt a user hands to their desktop ChatGPT / Claude to set up
// the connection and start working. Self-contained: carries the endpoint + intent.
const buildAiPrompt = (mcpUrl: string, allowEdits: boolean): string => {
  const setup =
    `Please connect to my Axoview diagram and help me with it.\n\n` +
    `Add this as a remote MCP connector in your app (connector type: "HTTP" / ` +
    `"Streamable HTTP"):\n${mcpUrl}\n\n`;
  return allowEdits
    ? setup +
        `Then load the Axoview "modeling-skill" prompt, read my current diagram, ` +
        `and ask me what I'd like to build or change. Describe the topology (the ` +
        `nodes and how they connect) and let Axoview place everything — never ` +
        `compute tile coordinates. You'll be asked to confirm any deletions.`
    : setup +
        `Then load the Axoview "modeling-skill" prompt and read my current diagram, ` +
        `then tell me what's on it or answer my questions. This connection is ` +
        `READ-ONLY — you can read the diagram but cannot change it.`;
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
  const [busy, setBusy] = useState(false);

  // The connection is a module-level singleton (survives panel close). The panel
  // is a thin subscriber — it never tears the socket down on unmount.
  const mcp = useSyncExternalStore(subscribeMcp, getMcpState);
  const { status, session, detail } = mcp;

  // Seed the server field when empty. The panel unmounts on close, so on every
  // (re)open: if a connection is live, reflect its URL (so the field isn't blank
  // while connected / after disconnect); otherwise prefill from /api/config (prod:
  // the standalone MCP Worker URL isn't derivable from the Pages origin — dev
  // defaults to the local wrangler port). Runs once on mount.
  useEffect(() => {
    if (baseUrl) return;
    if (session) {
      setBaseUrl(session.baseUrl);
      return;
    }
    let cancelled = false;
    void fetchConfiguredMcpUrl().then((url) => {
      if (!cancelled && url) setBaseUrl((cur) => cur || url);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = useCallback(async () => {
    setBusy(true);
    try {
      const scope: AgentScope = allowEdits ? 'write' : 'read';
      await connectMcp({
        baseUrl: baseUrl.trim().replace(/\/$/, ''),
        scope,
        // Feature A.5 — in write mode, confirm destructive actions. (v1: browser
        // confirm; a themed dialog is a later refinement.)
        confirmDestructive: allowEdits
          ? (summary) =>
              Promise.resolve(
                window.confirm(`The connected AI wants to ${summary}.\n\nAllow this?`)
              )
          : undefined
      });
    } catch {
      // status/detail are surfaced via the store
    } finally {
      setBusy(false);
    }
  }, [baseUrl, allowEdits]);

  const disconnect = useCallback(() => disconnectMcp(), []);

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).catch(() => undefined);
  };

  const connected = status === 'connected';

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
            Let your AI (ChatGPT, Claude, Cursor…) read and edit this diagram using
            your own subscription — <strong>no API key</strong>. Pick access below,
            allow pairing, then copy the prompt for your AI.
          </Alert>

          <TextField
            size="small"
            fullWidth
            label="Axoview MCP server"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            disabled={connected || busy}
            placeholder="https://axoview-mcp.<your-subdomain>.workers.dev"
            helperText="Your axoview-mcp Worker URL (in dev: http://127.0.0.1:8787)."
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
                ? 'The AI can create, edit, and delete on this canvas. Destructive actions ask for confirmation, and every AI action is one undo (Ctrl+Z).'
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
              Allow pairing
            </Button>
          ) : (
            <Stack spacing={2}>
              <Alert
                severity={
                  connected ? 'success' : status === 'error' ? 'error' : 'info'
                }
                sx={{ py: 0.5 }}
              >
                {connected
                  ? 'Ready — copy the prompt below into ChatGPT, Claude, or any MCP client.'
                  : status === 'error'
                    ? `Couldn't open the canvas link${detail ? `: ${detail}` : ''}. The prompt still works once this tab registers.`
                    : 'Opening the canvas link…'}
              </Alert>

              {/* The main action for a non-technical user: copy one prompt. */}
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Prompt for your AI — paste into your desktop ChatGPT / Claude
                </Typography>
                <TextField
                  multiline
                  fullWidth
                  minRows={5}
                  maxRows={12}
                  value={buildAiPrompt(session!.mcpUrl, allowEdits)}
                  slotProps={{ input: { readOnly: true, sx: { fontSize: 12 } } }}
                  sx={{ mt: 0.5 }}
                />
                <Button
                  variant="contained"
                  fullWidth
                  startIcon={<CopyIcon />}
                  onClick={() =>
                    copy(buildAiPrompt(session!.mcpUrl, allowEdits))
                  }
                  sx={{ mt: 1 }}
                >
                  Copy prompt
                </Button>
              </Box>

              <Divider>or set it up manually</Divider>

              <Box>
                <Typography variant="caption" color="text.secondary">
                  Connector URL (add as a remote MCP / Streamable-HTTP connector)
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
                <Typography variant="caption" color="text.secondary">
                  Code {session!.code} · expires in ~10 min · keep this tab open.
                </Typography>
              </Box>

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

          {baseUrl.includes('127.0.0.1') && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mt: 3 }}
            >
              Local testing: run the worker with <code>wrangler dev</code>, then
              point the{' '}
              <a
                href="https://github.com/modelcontextprotocol/inspector"
                target="_blank"
                rel="noreferrer"
              >
                MCP Inspector
              </a>{' '}
              at the endpoint above.
            </Typography>
          )}
        </Box>
      </Stack>
    </Drawer>
  );
}
