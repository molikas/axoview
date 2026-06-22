import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Box,
  Divider
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { DialogTypeEnum } from 'src/types/ui';
import { FIXED_SHORTCUTS } from 'src/config/shortcuts';
import { TOOL_HOTKEYS } from 'src/config/hotkeys';
import { useTranslation } from 'src/stores/localeStore';

export const HelpDialog = () => {
  const { t } = useTranslation('helpDialog');

  const dialog = useUiStateStore((state) => {
    return state.dialog;
  });
  const setDialog = useUiStateStore((state) => {
    return state.actions.setDialog;
  });

  const isOpen = dialog === DialogTypeEnum.HELP;

  const handleClose = () => {
    setDialog(null);
  };

  // D10 — TOOL_HOTKEYS values are `string | null` (HotkeyMapping). The current
  // scheme binds every tool, but stay null-safe (and uppercase for display).
  const keyLabel = (key: string | null): string => (key ?? '').toUpperCase();

  const keyboardShortcuts = [
    {
      action: t('undoAction'),
      shortcut: FIXED_SHORTCUTS.undo,
      description: t('undoDescription')
    },
    {
      action: t('redoAction'),
      shortcut: FIXED_SHORTCUTS.redo,
      description: t('redoDescription')
    },
    {
      action: t('redoAltAction'),
      shortcut: FIXED_SHORTCUTS.redoAlt,
      description: t('redoAltDescription')
    },
    {
      action: t('helpAction'),
      shortcut: FIXED_SHORTCUTS.help,
      description: t('helpDescription')
    },
    {
      action: t('zoomInAction'),
      shortcut: t('zoomInShortcut'),
      description: t('zoomInDescription')
    },
    {
      action: t('zoomOutAction'),
      shortcut: t('zoomOutShortcut'),
      description: t('zoomOutDescription')
    },
    {
      action: t('lassoSelectAction'),
      shortcut: t('lassoSelectShortcut'),
      description: t('lassoSelectDescription')
    },
    {
      action: t('deselectAction'),
      shortcut: t('deselectShortcut'),
      description: t('deselectDescription')
    },
    {
      // D10 — was hardcoded English; now routed through helpDialog keys.
      action: t('selectAllAction'),
      shortcut: t('selectAllShortcut'),
      description: t('selectAllDescription')
    },
    {
      action: t('deleteSelectedAction'),
      shortcut: t('deleteSelectedShortcut'),
      description: t('deleteSelectedDescription')
    },
    // D10 — undocumented tool-activation keys (ADR 0022 §6 locked defaults), now
    // surfaced so users can learn them. Tool keys come from TOOL_HOTKEYS;
    // F2 (rename) is a fixed handler key, not a rebindable tool hotkey.
    {
      action: t('keySelectAction'),
      shortcut: keyLabel(TOOL_HOTKEYS.select),
      description: t('keySelectDescription')
    },
    {
      action: t('keyAddItemAction'),
      shortcut: keyLabel(TOOL_HOTKEYS.addItem),
      description: t('keyAddItemDescription')
    },
    {
      action: t('keyConnectorAction'),
      shortcut: keyLabel(TOOL_HOTKEYS.connector),
      description: t('keyConnectorDescription')
    },
    {
      action: t('keyLassoAction'),
      shortcut: keyLabel(TOOL_HOTKEYS.lasso),
      description: t('keyLassoDescription')
    },
    {
      action: t('keyRenameAction'),
      shortcut: 'F2',
      description: t('keyRenameDescription')
    },
    {
      action: t('cutAction'),
      shortcut: FIXED_SHORTCUTS.cut,
      description: t('cutDescription')
    },
    {
      action: t('copyAction'),
      shortcut: FIXED_SHORTCUTS.copy,
      description: t('copyDescription')
    },
    {
      action: t('pasteAction'),
      shortcut: FIXED_SHORTCUTS.paste,
      description: t('pasteDescription')
    }
  ];

  // D10 — the one opinionated pointer model (ADR 0022), now routed through
  // helpDialog keys (was a hardcoded English array). `*Method` is the column-2
  // gesture string.
  const mouseInteractions = [
    {
      action: t('miSelectAction'),
      shortcut: t('miSelectMethod'),
      description: t('miSelectDescription')
    },
    {
      action: t('miOpenDetailsAction'),
      shortcut: t('miOpenDetailsMethod'),
      description: t('miOpenDetailsDescription')
    },
    {
      action: t('miToggleSelectionAction'),
      shortcut: t('miToggleSelectionMethod'),
      description: t('miToggleSelectionDescription')
    },
    {
      action: t('miPanAction'),
      shortcut: t('miPanMethod'),
      description: t('miPanDescription')
    },
    {
      action: t('miContextMenuAction'),
      shortcut: t('miContextMenuMethod'),
      description: t('miContextMenuDescription')
    },
    {
      action: t('miRemoveWaypointAction'),
      shortcut: t('miRemoveWaypointMethod'),
      description: t('miRemoveWaypointDescription')
    },
    {
      action: t('miZoomAction'),
      shortcut: t('miZoomMethod'),
      description: t('miZoomDescription')
    }
  ];

  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            minHeight: '60vh'
          },
          'data-axoview-id': 'dialog-help'
        } as React.ComponentProps<'div'>
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6" component="div">
            {t('title')}
          </Typography>
          <Button
            onClick={handleClose}
            sx={{
              minWidth: 'auto',
              p: 1,
              bgcolor: 'transparent',
              boxShadow: 'none',
              '&:hover': { bgcolor: 'transparent' },
              '&:focus': { bgcolor: 'transparent' },
              '&:active': { bgcolor: 'transparent' }
            }}
          >
            <CloseIcon />
          </Button>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            {t('keyboardShortcuts')}
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>
                    {t('action')}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>
                    {t('shortcut')}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>
                    {t('description')}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {keyboardShortcuts.map((shortcut) => {
                  return (
                    <TableRow key={shortcut.action}>
                      <TableCell>{shortcut.action}</TableCell>
                      <TableCell>
                        <code
                          style={{
                            backgroundColor: '#f5f5f5',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontFamily: 'monospace'
                          }}
                        >
                          {shortcut.shortcut}
                        </code>
                      </TableCell>
                      <TableCell>{shortcut.description}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>

        <Divider sx={{ my: 3 }} />

        <Box>
          <Typography variant="h6" gutterBottom>
            {t('mouseInteractions')}
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>
                    {t('action')}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>
                    {t('method')}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>
                    {t('description')}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {mouseInteractions.map((interaction) => {
                  return (
                    <TableRow key={interaction.action}>
                      <TableCell>{interaction.action}</TableCell>
                      <TableCell>
                        <code
                          style={{
                            backgroundColor: '#f5f5f5',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontFamily: 'monospace'
                          }}
                        >
                          {interaction.shortcut}
                        </code>
                      </TableCell>
                      <TableCell>{interaction.description}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>

        <Box sx={{ mt: 3, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
          <Typography variant="body2" color="info.contrastText">
            <strong>{t('note')}</strong> {t('noteContent')}
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button
          onClick={handleClose}
          variant="contained"
          data-axoview-id="dialog-help-close"
        >
          {t('close')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
