import React, { memo, useMemo } from 'react';
import { ViewItem } from 'src/types';
import { useLayerContext } from 'src/hooks/useLayerContext';
import { resolveRenderOrder, findLayer } from 'src/utils/renderOrder';
import { useRenderProbe } from 'src/utils/renderProbe';
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

  const sortedNodes = useMemo(() => {
    // Filter to visible-only, then sort by resolved render order descending
    // (higher order = rendered later = visually on top in CSS stacking).
    return [...nodes]
      .filter((node) => layers.length === 0 || visibleIds.has(node.id))
      .sort((a, b) => {
        const layerA = findLayer(a.layerId, layers);
        const layerB = findLayer(b.layerId, layers);
        const orderA = resolveRenderOrder(
          layerA?.order ?? 0,
          a.zIndex ?? 0,
          -a.tile.x - a.tile.y
        );
        const orderB = resolveRenderOrder(
          layerB?.order ?? 0,
          b.zIndex ?? 0,
          -b.tile.x - b.tile.y
        );
        return orderA - orderB;
      });
  }, [nodes, layers, visibleIds]);

  return (
    <>
      {sortedNodes.map((node) => {
        const layer = findLayer(node.layerId, layers);
        const order = resolveRenderOrder(
          layer?.order ?? 0,
          node.zIndex ?? 0,
          -node.tile.x - node.tile.y
        );
        return <Node key={node.id} order={order} node={node} />;
      })}
    </>
  );
});
