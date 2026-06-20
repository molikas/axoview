import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box } from '@mui/material';
import { useUiStateStore, useUiStateStoreApi } from 'src/stores/uiStateStore';
import { useInteractionManager } from 'src/interaction/useInteractionManager';
import { useCanvasMode, CanvasModeContextValue } from 'src/contexts/CanvasModeContext';
import { Grid } from 'src/components/Grid/Grid';
import { Cursor } from 'src/components/Cursor/Cursor';
import { Nodes } from 'src/components/SceneLayers/Nodes/Nodes';
import { NodesCanvas } from 'src/components/SceneLayers/Nodes/NodesCanvas';
import { NodeLabelHitLayer } from 'src/components/SceneLayers/Nodes/NodeLabelHitLayer';
import { Rectangles } from 'src/components/SceneLayers/Rectangles/Rectangles';
import { Connectors } from 'src/components/SceneLayers/Connectors/Connectors';
import { ConnectorLabels } from 'src/components/SceneLayers/ConnectorLabels/ConnectorLabels';
import { TextBoxes } from 'src/components/SceneLayers/TextBoxes/TextBoxes';
import { SizeIndicator } from 'src/components/DebugUtils/SizeIndicator';
import { SceneLayer } from 'src/components/SceneLayer/SceneLayer';
import { TransformControlsManager } from 'src/components/TransformControlsManager/TransformControlsManager';
import { ConnectorAnchorOverlay } from 'src/components/ConnectorAnchorOverlay/ConnectorAnchorOverlay';
import { Lasso } from 'src/components/Lasso/Lasso';
import { FreehandLasso } from 'src/components/FreehandLasso/FreehandLasso';
import { useScene } from 'src/hooks/useScene';
import { RendererProps } from 'src/types/rendererProps';
import { Scroll, Size, ViewItem } from 'src/types';

// Stable empty list so the canvas-node DOM hybrid overlay memo returns a
// referentially-stable value when nothing is selected (avoids re-renders).
const NO_HYBRID_NODES: ViewItem[] = [];

// Extra tiles of padding around the screen edges to avoid visible pop-in.
const VIEWPORT_TILE_PADDING = 4;

interface TileBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

const computeTileBounds = (
  scroll: Scroll,
  zoom: number,
  rendererSize: Size,
  screenToTile: CanvasModeContextValue['screenToTile']
): TileBounds => {
  if (rendererSize.width === 0 || rendererSize.height === 0) {
    return { minX: -Infinity, maxX: Infinity, minY: -Infinity, maxY: Infinity };
  }

  const corners = [
    { x: 0, y: 0 },
    { x: rendererSize.width, y: 0 },
    { x: 0, y: rendererSize.height },
    { x: rendererSize.width, y: rendererSize.height }
  ].map((mouse) => screenToTile({ mouse, zoom, scroll, rendererSize }));

  const xs = corners.map((t) => t.x);
  const ys = corners.map((t) => t.y);

  return {
    minX: Math.min(...xs) - VIEWPORT_TILE_PADDING,
    maxX: Math.max(...xs) + VIEWPORT_TILE_PADDING,
    minY: Math.min(...ys) - VIEWPORT_TILE_PADDING,
    maxY: Math.max(...ys) + VIEWPORT_TILE_PADDING
  };
};

const tileBoundsEqual = (a: TileBounds, b: TileBounds) =>
  a.minX === b.minX &&
  a.maxX === b.maxX &&
  a.minY === b.minY &&
  a.maxY === b.maxY;

