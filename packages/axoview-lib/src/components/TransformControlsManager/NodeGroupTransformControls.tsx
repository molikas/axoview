import React, { useCallback, useMemo } from 'react';
import { useSceneData } from 'src/hooks/useSceneData';
import { useModelStore } from 'src/stores/modelStore';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { AnchorPosition, Coords } from 'src/types';
import { TransformControls } from './TransformControls';
import { NODE_CORNER_ANCHORS, formatIconScale } from './NodeTransformControls';

interface Props {
  ids: string[];
}

// ADR 0044 group-resize: one bounding-box transform control around a homogeneous
// node multi-selection. Dragging a corner applies a single uniform scale FACTOR
// to every selected node, preserving their relative sizes ("make these all a bit
// bigger"). Members keep their own selection rings (NodeTransformControls with
// handles suppressed); this component owns the handles + the size readout.
export const NodeGroupTransformControls = ({ ids }: Props) => {
  const { items } = useSceneData();
  const modelItems = useModelStore((s) => s.items);
  const icons = useModelStore((s) => s.icons);
  const uiStateActions = useUiStateStore((s) => s.actions);
  const previewScales = useUiStateStore((s) => s.iconScaleDrag?.scales ?? null);

  // Resolve each selected node → tile + effective start scale (per-node override
  // ?? shared asset scale ?? 1). Plain array finds — no per-node hooks.
  const resolved = useMemo(() => {
    const out: { id: string; tile: Coords; startScale: number }[] = [];
    for (const id of ids) {
      const vi = items.find((i) => i.id === id);
      if (!vi) continue;
      const mi = modelItems.find((m) => m.id === id);
      const ic = icons.find((i) => i.id === mi?.icon);
      out.push({
        id,
        tile: vi.tile,
        startScale: vi.iconScale ?? ic?.scale ?? 1
      });
    }
    return out;
  }, [ids, items, modelItems, icons]);

  const bbox = useMemo(() => {
    if (resolved.length === 0) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const r of resolved) {
      minX = Math.min(minX, r.tile.x);
      minY = Math.min(minY, r.tile.y);
      maxX = Math.max(maxX, r.tile.x);
      maxY = Math.max(maxY, r.tile.y);
    }
    return { from: { x: minX, y: minY }, to: { x: maxX, y: maxY } };
  }, [resolved]);

  // Representative (first selected) drives the readout + the group-box growth —
  // mirrors the strip's "display the representative item" bulk convention.
  const rep = resolved[0];
  const previewRep = rep && previewScales ? previewScales[rep.id] ?? null : null;
  const factor =
    rep && previewRep != null && rep.startScale
      ? previewRep / rep.startScale
      : 1;

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

  if (!bbox || resolved.length < 2) {
    return null;
  }

  return (
    <TransformControls
      from={bbox.from}
      to={bbox.to}
      onAnchorMouseDown={onAnchorMouseDown}
      anchorPositions={NODE_CORNER_ANCHORS}
      extentScale={factor}
      readout={previewRep != null ? formatIconScale(previewRep) : undefined}
    />
  );
};
