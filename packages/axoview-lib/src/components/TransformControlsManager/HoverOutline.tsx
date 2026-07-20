import React from 'react';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { useViewItem } from 'src/hooks/useViewItem';
import { useModelItem } from 'src/hooks/useModelItem';
import { useIcon } from 'src/hooks/useIcon';
import { useImageAspect } from 'src/hooks/useImageAspect';
import { useRectangle } from 'src/hooks/useRectangle';
import { useTextBox } from 'src/hooks/useTextBox';
import { useCanvasMode } from 'src/contexts/CanvasModeContext';
import { getTextBoxEndTile } from 'src/utils';
import { PROJECTED_TILE_SIZE } from 'src/config';
import { TransformControls } from './TransformControls';
import { ScreenBoxTransformControls } from './ScreenBoxTransformControls';

// A3 (UX sweep) — a faint outline on the item under the cursor, so hover reads
// as "this is what a click will grab" BEFORE selecting. Distinct from and lighter
// than the selection ring (`subtle`). Extended to every BOX-shaped type (ADR 0044
// 2026-07-19, "trace each shape"): ITEM (node), RECTANGLE, TEXTBOX — each gets
// the rim that matches its shape (iso diamond for flat elements + flat/Material
// icons; screen box for standing isometric icons). LABEL (a small upright chip)
// and CONNECTOR (a thin line) stay excluded — a bounding-box outline reads oddly
// on them.

const HoverNode = ({ id }: { id: string }) => {
  const node = useViewItem(id);
  const modelItem = useModelItem(id);
  const { icon } = useIcon(modelItem?.icon);
  const aspect = useImageAspect(icon.url);
  const { getTilePosition } = useCanvasMode();
  if (!node) return null;
  const scale = node.iconScale ?? icon.scale ?? 1;
  // Trace each shape (ADR 0044): a flat / Material icon → the iso diamond (like a
  // rectangle); only a standing isometric icon → the screen box. Match the
  // renderer's `!icon.isIsometric` classification (undefined flag = flat).
  if (!icon.isIsometric) {
    return (
      <TransformControls
        from={node.tile}
        to={node.tile}
        extentScale={scale}
        subtle
      />
    );
  }
  const c = getTilePosition({ tile: node.tile, origin: 'CENTER' });
  const width = PROJECTED_TILE_SIZE.width * 0.8 * scale;
  return (
    <ScreenBoxTransformControls
      center={{
        x: c.x + (node.offset?.x ?? 0),
        y: c.y + (node.offset?.y ?? 0)
      }}
      width={width}
      height={width * (aspect || 1)}
      subtle
    />
  );
};

const HoverRectangle = ({ id }: { id: string }) => {
  const rectangle = useRectangle(id);
  if (!rectangle) return null;
  return <TransformControls from={rectangle.from} to={rectangle.to} subtle />;
};

const HoverTextBox = ({ id }: { id: string }) => {
  const textBox = useTextBox(id);
  if (!textBox) return null;
  // A text box lies in the tile plane → the iso diamond, like a rectangle.
  const to = getTextBoxEndTile(textBox, textBox.size);
  return <TransformControls from={textBox.tile} to={to} subtle />;
};

export const HoverOutline = () => {
  const hoveredItem = useUiStateStore((s) => s.hoveredItem);
  const modeType = useUiStateStore((s) => s.mode.type);
  const editorMode = useUiStateStore((s) => s.editorMode);
  const itemControls = useUiStateStore((s) => s.itemControls);
  const selectedIds = useUiStateStore((s) => s.selectedIds);

  // Only in the editable pointer mode; hover has no meaning while a tool is
  // armed, dragging, or in read-only/present.
  if (editorMode !== 'EDITABLE' || modeType !== 'CURSOR' || !hoveredItem) {
    return null;
  }

  // Don't double-outline the already-selected item (the selection ring owns it).
  const isSelected =
    (itemControls?.type === hoveredItem.type &&
      itemControls.id === hoveredItem.id) ||
    selectedIds.some(
      (r) => r.type === hoveredItem.type && r.id === hoveredItem.id
    );
  if (isSelected) return null;

  switch (hoveredItem.type) {
    case 'ITEM':
      return <HoverNode id={hoveredItem.id} />;
    case 'RECTANGLE':
      return <HoverRectangle id={hoveredItem.id} />;
    case 'TEXTBOX':
      return <HoverTextBox id={hoveredItem.id} />;
    default:
      return null;
  }
};
