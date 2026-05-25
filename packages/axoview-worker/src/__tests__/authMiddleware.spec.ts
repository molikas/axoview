import { Hono } from 'hono';
import { authMiddleware } from '../auth';

type Env = Record<string, unknown>;

function makeApp() {
  const app = new Hono();
  app.use('/api/*', authMiddleware());
  app.all('/api/*', (c) => c.json({ ok: true }, 200));
  return app;
}

async function request(
  app: ReturnType<typeof makeApp>,
  pathname: string,
  init: RequestInit = {},
  env: Env = {}
) {
  const res = await app.request(`http://test${pathname}`, init, env);
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

describe('authMiddleware — public-route bypass', () => {
  test('GET /api/config bypasses every auth mode', async () => {
    const app = makeApp();
    for (const mode of ['none', 'shared-token', 'cf-access', 'unknown']) {
      const res = await request(app, '/api/config', {}, { AUTH_MODE: mode });
      expect(res.status).toBe(200);
    }
  });

  test('GET /api/public/diagrams/<valid-uuid> bypasses every auth mode', async () => {
    const app = makeApp();
    const uuid = 'A'.repeat(21);
    for (const mode of ['none', 'shared-token', 'cf-access']) {
      const res = await request(app, `/api/public/diagrams/${uuid}`, {}, { AUTH_MODE: mode });
      expect(res.status).toBe(200);
    }
  });
});

describe('authMiddleware — mode "none"', () => {
  test('passes through without credentials', async () => {
    const res = await request(makeApp(), '/api/diagrams', {}, { AUTH_MODE: 'none' });
    expect(res.status).toBe(200);
  });

  test('defaults to "none" when AUTH_MODE env var unset', async () => {
    const res = await request(makeApp(), '/api/diagrams', {}, {});
    expect(res.status).toBe(200);
  });
});

describe('authMiddleware — mode "shared-token"', () => {
  const env = { AUTH_MODE: 'shared-token', AUTH_SHARED_SECRET: 'sekret' };

  test('passes through with correct Bearer token', async () => {
    const res = await request(
      makeApp(),
      '/api/diagrams',
      { headers: { authorization: 'Bearer sekret' } },
      env
    );
    expect(res.status).toBe(200);
  });

  test('rejects mismatched token with 401', async () => {
    const res = await request(
      makeApp(),
      '/api/diagrams',
      { headers: { authorization: 'Bearer wrong' } },
      env
    );
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  test('rejects missing Authorization header with 401', async () => {
    const res = await request(makeApp(), '/api/diagrams', {}, env);
    expect(res.status).toBe(401);
  });

  test('rejects non-Bearer scheme with 401', async () => {
    const res = await request(
      makeApp(),
      '/api/diagrams',
      { headers: { authorization: 'Basic dXNlcjpwYXNz' } },
      env
    );
    expect(res.status).toBe(401);
  });

  test('rejects empty Bearer token (after constantTimeEquals length mismatch) with 401', async () => {
    const res = await request(
      makeApp(),
      '/api/diagrams',
      { headers: { authorization: 'Bearer ' } },
      env
    );
    expect(res.status).toBe(401);
  });

  test('500 when AUTH_SHARED_SECRET missing', async () => {
    const res = await request(
      makeApp(),
      '/api/diagrams',
      { headers: { authorization: 'Bearer x' } },
      { AUTH_MODE: 'shared-token' }
    );
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Server auth misconfigured' });
  });
});

describe('authMiddleware — mode "cf-access" (structural paths only)', () => {
  // Deep RS256/JWKS coverage is out of scope per Track 5a's Commit 6 checkpoint
  // (>20 LOC of crypto-stubbing). Recorded as Finding #2 in the tactical's
  // register. Structural paths below pin the misconfigured + missing-header
  // branches that are reachable without faking Web Crypto state.

  test('500 when CF_ACCESS_TEAM_DOMAIN missing', async () => {
    const res = await request(
      makeApp(),
      '/api/diagrams',
      { headers: { 'cf-access-jwt-assertion': 'header.payload.sig' } },
      { AUTH_MODE: 'cf-access', CF_ACCESS_AUD: 'aud' }
    );
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Server auth misconfigured' });
  });

  test('500 when CF_ACCESS_AUD missing', async () => {
    const res = await request(
      makeApp(),
      '/api/diagrams',
      { headers: { 'cf-access-jwt-assertion': 'header.payload.sig' } },
      { AUTH_MODE: 'cf-access', CF_ACCESS_TEAM_DOMAIN: 'team' }
    );
    expect(res.status).toBe(500);
  });

  test('401 when Cf-Access-Jwt-Assertion header missing', async () => {
    const res = await request(
      makeApp(),
      '/api/diagrams',
      {},
      { AUTH_MODE: 'cf-access', CF_ACCESS_TEAM_DOMAIN: 'team', CF_ACCESS_AUD: 'aud' }
    );
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  test('401 when JWT is malformed (not 3 dot-separated parts)', async () => {
    const res = await request(
      makeApp(),
      '/api/diagrams',
      { headers: { 'cf-access-jwt-assertion': 'not-a-jwt' } },
      { AUTH_MODE: 'cf-access', CF_ACCESS_TEAM_DOMAIN: 'team', CF_ACCESS_AUD: 'aud' }
    );
    expect(res.status).toBe(401);
  });

  test('401 when JWT header/payload base64url cannot be decoded as JSON', async () => {
    const res = await request(
      makeApp(),
      '/api/diagrams',
      { headers: { 'cf-access-jwt-assertion': '!!!.!!!.!!!' } },
      { AUTH_MODE: 'cf-access', CF_ACCESS_TEAM_DOMAIN: 'team', CF_ACCESS_AUD: 'aud' }
    );
    expect(res.status).toBe(401);
  });
});

describe('authMiddleware — unknown mode', () => {
  test('500 with "Unknown AUTH_MODE" body', async () => {
    const res = await request(
      makeApp(),
      '/api/diagrams',
      {},
      { AUTH_MODE: 'totally-made-up' }
    );
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Unknown AUTH_MODE' });
  });
});
