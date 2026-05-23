/**
 * Locator builders anchored on the locked surface vocabulary.
 *
 * Per ADR 0008 Decision 5, the canonical anchor is `data-axoview-id`. Each
 * POM owns the kebab-case ids it queries; tests consume the POM, not this
 * module directly. The `byAxoviewId` builder exists so the POM declarations
 * stay one-liners.
 *
 * Existing `data-testid` attributes inside `axoview-lib` (Renderer canvas,
 * icon-grid items, label/connector test hooks) remain in place for the
 * library's Jest unit tests. The new E2E suite does NOT add or query
 * `data-testid` in new code (per ADR 0008 D5's one-namespace rule). Where a
 * smoke-required surface still lacks a `data-axoview-id` anchor — e.g. the
 * canvas mount, the icon grid — the gap is captured in `pom/_pending.md` and
 * closed when the consuming POM is authored in Sessions 3–6.
 */
import { Locator, Page } from '@playwright/test';

export const byAxoviewId = (page: Page, id: string): Locator =>
  page.locator(`[data-axoview-id="${id}"]`);

/**
 * Transitional accessor for surfaces inside `axoview-lib` that still expose
 * only `data-testid` because no consuming POM has retrofitted them yet.
 * Every call site is a candidate for a `data-axoview-id` migration; the
 * `pom/_pending.md` register lists which POMs will close each gap.
 */
export const byLibTestId = (page: Page, id: string): Locator =>
  page.locator(`[data-testid="${id}"]`);
