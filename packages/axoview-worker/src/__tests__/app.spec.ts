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
