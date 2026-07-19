/**
 * multi-diagram.spec.ts — Tier 1 J5.
 *
 * J5 (per docs/manual-test-baseline.md): create A, link a node to diagram B,
 * click link → opens B. The baseline filed five separate findings here
 * (#1–#4 → B-1 fix, #2 → B-2 fix); this spec asserts the post-fix contracts
 * so a future regression on either landing fails CI rather than user testing.
 *
 * Sub-tests (5):
 *   J5.1 — Self-reference filter (B-2): the link picker for DiagramA never
 *          lists DiagramA as an option, only DiagramB. App.tsx already filters
 *          `linkedDiagrams.filter(d => d.id !== currentId)` so the assertion
 *          is on the visible Autocomplete options.
 *   J5.2 — Edit-mode preview (B-1): select a linked item → click the
 *          open-linked-diagram IconButton → editor swaps onto DiagramB via
 *          the `axoview-open-diagram-in-editor` custom event (no URL change).
 *   J5.3 — Readonly link from NodePanel (B-1): enter readonly mode via the
 *          Preview toolbar button → click the linked-diagram link in the
 *          readonly NodePanel → navigates to `/display/<linkedDiagramId>`
 *          and renders the linked diagram read-only.
 *   J5.4 — Back-to-editing button (B-1 surface): from the editor → Preview →
 *          assert Back-to-editing visible on the readonly toolbar → click →
 *          returns to the editor route (history goes back one entry).
 *   J5.5 — Properties panel clears on diagram load (B-1 surface): select an
 *          item on DiagramA → the node deck renders → swap to DiagramB via the
 *          open-linked-diagram event → the deck unmounts (the old
 *          itemControls reference is invalidated by the load).
 *
 * Setup approach — sessionStorage seeding:
 *   The LocalStorageProvider stores diagrams in sessionStorage:
 *     - `axoview_diagrams`       — DiagramMeta[] index
 *     - `axoview_diagram_<id>`   — per-diagram blob (items/views/colors/icons)
 *   DiagramLifecycleProvider's boot picks its initial diagramData from
 *   `localStorage.axoview-last-opened-data`, and its initial currentDiagram
 *   from `localStorage.axoview-last-opened`. Seeding both layers via
 *   addInitScript lets us boot directly onto DiagramA with the linked item
 *   in place, avoiding multi-step UI dance through SaveDialog/New flows.
 *
 *   The seeded model item carries `link: <DiagramB-id>` so the Autocomplete
 *   picker shows DiagramB as the selected value AND the open-linked
 *   IconButton is rendered from the start — both B-1/B-2 contracts can be
 *   asserted without first driving an Autocomplete pick (which would
 *   double-test the picker rather than the fix surface).
 *
 * Lazy data-axoview-id retrofits this spec:
 *   - LIB: `strip-link-diagram-picker`  (TopBarStyleControls.tsx strip Link Autocomplete input)
 *   - LIB: `strip-link-diagram-listbox` (TopBarStyleControls.tsx strip Link Autocomplete listbox)
 *   - LIB: `strip-link-diagram-open`    (TopBarStyleControls.tsx strip open-linked IconButton)
 *   - APP: `toolbar-preview`            (AppToolbar.tsx Preview IconButton)
 *   - APP: `toolbar-back-to-editing`    (AppToolbar.tsx Back-to-editing Button)
 *
 * Lib rebuild cycles this spec: 1 (strip Link control batched).
 */
import { appTest as test, expect } from '../fixtures/app.fixture';
import { AppToolbarPOM } from '../pom/AppToolbarPOM';
import { DiagramLinkPOM } from '../pom/DiagramLinkPOM';
import { byLibTestId } from '../helpers/selectors';
import { waitForDebugBridge } from '../helpers/store';

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

const ID_A = 'diagram_a';
const ID_B = 'diagram_b';
const ITEM_ID = 'item_a1';
const MODEL_ITEM_ID = 'modelitem_a1';

interface SeedFixture {
  idA: string;
  idB: string;
  itemId: string;
}

/**
 * Builds two diagram blobs (DiagramA + DiagramB) where DiagramA carries a
 * single placed isoflow icon at tile (0,0) linked to DiagramB. The blob
 * shape mirrors what LocalStorageProvider.sessionLoadDiagram returns and
 * what DiagramLifecycleProvider.handleDiagramManagerLoad expects.
 */
