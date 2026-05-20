// Covers the 800ms abort-on-hang behavior and the singleton cache.
// The 800ms cap matters: without it, a downed backend can let the OS spend
// 2+ seconds on a dual-stack connect probe before reporting ECONNREFUSED.

describe('fetchRuntimeConfig', () => {
  beforeEach(() => {
    // resetModules + require() gives us a fresh module each test so the
    // module-level `cached` / `inflight` singletons start from null.
    jest.resetModules();
    (global as any).fetch = undefined;
  });

  test('returns default config when fetch rejects', async () => {
    (global as any).fetch = async () => {
      throw new Error('network');
    };
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { fetchRuntimeConfig } = require('../useRuntimeConfig');
    const cfg = await fetchRuntimeConfig();
    expect(cfg.authMode).toBe('none');
    expect(cfg.serverStorage).toBe(false);
    expect(cfg.googleClientId).toBeNull();
  });

  test('aborts a hanging fetch via AbortSignal and falls back to defaults within ~1s', async () => {
    (global as any).fetch = (_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        // Never resolves — only the timeout signal aborts it.
        init.signal?.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError'))
        );
      });
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { fetchRuntimeConfig } = require('../useRuntimeConfig');
    const t0 = Date.now();
    const cfg = await fetchRuntimeConfig();
    const elapsed = Date.now() - t0;
    // 800ms timeout + jitter — must NOT take the old 5000ms.
    expect(elapsed).toBeLessThan(1500);
    expect(elapsed).toBeGreaterThanOrEqual(700);
    expect(cfg.authMode).toBe('none');
  }, 3000);

  test('caches the resolved config across calls', async () => {
    let calls = 0;
    (global as any).fetch = async () => {
      calls++;
      return {
        ok: true,
        status: 200,
        json: async () => ({ authMode: 'shared-token' as const })
      } as Response;
    };
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { fetchRuntimeConfig } = require('../useRuntimeConfig');
    const a = await fetchRuntimeConfig();
    const b = await fetchRuntimeConfig();
    expect(calls).toBe(1);
    expect(a).toBe(b);
    expect(a.authMode).toBe('shared-token');
  });
});
