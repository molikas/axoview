/**
 * icons.spec.ts — Tier 1 J11 + J12.
 *
 * J11 (per docs/manual-test-baseline.md): add a custom icon → drag to
 * canvas → renders.
 * J12: remove a custom icon that's in use → warning surfaces, behaviour
 * matches expectations.
 *
 * Surface walkthrough (lib code paths):
 *   - The "Import icons" Button lives inside the LeftDock Elements panel's
 *     "Add more icons" Accordion (defaultExpanded={false}). The spec opens
 *     the panel via the elements toggle, expands the accordion by clicking
 *     the summary, then clicks the import button which fires a native file
 *     chooser on the hidden <input type="file" accept="image/*" multiple>.
 *   - SVG files take a fast path inside handleImportConfirm — the raw data
 *     URL is used unchanged (no canvas re-encode). Generating an SVG buffer
 *     in-test keeps the spec self-contained: no binary fixture, no Buffer
 *     vs Base64 PNG round-trip.
 *   - After the dialog confirm, the icon lands on model.icons with
 *     collection="imported". Icons in that collection render a hover-revealed
 *     × badge (Icon.tsx#showDelete) — the J12 leg drives it.
 *
 * Lazy data-axoview-id retrofits this spec (ALL lib-side — single rebuild
 * cycle required before running):
 *   - `dock-elements-import-icons` (ElementsPanel "Import icons" Button)
 *   - `dialog-import-icons-confirm` (ImportIconsDialog "Import" Button)
 *   - `dialog-delete-icon-confirm`  (DeleteIconConfirmDialog "Delete" Button)
 *   - `canvas-icon-grid-delete`     (Icon.tsx hover-revealed × badge)
 *
 * Delete-badge visibility: Icon.tsx renders the × at opacity 0.5 at rest
 * and 1 on hover/focus-within. Playwright treats opacity > 0 as visible,
 * so a plain `.click()` works — no `.hover()` priming needed.
 */
import { appTest as test, expect } from '../fixtures/app.fixture';
import { DialogsPOM } from '../pom/DialogsPOM';
import { byAxoviewId, byLibTestId } from '../helpers/selectors';
import {
  getModelItemCount,
  getViewItemCount,
  waitForDebugBridge
} from '../helpers/store';

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

// Distinctive name so a name-based grid lookup is unambiguous against the
// bundled fixture set (currently empty — see lib/fixtures/icons.ts — but a
// future pack-add shouldn't collide with this).
const IMPORTED_ICON_NAME = 'axoview-e2e-test-icon';

const TEST_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect x="2" y="2" width="28" height="28" fill="#2563eb" rx="4"/>
  <circle cx="16" cy="16" r="8" fill="#ffffff"/>
