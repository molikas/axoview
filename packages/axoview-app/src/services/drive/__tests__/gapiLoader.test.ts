/**
 * gapiLoader — the module-load promise must always SETTLE. The bare-callback
 * form of gapi.load never rejects, so a blocked/failed module would hang every
 * awaiter (Picker gate, share dialog). These tests pin the config-object
 * callback/onerror wiring; the 15s timeout path is exercised implicitly by the
 * same onerror plumbing (ontimeout → reject).
 */

interface GapiLoadConfig {
  callback: () => void;
  onerror?: (reason?: unknown) => void;
  timeout?: number;
  ontimeout?: () => void;
}

type LoadImpl = (name: string, config: GapiLoadConfig) => void;

/** Install a fake window.gapi so loadScript() short-circuits (gapi present). */
function installFakeGapi(load: LoadImpl): void {
  (window as unknown as { gapi: unknown }).gapi = { load };
}

beforeEach(() => {
  jest.resetModules();
  delete (window as unknown as { gapi?: unknown }).gapi;
});

test('resolves the gapi handle when the module callback fires', async () => {
  installFakeGapi((_name, config) => config.callback());
  const { loadGapiModule } = await import('../gapiLoader');
  await expect(loadGapiModule('picker')).resolves.toBeDefined();
});

test('passes the module name and a config object (not a bare callback) to gapi.load', async () => {
  const load = jest.fn((_name: string, config: GapiLoadConfig) => config.callback());
  installFakeGapi(load as unknown as LoadImpl);
  const { loadGapiModule } = await import('../gapiLoader');
  await loadGapiModule('picker');
  expect(load).toHaveBeenCalledTimes(1);
  expect(load.mock.calls[0][0]).toBe('picker');
  const config = load.mock.calls[0][1];
  expect(typeof config.callback).toBe('function');
  expect(typeof config.onerror).toBe('function');
  expect(typeof config.ontimeout).toBe('function');
  expect(config.timeout).toBeGreaterThan(0);
});

test('rejects (never hangs) when gapi.load invokes onerror', async () => {
  installFakeGapi((_name, config) => config.onerror?.('module blocked'));
  const { loadGapiModule } = await import('../gapiLoader');
  await expect(loadGapiModule('picker')).rejects.toThrow(/failed/);
});

test('rejects when gapi.load invokes ontimeout', async () => {
  installFakeGapi((_name, config) => config.ontimeout?.());
  const { loadGapiModule } = await import('../gapiLoader');
  await expect(loadGapiModule('picker')).rejects.toThrow(/timed out/);
});
