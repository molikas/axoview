/**
 * Typed wrappers around `window.__axoview__` — the Zustand store handles
 * exposed in development builds by `Axoview.tsx`. Production builds tree-shake
 * the exposure block, so these helpers are dev-only.
 *
 * These are the single point of truth for reading app state in tests; they
 * replace the React-fiber-tree probing the deleted Selenium suite carried.
 */
import { Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// UI state reads
// ---------------------------------------------------------------------------

export const getUiMode = (page: Page) =>
  page.evaluate(() => (window as any).__axoview__.ui.getState().mode);

export const getScroll = (page: Page) =>
  page.evaluate(() => (window as any).__axoview__.ui.getState().scroll);

export const getItemControls = (page: Page) =>
  page.evaluate(() => (window as any).__axoview__.ui.getState().itemControls);

export const getZoom = (page: Page) =>
  page.evaluate(() => (window as any).__axoview__.ui.getState().zoom);

// ---------------------------------------------------------------------------
// Model / history reads
// ---------------------------------------------------------------------------

export const getModelItemCount = (page: Page): Promise<number> =>
  page.evaluate(() => {
    const items = (window as any).__axoview__.model.getState().items;
    return Array.isArray(items) ? items.length : 0;
  });

/**
 * Counts connectors in the currently-active view. Connectors live on
 * `model.views[*].connectors`, not at the model root — the active view is
 * named by `ui.getState().view`. Falls back to the first view if the active
 * view id isn't set (covers boot races).
 */
export const getModelConnectorCount = (page: Page): Promise<number> =>
  page.evaluate(() => {
    const viewId = (window as any).__axoview__.ui.getState().view;
    const views = (window as any).__axoview__.model.getState().views;
    if (!Array.isArray(views) || views.length === 0) return 0;
    const view =
      (viewId && views.find((v: any) => v.id === viewId)) ?? views[0];
    return Array.isArray(view?.connectors) ? view.connectors.length : 0;
  });

export const getModelHistoryLength = (page: Page) =>
  page.evaluate(() => (window as any).__axoview__.model.getState().history.past.length);

/**
 * Waits for the debug bridge to attach. The lib exposes it inside a
 * useEffect on mount, so a freshly-loaded page may briefly lack the bridge.
 */
export const waitForDebugBridge = (page: Page, timeoutMs = 10_000) =>
  page.waitForFunction(
    () => Boolean((window as any).__axoview__?.model?.getState),
    undefined,
    { timeout: timeoutMs }
  );
