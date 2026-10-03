/**
 * View rotation — ADR 0049 (camera & projection), 0050 (render), 0051 (page
 * default, viewers, export).
 *
 * Every pointer gesture here is addressed through the debug bridge's
 * `tileToScreen`, which projects at the LIVE angle — so these specs exercise
 * the same rotated projection the user sees, not a mirror of it. CI is
 * pixel-blind for the GPU look (canvas-rendering-guidelines §11); these pin the
 * GEOMETRY and the contracts: what a click picks, where a drag lands, what a
 * handle resizes, what a lasso encloses, which angle a page opens at, that a
 * viewer's rotation never dirties anything, and that an export honours the
 * chosen angle.
 */
import { test as baseTest, expect, Page } from '@playwright/test';
import { canvasReadyTest as test } from '../fixtures/app.fixture';
import { CanvasPOM, CanvasPoint } from '../pom/CanvasPOM';
import { byLibTestId } from '../helpers/selectors';
import { waitForDebugBridge } from '../helpers/store';

test.describe.configure({ timeout: 60_000 });

// A small inline isometric icon so the seed needs no icon pack.
const ICON_URL =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect x="8" y="8" width="48" height="48" fill="#3b82f6"/></svg>'
  );

const N1 = { x: 0, y: 0 };
const N2 = { x: 3, y: 0 };
const N3 = { x: 0, y: 4 };
const RECT = { from: { x: -5, y: -5 }, to: { x: -3, y: -3 } };

/** Seed three nodes and one rectangle on the active page. */
const seed = (page: Page) =>
  page.evaluate(
    (args: {
      icon: string;
      n1: CanvasPoint;
      n2: CanvasPoint;
      n3: CanvasPoint;
      rect: { from: CanvasPoint; to: CanvasPoint };
    }) => {
      const b = (window as any).__axoview__;
      const ui = b.ui.getState();
      const m = b.model.getState();
      const viewId = ui.view;
      const colorId = m.colors[0]?.id ?? 'e2e-color';
      const colors = m.colors.length
        ? m.colors
        : [{ id: colorId, value: '#a5b8f3' }];
      const icons = [
        ...m.icons,
        { id: 'e2e-iso', name: 'E2E', url: args.icon, isIsometric: true }
      ];
      const items = [
        ...m.items,
        { id: 'n1', name: 'One', icon: 'e2e-iso' },
        { id: 'n2', name: 'Two', icon: 'e2e-iso' },
        { id: 'n3', name: 'Three', icon: 'e2e-iso' }
      ];
      const views = m.views.map((v: any) =>
        v.id !== viewId
          ? v
          : {
              ...v,
              items: [
                { id: 'n1', tile: args.n1 },
                { id: 'n2', tile: args.n2 },
                { id: 'n3', tile: args.n3 }
              ],
              rectangles: [
                { id: 'r1', color: colorId, from: args.rect.from, to: args.rect.to }
              ],
              connectors: []
            }
      );
      m.actions.set({ icons, colors, items, views });
      b.changeView(viewId, b.model.getState());
      ui.actions.setCanvasMode('ISOMETRIC');
      ui.actions.setZoom(0.7);
      ui.actions.setScroll({ position: { x: 0, y: 0 }, offset: { x: 0, y: 0 } });
    },
    { icon: ICON_URL, n1: N1, n2: N2, n3: N3, rect: RECT }
  );

/** Put the view at an angle and wait for the settle rebuild. */
const rotateTo = async (page: Page, deg: number) => {
  await page.evaluate(
    (d: number) => (window as any).__axoview__.ui.getState().actions.jumpViewRotation(d),
    deg
  );
  await settled(page);
};

const settled = (page: Page) =>
  page.waitForFunction(() => {
    const ui = (window as any).__axoview__.ui.getState();
    const c = document.querySelector(
      '[data-testid="axoview-scene-canvas"]'
    ) as HTMLElement | null;
    return (
      !ui.viewRotationInMotion &&
      ui.viewRotation === ui.viewRotationBase &&
      c?.dataset.motionDeg === '0'
    );
  });

/** Renderer-relative point a tile is drawn at, at the LIVE angle. */
const at = (page: Page, tile: CanvasPoint): Promise<CanvasPoint> =>
  page.evaluate(
    (t: CanvasPoint) => (window as any).__axoview__.tileToScreen(t),
    tile
  );

