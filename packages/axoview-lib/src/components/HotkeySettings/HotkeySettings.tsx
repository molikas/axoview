import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import { TOOL_HOTKEYS } from 'src/config/hotkeys';
import { FIXED_SHORTCUTS } from 'src/config/shortcuts';
import { useTranslation } from 'src/stores/localeStore';

// Read-only hotkey reference (ADR 0022 §6). The profile selector + rebinding
// were removed — tool keys are one fixed scheme. Users can still LEARN the keys
// here (and in the Help dialog); customization returns when per-user storage
// exists.
export const HotkeySettings = () => {
  const { t } = useTranslation();

  const tools = [
    { name: t('settings.hotkeys.toolSelect'), key: TOOL_HOTKEYS.select },
    { name: t('settings.hotkeys.toolPan'), key: TOOL_HOTKEYS.pan },
    { name: t('settings.hotkeys.toolAddItem'), key: TOOL_HOTKEYS.addItem },
    { name: t('settings.hotkeys.toolRectangle'), key: TOOL_HOTKEYS.rectangle },
    { name: t('settings.hotkeys.toolConnector'), key: TOOL_HOTKEYS.connector },
    { name: t('settings.hotkeys.toolText'), key: TOOL_HOTKEYS.text }
  ];

  return (
    <Box sx={{ p: 2 }}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ mb: 2, display: 'block' }}
      >
        {t('settings.hotkeys.note')}
      </Typography>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('settings.hotkeys.tool')}</TableCell>
              <TableCell>{t('settings.hotkeys.hotkey')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tools.map((tool) => (
              <TableRow key={tool.name}>
                <TableCell>{tool.name}</TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                    {tool.key ? tool.key.toUpperCase() : '-'}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="subtitle1" sx={{ mt: 3, mb: 1, fontWeight: 'bold' }}>
        {t('settings.hotkeys.fixedShortcutsTitle')}
      </Typography>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('settings.hotkeys.tool')}</TableCell>
              <TableCell>{t('settings.hotkeys.hotkey')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {[
              {
                name: t('settings.hotkeys.fixedCut'),
                key: FIXED_SHORTCUTS.cut
              },
              {
                name: t('settings.hotkeys.fixedCopy'),
                key: FIXED_SHORTCUTS.copy
              },
              {
                name: t('settings.hotkeys.fixedPaste'),
                key: FIXED_SHORTCUTS.paste
              },
              {
                name: t('settings.hotkeys.fixedUndo'),
                key: FIXED_SHORTCUTS.undo
              },
              {
                name: t('settings.hotkeys.fixedRedo'),
                key: `${FIXED_SHORTCUTS.redo} / ${FIXED_SHORTCUTS.redoAlt}`
              }
            ].map((item) => (
              <TableRow key={item.name}>
                <TableCell>{item.name}</TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                    {item.key}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};
