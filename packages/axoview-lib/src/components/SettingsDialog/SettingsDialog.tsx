import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Box,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  Typography
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { HotkeySettings } from '../HotkeySettings/HotkeySettings';
import { ZoomSettings } from '../ZoomSettings/ZoomSettings';
import { LabelSettings } from '../LabelSettings/LabelSettings';
import { ConnectorSettings } from '../ConnectorSettings/ConnectorSettings';
import { IconPackSettings } from '../IconPackSettings/IconPackSettings';
import { AboutTab } from './AboutTab';
import { useTranslation } from 'src/stores/localeStore';
import { Section } from 'src/components/ItemControls/components/Section';

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
}

type SettingsTab = {
  id: string;
  label: string;
  content: React.ReactNode;
  /** When true, the tab renders below a divider in the rail ("geeky tail"). */
  tail?: boolean;
};

export const SettingsDialog = ({
  iconPackManager,
  languageSelector
}: SettingsDialogProps) => {
  const dialog = useUiStateStore((state) => state.dialog);
  const setDialog = useUiStateStore((state) => state.actions.setDialog);
  const [activeId, setActiveId] = useState<string>('keyboard');
  const { t } = useTranslation();

  const isOpen = dialog === 'SETTINGS';

  const handleClose = () => {
    setDialog(null);
  };

  const tabs: SettingsTab[] = [
    {
      id: 'keyboard',
      label: t('settings.hotkeys.title'),
      content: <HotkeySettings />
    },
    {
      id: 'canvas',
      // D3 — tab label + section titles routed through i18n
      label: t('settings.canvas'),
      content: (
        <>
          <Section title={t('settings.zoomSection')}>
            <ZoomSettings />
          </Section>
          <Section title={t('settings.labelsSection')}>
            <LabelSettings />
          </Section>
        </>
      )
    },
    {
      id: 'connectors',
      label: t('settings.connector.title'),
      content: <ConnectorSettings />
    }
  ];

  if (iconPackManager) {
    tabs.push({
      id: 'iconPacks',
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
      id: 'language',
      // D3 — tab label + description routed through i18n
      label: t('settings.language'),
      content: (
        <Section>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('settings.languageDescription')}
          </Typography>
          {languageSelector}
        </Section>
      )
    });
  }

  // "Geeky tail" — rendered under a divider in the rail
  // D3 — tab label routed through i18n
  tabs.push({
    id: 'about',
    label: t('settings.about'),
    content: <AboutTab />,
    tail: true
  });

  const activeTab = tabs.find((tab) => tab.id === activeId) ?? tabs[0];
  const firstTailIndex = tabs.findIndex((tab) => tab.tail);

  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      slotProps={{
        paper: {
          sx: { height: '60vh', minHeight: 480 },
          'data-axoview-id': 'dialog-settings'
        } as React.ComponentProps<'div'>
      }}
    >
      <DialogTitle sx={{ pr: 6 }}>
        {/* D3 — dialog title routed through i18n */}
        {t('settings.title')}
        <IconButton
          aria-label={t('settings.close')}
          onClick={handleClose}
          data-axoview-id="dialog-settings-close"
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
      <DialogContent dividers sx={{ p: 0 }}>
        <Box sx={{ display: 'flex', height: '100%' }}>
          {/* Left rail */}
          <Box
            sx={{
              width: 200,
              flexShrink: 0,
              borderRight: 1,
              borderColor: 'divider',
              bgcolor: 'background.default',
              overflowY: 'auto',
              overflowX: 'hidden'
            }}
          >
            <List dense disablePadding sx={{ py: 1 }}>
              {tabs.map((tab, index) => (
                <React.Fragment key={tab.id}>
                  {tab.tail && index === firstTailIndex && (
                    <Divider sx={{ my: 1 }} />
                  )}
                  <ListItemButton
                    selected={tab.id === activeId}
                    onClick={() => setActiveId(tab.id)}
                    data-axoview-id={`dialog-settings-tab-${tab.id}`}
                    sx={{
                      py: 0.5,
                      px: 2,
                      '&.Mui-selected': {
                        bgcolor: 'action.selected'
                      }
                    }}
                  >
                    <ListItemText
                      primary={tab.label}
                      primaryTypographyProps={{
                        variant: 'body2',
                        sx: { fontWeight: tab.id === activeId ? 600 : 400 }
                      }}
                    />
                  </ListItemButton>
                </React.Fragment>
              ))}
            </List>
          </Box>

          {/* Right pane */}
          <Box
            sx={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              py: 1
            }}
          >
            {activeTab.content}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        {/* D3 — Close button routed through i18n */}
        <Button onClick={handleClose}>{t('settings.close')}</Button>
      </DialogActions>
    </Dialog>
  );
};
