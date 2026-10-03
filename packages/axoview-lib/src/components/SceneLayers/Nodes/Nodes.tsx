import React, { memo, useMemo } from 'react';
import { ViewItem } from 'src/types';
import { useLayerContext } from 'src/hooks/useLayerContext';
import {
  resolveRenderOrder,
  findLayer,
  sortTilesInPaintOrder
} from 'src/utils/renderOrder';
import { useRenderProbe } from 'src/utils/renderProbe';
import { useCanvasMode } from 'src/contexts/CanvasModeContext';
import { Node } from './Node/Node';

interface Props {
  nodes: ViewItem[];
}

// Maps a node list to DOM <Node> components. Since ADR 0019 (Canvas2D is the
// default + sole BULK node renderer), this is no longer the bulk path — the
// Renderer feeds it only the sparse hybrid-overlay set (the selected node ∪ the
// drag set), so it renders 0–few nodes, never N. Retained because the overlay
// needs the real DOM <Node> (F2 inline-rename, readable-labels counter-scale,
// `--ff-drag` drag preview) and this component already does the render-order
// sort correctly.
export const Nodes = memo(({ nodes }: Props) => {
  useRenderProbe('Nodes');
  const { layers, visibleIds } = useLayerContext();
  // The projection's depth (rotated under view rotation, ADR 0049 §5) through
  // the SAME comparator SceneCanvas and the picker use.
  const { strategy } = useCanvasMode();

  const sortedNodes = useMemo(
    () =>
      // Filter to visible-only, then sort by render order ascending (later =
      // visually on top in CSS stacking).
      sortTilesInPaintOrder(
        nodes.filter((node) => layers.length === 0 || visibleIds.has(node.id)),
        (layerId) => findLayer(layerId, layers)?.order ?? 0,
        strategy
      ),
    [nodes, layers, visibleIds, strategy]
  );

  return (
    <>
      {sortedNodes.map((node) => {
        const layer = findLayer(node.layerId, layers);
        // Rounded: the order becomes a CSS z-index, which must be an integer.
        // A rotated depth is a float; rounding can only TIE two neighbours, and
        // a z-index tie falls back to DOM order — the sorted order above.
        const order = Math.round(
          resolveRenderOrder(
            layer?.order ?? 0,
            node.zIndex ?? 0,
            strategy.depth(node.tile)
          )
        );
        return <Node key={node.id} order={order} node={node} />;
      })}
    </>
  );
});