function buildSeed(): {
  blobA: any;
  blobB: any;
  metaList: Array<{ id: string; name: string; lastModified: string; folderId: null }>;
  legacyList: Array<{ id: string; name: string; data: any; createdAt: string; updatedAt: string }>;
} {
  const now = new Date().toISOString();
  const blobA = {
    title: 'DiagramA',
    name: 'DiagramA',
    icons: [],
    colors: [],
    items: [
      {
        id: MODEL_ITEM_ID,
        name: 'Linked node',
        icon: 'isoflow:cube',
        link: ID_B
      }
    ],
    views: [
      {
        id: 'view_a',
        name: 'Main',
        items: [{ id: MODEL_ITEM_ID, tile: { x: 0, y: 0 } }],
        connectors: [],
        rectangles: [],
        textBoxes: [],
        layers: []
      }
    ],
    fitToScreen: true
  };
  const blobB = {
    title: 'DiagramB',
    name: 'DiagramB',
    icons: [],
    colors: [],
    items: [],
    views: [
      {
        id: 'view_b',
        name: 'Main',
        items: [],
        connectors: [],
        rectangles: [],
        textBoxes: [],
        layers: []
      }
    ],
    fitToScreen: true
  };
  const metaList = [
    { id: ID_A, name: 'DiagramA', lastModified: now, folderId: null as null },
    { id: ID_B, name: 'DiagramB', lastModified: now, folderId: null as null }
  ];
  const legacyList = [
    { id: ID_A, name: 'DiagramA', data: blobA, createdAt: now, updatedAt: now },
    { id: ID_B, name: 'DiagramB', data: blobB, createdAt: now, updatedAt: now }
  ];
  return { blobA, blobB, metaList, legacyList };
}

async function seedTwoDiagrams(page: import('@playwright/test').Page, fix: SeedFixture) {
  const seed = buildSeed();
  await page.addInitScript(
    (args: {
      metaList: Array<{ id: string; name: string; lastModified: string; folderId: null }>;
      legacyList: Array<{ id: string; name: string; data: any; createdAt: string; updatedAt: string }>;
      blobA: any;
      blobB: any;
      idA: string;
      idB: string;
      flags: Array<[string, string]>;
      cleanLocalKeys: string[];
    }) => {
      try {
        for (const k of args.cleanLocalKeys) localStorage.removeItem(k);
        for (const [k, v] of args.flags) localStorage.setItem(k, v);
        // sessionStorage = StorageManager backing (file explorer + linkedDiagrams)
        sessionStorage.setItem('axoview_diagrams', JSON.stringify(args.metaList));
        sessionStorage.setItem(
          `axoview_diagram_${args.idA}`,
          JSON.stringify(args.blobA)
        );
        sessionStorage.setItem(
          `axoview_diagram_${args.idB}`,
          JSON.stringify(args.blobB)
        );
        // localStorage = DiagramLifecycleProvider's initial boot state
        localStorage.setItem('axoview-last-opened', args.idA);
        localStorage.setItem('axoview-last-opened-data', JSON.stringify(args.blobA));
        localStorage.setItem('axoview-diagrams', JSON.stringify(args.legacyList));
      } catch {
        /* storage may not be available pre-navigation */
      }
    },
    {
      metaList: seed.metaList,
      legacyList: seed.legacyList,
      blobA: seed.blobA,
      blobB: seed.blobB,
      idA: fix.idA,
      idB: fix.idB,
      flags: ONBOARDING_DISMISS_FLAGS,
      cleanLocalKeys: LOCAL_STORAGE_KEYS
    }
  );
}

/**
 * Reads the lib's title from the debug bridge. After axoviewRef.load(blobB),
 * `model.title` updates to the new diagram's title — load-bearing observable
 * for "the editor is showing DiagramB now".
 */
const getModelTitle = (page: import('@playwright/test').Page) =>
  page.evaluate(() => (window as any).__axoview__?.model?.getState?.()?.title ?? null);

/**
 * Reads the current selection / itemControls reference. Cleared by the lib
 * on load() with a fresh model — used to assert the J5.5 panel-clear contract.
 */
const getItemControls = (page: import('@playwright/test').Page) =>
  page.evaluate(() => (window as any).__axoview__?.ui?.getState?.()?.itemControls ?? null);

