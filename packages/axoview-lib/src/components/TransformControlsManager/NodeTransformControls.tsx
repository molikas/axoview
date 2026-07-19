import React, { useCallback } from 'react';
import { useViewItem } from 'src/hooks/useViewItem';
import { useModelItem } from 'src/hooks/useModelItem';
import { useIcon } from 'src/hooks/useIcon';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { AnchorPosition } from 'src/types';
import { TransformControls } from './TransformControls';

interface Props {
  id: string;
}

// ADR 0044: a node resizes its ICON uniformly, so it offers only the four corner
// handles (no one-axis edge handles — those would distort a square glyph).
const NODE_CORNER_ANCHORS: AnchorPosition[] = [
  'TOP_LEFT',
  'TOP_RIGHT',
  'BOTTOM_LEFT',
  'BOTTOM_RIGHT'
];

export const NodeTransformControls = ({ id }: Props) => {
  const node = useViewItem(id);
  const modelItem = useModelItem(id);
  // Resolves DEFAULT_ICON / TOMBSTONE for the shared-asset `scale` fallback.
  const { icon } = useIcon(modelItem?.icon);
  const uiStateActions = useUiStateStore((state) => state.actions);
  // Live preview scale while THIS node is being resized (null otherwise), so the
  // selection ring + handles grow with the drag before the model is written.
  const iconScaleDrag = useUiStateStore((state) =>
    state.iconScaleDrag?.id === id ? state.iconScaleDrag.scale : null
  );

  // Effective scale: live preview ?? committed per-node override ?? shared asset
  // scale ?? 1. Drives both the start scale for the drag and the ring extent.
  const committedScale = node?.iconScale ?? icon.scale ?? 1;
  const effectiveScale = iconScaleDrag ?? committedScale;

  const onAnchorMouseDown = useCallback(
    (key: AnchorPosition) => {
      if (!node) return;
      uiStateActions.setMode({
        type: 'NODE.TRANSFORM',
        id,
        selectedAnchor: key,
        startScale: node.iconScale ?? icon.scale ?? 1,
        showCursor: true
      });
    },
    [id, node, icon.scale, uiStateActions]
  );

  if (!node) {
    return null;
  }

  return (
    <TransformControls
      from={node.tile}
      to={node.tile}
      onAnchorMouseDown={onAnchorMouseDown}
      anchorPositions={NODE_CORNER_ANCHORS}
      extentScale={effectiveScale}
    />
  );
};
