/**
 * rectangle-move-resize.spec.ts — v1.1 Finding #6 (KR2 helper-consumer).
 *
 * Closes Finding #6 in docs/tactical/v1.1-test-coverage.md — the
 * rectangle move + resize sub-rows of Track 5h that rectangle-ops.spec.ts
 * deliberately scoped out (it covers Delete only). Both are unblocked by
 * the KR1 iso tile->screen helper.
 *
 * MOVE: Cursor.mousedown on a tile inside the rectangle reads ITEM at
 * tile first (none), then textboxes (none), then connectors (none), then
 * rectangles (this one) — see hitDetection.ts:43-95. mousedownItem is set
 * to {type:'RECTANGLE'}. The subsequent mousemove crosses tiles, so
 * Cursor.mousemove (Cursor.ts:294-369) seeds initialRectangles for the
 * dragged ref and transitions to DRAG_ITEMS. DragItems' mouseup commits
 * the new from/to translated by the cursor delta.
 *
 * RESIZE: the corner-anchor click-to-enter step is bypassed via the
 * debug bridge. RECTANGLE.TRANSFORM mode entry on the user-visible path
 * fires from TransformAnchor.tsx's onMouseDown (set by
 * RectangleTransformControls.tsx:17-28). TransformAnchor has no
 * observable data-axoview-id hook and the anchor's screen pixel must be
 * computed via getTilePosition WITH the named-corner origin offset (per
 * TransformControls.tsx:30-50) — a non-trivial second mirror beyond
 * tileToScreen. The seam being tested is TransformRectangle.mousemove
 * (TransformRectangle.ts:12-62) and scene.updateRectangle, both of which
 * are exercised once the mode is entered programmatically + a synthetic
 * mousemove + mouseup is dispatched at the target corner tile. The
 * mode-entry click is the only step bypassed; the math, the contract,
 * and the model update all run end-to-end.
 *
 * Lazy data-axoview-id retrofits — none. (A future session adding the
 * TransformAnchor anchor + position attributes would let the resize
 * spec do the full UI flow.)
 */
import { canvasReadyTest as test, expect } from '../fixtures/app.fixture';
import { CanvasPOM } from '../pom/CanvasPOM';
import { getViewRectangleCount } from '../helpers/store';

const getFirstRectangle = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const viewId = (window as any).__axoview__.ui.getState().view;
    const views = (window as any).__axoview__.model.getState().views;
    const view =
      (viewId && views.find((v: any) => v.id === viewId)) ?? views[0];
    const r = (view?.rectangles ?? [])[0];
    if (!r) return null;
    return { id: r.id, from: r.from, to: r.to };
  });

