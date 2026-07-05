import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TransformControlsManager } from '../TransformControlsManager';

// RECT-1 regression guard (commit 1bac431, ADR 0006 §8 addendum). While a move
// is in flight (mode === 'DRAG_ITEMS'), TransformControlsManager must render
// NOTHING for every item type — the move is a CSS-only compositor preview and
// the model tile only commits on mouseup, so model-driven bounds/anchors would
// otherwise sit frozen at the ORIGIN tile while the item follows the cursor
// (the owner report: "when you drag the text the resize box stays in the
// original place"). This is a single `return null` in the component that any
// refactor could silently drop; nothing else asserts it.

// Mutable store state the mocked hook reads (must be `mock`-prefixed for the
// jest.mock hoist guard).
let mockUiState: {
  itemControls: { type: string; id: string } | null;
  selectedIds: { type: string; id: string }[];
  mode: { type: string };
};

jest.mock('src/stores/uiStateStore', () => ({
  useUiStateStore: (selector: (s: typeof mockUiState) => unknown) =>
    selector(mockUiState)
}));

// Stub the four child chrome components so we can assert which (if any) render
// without pulling in their store/hook dependencies. require('react') inside the
// factory keeps the hoist guard happy.
jest.mock('../RectangleTransformControls', () => {
  const r = require('react');
  return {
    RectangleTransformControls: () =>
      r.createElement('div', { 'data-testid': 'chrome-rect' })
  };
});
jest.mock('../TextBoxTransformControls', () => {
  const r = require('react');
  return {
    TextBoxTransformControls: () =>
      r.createElement('div', { 'data-testid': 'chrome-tb' })
  };
});
jest.mock('../LabelTransformControls', () => {
  const r = require('react');
  return {
    LabelTransformControls: () =>
      r.createElement('div', { 'data-testid': 'chrome-label' })
  };
});
jest.mock('../NodeTransformControls', () => {
  const r = require('react');
  return {
    NodeTransformControls: () =>
      r.createElement('div', { 'data-testid': 'chrome-node' })
  };
});

describe('TransformControlsManager — RECT-1 drag-chrome hide', () => {
  it('renders nothing while a single selected item is being dragged (DRAG_ITEMS)', () => {
    mockUiState = {
      itemControls: { type: 'TEXTBOX', id: 'tb1' },
      selectedIds: [{ type: 'TEXTBOX', id: 'tb1' }],
      mode: { type: 'DRAG_ITEMS' }
    };
    const { container } = render(<TransformControlsManager />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId('chrome-tb')).not.toBeInTheDocument();
  });

  it('DOES render the selection chrome for that same item when not dragging', () => {
    mockUiState = {
      itemControls: { type: 'TEXTBOX', id: 'tb1' },
      selectedIds: [{ type: 'TEXTBOX', id: 'tb1' }],
      mode: { type: 'CURSOR' }
    };
    render(<TransformControlsManager />);
    expect(screen.getByTestId('chrome-tb')).toBeInTheDocument();
  });

  it('hides chrome for a multi-selection drag too — all item types', () => {
    mockUiState = {
      itemControls: null,
      selectedIds: [
        { type: 'RECTANGLE', id: 'r1' },
        { type: 'LABEL', id: 'l1' }
      ],
      mode: { type: 'DRAG_ITEMS' }
    };
    const { container } = render(<TransformControlsManager />);
    expect(container).toBeEmptyDOMElement();
  });

  it('DOES render per-item chrome for a resting multi-selection', () => {
    mockUiState = {
      itemControls: null,
      selectedIds: [
        { type: 'RECTANGLE', id: 'r1' },
        { type: 'LABEL', id: 'l1' }
      ],
      mode: { type: 'CURSOR' }
    };
    render(<TransformControlsManager />);
    expect(screen.getByTestId('chrome-rect')).toBeInTheDocument();
    expect(screen.getByTestId('chrome-label')).toBeInTheDocument();
  });
});
