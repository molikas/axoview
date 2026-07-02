// @ts-nocheck
import React from 'react';
import { render, screen } from '@testing-library/react';
import { NodePanel } from '../NodeControls/NodePanel/NodePanel';
import { ConnectorControls } from '../ConnectorControls/ConnectorControls';

// Panel-parity regression (F2). The 2026-07-02 deck unification (ux-principles
// §5.1) collapsed the old tabs-vs-stacked split: every element panel is now the
// SAME vertical stack of shared collapsible deck sections. This pins the
// load-bearing half of that contract — the NODE panel and the CONNECTOR panel
// both render a Notes section AND a Metadata (identity) section, built from the
// same NotesSection / MetadataSection primitives — so a later edit can't quietly
// reintroduce the asymmetry (drop Notes from one type, re-add a per-type Style
// tab, …). ts-jest hoists these jest.mock() calls above the imports above.

jest.mock('src/stores/localeStore', () => ({
  // Identity translator: a section title renders as its key ('notes'/'metadata').
  useTranslation: () => ({ t: (k: string) => k })
}));

jest.mock('src/hooks/useScene', () => ({
  useScene: () => ({
    updateConnector: jest.fn(),
    updateModelItem: jest.fn(),
    updateViewItem: jest.fn()
  })
}));

jest.mock('src/hooks/useModelItem', () => ({
  useModelItem: () => ({ id: 'n1', name: 'Node', notes: undefined, icon: 'i1' })
}));

jest.mock('src/hooks/useConnector', () => ({
  useConnector: () => ({
    id: 'c1',
    name: 'Edge',
    notes: undefined,
    labels: [],
    lineType: 'SINGLE'
  })
}));

jest.mock('src/hooks/useIcon', () => ({
  useIcon: () => ({ icon: { url: '' } })
}));

jest.mock('src/stores/uiStateStore', () => {
  const state = {
    actions: {
      setItemControls: jest.fn(),
      setSelectedConnectorLabel: jest.fn()
    },
    selectedConnectorLabel: null,
    linkedDiagrams: []
  };
  return { useUiStateStore: (selector: (s: typeof state) => unknown) => selector(state) };
});

jest.mock('src/utils', () => ({
  getConnectorLabels: () => [],
  generateId: () => 'gen-id'
}));

// The Notes body (RichTextEditor) is a heavy contentEditable — stub it; parity is
// about the deck SECTION being present, not its editor internals.
jest.mock('src/components/RichTextEditor/RichTextEditor', () => ({
  RichTextEditor: () => null
}));

describe('Properties deck — node/connector panel parity', () => {
  it('the connector panel renders the shared Notes + Metadata deck sections', () => {
    render(<ConnectorControls id="c1" />);
    expect(screen.getByText('notes')).toBeInTheDocument();
    expect(screen.getByText('metadata')).toBeInTheDocument();
  });

  it('the node panel renders the shared Notes + Metadata deck sections', () => {
    render(<NodePanel viewItem={{ id: 'n1', tile: { x: 0, y: 0 } }} />);
    expect(screen.getByText('notes')).toBeInTheDocument();
    expect(screen.getByText('metadata')).toBeInTheDocument();
  });
});
