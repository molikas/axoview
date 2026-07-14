/**
 * drive-display.spec.ts — ADR 0042 §2 (Drive-file read-only display route).
 *
 * Mirrors the readonly-share coverage in share.spec.ts (J13/J14) +
 * share-error.spec.ts for the new `/app/display/drive/:driveFileId` route:
 *
 *   1. Key-read rung renders read-only — /api/config carries googleApiKey,
 *      the mocked googleapis media read returns a diagram blob, the lib
 *      renders in EXPLORABLE_READONLY (View-Only chip, no editor chrome —
 *      the J14 assertion set).
 *   2. Gate screen, not LocalModeShareError — with NO googleApiKey the
 *      key rung is skipped (ADR 0042 §5 graceful degradation) and a
 *      signed-out visitor lands on DriveDisplayGate's needs-signin state.
 *      The route must never trip the share-uuid-scoped
 *      LocalModeShareErrorDialog (ADR 0042 locked decision 7).
 *   3. resourceKey propagation — `?resourceKey=<rk>` on OUR preview URL
 *      rides the googleapis read as `X-Goog-Drive-Resource-Keys:
 *      <fileId>/<rk>` (ADR 0042 §2 rung 1).
 *
 * Network mocks (page.route, same pattern as the sister specs):
 *   - GET /api/config                              → googleApiKey per spec.
 *     Trap: fetchRuntimeConfig backfills a NULL key from the build-time
 *     PUBLIC_GOOGLE_API_KEY, so a dev server started with that var set can
 *     fire the key rung even when the config mock says null — spec 2 pins
 *     the gate outcome, which is identical either way.
 *   - GET https://www.googleapis.com/drive/v3/files/** → 200 diagram blob
 *     or 404. Cross-origin, so the fulfill carries CORS headers and the
 *     handler answers the OPTIONS preflight the custom resource-key
 *     header triggers.
 *
 * Anchors consumed (stamped by the ADR 0042 core change):
 *   - drive-display-gate            (DriveDisplayGate overlay Box)
 *   - drive-display-gate-signin     (needs-signin Google button)
 *   - drive-display-gate-grant      (needs-grant Picker button)
 *   - dialog-local-mode-share-error (LocalModeShareErrorDialog — absence)
 */
import { test as baseTest, expect } from '@playwright/test';
import { DialogsPOM } from '../pom/DialogsPOM';
import { byAxoviewId, byLibTestId } from '../helpers/selectors';
import { waitForDebugBridge } from '../helpers/store';

const DRIVE_FILE_ID = 'drive-file-e2e-1';
const DIAGRAM_TITLE = 'DriveSharedDiagram';
const RESOURCE_KEY = 'abc';

const ONBOARDING_DISMISS_FLAGS: Array<[string, string]> = [
  ['axoview-lazy-loading-welcome-dismissed', 'true'],
  ['axoview-show-drag-hint', 'false']
];

async function pinOnboardingDismissed(page: import('@playwright/test').Page) {
  await page.addInitScript((flags: Array<[string, string]>) => {
    try {
      for (const [k, v] of flags) localStorage.setItem(k, v);
    } catch {
      /* localStorage may not be available pre-navigation */
    }
  }, ONBOARDING_DISMISS_FLAGS);
}

/** Minimal valid diagram blob — the share.spec.ts J14 fixture shape. */
function buildDriveBlob() {
  return {
    title: DIAGRAM_TITLE,
    name: DIAGRAM_TITLE,
    icons: [],
    colors: [],
    items: [],
    views: [
      {
        id: 'view_drive',
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
}

/**
 * Mocks /api/config. fetchRuntimeConfig merges the body over DEFAULT_CONFIG,
 * so omitted fields fall back (serverStorage:false ⇒ Local mode, same as
 * J13). googleClientId stays null so no GIS bootstrap fires under test.
 */
async function installConfigMock(
  page: import('@playwright/test').Page,
  overrides: Record<string, unknown> = {}
) {
  await page.route('**/api/config', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        serverStorage: false,
        authMode: 'none',
        googleClientId: null,
        googleApiKey: null,
        googleProjectNumber: null,
        ...overrides
      })
    });
  });
}

/** CORS headers for the cross-origin googleapis fulfill. The resource-key
 *  header is non-simple, so Chromium preflights — the handler answers the
 *  OPTIONS itself (route.fulfill does not add CORS headers for us). */
const GOOGLEAPIS_CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'authorization, x-goog-drive-resource-keys'
};

interface DriveFilesMockLog {
  /** One entry per media GET: the X-Goog-Drive-Resource-Keys value ('' if absent) */
  resourceKeyHeaders: string[];
  /** Full request URLs of the media GETs (key= rides the query string). */
  urls: string[];
  /** Per media GET: whether an Authorization header rode it (token rung). */
  hadAuthorization: boolean[];
}

/**
 * Mocks the Drive v3 media read (`files/{id}?alt=media…`) and records what
 * each GET carried, so specs can assert the request shape after the render
 * settles — an expect() inside the handler would pass vacuously when the
 * route never fires.
 */
async function installDriveFilesMock(
  page: import('@playwright/test').Page,
  response: { status: number; body: unknown }
): Promise<DriveFilesMockLog> {
  const log: DriveFilesMockLog = { resourceKeyHeaders: [], urls: [], hadAuthorization: [] };
  await page.route('https://www.googleapis.com/drive/v3/files/**', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: GOOGLEAPIS_CORS_HEADERS });
      return;
    }
    log.resourceKeyHeaders.push(req.headers()['x-goog-drive-resource-keys'] ?? '');
    log.urls.push(req.url());
    log.hadAuthorization.push('authorization' in req.headers());
    await route.fulfill({
      status: response.status,
      contentType: 'application/json',
      headers: GOOGLEAPIS_CORS_HEADERS,
      body: JSON.stringify(response.body)
    });
  });
  return log;
}