/**
 * Selects the seeded view item by dispatching a synthetic mousedown+mouseup
 * on `canvas-interactions`. The seeded view-item lives at tile (0,0); after
 * fit-to-screen the iso origin sits near the canvas centre, so a click in
 * the middle 1/3 of the canvas reliably hits the item.
 *
 * Per Session 3 + 5 findings: synthetic mouse events MUST be dispatched on
 * `[data-axoview-id="canvas-interactions"]` (not page.mouse) so the lib's
 * `isRendererInteraction` gate sees `e.target === rendererRef.current`.
 */
async function selectSeededItem(page: import('@playwright/test').Page) {
  const interactions = page.locator('[data-axoview-id="canvas-interactions"]');
  await interactions.waitFor({ state: 'visible' });
  const box = await interactions.boundingBox();
  if (!box) throw new Error('selectSeededItem: missing canvas-interactions bbox');
  // Tile (0,0) projects to the iso origin which fitToScreen centres in the
  // viewport. Centre-click is the safest bet across viewport sizes.
  const cx = box.width / 2;
  const cy = box.height / 2;
  await interactions.evaluate(
    (el, args: { x: number; y: number }) => {
      const rect = el.getBoundingClientRect();
      // ADR 0018: the lib listens for Pointer Events now — dispatch
      // PointerEvents with pointerType:'mouse' so the unchanged mouse branch
      // runs (was new MouseEvent before the rewrite).
      const fire = (type: string) =>
        el.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            clientX: rect.left + args.x,
            clientY: rect.top + args.y,
            button: 0,
            buttons: type === 'pointerdown' ? 1 : 0,
            pointerId: 1,
            pointerType: 'mouse',
            isPrimary: true
          })
        );
      fire('pointermove');
      fire('pointerdown');
      fire('pointerup');
    },
    { x: cx, y: cy }
  );
}

