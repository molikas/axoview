/**
 * journey.spec.ts — the browser-driven write journey through nginx, storage ON
 * (ADR 0048 §2).
 *
 * Runs under both origins: smoke-secure (http://localhost:<port>) and
 * smoke-insecure (http://axoview.test:<port>, an insecure context). Browsers
 * send `Origin` on every non-GET request, same-origin ones included, so each
 * write below crosses the backend's Origin gate the way a user's does. This is
 * the journey v3.9.0 (403 on every write) and v3.9.1 (the editor failing to
 * load over plain HTTP) would have failed.
 *
 * Selectors are borrowed from rename.spec.ts, file-explorer-delete.spec.ts and
 * share.spec.ts, through the bridge-free POMs.
 *
 * Save: with server storage the toolbar renders no Save button
 * (`toolbar-save` exists only when remote storage is inactive, AppToolbar.tsx)
 * and edits autosave after a 2 s debounce. Ctrl+S is the Save button's hotkey
 * and runs the same handler (DiagramLifecycleProvider `handleSaveClick`): it
 * flushes the pending autosave, or PUTs the current model when nothing is
 * pending, so it always produces the `PUT /api/diagrams/:id` this step waits for.
 */
import { AppToolbarPOM } from '../pom/AppToolbarPOM';
import { FileExplorerPOM } from '../pom/FileExplorerPOM';
import { byAxoviewId, byLibTestId } from '../helpers/selectors';
import {
  test,
  expect,
  placeFirstIcon,
  seedOnboardingFlags,
  waitForApi,
  waitForAppReady
} from './fixtures';

const RENAMED = 'Docker journey renamed';
const SECOND = 'Docker journey second';

type DiagramMeta = { id: string; name?: string };

