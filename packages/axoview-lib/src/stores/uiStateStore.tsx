import React, { createContext, useContext, useRef } from 'react';
import { createStore } from 'zustand';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import {
  CoordsUtils,
  incrementZoom,
  decrementZoom,
  getStartingMode
} from 'src/utils';
import { UiStateStore, AnnotationOp, AnnotationStroke } from 'src/types';
import {
  applyAnnotationOp,
  revertAnnotationOp
} from 'src/utils/annotationOps';
import { INITIAL_UI_STATE, UNPROJECTED_TILE_SIZE } from 'src/config';
import {
  getCanvasModeSwitchScroll,
  getStrategy,
  makeIsometricStrategy
} from 'src/utils/coordinateTransforms';
import {
  normaliseDeg,
  shortestArc,
  nextLatticeAngle,
  VIEW_ROTATION_STEP_DEG
} from 'src/utils/viewRotation';
import { DEFAULT_ZOOM_SETTINGS } from 'src/config/zoomSettings';
import { DEFAULT_LABEL_SETTINGS } from 'src/config/labelSettings';
import { ANNOTATION_COLOR_PRESETS } from 'src/config/annotationSettings';
import { loadPersistedSettings } from 'src/config/persistedSettings';

// View-rotation step animation length (ADR 0049 §7).
const VIEW_ROTATION_TWEEN_MS = 220;

/**
 * The pointer's tile re-resolved at a new view angle (tactical B: a rotation
 * moves the floor under a still pointer, and a stale `mouse.position.tile`
 * would send Ctrl+V to the tile that USED to be under it). A patch to spread
 * into `set`, empty when nothing changed or the renderer is not measured yet.
 */
const refreshedMouseTile = (
  state: UiStateStore,
  viewRotation: number,
  scroll: UiStateStore['scroll']
): Partial<UiStateStore> => {
  const { mouse, rendererSize, zoom, canvasMode } = state;
  if (!rendererSize.width || !rendererSize.height) return {};
  const tile = getStrategy(canvasMode, viewRotation).fromScreen(
    mouse.position.screen.x,
    mouse.position.screen.y,
    UNPROJECTED_TILE_SIZE,
    zoom || 1,
    scroll,
    rendererSize
  );
  if (tile.x === mouse.position.tile.x && tile.y === mouse.position.tile.y) {
    return {};
  }
  return { mouse: { ...mouse, position: { ...mouse.position, tile } } };
};

const prefersReducedMotion = (): boolean => {
  try {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  } catch {
    return false;
  }
};

// Canvas reset applied whenever annotation drawing is engaged (pen opened or a
// draw/eraser tool armed): drop any armed/ in-flight canvas tool so it can't
// linger behind the overlay, clear the active selection + floating action bar,
// and close the right dock only if it was auto-opened (a manual pin is kept).
// Shared by setAnnotationOpen + setAnnotationTool so both entry points behave
// identically.
const canvasResetForAnnotation = (
  state: Pick<UiStateStore, 'editorMode' | 'rightSidebarAutoOpened'>
): Partial<UiStateStore> => ({
  mode: getStartingMode(state.editorMode),
  itemControls: null,
  selectedIds: [],
  hoveredItem: null,
  // An in-flight on-canvas text edit (ADR 0034) must not linger behind the
  // annotation overlay — the promoted editor would sit above it.
  editingTextBoxId: null,
  editingTextBoxSize: null,
  ...(state.rightSidebarAutoOpened
    ? { rightSidebarOpen: false, rightSidebarAutoOpened: false }
    : {})
});

