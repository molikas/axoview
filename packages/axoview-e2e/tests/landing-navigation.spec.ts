import { test, expect } from '@playwright/test';

/**
 * R1 (ADR 0040) navigation contract: the marketing landing is the site root
 * `/`; the editor SPA lives at `/app`; unknown routes fail gracefully instead
 * of spinning forever; the static legal pages share the landing chrome.
 *
 * Scope: these exercise the *app-owned* routing that the `npm run dev` harness
 * reproduces — the landing at `/`, the `/app` rewrite (rsbuild
 * historyApiFallback), and the React catch-all 404. The host-level clean-URL +
 * `_redirects` layer (Cloudflare Pages / nginx: `/privacy` clean URLs, the
 * `/display/*`→301 legacy redirect, the static `404.html` status) is verified
 * out-of-band against a production build via `scripts/preview-r1.mjs`, which the
 * dev server cannot reproduce.
 */

const EMPTY_CREATE = '[data-axoview-id="screen-empty-create"]';

test.describe('R1 landing ⇄ app ⇄ 404 navigation (ADR 0040)', () => {
  test('landing renders at / with a crawlable hero and CTAs into /app', async ({ page }) => {
    await page.goto('/');
    // Content-rich hero present at parse time (the SEO point of R1) — not an
    // empty #root.
    await expect(page.locator('.hero h1')).toContainText('isometric');
    // Brand is the home affordance; the primary CTAs open the editor at /app.
    await expect(page.locator('header.site-header a.brand')).toHaveAttribute('href', '/');
    expect(await page.locator('a.btn-primary[href="/app"]').count()).toBeGreaterThan(0);
  });

  test('clicking "Open Axoview" boots the editor at /app', async ({ page }) => {
    await page.goto('/');
    await page.locator('header.site-header a[href="/app"]').click();
    await page.waitForURL(/\/app\/?$/);
    await expect(page.locator(EMPTY_CREATE)).toBeVisible({ timeout: 15_000 });
  });

  test('the editor brand mark navigates back to the landing at /', async ({ page }) => {
    await page.goto('/app');
    await expect(page.locator(EMPTY_CREATE)).toBeVisible({ timeout: 15_000 });
    // Empty state carries no unsaved work, so no beforeunload is expected;
    // accept defensively so the assertion is about routing, not a stray dialog.
    page.on('dialog', (d) => d.accept());
    await page.locator('a.toolbar-left').click();
    await page.waitForURL(/localhost:3000\/$/);
    await expect(page.locator('.hero h1')).toBeVisible();
  });

  test('an unknown /app route shows the graceful 404 instead of spinning', async ({ page }) => {
    await page.goto('/app/this-route-does-not-exist');
    // The catch-all NotFound mounts, clears the boot splash, and offers a way
    // back — previously such paths matched no route and the splash spun forever.
    const home = page.locator('[data-axoview-id="notfound-home"]');
    await expect(home).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('404')).toBeVisible();
    await expect(home).toHaveAttribute('href', '/app');
    // The boot splash must be gone (the regression this route fixes).
    await expect(page.locator('#ax-splash')).toHaveCount(0);
  });

  test('the 404 "Go to Axoview" link returns to the editor', async ({ page }) => {
    await page.goto('/app/nope');
    await page.locator('[data-axoview-id="notfound-home"]').click();
    await page.waitForURL(/\/app\/?$/);
    await expect(page.locator(EMPTY_CREATE)).toBeVisible({ timeout: 15_000 });
  });

  test('legal pages share the landing chrome and link back to / and /app', async ({ page }) => {
    for (const path of ['/privacy.html', '/terms.html']) {
      await page.goto(path);
      // Shared site.css header (cohesion: the legal pages must feel like a
      // continuation of the landing, not a different site).
      await expect(page.locator('header.site-header a.brand')).toHaveAttribute('href', '/');
      await expect(page.locator('header.site-header a[href="/app"]')).toBeVisible();
      // Footer cross-links between the two legal pages (navigation between them).
      await expect(page.locator('footer.site-footer a[href="/privacy"]')).toHaveCount(1);
      await expect(page.locator('footer.site-footer a[href="/terms"]')).toHaveCount(1);
    }
  });
});
