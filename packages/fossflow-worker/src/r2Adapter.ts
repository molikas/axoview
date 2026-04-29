import type { StorageAdapter, DiagramMeta } from '../../fossflow-backend/src/adapters/types';

interface IndexEntry {
  id: string;
  name: string;
  lastModified: string;
  folderId: string | null;
  deletedAt: string | null;
}

const INDEX_KEY = 'diagrams-index.json';
const MAX_INDEX_RETRIES = 3;

/**
 * R2-backed StorageAdapter.
 *
 * Layout (R2 keys):
 *   diagrams/<id>           — one object per diagram, JSON
 *   public/<uuid>           — shareable snapshots, JSON, addressable only by uuid
 *   folders                 — folder tree, JSON
 *   tree-manifest           — UI state, JSON
 *   diagrams-index.json     — denormalized [{id,name,...}] for fast list
 *
 * The index is core: listing diagrams over R2 cannot fan-out to N GETs (egress
 * + CPU limits). Every diagram put/patch/delete updates the index. v1 assumes
 * a single writer; multi-writer correctness needs etag retries (#5).
 */
export function createR2Adapter(bucket: R2Bucket): StorageAdapter {
  function objectKey(key: string): string {
    if (!/^[a-zA-Z0-9_-]+(\/[a-zA-Z0-9_-]+)*$/.test(key)) {
      throw new Error('Invalid storage key');
    }
    if (key === 'folders' || key === 'tree-manifest') {
      return `${key}.json`;
    }
    return key.endsWith('.json') ? key : `${key}.json`;
  }

  async function getRaw(key: string): Promise<Uint8Array | null> {
    const obj = await bucket.get(objectKey(key));
    if (!obj) return null;
    return new Uint8Array(await obj.arrayBuffer());
  }

  async function readIndex(): Promise<{ entries: IndexEntry[]; etag: string | null }> {
    const obj = await bucket.get(INDEX_KEY);
    if (!obj) return { entries: [], etag: null };
    const text = await obj.text();
    try {
      return { entries: JSON.parse(text), etag: obj.etag };
    } catch {
      return { entries: [], etag: obj.etag };
    }
  }

  async function writeIndexWithRetry(
    mutate: (entries: IndexEntry[]) => IndexEntry[]
  ): Promise<void> {
    for (let attempt = 0; attempt < MAX_INDEX_RETRIES; attempt++) {
      const { entries, etag } = await readIndex();
      const next = mutate(entries.slice());
      const body = JSON.stringify(next, null, 2);
      try {
        await bucket.put(INDEX_KEY, body, {
          httpMetadata: { contentType: 'application/json' },
          ...(etag ? { onlyIf: { etagMatches: etag } } : {})
        } as R2PutOptions);
        return;
      } catch (e) {
        // R2 throws on etag mismatch — retry, re-reading the index.
        if (attempt === MAX_INDEX_RETRIES - 1) throw e;
      }
    }
  }

  function indexEntryFromDiagram(id: string, data: any): IndexEntry {
    return {
      id,
      name: data?.name || data?.title || 'Untitled Diagram',
      lastModified: data?.lastModified || new Date().toISOString(),
      folderId: data?.folderId ?? null,
      deletedAt: data?.deletedAt ?? null
    };
  }

  return {
    async get(key: string): Promise<Uint8Array | null> {
      return getRaw(key);
    },

    async put(key: string, value: Uint8Array): Promise<void> {
      await bucket.put(objectKey(key), value, {
        httpMetadata: { contentType: 'application/json' }
      });

      // Maintain diagrams-index.json on diagram writes.
      if (key.startsWith('diagrams/')) {
        const id = key.slice('diagrams/'.length);
        let parsed: any = {};
        try {
          parsed = JSON.parse(new TextDecoder().decode(value));
        } catch {}
        const entry = indexEntryFromDiagram(id, parsed);
        await writeIndexWithRetry((entries) => {
          const idx = entries.findIndex((e) => e.id === id);
          if (idx >= 0) entries[idx] = entry;
          else entries.push(entry);
          return entries;
        });
      }
    },

    async delete(key: string): Promise<void> {
      await bucket.delete(objectKey(key));
      if (key.startsWith('diagrams/')) {
        const id = key.slice('diagrams/'.length);
        await writeIndexWithRetry((entries) => entries.filter((e) => e.id !== id));
      }
    },

    async list(prefix: string): Promise<string[]> {
      const out: string[] = [];
      let cursor: string | undefined;
      const fullPrefix = prefix ? `${prefix}/` : '';
      do {
        const res = await bucket.list({ prefix: fullPrefix, cursor });
        for (const obj of res.objects) {
          const name = obj.key.endsWith('.json')
            ? obj.key.slice(0, -'.json'.length)
            : obj.key;
          out.push(name);
        }
        cursor = res.truncated ? res.cursor : undefined;
      } while (cursor);
      return out;
    },

    async listDiagramMeta(): Promise<DiagramMeta[]> {
      const { entries } = await readIndex();
      return entries.map((e) => ({
        id: e.id,
        name: e.name,
        lastModified: e.lastModified,
        folderId: e.folderId,
        deletedAt: e.deletedAt
      }));
    }
  };
}