const ui = <T>(page: Page, fn: string): Promise<T> =>
  page.evaluate((f: string) => {
    const s = (window as any).__axoview__.ui.getState();
    return f.split('.').reduce((o: any, k) => (o == null ? o : o[k]), s);
  }, fn);

const viewItemTile = (page: Page, id: string) =>
  page.evaluate((itemId: string) => {
    const b = (window as any).__axoview__;
    const viewId = b.ui.getState().view;
    const v = b.model.getState().views.find((x: any) => x.id === viewId);
    return v.items.find((i: any) => i.id === itemId)?.tile ?? null;
  }, id);

/**
 * A drag that ENDS on its target. Modes read the store snapshot taken before
 * the manager writes an event's pointer sample, so they see the PREVIOUS sample
 * (the one-sample lag CanvasPOM.dragFromTo's callers work around). Repeating
 * the last move makes the lagged sample the release point itself.
 */
const dragOnto = async (canvas: CanvasPOM, from: CanvasPoint, to: CanvasPoint) => {
  const lerp = (t: number) => ({
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t
  });
  await canvas.dispatchAt(['mousemove'], from);
  await canvas.dispatchAt(['mousemove'], from);
  await canvas.dispatchAt(['mousedown'], from);
  for (const t of [0.33, 0.66, 1, 1]) {
    await canvas.dispatchAt(['mousemove'], lerp(t));
  }
  await canvas.dispatchAt(['mouseup'], to);
};

/** The MAIN instance's live angle, from its dock readout ("37°"). */
const readoutDeg = async (page: Page) =>
  Number(
    (
      (await page
        .locator('[data-axoview-id="view-rotation-readout"]')
        .textContent()) ?? ''
    ).replace('°', '')
  );

/** Synthetic pointer sequence WITH modifiers (CanvasPOM's has none). */
const dispatchWith = (
  page: Page,
  steps: Array<{ type: 'mousedown' | 'mousemove' | 'mouseup'; at: CanvasPoint }>,
  mods: { altKey?: boolean; shiftKey?: boolean }
) =>
  page.locator('[data-axoview-id="canvas-interactions"]').evaluate(
    async (el, args: { steps: typeof steps; mods: typeof mods }) => {
      const rect = el.getBoundingClientRect();
      const raf = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
      const map: Record<string, string> = {
        mousedown: 'pointerdown',
        mousemove: 'pointermove',
        mouseup: 'pointerup'
      };
      for (const s of args.steps) {
        el.dispatchEvent(
          new PointerEvent(map[s.type], {
            bubbles: true,
            cancelable: true,
            clientX: rect.left + s.at.x,
            clientY: rect.top + s.at.y,
            button: 0,
            buttons: s.type === 'mouseup' ? 0 : 1,
            pointerId: 1,
            pointerType: 'mouse',
            isPrimary: true,
            altKey: !!args.mods.altKey,
            shiftKey: !!args.mods.shiftKey
          })
        );
        await raf();
      }
    },
    { steps, mods }
  );

