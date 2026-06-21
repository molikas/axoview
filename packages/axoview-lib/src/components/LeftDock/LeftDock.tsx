import React from 'react';
import { Box, Divider, IconButton, Tooltip } from '@mui/material';
import {
  WidgetsOutlined,
  LayersOutlined,
  FolderOpenOutlined as FileExplorerIcon,
  SettingsOutlined as SettingsIcon
} from '@mui/icons-material';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { DialogTypeEnum } from 'src/types/ui';
import { ElementsPanel } from './ElementsPanel';
import { LayersPanel } from 'src/components/LayersPanel/LayersPanel';
import { TOOL_HOTKEYS } from 'src/config/hotkeys';
import { tooltipWithShortcut } from 'src/utils/tooltipWithShortcut';
import { useTranslation } from 'src/stores/localeStore';

// Exported so canvas-anchored chrome (NodeActionBar — B4 / decision #5) can
// derive the dock's right edge to clamp against, without duplicating the magic
// numbers. STRIP is always present in edit mode; PANEL adds when a left tab is
// open. FILE_EXPLORER is an app-level surface (its open state is a prop here, not
// in the store), so lib-internal clamps account for STRIP + PANEL only.
export const STRIP_WIDTH = 40;
export const PANEL_WIDTH = 240;
const FILE_EXPLORER_WIDTH = 280;

type LeftTabId = 'ELEMENTS' | 'LAYERS';

// D4 — tooltip text is i18n-keyed (resolved at render via t()), since this
// array is module-level and can't call the hook directly.
const WORKING_TABS: {
  id: LeftTabId;
  icon: React.ReactNode;
  tooltipKey: 'elements' | 'layers';
}[] = [
  {
    id: 'ELEMENTS',
    icon: <WidgetsOutlined sx={{ fontSize: 20 }} />,
    tooltipKey: 'elements'
  },
  {
    id: 'LAYERS',
    icon: <LayersOutlined sx={{ fontSize: 20 }} />,
    tooltipKey: 'layers'
  }
];

interface LeftDockProps {
  fileExplorerOpen?: boolean;
  onFileExplorerToggle?: () => void;
  /** When true, Elements/Layers icons are disabled (no diagram loaded yet). */
  disableWorkingTabs?: boolean;
}

export const LeftDock = ({
  fileExplorerOpen,
  onFileExplorerToggle,
  disableWorkingTabs
}: LeftDockProps) => {
  const { t } = useTranslation('leftDock');
  const activeLeftTab = useUiStateStore((s) => s.activeLeftTab);
  const setActiveLeftTab = useUiStateStore((s) => s.actions.setActiveLeftTab);
  const setDialog = useUiStateStore((s) => s.actions.setDialog);
  const hotkeys = TOOL_HOTKEYS;

  const tabShortcut: Record<LeftTabId, string | null | undefined> = {
    ELEMENTS: hotkeys.addItem?.toUpperCase(),
    LAYERS: null
  };

  const panelOpen = activeLeftTab !== null && !disableWorkingTabs;
  const panelLeftOffset = STRIP_WIDTH + (fileExplorerOpen ? FILE_EXPLORER_WIDTH : 0);

  return (
    <Box
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 40, // stop above the BottomDock (height: 40)
        zIndex: 20,
        pointerEvents: 'none'
      }}
    >
      {/* Icon strip — always visible */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          width: STRIP_WIDTH,
          bgcolor: 'background.paper',
          borderRight: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          pt: 1,
          gap: 0.5,
          flexShrink: 0,
          pointerEvents: 'all'
        }}
      >
        {/* Navigation region — File Explorer */}
        {onFileExplorerToggle && (
          <Tooltip title={t('fileExplorer')} placement="right">
            <IconButton
              size="small"
              onClick={onFileExplorerToggle}
              data-axoview-id="dock-file-explorer-toggle"
              sx={{
                borderRadius: 1,
                color: fileExplorerOpen ? 'primary.main' : 'text.secondary',
                bgcolor: fileExplorerOpen ? 'action.selected' : 'transparent',
                width: 32,
                height: 32
              }}
            >
              <FileExplorerIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Tooltip>
        )}

        {/* Region separator */}
        {onFileExplorerToggle && (
          <Divider flexItem sx={{ width: '80%', my: 0.25 }} />
        )}

        {/* Working region — Elements + Layers (mutex pair) */}
        {WORKING_TABS.map((tab) => {
          const isActive = activeLeftTab === tab.id && !disableWorkingTabs;
          // D4 — tooltip + disabled-state hint routed through i18n.
          const tabLabel = t(tab.tooltipKey);
          const tooltipTitle = disableWorkingTabs
            ? `${tabLabel} — ${t('openDiagramFirst')}`
            : tooltipWithShortcut(tabLabel, tabShortcut[tab.id]);
          return (
            <Tooltip key={tab.id} title={tooltipTitle} placement="right">
              <span>
                <IconButton
                  size="small"
                  disabled={disableWorkingTabs}
                  onClick={() =>
                    setActiveLeftTab(activeLeftTab === tab.id ? null : tab.id)
                  }
                  data-axoview-id={`dock-${tab.id.toLowerCase()}-toggle`}
                  sx={{
                    borderRadius: 1,
                    color: isActive ? 'primary.main' : 'text.secondary',
                    bgcolor: isActive ? 'action.selected' : 'transparent',
                    width: 32,
                    height: 32
                  }}
                >
                  {tab.icon}
                </IconButton>
              </span>
            </Tooltip>
          );
        })}

        {/* System anchor — pushed to the bottom */}
        <Box sx={{ mt: 'auto', pb: 1 }}>
          <Tooltip title={t('settings')} placement="right">
            <IconButton
              size="small"
              onClick={() => setDialog(DialogTypeEnum.SETTINGS)}
              data-axoview-id="dock-settings"
              sx={{
                borderRadius: 1,
                color: 'text.secondary',
                width: 32,
                height: 32
              }}
            >
              <SettingsIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Elements / Layers panel — overlay, no animation, sits to the right
          of the File Explorer when both are open. */}
      {panelOpen && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: panelLeftOffset,
            width: PANEL_WIDTH,
            bgcolor: 'background.paper',
            borderRight: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: 3,
            pointerEvents: 'all'
          }}
        >
          {activeLeftTab === 'ELEMENTS' && <ElementsPanel />}
          {activeLeftTab === 'LAYERS' && <LayersPanel />}
        </Box>
      )}
    </Box>
  );
};
