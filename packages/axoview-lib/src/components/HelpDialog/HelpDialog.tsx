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
      action: t('addNodeGroupAction'),
      shortcut: t('addNodeGroupShortcut'),
      description: t('addNodeGroupDescription')
    },
    {
      action: 'Select All',
      shortcut: 'Ctrl+A',
      description:
        'Select every visible, unlocked item in the active view (items, rectangles, text boxes, connectors + their waypoints)'
    },
    {
      action: t('deleteSelectedAction'),
      shortcut: t('deleteSelectedShortcut'),
      description: t('deleteSelectedDescription')
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

  // The one opinionated pointer model (ADR 0022). Hardcoded English, matching
  // the pre-existing hardcoded rows in this dialog — the per-tool i18n keys
  // described the removed customizable model. Tool-activation keys (R/C/T/…)
  // live in the Hotkeys settings tab.
  const mouseInteractions = [
    {
      action: 'Select',
      shortcut: 'Left-click',
      description:
        'Click an item to select it (highlights it and shows the floating action bar). Click empty canvas to clear the selection.'
    },
    {
      action: 'Open details',
      shortcut: 'Double-click',
      description:
        'Double-click an item to open its details panel — the same as the “Details…” context-menu entry.'
    },
    {
      action: 'Toggle selection',
      shortcut: 'Ctrl/Cmd + Left-click',
      description:
        'Add or remove an item from the multi-selection; a connector toggles together with its waypoints.'
    },
    {
      action: 'Pan',
      shortcut: 'Right-click + drag',
      description:
        'Hold the right button and drag to pan the canvas. Middle-click drag pans too; arrow keys nudge it.'
    },
    {
      action: 'Context menu',
      shortcut: 'Right-click (tap)',
      description:
        'A right-click without dragging opens the context menu — the item menu over an item, or the canvas menu over empty space. On touch, long-press.'
    },
    {
      action: 'Remove waypoint',
      shortcut: 'Alt + Left-click',
      description:
        'Alt+click a connector waypoint to splice it out (no need to select the connector first); endpoint anchors are preserved.'
    },
    {
      action: 'Zoom',
      shortcut: 'Scroll wheel',
      description: 'Scroll to zoom toward the cursor.'
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