test.describe('View rotation — rotated interaction (ADR 0049)', () => {
  for (const deg of [37, 90]) {
    test(`click-select picks the node drawn under the pointer at ${deg}°`, async ({
      page,
      app
    }) => {
      void app;
      const canvas = new CanvasPOM(page);
      await seed(page);
      await rotateTo(page, deg);
      for (const [id, tile] of [
        ['n2', N2],
        ['n3', N3]
      ] as const) {
        await canvas.clickAt(await at(page, tile));
        await expect
          .poll(() => ui<{ id: string } | null>(page, 'itemControls'))
          .toMatchObject({ type: 'ITEM', id });
      }
    });

    test(`drag moves a node to the tile under the release point at ${deg}°`, async ({
      page,
      app
    }) => {
      void app;
      const canvas = new CanvasPOM(page);
      await seed(page);
      await rotateTo(page, deg);
      const target = { x: 5, y: 2 };
      await dragOnto(canvas, await at(page, N2), await at(page, target));
      await expect.poll(() => viewItemTile(page, 'n2')).toEqual(target);
    });

    test(`a rectangle corner handle resizes toward the rotated pointer at ${deg}°`, async ({
      page,
      app
    }) => {
      void app;
      const canvas = new CanvasPOM(page);
      await seed(page);
      await rotateTo(page, deg);
      // The anchor press itself is the TransformAnchor DOM control (covered by
      // rectangle-move-resize.spec at 0°); what rotation changes is where the
      // pointer maps, so drive the transform mode from the bridge and resolve
      // the release point at the live angle.
      await page.evaluate(() => {
        const s = (window as any).__axoview__.ui.getState();
        s.actions.setItemControls({ type: 'RECTANGLE', id: 'r1' });
        s.actions.setMode({
          type: 'RECTANGLE.TRANSFORM',
          id: 'r1',
          selectedAnchor: 'BOTTOM_RIGHT',
          showCursor: true
        });
      });
      const target = { x: -1, y: -6 };
      const p = await at(page, target);
      // Twice: see dragOnto — the second move carries the target as the
      // sample the mode reads.
      await canvas.dispatchAt(['mousemove'], p);
      await canvas.dispatchAt(['mousemove'], p);
      await canvas.dispatchAt(['mouseup'], p);
      const rect = await page.evaluate(() => {
        const b = (window as any).__axoview__;
        const v = b.model
          .getState()
          .views.find((x: any) => x.id === b.ui.getState().view);
        return v.rectangles.find((r: any) => r.id === 'r1');
      });
      const xs = [rect.from.x, rect.to.x];
      const ys = [rect.from.y, rect.to.y];
      expect(Math.max(...xs)).toBe(target.x);
      expect(Math.min(...ys)).toBe(target.y);
    });

    test(`lasso selects what it visibly encloses at ${deg}°`, async ({
      page,
      app
    }) => {
      void app;
      const canvas = new CanvasPOM(page);
      await seed(page);
      await rotateTo(page, deg);
      await page.keyboard.press('l');
      const p1 = await at(page, N1);
      const p2 = await at(page, N2);
      const pad = 45;
      const from = { x: Math.min(p1.x, p2.x) - pad, y: Math.min(p1.y, p2.y) - pad };
      const to = { x: Math.max(p1.x, p2.x) + pad, y: Math.max(p1.y, p2.y) + pad };
      await dragOnto(canvas, from, to);
      const ids = (await ui<Array<{ id: string }>>(page, 'selectedIds')).map(
        (r) => r.id
      );
      expect(ids).toEqual(expect.arrayContaining(['n1', 'n2']));
      expect(ids).not.toContain('n3');
    });
  }

  test('Alt + drag orbits the view; nothing moves and the model is untouched', async ({
    page,
    app
  }) => {
    void app;
    await seed(page);
    await rotateTo(page, 0);
    const modelBefore = await page.evaluate(() =>
      JSON.stringify((window as any).__axoview__.model.getState().views)
    );
    const start = { x: 120, y: 120 }; // empty canvas, far from the content
    await dispatchWith(
      page,
      [
        { type: 'mousedown', at: start },
        { type: 'mousemove', at: { x: start.x + 20, y: start.y } },
        { type: 'mousemove', at: { x: start.x + 60, y: start.y } },
        { type: 'mousemove', at: { x: start.x + 100, y: start.y } },
        { type: 'mouseup', at: { x: start.x + 100, y: start.y } }
      ],
      { altKey: true }
    );
    await settled(page);
    const rotation = await ui<number>(page, 'viewRotation');
    expect(rotation).toBeCloseTo(40, 0); // ≈ 0.4° per horizontal px
    expect(await ui<string>(page, 'mode.type')).toBe('CURSOR');
    const modelAfter = await page.evaluate(() =>
      JSON.stringify((window as any).__axoview__.model.getState().views)
    );
    expect(modelAfter).toBe(modelBefore);
  });

  test('Shift during an Alt + drag snaps to 15°', async ({ page, app }) => {
    void app;
    await seed(page);
    await rotateTo(page, 0);
    const start = { x: 120, y: 120 };
    await dispatchWith(
      page,
      [
        { type: 'mousedown', at: start },
        { type: 'mousemove', at: { x: start.x + 30, y: start.y } },
        { type: 'mousemove', at: { x: start.x + 88, y: start.y } },
        { type: 'mouseup', at: { x: start.x + 88, y: start.y } }
      ],
      { altKey: true, shiftKey: true }
    );
    await settled(page);
    expect(await ui<number>(page, 'viewRotation')).toBe(30);
  });

  test('Alt + click still removes a connector waypoint (ADR 0022 §1)', async ({
    page,
    app
  }) => {
    void app;
    await seed(page);
    // A connector n1 → n3 bent through a free waypoint.
    await page.evaluate(() => {
      const b = (window as any).__axoview__;
      const m = b.model.getState();
      const viewId = b.ui.getState().view;
      const colorId = m.colors[0].id;
      m.actions.set({
        views: m.views.map((v: any) =>
          v.id !== viewId
            ? v
            : {
                ...v,
                connectors: [
                  {
                    id: 'c1',
                    color: colorId,
                    anchors: [
                      { id: 'a1', ref: { item: 'n1' } },
                      { id: 'a2', ref: { tile: { x: 4, y: 4 } } },
                      { id: 'a3', ref: { item: 'n3' } }
                    ]
                  }
                ]
              }
        )
      });
      b.changeView(viewId, b.model.getState());
    });
    await rotateTo(page, 37);
    const anchors = () =>
      page.evaluate(() => {
        const b = (window as any).__axoview__;
        const v = b.model
          .getState()
          .views.find((x: any) => x.id === b.ui.getState().view);
        return v.connectors[0].anchors.length as number;
      });
    expect(await anchors()).toBe(3);
    const p = await at(page, { x: 4, y: 4 });
    await dispatchWith(
      page,
      [
        { type: 'mousemove', at: p },
        { type: 'mousedown', at: p },
        { type: 'mouseup', at: p }
      ],
      { altKey: true }
    );
    await expect.poll(anchors).toBe(2);
    // And the press did not turn the view.
    expect(await ui<number>(page, 'viewRotation')).toBe(37);
  });

  test('Q / E step the view; the dock readout returns it to the page default', async ({
    page,
    app
  }) => {
    void app;
    await seed(page);
    await rotateTo(page, 0);
    await page.keyboard.press('q');
    await settled(page);
    expect(await ui<number>(page, 'viewRotation')).toBe(15);
    await page.keyboard.press('Shift+E');
    await settled(page);
    expect(await ui<number>(page, 'viewRotation')).toBe(0);
    await page.keyboard.press('e');
    await settled(page);
    expect(await ui<number>(page, 'viewRotation')).toBe(-15);

    // The readout is a button back to the page default (0° here).
    await page.locator('[data-axoview-id="view-rotation-readout"]').click();
    await settled(page);
    expect(await ui<number>(page, 'viewRotation')).toBe(0);
  });

  test('"Set as page default" is one undoable edit; rotating alone is not an edit', async ({
    page,
    app
  }) => {
    void app;
    await seed(page);
    await rotateTo(page, 0);
    const defaultRotation = () =>
      page.evaluate(() => {
        const b = (window as any).__axoview__;
        return (
          b.model.getState().views.find((v: any) => v.id === b.ui.getState().view)
            ?.defaultRotation ?? null
        );
      });
    // No set-default control while the angle IS the default.
    await expect(
      page.locator('[data-axoview-id="view-rotation-set-default"]')
    ).toHaveCount(0);
    await page.locator('[data-axoview-id="view-rotation-ccw"]').click();
    await settled(page);
    expect(await defaultRotation()).toBeNull();

    await page.locator('[data-axoview-id="view-rotation-set-default"]').click();
    await expect.poll(defaultRotation).toBe(15);

    await page.keyboard.press('Control+z');
    await expect.poll(defaultRotation).toBeNull();
    // Undo restored the document, not the camera.
    expect(await ui<number>(page, 'viewRotation')).toBe(15);
  });

  test('2D: the controls are disabled and Q does nothing', async ({ page, app }) => {
    void app;
    await seed(page);
    await page.evaluate(() =>
      (window as any).__axoview__.ui.getState().actions.setCanvasMode('2D')
    );
    await expect(
      page.locator('[data-axoview-id="view-rotation-ccw"]')
    ).toBeDisabled();
    await page.keyboard.press('q');
    await page.waitForTimeout(300);
    expect(await ui<number>(page, 'viewRotation')).toBe(0);
  });
});

