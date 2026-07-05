import React from 'react';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { useViewItem } from 'src/hooks/useViewItem';
import { useRectangle } from 'src/hooks/useRectangle';
import { TransformControls } from './TransformControls';

// A3 (UX sweep) — a faint outline on the item under the cursor, so hover reads
// as "this is what a click will grab" BEFORE selecting (the cursor already
// changes to a pointer; this adds the visual target). Distinct from and lighter
// than the selection ring (TransformControls `subtle`). Scoped to the box types
// most often hovered to select/move — ITEM (node) and RECTANGLE. TEXTBOX /
// LABEL / CONNECTOR rely on the pointer-cursor affordance (a bounding-box hover
// outline reads oddly on a thin connector or a small chip).

const HoverNode = ({ id }: { id: string }) => {
  const node = useViewItem(id);
  if (!node) return null;
  return <TransformControls from={node.tile} to={node.tile} subtle />;
};

const HoverRectangle = ({ id }: { id: string }) => {
  const rectangle = useRectangle(id);
  if (!rectangle) return null;
  return <TransformControls from={rectangle.from} to={rectangle.to} subtle />;
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
    default:
      return null;
  }
};