baseTest.describe('Drive display route — ADR 0042 §2 (/app/display/drive/:driveFileId)', () => {
  baseTest.beforeEach(async ({ page }) => {
    await pinOnboardingDismissed(page);
  });

  baseTest('key-read rung renders the diagram read-only (canvas + View-Only chip, no editor chrome)', async ({ page }) => {
    await installConfigMock(page, { googleApiKey: 'test-key', googleProjectNumber: '123' });
    const log = await installDriveFilesMock(page, { status: 200, body: buildDriveBlob() });

    await page.goto(`/app/display/drive/${DRIVE_FILE_ID}`);

    // The ladder's rung 1 resolves the mocked blob; the lifecycle loads it
    // into the lib in EXPLORABLE_READONLY — the same render contract J14
    // asserts on the public-snapshot route.
    await byLibTestId(page, 'axoview-canvas').waitFor({ state: 'visible', timeout: 15_000 });
    await waitForDebugBridge(page);
    await expect
      .poll(
        () =>
          page.evaluate(
            () => (window as any).__axoview__?.model?.getState?.()?.title ?? null
          ),
        { timeout: 5_000 }
      )
      .toBe(DIAGRAM_TITLE);

    // Readonly toolbar: the View-Only chip replaces the editor button strip
    // (AppToolbar renders one or the other), so chip-present + share-absent
    // together pin "no editor chrome".
    await expect(page.locator('text=View-Only Mode')).toBeVisible({ timeout: 5_000 });
    await expect(byAxoviewId(page, 'toolbar-share')).toHaveCount(0);

    // Loaded state: the gate renders null, not an overlay.
    await expect(byAxoviewId(page, 'drive-display-gate')).toHaveCount(0);

    // The read was the anonymous KEY rung (no sign-in in this context) —
    // the configured key rides the query string per drivePublicRead.
    expect(log.urls.length).toBeGreaterThan(0);
    expect(log.urls[0]).toContain('alt=media');
    expect(log.urls[0]).toContain('key=test-key');
  });

  baseTest('no API key + unreadable file lands the sign-in gate, never LocalModeShareError', async ({ page }) => {
    // googleApiKey stays null in the config ⇒ rung 1 is normally skipped
    // (ADR 0042 §5) and, signed out, rung 2 short-circuits on the null
    // token. Caveat: fetchRuntimeConfig backfills a null key from the
    // build-time PUBLIC_GOOGLE_API_KEY, so a dev server started with that
    // var set legitimately fires rung 1 — the mocked 404 then fails it and
    // the ladder still lands on the same needs-signin gate either way.
    await installConfigMock(page);
    const log = await installDriveFilesMock(page, {
      status: 404,
      body: { error: { code: 404, message: 'File not found', errors: [] } }
    });

    await page.goto(`/app/display/drive/${DRIVE_FILE_ID}`);

    // Gate in needs-signin state: headline card + Google sign-in button,
    // and NOT the needs-grant Picker button.
    const gate = byAxoviewId(page, 'drive-display-gate');
    await gate.waitFor({ state: 'visible', timeout: 10_000 });
    await expect(byAxoviewId(page, 'drive-display-gate-signin')).toBeVisible();
    await expect(byAxoviewId(page, 'drive-display-gate-grant')).toHaveCount(0);

    // Locked decision 7: the Drive route must not set isPublicShareUrl, so
    // the share-uuid dialog cannot misfire here (contrast J13, where it must).
    const dialogs = new DialogsPOM(page);
    await expect(dialogs.localModeShareError()).toHaveCount(0);

    // Signed out, the token rung can never fire: any media GET that did
    // happen (build-time-key rung, see the caveat above) must have been
    // anonymous. (The exact null-key skip ordering is unit-tested in
    // drivePublicRead; e2e pins the user-visible gate contract.)
    expect(log.hadAuthorization.every((had) => !had)).toBe(true);
  });

  baseTest('?resourceKey=<rk> rides the media read as X-Goog-Drive-Resource-Keys', async ({ page }) => {
    await installConfigMock(page, { googleApiKey: 'test-key', googleProjectNumber: '123' });
    const log = await installDriveFilesMock(page, { status: 200, body: buildDriveBlob() });

    await page.goto(`/app/display/drive/${DRIVE_FILE_ID}?resourceKey=${RESOURCE_KEY}`);

    // Render settling proves the mocked read served the ladder end-to-end.
    await byLibTestId(page, 'axoview-canvas').waitFor({ state: 'visible', timeout: 15_000 });
    await waitForDebugBridge(page);
    await expect
      .poll(
        () =>
          page.evaluate(
            () => (window as any).__axoview__?.model?.getState?.()?.title ?? null
          ),
        { timeout: 5_000 }
      )
      .toBe(DIAGRAM_TITLE);

    // drivePublicRead formats the header as `<fileId>/<resourceKey>` and
    // sends it ONLY when the link carried a resourceKey (ADR 0042 §2).
    expect(log.resourceKeyHeaders.length).toBeGreaterThan(0);
    expect(log.resourceKeyHeaders[0]).toBe(`${DRIVE_FILE_ID}/${RESOURCE_KEY}`);
  });
});
