import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { bodyLimit } from 'hono/body-limit';
import { secureHeaders } from 'hono/secure-headers';
import { authMiddleware } from './auth';

// Storage-less Worker. The R2 adapter is intentionally not imported here so
// the bundle has no R2 dependency until the binding is configured. To enable
// server storage, restore the R2 binding in wrangler.toml and re-introduce
// `createR2Adapter`/`dispatch`-based routes (see r2Adapter.ts on disk).
interface Env {
  AUTH_MODE?: 'none' | 'shared-token' | 'cf-access';
  AUTH_SHARED_SECRET?: string;
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
  GOOGLE_CLIENT_ID?: string;
}

type AppEnv = { Bindings: Env };

const app = new Hono<AppEnv>();

app.use('*', secureHeaders());
app.use('/api/*', cors());
app.use(
  '/api/*',
  bodyLimit({
    maxSize: 10 * 1024 * 1024,
    onError: (c) => c.json({ error: 'Payload too large' }, 413)
  })
);
app.use('/api/*', authMiddleware());

// Frontend probes these two on boot. Returning enabled=false makes the app
// fall back to session/localStorage mode without any further client changes.
app.get('/api/storage/status', (c) =>
  c.json({ enabled: false, gitBackup: false, version: '1.0.0' }, 200)
);
app.get('/api/config', (c) =>
  c.json(
    {
      googleClientId: c.env.GOOGLE_CLIENT_ID || null,
      driveScopes: ['https://www.googleapis.com/auth/drive.file'],
      authMode: c.env.AUTH_MODE || 'none',
      serverStorage: false
    },
    200
  )
);

// Every other API call is meaningful only with a storage backend. Reject
// explicitly so the frontend's fallback logic isn't masked by 404s.
app.all('/api/*', (c) =>
  c.json({ error: 'Server storage is disabled' }, 503)
);

export default app;
