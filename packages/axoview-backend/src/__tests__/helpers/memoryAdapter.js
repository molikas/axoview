/**
 * In-memory StorageAdapter for tests.
 *
 * Honours the five-method shape (ADR 0010 D1) and the reserved-key list
 * (ADR 0010 D5). Stores Uint8Array payloads keyed by opaque adapter keys
 * (`diagrams/<id>`, `folders`, `tree-manifest`, `public/<uuid>`).
 *
 * Not a perfect mirror of fs.js — KEY_PATTERN rejection lives only in the
 * fs adapter (defense-in-depth at the boundary; route layer never produces
 * malformed keys). Tests that exercise key-shape rejection should use the
 * fs adapter directly.
 */
const RESERVED_DIAGRAM_KEYS = new Set([
  'folders',
  'tree-manifest',
  'metadata',
  'diagrams-index'
]);

export function createMemoryAdapter() {
  const store = new Map();
  return {
    async get(key) {
      if (!store.has(key)) return null;
      return new Uint8Array(store.get(key));
    },
    async put(key, value) {
      store.set(key, new Uint8Array(value));
    },
    async delete(key) {
      store.delete(key);
    },
    async list(prefix) {
      const norm = prefix === '' ? '' : prefix.endsWith('/') ? prefix : prefix + '/';
      const out = [];
      for (const k of store.keys()) {
        if (norm === '' || k.startsWith(norm)) out.push(k);
      }
      return out;
    },
    async listDiagramMeta() {
      const out = [];
      for (const [k, v] of store.entries()) {
        if (!k.startsWith('diagrams/')) continue;
        const id = k.slice('diagrams/'.length);
        if (RESERVED_DIAGRAM_KEYS.has(id)) continue;
        try {
          const data = JSON.parse(new TextDecoder().decode(v));
          out.push({
            id,
            name: data.name || data.title || 'Untitled Diagram',
            lastModified: data.lastModified || new Date(0).toISOString(),
            folderId: data.folderId ?? null,
            deletedAt: data.deletedAt ?? null
          });
        } catch {
          /* skip unreadable */
        }
      }
      return out;
    },
    _store: store
  };
}

export function decodeJson(adapter, key) {
  const buf = adapter._store.get(key);
  if (!buf) return null;
  return JSON.parse(new TextDecoder().decode(buf));
}

export function putJson(adapter, key, value) {
  adapter._store.set(key, new TextEncoder().encode(JSON.stringify(value)));
}

export function makeCtx({ params = {}, body = null, query = {}, env = {}, publicBaseUrl = '' } = {}) {
  return { params, body, query, env, publicBaseUrl };
}
