import { ModelStore, UiStateStore, Size, ItemReference, Coords } from 'src/types';
import { Scroll } from 'src/types/ui';
import { useScene } from 'src/hooks/useScene';
import type { CoordinateTransformStrategy } from 'src/utils/coordinateTransforms';

export interface State {
  model: ModelStore;
  scene: ReturnType<typeof useScene>;
  uiState: UiStateStore;
  rendererRef: HTMLElement;
  rendererSize: Size;
  isRendererInteraction: boolean;
  /**
   * Returns true if the given item can be interacted with.
   * Items on locked layers return false. Items with no layer always return true.
   */
  isItemInteractable: (ref: ItemReference) => boolean;
  /**
   * Device class of the pointer that originated this event (ADR 0018). The
   * `mouse` path is press-drag-release (unchanged); `touch`/`pen` branch to the
   * tap-to-place state machine. Optional so existing test mocks that construct a
   * State object continue to compile (they default to the mouse path).
   */
  pointerType?: 'mouse' | 'touch' | 'pen';
  /**
   * Mode-aware screen→tile converter injected by useInteractionManager.
   * Interaction mode handlers must use this instead of importing screenToIso directly.
   */
  screenToTile: (args: {
    mouse: Coords;
    zoom: number;
    scroll: Scroll;
    rendererSize: Size;
  }) => Coords;
  /**
   * The projection strategy at (canvas mode, LIVE view rotation), built for this
   * event (ADR 0049 §2). Modes pass it to every pure utility that projects —
   * hit-testing, placement residuals, drag previews — instead of a `canvasMode`,
   * so nothing in the input path can fall back to the unrotated projection.
   * Optional so existing test mocks that construct a State still compile; read
   * it through `stateStrategy(state)`, which falls back to the store's own.
   */
  strategy?: CoordinateTransformStrategy;
}

export type ModeActionsAction = (state: State) => void;

export type ModeActions = {
  entry?: ModeActionsAction;
  exit?: ModeActionsAction;
  mousemove?: ModeActionsAction;
  mousedown?: ModeActionsAction;
  mouseup?: ModeActionsAction;
};
