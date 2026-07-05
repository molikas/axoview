/**
 * element-link-card.spec.ts — Ctrl+K consistency for PLAIN-TEXT labels
 * (ADR 0034 addendum 2026-07-05).
 *
 *   - Inline-renaming a floating Label + Ctrl+K opens the INLINE element
 *     link card (not the strip popover); Enter applies the element
 *     headerLink with Docs URL-forgiveness.
 *   - The strip's element-mode Link popover confirms + closes on Enter
 *     (owner: users typed a URL and didn't know click-away was the commit).
 *
 * Node-name and connector-label renames share the same dispatch/card path —
 * the Label flow is the representative e2e; the others are manual-verify.
 *
 * Lazy data-axoview-id retrofits: `element-link-card` / `-input` / `-url`
 * (ElementLinkCard.tsx).
 */
import { canvasReadyTest as test, expect } from '../fixtures/app.fixture';
import { CanvasPOM } from '../pom/CanvasPOM';

const getFirstLabel = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const ui = (window as any).__axoview__.ui.getState();
    const views = (window as any).__axoview__.model.getState().views;
    const view = views.find((v: any) => v.id === ui.view) ?? views[0];
    const label = (view?.labels ?? [])[0];
    if (!label) return null;
    return { id: label.id, headerLink: label.headerLink ?? null };
  });

test.describe('Element link card + strip Enter-confirm (ADR 0034 addendum)', () => {
  test('floating Label: Ctrl+K mid-rename opens the inline card; Enter applies headerLink', async ({
    page,
    app
  }) => {
    void app;
    const canvas = new CanvasPOM(page);

    const placePixel = await canvas.tileToScreen({ x: 2, y: 2 });
    await canvas.placeLabelAt(placePixel);
    await expect
      .poll(async () => Boolean(await getFirstLabel(page)), { timeout: 5_000 })
      .toBe(true);
    const label = (await getFirstLabel(page))!;

    // Enter the inline rename the way double-click does (store-armed — the
    // canvas chip hit-proxy is pixel-sensitive under the synthetic pointer).
    await page.evaluate((id) => {
      const actions = (window as any).__axoview__.ui.getState().actions;
      actions.setItemControls({ type: 'LABEL', id }, { openPanel: false });
      actions.setInlineEditLabelId(id);
    }, label.id);
    const editor = page.locator('[data-testid="label-inline-editor"]');
    await editor.waitFor({ state: 'visible', timeout: 5_000 });
    await editor.click();

    // Ctrl+K → the INLINE element card (the strip popover stays closed).
    await page.keyboard.press('Control+k');
    const cardInput = page.locator(
      '[data-axoview-id="element-link-card-input"] input'
    );
    await cardInput.waitFor({ state: 'visible', timeout: 5_000 });
    await expect(
      page.locator('[data-axoview-id="strip-link-input"]')
    ).toBeHidden();

    // Bare domain applies Docs-forgiven; the view chip confirms.
    await cardInput.fill('example.com');
    await cardInput.press('Enter');
    await expect(
      page.locator('[data-axoview-id="element-link-card-url"]')
    ).toHaveText('https://example.com');
    await expect
      .poll(async () => (await getFirstLabel(page))!.headerLink, {
        timeout: 3_000
      })
      .toBe('https://example.com');
  });

  test('strip Link popover (element mode): Enter confirms and closes', async ({
    page,
    app
  }) => {
    void app;
    const canvas = new CanvasPOM(page);

    const placePixel = await canvas.tileToScreen({ x: 2, y: 2 });
    await canvas.placeLabelAt(placePixel);
    await expect
      .poll(async () => Boolean(await getFirstLabel(page)), { timeout: 5_000 })
      .toBe(true);
    const label = (await getFirstLabel(page))!;
    await page.evaluate((id) => {
      (window as any).__axoview__.ui
        .getState()
        .actions.setItemControls({ type: 'LABEL', id });
    }, label.id);

    await page.getByTestId('strip-link-button').click();
    const urlField = page.locator('[data-axoview-id="strip-link-input"] input');
    await urlField.waitFor({ state: 'visible', timeout: 5_000 });
    await urlField.fill('www.somelink.com');
    await urlField.press('Enter');

    // Enter = confirm: the popover closes and the live-written link stays.
    await expect(
      page.locator('[data-axoview-id="strip-link-input"]')
    ).toBeHidden({ timeout: 3_000 });
    expect((await getFirstLabel(page))!.headerLink).toBe('www.somelink.com');
  });
});
