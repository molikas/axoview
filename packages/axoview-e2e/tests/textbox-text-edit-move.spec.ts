/**
 * textbox-text-edit-move.spec.ts — v1.1 Finding #7 (KR2 helper-consumer).
 *
 * Closes Finding #7 in docs/tactical/v1.1-test-coverage.md — the
 * textbox text-edit sub-row + the move sub-row that textbox-ops.spec.ts
 * deliberately scoped out (it covers Delete only).
 *
 * IMPORTANT scope correction to Finding #7's filing: the original
 * deferral row paired "text-edit + resize" and assumed both unblocked
 * with a tile->screen helper. Resize-via-corner-anchor is NOT a feature
 * the lib supports — TextBoxTransformControls.tsx renders
 * TransformControls WITHOUT passing onAnchorMouseDown (compare
 * RectangleTransformControls.tsx:14-28), so the four corner anchors
 * never render and there is no RECTANGLE.TRANSFORM-equivalent mode for
 * textboxes. Textbox visible size is content-driven (the fontSize
 * slider in TextBoxControls.tsx is the only "make it bigger" affordance).
 * This spec therefore covers text-edit + a MOVE sub-row (which textbox
 * data structurally supports through DragItems / Cursor.ts:337-343 but
 * was not in Finding #7's original wording).
 *
 * TEXT-EDIT: select textbox -> TextBoxControls.tsx mounts the
 * RichTextEditor (react-quill-new); type into the .ql-editor
 * contenteditable; assert model.textBoxes[id].content updated. Quill
 * exposes no observable data attribute on its editor element so the
 * spec uses the .ql-editor CSS class (the conventional react-quill
 * anchor); this is the only DOM-coupling-to-vendor in the spec.
 *
 * MOVE: drag from a tile inside the textbox's footprint to a new tile.
 * Cursor.mousedown reads hitDetection.ts:58-73 (textboxes second-place
 * after items) and sets mousedownItem = {type:'TEXTBOX'}; Cursor.mousemove
 * transitions to DRAG_ITEMS with initialTiles seeded; mouseup commits
 * the new textbox.tile = originalTile + cursor delta.
 *
 * Lazy data-axoview-id retrofits — none.
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

test.describe('Textbox text-edit + move — Finding #7', () => {
  test('textbox TEXT-EDIT: typing into the RichTextEditor updates model.textBoxes[].content', async ({
    page,
    app
  }) => {
    void app;
    const canvas = new CanvasPOM(page);

    // 1. Place a textbox at a known tile. placeTextBoxAt() uses the
    //    't' hotkey + a mousemove at the desired pixel; we use
    //    tileToScreen({0,0}) so the textbox lands at a known tile and
    //    the subsequent click for selection is deterministic.
    const PLACE_TILE = { x: 0, y: 0 };
    const placePixel = await canvas.tileToScreen(PLACE_TILE);
    await canvas.placeTextBoxAt(placePixel);
    await expect.poll(() => getViewTextBoxCount(page), { timeout: 5_000 }).toBe(1);

    const placed = await getFirstTextBox(page);
    expect(placed).not.toBeNull();

    // 2. Selecting a textbox in this lib happens during the place flow
    //    (TextBox.mouseup -> setItemControls({type:'TEXTBOX', id}))
    //    so the controls panel is already mounted with the Quill editor.
    //    Wait for the editor to be ready.
    const quillEditor = page.locator('.ql-editor').first();
    await quillEditor.waitFor({ state: 'visible', timeout: 5_000 });

    // 3. Focus the editor + type. Quill captures keystrokes via its
    //    contenteditable and propagates onChange (string HTML) up to
    //    TextBoxControls -> useScene().updateTextBox.
    await quillEditor.click();
    // Single word, no spaces — Quill replaces literal spaces with &nbsp;
    // entities in the saved HTML (TextBoxes.content), so substring-matching
    // a multi-word phrase is brittle without HTML-decoding. The contract
    // under test is "the editor's keystrokes propagated into the model";
    // a single contiguous probe word is enough.
    const TYPED = 'AXOVIEWPROBE';
    await page.keyboard.type(TYPED, { delay: 10 });

    // 4. Assert content propagated. Quill wraps content in <p>...</p> and
    //    may prepend any default placeholder; substring-match the probe
    //    word inside the resulting HTML.
    await expect
      .poll(async () => (await getFirstTextBox(page))?.content ?? '', {
        timeout: 3_000
      })
      .toContain(TYPED);
  });

  test('textbox MOVE: drag from interior to a new tile translates textbox.tile by the same delta', async ({
    page,
    app
  }) => {
    void app;
    const canvas = new CanvasPOM(page);

    // 1. Place a textbox at (0, 0).
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
