import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { secureHeaders } from 'hono/secure-headers';
import { authMiddleware } from './auth';

interface Env {
  AUTH_MODE?: 'none' | 'shared-token' | 'cf-access';
  AUTH_SHARED_SECRET?: string;
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_API_KEY?: string;
  GOOGLE_PROJECT_NUMBER?: string;
}

type AppEnv = { Bindings: Env };

const app = new Hono<AppEnv>();

// DP4 (v1.1 CF hardening): single console.error on uncaught 500 with
// method + path + error name. Stack stays internal (ADR 0011 spirit:
// no stack-trace leak in visible response copy). Provides the
// observability hook that wrangler tail will surface in production.
app.onError((err, c) => {
  const url = new URL(c.req.url);
  console.error(`[worker:500] ${c.req.method} ${url.pathname} ${err.name}`);
  return c.json({ error: 'Internal Server Error' }, 500);
});

app.use('*', secureHeaders());
app.use(
  '/api/*',
  bodyLimit({
    maxSize: 10 * 1024 * 1024,
    onError: (c) => c.json({ error: 'Payload too large' }, 413)
  })
);
app.use('/api/*', authMiddleware());

app.get('/api/config', (c) =>
  c.json(
    {
      googleClientId: c.env.GOOGLE_CLIENT_ID || null,
      // The API key is NEVER shipped to the browser — it stays server-side for
      // the /api/public/drive read proxy below (ADR 0043 #3). Expose only
      // WHETHER anonymous preview is available, so the client's read ladder
      // knows to try the proxy rung.
      drivePublicPreview: !!c.env.GOOGLE_API_KEY,
      googleProjectNumber: c.env.GOOGLE_PROJECT_NUMBER || null,
      driveScopes: ['https://www.googleapis.com/auth/drive.file'],
      authMode: c.env.AUTH_MODE || 'none',
      serverStorage: false
    },
    200
  )
);

// Anonymous read proxy for "anyone with the link" Drive diagrams — ADR 0042 §2
// rung 1, moved server-side per ADR 0043 #3. The API key stays server-only and
// can ONLY ever read PUBLICLY-shared files (an API key can't touch a private
// one), so this exposes no private data and needs no auth (isPublicRoute). It
// is edge-cached to stay within Drive quota — the quota/abuse protection that
// ADR 0043 trigger #3 was about.
app.get('/api/public/drive/:fileId', async (c) => {
  const key = c.env.GOOGLE_API_KEY;
  if (!key) return c.json({ error: 'preview-disabled' }, 503);

  const fileId = c.req.param('fileId');
  if (!/^[A-Za-z0-9_-]{10,120}$/.test(fileId)) {
    return c.json({ error: 'bad-file-id' }, 400);
  }

  // Our preview URLs may carry a ?resourceKey= (ADR 0042 §1); forward it as the
  // header Drive expects.
  const resourceKey = c.req.query('resourceKey');
  let upstream: Response;
  try {
    upstream = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&key=${encodeURIComponent(key)}`,
      resourceKey
        ? { headers: { 'X-Goog-Drive-Resource-Keys': `${fileId}/${resourceKey}` } }
        : {}
    );
  } catch {
    return c.json({ error: 'upstream-unreachable' }, 502);
  }

  if (!upstream.ok) {
    // 404/403 ⇒ the file isn't public (or doesn't exist). Collapse both to 404
    // so the browser never sees Drive's raw error body; the client's read
    // ladder then falls through to the authenticated rung.
    return c.json({ error: 'not-public' }, 404);
  }

  // Diagrams are small JSON (the upload cap is 10 MB). Reject anything larger so
  // this can't be abused as a general-purpose proxy for big public files.
  const len = Number(upstream.headers.get('content-length') ?? '0');
  if (len > 10 * 1024 * 1024) return c.json({ error: 'too-large' }, 413);

  const body = await upstream.text();
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // Short TTL: an owner edit shows within a minute; repeat views are free.
      'Cache-Control': 'public, max-age=60'
    }
  });
});

app.all('/api/*', (c) =>
  c.json({ error: 'Server storage is disabled' }, 503)
);

export default app;
