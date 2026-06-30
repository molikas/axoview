import {
  ModelItem,
  ViewItem,
  Connector,
  Rectangle,
  TextBox,
  Label,
  Coords
} from 'src/types';

export interface ClipboardItem {
  modelItem: ModelItem;
  viewItem: ViewItem;
}

export interface ClipboardPayload {
  items: ClipboardItem[];
  connectors: Connector[];
  rectangles: Rectangle[];
  textBoxes: TextBox[];
  // Optional so a payload from an older session/format (no Labels) still pastes
  // (read sites guard with `?? []`). ADR 0031.
  labels?: Label[];
  centroid: Coords;
}

export interface PastePayload {
  items: ClipboardItem[];
  connectors: Connector[];
  rectangles: Rectangle[];
  textBoxes: TextBox[];
  labels?: Label[];
}

let _clipboard: ClipboardPayload | null = null;

export const setClipboard = (payload: ClipboardPayload): void => {
  _clipboard = payload;
};

export const getClipboard = (): ClipboardPayload | null => _clipboard;

export const hasClipboard = (): boolean => _clipboard !== null;