test.describe('View rotation — export (ADR 0051 §5)', () => {
  test('an export at θ ≠ default offers both angles, and the two images differ', async ({
    page,
    app
  }) => {
    void app;
    await seed(page);
    await rotateTo(page, 45);
    await page.evaluate(() =>
      (window as any).__axoview__.ui.getState().actions.setDialog('EXPORT_IMAGE')
    );
    const preview = page.locator('img[alt="preview"]');
    await preview.waitFor({ state: 'visible', timeout: 20_000 });
    const asViewed = await preview.getAttribute('src');
    expect(asViewed).toBeTruthy();

    await page.locator('[data-testid="export-angle-page-default"]').click();
    await expect
      .poll(async () => {
        const src = await preview.getAttribute('src').catch(() => null);
        return src && src !== asViewed ? 'changed' : 'same';
      }, { timeout: 20_000 })
      .toBe('changed');
    // Exporting never moved the live canvas's angle (two instances, F1). Read
    // from the MAIN dock: the hidden export instance installs its own
    // window.__axoview__ in dev builds, so the bridge points at IT now.
    expect(await readoutDeg(page)).toBe(45);
  });

  test('no angle choice when the view is at the page default', async ({
    page,
    app
  }) => {
    void app;
    await seed(page);
    await rotateTo(page, 0);
    await page.evaluate(() =>
      (window as any).__axoview__.ui.getState().actions.setDialog('EXPORT_IMAGE')
    );
    await page
      .locator('img[alt="preview"]')
      .waitFor({ state: 'visible', timeout: 20_000 });
    await expect(page.locator('[data-testid="export-angle-page-default"]')).toHaveCount(0);
  });
});

