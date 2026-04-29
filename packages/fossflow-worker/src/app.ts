import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { bodyLimit } from 'hono/body-limit';
import { secureHeaders } from 'hono/secure-headers';
import * as routes from '../../fossflow-backend/src/routes.js';
import { createR2Adapter } from './r2Adapter';
import { authMiddleware } from './auth';

interface Env {
  R2_BUCKET: R2Bucket;
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

function adapter(c: any) {
  return createR2Adapter(c.env.R2_BUCKET);
}

function envForRoutes(c: any) {
  return {
    STORAGE_ENABLED: true,
    GOOGLE_CLIENT_ID: c.env.GOOGLE_CLIENT_ID || null,
    AUTH_MODE: c.env.AUTH_MODE || 'none'
  };
}

function publicBaseUrl(c: any): string {
  const url = new URL(c.req.url);
  return `${url.protocol}//${url.host}`;
}

async function dispatch(c: any, handler: any, params: Record<string, string> = {}) {
  let body: any = undefined;
  if (c.req.method !== 'GET' && c.req.method !== 'DELETE') {
    try {
      body = await c.req.json();
    } catch {
      body = undefined;
    }
  }
  const query: Record<string, string> = {};
  new URL(c.req.url).searchParams.forEach((v, k) => { query[k] = v; });
  const ctx = {
    params,
    body,
    query,
    env: envForRoutes(c),
    publicBaseUrl: publicBaseUrl(c)
  };
  try {
    const result = await handler(adapter(c), ctx);
    return c.json(result.body, result.status);
  } catch (err: any) {
    if (err && typeof err.status === 'number') {
      return c.json(err.body, err.status);
    }
    console.error('route error', err);
    return c.json({ error: 'Internal error' }, 500);
  }
}

// Status / config — also enforced through auth (except public namespace bypass).
app.get('/api/storage/status', (c) => dispatch(c, routes.getStorageStatus));
app.get('/api/config', (c) => dispatch(c, routes.getConfig));

// Diagrams
app.get('/api/diagrams', (c) => dispatch(c, routes.listDiagrams));
app.get('/api/diagrams/:id', (c) => dispatch(c, routes.getDiagram, { id: c.req.param('id') }));
app.post('/api/diagrams', (c) => dispatch(c, routes.createDiagram));
app.put('/api/diagrams/:id', (c) => dispatch(c, routes.saveDiagram, { id: c.req.param('id') }));
app.patch('/api/diagrams/:id', (c) => dispatch(c, routes.patchDiagram, { id: c.req.param('id') }));
app.patch('/api/diagrams/:id/move', (c) => dispatch(c, routes.moveDiagram, { id: c.req.param('id') }));
app.delete('/api/diagrams/:id', (c) => dispatch(c, routes.deleteDiagram, { id: c.req.param('id') }));

// Folders
app.get('/api/folders', (c) => dispatch(c, routes.listFolders));
app.post('/api/folders', (c) => dispatch(c, routes.createFolder));
app.put('/api/folders/:id', (c) => dispatch(c, routes.renameFolder, { id: c.req.param('id') }));
app.patch('/api/folders/:id/move', (c) => dispatch(c, routes.moveFolder, { id: c.req.param('id') }));
app.delete('/api/folders/:id', (c) => dispatch(c, routes.deleteFolder, { id: c.req.param('id') }));

// Tree manifest
app.get('/api/tree-manifest', (c) => dispatch(c, routes.getTreeManifest));
app.put('/api/tree-manifest', (c) => dispatch(c, routes.saveTreeManifest));

// Share
app.post('/api/diagrams/:id/share', (c) => dispatch(c, routes.shareDiagram, { id: c.req.param('id') }));
app.delete('/api/diagrams/:id/share', (c) => dispatch(c, routes.unshareDiagram, { id: c.req.param('id') }));
app.get('/api/public/diagrams/:uuid', (c) => dispatch(c, routes.getPublicSnapshot, { uuid: c.req.param('uuid') }));

export default app;
