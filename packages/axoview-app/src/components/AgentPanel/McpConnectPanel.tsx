// MCP connect panel (ADR 0046 §1/§3) — the PRIMARY tier. The user points their own
// AI (Claude.ai / ChatGPT / Cursor, on their existing subscription) at Axoview as a
// remote MCP connector. This panel mints a pairing code, opens the WebSocket to the
// session Durable Object, registers the tab, and hands the user ONE prompt to paste
// (or the raw connector URL). No API key — inference runs in the user's own app.
//
// The MCP server URL is resolved automatically (prod: /api/config → MCP_PUBLIC_URL;
// dev: the local wrangler port) — the user never picks it. V2 (2026-07-22): compact
// two-option layout (Ask AI / manual), collapsed by default, with hard timeouts +
// an actionable error state so a bad URL / down server never strands the spinner.

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
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
  ExpandMore as ExpandMoreIcon,
  LinkOff as DisconnectIcon,
  AutoAwesome as AiIcon,
  TuneOutlined as ManualIcon
} from '@mui/icons-material';
import {
  connectMcp,
  disconnectMcp,
  subscribeMcp,
  getMcpState,
  defaultWorkerBaseUrl,
  fetchConfiguredMcpUrl
} from '../../services/agent/mcpConnection';

const isDevHost = (): boolean => window.location.origin.includes(':3000');

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
  // Fail-safe default: read-only. The user opts INTO edits (Feature A).
  const [allowEdits, setAllowEdits] = useState(false);
  const [busy, setBusy] = useState(false);
  // undefined = still resolving; null = no MCP configured for this deploy.
  const [serverUrl, setServerUrl] = useState<string | null | undefined>(undefined);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showManual, setShowManual] = useState(false);

  // The connection is a module-level singleton (survives panel close). The panel
  // is a thin subscriber — it never tears the socket down on unmount.
  const mcp = useSyncExternalStore(subscribeMcp, getMcpState);
  const { status, session, detail } = mcp;

  // Resolve the MCP server URL automatically — the user never picks it. Dev uses
  // the local wrangler port; prod reads it from /api/config (the standalone MCP
  // Worker URL isn't derivable from the Pages origin). If a session is live,
  // reflect its URL.
  useEffect(() => {
    if (session) {
      setServerUrl(session.baseUrl);
      return;
    }
    const dev = defaultWorkerBaseUrl();
    if (dev) {
      setServerUrl(dev);
      return;
    }
    let cancelled = false;
    void fetchConfiguredMcpUrl().then((url) => {
      if (!cancelled) setServerUrl(url); // string | null
    });
    return () => {
      cancelled = true;
    };
  }, [session]);

  const connect = useCallback(async () => {
    if (!serverUrl) return;
    setBusy(true);
    try {
      const scope: AgentScope = allowEdits ? 'write' : 'read';
      await connectMcp({
        baseUrl: serverUrl.trim().replace(/\/$/, ''),
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
  }, [serverUrl, allowEdits]);

  const disconnect = useCallback(() => disconnectMcp(), []);
  const retry = useCallback(() => {
    disconnectMcp();
    void connect();
  }, [connect]);

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).catch(() => undefined);
  };

  const connected = status === 'connected';
  const pending =
    status === 'pairing' || status === 'connecting' || status === 'reconnecting';
  const errored = status === 'error';

  const prompt = session
    ? buildAiPrompt(session.mcpUrl, session.scope === 'write')
    : '';

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: 400, maxWidth: '100vw' } } }}
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
          {/* ---- CONNECTED: two clear options, collapsed by default ---- */}
          {connected && session ? (
            <Stack spacing={2}>
              <Alert severity="success" sx={{ py: 0.5 }}>
                Connected · {session.scope === 'write' ? 'edits allowed' : 'read-only'}.
                Set it up in your AI using one of the options below.
              </Alert>

              {/* Option 1 — Ask AI (recommended): one-click copy, prompt on demand */}
              <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <AiIcon fontSize="small" color="primary" />
                  <Typography variant="subtitle2" sx={{ flex: 1 }}>
                    Ask AI to set up the connection
                  </Typography>
                  <Chip size="small" label="Recommended" color="success" variant="outlined" />
                </Stack>
                <Button
                  variant="contained"
                  fullWidth
                  startIcon={<CopyIcon />}
                  onClick={() => copy(prompt)}
                >
                  Copy prompt
                </Button>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  Paste it into your desktop ChatGPT / Claude.
                </Typography>
                <Button
                  size="small"
                  color="inherit"
                  onClick={() => setShowPrompt((v) => !v)}
                  endIcon={
                    <ExpandMoreIcon
                      sx={{
                        transform: showPrompt ? 'rotate(180deg)' : 'none',
                        transition: '0.2s'
                      }}
                    />
                  }
                  sx={{ mt: 0.5, textTransform: 'none' }}
                >
                  {showPrompt ? 'Hide prompt' : 'Preview prompt'}
                </Button>
                <Collapse in={showPrompt}>
                  <TextField
                    multiline
                    fullWidth
                    minRows={4}
                    maxRows={12}
                    value={prompt}
                    slotProps={{ input: { readOnly: true, sx: { fontSize: 12 } } }}
                    sx={{ mt: 1 }}
                  />
                </Collapse>
              </Box>

              {/* Option 2 — manual: collapsed by default */}
              <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
                <Button
                  fullWidth
                  color="inherit"
                  onClick={() => setShowManual((v) => !v)}
                  startIcon={<ManualIcon fontSize="small" />}
                  endIcon={
                    <ExpandMoreIcon
                      sx={{
                        transform: showManual ? 'rotate(180deg)' : 'none',
                        transition: '0.2s'
                      }}
                    />
                  }
                  sx={{ textTransform: 'none', justifyContent: 'space-between' }}
                >
                  <Box sx={{ flex: 1, textAlign: 'left' }}>Set up manually</Box>
                </Button>
                <Collapse in={showManual}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                    Add as a remote MCP / Streamable-HTTP connector:
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                    <TextField
                      size="small"
                      fullWidth
                      value={session.mcpUrl}
                      slotProps={{
                        input: {
                          readOnly: true,
                          sx: { fontFamily: 'monospace', fontSize: 12 }
                        }
                      }}
                    />
                    <IconButton size="small" onClick={() => copy(session.mcpUrl)}>
                      <CopyIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    Code {session.code} · expires in ~10 min · keep this tab open.
                  </Typography>
                </Collapse>
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
          ) : pending ? (
            /* ---- PENDING: honest progress; a timeout flips this to error ---- */
            <Stack spacing={2} alignItems="center" sx={{ py: 4 }}>
              <CircularProgress size={28} />
              <Typography variant="body2">
                {status === 'reconnecting' ? 'Reconnecting…' : 'Contacting the MCP server…'}
              </Typography>
              <Typography variant="caption" color="text.secondary" textAlign="center">
                This can take a few seconds. It will stop and show an error if the
                server can't be reached.
              </Typography>
              <Button size="small" color="inherit" onClick={disconnect}>
                Cancel
              </Button>
            </Stack>
          ) : errored ? (
            /* ---- ERROR: clear cause + next steps + retry ---- */
            <Stack spacing={2}>
              <Alert severity="error">
                {detail || 'Could not connect to the MCP server.'}
              </Alert>
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Try this:
                </Typography>
                <Typography variant="body2" color="text.secondary" component="ul" sx={{ pl: 2, m: 0 }}>
                  <li>Keep this Axoview tab open, then retry.</li>
                  <li>Check your internet connection.</li>
                  <li>The server may be waking up — wait a moment and retry.</li>
                  {isDevHost() && (
                    <li>
                      Ensure <code>wrangler dev</code> is running on port 8787.
                    </li>
                  )}
                </Typography>
              </Box>
              <Button variant="contained" onClick={retry} disabled={busy}>
                Try again
              </Button>
            </Stack>
          ) : serverUrl === null ? (
            /* ---- NOT CONFIGURED (self-host / missing MCP_PUBLIC_URL) ---- */
            <Alert severity="warning">
              The AI connector isn't configured for this deployment. Set{' '}
              <code>MCP_PUBLIC_URL</code> to your <code>axoview-mcp</code> Worker URL
              to enable it.
            </Alert>
          ) : (
            /* ---- IDLE: pick access, then pair ---- */
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                Let your AI (ChatGPT, Claude, Cursor…) read or edit this diagram using
                your own subscription — <strong>no API key</strong>.
              </Typography>

              <Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={allowEdits}
                      onChange={(e) => setAllowEdits(e.target.checked)}
                      disabled={busy}
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

              <Button
                variant="contained"
                fullWidth
                onClick={() => void connect()}
                disabled={busy || serverUrl === undefined}
              >
                Allow pairing
              </Button>
            </Stack>
          )}
        </Box>
      </Stack>
    </Drawer>
  );
}
