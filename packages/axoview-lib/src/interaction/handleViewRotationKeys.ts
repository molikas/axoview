import type { State } from 'src/types';

// ─── Q / E: turn the view (ADR 0049 §7) ───────────────────────────────────────
//
// Q steps the floor 15° counter-clockwise (θ grows), E 15° clockwise, both onto
// the 15° lattice; Shift jumps to the next cardinal angle. A `viewer` surface
// (readonlyPolicy): the angle is per-viewer uiState and never written to the
// model, so viewers on the display / share / Present routes keep the keys —
// including with "Hide controls" on, as they keep arrow-key panning (ADR 0051
// §4). Isometric only: the angle has no effect in 2D, where the widget is
// disabled and these keys do nothing.
//
// Extracted from useInteractionManager (like handleArrowKey) so it is
// unit-testable without the provider stack the full hook needs.

export const VIEW_ROTATION_KEYS: Record<string, 1 | -1> = {
  q: 1,
  e: -1
};

/**
 * Returns true when the key was a view-rotation key and was consumed. Ctrl /
 * Cmd / Alt chords are left alone — they belong to the browser or other
 * shortcuts.
 */
export const handleViewRotationKeys = (
  e: KeyboardEvent,
  uiState: Pick<State['uiState'], 'canvasMode' | 'actions'>,
  allow: boolean
): boolean => {
  if (!allow || e.ctrlKey || e.metaKey || e.altKey) return false;
  const direction = VIEW_ROTATION_KEYS[e.key.toLowerCase()];
  if (!direction) return false;
  if (uiState.canvasMode !== 'ISOMETRIC') return false;
  e.preventDefault();
  // Held key auto-repeat chains through the animation target, so holding Q
  // keeps turning in 15° steps rather than restarting one step.
  uiState.actions.stepViewRotation(direction, e.shiftKey);
  return true;
};