test.describe('Multi-diagram link — J5 (B-1 + B-2 regression coverage)', () => {
  test.beforeEach(async ({ page, app }) => {
    void app;
    await seedTwoDiagrams(page, { idA: ID_A, idB: ID_B, itemId: ITEM_ID });
    await page.goto('/app');
    await byLibTestId(page, 'axoview-canvas').waitFor({ state: 'visible', timeout: 10_000 });
    await waitForDebugBridge(page);
    // Confirm boot landed on DiagramA — guards every sub-test from a stale
    // sessionStorage carrying a prior run's residue.
    await expect.poll(() => getModelTitle(page), { timeout: 5_000 }).toBe('DiagramA');
  });

  test('J5.1: link picker filters the current diagram (DiagramA absent from options)', async ({ page }) => {
    await selectSeededItem(page);
    const info = new DiagramLinkPOM(page);
    await info.expectVisible();
    await info.openPicker();
    const names = await info.getOptionNames();
    expect(names).toContain('DiagramB');
    expect(names).not.toContain('DiagramA');
  });

  test('J5.2: open-linked-diagram swaps the editor onto DiagramB (no URL change)', async ({ page }) => {
    await selectSeededItem(page);
    const info = new DiagramLinkPOM(page);
    await info.expectVisible();

    // Pre-state: editor is on DiagramA, URL is /app (R1, ADR 0040).
    expect(page.url()).toMatch(/\/app\/?$/);
    await expect.poll(() => getModelTitle(page), { timeout: 5_000 }).toBe('DiagramA');

    await info.clickOpenLinkedDiagram();

    // Post-state: editor is on DiagramB; URL is unchanged (same-tab swap).
    await expect.poll(() => getModelTitle(page), { timeout: 5_000 }).toBe('DiagramB');
    expect(page.url()).toMatch(/\/app\/?$/);
  });

  test('J5.3: NodePanel link in readonly preview navigates to /display/<linkedDiagramId>', async ({ page }) => {
    const toolbar = new AppToolbarPOM(page);
    await toolbar.clickPreview();

    // Preview lands at /display/<ID_A> via DiagramLifecycleProvider.handlePreviewClick.
    await page.waitForURL(new RegExp(`/display/${ID_A}$`), { timeout: 5_000 });
    await byLibTestId(page, 'axoview-canvas').waitFor({ state: 'visible', timeout: 10_000 });
    await waitForDebugBridge(page);
    await expect.poll(() => getModelTitle(page), { timeout: 5_000 }).toBe('DiagramA');

    // Open NodePanel programmatically via the debug bridge. The seeded icon
    // doesn't render in readonly view (the `isoflow:cube` ref isn't a real
    // pack id — placing icons via the UI in J1 etc. uses the actual pack
    // ids loaded from iconPackManager), so synthetic clicks at the model
    // tile coords don't reliably hit a selectable Scene node. The
    // load-bearing assertion is "the NodePanel's linked-diagram link is
    // rendered AND clicking it navigates via the readonly-route flow",
    // which the bridge-driven setState exercises faithfully.
    //
    // Why ui.setState and not ui.getState().actions.setItemControls:
    // calling the action across page.evaluate returned silently — the action
    // executes inside the page context but the closure-captured `set` is
    // somehow not the same `set` the React subscribers are bound to (likely
    // because devtools/zustand middleware caches the original set when the
    // store was created and the bridge-side getState snapshot loses that
    // binding). Direct ui.setState({...}) writes through the store API the
    // subscribers wired to and re-renders RightSidebar with NodePanel mounted.
    //
    // Poll-and-rewrite guard: under full-suite load the readonly load chain
    // continues writing through resetUiState AFTER `model.title` is set, so
    // a one-shot setState immediately after the title-poll race-loses.
    // Polling until itemControls survives a couple of subsequent state
    // writes catches the post-load steady state.
    await expect
      .poll(
        async () =>
          page.evaluate((id: string) => {
            const ui = (window as any).__axoview__?.ui;
            const current = ui?.getState?.()?.itemControls;
            if (current?.id === id && current?.type === 'ITEM') return true;
            ui?.setState?.({
              itemControls: { type: 'ITEM', id },
              rightSidebarOpen: true,
              selectedIds: [{ type: 'ITEM', id }]
            });
            return false;
          }, MODEL_ITEM_ID),
        { timeout: 10_000, intervals: [300] }
      )
      .toBe(true);

    // NodePanel's "Linked diagram" link still uses data-testid (lazy retrofit
    // deferred — no spec-paired motivation to retrofit the readonly surface).
    const linkedLink = byLibTestId(page, 'node-panel-linked-diagram-link');
    await linkedLink.waitFor({ state: 'visible', timeout: 5_000 });
    await linkedLink.click();

    // Should navigate via `axoview-navigate-to-diagram` → App.tsx →
    // /display/<ID_B>. fromEditor state propagates per App.tsx#L143-144.
    await page.waitForURL(new RegExp(`/display/${ID_B}$`), { timeout: 5_000 });
    await waitForDebugBridge(page);
    await expect.poll(() => getModelTitle(page), { timeout: 5_000 }).toBe('DiagramB');
  });

  test('J5.4: Back-to-editing on the readonly toolbar returns the user to the editor', async ({ page }) => {
    const toolbar = new AppToolbarPOM(page);
    await toolbar.clickPreview();
    await page.waitForURL(new RegExp(`/display/${ID_A}$`), { timeout: 5_000 });

    // Readonly toolbar with fromEditor=true: Back-to-editing affordance renders.
    await expect(toolbar.backToEditingButton()).toBeVisible({ timeout: 3_000 });

    await toolbar.clickBackToEditing();
    // navigate(-1) returns to the editor route '/app' (R1, ADR 0040).
    await page.waitForURL(/\/app\/?$/, { timeout: 5_000 });
    await byLibTestId(page, 'axoview-canvas').waitFor({ state: 'visible', timeout: 10_000 });
    await waitForDebugBridge(page);
    await expect.poll(() => getModelTitle(page), { timeout: 5_000 }).toBe('DiagramA');
  });

  test('J5.5: opening a different diagram clears the right-sidebar item controls', async ({ page }) => {
    await selectSeededItem(page);
    const info = new DiagramLinkPOM(page);
    await info.expectVisible();
    expect(await getItemControls(page)).not.toBeNull();

    // Trigger the editor swap via the open-linked-diagram path (same as J5.2).
    await info.clickOpenLinkedDiagram();
    await expect.poll(() => getModelTitle(page), { timeout: 5_000 }).toBe('DiagramB');

    // The Info tab is no longer mounted because the previously-selected
    // item no longer exists in the freshly-loaded model.
    await expect(info.linkPickerInput()).toHaveCount(0);
    await expect.poll(() => getItemControls(page), { timeout: 5_000 }).toBeNull();
  });
});
