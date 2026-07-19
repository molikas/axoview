import React, { useCallback, useMemo } from 'react';
import { useViewItem } from 'src/hooks/useViewItem';
import { useModelItem } from 'src/hooks/useModelItem';
import { useIcon } from 'src/hooks/useIcon';
import { useImageAspect } from 'src/hooks/useImageAspect';
import { useCanvasMode } from 'src/contexts/CanvasModeContext';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { AnchorPosition } from 'src/types';
import { PROJECTED_TILE_SIZE } from 'src/config';
import { ScreenBoxTransformControls } from './ScreenBoxTransformControls';

interface Props {
  id: string;
  // ADR 0044 group-resize: false when the node is part of a multi-selection —
  // the group box (NodeGroupTransformControls) owns the handles, so a member
  // shows only its outline (which still grows with the group preview).
  showHandles?: boolean;
}

// Live size readout shown during a resize (restores the "1.0×" the removed
// top-bar slider used to show). Multiplier, one decimal.
export const formatIconScale = (scale: number): string => `${scale.toFixed(1)}×`;

// Icon on-canvas width = PROJECTED_TILE_SIZE.width * k * scale, where k mirrors
// the render (IsometricIcon 0.8 / NonIsometricIcon 0.7). Height follows the
// icon's natural aspect, so the box matches the sprite's rendered bounds.
const iconWidthFactor = (isIsometric: boolean): number =>
  isIsometric ? 0.8 : 0.7;

export const NodeTransformControls = ({ id, showHandles = true }: Props) => {
  const node = useViewItem(id);
  const modelItem = useModelItem(id);
  // Resolves DEFAULT_ICON / TOMBSTONE for the shared-asset `scale` fallback.
  const { icon } = useIcon(modelItem?.icon);
  const aspect = useImageAspect(icon.url);
  const { getTilePosition } = useCanvasMode();
  const uiStateActions = useUiStateStore((state) => state.actions);
  // Live preview scale for THIS node while it (or its group) is being resized.
  const previewScale = useUiStateStore(
    (state) => state.iconScaleDrag?.scales[id] ?? null
  );

  // Effective scale: live preview ?? committed per-node override ?? shared asset
  // scale ?? 1. Drives the box size (and, single-select, the readout).
  const committedScale = node?.iconScale ?? icon.scale ?? 1;
  const effectiveScale = previewScale ?? committedScale;

  // Screen-space box hugging the icon's rendered bounds (centred on the tile,
  // like the WebGL sprite), so a big 3-D icon is framed correctly (ADR 0044).
  const box = useMemo(() => {
    if (!node) return null;
    const c = getTilePosition({ tile: node.tile, origin: 'CENTER' });
    const width =
      PROJECTED_TILE_SIZE.width *
      iconWidthFactor(icon.isIsometric ?? false) *
      effectiveScale;
    return {
      center: {
        x: c.x + (node.offset?.x ?? 0),
        y: c.y + (node.offset?.y ?? 0)
      },
      width,
      height: width * (aspect || 1)
    };
  }, [node, getTilePosition, icon.isIsometric, effectiveScale, aspect]);

  const onAnchorMouseDown = useCallback(
    (key: AnchorPosition) => {
      if (!node) return;
      uiStateActions.setMode({
        type: 'NODE.TRANSFORM',
        selectedAnchor: key,
        targets: [{ id, startScale: node.iconScale ?? icon.scale ?? 1 }],
        // No tile-cursor diamond while resizing — it would sit at the pointer's
        // tile over the icon and read as leftover debris (QA 2026-07-19).
        showCursor: false
      });
    },
    [id, node, icon.scale, uiStateActions]
  );

  if (!node || !box) {
    return null;
  }

  return (
    <ScreenBoxTransformControls
      center={box.center}
      width={box.width}
      height={box.height}
      onAnchorMouseDown={showHandles ? onAnchorMouseDown : undefined}
      readout={
        showHandles && previewScale != null
          ? formatIconScale(previewScale)
          : undefined
      }
    />
  );
};
