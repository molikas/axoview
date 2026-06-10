/**
 * Framework-agnostic route handlers. Zero Node-specific imports. Imported by
 * both the Express server (Docker) and the Cloudflare Worker (Hono).
 *
 * Each handler takes `(adapter, ctx)` where:
 *   ctx = { params, body, query, env, publicBaseUrl }
 * and returns `{ status, body }` or throws HttpError.
 */

const ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;
const UUID_PATTERN = /^[a-zA-Z0-9_-]{21,64}$/;

export class HttpError extends Error {
  constructor(status, message) {
    const body = typeof message === 'string' ? { error: message } : message;
    super(body.error || 'error');
    this.status = status;
    this.body = body;
  }
}

function assertId(id, label = 'id') {
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) {
    throw new HttpError(400, `Invalid ${label}`);
  }
  return id;
}

function assertUuid(uuid) {
  if (typeof uuid !== 'string' || !UUID_PATTERN.test(uuid)) {
    throw new HttpError(400, 'Invalid uuid');
  }
  return uuid;
}

function generateShareUuid() {
  if (!globalThis.crypto || !globalThis.crypto.getRandomValues) {
    throw new Error('crypto.getRandomValues is required');
  }
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  const bytes = new Uint8Array(21);
  globalThis.crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += alphabet[b % 64];
  return out;
}

async function getJson(adapter, key) {
  const buf = await adapter.get(key);
  if (!buf) return null;
  return JSON.parse(new TextDecoder().decode(buf));
}

async function putJson(adapter, key, value) {
  await adapter.put(key, new TextEncoder().encode(JSON.stringify(value, null, 2)));
}

// ---------------------------------------------------------------------------
// Config (ADR 0009 D2: single boot probe — /api/storage/status removed)
// ---------------------------------------------------------------------------

export function getConfig(_adapter, ctx) {
  const env = ctx?.env || {};
  return {
    status: 200,
    body: {
      googleClientId: env.GOOGLE_CLIENT_ID || null,
      driveScopes: ['https://www.googleapis.com/auth/drive.file'],
      authMode: env.AUTH_MODE || 'none',
      serverStorage: env.STORAGE_ENABLED !== false
    }
  };
}

// ---------------------------------------------------------------------------
// Diagrams
// ---------------------------------------------------------------------------

export async function listDiagrams(adapter, _ctx) {
  const all = await adapter.listDiagramMeta();
  return { status: 200, body: all };
}

export async function getDiagram(adapter, ctx) {
  const id = assertId(ctx.params.id);
  const data = await getJson(adapter, `diagrams/${id}`);
  if (!data) throw new HttpError(404, 'Diagram not found');
  return { status: 200, body: data };
}

export async function createDiagram(adapter, ctx) {
  const body = ctx.body || {};
  // MQA #21: same collision class as createFolder — a project import calls
  // createDiagram in a sequential burst and `diagram_${Date.now()}` reused the
  // same id within a millisecond, then 409'd on the second write. Use a random
  // suffix so back-to-back creates produce distinct ids when the caller did
  // not supply one explicitly.
  let id;
  if (body.id) {
    id = assertId(body.id);
  } else {
    do {
      const rand = Math.random().toString(36).slice(2, 10);
      id = `diagram_${Date.now().toString(36)}_${rand}`;
    } while (await adapter.get(`diagrams/${id}`));
  }
  if (await adapter.get(`diagrams/${id}`)) {
    throw new HttpError(409, 'Diagram already exists');
  }
  const data = {
    ...body,
    id,
    created: new Date().toISOString(),
    lastModified: new Date().toISOString()
  };
  await putJson(adapter, `diagrams/${id}`, data);
  return { status: 201, body: { success: true, id } };
}

export async function saveDiagram(adapter, ctx) {
  const id = assertId(ctx.params.id);
  const body = ctx.body || {};
  const data = { ...body, id, lastModified: new Date().toISOString() };
  await putJson(adapter, `diagrams/${id}`, data);
  return { status: 200, body: { success: true, id } };
}

export async function patchDiagram(adapter, ctx) {
  const id = assertId(ctx.params.id);
  const existing = await getJson(adapter, `diagrams/${id}`);
  if (!existing) throw new HttpError(404, 'Diagram not found');
  const updated = {
    ...existing,
    ...(ctx.body || {}),
    id,
    lastModified: new Date().toISOString()
  };
  await putJson(adapter, `diagrams/${id}`, updated);
  return { status: 200, body: { success: true } };
}

export async function moveDiagram(adapter, ctx) {
  const id = assertId(ctx.params.id);
  const target = ctx.body?.targetFolderId ?? null;
  if (target !== null) assertId(target, 'targetFolderId');
  const existing = await getJson(adapter, `diagrams/${id}`);
  if (!existing) throw new HttpError(404, 'Diagram not found');
  existing.folderId = target;
  existing.lastModified = new Date().toISOString();
  await putJson(adapter, `diagrams/${id}`, existing);
  return { status: 200, body: { success: true } };
}

