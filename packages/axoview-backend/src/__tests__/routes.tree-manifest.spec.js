import { getTreeManifest, saveTreeManifest } from '../routes.js';
import { createMemoryAdapter, decodeJson, putJson, makeCtx } from './helpers/memoryAdapter.js';

describe('getTreeManifest', () => {
  test('returns default { folders: [] } when no manifest stored', async () => {
    const adapter = createMemoryAdapter();
    const result = await getTreeManifest(adapter);
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ folders: [] });
  });

  test('returns stored manifest as-is', async () => {
    const adapter = createMemoryAdapter();
    const manifest = { folders: [{ id: 'a', children: [] }], generatedAt: '2026-05-25' };
    putJson(adapter, 'tree-manifest', manifest);
    const result = await getTreeManifest(adapter);
    expect(result.body).toEqual(manifest);
  });
});

describe('saveTreeManifest', () => {
  test('writes provided body to tree-manifest', async () => {
    const adapter = createMemoryAdapter();
    const manifest = { folders: [{ id: 'a', children: [{ id: 'b' }] }] };
    const result = await saveTreeManifest(adapter, makeCtx({ body: manifest }));
    expect(result.status).toBe(200);
    expect(decodeJson(adapter, 'tree-manifest')).toEqual(manifest);
  });

  test('falls back to { folders: [] } when body omitted', async () => {
    const adapter = createMemoryAdapter();
    await saveTreeManifest(adapter, makeCtx({ body: null }));
    expect(decodeJson(adapter, 'tree-manifest')).toEqual({ folders: [] });
  });
});
