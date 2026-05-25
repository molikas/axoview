/**
 * CanvasPOM — the iso canvas surface.
 *
 * Session 5 ships the hotkey-driven mode-switch surface needed by
 * `shapes.spec.ts` (J3): rectangle draw via the `r` hotkey + drag, textbox
 * creation via the `t` hotkey. The drag-mode-button retrofits
 * (`canvas-tool-*`) stay deferred per ADR 0008 Decision 5 — no spec exercises
 * them in this session, so the attributes don't land yet.
 *
 * Why synthetic mouse-event dispatch on `[data-axoview-id="canvas-interactions"]`
 * instead of `page.mouse.{down,move,up}`: the lib's per-mode handlers gate on
 * `rendererRef.current === e.target` (see useInteractionManager.processMouseUpdate
 * — the `isRendererInteraction` flag). Playwright's page.mouse dispatches a
 * native event whose `e.target` is whatever elementFromPoint resolves to —
 * typically a SceneLayer child stacked above the interactions Box, so the
 * isRendererInteraction guard rejects it and the mode handler is skipped.
 * Dispatching synthetic MouseEvents directly on the interactions Box bypasses
 * the elementFromPoint dance — same pattern as connector.spec.ts#clickCanvasAt.
 *
 * Lazy data-axoview-id retrofits — none this POM-debut commit. The CanvasPOM
 * methods all consume already-landed attributes:
 *   - `canvas-interactions` (lib, Session 3)
 *   - `canvas-icon-grid-item`  (lib, Session 2)
 *
 * Session-6 addition (Commit 4 — canvas-modes spec):
 *   - `canvas-mode-toggle` (lib, ToolMenu.tsx — drives toggle2DMode())
 *     Forwarded to the IconButton's underlying <button> via a new
 *     `dataAxoviewId` pass-through prop on src/components/IconButton/
 *     IconButton.tsx. Existing call sites stay untouched.
 *
 * Pending CanvasPOM retrofits (per `pom/_pending.md`): `canvas-tool-{select,
 * connector,lasso,undo,redo}` lit by future button-driven specs; `canvas-root`
 * replaces lib `data-testid="axoview-canvas"` when a spec needs it (none yet —
 * deferred).
 */
import { Locator, Page } from '@playwright/test';
import { byAxoviewId, byLibTestId } from '../helpers/selectors';

export interface CanvasPoint {
  x: number;
  y: number;
}

export class CanvasPOM {
  constructor(readonly page: Page) {}

  /** The renderer interactions Box. Used as the dispatch target so events
   *  satisfy `e.target === rendererRef.current` (isRendererInteraction). */
  interactionsLayer(): Locator {
    return byAxoviewId(this.page, 'canvas-interactions');
  }

  /** The lib's Renderer canvas. Still uses data-testid pending the
   *  `canvas-root` retrofit (deferred — no current spec drives it). */
  canvas(): Locator {
    return byLibTestId(this.page, 'axoview-canvas');
  }

  /**
   * Dispatches a sequence of synthetic mouse events on the interactions Box.
   * Each entry's `clientX/clientY` is `interactions.getBoundingClientRect()
   * .{left,top} + point`. Caller picks the event types; events bubble to the
   * window-level listener (where useInteractionManager binds), and `e.target`
   * is deterministically the interactions Box so isRendererInteraction is true.
   *
   * Awaits one `requestAnimationFrame` tick AFTER EACH dispatched event so the
   * lib's RAF-throttled mouse-update scheduler (`interaction/useRAFThrottle.ts`)
   * has actually flushed its snapshot to `uiState.mouse` before the next event
   * lands. Session 5 (commit `f502a62`) discovered the RAF race and addressed
   * it by dispatching each event in a separate `page.evaluate` so the Playwright
   * client→server roundtrip would let RAF tick between dispatches. That holds
   * locally (~50–100 ms roundtrip on Windows + browser IPC) but breaks on
   * headless Linux CI where the roundtrip is <16 ms (sub-frame), the snapshot
   * stays stale, and the next event's mode handler reads the wrong
   * `mouse.position.tile`. Session 8 (commit `0c5f7dc` instrumentation)
   * confirmed: post-placeIcon mode = PLACE_ICON, but its mousedown handler at
   * the existing item's tile read a stale position, so `getItemAtTile` returned
   * nothing, `mousedownItem` was null, and the drag had no target. Awaiting RAF
   * inside the evaluate makes the dispatch synchronous w.r.t. the lib's
   * observable state regardless of CI vs local roundtrip latency.
   */
  async dispatchAt(
    events: Array<'mousemove' | 'mousedown' | 'mouseup'>,
    point: CanvasPoint
  ) {
    await this.interactionsLayer().evaluate(
      async (el, args: { types: string[]; x: number; y: number }) => {
        const rect = el.getBoundingClientRect();
        const raf = () =>
          new Promise<void>((r) => requestAnimationFrame(() => r()));
        for (const type of args.types) {
          el.dispatchEvent(
            new MouseEvent(type, {
              bubbles: true,
              cancelable: true,
              clientX: rect.left + args.x,
              clientY: rect.top + args.y,
              button: 0
            })
          );
          await raf();
        }
      },
      { types: events, x: point.x, y: point.y }
    );
  }