export async function deleteDiagram(adapter, ctx) {
  const id = assertId(ctx.params.id);
  const existingBuf = await adapter.get(`diagrams/${id}`);
  if (!existingBuf) throw new HttpError(404, 'Diagram not found');
  let existing = null;
  try {
    existing = JSON.parse(new TextDecoder().decode(existingBuf));
  } catch {}
  if (existing?.shareUuid && UUID_PATTERN.test(existing.shareUuid)) {
    try { await adapter.delete(`public/${existing.shareUuid}`); } catch {}
  }
  await adapter.delete(`diagrams/${id}`);
  return { status: 200, body: { success: true } };
}

// ---------------------------------------------------------------------------
// Folders
// ---------------------------------------------------------------------------

async function readFolders(adapter) {
  // MQA #21: a `folders.json` written by an earlier shape (e.g. `{ folders: [...] }`
  // from a tree-manifest-style payload) crashed every folder operation with
  // `folders.map is not a function`. Always coerce to a flat array — accept the
  // legacy `{ folders: [...] }` shape, otherwise fall back to empty so the next
  // write heals the file. Log unexpected shapes once so we can trace where they
  // came from on the rare deployments where this trips.
  const raw = await getJson(adapter, 'folders');
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.folders)) {
    console.warn(
      '[folders] coerced legacy {folders:[]} payload — next write will heal the file'
    );
    return raw.folders;
  }
  if (raw != null) {
    console.warn(
      `[folders] folders.json has unexpected shape (typeof=${typeof raw}, keys=${
        typeof raw === 'object' ? Object.keys(raw).slice(0, 5).join(',') : 'n/a'
      }) — falling back to empty array`
    );
  }
  return [];
}

async function writeFolders(adapter, folders) {
  await putJson(adapter, 'folders', folders);
}

export async function listFolders(adapter, ctx) {
  const all = await readFolders(adapter);
  const parentId = ctx?.query?.parentId;
  const result =
    parentId !== undefined
      ? all.filter((f) => String(f.parentId) === String(parentId))
      : all;
  return { status: 200, body: result };
}

export async function createFolder(adapter, ctx) {
  const { name, parentId } = ctx.body || {};
  if (!name || typeof name !== 'string') {
    throw new HttpError(400, 'name is required');
  }
  if (parentId !== null && parentId !== undefined) assertId(parentId, 'parentId');
  const folders = await readFolders(adapter);
  // MQA #21: project-import dispatches a sequential burst of createFolder calls.
  // The previous `folder_${Date.now()}` id collided whenever two writes landed
  // in the same millisecond, producing duplicate ids in folders.json that
  // confused later move/delete/import passes. Generate a uniqueness suffix
  // (random + collision check against the existing list) so back-to-back
  // creates always yield distinct ids on the fs adapter.
  const existingIds = new Set(folders.map((f) => f.id));
  let id;
  do {
    const rand = Math.random().toString(36).slice(2, 10);
    id = `folder_${Date.now().toString(36)}_${rand}`;
  } while (existingIds.has(id));
  folders.push({ id, name, parentId: parentId ?? null });
  await writeFolders(adapter, folders);
  return { status: 201, body: { success: true, id } };
}

export async function renameFolder(adapter, ctx) {
  const id = assertId(ctx.params.id);
  const { name } = ctx.body || {};
  if (!name || typeof name !== 'string') {
    throw new HttpError(400, 'name is required');
  }
  const folders = await readFolders(adapter);
  const idx = folders.findIndex((f) => f.id === id);
  if (idx < 0) throw new HttpError(404, 'Folder not found');
  folders[idx] = { ...folders[idx], name };
  await writeFolders(adapter, folders);
  return { status: 200, body: { success: true } };
}

// Collect a folder and all its descendant folder ids (recursive delete set).
function collectDescendantFolderIds(folders, rootId) {
  const ids = new Set();
  const visit = (fid) => {
    ids.add(fid);
    folders.filter((f) => f.parentId === fid).forEach((f) => visit(f.id));
  };
  visit(rootId);
  return ids;
}

// Best-effort: delete the public snapshot referenced by a diagram buffer, if
// the blob parses and carries a valid shareUuid. Swallows parse/delete errors.
async function deletePublicSnapshot(adapter, buf) {
  if (!buf) return;
  let existing;
  try {
    existing = JSON.parse(new TextDecoder().decode(buf));
  } catch {
    return; // unparseable diagram blob — nothing to clean up
  }
  if (existing?.shareUuid && UUID_PATTERN.test(existing.shareUuid)) {
    try {
      await adapter.delete(`public/${existing.shareUuid}`);
    } catch {
      /* best-effort */
    }
  }
}

