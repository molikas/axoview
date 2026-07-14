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
      googleApiKey: c.env.GOOGLE_API_KEY || null,
      googleProjectNumber: c.env.GOOGLE_PROJECT_NUMBER || null,
      driveScopes: ['https://www.googleapis.com/auth/drive.file'],
      authMode: c.env.AUTH_MODE || 'none',
      serverStorage: false
    },
    200
  )
);

app.all('/api/*', (c) =>
  c.json({ error: 'Server storage is disabled' }, 503)
);

export default app;