  /** Single click on the canvas via synthetic mousemove+down+up at one point. */
  async clickAt(point: CanvasPoint) {
    await this.dispatchAt(['mousemove', 'mousedown', 'mouseup'], point);
  }

  /**
   * Synthetic drag from `from` to `to` on the canvas. The lib's
   * DrawRectangle.mousemove gates on `hasMovedTile` AND `uiState.mouse.mousedown`,
   * so we dispatch an intermediate mousemove with the down state implied by
   * the preceding mousedown — the lib's processMouseUpdate writes mousedown
   * into uiState on the synthetic mousedown event.
   */
  async dragFromTo(from: CanvasPoint, to: CanvasPoint) {
    // Land mouse at start tile.
    await this.dispatchAt(['mousemove'], from);
    // Begin the drag.
    await this.dispatchAt(['mousedown'], from);
    // Walk to the end tile through a few intermediate steps so DrawRectangle's
    // hasMovedTile gate trips on each pixel-band crossing. Two points is
    // usually enough; we pick three for safety on small drags.
    const midA = {
      x: from.x + (to.x - from.x) / 3,
      y: from.y + (to.y - from.y) / 3
    };
    const midB = {
      x: from.x + ((to.x - from.x) * 2) / 3,
      y: from.y + ((to.y - from.y) * 2) / 3
    };
    await this.dispatchAt(['mousemove'], midA);
    await this.dispatchAt(['mousemove'], midB);
    await this.dispatchAt(['mousemove'], to);
    await this.dispatchAt(['mouseup'], to);
  }

  /**
   * Enters RECTANGLE.DRAW mode via the `r` hotkey (default profile = smnrct,
   * see config/hotkeys.ts; the rectangle binding is `r` in all non-`none`
   * profiles, so this is stable across qwerty/smnrct). useInteractionManager's
   * keydown filters INPUT/TEXTAREA/contenteditable targets — after a canvas
   * interaction, focus sits on the document body which passes the filter.
   */
  async switchToRectangleMode() {
    await this.page.keyboard.press('r');
  }

  /**
   * Triggers textbox creation via the `t` hotkey. The keydown handler in
   * useInteractionManager reads `uiState.mouse.position.tile` and creates a
   * textbox at that tile, then transitions to TEXTBOX mode (id = the new
   * textbox). Callers MUST land the synthetic mouse at the desired tile
   * (via dispatchAt(['mousemove'], …)) BEFORE pressing the hotkey so the
   * store's mouse position is current.
   *
   * The TextBox mode's mouseup gates on isRendererInteraction — caller
   * commits the textbox by dispatching a mouseup on the interactions Box
   * (clickAt handles the move+down+up sequence; placeTextBoxAt below wraps
   * the canonical flow).
   *
   * Note: hotkey is `t` in `smnrct` profile and `y` in `qwerty`. The lib's
   * test bootstrap defaults to `smnrct` (see DEFAULT_HOTKEY_PROFILE) and the
   * e2e suite never switches profiles — so the bare `t` press is correct for
   * every spec until a profile-switch spec lands.
   */
  async pressTextBoxHotkey() {
    await this.page.keyboard.press('t');
  }

  /**
   * Canonical textbox-placement flow:
   *   1. land mouse at the target tile (sets uiState.mouse.position.tile)
   *   2. press `t` hotkey (creates textbox + enters TEXTBOX mode)
   *   3. mouseup at the same tile (commits via isRendererInteraction = true)
   */
  async placeTextBoxAt(point: CanvasPoint) {
    await this.dispatchAt(['mousemove'], point);
    await this.pressTextBoxHotkey();
    await this.dispatchAt(['mouseup'], point);
  }

  canvasModeToggleButton(): Locator {
    return byAxoviewId(this.page, 'canvas-mode-toggle');
  }

  /**
   * Clicks the ToolMenu's canvas-mode toggle. Flips
   * `uiState.canvasMode` between ISOMETRIC ↔ 2D and triggers a
   * fit-to-view post-switch (see ToolMenu.tsx#L43-48 — prevCanvasModeRef
   * detects the transition and calls fitToView).
   */
  async toggleCanvasMode() {
    await this.canvasModeToggleButton().click();
  }
}
