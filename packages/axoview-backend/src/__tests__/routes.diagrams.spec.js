import {
  listDiagrams,
  getDiagram,
  createDiagram,
  saveDiagram,
  patchDiagram,
  moveDiagram,
  deleteDiagram,
  HttpError
} from '../routes.js';
import { createMemoryAdapter, decodeJson, putJson, makeCtx } from './helpers/memoryAdapter.js';

async function expectHttpError(promise, status, messageMatcher) {
  let caught;
  try {
    await promise;
  } catch (err) {
    caught = err;
  }
  expect(caught).toBeInstanceOf(HttpError);
  expect(caught.status).toBe(status);
  if (messageMatcher instanceof RegExp) {
    expect(caught.body.error).toMatch(messageMatcher);
  } else if (typeof messageMatcher === 'string') {
    expect(caught.body.error).toBe(messageMatcher);
  }
}

describe('listDiagrams', () => {
  test('returns empty array when no diagrams', async () => {
    const adapter = createMemoryAdapter();
    const result = await listDiagrams(adapter, makeCtx());
    expect(result.status).toBe(200);
    expect(result.body).toEqual([]);
  });

  test('returns diagram metadata, excluding reserved keys', async () => {
    const adapter = createMemoryAdapter();
    putJson(adapter, 'diagrams/d1', {
      id: 'd1',
      name: 'D1',
      lastModified: '2026-01-01T00:00:00Z',
      folderId: null
    });
    putJson(adapter, 'folders', [{ id: 'f1', name: 'F1', parentId: null }]);
    const result = await listDiagrams(adapter, makeCtx());
    expect(result.body).toHaveLength(1);
    expect(result.body[0]).toMatchObject({ id: 'd1', name: 'D1', folderId: null });
  });
});

describe('getDiagram', () => {
  test('returns diagram when present', async () => {
    const adapter = createMemoryAdapter();
    putJson(adapter, 'diagrams/abc', { id: 'abc', items: [], views: [] });
    const result = await getDiagram(adapter, makeCtx({ params: { id: 'abc' } }));
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ id: 'abc', items: [], views: [] });
  });

  test('throws 404 when missing', async () => {
    const adapter = createMemoryAdapter();
    await expectHttpError(getDiagram(adapter, makeCtx({ params: { id: 'missing' } })), 404, 'Diagram not found');
  });

  test('throws 400 on invalid id', async () => {
    const adapter = createMemoryAdapter();
    await expectHttpError(getDiagram(adapter, makeCtx({ params: { id: 'bad id!' } })), 400, /Invalid id/);
    await expectHttpError(getDiagram(adapter, makeCtx({ params: { id: '' } })), 400, /Invalid id/);
    await expectHttpError(getDiagram(adapter, makeCtx({ params: { id: 'a'.repeat(65) } })), 400, /Invalid id/);
  });
});

describe('createDiagram', () => {
  test('auto-generates id when none supplied', async () => {
    const adapter = createMemoryAdapter();
    const result = await createDiagram(adapter, makeCtx({ body: { name: 'New' } }));
    expect(result.status).toBe(201);
    expect(result.body.success).toBe(true);
    expect(result.body.id).toMatch(/^diagram_[a-z0-9_]+$/);
    const stored = decodeJson(adapter, `diagrams/${result.body.id}`);
    expect(stored.name).toBe('New');
    expect(stored.id).toBe(result.body.id);
    expect(stored.created).toMatch(/^\d{4}-/);
    expect(stored.lastModified).toMatch(/^\d{4}-/);
  });

  test('honours caller-supplied id', async () => {
    const adapter = createMemoryAdapter();
    const result = await createDiagram(adapter, makeCtx({ body: { id: 'mine', name: 'Mine' } }));
    expect(result.body.id).toBe('mine');
    expect(decodeJson(adapter, 'diagrams/mine').name).toBe('Mine');
  });

  test('throws 409 when caller-supplied id already exists', async () => {
    const adapter = createMemoryAdapter();
    putJson(adapter, 'diagrams/dup', { id: 'dup' });
    await expectHttpError(createDiagram(adapter, makeCtx({ body: { id: 'dup' } })), 409, /already exists/);
  });

  test('throws 400 on invalid caller-supplied id', async () => {
    const adapter = createMemoryAdapter();
    await expectHttpError(createDiagram(adapter, makeCtx({ body: { id: '../escape' } })), 400, /Invalid id/);
  });

  test('auto-generated ids are distinct across rapid sequential calls (MQA #21 regression)', async () => {
    const adapter = createMemoryAdapter();
    const ids = new Set();
    for (let i = 0; i < 5; i++) {
      const r = await createDiagram(adapter, makeCtx({ body: { name: `n${i}` } }));
      ids.add(r.body.id);
    }
    expect(ids.size).toBe(5);
  });
});

describe('saveDiagram', () => {
  test('overwrites existing diagram and refreshes lastModified', async () => {
    const adapter = createMemoryAdapter();
    putJson(adapter, 'diagrams/d1', { id: 'd1', name: 'old', lastModified: '2020-01-01' });
    const result = await saveDiagram(
      adapter,
      makeCtx({ params: { id: 'd1' }, body: { name: 'new', items: [{ id: 'i1' }] } })
    );
    expect(result.status).toBe(200);
    const stored = decodeJson(adapter, 'diagrams/d1');
    expect(stored.name).toBe('new');
    expect(stored.items).toEqual([{ id: 'i1' }]);
    expect(stored.lastModified).not.toBe('2020-01-01');
  });

  test('creates diagram if missing (PUT semantics)', async () => {
    const adapter = createMemoryAdapter();
    await saveDiagram(adapter, makeCtx({ params: { id: 'fresh' }, body: { name: 'F' } }));
    expect(decodeJson(adapter, 'diagrams/fresh').name).toBe('F');
  });

  test('throws 400 on invalid id', async () => {
    const adapter = createMemoryAdapter();
    await expectHttpError(saveDiagram(adapter, makeCtx({ params: { id: 'bad/id' }, body: {} })), 400, /Invalid id/);
  });
});