const initialState = () => {
  // Load any previously saved user preferences — fall back to defaults if absent/corrupt.
  const persisted = loadPersistedSettings();

  // The in-flight view-rotation step animation (ADR 0049 §7). Per STORE, like
  // the angle itself — never module state, so two instances never share one.
  let rotationAnim: { raf: number; target: number } | null = null;
  const cancelRotationAnim = () => {
    if (!rotationAnim) return;
    if (typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(rotationAnim.raf);
    }
    rotationAnim = null;
  };

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
      pendingFitToView: false,
      mouse: {
        position: { screen: CoordsUtils.zero(), tile: CoordsUtils.zero() },
        mousedown: null,
        delta: null
      },
      itemControls: null,
      selectedIds: [],
      hoveredItem: null,
      enableDebugTools: false,
      zoomSettings: persisted?.zoomSettings ?? DEFAULT_ZOOM_SETTINGS,
      labelSettings: persisted?.labelSettings ?? DEFAULT_LABEL_SETTINGS,
      connectorInteractionMode: persisted?.connectorInteractionMode ?? 'click',
      connectorDefaults: {},
      expandLabels: persisted?.expandLabels ?? false,
      readableLabels: persisted?.readableLabels ?? false,
      canvasMode: persisted?.canvasMode ?? 'ISOMETRIC',
      viewRotation: 0,
      viewRotationBase: 0,
      viewRotationInMotion: false,
      snapToGrid: persisted?.snapToGrid ?? true,
      iconPackManager: null, // Will be set by Axoview if provided
      iconUsageScan: null, // Will be set by Axoview if provided
      linkedDiagrams: [],
      notification: null,
      activeLeftTab: null,
      rightSidebarOpen: false,
      rightSidebarAutoOpened: false,
      contextMenu: null,
      isDirty: false,
      previewLayerOverrides: { hiddenLayerIds: [], soloLayerId: null },
      previewHideLabels: false,
      hideViewControls: false,
      exportHideLabels: false,
      labelDrag: null,
      labelMove: null,
      labelMoves: null,
      iconScaleDrag: null,
      selectedConnectorLabel: null,
      inlineEditLabelId: null,
      inlineEditNodeId: null,
      activeLayerId: null,
      viewModeHoveredLabelId: null,
      editingTextBoxId: null,
      editingTextBoxSize: null,
      annotation: {
        open: false,
        // Open in the non-disruptive Select mode; the user picks a draw tool.
        tool: 'select',
        color: ANNOTATION_COLOR_PRESETS[0],
        thickness: 4,
        strokes: [],
        past: [],
        future: []
      },

      actions: {
        setView: (view) => {
          // A new view has its own layers — drop any preview override so a
          // solo'd/hidden layer id from the previous view can't leak across.
          // (hide-labels is now a GLOBAL toggle, not per-view, so it persists.)
          //
          // F2/VIEW-01/02: the annotation ink goes too. Strokes are stored in
          // scene-canvas coordinates, so against a different page they sit at
          // positions that mean nothing — and with the pen palette closed there
          // is no visible Clear to remove them with. ADR 0014 calls the overlay
          // ephemeral; this is the transition that makes that true. The
          // edit<->present toggle deliberately still KEEPS them (setEditorMode),
          // because that one does not change the content underneath.
          set((state) => ({
            view,
            previewLayerOverrides: { hiddenLayerIds: [], soloLayerId: null },
            annotation: {
              ...state.annotation,
              strokes: [],
              past: [],
              future: []
            }
          }));
        },
        setEditorMode: (mode) => {
          // Leaving (or entering) preview clears the ephemeral preview overrides
          // and the view-only "hide all controls" flag so they never persist
          // across mode switches (ADR 0013). hide-labels is global → untouched.
          // M1: also close the annotation palette so a Present-mode pen overlay
          // doesn't linger into edit mode — but KEEP strokes (ADR 0014
          // session-scoped); only the open flag is reset.
          set((state) => ({
            editorMode: mode,
            mode: getStartingMode(mode),
            previewLayerOverrides: { hiddenLayerIds: [], soloLayerId: null },
            hideViewControls: false,
            // An on-canvas text-edit session (ADR 0034) is edit-mode chrome —
            // never carry it into view/present.
            editingTextBoxId: null,
            editingTextBoxSize: null,
            annotation: { ...state.annotation, open: false }
          }));
        },
        setIconCategoriesState: (iconCategoriesState) => {
          set({ iconCategoriesState });
        },
        setFreshlyLoadedCategoryIds: (ids) => {
          set({ freshlyLoadedCategoryIds: ids });
        },
        resetUiState: () => {
          set((state) => ({
            mode: getStartingMode(state.editorMode),
            scroll: {
              position: CoordsUtils.zero(),
              offset: CoordsUtils.zero()
            },
            itemControls: null,
            selectedIds: [],
            zoom: INITIAL_UI_STATE.zoom,
            // F2/VIEW-01/02 — the other transition that changes what is under
            // the ink. This is the only reset `useInitialDataManager` calls on
            // load, and it did not own the annotation slice, so strokes drawn
            // over one diagram stayed on screen over the next one.
            annotation: {
              ...state.annotation,
              strokes: [],
              past: [],
              future: []
            }
          }));
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
        setHoveredItem: (hoveredItem) => {
          set({ hoveredItem });
        },
        setItemControls: (itemControls, options) => {
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
            // ADR 0022 §3: select-only (openPanel:false) updates the panel
            // TARGET but does NOT mount the Properties dock. The explicit open
            // path (double-click, context-menu commands) keeps openPanel:true
            // (the default) and mounts it.
            const openPanel = options?.openPanel ?? true;
            if (!openPanel) {
              set({
                itemControls,
                selectedIds: nextSelected,
                selectedConnectorLabel: null
              });
              return;
            }
            set({
              itemControls,
              selectedIds: nextSelected,
              selectedConnectorLabel: null,
              rightSidebarOpen: inView ? rightSidebarOpen : true,
              ...(!inView && !alreadyPinned && { rightSidebarAutoOpened: true })
            });
          } else {
            const autoOpened = get().rightSidebarAutoOpened;
            set({
              itemControls,
              selectedConnectorLabel: null,
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
            // ADR 0022 §3: a single selection drives highlight + derives the
            // panel TARGET (itemControls) for F2 / delete / double-click, but
            // does NOT mount the Properties dock — leave rightSidebarOpen /
            // rightSidebarAutoOpened untouched so an already-open panel keeps
            // tracking selection (§4.1 two-way sync) while a closed one stays
            // closed until an explicit double-click.
            set({
              selectedIds: ids,
              itemControls: { type: only.type, id: only.id },
              selectedConnectorLabel: null
            });
          } else {
            const autoOpened = get().rightSidebarAutoOpened;
            set({
              selectedIds: ids,
              itemControls: null,
              selectedConnectorLabel: null,
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
        setPendingFitToView: (pendingFitToView) => {
          set({ pendingFitToView });
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
        setConnectorDefaults: (patch) => {
          set({ connectorDefaults: { ...get().connectorDefaults, ...patch } });
        },
        resetConnectorDefaults: () => {
          set({ connectorDefaults: {} });
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
            previewLayerOverrides: {
              hiddenLayerIds: nextHidden,
              soloLayerId: null
            }
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
        setPreviewHideLabels: (previewHideLabels) => {
          // UI-only GLOBAL hide-labels toggle (bottom-dock zoom cluster, both
          // editing + presentation): suppresses name labels live without ever
          // touching the model's `showLabel`, so it cannot dirty/save. Persists
          // across view/mode switches (it is a session-wide view preference).
          set({ previewHideLabels });
        },
        setHideViewControls: (hideViewControls) => {
          // UI-only view-only toggle: hides the on-canvas presentation chrome
          // (layer switcher, annotation palette, bottom dock) for a clean
          // screenshot. Cleared on mode switch above.
          //
          // F2/VIEW-09 (b) — hiding the chrome DISARMS the annotation tool.
          // `<AnnotationLayer />` is mounted unconditionally while the palette
          // sits behind `!hideViewControls`, so hiding the chrome with a draw
          // tool armed left a full-canvas overlay at `pointer-events: auto`
          // with its pen and tool row gone: the canvas was unusable and the
          // only way out was the undocumented Escape/V key. Nothing in the app
          // calls this setter today (symptom (a) of the same entry), but it is
          // on the public action surface, so an embedder can reach the trap.
          //
          // Disarming rather than keeping the palette mounted: the point of the
          // toggle is a clean screenshot, and a mounted palette defeats it.
          set((state) => ({
            hideViewControls,
            annotation: hideViewControls
              ? { ...state.annotation, tool: 'select' as const }
              : state.annotation
          }));
        },
        setExportHideLabels: (exportHideLabels) => {
          // UI-only image-export toggle (ADR 0025 §3): suppresses name labels in
          // the exported image. Scoped to the export dialog's own Axoview store,
          // so it never touches the live canvas or the model's `showLabel`.
          set({ exportHideLabels });
        },
        setLabelDrag: (id, height) => {
          // Transient on-canvas label-drag preview (ADR 0024 — Track P T6 fix).
          // Promotes the node to the DOM overlay (Renderer.hybridIds) and carries
          // the live labelHeight, so the drag is a single-node DOM re-render — NOT
          // a per-frame model write that redraws every visible canvas node
          // (~10 fps at 1000 visible). Committed to the model once, on release.
          set({ labelDrag: { id, height } });
        },
        clearLabelDrag: () => {
          set({ labelDrag: null });
        },
        setLabelMove: (id, tile, offset) => {
          // Transient floating-Label move preview (ADR 0031). SceneCanvas reads
          // this to redraw the dragged chip following the pointer with NO model
          // write, so the LabelHitLayer proxy divs don't re-render each frame.
          // Committed to the model once, on release.
          set({ labelMove: { id, tile, offset } });
        },
        clearLabelMove: () => {
          set({ labelMove: null });
        },
        setLabelMoves: (moves) => {
          // Transient GROUP floating-Label move preview (ADR 0031): the
          // multi-selection-drag counterpart of setLabelMove. DragItems writes
          // the whole dragged-label set once per frame; SceneCanvas redraws each
          // keyed chip at its preview tile/offset with NO model write. Committed
          // to the model once, on release.
          set({ labelMoves: moves });
        },
        clearLabelMoves: () => {
          set({ labelMoves: null });
        },
        setIconScaleDrag: (scales) => {
          // Transient on-canvas icon-resize preview (ADR 0044). The resized nodes
          // (DOM) + their selection rings read this map to follow the drag with
          // NO model write, so the O(N) WebGL node bulk isn't rebuilt each frame
          // (canvas-interaction.md §6.1/§6.4). One entry for a single node, N for
          // a group. Committed to the model once, on release.
          set({ iconScaleDrag: { scales } });
        },
        clearIconScaleDrag: () => {
          set({ iconScaleDrag: null });
        },
        setInlineEditLabelId: (id) => {
          set({ inlineEditLabelId: id });
        },
        // R4/RND-13/15: the canvas inline-RENAME intent for a node. Selection no
        // longer promotes a node into the DOM overlay (order-preserving
        // selection, ADR 0038 §8), so renaming — which needs a real
        // contentEditable — is what promotes it now, and the intent has to be
        // store state: the `inlineEditNodeName` window event fires synchronously,
        // and a node that has not mounted yet cannot hear it.
        setInlineEditNodeId: (id) => {
          set({ inlineEditNodeId: id });
        },
        // F4/LAY-03 — the layer new elements are placed onto. There was no
        // active-layer concept anywhere in the store, so every new element
        // landed unassigned and had to be dragged across afterwards; on a
        // diagram organised into layers that pile grew with every edit.
        setActiveLayerId: (id) => {
          set({ activeLayerId: id });
        },
        setViewModeHoveredLabelId: (id) => {
          // View-mode chip hover for the info popover (notes parity). Written
          // only by LabelHitLayer's hover-only view-mode proxies on
          // pointerenter/leave — rare, so no identity guard is needed.
          set({ viewModeHoveredLabelId: id });
        },
        setEditingTextBoxId: (id) => {
          // A session change invalidates the previous session's live measure —
          // consumers fall back to the committed model size until the editor's
          // first draft callback lands.
          set({ editingTextBoxId: id, editingTextBoxSize: null });
        },
        setEditingTextBoxSize: (size) => {
          // Called per keystroke; sizes are integer tiles so most calls are
          // no-ops. Keep the stored object's identity when equal so selector
          // subscribers (the projected box + transform bounds) don't re-render.
          set((state) =>
            state.editingTextBoxSize &&
            size &&
            state.editingTextBoxSize.width === size.width &&
            state.editingTextBoxSize.height === size.height
              ? {}
              : { editingTextBoxSize: size }
          );
        },
        setSelectedConnectorLabel: (sel) => {
          set({ selectedConnectorLabel: sel });
        },
        // --- Annotation overlay (ADR 0014) — ephemeral, never persisted ---
        setAnnotationOpen: (open) => {
          const state = get();
          if (!open) {
            set({ annotation: { ...state.annotation, open } });
            return;
          }
          // Entering annotation resets the canvas interaction so a previously
          // armed tool (connector, lasso, freehand, pan, place-icon, draw-
          // rectangle, textbox…) doesn't linger behind the overlay, and clears
          // the active selection / floating action bar. The right dock is closed
          // only if it was auto-opened (a manual pin is respected).
          set({
            annotation: { ...state.annotation, open },
            ...canvasResetForAnnotation(state)
          });
        },
        setAnnotationTool: (tool) => {
          const state = get();
          // Arming an annotation draw/eraser tool must also abort any in-flight
          // canvas gesture (a half-drawn lasso / freehand selection) and clear
          // the selection — otherwise the two coexist and neither behaves (the
          // lasso keeps its stuck selection while the overlay captures input).
          // The pass-through `select` tool leaves the canvas as-is so the user
          // can resume normal canvas interaction. Mirrors setAnnotationOpen.
          const needsCanvasReset = tool !== 'select';
          set({
            annotation: { ...state.annotation, tool },
            ...(needsCanvasReset ? canvasResetForAnnotation(state) : {})
          });
        },
        setAnnotationColor: (color) => {
          set({ annotation: { ...get().annotation, color } });
        },
        setAnnotationThickness: (thickness) => {
          set({ annotation: { ...get().annotation, thickness } });
        },
        // F2/VIEW-07 + VIEW-13 — every mutation goes through the operation
        // log, so undo can invert an erase or a clear at its own position
        // instead of eating the tail. The inversion rules live in
        // `utils/annotationOps`; these five only decide what to record.
        addAnnotationStroke: (stroke) => {
          const { annotation } = get();
          const op: AnnotationOp = {
            kind: 'add',
            stroke,
            index: annotation.strokes.length
          };
          set({
            annotation: {
              ...annotation,
              strokes: applyAnnotationOp(annotation.strokes, op),
              past: [...annotation.past, op],
              // A new operation invalidates the redo branch (linear history).
              future: []
            }
          });
        },
        undoAnnotationStroke: () => {
          const { annotation } = get();
          const op = annotation.past.at(-1);
          if (!op) return;
          set({
            annotation: {
              ...annotation,
              strokes: revertAnnotationOp(annotation.strokes, op),
              past: annotation.past.slice(0, -1),
              future: [op, ...annotation.future]
            }
          });
        },
        redoAnnotationStroke: () => {
          const { annotation } = get();
          const op = annotation.future[0];
          if (!op) return;
          set({
            annotation: {
              ...annotation,
              strokes: applyAnnotationOp(annotation.strokes, op),
              past: [...annotation.past, op],
              future: annotation.future.slice(1)
            }
          });
        },
        eraseAnnotationStroke: (id) => {
          const { annotation } = get();
          const index = annotation.strokes.findIndex((s) => s.id === id);
          // Nothing erased is not an operation — recording one would put an
          // inert entry on the log and cost a real Undo press to get past.
          if (index === -1) return;
          const op: AnnotationOp = {
            kind: 'erase',
            stroke: annotation.strokes[index],
            index
          };
          set({
            annotation: {
              ...annotation,
              strokes: applyAnnotationOp(annotation.strokes, op),
              past: [...annotation.past, op],
              future: []
            }
          });
        },
        reprojectAnnotationStrokes: (mapPoint) => {
          // F2/VIEW-03 — applied to the live strokes AND to every stroke held
          // in the operation log, because an undo/redo after the switch must
          // put the stroke back where the content is NOW, not where it was
          // under the previous projection. The log is history, not an archive
          // of old coordinates.
          const { annotation } = get();
          if (annotation.strokes.length === 0 && annotation.past.length === 0) {
            return;
          }
          const mapStroke = (stroke: AnnotationStroke): AnnotationStroke => ({
            ...stroke,
            points: stroke.points.map(mapPoint)
          });
          const mapOp = (op: AnnotationOp): AnnotationOp => {
            if (op.kind === 'clear') {
              return { ...op, strokes: op.strokes.map(mapStroke) };
            }
            return { ...op, stroke: mapStroke(op.stroke) };
          };
          set({
            annotation: {
              ...annotation,
              strokes: annotation.strokes.map(mapStroke),
              past: annotation.past.map(mapOp),
              future: annotation.future.map(mapOp)
            }
          });
        },
        clearAnnotations: () => {
          const { annotation } = get();
          // Same rule: clearing nothing is not an operation.
          if (annotation.strokes.length === 0) return;
          const op: AnnotationOp = {
            kind: 'clear',
            strokes: annotation.strokes
          };
          set({
            annotation: {
              ...annotation,
              strokes: applyAnnotationOp(annotation.strokes, op),
              past: [...annotation.past, op],
              future: []
            }
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
          // E4/CLIP-10 (ADR 0011): an unread ERROR is never displaced by an
          // informational toast. Progress/success messages are routine
          // (routing N%, pasted N items) and were burying failure reports —
          // a failed save under a paste toast is unsaved work the user was
          // told nothing about. A non-error arriving while an error shows is
          // dropped; errors and explicit clears (null) always land.
          const current = get().notification;
          if (
            notification &&
            current?.severity === 'error' &&
            notification.severity !== 'error'
          ) {
            return;
          }
          set({ notification });
        },
        setActiveLeftTab: (activeLeftTab) => {
          set({ activeLeftTab });
        },
        setRightSidebarOpen: (rightSidebarOpen) => {
          set({ rightSidebarOpen, rightSidebarAutoOpened: false });
        },
        openContextMenu: (contextMenu) => {
          set({ contextMenu });
        },
        closeContextMenu: () => {
          set({ contextMenu: null });
        },
        setIsDirty: (isDirty) => {
          set({ isDirty });
        },
        setCanvasMode: (canvasMode) => {
          set({ canvasMode });
        },
        setViewRotation: (degrees) => {
          const next = normaliseDeg(degrees);
          const state = get();
          const {
            viewRotation,
            viewRotationBase,
            viewRotationInMotion,
            scroll,
            zoom,
            canvasMode
          } = state;
          // Outside motion every change is also a settle (base := live), so the
          // one rebuild happens here. Inside motion only the live angle moves and
          // the scene follows by the motion transform (ADR 0049 §6).
          const nextBase = viewRotationInMotion ? viewRotationBase : next;
          if (next === viewRotation && nextBase === viewRotationBase) return;
          // Pivot about the tile under the viewport centre — the same map the
          // iso↔2D switch uses, here between the iso projection at the old and
          // the new angle (ADR 0049 §7). 2D: θ is retained but has no effect,
          // so there is no pivot to keep.
          const nextScroll =
            canvasMode === 'ISOMETRIC' && next !== viewRotation
              ? {
                  ...scroll,
                  position: getCanvasModeSwitchScroll(
                    makeIsometricStrategy(viewRotation),
                    makeIsometricStrategy(next),
                    zoom,
                    scroll
                  )
                }
              : scroll;
          set({
            viewRotation: next,
            viewRotationBase: nextBase,
            ...(nextScroll !== scroll ? { scroll: nextScroll } : {}),
            ...(viewRotationInMotion
              ? {}
              : refreshedMouseTile(state, next, nextScroll))
          });
        },
        beginViewRotationMotion: () => {
          if (get().viewRotationInMotion) return;
          set({ viewRotationInMotion: true });
        },
        rebaseViewRotation: () => {
          const { viewRotation, viewRotationBase } = get();
          if (viewRotation === viewRotationBase) return;
          set({ viewRotationBase: viewRotation });
        },
        settleViewRotation: () => {
          const state = get();
          const { viewRotation, viewRotationBase, viewRotationInMotion } = state;
          if (!viewRotationInMotion && viewRotation === viewRotationBase) return;
          set({
            viewRotationBase: viewRotation,
            viewRotationInMotion: false,
            ...refreshedMouseTile(state, viewRotation, state.scroll)
          });
        },
        animateViewRotationTo: (degrees) => {
          const actions = get().actions;
          const target = normaliseDeg(degrees);
          const wasAnimating = rotationAnim !== null;
          cancelRotationAnim();
          const from = get().viewRotation;
          const delta = shortestArc(from, target);
          if (delta === 0) {
            if (wasAnimating) actions.settleViewRotation();
            return;
          }
          const raf =
            typeof requestAnimationFrame === 'function'
              ? requestAnimationFrame
              : null;
          if (!raf || prefersReducedMotion()) {
            // Instant: one settle, no in-between frames.
            actions.settleViewRotation();
            actions.setViewRotation(target);
            return;
          }
          actions.beginViewRotationMotion();
          const start = performance.now();
          const tick = (now: number) => {
            const t = Math.min(1, (now - start) / VIEW_ROTATION_TWEEN_MS);
            if (t >= 1) {
              rotationAnim = null;
              // Land EXACTLY on the target (cardinals stay exact), then settle.
              actions.setViewRotation(target);
              actions.settleViewRotation();
              return;
            }
            const eased = 1 - Math.pow(1 - t, 3);
            actions.setViewRotation(from + delta * eased);
            if (rotationAnim) rotationAnim.raf = raf(tick);
          };
          rotationAnim = { raf: raf(tick), target };
        },
        stepViewRotation: (direction, toCardinal = false) => {
          // Chain from an in-flight animation's target, so a second press during
          // the tween goes one further step rather than re-targeting the same one.
          const current = rotationAnim ? rotationAnim.target : get().viewRotation;
          get().actions.animateViewRotationTo(
            nextLatticeAngle(
              current,
              direction,
              toCardinal ? 90 : VIEW_ROTATION_STEP_DEG
            )
          );
        },
        finishViewRotationAnimation: () => {
          if (!rotationAnim) return;
          const { target } = rotationAnim;
          cancelRotationAnim();
          const actions = get().actions;
          actions.setViewRotation(target);
          actions.settleViewRotation();
        },
        setSnapToGrid: (snapToGrid) => {
          set({ snapToGrid });
        },
        toggleSnapToGrid: () => {
          set({ snapToGrid: !get().snapToGrid });
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
