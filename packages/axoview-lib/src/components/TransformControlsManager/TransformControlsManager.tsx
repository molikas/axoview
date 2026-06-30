import React from 'react';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { RectangleTransformControls } from './RectangleTransformControls';
import { TextBoxTransformControls } from './TextBoxTransformControls';
import { LabelTransformControls } from './LabelTransformControls';
import { NodeTransformControls } from './NodeTransformControls';

export const TransformControlsManager = () => {
  const itemControls = useUiStateStore((state) => state.itemControls);
  const selectedIds = useUiStateStore((state) => state.selectedIds);

  // Multi-selection: render an outline for each selected item (no anchor
  // handlers — bulk-resize is out of scope per the MQA #8/#9 plan). ADR-0006.
  if (selectedIds.length > 1) {
    return (
      <>
        {selectedIds.map((ref) => {
          switch (ref.type) {
            case 'ITEM':
              return <NodeTransformControls key={`item-${ref.id}`} id={ref.id} />;
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