</svg>`;

async function pinOnboardingDismissed(page: import('@playwright/test').Page) {
  await page.addInitScript((flags: Array<[string, string]>) => {
    try {
      for (const [k, v] of flags) localStorage.setItem(k, v);
    } catch {
      /* localStorage may not be available pre-navigation */
    }
  }, ONBOARDING_DISMISS_FLAGS);
}

async function clearDiagramStorage(page: import('@playwright/test').Page) {
  await page.evaluate((keys: string[]) => {
    for (const k of keys) localStorage.removeItem(k);
    try {
      sessionStorage.clear();
    } catch {
      /* sessionStorage may be locked down */
    }
  }, LOCAL_STORAGE_KEYS);
}

async function bootBlankDiagram(page: import('@playwright/test').Page) {
  await clearDiagramStorage(page);
  await page.reload();
  const createBtn = byAxoviewId(page, 'screen-empty-create');
  await createBtn.waitFor({ state: 'visible', timeout: 10_000 });
  await createBtn.click();
  await byLibTestId(page, 'axoview-canvas').waitFor({ state: 'visible', timeout: 10_000 });
  await waitForDebugBridge(page);
}

async function openElementsPanel(page: import('@playwright/test').Page) {
  const elementsToggle = byAxoviewId(page, 'dock-elements-toggle');
  const gridItem = byAxoviewId(page, 'canvas-icon-grid-item').first();
  const gridVisible = await gridItem.isVisible().catch(() => false);
  if (!gridVisible) await elementsToggle.click();
  await gridItem.waitFor({ state: 'visible', timeout: 5_000 });
}

/**
 * Expands the "Add more icons" Accordion inside the Elements panel. The
 * import button + AI-prompt popover only render inside the expanded
 * AccordionDetails. The accordion has no data-axoview-id (no spec drives it
 * standalone), so we anchor on the import button itself: if it's already
 * visible, the accordion is already open; otherwise click the summary,
 * which we locate by the i18n English label "Add more icons".
 */
async function ensureAddMoreIconsExpanded(page: import('@playwright/test').Page) {
  const importBtn = byAxoviewId(page, 'dock-elements-import-icons');
  const visible = await importBtn.isVisible().catch(() => false);
  if (visible) return;
  await page.getByText('Add more icons', { exact: true }).click();
  await importBtn.waitFor({ state: 'visible', timeout: 3_000 });
}

/**
 * Drives the import-icons flow end-to-end: opens picker, feeds an SVG buffer,
 * confirms the dialog. Returns the icon name we imported so the caller can
 * assert on it.
 */
async function importTestIcon(page: import('@playwright/test').Page): Promise<string> {
  await openElementsPanel(page);
  await ensureAddMoreIconsExpanded(page);

  const importBtn = byAxoviewId(page, 'dock-elements-import-icons');
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser', { timeout: 5_000 }),
    importBtn.click()
  ]);
  await fileChooser.setFiles({
    name: `${IMPORTED_ICON_NAME}.svg`,
    mimeType: 'image/svg+xml',
    buffer: Buffer.from(TEST_SVG, 'utf8')
  });

  // ImportIconsDialog opens whenever pendingFiles.length > 0. Wait for its
  // confirm button to mount before clicking — the dialog uses MUI's portal
  // so it renders into document.body, not inside the LeftDock subtree.
  const dialogs = new DialogsPOM(page);
  await dialogs.importIconsConfirmButton().waitFor({ state: 'visible', timeout: 5_000 });
  await dialogs.confirmImportIcons();

  // The dialog closes by setting pendingFiles to []; wait for the model
  // store to reflect the new icon before returning. modelStore.icons grows
  // synchronously inside handleImportConfirm.
  await expect
    .poll(
      () =>
        page.evaluate(
          (name) =>
            (window as any).__axoview__.model
              .getState()
              .icons.filter((i: any) => i.name === name).length,
          IMPORTED_ICON_NAME
        ),
      { timeout: 5_000 }
    )
    .toBe(1);

  return IMPORTED_ICON_NAME;
}

/**
 * Returns the tile locator for the imported icon. We anchor on the inner
 * `<img alt="...">` so the lookup is name-based instead of ordinal — bundled
 * fixtures (lib/fixtures/icons.ts) may grow in the future without shifting
 * the imported tile's position.
 */
function importedIconTile(
  page: import('@playwright/test').Page,
  name = IMPORTED_ICON_NAME
) {
  return page
    .locator('[data-axoview-id="canvas-icon-grid-item"]')
    .filter({ has: page.locator(`img[alt="${name}"]`) });
}

interface CanvasPoint {
  x: number;
  y: number;
}

async function dragIconToCanvas(
  page: import('@playwright/test').Page,
  tile: import('@playwright/test').Locator,
  point: CanvasPoint
) {
  // Same pattern as smoke.spec.ts#placeIcon — step through page.mouse to
  // bypass MUI Tooltip's portaled subtree intercepting drag actionability
  // re-checks. Imported icons land at the bottom of the panel's scroll
  // container, often off-screen, so scroll the tile into view first; an
  // off-screen tile's boundingBox is still valid but mouse events at those
  // coords land on whatever element actually occupies the viewport pixel.
  await tile.scrollIntoViewIfNeeded();
  const canvas = byLibTestId(page, 'axoview-canvas');
  const tileBox = await tile.boundingBox();
  const canvasBox = await canvas.boundingBox();
  if (!tileBox || !canvasBox) throw new Error('dragIconToCanvas: missing bounding box');
  await page.mouse.move(tileBox.x + tileBox.width / 2, tileBox.y + tileBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + point.x, canvasBox.y + point.y, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(200);
}

test.describe('Custom icons — J11 + J12', () => {
  test.beforeEach(async ({ page, app }) => {
    void app;
    await pinOnboardingDismissed(page);
    await bootBlankDiagram(page);
  });

  test('J11: imports a custom icon and drops it on the canvas', async ({ page }) => {
    const iconName = await importTestIcon(page);

    // Tile is now in the imported section. Drag it onto the canvas.
    const tile = importedIconTile(page, iconName);
    await tile.first().waitFor({ state: 'visible', timeout: 5_000 });
    await dragIconToCanvas(page, tile.first(), { x: 380, y: 280 });

    // Model + view both gained an item; the model item's `icon` field
    // matches the imported icon's id.
    await expect.poll(() => getModelItemCount(page), { timeout: 5_000 }).toBe(1);
    await expect.poll(() => getViewItemCount(page), { timeout: 5_000 }).toBe(1);

    const iconRefMatches = await page.evaluate((name) => {
      const state = (window as any).__axoview__.model.getState();
      const importedIconId = state.icons.find((i: any) => i.name === name)?.id;
      if (!importedIconId) return false;
      return state.items.some((it: any) => it.icon === importedIconId);
    }, iconName);
    expect(iconRefMatches).toBe(true);
  });

  test('J12: deleting an in-use custom icon surfaces a usage warning and removes it', async ({ page }) => {
    const iconName = await importTestIcon(page);

    // Place the imported icon on the canvas so the usage scan has a hit.
    const tile = importedIconTile(page, iconName);
    await tile.first().waitFor({ state: 'visible', timeout: 5_000 });
    await dragIconToCanvas(page, tile.first(), { x: 380, y: 280 });
    await expect.poll(() => getModelItemCount(page), { timeout: 5_000 }).toBe(1);

    // Trigger the × badge on the tile. The badge sits at opacity 0.5 at
    // rest (Icon.tsx) — Playwright treats that as visible, so a plain
    // click resolves without `.hover()` priming.
    const deleteBadge = tile.first().locator('[data-axoview-id="canvas-icon-grid-delete"]');
    await deleteBadge.click();

    // ImportIconsDialog uses the model-level icons array; the usage scan
    // fallback (no iconUsageScan prop is injected in Local mode) counts
    // refs in currentItems only. The warning copy includes "In use by N
    // items across M diagrams" — assert the dialog rendered the warning
    // before confirming.
    const dialogs = new DialogsPOM(page);
    await dialogs.deleteIconConfirmButton().waitFor({ state: 'visible', timeout: 5_000 });
    await expect(page.getByText(/in use by\s+1\s+item/i)).toBeVisible();

    // Confirm. modelActions.set({ icons: filter(...) }) removes the icon;
    // the placed view item survives but its model item's `icon` ref now
    // resolves to a tombstone (see lib config DEFAULT_ICON comment).
    await dialogs.confirmDeleteIcon();

    // Post-delete: the icon is gone from model.icons.
    await expect
      .poll(
        () =>
          page.evaluate(
            (name) =>
              (window as any).__axoview__.model
                .getState()
                .icons.filter((i: any) => i.name === name).length,
            iconName
          ),
        { timeout: 5_000 }
      )
      .toBe(0);

    // ...and the placed item survives. (Tombstone behaviour is verified by
    // separate lib tests — this spec only asserts that delete doesn't cascade
    // through to view-item removal, which would be a regression against the
    // baseline's J12 expected behaviour.)
    expect(await getViewItemCount(page)).toBe(1);
  });
});
