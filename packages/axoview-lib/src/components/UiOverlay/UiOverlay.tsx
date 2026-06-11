import React, { useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Box,
  useTheme,
  Typography,
  Stack,
  IconButton,
  Tooltip
} from '@mui/material';
import { shallow } from 'zustand/shallow';
import { ChevronRight, ViewSidebarOutlined } from '@mui/icons-material';
import { EditorModeEnum, DialogTypeEnum } from 'src/types';
import { UiElement } from 'components/UiElement/UiElement';
import { SceneLayer } from 'src/components/SceneLayer/SceneLayer';
import { DragAndDrop } from 'src/components/DragAndDrop/DragAndDrop';
import { ToolMenu } from 'src/components/ToolMenu/ToolMenu';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { DebugUtils } from 'src/components/DebugUtils/DebugUtils';
import { useScene } from 'src/hooks/useScene';
import { useModelStore } from 'src/stores/modelStore';
import { ExportImageDialog } from '../ExportImageDialog/ExportImageDialog';
import { HelpDialog } from '../HelpDialog/HelpDialog';
import { SettingsDialog } from '../SettingsDialog/SettingsDialog';
import { LazyLoadingWelcomeNotification } from '../LazyLoadingWelcomeNotification/LazyLoadingWelcomeNotification';
import { NotificationSnackbar } from '../NotificationSnackbar/NotificationSnackbar';
import { ViewTabs } from 'src/components/ViewTabs/ViewTabs';
import { NodeActionBar } from 'src/components/NodeActionBar/NodeActionBar';
import { LassoLayerBar } from 'src/components/LassoLayerBar/LassoLayerBar';
import { PreviewLayerSwitcher } from 'src/components/PreviewLayerSwitcher/PreviewLayerSwitcher';
import { ViewModeInfoPopover } from 'src/components/ViewModeInfoPopover/ViewModeInfoPopover';

type ToolName = 'TOOL_MENU' | 'ITEM_CONTROLS' | 'VIEW_TITLE' | 'VIEW_TABS';

interface EditorModeMapping {
  [k: string]: ToolName[];
}

const EDITOR_MODE_MAPPING: EditorModeMapping = {
  [EditorModeEnum.EDITABLE]: ['ITEM_CONTROLS', 'TOOL_MENU', 'VIEW_TABS'],
  [EditorModeEnum.EXPLORABLE_READONLY]: ['ITEM_CONTROLS', 'VIEW_TABS'],
  [EditorModeEnum.NON_INTERACTIVE]: []
};

const getEditorModeMapping = (editorMode: keyof typeof EditorModeEnum) => {
  return EDITOR_MODE_MAPPING[editorMode];
};

// Isolated component so UiOverlay doesn't re-render on every mouse move.
// Only mounts when mode.type === 'PLACE_ICON'.
const PlaceIconLayer = () => {
  const mode = useUiStateStore((state) => state.mode);
  const tile = useUiStateStore(
    (state) => state.mouse.position.tile,
    (a, b) => a.x === b.x && a.y === b.y
  );

  if (mode.type !== 'PLACE_ICON' || !mode.id) return null;

  return (
    <SceneLayer disableAnimation>
      <DragAndDrop iconId={mode.id} tile={tile} />
    </SceneLayer>
  );
};

interface UiOverlayProps {
  toolbarPortalTarget?: HTMLElement | null;
  sidebarTogglePortalTarget?: HTMLElement | null;
  languageSelector?: React.ReactNode;
  suppressOnboardingHints?: boolean;
  /** @deprecated use toolbarPortalTarget */
  menuPortalTarget?: HTMLElement | null;
}

