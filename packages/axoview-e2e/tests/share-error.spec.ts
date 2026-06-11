/**
 * share-error.spec.ts — ADR 0011 failure-of-intent (Share).
 *
 * Closes the Share leg of the deferred E2E coverage from PR #9/#10 5e.
 *
 * Per the ADR 0011 §1 carve-out, the toolbar share popover and DiagramManager
 * share paths surface their failures inline (they are already inside a dialog).
 * The one share trigger that is a *bare* action — the file-tree "Copy share
 * link" context-menu item (FileExplorer.handleCopyShareLink) — has no
 * surrounding recovery context, so its failure surfaces the explicit
 * ShareErrorDialog (replacing the pre-ADR-0011 notificationStore toast).
 *
 * Setup mirrors share.spec.ts J14: mock /api/config → serverStorage:true so
 * the StorageManager runs server-backed (which unlocks `canShare` on the
 * context menu) while listDiagrams falls back to the seeded sessionStorage
 * (the dev server has no real backend). The only endpoint we drive is the
 * share POST, which we fail (500) then succeed (200) on retry.
 *
 * Anchors stamped alongside this spec:
 *   - file-explorer-context-menu-share  (ContextMenuItems.tsx share MenuItem)
 *   - dialog-share-error                (ShareErrorDialog Dialog paper)
 *   - dialog-share-error-dismiss        (ShareErrorDialog OK Button)
 *   - dialog-share-error-retry          (ShareErrorDialog "Try again" Button)
 */
import { test as baseTest, expect } from '@playwright/test';
import { DialogsPOM } from '../pom/DialogsPOM';
import { FileExplorerPOM } from '../pom/FileExplorerPOM';
import { byLibTestId } from '../helpers/selectors';

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

const SEED_DIAGRAM_ID = 'diagram_share_error';
const SEED_DIAGRAM_NAME = 'ShareErrorDiagram';

function buildBlob() {
  return {
    title: SEED_DIAGRAM_NAME,
    name: SEED_DIAGRAM_NAME,
    icons: [],
    colors: [],
    items: [],
    views: [
      { id: 'view_1', name: 'Main', items: [], connectors: [], rectangles: [], textBoxes: [], layers: [] }
    ],
    fitToScreen: true
  };
}

async function seedSessionDiagram(page: import('@playwright/test').Page) {
  const blob = buildBlob();
  const now = new Date().toISOString();
  await page.addInitScript(
    (args: { id: string; name: string; blob: unknown; now: string; flags: Array<[string, string]>; cleanKeys: string[] }) => {
      try {
        for (const k of args.cleanKeys) localStorage.removeItem(k);
        for (const [k, v] of args.flags) localStorage.setItem(k, v);
        // Pin the file explorer deterministically open so the test never races
        // the server-mode auto-open (and never toggles it shut).
        localStorage.setItem('axoview-explorer-initialized', '1');
        localStorage.setItem('axoview-explorer-open', 'true');
        sessionStorage.setItem(
          'axoview_diagrams',
          JSON.stringify([{ id: args.id, name: args.name, lastModified: args.now, folderId: null }])
        );
        sessionStorage.setItem(`axoview_diagram_${args.id}`, JSON.stringify(args.blob));
        localStorage.setItem('axoview-last-opened', args.id);
        localStorage.setItem('axoview-last-opened-data', JSON.stringify(args.blob));
        localStorage.setItem(
          'axoview-diagrams',
          JSON.stringify([{ id: args.id, name: args.name, data: args.blob, createdAt: args.now, updatedAt: args.now }])
        );
      } catch {
        /* storage may not be available pre-navigation */
      }
    },
    { id: SEED_DIAGRAM_ID, name: SEED_DIAGRAM_NAME, blob, now, flags: ONBOARDING_DISMISS_FLAGS, cleanKeys: LOCAL_STORAGE_KEYS }
  );
}

