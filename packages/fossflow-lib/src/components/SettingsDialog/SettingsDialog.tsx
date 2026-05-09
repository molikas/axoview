import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Tabs,
  Tab,
  Box,
  Typography
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { HotkeySettings } from '../HotkeySettings/HotkeySettings';
import { PanSettings } from '../PanSettings/PanSettings';
import { ZoomSettings } from '../ZoomSettings/ZoomSettings';
import { LabelSettings } from '../LabelSettings/LabelSettings';
import { ConnectorSettings } from '../ConnectorSettings/ConnectorSettings';
import { IconPackSettings } from '../IconPackSettings/IconPackSettings';
import { AboutTab } from './AboutTab';
import { DiagnosticsTab } from './DiagnosticsTab';
import { useTranslation } from 'src/stores/localeStore';

export interface SettingsDialogProps {
  iconPackManager?: {
    lazyLoadingEnabled: boolean;
    onToggleLazyLoading: (enabled: boolean) => void;
    packInfo: Array<{
      name: string;
      displayName: string;
      loaded: boolean;
      loading: boolean;
      error: string | null;
      iconCount: number;
    }>;
    enabledPacks: string[];
    onTogglePack: (packName: string, enabled: boolean) => void;
  };
  /** Optional language selector component rendered on the Language tab. */
  languageSelector?: React.ReactNode;
  /** Called when the user clicks "Download session dump" in the Diagnostics tab. */
  onSessionDump?: () => void;
}

export const SettingsDialog = ({
  iconPackManager,
  languageSelector,
  onSessionDump
}: SettingsDialogProps) => {
  const dialog = useUiStateStore((state) => state.dialog);
  const setDialog = useUiStateStore((state) => state.actions.setDialog);
  const [tabValue, setTabValue] = useState(0);
  const { t } = useTranslation();

  const isOpen = dialog === 'SETTINGS';

  const handleClose = () => {
    setDialog(null);
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // Build dynamic tab list so indices stay contiguous regardless of optional tabs
  const tabs: Array<{ label: string; content: React.ReactNode }> = [
    {
      label: t('settings.hotkeys.title'),
      content: <HotkeySettings />
    },
    {
      label: 'Canvas',
      content: (
        <>
          <PanSettings />
          <Box sx={{ px: 2, pb: 2 }}>
            <ZoomSettings />
          </Box>
          <Box sx={{ px: 2, pb: 2 }}>
            <LabelSettings />
          </Box>
        </>
      )
    },
    {
      label: t('settings.connector.title'),
      content: <ConnectorSettings />
    }
  ];

  if (iconPackManager) {
    tabs.push({
      label: t('settings.iconPacks.title'),
      content: (
        <IconPackSettings
          lazyLoadingEnabled={iconPackManager.lazyLoadingEnabled}
          onToggleLazyLoading={iconPackManager.onToggleLazyLoading}
          packInfo={iconPackManager.packInfo}
          enabledPacks={iconPackManager.enabledPacks}
          onTogglePack={iconPackManager.onTogglePack}
        />
      )
    });
  }

  if (languageSelector) {
    tabs.push({
      label: 'Language',
      content: (
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select the display language for the application interface.
          </Typography>
          {languageSelector}
        </Box>
      )
    });
  }

  // About and Diagnostics always appended last — "geeky" stuff at the end
  tabs.push({ label: 'About', content: <AboutTab /> });
  tabs.push({ label: 'Diagnostics', content: <DiagnosticsTab onSessionDump={onSessionDump} /> });

  return (
    <Dialog open={isOpen} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Settings
        <IconButton
          aria-label="close"
          onClick={handleClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: (theme) => theme.palette.grey[500]
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          {tabs.map((tab) => (
            <Tab key={tab.label} label={tab.label} />
          ))}
        </Tabs>

        <Box sx={{ mt: 2 }}>
          {tabs[tabValue]?.content}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};