// ─── Display route (ADR 0051 §3–§4): opens at the page default; a viewer's
// rotation is local and never dirties or saves anything. Mocked like
// drive-display.spec.ts (config + the Drive read-proxy rung).
const DRIVE_FILE_ID = 'drive-file-rotation-e2e';

const blobWithDefault = (defaultRotation: number) => ({
  title: 'RotatedShare',
  name: 'RotatedShare',
  icons: [{ id: 'e2e-iso', name: 'E2E', url: ICON_URL, isIsometric: true }],
  colors: [{ id: 'c1', value: '#a5b8f3' }],
  items: [{ id: 'n1', name: 'One', icon: 'e2e-iso' }],
  views: [
    {
      id: 'view_rot',
      name: 'Main',
      defaultRotation,
      items: [{ id: 'n1', tile: { x: 0, y: 0 } }],
      connectors: [],
      rectangles: [],
      textBoxes: [],
      layers: []
    }
  ],
  fitToScreen: true
});

baseTest.describe('View rotation — display route (ADR 0051)', () => {
  baseTest('opens at the page default; a viewer rotates with no dirty state and no write', async ({
    page
  }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('axoview-lazy-loading-welcome-dismissed', 'true');
        localStorage.setItem('axoview-show-drag-hint', 'false');
      } catch {
        /* pre-navigation */
      }
    });
    await page.route('**/api/config', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          serverStorage: false,
          authMode: 'none',
          googleClientId: null,
          drivePublicPreview: true,
          googleProjectNumber: null
        })
      })
    );
    await page.route('**/api/public/drive/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(blobWithDefault(90))
      })
    );
    const writes: string[] = [];
    page.on('request', (req) => {
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method())) {
        writes.push(`${req.method()} ${req.url()}`);
      }
    });

    await page.goto(`/app/display/drive/${DRIVE_FILE_ID}`);
    await byLibTestId(page, 'axoview-canvas').waitFor({ state: 'visible', timeout: 15_000 });
    await waitForDebugBridge(page);
    await expect.poll(() => ui<string>(page, 'editorMode')).toBe('EXPLORABLE_READONLY');
    await expect.poll(() => ui<number>(page, 'viewRotation')).toBe(90);

    const modelBefore = await page.evaluate(() =>
      JSON.stringify((window as any).__axoview__.model.getState().views)
    );
    // The viewer turns the view with the keys...
    await page.locator('[data-testid="axoview-canvas"]').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('q');
    await expect.poll(() => ui<number>(page, 'viewRotation')).toBe(105);
    // ...and the viewer's dock has no "set as page default".
    await expect(
      page.locator('[data-axoview-id="view-rotation-set-default"]')
    ).toHaveCount(0);

    await page.waitForTimeout(500);
    const modelAfter = await page.evaluate(() =>
      JSON.stringify((window as any).__axoview__.model.getState().views)
    );
    expect(modelAfter).toBe(modelBefore);
    expect(await ui<boolean>(page, 'isDirty')).toBe(false);
    expect(writes).toEqual([]);
  });
});