describe('patchDiagram', () => {
  test('merges body onto existing diagram, refreshes lastModified, keeps id', async () => {
    const adapter = createMemoryAdapter();
    putJson(adapter, 'diagrams/d1', { id: 'd1', name: 'A', extra: 1, lastModified: '2020-01-01' });
    const result = await patchDiagram(adapter, makeCtx({ params: { id: 'd1' }, body: { name: 'B' } }));
    expect(result.status).toBe(200);
    const stored = decodeJson(adapter, 'diagrams/d1');
    expect(stored.name).toBe('B');
    expect(stored.extra).toBe(1);
    expect(stored.id).toBe('d1');
    expect(stored.lastModified).not.toBe('2020-01-01');
  });

  test('throws 404 when diagram missing', async () => {
    const adapter = createMemoryAdapter();
    await expectHttpError(patchDiagram(adapter, makeCtx({ params: { id: 'gone' }, body: {} })), 404, /not found/);
  });

  test('throws 400 on invalid id', async () => {
    const adapter = createMemoryAdapter();
    await expectHttpError(patchDiagram(adapter, makeCtx({ params: { id: '#bad' }, body: {} })), 400, /Invalid id/);
  });
});

describe('moveDiagram', () => {
  test('sets folderId to provided target', async () => {
    const adapter = createMemoryAdapter();
    putJson(adapter, 'diagrams/d1', { id: 'd1', folderId: null });
    await moveDiagram(adapter, makeCtx({ params: { id: 'd1' }, body: { targetFolderId: 'f1' } }));
    expect(decodeJson(adapter, 'diagrams/d1').folderId).toBe('f1');
  });

  test('sets folderId to null when target omitted or null (move to root)', async () => {
    const adapter = createMemoryAdapter();
    putJson(adapter, 'diagrams/d1', { id: 'd1', folderId: 'f1' });
    await moveDiagram(adapter, makeCtx({ params: { id: 'd1' }, body: { targetFolderId: null } }));
    expect(decodeJson(adapter, 'diagrams/d1').folderId).toBe(null);
    putJson(adapter, 'diagrams/d1', { id: 'd1', folderId: 'f1' });
    await moveDiagram(adapter, makeCtx({ params: { id: 'd1' }, body: {} }));
    expect(decodeJson(adapter, 'diagrams/d1').folderId).toBe(null);
  });

  test('throws 404 when diagram missing', async () => {
    const adapter = createMemoryAdapter();
    await expectHttpError(moveDiagram(adapter, makeCtx({ params: { id: 'gone' }, body: {} })), 404, /not found/);
  });

  test('throws 400 on invalid id', async () => {
    const adapter = createMemoryAdapter();
    await expectHttpError(moveDiagram(adapter, makeCtx({ params: { id: '..' }, body: {} })), 400, /Invalid id/);
  });

  test('throws 400 on invalid targetFolderId', async () => {
    const adapter = createMemoryAdapter();
    putJson(adapter, 'diagrams/d1', { id: 'd1' });
    await expectHttpError(
      moveDiagram(adapter, makeCtx({ params: { id: 'd1' }, body: { targetFolderId: 'bad id!' } })),
      400,
      /Invalid targetFolderId/
    );
  });
});

describe('deleteDiagram', () => {
  test('deletes diagram and reports success', async () => {
    const adapter = createMemoryAdapter();
    putJson(adapter, 'diagrams/d1', { id: 'd1' });
    const result = await deleteDiagram(adapter, makeCtx({ params: { id: 'd1' } }));
    expect(result.status).toBe(200);
    expect(adapter._store.has('diagrams/d1')).toBe(false);
  });

  test('cascades to public/<uuid> snapshot when shareUuid is set', async () => {
    const adapter = createMemoryAdapter();
    const uuid = 'A'.repeat(21);
    putJson(adapter, 'diagrams/d1', { id: 'd1', shareUuid: uuid });
    putJson(adapter, `public/${uuid}`, { sourceId: 'd1' });
    await deleteDiagram(adapter, makeCtx({ params: { id: 'd1' } }));
    expect(adapter._store.has('diagrams/d1')).toBe(false);
    expect(adapter._store.has(`public/${uuid}`)).toBe(false);
  });

  test('ignores malformed shareUuid (no cascade attempt)', async () => {
    const adapter = createMemoryAdapter();
    putJson(adapter, 'diagrams/d1', { id: 'd1', shareUuid: 'too-short' });
    const result = await deleteDiagram(adapter, makeCtx({ params: { id: 'd1' } }));
    expect(result.status).toBe(200);
  });

  test('throws 404 when missing', async () => {
    const adapter = createMemoryAdapter();
    await expectHttpError(deleteDiagram(adapter, makeCtx({ params: { id: 'gone' } })), 404, /not found/);
  });

  test('throws 400 on invalid id', async () => {
    const adapter = createMemoryAdapter();
    await expectHttpError(deleteDiagram(adapter, makeCtx({ params: { id: 'bad id' } })), 400, /Invalid id/);
  });
});