export const UiOverlay = ({
  toolbarPortalTarget,
  sidebarTogglePortalTarget,
  languageSelector,
  suppressOnboardingHints,
  menuPortalTarget
}: UiOverlayProps = {}) => {
  const portalTarget = toolbarPortalTarget ?? menuPortalTarget ?? null;
  const theme = useTheme();
  const toolMenuRef = useRef<HTMLDivElement>(null);
  const { appPadding } = theme.customVars;
  const spacing = useCallback(
    (multiplier: number) => {
      return parseInt(theme.spacing(multiplier), 10);
    },
    [theme]
  );

  const {
    uiStateActions,
    enableDebugTools,
    mode,
    dialog,
    itemControls,
    editorMode,
    iconPackManager,
    rightSidebarOpen,
    itemActionBarOpen
  } = useUiStateStore(
    (state) => ({
      uiStateActions: state.actions,
      enableDebugTools: state.enableDebugTools,
      mode: state.mode,
      dialog: state.dialog,
      itemControls: state.itemControls,
      editorMode: state.editorMode,
      iconPackManager: state.iconPackManager,
      rightSidebarOpen: state.rightSidebarOpen,
      itemActionBarOpen: state.itemActionBarOpen
    }),
    shallow
  );

  const { currentView } = useScene();
  const availableTools = useMemo(() => {
    return getEditorModeMapping(editorMode);
  }, [editorMode]);
  const title = useModelStore((state) => {
    return state.title;
  });
  const rendererSize = useUiStateStore((state) => state.rendererSize);

  return (
    <>
      <Box
        sx={{
          position: 'absolute',
          width: 0,
          height: 0,
          top: 0,
          left: 0
        }}
      >
        {availableTools.includes('TOOL_MENU') && (
          <Box
            ref={toolMenuRef}
            onMouseDown={(e) => e.stopPropagation()}
            sx={{
              position: 'absolute',
              transform: 'translateX(-50%)'
            }}
            style={{
              left: rendererSize.width / 2,
              top: 10
            }}
          >
            <ToolMenu />
          </Box>
        )}

        {availableTools.includes('VIEW_TITLE') && (
          <Box
            sx={{
              position: 'absolute',
              display: 'flex',
              justifyContent: 'center',
              transform: 'translateX(-50%)',
              pointerEvents: 'none'
            }}
            style={{
              left: rendererSize.width / 2,
              top: rendererSize.height - appPadding.y * 2,
              width: rendererSize.width - 500,
              height: appPadding.y
            }}
          >
            <UiElement
              sx={{
                display: 'inline-flex',
                px: 2,
                alignItems: 'center',
                height: '100%'
              }}
            >
              <Stack direction="row" alignItems="center">
                <Typography variant="subtitle2" color="text.secondary">
                  {title}
                </Typography>
                <ChevronRight />
                <Typography variant="subtitle2" color="text.secondary">
                  {currentView.name}
                </Typography>
              </Stack>
            </UiElement>
          </Box>
        )}

        {availableTools.includes('VIEW_TABS') && (
          <Box
            sx={{
              position: 'absolute',
              display: 'flex',
              justifyContent: 'center',
              transform: 'translateX(-50%)'
            }}
            style={{
              left: rendererSize.width / 2,
              top: rendererSize.height - appPadding.y * 2,
              maxWidth: rendererSize.width - 300
            }}
          >
            <ViewTabs />
          </Box>
        )}

        {enableDebugTools && (
          <UiElement
            sx={{
              position: 'absolute',
              width: 350,
              transform: 'translateY(-100%)'
            }}
            style={{
              maxWidth: `calc(${rendererSize.width} - ${appPadding.x * 2}px)`,
              left: appPadding.x,
              top: rendererSize.height - appPadding.y * 2 - spacing(1)
            }}
          >
            <DebugUtils />
          </UiElement>
        )}

        {/* Preview-mode layer switcher — bottom-left, clear of ViewTabs
            (bottom-center) and ZoomControls (bottom-right). View mode only;
            the component self-gates on ≥2 layers (ADR 0013). */}
        {editorMode === EditorModeEnum.EXPLORABLE_READONLY && (
          <Box
            sx={{ position: 'absolute', transform: 'translateY(-100%)' }}
            style={{
              left: appPadding.x,
              top: rendererSize.height - appPadding.y * 2 - spacing(1)
            }}
          >
            <PreviewLayerSwitcher />
          </Box>
        )}
      </Box>

      {/* Portals — hoisted out of the positioning <Box> above because MUI's
          PropTypes.node check on Box's children rejects ReactPortal (its
          $$typeof is react.portal, not react.element). Portals render into
          their target node regardless of where they sit in the JSX tree. */}
      {(sidebarTogglePortalTarget ?? portalTarget) &&
        createPortal(
          <Tooltip title="Toggle Properties panel" placement="bottom">
            <IconButton
              size="small"
              onClick={() =>
                uiStateActions.setRightSidebarOpen(!rightSidebarOpen)
              }
              sx={{
                borderRadius: 1,
                color: 'inherit',
                bgcolor: rightSidebarOpen ? 'action.selected' : 'transparent'
              }}
            >
              <ViewSidebarOutlined sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>,
          (sidebarTogglePortalTarget ?? portalTarget)!
        )}

      <PlaceIconLayer />

      {dialog === DialogTypeEnum.EXPORT_IMAGE && (
        <ExportImageDialog
          onClose={() => {
            return uiStateActions.setDialog(null);
          }}
        />
      )}

      {dialog === DialogTypeEnum.HELP && <HelpDialog />}

      {dialog === DialogTypeEnum.SETTINGS && (
        <SettingsDialog
          iconPackManager={iconPackManager || undefined}
          languageSelector={languageSelector}
        />
      )}

      {/* Welcome notification — suppressed when a diagram is open */}
      {iconPackManager && !suppressOnboardingHints && <LazyLoadingWelcomeNotification />}

      <NotificationSnackbar />

      <SceneLayer>
        {/* Floating action bar — edit mode only, hidden while dragging.
            Opened by right-click on an item (mqa-results.md #1); left-click
            selection no longer auto-shows the bar. */}
        {editorMode === EditorModeEnum.EDITABLE &&
          itemActionBarOpen &&
          itemControls &&
          itemControls.type !== 'ADD_ITEM' &&
          itemControls.type !== 'CONNECTOR_ANCHOR' &&
          mode.type !== 'DRAG_ITEMS' && (
            <NodeActionBar
              type={itemControls.type}
              id={itemControls.id}
              tile={itemControls.tile}
            />
          )}

        {/* Lasso layer assign bar */}
        {editorMode === EditorModeEnum.EDITABLE && <LassoLayerBar />}

        {/* View-mode item info popover — canvas-anchored read surface that
            replaces the right dock in EXPLORABLE_READONLY (ADR 0012). */}
        {editorMode === EditorModeEnum.EXPLORABLE_READONLY && (
          <ViewModeInfoPopover />
        )}
      </SceneLayer>
    </>
  );
};
