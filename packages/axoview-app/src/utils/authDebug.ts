/**
 * The auth surface's quiet diagnostic channel (ADR 0035): silent-reconnect and
 * granular-consent outcomes are deliberately invisible in the UI (no toasts),
 * so these debug-console breadcrumbs are the only way to tell a popup blocker
 * from a real OAuth error in the field. Centralized so the no-console lint
 * exception lives in exactly one place; retire alongside the worker code-flow
 * slice (known_issues "Boot silent reconnect needs a popup").
 */
export function authDebug(...args: unknown[]): void {
  // eslint-disable-next-line no-console -- deliberate debug-level diagnostic channel (see above)
  console.debug(...args);
}
