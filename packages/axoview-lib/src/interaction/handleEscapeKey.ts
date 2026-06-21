import type { State } from 'src/types';

// Minimal dependency surface the Escape handlers need — a structural subset of
// useInteractionManager's KeydownDeps, kept here so this module stays runtime
// dependency-free and unit-testable in isolation (mirrors toolHotkeys.ts).
export interface EscapeDeps {
  deleteConnector: (id: string) => void;
  commitDragTransaction: () => void;
}

// Esc inside CONNECTOR mode: abort an in-flight connection and reset the mode.
// Returns true when it actually aborted an in-progress connector (so the caller
// can give connector-abort priority over panel/selection clear — B2).
export const handleConnectorEscape = (
  uiState: State['uiState'],
  deps: EscapeDeps
): boolean => {
  if (uiState.mode.type !== 'CONNECTOR') return false;
  const connectorMode = uiState.mode;

  const isConnectionInProgress =
    (uiState.connectorInteractionMode === 'click' &&
      connectorMode.isConnecting) ||
    (uiState.connectorInteractionMode === 'drag' && connectorMode.id !== null);

  if (isConnectionInProgress && connectorMode.id) {
    deps.deleteConnector(connectorMode.id);
    // D-4 abort-symmetry: handleClickFirst/handleDragStart opened a drag
    // transaction; aborting without committing would leak the open bracket and
    // suppress saveToHistoryBeforeChange for every later edit (behavior-map
    // §3.1/§4.5). Closing it after the delete nets to zero patches (no spurious
    // history entry) but clears dragInProgress.
    deps.commitDragTransaction();

    uiState.actions.setMode({
      type: 'CONNECTOR',
      showCursor: true,
      id: null,
      startAnchor: undefined,
      isConnecting: false
    });
    return true;
  }
  return false;
};

// Escape: abort in-flight connector → clear panel → clear multi-selection.
// Always consumes the keystroke. Returns true when handled (Escape pressed).
export const handleEscapeKey = (
  e: KeyboardEvent,
  uiState: State['uiState'],
  deps: EscapeDeps
): boolean => {
  if (e.key !== 'Escape') return false;
  e.preventDefault();

  // B2 / Decision #3: an in-flight connector aborts FIRST. The NodeActionBar
  // "Add connection" path (and the 'C'-then-click path) can leave the source
  // node selected, so otherwise the selectedIds branch below would consume the
  // first Esc — clearing the selection and stranding the orphan connector.
  if (handleConnectorEscape(uiState, deps)) {
    return true;
  }

  if (uiState.itemControls) {
    uiState.actions.setItemControls(null);
    return true;
  }

  // Multi-selection: Esc clears it when no panel is open
  // (panel-clear path above handles single-selection). ADR-0006.
  if (uiState.selectedIds.length > 0) {
    uiState.actions.clearSelection();
    return true;
  }

  return true;
};
