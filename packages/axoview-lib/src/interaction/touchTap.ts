// Pure decision function for the touch/pen SELECT → GRAB → PLACE machine
// (ADR 0018 Decision 4). Kept side-effect-free and unit-testable (mirrors the
// Cursor.mousedown({...State}) test pattern). The manager's touch path is the
// only caller — the pointerType branch stays in one place (tactical §C).

import { ItemReference } from 'src/types';

export type TouchTapAction =
  | 'place' // in CARRY_ITEM: drop the carried node at the tapped tile
  | 'grab' // tapped the already-selected node again: pick it up
  | 'select'; // first tap on an item / tap empty: route through Cursor click

export const decideTouchTap = (args: {
  /** uiState.mode.type at the moment of the tap. */
  modeType: string;
  /** Item resolved at the tapped tile (null = empty canvas). */
  tappedItem: ItemReference | null;
  /** The persistent selection before this tap (ADR-0006). */
  selectedIds: ItemReference[];
  /** Whether the tapped item is interactable (unlocked + visible) — I-1. */
  isInteractable: boolean;
}): TouchTapAction => {
  // A tap while carrying always places — even tapping empty canvas or another
  // item drops the carried node at the nearest free tile under the tap.
  if (args.modeType === 'CARRY_ITEM') return 'place';

  const { tappedItem, selectedIds, isInteractable } = args;

  // GRAB only nodes, and only on the second tap of the SAME sole selection. The
  // two-step pickup prevents an accidental relocation on a fat-finger tap.
  const isSoleSelectedNode =
    selectedIds.length === 1 &&
    selectedIds[0].type === 'ITEM' &&
    !!tappedItem &&
    tappedItem.type === 'ITEM' &&
    selectedIds[0].id === tappedItem.id;

  if (isSoleSelectedNode && isInteractable) return 'grab';

  return 'select';
};
