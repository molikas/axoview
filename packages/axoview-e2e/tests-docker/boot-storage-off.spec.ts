/**
 * boot-storage-off.spec.ts — the storage-OFF boot probe (ADR 0048 §2 last row;
 * docs/tactical/docker-regression-gate.md A1 + A4).
 *
 * The runner restarts the container with ENABLE_SERVER_STORAGE=false and waits
 * for `/api/config` = 200 and a `healthy` container before this runs, so
 * reaching this spec already proves the health half. docs/deployment.md §D.1
 * promises the rest: `/api/config` stays reachable (it is the app's only boot
 * probe, ADR 0009 D2) and reports `serverStorage:false`, the published-link
 * read stays reachable, and the editor works from session storage without ever
 * writing to `/api/diagrams`. Before A1 the entrypoint started no backend with
 * storage OFF, so every `/api/*` answered 502 through nginx.
 */
import { byAxoviewId, byLibTestId } from '../helpers/selectors';
import { test, expect } from './fixtures';

test('storage OFF: /api/config answers, the editor boots to the empty state, create stays in the session', async ({
  page,
  api,
  apiLog
}) => {
  await test.step('/api/config answers 200 with serverStorage:false', async () => {
    const res = await api.get('/api/config');
    expect(res.status()).toBe(200);
    expect(((await res.json()) as { serverStorage?: unknown }).serverStorage).toBe(false);
  });

  await test.step('the published-link read route answers from the backend (§D.1), not nginx', async () => {
    // A well-formed uuid that was never published: the backend's own 404, where
    // a missing backend would be nginx's 502.
    const res = await api.get('/api/public/diagrams/axoview-boot-probe-never-published');
    expect(res.status()).toBe(404);
    expect(await res.json()).toEqual({ error: 'Snapshot not found' });
  });

  await test.step('the editor reaches the empty state', async () => {
    await expect(byAxoviewId(page, 'screen-empty-create')).toBeVisible();
  });

  await test.step('create works, in session storage', async () => {
    await byAxoviewId(page, 'screen-empty-create').click();
    await expect(byLibTestId(page, 'axoview-canvas')).toBeVisible({ timeout: 10_000 });
    // LocalStorageProvider's session list (SESSION_DIAGRAMS_KEY).
    await expect
      .poll(() =>
        page.evaluate(() => {
          try {
            const list: unknown = JSON.parse(sessionStorage.getItem('axoview_diagrams') ?? '[]');
            return Array.isArray(list) ? list.length : -1;
          } catch {
            return -1;
          }
        })
      )
      .toBe(1);
  });

  await test.step('no /api/diagrams write was attempted', async () => {
    const writes = apiLog.requests
      .filter((r) => r.path.startsWith('/api/diagrams') && r.method !== 'GET')
      .map((r) => `${r.method} ${r.path}`);
    expect(writes).toEqual([]);
  });
});
