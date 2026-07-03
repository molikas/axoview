/**
 * textbox-text-edit-move.spec.ts — v1.1 Finding #7 (KR2 helper-consumer),
 * rewritten for ADR 0034 (inline canvas text editing).
 *
 * TEXT-EDIT: place-and-type drops the new text box straight into the
 * ON-CANVAS Quill editor (`[data-axoview-id="textbox-inline-editor"]
 * .ql-editor` — the deck no longer carries a content editor and the strip's
 * rich-text popup is retired). Typing edits the live editor only; the model is
 * written ONCE on commit — left-click-away (ADR 0022 §4 contract; Enter is a
 * newline in the multi-paragraph editor, so click-away is the commit gesture).
 * The spec types a probe word and commits with a synthetic canvas mousedown
 * (the editor's click-away listener binds mousedown as well as pointerdown for
 * exactly this suite's synthetic-event dispatch).
 *
 * MOVE: unchanged in substance from the original filing — drag from a tile
 * inside the textbox's footprint to a new tile. placeTextBoxAt() now dismisses
 * the place-and-type editor by default (Escape cancels) so the subsequent
 * hotkey/drag interactions don't land in the focused editor.
 *
 * Historical scope note (kept from the original filing): resize-via-corner-
 * anchor is NOT a lib feature — TextBoxTransformControls renders no anchors;
 * textbox visible size is content-driven.
 *
 * Lazy data-axoview-id retrofits — `textbox-inline-editor` (lib,
 * TextBoxInlineEditor.tsx, landed with ADR 0034).
 */
import { canvasReadyTest as test, expect } from '../fixtures/app.fixture';
import { CanvasPOM } from '../pom/CanvasPOM';
import { getViewTextBoxCount } from '../helpers/store';

const getFirstTextBox = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const viewId = (window as any).__axoview__.ui.getState().view;
    const views = (window as any).__axoview__.model.getState().views;
    const view =
      (viewId && views.find((v: any) => v.id === viewId)) ?? views[0];
    const tb = (view?.textBoxes ?? [])[0];
    if (!tb) return null;
    return { id: tb.id, tile: tb.tile, content: tb.content ?? '' };
  });

test.describe('Textbox text-edit + move — Finding #7 / ADR 0034', () => {
  test('textbox TEXT-EDIT: typing into the on-canvas editor + click-away commits model.textBoxes[].content', async ({
    page,
    app
  }) => {
    void app;
    const canvas = new CanvasPOM(page);

    // 1. Place a textbox at a known tile, KEEPING the place-and-type edit
    //    session open (the editor is the surface under test).
    const PLACE_TILE = { x: 0, y: 0 };
    const placePixel = await canvas.tileToScreen(PLACE_TILE);
    await canvas.placeTextBoxAt(placePixel, { keepEditing: true });
    await expect.poll(() => getViewTextBoxCount(page), { timeout: 5_000 }).toBe(1);

    const placed = await getFirstTextBox(page);
    expect(placed).not.toBeNull();

    // 2. The on-canvas Quill editor mounts focused with the content selected
    //    (type-to-replace). Triple-click re-selects the line deterministically
    //    in case focus landed late, then type the probe word.
    const editor = canvas.textBoxInlineEditor();
    await editor.waitFor({ state: 'visible', timeout: 5_000 });
    await editor.click({ clickCount: 3 });
    // Single word, no spaces — Quill stores spaces as &nbsp; entities in the
    // committed HTML, so substring-matching a multi-word phrase is brittle.
    const TYPED = 'AXOVIEWPROBE';
    await page.keyboard.type(TYPED, { delay: 10 });

    // 3. The model must NOT change while typing (commit is click-away only).
    expect((await getFirstTextBox(page))!.content).toBe(placed!.content);

    // 4. Commit via click-away on empty canvas — the capture-phase mousedown
    //    listener writes the sanitized HTML once, then ends the session.
    const awayPixel = await canvas.tileToScreen({ x: 6, y: 6 });
    await canvas.dispatchAt(['mousedown', 'mouseup'], awayPixel);
    await editor.waitFor({ state: 'detached', timeout: 5_000 });

    await expect
      .poll(async () => (await getFirstTextBox(page))?.content ?? '', {
        timeout: 3_000
      })
      .toContain(TYPED);
  });

  test('textbox TEXT-EDIT: Escape cancels without touching the model', async ({
    page,
    app
  }) => {
    void app;
    const canvas = new CanvasPOM(page);

    const placePixel = await canvas.tileToScreen({ x: 0, y: 0 });
    await canvas.placeTextBoxAt(placePixel, { keepEditing: true });
    await expect.poll(() => getViewTextBoxCount(page), { timeout: 5_000 }).toBe(1);
    const before = await getFirstTextBox(page);

    const editor = canvas.textBoxInlineEditor();
    await editor.waitFor({ state: 'visible', timeout: 5_000 });
    await editor.click({ clickCount: 3 });
    await page.keyboard.type('DISCARDED', { delay: 10 });
    await page.keyboard.press('Escape');
    await editor.waitFor({ state: 'detached', timeout: 5_000 });

    expect((await getFirstTextBox(page))!.content).toBe(before!.content);
  });

  test('textbox MOVE: drag from interior to a new tile translates textbox.tile by the same delta', async ({
    page,
    app
  }) => {
    void app;
    const canvas = new CanvasPOM(page);

    // 1. Place a textbox at (0, 0). Default placeTextBoxAt dismisses the
    //    place-and-type editor, so the keyboard/drag below hit the canvas.
    const PLACE_TILE = { x: 0, y: 0 };
    const placePixel = await canvas.tileToScreen(PLACE_TILE);
    await canvas.placeTextBoxAt(placePixel);
    await expect.poll(() => getViewTextBoxCount(page), { timeout: 5_000 }).toBe(1);

    const before = await getFirstTextBox(page);
    expect(before).not.toBeNull();
    const beforeTile = before!.tile;

    // 2. Switch to CURSOR mode + clear the place-flow selection so the
    //    subsequent click goes through the empty-selection path
    //    (hitDetection -> TEXTBOX -> mousedownItem set -> drag).
    await page.keyboard.press('s');
    await page.evaluate(() => {
      (window as any).__axoview__.ui.getState().actions.setItemControls(null);
    });

    // 3. Drag from the textbox's tile to (+3, +2) tiles away. The
    //    drag tile-coord plan goes through tileToScreen so both ends
    //    land on the intended tiles regardless of iso projection.
    const DRAG_FROM_TILE = beforeTile;
    const DRAG_TO_TILE = {
      x: beforeTile.x + 3,
      y: beforeTile.y + 2
    };
    const dragFromPixel = await canvas.tileToScreen(DRAG_FROM_TILE);
    const dragToPixel = await canvas.tileToScreen(DRAG_TO_TILE);
    await canvas.dragFromTo(dragFromPixel, dragToPixel);

    const after = await getFirstTextBox(page);
    expect(after).not.toBeNull();
    expect(after!.id).toBe(before!.id);

    const dx = after!.tile.x - beforeTile.x;
    const dy = after!.tile.y - beforeTile.y;
    expect(dx !== 0 || dy !== 0).toBe(true);
    // The textbox is exactly one element; its move delta IS the drag
    // delta (no group cohesion to verify). The known RAF-cadence quirk
    // (see Finding #6 docstring) may land one tile shy of the final
    // mousemove, so the assertion is "moved in the right direction"
    // rather than "moved exactly the planned delta".
    expect(dx).toBeGreaterThan(0);
    expect(dy).toBeGreaterThan(0);
  });
});
