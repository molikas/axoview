import { setWindowCursor } from 'src/utils';
import { ModeActions, Mode } from 'src/types';
import {
  shortestArc,
  VIEW_ROTATION_STEP_DEG
} from 'src/utils/viewRotation';

// ─── Alt + left-drag: orbit the floor (ADR 0049 §7, amends ADR 0022 §1) ──────
//
// An interaction-manager MODE, not a capture-phase hook (the POC's hook
// swallowed every Alt+left press, so Alt+click waypoint removal died — finding
// F7 — and it bypassed the single input pipeline, ux-principles §9.5). The
// manager enters this mode only once an Alt+left press in an idle mode has
// travelled past the drag slop; a press released before that is replayed as an
// ordinary Alt+click, so waypoint removal keeps working.
//
// While it runs the view is IN MOTION (ADR 0049 §6): the live angle follows the
// pointer and the scene follows by the motion transform — uniforms and CSS
// only, never a per-frame rebuild. The base angle is re-baselined at most every
// REBASE_MS once the gesture has turned REBASE_DEG away from it (so a long
// orbit never shears far), and settles exactly once on release.

/** Degrees per horizontal CSS px — dragging right turns θ up (ADR 0049 §1). */
export const ORBIT_DEG_PER_PX = 0.4;
// Bounded re-baseline during a long orbit (never per frame).
const REBASE_DEG = 45;
const REBASE_MS = 400;

// Per-gesture bookkeeping. Module state like DragItems' preview maps: only one
// pointer gesture can be live at a time.
let lastRebaseAt = 0;

const now = () =>
  typeof performance !== 'undefined' ? performance.now() : Date.now();

/** The mode an orbit returns to on release. */
const returnMode = (to: 'CURSOR' | 'PAN'): Mode =>
  to === 'PAN'
    ? { type: 'PAN', showCursor: false }
    : { type: 'CURSOR', showCursor: true, mousedownItem: null };

/** The angle an orbit is at for a pointer x — Shift snaps to the 15° lattice. */
export const orbitAngle = (
  startRotation: number,
  startScreenX: number,
  screenX: number,
  snap: boolean
): number => {
  const raw = startRotation + (screenX - startScreenX) * ORBIT_DEG_PER_PX;
  return snap
    ? Math.round(raw / VIEW_ROTATION_STEP_DEG) * VIEW_ROTATION_STEP_DEG
    : raw;
};

export const ViewRotate: ModeActions = {
  entry: ({ uiState }) => {
    if (uiState.mode.type !== 'VIEW_ROTATE') return;
    uiState.actions.beginViewRotationMotion();
    lastRebaseAt = now();
    setWindowCursor('ew-resize');
  },
  exit: ({ uiState }) => {
    // Safety net (Escape, a programmatic mode change, a lost mouseup): the
    // view always settles, so its geometry is rebuilt at the angle it shows.
    uiState.actions.settleViewRotation();
    setWindowCursor('default');
  },
  mousemove: ({ uiState, pointer }) => {
    const mode = uiState.mode;
    if (mode.type !== 'VIEW_ROTATE') return;
    // This event's own sample — `uiState.mouse` lags one sample behind, and an
    // orbit must end exactly where the pointer is released.
    const sample = pointer ?? uiState.mouse;
    const next = orbitAngle(
      mode.startRotation,
      mode.startScreenX,
      sample.position.screen.x,
      !!sample.modifiers?.shift
    );
    uiState.actions.setViewRotation(next);
    // `uiState` is this event's snapshot; the base it carries is current (only
    // a rebase moves it, and only here).
    const t = now();
    if (
      Math.abs(shortestArc(uiState.viewRotationBase, next)) >= REBASE_DEG &&
      t - lastRebaseAt >= REBASE_MS
    ) {
      lastRebaseAt = t;
      uiState.actions.rebaseViewRotation();
    }
  },
  mousedown: () => {
    // The press that started the orbit was consumed by the manager.
  },
  mouseup: ({ uiState, pointer }) => {
    const mode = uiState.mode;
    if (mode.type !== 'VIEW_ROTATE') return;
    // Land on the release point itself, then settle (one rebuild).
    if (pointer) {
      uiState.actions.setViewRotation(
        orbitAngle(
          mode.startRotation,
          mode.startScreenX,
          pointer.position.screen.x,
          !!pointer.modifiers?.shift
        )
      );
    }
    uiState.actions.settleViewRotation();
    setWindowCursor('default');
    uiState.actions.setMode(returnMode(mode.returnTo));
  }
};
