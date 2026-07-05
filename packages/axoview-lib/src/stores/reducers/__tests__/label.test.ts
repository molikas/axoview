import { createLabel, updateLabel, deleteLabel } from '../label';
import { State, ViewReducerContext } from '../types';
import { Label, View } from 'src/types';

// getItemByIdOrThrow is the only util the model-only Label reducers touch (no
// getTextBoxDimensions — labels carry no scene size, ADR 0031).
jest.mock('src/utils', () => ({
  getItemByIdOrThrow: jest.fn((items: any[], id: string) => {
    const index = items.findIndex(
      (item: any) => (typeof item === 'object' && item.id === id) || item === id
    );
    if (index === -1) throw new Error(`Item with id ${id} not found`);
    return { value: items[index], index };
  })
}));

describe('label reducer (ADR 0031, model-only)', () => {
  let mockState: State;
  let mockContext: ViewReducerContext;
  let mockLabel: Label;
  let mockView: View;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLabel = { id: 'label1', tile: { x: 10, y: 20 }, text: 'Region A' };
    mockView = {
      id: 'view1',
      name: 'Test View',
      items: [],
      connectors: [],
      rectangles: [],
      textBoxes: [],
      labels: [mockLabel]
    };
    mockState = {
      model: {
        version: '1.0',
        title: 'Test Model',
        description: '',
        colors: [],
        icons: [],
        items: [],
        views: [mockView]
      },
      scene: { connectors: {}, textBoxes: {} }
    };
    mockContext = { viewId: 'view1', state: mockState };
  });

  describe('createLabel', () => {
    it('unshifts a new label and writes NO scene entry (model-only)', () => {
      const result = createLabel(
        { id: 'label2', tile: { x: 1, y: 1 }, text: 'New' },
        mockContext
      );
      expect(result.model.views[0].labels).toHaveLength(2);
      expect(result.model.views[0].labels![0].id).toBe('label2');
      expect(result.model.views[0].labels![1].id).toBe('label1');
      // Unlike a textBox, a label has no scene-size entry to sync.
      expect(result.scene).toEqual({ connectors: {}, textBoxes: {} });
    });

    it('initializes the labels array if undefined', () => {
      mockState.model.views[0].labels = undefined;
      const result = createLabel(
        { id: 'label2', tile: { x: 1, y: 1 }, text: 'New' },
        mockContext
      );
      expect(result.model.views[0].labels).toHaveLength(1);
      expect(result.model.views[0].labels![0].id).toBe('label2');
    });

    it('throws when the view does not exist', () => {
      mockContext.viewId = 'nonexistent';
      expect(() =>
        createLabel({ id: 'l2', tile: { x: 0, y: 0 }, text: 'x' }, mockContext)
      ).toThrow('Item with id nonexistent not found');
    });
  });

  describe('updateLabel', () => {
    it('updates fields and preserves the others', () => {
      const result = updateLabel(
        { id: 'label1', text: 'Renamed', isBold: true },
        mockContext
      );
      expect(result.model.views[0].labels![0].text).toBe('Renamed');
      expect(result.model.views[0].labels![0].isBold).toBe(true);
      expect(result.model.views[0].labels![0].tile).toEqual(mockLabel.tile);
    });

    it('returns state unchanged when the labels array is undefined', () => {
      mockState.model.views[0].labels = undefined;
      const result = updateLabel({ id: 'label1', text: 'x' }, mockContext);
      expect(result).toEqual(mockState);
    });

    it('throws when the label does not exist', () => {
      expect(() =>
        updateLabel({ id: 'nope', text: 'x' }, mockContext)
      ).toThrow('Item with id nope not found');
    });
  });

  describe('deleteLabel', () => {
    it('removes the label from the model', () => {
      const result = deleteLabel('label1', mockContext);
      expect(result.model.views[0].labels).toHaveLength(0);
    });

    it('does not affect other labels', () => {
      const label2: Label = { id: 'label2', tile: { x: 5, y: 6 }, text: 'Second' };
      mockState.model.views[0].labels = [mockLabel, label2];
      const result = deleteLabel('label1', mockContext);
      expect(result.model.views[0].labels).toHaveLength(1);
      expect(result.model.views[0].labels![0].id).toBe('label2');
    });

    it('throws when the label does not exist', () => {
      expect(() => deleteLabel('nope', mockContext)).toThrow(
        'Item with id nope not found'
      );
    });
  });

  it('does not mutate the original state', () => {
    const original = JSON.parse(JSON.stringify(mockState));
    deleteLabel('label1', mockContext);
    expect(mockState).toEqual(original);
  });
});
