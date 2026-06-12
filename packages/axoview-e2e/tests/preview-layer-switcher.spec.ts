/**
 * preview-layer-switcher.spec.ts — Thread B (ADR 0013).
 *
 * The preview-mode layer switcher is a bottom-left overlay shown only in
 * EXPLORABLE_READONLY with ≥2 layers. Its toggles are a UI-only override
 * (uiState.previewLayerOverrides) that must NEVER mutate the model's
 * layer.visible, never dirty the diagram, and clear when leaving preview.
 *
 * The app drives editorMode from a prop and only re-syncs when the prop
 * changes, so forcing EXPLORABLE_READONLY via the debug bridge sticks — the
 * realistic way to exercise the lib surface without a readonly share URL.
 */
import { appTest as test, expect } from '../fixtures/app.fixture';
import { LayersPanelPOM } from '../pom/LayersPanelPOM';
import { byAxoviewId, byLibTestId } from '../helpers/selectors';
import { waitForDebugBridge } from '../helpers/store';

type Page = import('@playwright/test').Page;

const LOCAL_STORAGE_KEYS = [
  'axoview-diagrams',
  'axoview-last-opened',
  'axoview-last-opened-data',
  'axoview-explorer-initialized',
  'axoview-explorer-open'
];

const ONBOARDING_DISMISS_FLAGS: Array<[string, string]> = [
  ['axoview-lazy-loading-welcome-dismissed', 'true'],
  ['axoview-show-drag-hint', 'false']
];

async function pinOnboardingDismissed(page: Page) {
  await page.addInitScript((flags: Array<[string, string]>) => {
    try {
      for (const [k, v] of flags) localStorage.setItem(k, v);
    } catch {
      /* localStorage may not be available pre-navigation */
    }
  }, ONBOARDING_DISMISS_FLAGS);
}

async function bootBlankDiagram(page: Page) {
  await page.evaluate((keys: string[]) => {
    for (const k of keys) localStorage.removeItem(k);
  }, LOCAL_STORAGE_KEYS);
  await page.reload();
  const createBtn = byAxoviewId(page, 'screen-empty-create');
  await createBtn.waitFor({ state: 'visible', timeout: 10_000 });
  await createBtn.click();
  await byLibTestId(page, 'axoview-canvas').waitFor({ state: 'visible', timeout: 10_000 });
  await waitForDebugBridge(page);
}

const setEditorMode = (page: Page, mode: string): Promise<void> =>
  page.evaluate((m: string) => {
    (window as any).__axoview__.ui.getState().actions.setEditorMode(m);
  }, mode);

const getOverrides = (
  page: Page
): Promise<{ hiddenLayerIds: string[]; soloLayerId: string | null }> =>
  page.evaluate(
    () => (window as any).__axoview__.ui.getState().previewLayerOverrides
  );

const getIsDirty = (page: Page): Promise<boolean> =>
  page.evaluate(() => !!(window as any).__axoview__.ui.getState().isDirty);

/** Visibility flags of the active view's layers (model truth). */
const getModelLayerVisibility = (page: Page): Promise<boolean[]> =>
  page.evaluate(() => {
    const viewId = (window as any).__axoview__.ui.getState().view;
    const views = (window as any).__axoview__.model.getState().views;
    const view = (viewId && views.find((v: any) => v.id === viewId)) ?? views[0];
    return (view?.layers ?? []).map((l: any) => l.visible);
  });

const getLayerCount = (page: Page): Promise<number> =>
  page.evaluate(() => {
    const viewId = (window as any).__axoview__.ui.getState().view;
    const views = (window as any).__axoview__.model.getState().views;
    const view = (viewId && views.find((v: any) => v.id === viewId)) ?? views[0];
    return (view?.layers ?? []).length;
  });

test.describe('Preview layer switcher — Thread B (ADR 0013)', () => {
  test.beforeEach(async ({ page, app }) => {
    void app;
    await pinOnboardingDismissed(page);
    await bootBlankDiagram(page);
  });

  test('renders only in view mode with ≥2 layers; toggle + solo are UI-only and non-dirty', async ({
    page
  }) => {
    const switcher = byAxoviewId(page, 'preview-layer-switcher');

    // Not shown in edit mode.
    await expect(switcher).toHaveCount(0);

    // Create two layers via the Layers panel (edit chrome).
    const layers = new LayersPanelPOM(page);
    await layers.open();
    await layers.addLayer();
    await layers.addLayer();
    await expect.poll(() => getLayerCount(page), { timeout: 3_000 }).toBeGreaterThanOrEqual(2);

    const layerCount = await getLayerCount(page);
    const visibilityBefore = await getModelLayerVisibility(page);

    // Enter preview — the switcher appears with one row per layer.
    await setEditorMode(page, 'EXPLORABLE_READONLY');
    await expect(switcher).toBeVisible();
    await expect(switcher.locator('[data-axoview-id="preview-layer-row"]')).toHaveCount(
      layerCount
    );

    // Baseline dirty state on entering preview (adding layers in edit mode
    // legitimately dirtied the model — that is unrelated to the override).
    // The invariant under test: the preview toggle/solo must not CHANGE it.
    const dirtyInPreview = await getIsDirty(page);

    // Toggle the first layer's visibility → recorded in the UI override only.
    await switcher
      .locator('[data-axoview-id="preview-layer-toggle-visibility"]')
      .first()
      .click();
    await expect
      .poll(() => getOverrides(page).then((o) => o.hiddenLayerIds.length), {
        timeout: 3_000
      })
      .toBe(1);
    // Model layer.visible is untouched; the toggle did not change dirtiness.
    expect(await getModelLayerVisibility(page)).toEqual(visibilityBefore);
    expect(await getIsDirty(page)).toBe(dirtyInPreview);

    // Solo the second layer → override switches to solo; still UI-only.
    const soloButtons = switcher.locator('[data-axoview-id="preview-layer-solo"]');
    await soloButtons.nth(1).click();
    await expect
      .poll(() => getOverrides(page).then((o) => o.soloLayerId), { timeout: 3_000 })
      .not.toBeNull();
    await expect(soloButtons.nth(1)).toHaveAttribute('aria-pressed', 'true');
    expect(await getModelLayerVisibility(page)).toEqual(visibilityBefore);
    expect(await getIsDirty(page)).toBe(dirtyInPreview);

    // Leaving preview clears the ephemeral override.
    await setEditorMode(page, 'EDITABLE');
    expect(await getOverrides(page)).toEqual({
      hiddenLayerIds: [],
      soloLayerId: null
    });
    await expect(switcher).toHaveCount(0);
  });
});