test.describe('Rectangle move + resize — Finding #6', () => {
  test('rectangle MOVE: drag from interior to a new tile translates from + to by the same delta', async ({
    page,
    app
  }) => {
    void app;
    const canvas = new CanvasPOM(page);

    // 1. Draw a 5x5 rect (planned in tile coords; see Finding #5 spec
    //    for why tile-planning is more reliable than pixel-planning).
    const RECT_FROM_TILE = { x: -2, y: -2 };
    const RECT_TO_TILE = { x: 2, y: 2 };
    const rectFromPixel = await canvas.tileToScreen(RECT_FROM_TILE);
    const rectToPixel = await canvas.tileToScreen(RECT_TO_TILE);
    await canvas.switchToRectangleMode();
    await canvas.dragFromTo(rectFromPixel, rectToPixel);
    await expect
      .poll(() => getViewRectangleCount(page), { timeout: 5_000 })
      .toBe(1);

    const before = await getFirstRectangle(page);
    expect(before).not.toBeNull();

    // 2. Back to CURSOR; clear any selection from the draw mouseup.
    await page.keyboard.press('s');
    await page.evaluate(() => {
      (window as any).__axoview__.ui.getState().actions.setItemControls(null);
    });

    // 3. Drag from a tile inside the rectangle (offset by +1 from from
    //    on both axes to stay strictly interior) to a destination tile
    //    a few tiles away. Cursor.mousemove transitions to DRAG_ITEMS
    //    with initialRectangles seeded — the rect's from/to are kept
    //    in step with the cursor delta.
    const minX = Math.min(before!.from.x, before!.to.x);
    const minY = Math.min(before!.from.y, before!.to.y);
    const DRAG_FROM_TILE = { x: minX + 1, y: minY + 1 };
    const DRAG_TO_TILE = { x: DRAG_FROM_TILE.x + 3, y: DRAG_FROM_TILE.y + 2 };
    const dragFromPixel = await canvas.tileToScreen(DRAG_FROM_TILE);
    const dragToPixel = await canvas.tileToScreen(DRAG_TO_TILE);
    await canvas.dragFromTo(dragFromPixel, dragToPixel);

    const after = await getFirstRectangle(page);
    expect(after).not.toBeNull();
    expect(after!.id).toBe(before!.id);

    const deltaFrom = {
      dx: after!.from.x - before!.from.x,
      dy: after!.from.y - before!.from.y
    };
    const deltaTo = {
      dx: after!.to.x - before!.to.x,
      dy: after!.to.y - before!.to.y
    };
    expect(deltaFrom).toEqual(deltaTo);
    expect(deltaFrom.dx !== 0 || deltaFrom.dy !== 0).toBe(true);
  });

  test('rectangle RESIZE: TransformRectangle BOTTOM_RIGHT drag updates the bottom-right corner only', async ({
    page,
    app
  }) => {
    void app;
    const canvas = new CanvasPOM(page);

    // 1. Same 5x5 rect setup.
    const RECT_FROM_TILE = { x: -2, y: -2 };
    const RECT_TO_TILE = { x: 2, y: 2 };
    const rectFromPixel = await canvas.tileToScreen(RECT_FROM_TILE);
    const rectToPixel = await canvas.tileToScreen(RECT_TO_TILE);
    await canvas.switchToRectangleMode();
    await canvas.dragFromTo(rectFromPixel, rectToPixel);
    await expect
      .poll(() => getViewRectangleCount(page), { timeout: 5_000 })
      .toBe(1);
    const before = await getFirstRectangle(page);
    expect(before).not.toBeNull();

    // 2. Bypass the corner-anchor click and enter RECTANGLE.TRANSFORM
    //    via the debug bridge. The TransformRectangle.mousemove seam is
    //    what this spec pins — the anchor click is unobservable today
    //    (no data attribute on TransformAnchor).
    await page.evaluate((rectId: string) => {
      const ui = (window as any).__axoview__.ui;
      ui.getState().actions.setItemControls({ type: 'RECTANGLE', id: rectId });
      ui.getState().actions.setMode({
        type: 'RECTANGLE.TRANSFORM',
        id: rectId,
        selectedAnchor: 'BOTTOM_RIGHT',
        showCursor: true
      });
    }, before!.id);

    // 3. Drive a synthetic mousemove from a starting tile to an ending
    //    tile. TransformRectangle.mousemove (TransformRectangle.ts:12-62)
    //    only gates on hasMovedTile — it does NOT require mousedown, so a
    //    simple mousemove + mouseup pair on canvas-interactions is
    //    sufficient to exercise the resize path with selectedAnchor set.
    //
    //    The named-anchor convention is screen-orientation based: in iso
    //    projection +tileY = screen-up, so TOP_LEFT = (min tileX, max
    //    tileY) and BOTTOM_RIGHT = (max tileX, min tileY). Dragging the
    //    BOTTOM_RIGHT anchor keeps the TOP_LEFT corner fixed (= original
    //    min x, max y). The new rect's bounds wrap [FIXED, MOUSE_END].
    const beforeMinX = Math.min(before!.from.x, before!.to.x);
    const beforeMaxX = Math.max(before!.from.x, before!.to.x);
    const beforeMaxY = Math.max(before!.from.y, before!.to.y);
    const FIXED_CORNER = { x: beforeMinX, y: beforeMaxY };
    const RESIZE_START_TILE = { x: beforeMaxX, y: Math.min(before!.from.y, before!.to.y) };
    const RESIZE_END_TILE = { x: beforeMaxX + 3, y: RESIZE_START_TILE.y - 2 };
    const startPixel = await canvas.tileToScreen(RESIZE_START_TILE);
    const endPixel = await canvas.tileToScreen(RESIZE_END_TILE);

    // Use dragFromTo for its multi-mousemove cadence — the RAF-throttled
    // processMouseUpdate samples each step and computes a non-zero delta,
    // which is what TransformRectangle.mousemove's hasMovedTile gate needs
    // (isoMath.ts:369 — delta is the prior-vs-current sample). A bare
    // two-mousemove sequence can miss a sample on the second tile because
    // the RAF cadence races the dispatch-await loop.
    await canvas.dragFromTo(startPixel, endPixel);

    const after = await getFirstRectangle(page);
    expect(after).not.toBeNull();
    expect(after!.id).toBe(before!.id);

    // The contract under test is TransformRectangle.mousemove ->
    // scene.updateRectangle, NOT pixel-precise final-frame settling. The
    // dragFromTo's RAF-throttled mouse sampler may land the final commit
    // one tile shy of the very last mousemove (a known cadence quirk —
    // see CanvasPOM.dispatchAt's docstring about per-event RAF awaits).
    // The robust assertions are:
    //   (i) FIXED_CORNER (TOP_LEFT, kept by selectedAnchor=BOTTOM_RIGHT)
    //       remains a corner of the resized rect; and
    //   (ii) the dragged corner moved in the direction of RESIZE_END_TILE
    //        relative to the original.
    const afterMinX = Math.min(after!.from.x, after!.to.x);
    const afterMaxX = Math.max(after!.from.x, after!.to.x);
    const afterMinY = Math.min(after!.from.y, after!.to.y);
    const afterMaxY = Math.max(after!.from.y, after!.to.y);

    // (i) FIXED_CORNER = (originalMinX, originalMaxY) must be a corner.
    expect(afterMinX).toBe(FIXED_CORNER.x);
    expect(afterMaxY).toBe(FIXED_CORNER.y);

    // (ii) The opposite corner expanded toward RESIZE_END_TILE.
    //      RESIZE_END_TILE.x > original maxX  =>  new maxX > original maxX
    //      RESIZE_END_TILE.y < original minY  =>  new minY < original minY
    const beforeMaxX2 = Math.max(before!.from.x, before!.to.x);
    const beforeMinY2 = Math.min(before!.from.y, before!.to.y);
    expect(afterMaxX).toBeGreaterThan(beforeMaxX2);
    expect(afterMinY).toBeLessThan(beforeMinY2);

    // Sanity — the rect dimensions actually changed.
    const beforeW = Math.abs(before!.to.x - before!.from.x);
    const afterW = afterMaxX - afterMinX;
    expect(afterW).toBeGreaterThan(beforeW);
  });
});
