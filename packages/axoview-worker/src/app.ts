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
}

type AppEnv = { Bindings: Env };

const app = new Hono<AppEnv>();

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