test('journey: create, edit and save, reload, rename, create again, share, delete — through nginx', async ({
  page,
  browser,
  api,
  apiLog,
  baseURL
}) => {
  // A long journey of real writes; the default 30 s is sized for one assertion
  // chain, not seven. Scoped to this test only.
  test.setTimeout(120_000);

  const explorer = new FileExplorerPOM(page);
  const toolbar = new AppToolbarPOM(page);
  const canvas = byLibTestId(page, 'axoview-canvas');

  let firstId = '';
  let firstName = '';
  let secondId = '';

  await test.step('1. create from the empty state', async () => {
    const createButton = byAxoviewId(page, 'screen-empty-create');
    await expect(createButton).toBeVisible();
    const created = waitForApi(page, 'POST', '/api/diagrams');
    await createButton.click();
    const res = await created;
    expect(res.status(), 'POST /api/diagrams from the empty state').toBe(201);
    firstId = ((await res.json()) as { id: string }).id;
    expect(firstId).toBeTruthy();
    await expect(canvas).toBeVisible({ timeout: 10_000 });
    // Connector / import hint tooltips dismiss on any interaction; Escape is
    // the lightest one (app.fixture.ts dismissHintTooltips).
    await page.keyboard.press('Escape');

    const stored = await api.get(`/api/diagrams/${firstId}`);
    expect(stored.status()).toBe(200);
    firstName = String(((await stored.json()) as { name?: string }).name ?? '');
    expect(firstName, 'the created diagram has a name on the server').toBeTruthy();
  });

  await test.step('2. DOM-only edit, then save: a 2xx PUT /api/diagrams/:id', async () => {
    await placeFirstIcon(page);
    const saved = waitForApi(page, 'PUT', `/api/diagrams/${firstId}`);
    await page.keyboard.press('Control+S');
    const res = await saved;
    expect(res.status(), `PUT /api/diagrams/${firstId}`).toBeGreaterThanOrEqual(200);
    expect(res.status()).toBeLessThan(300);
    // The edit reached the server, not just the request.
    await expect
      .poll(async () => {
        const body = (await (await api.get(`/api/diagrams/${firstId}`)).json()) as { items?: unknown[] };
        return Array.isArray(body.items) ? body.items.length : -1;
      })
      .toBe(1);
  });

  await test.step('3. reload: the diagram is still listed, from the server', async () => {
    const listed = waitForApi(page, 'GET', '/api/diagrams');
    await page.reload();
    await waitForAppReady(page);
    await explorer.open();
    const res = await listed;
    expect(res.status()).toBe(200);
    const ids = ((await res.json()) as DiagramMeta[]).map((d) => d.id);
    expect(ids).toContain(firstId);
    await expect(explorer.getRowByName(firstName)).toBeVisible();
  });

  await test.step('4. rename it in the explorer', async () => {
    // A single row click selects it and, if the reload didn't restore it as the
    // current diagram, opens it after the row's 300 ms timer (FileExplorer
    // handleOpenDiagram skips the diagram that is already open). Wait for the
    // row's aria-current before F2, so the open can't land mid-edit.
    await explorer.selectRow(firstName);
    await expect(explorer.getRowByName(firstName)).toHaveAttribute('aria-current', 'true', {
      timeout: 10_000
    });
    await expect(byAxoviewId(page, 'screen-empty-create')).toBeHidden();

    const patched = waitForApi(page, 'PATCH', `/api/diagrams/${firstId}`);
    await explorer.renameDiagram(firstName, RENAMED);
    const res = await patched;
    expect(res.status(), `PATCH /api/diagrams/${firstId} (rename)`).toBe(200);
    await expect(explorer.getRowByName(RENAMED)).toBeVisible();
    await expect
      .poll(async () => ((await (await api.get(`/api/diagrams/${firstId}`)).json()) as { name?: string }).name)
      .toBe(RENAMED);
  });

  await test.step('5. create a second diagram from the explorer', async () => {
    // Right-click on empty tree space (file-explorer-delete.spec.ts) → New diagram.
    const tree = byAxoviewId(page, 'file-explorer-tree');
    const box = await tree.boundingBox();
    expect(box).not.toBeNull();
    await tree.click({ button: 'right', position: { x: 40, y: box!.height - 12 } });
    await byAxoviewId(page, 'file-explorer-context-menu-new-diagram').click();

    const input = explorer.renameInput();
    await input.waitFor({ state: 'visible', timeout: 3_000 });
    await input.fill(SECOND);
    const created = waitForApi(page, 'POST', '/api/diagrams');
    await input.press('Enter');
    const res = await created;
    expect(res.status(), 'POST /api/diagrams from the explorer').toBe(201);
    secondId = ((await res.json()) as { id: string }).id;
    expect(secondId).toBeTruthy();
    await expect(explorer.getRowByName(SECOND)).toBeVisible();

    // The explorer opens the diagram it just created (FileExplorer.tsx
    // handleRenameSubmit → openDiagramById), which loads it from the server...
    await expect
      .poll(() =>
        apiLog.responses.some(
          (r) => r.method === 'GET' && r.path === `/api/diagrams/${secondId}` && r.status === 200
        )
      )
      .toBe(true);
    // ...and makes it current: its row carries aria-current (FileTreeNode,
    // selectedId = currentDiagram.id). The bridge is off, so this is the DOM
    // signal. Share (next step) acts on the current diagram, so it must not
    // start before this lands.
    await expect(explorer.getRowByName(SECOND)).toHaveAttribute('aria-current', 'true');
    await expect(explorer.getRowByName(RENAMED)).not.toHaveAttribute('aria-current', 'true');
  });

  await test.step('6. share it; the link renders for a fresh visitor', async () => {
    await expect(toolbar.shareButton()).toBeEnabled({ timeout: 10_000 });
    const shared = waitForApi(page, 'POST', /^\/api\/diagrams\/[^/]+\/share$/);
    await toolbar.openShareDialog();
    const res = await shared;
    expect(new URL(res.url()).pathname, 'share targets the open (second) diagram').toBe(
      `/api/diagrams/${secondId}/share`
    );
    expect(res.status(), 'POST /api/diagrams/:id/share').toBeGreaterThanOrEqual(200);
    expect(res.status()).toBeLessThan(300);
    const { uuid } = (await res.json()) as { uuid: string };
    expect(uuid).toBeTruthy();

    await expect.poll(() => toolbar.getShareUrl()).toMatch(new RegExp(`/display/p/${uuid}$`));
    const shareUrl = await toolbar.getShareUrl();
    // The link is anchored to the page's own origin (shareUrl.ts), so on
    // smoke-insecure it is an axoview.test link.
    expect(new URL(shareUrl).origin).toBe(new URL(baseURL!).origin);
    await page.keyboard.press('Escape');
    await expect(toolbar.sharePopover()).toBeHidden();

    // A fresh context: the recipient has no storage and no session. Same
    // browser, so the host-resolver rule for axoview.test still applies.
    const visitorContext = await browser.newContext();
    try {
      apiLog.watchContext(visitorContext);
      await seedOnboardingFlags(visitorContext);
      const visitor = await visitorContext.newPage();
      const snapshot = waitForApi(visitor, 'GET', `/api/public/diagrams/${uuid}`);
      await visitor.goto(shareUrl);
      expect((await snapshot).status(), `GET /api/public/diagrams/${uuid}`).toBe(200);
      await expect(byLibTestId(visitor, 'axoview-canvas')).toBeVisible({ timeout: 15_000 });
      // Only the read-only toolbar renders this control (AppToolbar.tsx).
      await expect(byAxoviewId(visitor, 'toolbar-hide-view-controls')).toBeVisible();
    } finally {
      await visitorContext.close();
    }
  });

  await test.step('7. delete it and reload: it is gone', async () => {
    const row = explorer.getRowByName(SECOND);
    await row.click({ button: 'right' });
    await byAxoviewId(page, 'file-explorer-context-menu-delete').click();
    await byAxoviewId(page, 'file-explorer-delete-confirm-dialog').waitFor({
      state: 'visible',
      timeout: 3_000
    });
    const deleted = waitForApi(page, 'DELETE', `/api/diagrams/${secondId}`);
    await byAxoviewId(page, 'file-explorer-delete-confirm').click();
    const res = await deleted;
    expect(res.status(), `DELETE /api/diagrams/${secondId}`).toBe(200);
    await expect(row).toBeHidden({ timeout: 5_000 });

    const listed = waitForApi(page, 'GET', '/api/diagrams');
    await page.reload();
    await waitForAppReady(page);
    await explorer.open();
    const ids = ((await (await listed).json()) as DiagramMeta[]).map((d) => d.id);
    expect(ids).not.toContain(secondId);
    expect(ids).toContain(firstId);
    await expect(explorer.getRowByName(RENAMED)).toBeVisible();
    await expect(explorer.getRowByName(SECOND)).toHaveCount(0);
  });
});
