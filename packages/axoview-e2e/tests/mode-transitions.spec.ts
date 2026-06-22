/**
 * mode-transitions.spec.ts — v1.1 Track 5e-6.
 *
 * Hotkey-driven mode entry and clean handoff. Every hotkey in the
 * smnrct profile (`config/hotkeys.ts:16-25`) maps to a setMode call
 * in `useInteractionManager.handleKeyDown` (lines 337-405). Each
 * setMode REPLACES the whole mode object — there is no merge — so a
 * mode transition cannot leak the previous mode's selection / id /
 * isConnecting / etc. into the new mode's state.
 *
 * Contract pinned: cycling through every interactive mode via hotkey
 * lands on the documented mode.type each step. CURSOR is reached via
 * the 's' hotkey (the select hotkey in smnrct).
 *
 * The CONNECTOR-mid-flight Escape handoff is covered by 5e-2's
 * cancel-mid-drag scenario — referenced here for symmetry but not
 * duplicated.
 *
 * RECTANGLE.DRAW and TEXTBOX modes are intentionally NOT cycled
 * through here: pressing the rectangle hotkey ('r') sets the mode
 * but doesn't draw anything until a drag, and pressing the textbox
 * hotkey ('t') creates a textbox at the current mouse tile as a
 * side-effect of the keydown — these have their own commits (J3 in
 * shapes.spec.ts) and aren't free mode toggles.
 *
 * Lazy data-axoview-id retrofits — none.
 */
import { canvasReadyTest as test, expect } from '../fixtures/app.fixture';
import { getUiMode } from '../helpers/store';

const getUiModeType = async (page: import('@playwright/test').Page) => {
  const mode = await getUiMode(page);
  return mode?.type ?? null;
};

test.describe('Mode transitions — Track 5e-6', () => {
  test('5e-6: cycling l/c/m/s hotkeys lands on LASSO -> CONNECTOR -> PAN -> CURSOR cleanly', async ({ page, app }) => {
    void app;

    // 's' is the select hotkey in smnrct; the canvasReadyTest fixture
    // boots into CURSOR but we explicitly press 's' first to guarantee
    // the baseline regardless of any future fixture changes.
    await page.keyboard.press('s');
    await expect.poll(() => getUiModeType(page), { timeout: 2_000 }).toBe('CURSOR');

    await page.keyboard.press('l');
    await expect.poll(() => getUiModeType(page), { timeout: 2_000 }).toBe('LASSO');

    await page.keyboard.press('c');
    await expect
      .poll(() => getUiModeType(page), { timeout: 2_000 })
      .toBe('CONNECTOR');

    await page.keyboard.press('m');
    await expect.poll(() => getUiModeType(page), { timeout: 2_000 }).toBe('PAN');

    await page.keyboard.press('s');
    await expect.poll(() => getUiModeType(page), { timeout: 2_000 }).toBe('CURSOR');
  });

  test('5e-6: Esc from idle CONNECTOR mode returns to Select/CURSOR (F-01)', async ({ page, app }) => {
    void app;

    await page.keyboard.press('c');
    await expect
      .poll(() => getUiModeType(page), { timeout: 2_000 })
      .toBe('CONNECTOR');

    // Esc with nothing in flight: handleConnectorEscape returns false (no
    // in-progress connector), so Esc falls through to the F-01 tool-mode exit —
    // CONNECTOR is in TOOL_MODES_EXITED_BY_ESCAPE, so the mode returns to CURSOR.
    // (Previously Esc was swallowed and the user was stranded in the tool until
    // pressing 's'; see handleEscapeKey.ts + handleEscapeKey.test.ts 'exits idle
    // CONNECTOR mode to CURSOR'.)
    await page.keyboard.press('Escape');
    await expect
      .poll(() => getUiModeType(page), { timeout: 2_000 })
      .toBe('CURSOR');
  });
});