export const Renderer = ({ showGrid, backgroundColor }: RendererProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const interactionsRef = useRef<HTMLDivElement>(null);
  const uiStateApi = useUiStateStoreApi();
  const { screenToTile } = useCanvasMode();
  const enableDebugTools = useUiStateStore((state) => state.enableDebugTools);
  const showCursor = useUiStateStore((state) => state.mode.showCursor);
  // While an annotation draw/eraser tool is active, the canvas cursor tile
  // highlight would sit under the pen and read as a stray selection — hide it.
  const annotationActive = useUiStateStore(
    (state) => state.annotation.open && state.annotation.tool !== 'select'
  );
  const uiStateActions = useUiStateStore((state) => state.actions);
  const { setInteractionsElement } = useInteractionManager();
  const {
    items,
    rectangles,
    connectors,
    hitConnectors,
    textBoxes,
    currentView
  } = useScene();

  // Tile-space visible bounds — updated by the store subscriber (no React renders on pan/zoom
  // unless the tile range actually changes). Coarse equality means re-renders only fire when
  // the user pans far enough to expose new tiles, not on every pixel.
  const [coarseBounds, setCoarseBounds] = useState<TileBounds>(() => {
    const s = uiStateApi.getState();
    return computeTileBounds(s.scroll, s.zoom, s.rendererSize, screenToTile);
  });

  useEffect(() => {
    const unsubscribe = uiStateApi.subscribe((state, prev) => {
      if (
        state.scroll === prev.scroll &&
        state.zoom === prev.zoom &&
        state.rendererSize === prev.rendererSize
      ) {
        return;
      }
      const newBounds = computeTileBounds(
        state.scroll,
        state.zoom,
        state.rendererSize,
        screenToTile
      );
      setCoarseBounds((cur) =>
        tileBoundsEqual(cur, newBounds) ? cur : newBounds
      );
    });
    return unsubscribe;
  }, [uiStateApi, screenToTile]);

  useEffect(() => {
    if (!containerRef.current || !interactionsRef.current) return;
    setInteractionsElement(interactionsRef.current);
    uiStateActions.setRendererEl(containerRef.current);
  }, [setInteractionsElement, uiStateActions]);

  const isShowGrid = useMemo(
    () => showGrid === undefined || showGrid,
    [showGrid]
  );

  // The node layer is drawn by the imperative Canvas2D path (NodesCanvas) — the
  // default and sole bulk renderer (ADR 0019). The actively-manipulated nodes —
  // the single SELECTED node and any node currently being DRAGGED — are instead
  // rendered by the DOM <Node> overlay (and skipped by the canvas) so they keep
  // the DOM affordances the canvas can't cheaply replicate: the F2 inline-rename
  // contentEditable and readable-labels counter-scale wrapper (selected node),
  // and the `--ff-drag` compositor drag preview (DragItems mutates
  // `[data-drag-id]`, which only the DOM path has). Both signals are sparse —
  // `itemControls` is the single-selection signal (null for 0 or >1 selected);
  // `mode.items` lists the drag set only while mode === DRAG_ITEMS. Nothing is
  // selected or dragging during bulk spawn, so the bulk path is pure canvas.
  // Dragging the node in DOM (rather than redrawing it on the canvas per preview
  // frame) is how the hybrid gets a correct, compositor-only drag preview for free.
  const selectedNodeId = useUiStateStore((s) =>
    s.itemControls?.type === 'ITEM' ? s.itemControls.id : null
  );
  // Comma-joined dragged-ITEM ids (a primitive, so the selector re-renders only
  // on drag start/end, not per drag frame — mode.items is set once at entry).
  const draggingKey = useUiStateStore((s) =>
    s.mode.type === 'DRAG_ITEMS'
      ? s.mode.items
          .filter((i) => i.type === 'ITEM')
          .map((i) => i.id)
          .join(',')
      : ''
  );
  // Track P (T6 fix): a canvas node whose NAME label is being dragged is promoted
  // to the DOM overlay too, so the label follows the pointer in DOM (a single-node
  // CSS-preview re-render) instead of a per-frame model write redrawing the whole
  // canvas. A primitive id selector → re-renders only on label-drag start/end.
  const labelDragId = useUiStateStore((s) => s.labelDrag?.id ?? null);

  const hybridIds = useMemo(() => {
    if (!selectedNodeId && !draggingKey && !labelDragId) return null;
    const ids = new Set<string>();
    if (selectedNodeId) ids.add(selectedNodeId);
    if (draggingKey) for (const id of draggingKey.split(',')) ids.add(id);
    if (labelDragId) ids.add(labelDragId);
    return ids;
  }, [selectedNodeId, draggingKey, labelDragId]);

  const visibleItems = useMemo(() => {
    const { minX, maxX, minY, maxY } = coarseBounds;
    if (minX === -Infinity) return items; // bounds not yet computed
    return items.filter(
      (item) =>
        item.tile.x >= minX &&
        item.tile.x <= maxX &&
        item.tile.y >= minY &&
        item.tile.y <= maxY
    );
  }, [items, coarseBounds]);

  // The selected node, lifted out of the canvas into a DOM <Node> overlay (see
  // selectedNodeId). Referentially stable (NO_HYBRID_NODES) when nothing is
  // selected so the canvas + overlay don't re-render on unrelated state.
  const hybridNodes = useMemo(() => {
    if (!hybridIds) return NO_HYBRID_NODES;
    const found = visibleItems.filter((item) => hybridIds.has(item.id));
    return found.length > 0 ? found : NO_HYBRID_NODES;
  }, [hybridIds, visibleItems]);

  // Canvas-drawn nodes (everything not lifted into the DOM overlay) — their
  // labels get invisible drag hit targets so they can be repositioned without
  // selecting first (ADR 0024, label-as-handle). The selected/dragged nodes keep
  // their own DOM label handle.
  const canvasLabelNodes = useMemo(() => {
    if (!hybridIds) return visibleItems;
    return visibleItems.filter((item) => !hybridIds.has(item.id));
  }, [hybridIds, visibleItems]);

  const visibleConnectors = useMemo(() => {
    const { minX, maxX, minY, maxY } = coarseBounds;
    if (minX === -Infinity) return connectors;
    // Use hitConnectors (which carry path data) to cull off-screen connectors,
    // then return the corresponding raw connectors for rendering.
    const visibleIds = new Set(
      hitConnectors
        .filter((connector) => {
          if (!connector.path?.rectangle) return true;
          const { from, to } = connector.path.rectangle;
          const cMinX = Math.min(from.x, to.x);
          const cMaxX = Math.max(from.x, to.x);
          const cMinY = Math.min(from.y, to.y);
          const cMaxY = Math.max(from.y, to.y);
          return (
            cMaxX >= minX && cMinX <= maxX && cMaxY >= minY && cMinY <= maxY
          );
        })
        .map((c) => c.id)
    );
    return connectors.filter((c) => visibleIds.has(c.id));
  }, [connectors, hitConnectors, coarseBounds]);

  return (
    <Box
      ref={containerRef}
      data-testid="axoview-canvas"
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        // Touch/pen gesture guardrails (ADR 0018 Decision 7). On the container
        // (rendererEl) so they also cover the sibling anchor/label SceneLayers,
        // and scoped to the canvas so page scroll elsewhere is unaffected.
        // The canvas owns pan/zoom for touch (one-finger pan, two-finger pinch),
        // so the browser's native pan/zoom/double-tap must be disabled here.
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
        bgcolor: (theme) =>
          backgroundColor === 'transparent'
            ? 'transparent'
            : (backgroundColor ?? theme.customVars.customPalette.diagramBg)
      }}
    >
      <SceneLayer>
        <Rectangles rectangles={rectangles} />
      </SceneLayer>
      <SceneLayer>
        <Lasso />
      </SceneLayer>
      <FreehandLasso />
      <Box
        sx={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          top: 0,
          left: 0
        }}
      >
        {isShowGrid && <Grid />}
      </Box>
      {showCursor && !annotationActive && (
        <SceneLayer>
          <Cursor />
        </SceneLayer>
      )}
      <SceneLayer>
        <Connectors connectors={visibleConnectors} currentView={currentView} />
      </SceneLayer>
      <SceneLayer>
        <TextBoxes textBoxes={textBoxes} />
      </SceneLayer>
      <SceneLayer>
        <ConnectorLabels connectors={visibleConnectors} />
      </SceneLayer>
      {enableDebugTools && (
        <SceneLayer>
          <SizeIndicator />
        </SceneLayer>
      )}
      {/* Interaction layer: this is where events are detected */}
      <Box
        ref={interactionsRef}
        data-axoview-id="canvas-interactions"
        sx={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          height: '100%'
        }}
      />
      <NodesCanvas nodes={visibleItems} skipNodes={hybridNodes} />
      <SceneLayer>
        <NodeLabelHitLayer nodes={canvasLabelNodes} />
      </SceneLayer>
      {hybridNodes.length > 0 && (
        <SceneLayer>
          <Nodes nodes={hybridNodes} />
        </SceneLayer>
      )}
      <SceneLayer>
        <ConnectorAnchorOverlay />
      </SceneLayer>
      <SceneLayer>
        <TransformControlsManager />
      </SceneLayer>
    </Box>
  );
};
