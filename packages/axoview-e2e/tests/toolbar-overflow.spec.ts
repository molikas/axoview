/**
 * toolbar-overflow.spec.ts — F1 (ADR 0005 overflow amendment, 2026-07-03).
 *
 * The top toolbar's right cluster holds four groups (ADR 0005): the style
 * strip (Group 1) plus Save / document actions / sidebar toggle (Groups 2–4).
 * Before F1 the whole cluster was `flexShrink: 0`, so below ~1024px the
 * Present / Share / sidebar-toggle buttons clipped off-screen. The fix makes
 * the STRIP SLOT the one compressible group (`minWidth: 0; overflow-x: auto`)
 * — it scrolls internally under pressure while Groups 2–4 keep their natural
 * width and stay reachable at any viewport width.
 *
 * This spec is the breakpoint verification the productization plan asked for
 * ("Measure the breakpoint first … guarantee Group 3 + Group 4 always
 * reachable. Verify ≤1024px"): it walks the viewport down through the old
 * clipping range and asserts reachability at every step.
 *
 * Lazy data-axoview-id retrofits — `toolbar-style-slot` + `toolbar-sidebar-slot`
 * (app, AppToolbar.tsx, landed with F1).
 */
import { canvasReadyTest as test, expect } from '../fixtures/app.fixture';
import { byAxoviewId } from '../helpers/selectors';

// 1280 = comfortable; 1024 = the documented clipping threshold; 900/800 =
// well inside the old failure range.
const WIDTHS = [1280, 1024, 900, 800];

// Group 3 (Share / Present) + Group 4 (sidebar-toggle slot) — the controls
// ADR 0005's F1 clause guarantees are always reachable.
const MUST_REACH = ['toolbar-share', 'toolbar-preview', 'toolbar-sidebar-slot'];

test.describe('Toolbar overflow — F1 (ADR 0005 amendment)', () => {
  test('Groups 3+4 stay reachable at every width; the style slot absorbs the squeeze by scrolling', async ({
    page,
    app
  }) => {
    void app;

    // Natural (unsqueezed) slot width at the widest viewport — the reference
    // that proves the squeeze mechanism engages at narrow widths.
    await page.setViewportSize({ width: WIDTHS[0], height: 720 });
    const slot = byAxoviewId(page, 'toolbar-style-slot');
    await expect(slot).toBeVisible();
    const naturalWidth = await slot.evaluate((el) => el.clientWidth);

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 720 });

      for (const id of MUST_REACH) {
        const el = byAxoviewId(page, id);
        await expect(el, `${id} at ${width}px`).toBeVisible();
        const box = await el.boundingBox();
        expect(box, `${id} bounding box at ${width}px`).not.toBeNull();
        expect(
          box!.x,
          `${id} left edge on-screen at ${width}px`
        ).toBeGreaterThanOrEqual(0);
        expect(
          box!.x + box!.width,
          `${id} right edge on-screen at ${width}px`
        ).toBeLessThanOrEqual(width + 0.5);
      }

      const metrics = await slot.evaluate((el) => ({
        clientWidth: el.clientWidth,
        scrollWidth: el.scrollWidth,
        overflowX: getComputedStyle(el).overflowX
      }));
      expect(metrics.overflowX, `slot overflow-x at ${width}px`).toBe('auto');
      // The strip's full content stays reachable via scroll — never clipped
      // away (scrollWidth carries the natural content width).
      expect(metrics.scrollWidth).toBeGreaterThanOrEqual(metrics.clientWidth);
    }

    // At the narrowest width the slot must actually have compressed (the
    // squeeze lands on the strip, not on Groups 2–4).
    const squeezed = await slot.evaluate((el) => el.clientWidth);
    expect(squeezed).toBeLessThan(naturalWidth);
  });
});
