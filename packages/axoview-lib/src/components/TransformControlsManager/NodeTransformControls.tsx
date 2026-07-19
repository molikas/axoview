import React, { useCallback } from 'react';
import { useViewItem } from 'src/hooks/useViewItem';
import { useModelItem } from 'src/hooks/useModelItem';
import { useIcon } from 'src/hooks/useIcon';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { AnchorPosition } from 'src/types';
import { TransformControls } from './TransformControls';

interface Props {
  id: string;
  // ADR 0044 group-resize: false when the node is part of a multi-selection —
  // the group box (NodeGroupTransformControls) owns the handles, so a member
  // shows only its selection ring (which still grows with the group preview).
  showHandles?: boolean;
}

// ADR 0044: a node resizes its ICON uniformly, so it offers only the four corner
// handles (no one-axis edge handles — those would distort a square glyph).
export const NODE_CORNER_ANCHORS: AnchorPosition[] = [
  'TOP_LEFT',
  'TOP_RIGHT',
  'BOTTOM_LEFT',
  'BOTTOM_RIGHT'
];

// Live size readout shown on the chrome during a resize (restores the "1.0×"
// the removed top-bar slider used to show). Multiplier, one decimal.
export const formatIconScale = (scale: number): string => `${scale.toFixed(1)}×`;

export const NodeTransformControls = ({ id, showHandles = true }: Props) => {
  const node = useViewItem(id);
  const modelItem = useModelItem(id);
  // Resolves DEFAULT_ICON / TOMBSTONE for the shared-asset `scale` fallback.
  const { icon } = useIcon(modelItem?.icon);
  const uiStateActions = useUiStateStore((state) => state.actions);
  // Live preview scale for THIS node while it (or its group) is being resized.
  const previewScale = useUiStateStore(
    (state) => state.iconScaleDrag?.scales[id] ?? null
  );

  // Effective scale: live preview ?? committed per-node override ?? shared asset
  // scale ?? 1. Drives the ring extent (and, single-select, the readout).
  const committedScale = node?.iconScale ?? icon.scale ?? 1;
  const effectiveScale = previewScale ?? committedScale;

  const onAnchorMouseDown = useCallback(
    (key: AnchorPosition) => {
      if (!node) return;
      uiStateActions.setMode({
        type: 'NODE.TRANSFORM',
        selectedAnchor: key,
        targets: [{ id, startScale: node.iconScale ?? icon.scale ?? 1 }],
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
      onAnchorMouseDown={showHandles ? onAnchorMouseDown : undefined}
      anchorPositions={NODE_CORNER_ANCHORS}
      extentScale={effectiveScale}
      readout={
        showHandles && previewScale != null
          ? formatIconScale(previewScale)
          : undefined
      }
    />
  );
};
