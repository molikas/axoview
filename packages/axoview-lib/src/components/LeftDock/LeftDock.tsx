import React from 'react';
import { Box, Divider, IconButton, Tooltip } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import {
  WidgetsOutlined,
  LayersOutlined,
  FolderOpenOutlined as FileExplorerIcon,
  SettingsOutlined as SettingsIcon,
  ChevronLeft as CollapseIcon
} from '@mui/icons-material';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { DialogTypeEnum } from 'src/types/ui';
import { ElementsPanel } from './ElementsPanel';
import { LayersPanel } from 'src/components/LayersPanel/LayersPanel';
import { TOOL_HOTKEYS } from 'src/config/hotkeys';
import { tooltipWithShortcut } from 'src/utils/tooltipWithShortcut';
import { useTranslation } from 'src/stores/localeStore';

// Dock width constants. STRIP is always present in edit mode; PANEL adds when a
// left tab is open. FILE_EXPLORER is an app-level surface (its open state is a
// prop here, not in the store), so lib-internal clamps account for STRIP + PANEL
// only. (These were once exported for the canvas-anchored NodeActionBar to clamp
// against; that surface was removed in the 2026-06-25 shake-out, so they are now
// module-local.)
const STRIP_WIDTH = 40;
const PANEL_WIDTH = 240;
const FILE_EXPLORER_WIDTH = 280;

// Edge collapse tab — invisible + inert at rest, revealed on panel hover/focus
// by the wrapper's `.ax-collapse-tab` selector (§2.3). Right-edge variant: the
// arrow points left (collapse direction); positioned at the panel's right edge,
// protruding into the canvas. Width-relative to the panel wrapper.
const COLLAPSE_TAB_SX: SxProps<Theme> = {
  position: 'absolute',
  top: '50%',
  left: PANEL_WIDTH - 1,
  transform: 'translateY(-50%)',
  width: 22,
  height: 44,
  borderRadius: '0 8px 8px 0',
  bgcolor: 'background.paper',
  border: '1px solid',
  borderColor: 'divider',
  borderLeft: 'none',
  color: 'text.secondary',
  boxShadow: 2,
  opacity: 0,
  pointerEvents: 'none',
  transition: 'opacity 120ms ease',
  '&:hover': { bgcolor: 'action.hover', color: 'text.primary' },
  '&:focus-visible': { opacity: 1, pointerEvents: 'all' }
};

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
          of the File Explorer when both are open. The wrapper is the hover/
          focus group that reveals the collapse tab (§2.3); the inner Box keeps
          the panel chrome + overflow clip, while the tab sits outside that clip
          so it can protrude past the edge. */}
      {panelOpen && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: panelLeftOffset,
            width: PANEL_WIDTH,
            pointerEvents: 'all',
            // Collapse tab is invisible + inert until the panel is hovered or
            // focus enters it — keeps it out of the way (UX §2.3) and stops the
            // hidden tab from catching canvas clicks at the panel edge.
            '&:hover .ax-collapse-tab, &:focus-within .ax-collapse-tab': {
              opacity: 1,
              pointerEvents: 'all'
            }
          }}
        >
          <Box
            sx={{
              height: '100%',
              bgcolor: 'background.paper',
              borderRight: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: 3
            }}
          >
            {activeLeftTab === 'ELEMENTS' && <ElementsPanel />}
            {activeLeftTab === 'LAYERS' && <LayersPanel />}
          </Box>

          <Tooltip title={t('collapsePanel')} placement="right">
            <IconButton
              className="ax-collapse-tab"
              size="small"
              onClick={() => setActiveLeftTab(null)}
              data-axoview-id="dock-collapse-panel"
              sx={COLLAPSE_TAB_SX}
            >
              <CollapseIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Box>
      )}
    </Box>
  );
};
