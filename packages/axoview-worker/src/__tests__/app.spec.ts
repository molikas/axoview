import app from '../app';

type Env = Record<string, unknown>;

async function request(pathname: string, init: RequestInit = {}, env: Env = {}) {
  const res = await app.request(`http://test${pathname}`, init, env);
  const body = await res.json().catch(() => null);
  return { status: res.status, body, headers: res.headers };
}

describe('GET /api/config', () => {
  test('returns documented shape with defaults when env empty', async () => {
    const res = await request('/api/config');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      googleClientId: null,
      googleApiKey: null,
      googleProjectNumber: null,
      driveScopes: ['https://www.googleapis.com/auth/drive.file'],
      authMode: 'none',
      serverStorage: false
    });
  });

  test('reflects GOOGLE_CLIENT_ID + AUTH_MODE from env', async () => {
    const res = await request('/api/config', {}, {
      GOOGLE_CLIENT_ID: 'client-1',
      AUTH_MODE: 'shared-token'
    });
    expect(res.body.googleClientId).toBe('client-1');
    expect(res.body.authMode).toBe('shared-token');
  });

  test('reflects GOOGLE_API_KEY + GOOGLE_PROJECT_NUMBER from env (ADR 0042 §5)', async () => {
    const res = await request('/api/config', {}, {
      GOOGLE_API_KEY: 'AIza-test-key',
      GOOGLE_PROJECT_NUMBER: '123456789012'
    });
    expect(res.body.googleApiKey).toBe('AIza-test-key');
    expect(res.body.googleProjectNumber).toBe('123456789012');
  });

  test('serverStorage is hardcoded false (§12 B2: Worker is storage-less)', async () => {
    const res = await request('/api/config');
    expect(res.body.serverStorage).toBe(false);
  });
});

describe('/api/* catch-all (storage disabled per app.ts:40)', () => {
  test.each([
    ['GET', '/api/diagrams'],
    ['GET', '/api/diagrams/abc'],
    ['POST', '/api/diagrams'],
    ['PUT', '/api/diagrams/abc'],
    ['PATCH', '/api/diagrams/abc'],
    ['DELETE', '/api/diagrams/abc'],
    ['GET', '/api/folders'],
    ['POST', '/api/folders'],
    ['GET', '/api/tree-manifest'],
    ['PUT', '/api/tree-manifest'],
    ['POST', '/api/diagrams/abc/share']
  ])('%s %s → 503 "Server storage is disabled"', async (method, pathname) => {
    const res = await request(pathname, { method });
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: 'Server storage is disabled' });
  });
});

describe('public namespace cutout (ADR 0010 D6) still short-circuits to 503 today', () => {
  test('GET /api/public/diagrams/:uuid → 503 (storage-less Worker has nothing to serve)', async () => {
    // Auth-bypass still applies, but the route lands on app.all('/api/*') → 503.
    // §12 B2: Worker re-implements only /api/config; everything else is hardcoded 503.
    const res = await request(`/api/public/diagrams/${'A'.repeat(21)}`);
    expect(res.status).toBe(503);
  });
});

describe('auth fires before the 503 short-circuit', () => {
  test('shared-token mode without credentials → 401 (not 503)', async () => {
    const res = await request(
      '/api/diagrams',
      {},
      { AUTH_MODE: 'shared-token', AUTH_SHARED_SECRET: 'sekret' }
    );
    expect(res.status).toBe(401);
  });

  test('shared-token mode with valid credentials still reaches the 503 sink', async () => {
    const res = await request(
      '/api/diagrams',
      { headers: { authorization: 'Bearer sekret' } },
      { AUTH_MODE: 'shared-token', AUTH_SHARED_SECRET: 'sekret' }
    );
    expect(res.status).toBe(503);
  });

  test('GET /api/config bypasses auth in shared-token mode', async () => {
    const res = await request('/api/config', {}, {
      AUTH_MODE: 'shared-token',
      AUTH_SHARED_SECRET: 'sekret'
    });
    expect(res.status).toBe(200);
  });
});

