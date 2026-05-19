import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import * as routes from './src/routes.js';
import { createFsAdapter } from './src/adapters/fs.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.BACKEND_PORT || 3001;

const STORAGE_ENABLED = process.env.ENABLE_SERVER_STORAGE === 'true';
const STORAGE_PATH = process.env.STORAGE_PATH || '/data/diagrams';
const ENABLE_GIT_BACKUP = process.env.ENABLE_GIT_BACKUP === 'true';

// Express env exposed to route handlers (matches Worker `ctx.env`).
const routeEnv = {
  STORAGE_ENABLED,
  ENABLE_GIT_BACKUP,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || null,
  AUTH_MODE: process.env.AUTH_MODE || 'none'
};

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(
  helmet({
    contentSecurityPolicy: false, // CSP is delivered by nginx / _headers
    crossOriginEmbedderPolicy: false
  })
);
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ---------------------------------------------------------------------------
// Auth (shared-token only — cf-access is Cloudflare-specific)
// ---------------------------------------------------------------------------
const AUTH_MODE = process.env.AUTH_MODE || 'none';
const AUTH_SHARED_SECRET = process.env.AUTH_SHARED_SECRET || '';

function constantTimeEquals(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function isPublicRoute(req) {
  // Always-public endpoints
  if (req.path === '/api/config') return true;
  if (req.path === '/api/storage/status') return true;
  if (req.method === 'GET' && req.path.startsWith('/api/public/diagrams/')) return true;
  return false;
}

app.use((req, res, next) => {
  if (!req.path.startsWith('/api/')) return next();
  if (isPublicRoute(req)) return next();
  if (AUTH_MODE === 'none') return next();
  if (AUTH_MODE === 'shared-token') {
    const header = req.headers['authorization'] || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!AUTH_SHARED_SECRET || !constantTimeEquals(token, AUTH_SHARED_SECRET)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return next();
  }
  // cf-access only meaningful behind Cloudflare Access — reject if misconfigured here
  return res.status(500).json({ error: `AUTH_MODE "${AUTH_MODE}" not supported on this runtime` });
});

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------
const adapter = createFsAdapter(STORAGE_PATH);

if (STORAGE_ENABLED) {
  (async () => {
    try {
      await fs.access(STORAGE_PATH);
      const files = await fs.readdir(STORAGE_PATH);
      console.log(
        `Storage directory exists: ${STORAGE_PATH} (${files.length} files)`
      );
    } catch {
      console.log(`Creating storage directory: ${STORAGE_PATH}`);
      await fs.mkdir(STORAGE_PATH, { recursive: true });
    }
  })().catch((err) => console.error('Failed to initialize storage:', err));
}

// ---------------------------------------------------------------------------
// Express → routes.js bridge
// ---------------------------------------------------------------------------

function getPublicBaseUrl(req) {
  const protoHeader = req.headers['x-forwarded-proto'];
  const proto = (Array.isArray(protoHeader) ? protoHeader[0] : protoHeader) || req.protocol;
  return `${proto}://${req.get('host')}`;
}

function makeCtx(req) {
  return {
    params: req.params,
    body: req.body,
    query: req.query,
    env: routeEnv,
    publicBaseUrl: getPublicBaseUrl(req)
  };
}

function adapt(handler, { requireStorage = true } = {}) {
  return async (req, res) => {
    if (requireStorage && !STORAGE_ENABLED) {
      return res.status(503).json({ error: 'Server storage is disabled' });
    }
    try {
      const result = await handler(adapter, makeCtx(req));
      res.status(result.status).json(result.body);
    } catch (err) {
      if (err && typeof err.status === 'number') {
        return res.status(err.status).json(err.body);
      }
      console.error(`[${req.method} ${req.path}]`, err);
      res.status(500).json({ error: 'Internal error' });
    }
  };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// Status / config — never gated by STORAGE_ENABLED
app.get('/api/storage/status', adapt(routes.getStorageStatus, { requireStorage: false }));
app.get('/api/config', adapt(routes.getConfig, { requireStorage: false }));

// Diagrams
app.get('/api/diagrams', adapt(routes.listDiagrams));
app.get('/api/diagrams/:id', adapt(routes.getDiagram));
app.post('/api/diagrams', adapt(routes.createDiagram));
app.put('/api/diagrams/:id', adapt(routes.saveDiagram));
app.patch('/api/diagrams/:id', adapt(routes.patchDiagram));
app.patch('/api/diagrams/:id/move', adapt(routes.moveDiagram));
app.delete('/api/diagrams/:id', adapt(routes.deleteDiagram));

// Folders
app.get('/api/folders', adapt(routes.listFolders));
app.post('/api/folders', adapt(routes.createFolder));
app.put('/api/folders/:id', adapt(routes.renameFolder));
app.patch('/api/folders/:id/move', adapt(routes.moveFolder));
app.delete('/api/folders/:id', adapt(routes.deleteFolder));

// Tree manifest
app.get('/api/tree-manifest', adapt(routes.getTreeManifest));
app.put('/api/tree-manifest', adapt(routes.saveTreeManifest));

// Share
app.post('/api/diagrams/:id/share', adapt(routes.shareDiagram));
app.delete('/api/diagrams/:id/share', adapt(routes.unshareDiagram));
app.get('/api/public/diagrams/:uuid', adapt(routes.getPublicSnapshot, { requireStorage: false }));

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Axoview Backend Server running on port ${PORT}`);
  console.log(`Server storage: ${STORAGE_ENABLED ? 'ENABLED' : 'DISABLED'}`);
  if (STORAGE_ENABLED) {
    console.log(`Storage path: ${STORAGE_PATH}`);
    console.log(`Git backup: ${ENABLE_GIT_BACKUP ? 'ENABLED' : 'DISABLED'}`);
  }
});
