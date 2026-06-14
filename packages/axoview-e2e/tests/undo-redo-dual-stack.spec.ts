/**
 * undo-redo-dual-stack.spec — ADR 0018 §5.1 P0 / behavior-map §4.5 (D-7).
 *
 * The dual-stack undo skew: undo/redo are TWO independent patch stacks (model +
 * scene). A model-only op (place icon) pushes a model entry but no scene entry,
 * so the stacks skew. Before the fix, a single Ctrl+Z after the hazardous order
 * `draw connector → place icon` popped the top of EACH stack — different logical
 * actions — leaving the connector in the model with no scene path (an invisible/
 * orphaned connector). The sequence-stamping fix makes one keystroke revert
 * exactly one logical action.
 *
 * Pairs with the unit guard undo.dualStackSkew.test.tsx (which drives the real
 * useHistory coordinator on real stores); this is the end-to-end repro.
 */
import { canvasReadyTest as test, expect } from '../fixtures/app.fixture';
import { CanvasPOM, CanvasPoint } from '../pom/CanvasPOM';
import { placeIconViaMouse } from '../helpers/place';
import {
  getModelConnectorCount,
  getModelItemCount,
  getUiMode
} from '../helpers/store';

const getUiModeType = async (page: import('@playwright/test').Page) =>
  (await getUiMode(page))?.type ?? null;

// True when every connector in the active view has a non-empty scene path — the
// coherence invariant. A connector present in the model with no scene path entry
// is the MQA #5 / D-7 invisible-connector symptom.
const connectorsCoherent = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const viewId = (window as any).__axoview__.ui.getState().view;
    const views = (window as any).__axoview__.model.getState().views;
    const view = views.find((v: any) => v.id === viewId) ?? views[0];
    const scene = (window as any).__axoview__.scene.getState();
    for (const c of view?.connectors ?? []) {
      const entry = scene.connectors?.[c.id];
      if (!entry || !entry.path || (entry.path.tiles ?? []).length === 0) {
        return false;
      }
    }
    return true;
  });

test.describe('Undo dual-stack skew — D-7 (ADR 0018)', () => {
  test('draw connector → place icon → undo leaves NO orphaned/invisible connector', async ({
    page,
    app
  }) => {
    void app;
    const canvas = new CanvasPOM(page);

    const ICON_A: CanvasPoint = { x: 380, y: 280 };
    const ICON_B: CanvasPoint = { x: 540, y: 360 };
    await placeIconViaMouse(page, ICON_A);
    await placeIconViaMouse(page, ICON_B);
    await expect.poll(() => getModelItemCount(page), { timeout: 5_000 }).toBe(2);

    // Logical action 1 — draw a connector A→B (writes BOTH stores).
    await page.keyboard.press('c');
    await expect.poll(() => getUiModeType(page), { timeout: 2_000 }).toBe(
      'CONNECTOR'
    );
    await canvas.clickAt(ICON_A);
    await page.waitForTimeout(100);
    await canvas.clickAt(ICON_B);
    await expect
      .poll(() => getModelConnectorCount(page), { timeout: 5_000 })
      .toBe(1);
    expect(await connectorsCoherent(page)).toBe(true);

    // Logical action 2 — place a third icon (MODEL-ONLY; scene no-op → skew).
    await placeIconViaMouse(page, { x: 460, y: 440 });
    await expect.poll(() => getModelItemCount(page), { timeout: 5_000 }).toBe(3);

    // One undo reverts ONLY the place-icon. The connector (action 1) must stay
    // coherent on BOTH stores — no orphaned path.
    await page.keyboard.press('Control+z');
    await expect.poll(() => getModelItemCount(page), { timeout: 5_000 }).toBe(2);
    expect(await getModelConnectorCount(page)).toBe(1);
    expect(await connectorsCoherent(page)).toBe(true);
  });
});