/**
 * Mocks the server-mode storage GETs (so the file tree populates with the
 * seeded diagram) plus /api/config and the share POST. Unlike share.spec.ts
 * J14 — which leans on the LocalStorageProvider sessionStorage fallback — the
 * tree's getTreeManifest returns a non-awaited promise that rejects when the
 * dev server answers /api/tree-manifest with a 200 HTML body, which would
 * reject the tree load and leave it empty. Mocking the GETs sidesteps that.
 *
 * The share endpoint fails the first call (500) and succeeds on every
 * subsequent call (200) so the dialog's "Try again" can drive the recovery.
 */
async function installMocks(page: import('@playwright/test').Page) {
  const now = new Date().toISOString();

  await page.route('**/api/config', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ serverStorage: true, version: 'test', features: {} })
    });
  });

  await page.route('**/api/diagrams', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: SEED_DIAGRAM_ID, name: SEED_DIAGRAM_NAME, lastModified: now, folderId: null }
      ])
    });
  });

  await page.route('**/api/folders', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await page.route('**/api/tree-manifest', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ folders: [] })
    });
  });

  let shareCalls = 0;
  await page.route('**/api/diagrams/*/share', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    shareCalls += 1;
    if (shareCalls === 1) {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'boom' }) });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          uuid: 'retry-uuid-share-error',
          url: '/display/p/retry-uuid-share-error',
          sharedAt: new Date().toISOString()
        })
      });
    }
  });
}

baseTest.describe('Share error — ADR 0011 failure-of-intent (Share)', () => {
  baseTest('a failing share POST from the file-tree surfaces ShareErrorDialog; "Try again" recovers on success', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await seedSessionDiagram(page);
    await installMocks(page);

    await page.goto('/');
    await byLibTestId(page, 'axoview-canvas').waitFor({ state: 'visible', timeout: 15_000 });

    // The explorer is pinned open via seeded localStorage; wait for the tree
    // to load the (mocked) diagram row directly — no toggle, no race.
    const explorer = new FileExplorerPOM(page);
    const row = explorer.getRowByName(SEED_DIAGRAM_NAME, 'diagram');
    await row.waitFor({ state: 'visible', timeout: 15_000 });

    // Right-click → context menu → Copy share link (canShare is true because
    // /api/config reported serverStorage:true).
    await row.click({ button: 'right' });
    const shareItem = page.locator('[data-axoview-id="file-explorer-context-menu-share"]');
    await shareItem.waitFor({ state: 'visible', timeout: 3_000 });
    await shareItem.click();

    // First POST returns 500 → handleCopyShareLink catch → ShareErrorDialog.
    const dialogs = new DialogsPOM(page);
    await dialogs.shareError().waitFor({ state: 'visible', timeout: 10_000 });
    await expect(dialogs.shareError()).toContainText("Couldn't create share link.");
    await expect(dialogs.shareError()).toContainText('Something went wrong');

    // "Try again" re-POSTs; the second call returns 200 → success → the
    // dialog dismisses and the link is copied to the clipboard.
    await dialogs.retryShare();
    await expect(dialogs.shareError()).toHaveCount(0);
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()), { timeout: 5_000 })
      .toMatch(/\/display\/p\/retry-uuid-share-error$/);
  });

  baseTest('dismissing ShareErrorDialog closes it without retrying', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await seedSessionDiagram(page);
    await installMocks(page);

    await page.goto('/');
    await byLibTestId(page, 'axoview-canvas').waitFor({ state: 'visible', timeout: 15_000 });

    // The explorer is pinned open via seeded localStorage; wait for the tree
    // to load the (mocked) diagram row directly — no toggle, no race.
    const explorer = new FileExplorerPOM(page);
    const row = explorer.getRowByName(SEED_DIAGRAM_NAME, 'diagram');
    await row.waitFor({ state: 'visible', timeout: 15_000 });

    await row.click({ button: 'right' });
    const shareItem = page.locator('[data-axoview-id="file-explorer-context-menu-share"]');
    await shareItem.waitFor({ state: 'visible', timeout: 3_000 });
    await shareItem.click();

    const dialogs = new DialogsPOM(page);
    await dialogs.shareError().waitFor({ state: 'visible', timeout: 10_000 });

    await dialogs.dismissShareError();
    await expect(dialogs.shareError()).toHaveCount(0);
    // Editor intact — the file tree row is still present.
    await expect(row).toBeVisible();
  });
});
