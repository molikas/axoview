import React from 'react';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { RectangleTransformControls } from './RectangleTransformControls';
import { TextBoxTransformControls } from './TextBoxTransformControls';
import { LabelTransformControls } from './LabelTransformControls';
import { NodeTransformControls } from './NodeTransformControls';
import { NodeGroupTransformControls } from './NodeGroupTransformControls';

export const TransformControlsManager = () => {
  const itemControls = useUiStateStore((state) => state.itemControls);
  const selectedIds = useUiStateStore((state) => state.selectedIds);
  const modeType = useUiStateStore((state) => state.mode.type);

  // Hide selection chrome while a move is in flight (owner 2026-07-04): the
  // drag is a CSS-only preview (DragItems, RECT-1) — the model tile doesn't
  // change until mouseup, so the bounds/anchors would sit frozen at the
  // ORIGIN tile while the item follows the cursor ("the resize box stays in
  // the original place"). Lucid/Figma hide handles mid-drag too; they return
  // wherever the selection lands after the drop.
  if (modeType === 'DRAG_ITEMS') {
    return null;
  }

  // Multi-selection.
  if (selectedIds.length > 1) {
    // ADR 0044 group-resize: a HOMOGENEOUS node selection gets one bounding-box
    // control that resizes every node together (each member shows its ring but
    // NOT its own handles, so it reads as "grab the group, not one node").
    const allNodes = selectedIds.every((ref) => ref.type === 'ITEM');
    if (allNodes) {
      return (
        <>
          {selectedIds.map((ref) => (
            <NodeTransformControls
              key={`item-${ref.id}`}
              id={ref.id}
              showHandles={false}
            />
          ))}
          <NodeGroupTransformControls ids={selectedIds.map((ref) => ref.id)} />
        </>
      );
    }

    // Mixed / non-node selection: per-item outlines. Nodes show a ring but no
    // resize handles — a cross-type resize isn't meaningful (matches the strip's
    // homogeneous-only bulk rule, ADR 0030).
    return (
      <>
        {selectedIds.map((ref) => {
          switch (ref.type) {
            case 'ITEM':
              return (
                <NodeTransformControls
                  key={`item-${ref.id}`}
                  id={ref.id}
                  showHandles={false}
                />
              );
            case 'RECTANGLE':
              return (
                <RectangleTransformControls
                  key={`rect-${ref.id}`}
                  id={ref.id}
                />
              );
            case 'TEXTBOX':
              return (
                <TextBoxTransformControls key={`tb-${ref.id}`} id={ref.id} />
              );
            case 'LABEL':
              return (
                <LabelTransformControls key={`label-${ref.id}`} id={ref.id} />
              );
            // CONNECTOR / CONNECTOR_ANCHOR: no transform handles by design.
            default:
              return null;
          }
        })}
      </>
    );
  }

  switch (itemControls?.type) {
    case 'ITEM':
      return <NodeTransformControls id={itemControls.id} />;
    case 'RECTANGLE':
      return <RectangleTransformControls id={itemControls.id} />;
    case 'TEXTBOX':
      return <TextBoxTransformControls id={itemControls.id} />;
    case 'LABEL':
      return <LabelTransformControls id={itemControls.id} />;
    default:
      return null;
  }
};