describe('secureHeaders middleware applied to all routes', () => {
  test('GET /api/config response carries security headers from hono/secure-headers', async () => {
    const res = await request('/api/config');
    // hono/secure-headers sets a baseline set; X-Content-Type-Options: nosniff is
    // one of the always-on defaults. Smoke check that the middleware ran at all.
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });

  test('503 sink path also carries security headers (middleware not skipped on errors)', async () => {
    const res = await request('/api/diagrams');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });
});

describe('non-/api/* routes are not handled by this Worker', () => {
  test('GET / → 404 (no static handler in app.ts)', async () => {
    const res = await request('/');
    expect(res.status).toBe(404);
  });

  test('GET /index.html → 404 (Worker serves only /api/*)', async () => {
    const res = await request('/index.html');
    expect(res.status).toBe(404);
  });
});

// DP4 (v1.1 CF hardening): Hono onError handler in app.ts logs
// method + path + err.name on any uncaught 500 and returns a stack-free
// JSON 500. The handler is the observability seam that wrangler tail
// will surface in production. Mocking authMiddleware to throw is the
// minimal way to force an uncaught error through the chain without
// adding a test-only route to the 45-LOC app.ts.
describe('onError handler (DP4 — log method+path+errorName on uncaught 500)', () => {
  test('uncaught error in middleware: logs method+path+errorName, returns JSON 500', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      let throwingApp: typeof app;
      jest.isolateModules(() => {
        jest.doMock('../auth', () => ({
          isPublicRoute: () => false,
          authMiddleware: () => async () => {
            throw new TypeError('forced by test');
          }
        }));
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        throwingApp = require('../app').default;
      });
      const res = await throwingApp!.request('http://test/api/diagrams', { method: 'GET' }, {});
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body).toEqual({ error: 'Internal Server Error' });
      expect(spy).toHaveBeenCalledTimes(1);
      const message = spy.mock.calls[0][0] as string;
      expect(message).toContain('GET');
      expect(message).toContain('/api/diagrams');
      expect(message).toContain('TypeError');
    } finally {
      spy.mockRestore();
    }
  });
});

// v1.1 Cloudflare hardening — Workstream A.1.
// 30-day CF Analytics review recorded 5xx responses on the paths below in
// production. This block reproduces the exact inputs against the current
// integration bundle: a 503 (for `/api/*`) or 404 (for non-`/api/*` —
// scoped out of the Worker by `_routes.json` in prod, returned by Hono with
// no static handler in tests) is the expected, healthy outcome. A 500
// surfacing on any of these inputs IS the diagnosis — the test failure
// stack identifies the originating middleware.
describe('probe-input surface (CF analytics 5xx fingerprints)', () => {
  const apiProbes = [
    '/api/.env',
    '/api/v2/.env',
    '/api/config.js',
    '/api/node/constant.js',
    '/api/admin/role/id',
    '/api/v1/executions'
  ];
  const nonApiProbes = [
    '/.env',
    '/.docker/secrets.json',
    '/.git/config',
    '/wp-config.php~',
    '/wp-config.php.old',
    '/graphql',
    '/graphql/api',
    '/__nextjs_action',
    '/_next/foo'
  ];

  describe('AUTH_MODE=none (default)', () => {
    test.each(apiProbes)('GET %s → 503 (catch-all sink, no 500 leak)', async (path) => {
      const res = await request(path);
      expect(res.status).toBe(503);
      expect(res.body).toEqual({ error: 'Server storage is disabled' });
    });

    test.each(nonApiProbes)('GET %s → 404 (no Worker route)', async (path) => {
      const res = await request(path);
      expect(res.status).toBe(404);
    });
  });

  describe('AUTH_MODE=shared-token without credentials', () => {
    const env = { AUTH_MODE: 'shared-token', AUTH_SHARED_SECRET: 'sekret' };

    test.each(apiProbes)('GET %s → 401 (auth middleware fires before catch-all)', async (path) => {
      const res = await request(path, {}, env);
      expect(res.status).toBe(401);
    });

    test.each(nonApiProbes)('GET %s → 404 (Worker scope unchanged by AUTH_MODE)', async (path) => {
      const res = await request(path, {}, env);
      expect(res.status).toBe(404);
    });
  });
});
