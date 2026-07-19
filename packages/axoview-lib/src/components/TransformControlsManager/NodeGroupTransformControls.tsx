import React, { useCallback, useMemo } from 'react';
import { useSceneData } from 'src/hooks/useSceneData';
import { useModelStore } from 'src/stores/modelStore';
import { useCanvasMode } from 'src/contexts/CanvasModeContext';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { AnchorPosition, Coords } from 'src/types';
import { PROJECTED_TILE_SIZE } from 'src/config';
import { ScreenBoxTransformControls } from './ScreenBoxTransformControls';
import { formatIconScale } from './NodeTransformControls';

interface Props {
  ids: string[];
}

const iconWidthFactor = (isIsometric: boolean): number =>
  isIsometric ? 0.8 : 0.7;

// ADR 0044 group-resize: one screen-space box around a homogeneous node
// multi-selection. Dragging a corner applies a single uniform scale FACTOR to
// every selected node, preserving relative sizes. Members keep their own
// outlines (NodeTransformControls, handles suppressed); this owns the handles +
// the size readout. The outer box is the union of member boxes (square approx
// for the frame; each member's own ring hugs its icon precisely).
export const NodeGroupTransformControls = ({ ids }: Props) => {
  const { items } = useSceneData();
  const modelItems = useModelStore((s) => s.items);
  const icons = useModelStore((s) => s.icons);
  const { getTilePosition } = useCanvasMode();
  const uiStateActions = useUiStateStore((s) => s.actions);
  const previewScales = useUiStateStore((s) => s.iconScaleDrag?.scales ?? null);

  const resolved = useMemo(() => {
    const out: {
      id: string;
      tile: Coords;
      offset?: Coords;
      startScale: number;
      isIso: boolean;
    }[] = [];
    for (const id of ids) {
      const vi = items.find((i) => i.id === id);
      if (!vi) continue;
      const mi = modelItems.find((m) => m.id === id);
      const ic = icons.find((i) => i.id === mi?.icon);
      out.push({
        id,
        tile: vi.tile,
        offset: vi.offset,
        startScale: vi.iconScale ?? ic?.scale ?? 1,
        isIso: ic?.isIsometric ?? true
      });
    }
    return out;
  }, [ids, items, modelItems, icons]);

  const box = useMemo(() => {
    if (resolved.length === 0) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const r of resolved) {
      const c = getTilePosition({ tile: r.tile, origin: 'CENTER' });
      const cx = c.x + (r.offset?.x ?? 0);
      const cy = c.y + (r.offset?.y ?? 0);
      const scale = previewScales?.[r.id] ?? r.startScale;
      const half =
        (PROJECTED_TILE_SIZE.width * iconWidthFactor(r.isIso) * scale) / 2;
      minX = Math.min(minX, cx - half);
      minY = Math.min(minY, cy - half);
      maxX = Math.max(maxX, cx + half);
      maxY = Math.max(maxY, cy + half);
    }
    return {
      center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
      width: maxX - minX,
      height: maxY - minY
    };
  }, [resolved, getTilePosition, previewScales]);

  // Representative (first selected) drives the readout — matches the strip's
  // "display the representative item" bulk convention.
  const rep = resolved[0];
  const previewRep = rep && previewScales ? previewScales[rep.id] ?? null : null;

  const onAnchorMouseDown = useCallback(
    (key: AnchorPosition) => {
      if (resolved.length === 0) return;
      uiStateActions.setMode({
        type: 'NODE.TRANSFORM',
        selectedAnchor: key,
        targets: resolved.map((r) => ({ id: r.id, startScale: r.startScale })),
        showCursor: true
      });
    },
    [resolved, uiStateActions]
  );

  if (!box || resolved.length < 2) {
    return null;
  }

  return (
    <ScreenBoxTransformControls
      center={box.center}
      width={box.width}
      height={box.height}
      onAnchorMouseDown={onAnchorMouseDown}
      readout={previewRep != null ? formatIconScale(previewRep) : undefined}
    />
  );
};