// MQA #14 (Bundle B follow-up): the previous behaviour orphaned every diagram
// inside the deleted folder — listDiagramMeta still returned them (with stale
// folderId), and a subsequent project import collided on the original ids.
// Sweep diagrams whose folderId pointed at any deleted folder. Best-effort:
// per-diagram failures are logged but do not block.
async function sweepOrphanedDiagrams(adapter, toDelete) {
  try {
    const allDiagrams = await adapter.listDiagramMeta();
    const orphans = allDiagrams.filter((d) => toDelete.has(d.folderId));
    for (const meta of orphans) {
      try {
        const buf = await adapter.get(`diagrams/${meta.id}`);
        await deletePublicSnapshot(adapter, buf);
        await adapter.delete(`diagrams/${meta.id}`);
      } catch (e) {
        console.warn(`[deleteFolder] failed to sweep diagram ${meta.id}:`, e);
      }
    }
  } catch (e) {
    console.warn('[deleteFolder] orphan sweep failed:', e);
  }
}

export async function deleteFolder(adapter, ctx) {
  const id = assertId(ctx.params.id);
  const recursive =
    ctx?.query?.recursive === 'true' || ctx?.query?.recursive === true;
  let folders = await readFolders(adapter);
  let toDelete;
  if (recursive) {
    toDelete = collectDescendantFolderIds(folders, id);
    folders = folders.filter((f) => !toDelete.has(f.id));
  } else {
    const idx = folders.findIndex((f) => f.id === id);
    if (idx < 0) throw new HttpError(404, 'Folder not found');
    folders.splice(idx, 1);
    toDelete = new Set([id]);
  }
  await writeFolders(adapter, folders);

  await sweepOrphanedDiagrams(adapter, toDelete);

  return { status: 200, body: { success: true } };
}

export async function moveFolder(adapter, ctx) {
  const id = assertId(ctx.params.id);
  const target = ctx.body?.targetFolderId ?? null;
  if (target !== null) assertId(target, 'targetFolderId');
  const folders = await readFolders(adapter);
  const idx = folders.findIndex((f) => f.id === id);
  if (idx < 0) throw new HttpError(404, 'Folder not found');
  folders[idx] = { ...folders[idx], parentId: target };
  await writeFolders(adapter, folders);
  return { status: 200, body: { success: true } };
}

// ---------------------------------------------------------------------------
// Tree manifest
// ---------------------------------------------------------------------------

export async function getTreeManifest(adapter) {
  const data = await getJson(adapter, 'tree-manifest');
  return { status: 200, body: data ?? { folders: [] } };
}

export async function saveTreeManifest(adapter, ctx) {
  await putJson(adapter, 'tree-manifest', ctx.body || { folders: [] });
  return { status: 200, body: { success: true } };
}

// ---------------------------------------------------------------------------
// Share — public snapshots
// ---------------------------------------------------------------------------

export async function shareDiagram(adapter, ctx) {
  const id = assertId(ctx.params.id);
  const diagram = await getJson(adapter, `diagrams/${id}`);
  if (!diagram) throw new HttpError(404, 'Diagram not found');

  const uuid =
    diagram.shareUuid && UUID_PATTERN.test(diagram.shareUuid)
      ? diagram.shareUuid
      : generateShareUuid();

  const sharedAt = new Date().toISOString();
  const snapshot = {
    title: diagram.title || diagram.name || 'Untitled Diagram',
    name: diagram.name || diagram.title || 'Untitled Diagram',
    icons: Array.isArray(diagram.icons) ? diagram.icons : [],
    colors: Array.isArray(diagram.colors) ? diagram.colors : [],
    items: Array.isArray(diagram.items) ? diagram.items : [],
    views: Array.isArray(diagram.views) ? diagram.views : [],
    fitToScreen: diagram.fitToScreen !== false,
    sharedAt,
    sourceId: id
  };
  await putJson(adapter, `public/${uuid}`, snapshot);

  if (diagram.shareUuid !== uuid) {
    diagram.shareUuid = uuid;
    diagram.lastModified = new Date().toISOString();
    await putJson(adapter, `diagrams/${id}`, diagram);
  }

  const baseUrl = ctx.publicBaseUrl || '';
  const url = `${baseUrl}/display/p/${uuid}`;
  return { status: 200, body: { uuid, url, sharedAt } };
}

export async function unshareDiagram(adapter, ctx) {
  const id = assertId(ctx.params.id);
  const diagram = await getJson(adapter, `diagrams/${id}`);
  if (!diagram) throw new HttpError(404, 'Diagram not found');
  if (diagram.shareUuid && UUID_PATTERN.test(diagram.shareUuid)) {
    try { await adapter.delete(`public/${diagram.shareUuid}`); } catch {}
    delete diagram.shareUuid;
    diagram.lastModified = new Date().toISOString();
    await putJson(adapter, `diagrams/${id}`, diagram);
  }
  return { status: 200, body: { success: true } };
}

export async function getPublicSnapshot(adapter, ctx) {
  const uuid = assertUuid(ctx.params.uuid);
  const data = await getJson(adapter, `public/${uuid}`);
  if (!data) throw new HttpError(404, 'Snapshot not found');
  return { status: 200, body: data };
}
