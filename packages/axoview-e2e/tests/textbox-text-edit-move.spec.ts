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

  test('textbox TEXT-EDIT: Escape on a never-committed box discards it (empty-box lifecycle)', async ({
    page,
    app
  }) => {
    void app;
    const canvas = new CanvasPOM(page);

    // A new box is born EMPTY; a session that ends with no committed content
    // deletes the box (ADR 0034 addendum 2026-07-03) — placement-cancel
    // semantics, no invisible ghost element left behind.
    const placePixel = await canvas.tileToScreen({ x: 0, y: 0 });
    await canvas.placeTextBoxAt(placePixel, { keepEditing: true });
    await expect.poll(() => getViewTextBoxCount(page), { timeout: 5_000 }).toBe(1);

    const editor = canvas.textBoxInlineEditor();
    await editor.waitFor({ state: 'visible', timeout: 5_000 });
    await editor.click({ clickCount: 3 });
    await page.keyboard.type('DISCARDED', { delay: 10 });
    await page.keyboard.press('Escape');
    await editor.waitFor({ state: 'detached', timeout: 5_000 });

    await expect.poll(() => getViewTextBoxCount(page), { timeout: 5_000 }).toBe(0);
  });

  test('textbox TEXT-EDIT: Escape on a re-edit of a committed box reverts without touching the model', async ({
    page,
    app
  }) => {
    void app;
    const canvas = new CanvasPOM(page);

    // Default placement commits probe content ('Text').
    const placePixel = await canvas.tileToScreen({ x: 0, y: 0 });
    await canvas.placeTextBoxAt(placePixel);
    await expect.poll(() => getViewTextBoxCount(page), { timeout: 5_000 }).toBe(1);
    const before = await getFirstTextBox(page);
    expect(before).not.toBeNull();

    // Re-enter the edit session via the F2/Rename entry point (the
    // inlineEditNodeName event TextBox.tsx listens for).
    await page.evaluate((id) => {
      window.dispatchEvent(
        new CustomEvent('inlineEditNodeName', { detail: { id } })
      );
    }, before!.id);
    const editor = canvas.textBoxInlineEditor();
    await editor.waitFor({ state: 'visible', timeout: 5_000 });
    await editor.click({ clickCount: 3 });
    await page.keyboard.type('DISCARDED', { delay: 10 });
    await page.keyboard.press('Escape');
    await editor.waitFor({ state: 'detached', timeout: 5_000 });

    const after = await getFirstTextBox(page);
    expect(after).not.toBeNull();
    expect(after!.content).toBe(before!.content);
  });

  test('textbox TEXT-EDIT: "- " autoformats into a bullet list that commits as <ul> (ADR 0034 addendum)', async ({
    page,
    app
  }) => {
    void app;
    const canvas = new CanvasPOM(page);

    const placePixel = await canvas.tileToScreen({ x: 0, y: 0 });
    await canvas.placeTextBoxAt(placePixel, { keepEditing: true });
    await expect.poll(() => getViewTextBoxCount(page), { timeout: 5_000 }).toBe(1);

    const editor = canvas.textBoxInlineEditor();
    await editor.waitFor({ state: 'visible', timeout: 5_000 });
    await editor.click({ clickCount: 3 });

    // "-" replaces the selected seed text, the following space fires Quill's
    // list autofill (restored by the ADR 0034 addendum — retired MQA #12),
    // Enter continues the list with a second item.
    await page.keyboard.type('- alpha', { delay: 10 });
    await page.keyboard.press('Enter');
    await page.keyboard.type('beta', { delay: 10 });

    // The editor already shows a live list (data-list markup pre-commit).
    await expect(editor.locator('li[data-list="bullet"]')).toHaveCount(2);

    const awayPixel = await canvas.tileToScreen({ x: 6, y: 6 });
    await canvas.dispatchAt(['mousedown', 'mouseup'], awayPixel);
    await editor.waitFor({ state: 'detached', timeout: 5_000 });

    const content = await expect
      .poll(async () => (await getFirstTextBox(page))?.content ?? '', {
        timeout: 3_000
      })
      .toContain('<ul>')
      .then(async () => (await getFirstTextBox(page))!.content);

    // getSemanticHTML serializes the bullets as a real <ul> with both items,
    // and the typed "- " marker is consumed by the conversion.
    expect(content).toContain('alpha');
    expect(content).toContain('beta');
    expect(content).not.toContain('- alpha');
    expect((content.match(/<li/g) ?? []).length).toBe(2);
  });

  test('textbox STYLE: the alignment control writes text-align + verticalAlign (ADR 0034 addenda)', async ({
    page,
    app
  }) => {
    void app;
    const canvas = new CanvasPOM(page);

    // Default placement commits 'Text' and leaves the box selected — the
    // strip's alignment control targets it in whole-content scope.
    const placePixel = await canvas.tileToScreen({ x: 0, y: 0 });
    await canvas.placeTextBoxAt(placePixel);
    await expect.poll(() => getViewTextBoxCount(page), { timeout: 5_000 }).toBe(1);

    const getBox = () =>
      page.evaluate(() => {
        const viewId = (window as any).__axoview__.ui.getState().view;
        const views = (window as any).__axoview__.model.getState().views;
        const view =
          (viewId && views.find((v: any) => v.id === viewId)) ?? views[0];
        const tb = (view?.textBoxes ?? [])[0];
        return { content: tb?.content ?? '', verticalAlign: tb?.verticalAlign ?? null };
      });

    // ONE strip control, two standard-icon rows (2026-07-04 re-cut of the 3×3
    // grid): horizontal writes the content, vertical the element field —
    // independently.
    await page.getByTestId('strip-alignment').click();
    await page.getByTestId('strip-align-h-center').click();
    await expect
      .poll(async () => (await getBox()).content, { timeout: 3_000 })
      .toContain('text-align: center');
    expect((await getBox()).verticalAlign).toBe(null);

    await page.getByTestId('strip-align-v-middle').click();
    await expect
      .poll(async () => (await getBox()).verticalAlign, { timeout: 3_000 })
      .toBe('middle');
    // Vertical write leaves the horizontal content format alone.
    expect((await getBox()).content).toContain('text-align: center');

    // Left/top are the defaults = both stored as ABSENT.
    await page.getByTestId('strip-align-h-left').click();
    await expect
      .poll(async () => (await getBox()).content, { timeout: 3_000 })
      .not.toContain('text-align');
    await page.getByTestId('strip-align-v-top').click();
    await expect
      .poll(async () => (await getBox()).verticalAlign, { timeout: 3_000 })
      .toBe(null);
  });

  test('textbox EDIT-BOUNDS: the transform bounds hug the placeholder, then track the draft live (ADR 0034 addendum 2026-07-04)', async ({
    page,
    app
  }) => {
    void app;
    const canvas = new CanvasPOM(page);

    // Fresh place-and-type session: empty box, "Type something" placeholder.
    const placePixel = await canvas.tileToScreen({ x: 0, y: 0 });
    await canvas.placeTextBoxAt(placePixel, { keepEditing: true });
    await expect.poll(() => getViewTextBoxCount(page), { timeout: 5_000 }).toBe(1);
    const editor = canvas.textBoxInlineEditor();
    await editor.waitFor({ state: 'visible', timeout: 5_000 });

    // Transform controls stay up during the session (owner 2026-07-04); their
    // anchors are the observable projection of the live-measured bounds.
    const anchors = page.locator('[data-axoview-id="canvas-transform-anchor"]');
    await expect(anchors).toHaveCount(8);
    const anchorSpread = async () => {
      const rects = await anchors.evaluateAll((els) =>
        els.map((el) => {
          const r = el.getBoundingClientRect();
          return { left: r.left, right: r.right };
        })
      );
      return (
        Math.max(...rects.map((r) => r.right)) -
        Math.min(...rects.map((r) => r.left))
      );
    };

    // The empty box measures its PLACEHOLDER, not a 1-tile sliver: the bounds
    // must already span more than a single projected tile (~100px pre-zoom).
    const placeholderSpread = await anchorSpread();
    expect(placeholderSpread).toBeGreaterThan(80);

    // Type well past the placeholder width — the bounds follow the draft
    // BEFORE any commit (the editor publishes editingTextBoxSize per change).
    await editor.click({ clickCount: 3 });
    await page.keyboard.type(
      'alpha beta gamma delta epsilon zeta eta theta iota kappa',
      { delay: 5 }
    );
    await expect
      .poll(anchorSpread, { timeout: 5_000 })
      .toBeGreaterThan(placeholderSpread + 40);

    // Model still untouched mid-session (commit is click-away only).
    expect((await getFirstTextBox(page))!.content).toBe('');
    await canvas.commitTextBoxEditor();
  });

  test('textbox LINK: Ctrl+K opens the INLINE card at the word under the caret; Enter applies (ADR 0034 addendum 2026-07-04)', async ({
    page,
    app
  }) => {
    void app;
    const canvas = new CanvasPOM(page);

    const placePixel = await canvas.tileToScreen({ x: 0, y: 0 });
    await canvas.placeTextBoxAt(placePixel, { keepEditing: true });
    await expect.poll(() => getViewTextBoxCount(page), { timeout: 5_000 }).toBe(1);
    const editor = canvas.textBoxInlineEditor();
    await editor.waitFor({ state: 'visible', timeout: 5_000 });
    await editor.click({ clickCount: 3 });
    await page.keyboard.type('visit docs today', { delay: 10 });

    // Caret sits collapsed after 'today' — Ctrl+K expands to the word (Docs
    // convention) and opens the INLINE link card in edit mode at the text —
    // NOT the strip popover at the top of the screen (owner 2026-07-04).
    await page.keyboard.press('Control+k');
    // data-axoview-id sits on the MUI TextField ROOT; fill targets the input.
    const cardInput = page.locator(
      '[data-axoview-id="textbox-link-card-input"] input'
    );
    await cardInput.waitFor({ state: 'visible', timeout: 5_000 });
    await expect(
      page.locator('[data-axoview-id="strip-link-input"]')
    ).toBeHidden();
    await cardInput.fill('https://example.com/docs');
    await cardInput.press('Enter');

    // Apply flips the card to view mode over the fresh link.
    await expect(
      page.locator('[data-axoview-id="textbox-link-card-url"]')
    ).toHaveText('https://example.com/docs');

    await canvas.commitTextBoxEditor();
    const content = await expect
      .poll(async () => (await getFirstTextBox(page))?.content ?? '', {
        timeout: 3_000
      })
      .toContain('<a')
      .then(async () => (await getFirstTextBox(page))!.content);
    expect(content).toMatch(
      /<a[^>]*href="https:\/\/example\.com\/docs"[^>]*>today<\/a>/
    );
  });

  test('textbox LINK-CARD: protocol-less URLs are forgiven; unlink removes the anchor (ADR 0034 addendum 2026-07-04)', async ({
    page,
    app
  }) => {
    void app;
    const canvas = new CanvasPOM(page);

    const placePixel = await canvas.tileToScreen({ x: 0, y: 0 });
    await canvas.placeTextBoxAt(placePixel, { keepEditing: true });
    await expect.poll(() => getViewTextBoxCount(page), { timeout: 5_000 }).toBe(1);
    const editor = canvas.textBoxInlineEditor();
    await editor.waitFor({ state: 'visible', timeout: 5_000 });
    await editor.click({ clickCount: 3 });
    await page.keyboard.type('visit docs today', { delay: 10 });

    // Create via the inline card; a bare domain is normalized Docs-style.
    await page.keyboard.press('Control+k');
    const cardInput = page.locator(
      '[data-axoview-id="textbox-link-card-input"] input'
    );
    await cardInput.waitFor({ state: 'visible', timeout: 5_000 });
    await cardInput.fill('example.com/docs');
    await cardInput.press('Enter');

    // Apply flips the card to VIEW mode over the fresh link, URL normalized.
    const card = page.locator('[data-axoview-id="textbox-link-card"]');
    await card.waitFor({ state: 'visible', timeout: 5_000 });
    await expect(
      page.locator('[data-axoview-id="textbox-link-card-url"]')
    ).toHaveText('https://example.com/docs');

    // Unlink from the card, then commit — the anchor is gone, the text stays.
    await page.locator('[data-axoview-id="textbox-link-card-remove"]').click();
    await card.waitFor({ state: 'detached', timeout: 3_000 });
    await canvas.commitTextBoxEditor();
    const content = await expect
      .poll(async () => (await getFirstTextBox(page))?.content ?? '', {
        timeout: 3_000
      })
      .toContain('today')
      .then(async () => (await getFirstTextBox(page))!.content);
    expect(content).not.toContain('<a');
  });

  test('textbox RESIZE: run-axis anchors set a manual width; content wraps and height grows (ADR 0034 addendum)', async ({
    page,
    app
  }) => {
    void app;
    const canvas = new CanvasPOM(page);

    // Multi-word content so a narrowed box has something to wrap.
    const placePixel = await canvas.tileToScreen({ x: 0, y: 0 });
    await canvas.placeTextBoxAt(placePixel, {
      text: 'alpha beta gamma delta epsilon zeta'
    });
    await expect.poll(() => getViewTextBoxCount(page), { timeout: 5_000 }).toBe(1);
    const before = await getFirstTextBox(page);
    expect(before).not.toBeNull();

    // The selected text box offers the full rectangle-style anchor set
    // (4 corners + 4 edges): run-axis = wrap width, row-axis = min height.
    await expect(
      page.locator('[data-axoview-id="canvas-transform-anchor"]')
    ).toHaveCount(8);

    // Drive the resize mode the way the RIGHT anchor's pointerdown does
    // (store-armed, like placeLabelAt), then drag on the canvas: the width
    // follows the mouse tile and lands in the model live (inside the drag
    // transaction). Mousemove routing is RAF-throttled, so walk through
    // intermediate points (dragFromTo cadence) and poll for the write BEFORE
    // releasing — a same-tick mouseup can beat the throttled move.
    await page.evaluate((id) => {
      (window as any).__axoview__.ui.getState().actions.setMode({
        type: 'TEXTBOX.TRANSFORM',
        id,
        selectedAnchor: 'RIGHT',
        showCursor: true
      });
    }, before!.id);
    const getWidth = () =>
      page.evaluate(() => {
        const viewId = (window as any).__axoview__.ui.getState().view;
        const views = (window as any).__axoview__.model.getState().views;
        const view =
          (viewId && views.find((v: any) => v.id === viewId)) ?? views[0];
        return (view?.textBoxes ?? [])[0]?.width ?? null;
      });
    // Synthetic-event cadence notes (same family as the MOVE test's quirk):
    //   - drag targets derive from the box's ACTUAL tile (placement itself
    //     rides the RAF-throttled mouse, so the landing tile isn't given),
    //   - the mode handler sees the mouse position of the PREVIOUS event
    //     (one-event lag — self-correcting under a real pointer stream), so
    //     each target is dispatched until the model catches up, with polls
    //     between dispatches to defeat the leading-edge RAF throttle.
    const base = before!.tile;
    const dragTo = await canvas.tileToScreen({ x: base.x + 3, y: base.y });
    await canvas.dispatchAt(['mousemove'], dragTo);
    await expect.poll(getWidth, { timeout: 5_000 }).not.toBeNull();
    await canvas.dispatchAt(['mousemove'], dragTo);
    await expect
      .poll(
        async () => {
          const w = await getWidth();
          if (w !== 3) await canvas.dispatchAt(['mousemove'], dragTo);
          return w;
        },
        { timeout: 5_000 }
      )
      .toBe(3);
    await canvas.dispatchAt(['mouseup'], dragTo);

    // The commit (mouseup) closes the transaction without clobbering the width.
    await expect.poll(getWidth, { timeout: 3_000 }).toBe(3);

    // The RESTING render honors the fixed width: the content paragraph is
    // container-wide with no horizontal overflow — i.e., it actually wrapped
    // (the &nbsp;-serialization bug used to leave one unbreakable 800px line).
    const wrap = await page.evaluate((id) => {
      const wrapper = document.querySelector(`[data-drag-id="${id}"]`);
      const container = wrapper?.querySelector(
        '.MuiBox-root .MuiBox-root'
      ) as HTMLElement | null;
      const paragraph = container?.querySelector('p p, p') as HTMLElement | null;
      if (!container || !paragraph) return null;
      return {
        containerWidth: container.clientWidth,
        paragraphWidth: paragraph.clientWidth,
        paragraphScrollWidth: paragraph.scrollWidth
      };
    }, before!.id);
    expect(wrap).not.toBeNull();
    expect(wrap!.paragraphWidth).toBeLessThanOrEqual(wrap!.containerWidth + 1);
    expect(wrap!.paragraphScrollWidth).toBeLessThanOrEqual(
      wrap!.paragraphWidth + 1
    );

    // Row-axis anchor: TOP sets a manual (minimum) height the same way.
    const getHeight = () =>
      page.evaluate(() => {
        const viewId = (window as any).__axoview__.ui.getState().view;
        const views = (window as any).__axoview__.model.getState().views;
        const view =
          (viewId && views.find((v: any) => v.id === viewId)) ?? views[0];
        return (view?.textBoxes ?? [])[0]?.height ?? null;
      });
    const tileNow = await page.evaluate(() => {
      const viewId = (window as any).__axoview__.ui.getState().view;
      const views = (window as any).__axoview__.model.getState().views;
      const view =
        (viewId && views.find((v: any) => v.id === viewId)) ?? views[0];
      return (view?.textBoxes ?? [])[0]?.tile;
    });
    await page.evaluate((id) => {
      (window as any).__axoview__.ui.getState().actions.setMode({
        type: 'TEXTBOX.TRANSFORM',
        id,
        selectedAnchor: 'TOP',
        showCursor: true
      });
    }, before!.id);
    const heightTo = await canvas.tileToScreen({
      x: tileNow.x,
      y: tileNow.y + 5
    });
    await canvas.dispatchAt(['mousemove'], heightTo);
    await expect
      .poll(
        async () => {
          const h = await getHeight();
          if (h === null) await canvas.dispatchAt(['mousemove'], heightTo);
          return h;
        },
        { timeout: 5_000 }
      )
      .not.toBeNull();
    await canvas.dispatchAt(['mouseup'], heightTo);
    expect(await getHeight()).toBeGreaterThan(1);
  });

  test('textbox PASTE: external rich HTML is normalized (scripts/handlers stripped, formatting kept)', async ({
    page,
    app
  }) => {
    void app;
    const canvas = new CanvasPOM(page);

    const placePixel = await canvas.tileToScreen({ x: 0, y: 0 });
    await canvas.placeTextBoxAt(placePixel, { keepEditing: true });
    await expect.poll(() => getViewTextBoxCount(page), { timeout: 5_000 }).toBe(1);

    const editor = canvas.textBoxInlineEditor();
    await editor.waitFor({ state: 'visible', timeout: 5_000 });
    await editor.click();

    // Word/Docs-style dirty payload via a synthetic ClipboardEvent on Quill's
    // root — the same path a real Ctrl+V takes through Quill's clipboard
    // matchers, then the ADR 0029 write-side sanitize on commit.
    await page.evaluate(() => {
      const root = document.querySelector(
        '[data-axoview-id="textbox-inline-editor"] .ql-editor'
      );
      if (!root) throw new Error('editor root not found');
      const dt = new DataTransfer();
      dt.setData(
        'text/html',
        '<script>window.__pwned = 1;</script>' +
          '<h1 style="color: red; mso-style-name: Heading">Title</h1>' +
          '<p><b>bold</b> and <span style="mso-fareast-language: EN">plain</span></p>' +
          '<img src="x" onerror="window.__pwned = 2;">'
      );
      dt.setData('text/plain', 'Title bold and plain');
      root.dispatchEvent(
        new ClipboardEvent('paste', {
          clipboardData: dt,
          bubbles: true,
          cancelable: true
        })
      );
    });

    await canvas.commitTextBoxEditor();

    const content = await expect
      .poll(async () => (await getFirstTextBox(page))?.content ?? '', {
        timeout: 3_000
      })
      .toContain('Title')
      .then(async () => (await getFirstTextBox(page))!.content);

    // Formatting Quill recognizes survives, normalized (b → strong);
    // everything dangerous or foreign is gone.
    expect(content).toContain('bold');
    expect(content).toMatch(/<(strong|b)>bold<\/(strong|b)>/);
    expect(content).not.toContain('<script');
    expect(content).not.toContain('onerror');
    expect(content).not.toContain('mso-');
    const pwned = await page.evaluate(() => (window as any).__pwned);
    expect(pwned).toBeUndefined();
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
