import React, { createContext, useContext, useRef } from 'react';
import { createStore } from 'zustand';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import {
  CoordsUtils,
  incrementZoom,
  decrementZoom,
  getStartingMode
} from 'src/utils';
import { UiStateStore } from 'src/types';
import { INITIAL_UI_STATE } from 'src/config';
import { DEFAULT_HOTKEY_PROFILE, HotkeyProfile } from 'src/config/hotkeys';
import { DEFAULT_PAN_SETTINGS } from 'src/config/panSettings';
import { DEFAULT_ZOOM_SETTINGS } from 'src/config/zoomSettings';
import { DEFAULT_LABEL_SETTINGS } from 'src/config/labelSettings';
import { loadPersistedSettings } from 'src/config/persistedSettings';

const initialState = () => {
  // Load any previously saved user preferences — fall back to defaults if absent/corrupt.
  const persisted = loadPersistedSettings();

  return createStore<UiStateStore>((set, get) => {
    return {
      zoom: INITIAL_UI_STATE.zoom,
      scroll: INITIAL_UI_STATE.scroll,
      view: '',
      editorMode: 'EXPLORABLE_READONLY',
      mode: getStartingMode('EXPLORABLE_READONLY'),
      iconCategoriesState: [],
      freshlyLoadedCategoryIds: [],
      dialog: null,
      rendererEl: null,
      rendererSize: { width: 0, height: 0 },
      mouse: {
        position: { screen: CoordsUtils.zero(), tile: CoordsUtils.zero() },
        mousedown: null,
        delta: null
      },
      itemControls: null,
      selectedIds: [],
      enableDebugTools: false,
      hotkeyProfile: persisted?.hotkeyProfile ?? DEFAULT_HOTKEY_PROFILE,
      panSettings: persisted?.panSettings ?? DEFAULT_PAN_SETTINGS,
      zoomSettings: persisted?.zoomSettings ?? DEFAULT_ZOOM_SETTINGS,
      labelSettings: persisted?.labelSettings ?? DEFAULT_LABEL_SETTINGS,
      connectorInteractionMode: persisted?.connectorInteractionMode ?? 'click',
      expandLabels: persisted?.expandLabels ?? false,
      readableLabels: persisted?.readableLabels ?? false,
      canvasMode: persisted?.canvasMode ?? 'ISOMETRIC',
      iconPackManager: null, // Will be set by Axoview if provided
      iconUsageScan: null, // Will be set by Axoview if provided
      linkedDiagrams: [],
      notification: null,
      activeLeftTab: null,
      rightSidebarOpen: false,
      rightSidebarAutoOpened: false,
      itemActionBarOpen: false,
      isDirty: false,
      previewLayerOverrides: { hiddenLayerIds: [], soloLayerId: null },

      actions: {
        setView: (view) => {
          // A new view has its own layers — drop any preview override so a
          // solo'd/hidden layer id from the previous view can't leak across.
          set({
            view,
            previewLayerOverrides: { hiddenLayerIds: [], soloLayerId: null }
          });
        },
        setEditorMode: (mode) => {
          // Leaving (or entering) preview clears the ephemeral override so it
          // never persists across mode switches (ADR 0013).
          set({
            editorMode: mode,
            mode: getStartingMode(mode),
            previewLayerOverrides: { hiddenLayerIds: [], soloLayerId: null }
          });
        },
        setIconCategoriesState: (iconCategoriesState) => {
          set({ iconCategoriesState });
        },
        setFreshlyLoadedCategoryIds: (ids) => {
          set({ freshlyLoadedCategoryIds: ids });
        },
        resetUiState: () => {
          set({
            mode: getStartingMode(get().editorMode),
            scroll: {
              position: CoordsUtils.zero(),
              offset: CoordsUtils.zero()
            },
            itemControls: null,
            selectedIds: [],
            itemActionBarOpen: false,
            zoom: INITIAL_UI_STATE.zoom
          });
        },
        setMode: (mode) => {
          set({ mode });
        },
        setDialog: (dialog) => {
          set({ dialog });
        },
        incrementZoom: () => {
          const { zoom } = get();
          set({ zoom: incrementZoom(zoom) });
        },
        decrementZoom: () => {
          const { zoom } = get();
          set({ zoom: decrementZoom(zoom) });
        },
        setZoom: (zoom) => {
          set({ zoom });
        },
        setScroll: ({ position, offset }) => {
          set({ scroll: { position, offset: offset ?? get().scroll.offset } });
        },
        setItemControls: (itemControls) => {
          if (itemControls !== null) {
            const { rightSidebarOpen, rightSidebarAutoOpened } = get();
            // If user manually pinned the panel open, don't mark it as auto-opened
            const alreadyPinned = rightSidebarOpen && !rightSidebarAutoOpened;
            // View mode surfaces item info via the canvas popover (ADR 0012),
            // so the right (editing) dock no longer auto-opens on selection
            // there — a manually-pinned dock is respected; edit mode unchanged.
            const inView = get().editorMode === 'EXPLORABLE_READONLY';
            // Keep selectedIds coherent when itemControls is set directly
            // (e.g. from a layer-row click). Multi-select stays as-is; single-
            // item selection mirrors itemControls into selectedIds.
            const nextSelected =
              itemControls.type === 'ADD_ITEM'
                ? get().selectedIds
                : [{ type: itemControls.type, id: itemControls.id }];
            set({
              itemControls,
              selectedIds: nextSelected,
              rightSidebarOpen: inView ? rightSidebarOpen : true,
              // New / changed selection always closes the floating action bar.
              // The bar is only opened by an explicit right-click (mqa-results.md #1).
              itemActionBarOpen: false,
              ...(!inView && !alreadyPinned && { rightSidebarAutoOpened: true })
            });
          } else {
            const autoOpened = get().rightSidebarAutoOpened;
            set({
              itemControls,
              itemActionBarOpen: false,
              ...(autoOpened && {
                rightSidebarOpen: false,
                rightSidebarAutoOpened: false
              })
            });
          }
        },
        setSelectedIds: (ids) => {
          // Derive itemControls per the multi-select contract (ADR-0006):
          //  - 0 items → no panel
          //  - 1 item → panel mounted for that item
          //  - >1   → no panel (heterogeneous edits aren't meaningful here)
          if (ids.length === 1) {
            const only = ids[0];
            const { rightSidebarOpen, rightSidebarAutoOpened } = get();
            const alreadyPinned = rightSidebarOpen && !rightSidebarAutoOpened;
            // View mode reads item info via the canvas popover (ADR 0012) — no
            // right-dock auto-open there (edit mode unchanged).
            const inView = get().editorMode === 'EXPLORABLE_READONLY';
            set({
              selectedIds: ids,
              itemControls: { type: only.type, id: only.id },
              rightSidebarOpen: inView ? rightSidebarOpen : true,
              itemActionBarOpen: false,
              ...(!inView && !alreadyPinned && { rightSidebarAutoOpened: true })
            });
          } else {
            const autoOpened = get().rightSidebarAutoOpened;
            set({
              selectedIds: ids,
              itemControls: null,
              itemActionBarOpen: false,
              ...(autoOpened && {
                rightSidebarOpen: false,
                rightSidebarAutoOpened: false
              })
            });
          }
        },
        toggleSelected: (ref) => {
          const current = get().selectedIds;
          const idx = current.findIndex(
            (r) => r.id === ref.id && r.type === ref.type
          );
          const next =
            idx >= 0
              ? [...current.slice(0, idx), ...current.slice(idx + 1)]
              : [...current, ref];
          get().actions.setSelectedIds(next);
        },
        clearSelection: () => {
          get().actions.setSelectedIds([]);
        },
        setMouse: (mouse) => {
          set({ mouse });
        },
        setEnableDebugTools: (enableDebugTools) => {
          set({ enableDebugTools });
        },
        setRendererEl: (el: HTMLDivElement) => {
          set({ rendererEl: el });
        },
        setRendererSize: (size) => {
          set({ rendererSize: size });
        },
        setHotkeyProfile: (hotkeyProfile: HotkeyProfile) => {
          set({ hotkeyProfile });
        },
        setPanSettings: (panSettings) => {
          set({ panSettings });
        },
        setZoomSettings: (zoomSettings) => {
          set({ zoomSettings });
        },
        setLabelSettings: (labelSettings) => {
          set({ labelSettings });
        },
        setConnectorInteractionMode: (connectorInteractionMode) => {
          set({ connectorInteractionMode });
        },
        setExpandLabels: (expandLabels) => {
          set({ expandLabels });
        },
        setReadableLabels: (readableLabels) => {
          set({ readableLabels });
        },
        togglePreviewLayerHidden: (layerId) => {
          const { hiddenLayerIds } = get().previewLayerOverrides;
          const nextHidden = hiddenLayerIds.includes(layerId)
            ? hiddenLayerIds.filter((id) => id !== layerId)
            : [...hiddenLayerIds, layerId];
          // Toggling a visibility checkbox exits solo (mutually exclusive
          // presentation intents).
          set({
            previewLayerOverrides: { hiddenLayerIds: nextHidden, soloLayerId: null }
          });
        },
        setPreviewSoloLayer: (layerId) => {
          const { soloLayerId } = get().previewLayerOverrides;
          // Solo is a toggle: soloing the already-solo'd layer clears it.
          const nextSolo = soloLayerId === layerId ? null : layerId;
          set({
            previewLayerOverrides: {
              hiddenLayerIds: [],
              soloLayerId: nextSolo
            }
          });
        },
        clearPreviewLayerOverrides: () => {
          set({
            previewLayerOverrides: { hiddenLayerIds: [], soloLayerId: null }
          });
        },
        setIconPackManager: (iconPackManager) => {
          set({ iconPackManager });
        },
        setIconUsageScan: (iconUsageScan) => {
          set({ iconUsageScan });
        },
        setLinkedDiagrams: (linkedDiagrams) => {
          set({ linkedDiagrams });
        },
        setNotification: (notification) => {
          set({ notification });
        },
        setActiveLeftTab: (activeLeftTab) => {
          set({ activeLeftTab });
        },
        setRightSidebarOpen: (rightSidebarOpen) => {
          set({ rightSidebarOpen, rightSidebarAutoOpened: false });
        },
        setItemActionBarOpen: (itemActionBarOpen) => {
          set({ itemActionBarOpen });
        },
        setIsDirty: (isDirty) => {
          set({ isDirty });
        },
        setCanvasMode: (canvasMode) => {
          set({ canvasMode });
        }
      }
    };
  });
};

const UiStateContext = createContext<ReturnType<typeof initialState> | null>(
  null
);

interface ProviderProps {
  children: React.ReactNode;
}

// TODO: Typings below are pretty gnarly due to the way Zustand works.
// see https://github.com/pmndrs/zustand/discussions/1180#discussioncomment-3439061
export const UiStateProvider = ({ children }: ProviderProps) => {
  const storeRef = useRef<ReturnType<typeof initialState> | undefined>(
    undefined
  );

  if (!storeRef.current) {
    storeRef.current = initialState();
  }

  return (
    <UiStateContext.Provider value={storeRef.current}>
      {children}
    </UiStateContext.Provider>
  );
};

export function useUiStateStore<T>(
  selector: (state: UiStateStore) => T,
  equalityFn?: (left: T, right: T) => boolean
) {
  const store = useContext(UiStateContext);

  if (store === null) {
    throw new Error('Missing provider in the tree');
  }

  const value = useStoreWithEqualityFn(store, selector, equalityFn);
  return value;
}

// Hook to get store API for imperative access (getState without subscribing)
export function useUiStateStoreApi() {
  const store = useContext(UiStateContext);

  if (store === null) {
    throw new Error('Missing provider in the tree');
  }

  return store;
}
