import { jest } from '@jest/globals';
import {
  listFolders,
  createFolder,
  renameFolder,
  deleteFolder,
  moveFolder,
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

let warnSpy;
beforeEach(() => {
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warnSpy.mockRestore();
});

describe('listFolders', () => {
  test('returns empty array when no folders.json', async () => {
    const adapter = createMemoryAdapter();
    const result = await listFolders(adapter, makeCtx());
    expect(result.status).toBe(200);
    expect(result.body).toEqual([]);
  });

  test('returns folders when array shape', async () => {
    const adapter = createMemoryAdapter();
    const folders = [
      { id: 'a', name: 'A', parentId: null },
      { id: 'b', name: 'B', parentId: 'a' }
    ];
    putJson(adapter, 'folders', folders);
    const result = await listFolders(adapter, makeCtx());
    expect(result.body).toEqual(folders);
  });

  test('filters by parentId query string', async () => {
    const adapter = createMemoryAdapter();
    putJson(adapter, 'folders', [
      { id: 'a', name: 'A', parentId: null },
      { id: 'b', name: 'B', parentId: 'a' },
      { id: 'c', name: 'C', parentId: 'a' }
    ]);
    const result = await listFolders(adapter, makeCtx({ query: { parentId: 'a' } }));
    expect(result.body.map((f) => f.id).sort()).toEqual(['b', 'c']);
  });

  test('coerces legacy { folders: [...] } shape (MQA #21 regression)', async () => {
    const adapter = createMemoryAdapter();
    putJson(adapter, 'folders', { folders: [{ id: 'a', name: 'A', parentId: null }] });
    const result = await listFolders(adapter, makeCtx());
    expect(result.body).toEqual([{ id: 'a', name: 'A', parentId: null }]);
    expect(warnSpy).toHaveBeenCalled();
  });

  test('falls back to empty array on unexpected shape', async () => {
    const adapter = createMemoryAdapter();
    putJson(adapter, 'folders', { not: 'a-list' });
    const result = await listFolders(adapter, makeCtx());
    expect(result.body).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
  });
});

describe('createFolder', () => {
  test('creates folder with auto-generated id', async () => {
    const adapter = createMemoryAdapter();
    const result = await createFolder(adapter, makeCtx({ body: { name: 'Inbox' } }));
    expect(result.status).toBe(201);
    expect(result.body.id).toMatch(/^folder_[a-z0-9_]+$/);
    const folders = decodeJson(adapter, 'folders');
    expect(folders).toHaveLength(1);
    expect(folders[0]).toMatchObject({ name: 'Inbox', parentId: null });
  });

  test('preserves parentId when supplied', async () => {
    const adapter = createMemoryAdapter();
    putJson(adapter, 'folders', [{ id: 'p1', name: 'P', parentId: null }]);
    const result = await createFolder(adapter, makeCtx({ body: { name: 'Child', parentId: 'p1' } }));
    expect(result.body.id).toBeTruthy();
    const folders = decodeJson(adapter, 'folders');
    const child = folders.find((f) => f.id === result.body.id);
    expect(child.parentId).toBe('p1');
  });

  test('throws 400 when name is missing or non-string', async () => {
    const adapter = createMemoryAdapter();
    await expectHttpError(createFolder(adapter, makeCtx({ body: {} })), 400, /name is required/);
    await expectHttpError(createFolder(adapter, makeCtx({ body: { name: '' } })), 400, /name is required/);
    await expectHttpError(createFolder(adapter, makeCtx({ body: { name: 42 } })), 400, /name is required/);
  });

  test('throws 400 on invalid parentId', async () => {
    const adapter = createMemoryAdapter();
    await expectHttpError(
      createFolder(adapter, makeCtx({ body: { name: 'X', parentId: 'bad id!' } })),
      400,
      /Invalid parentId/
    );
  });

  test('auto-generated ids stay distinct across rapid sequential calls', async () => {
    const adapter = createMemoryAdapter();
    const ids = new Set();
    for (let i = 0; i < 5; i++) {
      const r = await createFolder(adapter, makeCtx({ body: { name: `n${i}` } }));
      ids.add(r.body.id);
    }
    expect(ids.size).toBe(5);
  });
});

describe('renameFolder', () => {
  test('renames existing folder', async () => {
    const adapter = createMemoryAdapter();
    putJson(adapter, 'folders', [{ id: 'a', name: 'old', parentId: null }]);
    const result = await renameFolder(adapter, makeCtx({ params: { id: 'a' }, body: { name: 'new' } }));
    expect(result.status).toBe(200);
    expect(decodeJson(adapter, 'folders')[0].name).toBe('new');
  });

  test('throws 404 when folder missing', async () => {
    const adapter = createMemoryAdapter();
    putJson(adapter, 'folders', []);
    await expectHttpError(
      renameFolder(adapter, makeCtx({ params: { id: 'gone' }, body: { name: 'x' } })),
      404,
      /Folder not found/
    );
  });

  test('throws 400 on invalid id', async () => {
    const adapter = createMemoryAdapter();
    await expectHttpError(
      renameFolder(adapter, makeCtx({ params: { id: 'bad id' }, body: { name: 'x' } })),
      400,
      /Invalid id/
    );
  });

  test('throws 400 when name missing', async () => {
    const adapter = createMemoryAdapter();
    putJson(adapter, 'folders', [{ id: 'a', name: 'A', parentId: null }]);
    await expectHttpError(
      renameFolder(adapter, makeCtx({ params: { id: 'a' }, body: {} })),
      400,
      /name is required/
    );
  });
});

describe('deleteFolder', () => {
  test('non-recursive deletes single folder', async () => {
    const adapter = createMemoryAdapter();
    putJson(adapter, 'folders', [
      { id: 'a', name: 'A', parentId: null },
      { id: 'b', name: 'B', parentId: null }
    ]);
    const result = await deleteFolder(adapter, makeCtx({ params: { id: 'a' } }));
    expect(result.status).toBe(200);
    expect(decodeJson(adapter, 'folders').map((f) => f.id)).toEqual(['b']);
  });

  test('non-recursive throws 404 when folder missing', async () => {
    const adapter = createMemoryAdapter();
    putJson(adapter, 'folders', []);
    await expectHttpError(deleteFolder(adapter, makeCtx({ params: { id: 'gone' } })), 404, /Folder not found/);
  });

  test('recursive deletes folder + descendants + sweeps orphan diagrams (MQA #14)', async () => {
    const adapter = createMemoryAdapter();
    putJson(adapter, 'folders', [
      { id: 'root', name: 'R', parentId: null },
      { id: 'child', name: 'C', parentId: 'root' },
      { id: 'sibling', name: 'S', parentId: null }
    ]);
    putJson(adapter, 'diagrams/d1', { id: 'd1', folderId: 'root' });
    putJson(adapter, 'diagrams/d2', { id: 'd2', folderId: 'child' });
    putJson(adapter, 'diagrams/d3', { id: 'd3', folderId: 'sibling' });

    await deleteFolder(adapter, makeCtx({ params: { id: 'root' }, query: { recursive: 'true' } }));

    expect(decodeJson(adapter, 'folders').map((f) => f.id)).toEqual(['sibling']);
    expect(adapter._store.has('diagrams/d1')).toBe(false);
    expect(adapter._store.has('diagrams/d2')).toBe(false);
    expect(adapter._store.has('diagrams/d3')).toBe(true);
  });

  test('recursive sweep cascades to public/<uuid> for diagrams with shareUuid', async () => {
    const adapter = createMemoryAdapter();
    const uuid = 'B'.repeat(21);
    putJson(adapter, 'folders', [{ id: 'root', name: 'R', parentId: null }]);
    putJson(adapter, 'diagrams/d1', { id: 'd1', folderId: 'root', shareUuid: uuid });
    putJson(adapter, `public/${uuid}`, { sourceId: 'd1' });

    await deleteFolder(adapter, makeCtx({ params: { id: 'root' }, query: { recursive: 'true' } }));

    expect(adapter._store.has('diagrams/d1')).toBe(false);
    expect(adapter._store.has(`public/${uuid}`)).toBe(false);
  });

  test('recursive accepts boolean true as well as string "true"', async () => {
    const adapter = createMemoryAdapter();
    putJson(adapter, 'folders', [{ id: 'r', name: 'R', parentId: null }]);
    await deleteFolder(adapter, makeCtx({ params: { id: 'r' }, query: { recursive: true } }));
    expect(decodeJson(adapter, 'folders')).toEqual([]);
  });

  test('throws 400 on invalid id', async () => {
    const adapter = createMemoryAdapter();
    await expectHttpError(deleteFolder(adapter, makeCtx({ params: { id: 'bad id' } })), 400, /Invalid id/);
  });
});

describe('moveFolder', () => {
  test('moves folder under a new parent', async () => {
    const adapter = createMemoryAdapter();
    putJson(adapter, 'folders', [
      { id: 'a', name: 'A', parentId: null },
      { id: 'b', name: 'B', parentId: null }
    ]);
    await moveFolder(adapter, makeCtx({ params: { id: 'b' }, body: { targetFolderId: 'a' } }));
    expect(decodeJson(adapter, 'folders').find((f) => f.id === 'b').parentId).toBe('a');
  });

  test('moves folder to root when target null/omitted', async () => {
    const adapter = createMemoryAdapter();
    putJson(adapter, 'folders', [{ id: 'b', name: 'B', parentId: 'a' }]);
    await moveFolder(adapter, makeCtx({ params: { id: 'b' }, body: { targetFolderId: null } }));
    expect(decodeJson(adapter, 'folders')[0].parentId).toBe(null);
  });

  test('throws 404 when folder missing', async () => {
    const adapter = createMemoryAdapter();
    putJson(adapter, 'folders', []);
    await expectHttpError(moveFolder(adapter, makeCtx({ params: { id: 'gone' }, body: {} })), 404, /Folder not found/);
  });

  test('throws 400 on invalid id', async () => {
    const adapter = createMemoryAdapter();
    await expectHttpError(moveFolder(adapter, makeCtx({ params: { id: 'bad id' }, body: {} })), 400, /Invalid id/);
  });

  test('throws 400 on invalid targetFolderId', async () => {
    const adapter = createMemoryAdapter();
    putJson(adapter, 'folders', [{ id: 'a', name: 'A', parentId: null }]);
    await expectHttpError(
      moveFolder(adapter, makeCtx({ params: { id: 'a' }, body: { targetFolderId: 'bad id' } })),
      400,
      /Invalid targetFolderId/
    );
  });
});
