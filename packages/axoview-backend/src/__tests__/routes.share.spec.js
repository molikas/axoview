import {
  shareDiagram,
  unshareDiagram,
  getPublicSnapshot,
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

const VALID_UUID = 'A'.repeat(21);
const VALID_UUID_LONGER = 'B'.repeat(40);

describe('shareDiagram', () => {
  test('creates new snapshot + uuid when diagram has no shareUuid', async () => {
    const adapter = createMemoryAdapter();
    putJson(adapter, 'diagrams/d1', {
      id: 'd1',
      name: 'N',
      title: 'T',
      items: [{ id: 'i1' }],
      colors: [{ id: 'c1' }],
      views: [{ id: 'v1' }]
    });

    const result = await shareDiagram(
      adapter,
      makeCtx({ params: { id: 'd1' }, publicBaseUrl: 'https://x.example' })
    );

    expect(result.status).toBe(200);
    expect(result.body.uuid).toMatch(/^[A-Za-z0-9_-]{21}$/);
    expect(result.body.url).toBe(`https://x.example/display/p/${result.body.uuid}`);
    expect(result.body.sharedAt).toMatch(/^\d{4}-/);

    const snapshot = decodeJson(adapter, `public/${result.body.uuid}`);
    expect(snapshot).toMatchObject({
      title: 'T',
      name: 'N',
      items: [{ id: 'i1' }],
      colors: [{ id: 'c1' }],
      views: [{ id: 'v1' }],
      icons: [],
      fitToScreen: true,
      sourceId: 'd1'
    });

    const updated = decodeJson(adapter, 'diagrams/d1');
    expect(updated.shareUuid).toBe(result.body.uuid);
    expect(updated.lastModified).toBeTruthy();
  });

  test('reuses existing valid shareUuid + does NOT touch diagram lastModified', async () => {
    const adapter = createMemoryAdapter();
    putJson(adapter, 'diagrams/d1', {
      id: 'd1',
      name: 'N',
      shareUuid: VALID_UUID,
      lastModified: '2020-01-01T00:00:00Z'
    });

    const result = await shareDiagram(
      adapter,
      makeCtx({ params: { id: 'd1' }, publicBaseUrl: 'http://localhost' })
    );

    expect(result.body.uuid).toBe(VALID_UUID);
    expect(decodeJson(adapter, 'diagrams/d1').lastModified).toBe('2020-01-01T00:00:00Z');
    expect(decodeJson(adapter, `public/${VALID_UUID}`)).toBeTruthy();
  });

  test('regenerates uuid when stored shareUuid is malformed', async () => {
    const adapter = createMemoryAdapter();
    putJson(adapter, 'diagrams/d1', { id: 'd1', name: 'N', shareUuid: 'too-short' });
    const result = await shareDiagram(
      adapter,
      makeCtx({ params: { id: 'd1' }, publicBaseUrl: '' })
    );
    expect(result.body.uuid).toMatch(/^[A-Za-z0-9_-]{21}$/);
    expect(result.body.uuid).not.toBe('too-short');
    expect(decodeJson(adapter, 'diagrams/d1').shareUuid).toBe(result.body.uuid);
  });

  test('accepts existing 40-char shareUuid (UUID_PATTERN allows 21-64)', async () => {
    const adapter = createMemoryAdapter();
    putJson(adapter, 'diagrams/d1', { id: 'd1', name: 'N', shareUuid: VALID_UUID_LONGER });
    const result = await shareDiagram(adapter, makeCtx({ params: { id: 'd1' } }));
    expect(result.body.uuid).toBe(VALID_UUID_LONGER);
  });

  test('snapshot falls back to defaults when diagram lacks optional fields', async () => {
    const adapter = createMemoryAdapter();
    putJson(adapter, 'diagrams/d1', { id: 'd1' });
    const result = await shareDiagram(adapter, makeCtx({ params: { id: 'd1' } }));
    const snapshot = decodeJson(adapter, `public/${result.body.uuid}`);
    expect(snapshot).toMatchObject({
      title: 'Untitled Diagram',
      name: 'Untitled Diagram',
      icons: [],
      colors: [],
      items: [],
      views: [],
      fitToScreen: true,
      sourceId: 'd1'
    });
  });

  test('honours diagram.fitToScreen === false', async () => {
    const adapter = createMemoryAdapter();
    putJson(adapter, 'diagrams/d1', { id: 'd1', fitToScreen: false });
    const result = await shareDiagram(adapter, makeCtx({ params: { id: 'd1' } }));
    expect(decodeJson(adapter, `public/${result.body.uuid}`).fitToScreen).toBe(false);
  });

  test('coerces non-array items/colors/views/icons fields to []', async () => {
    const adapter = createMemoryAdapter();
    putJson(adapter, 'diagrams/d1', {
      id: 'd1',
      items: 'oops',
      colors: null,
      views: { not: 'array' },
      icons: 42
    });
    const result = await shareDiagram(adapter, makeCtx({ params: { id: 'd1' } }));
    const snapshot = decodeJson(adapter, `public/${result.body.uuid}`);
    expect(snapshot.items).toEqual([]);
    expect(snapshot.colors).toEqual([]);
    expect(snapshot.views).toEqual([]);
    expect(snapshot.icons).toEqual([]);
  });

  test('throws 404 when diagram missing', async () => {
    const adapter = createMemoryAdapter();
    await expectHttpError(shareDiagram(adapter, makeCtx({ params: { id: 'gone' } })), 404, /not found/);
  });

  test('throws 400 on invalid id', async () => {
    const adapter = createMemoryAdapter();
    await expectHttpError(shareDiagram(adapter, makeCtx({ params: { id: 'bad id' } })), 400, /Invalid id/);
  });
});

describe('unshareDiagram', () => {
  test('removes snapshot, strips shareUuid, refreshes lastModified', async () => {
    const adapter = createMemoryAdapter();
    putJson(adapter, 'diagrams/d1', {
      id: 'd1',
      shareUuid: VALID_UUID,
      lastModified: '2020-01-01T00:00:00Z'
    });
    putJson(adapter, `public/${VALID_UUID}`, { sourceId: 'd1' });

    const result = await unshareDiagram(adapter, makeCtx({ params: { id: 'd1' } }));

    expect(result.status).toBe(200);
    expect(result.body.success).toBe(true);
    expect(adapter._store.has(`public/${VALID_UUID}`)).toBe(false);
    const updated = decodeJson(adapter, 'diagrams/d1');
    expect(updated.shareUuid).toBeUndefined();
    expect(updated.lastModified).not.toBe('2020-01-01T00:00:00Z');
  });

  test('no-op success when diagram has no shareUuid', async () => {
    const adapter = createMemoryAdapter();
    putJson(adapter, 'diagrams/d1', { id: 'd1', lastModified: '2020-01-01T00:00:00Z' });
    const result = await unshareDiagram(adapter, makeCtx({ params: { id: 'd1' } }));
    expect(result.status).toBe(200);
    expect(decodeJson(adapter, 'diagrams/d1').lastModified).toBe('2020-01-01T00:00:00Z');
  });

  test('ignores malformed shareUuid (cascade skipped, field not stripped)', async () => {
    const adapter = createMemoryAdapter();
    putJson(adapter, 'diagrams/d1', { id: 'd1', shareUuid: 'too-short' });
    const result = await unshareDiagram(adapter, makeCtx({ params: { id: 'd1' } }));
    expect(result.status).toBe(200);
    expect(decodeJson(adapter, 'diagrams/d1').shareUuid).toBe('too-short');
  });

  test('throws 404 when diagram missing', async () => {
    const adapter = createMemoryAdapter();
    await expectHttpError(unshareDiagram(adapter, makeCtx({ params: { id: 'gone' } })), 404, /not found/);
  });

  test('throws 400 on invalid id', async () => {
    const adapter = createMemoryAdapter();
    await expectHttpError(unshareDiagram(adapter, makeCtx({ params: { id: 'bad id' } })), 400, /Invalid id/);
  });
});

describe('getPublicSnapshot', () => {
  test('returns snapshot when present', async () => {
    const adapter = createMemoryAdapter();
    const snapshot = { title: 'T', name: 'T', items: [], sourceId: 'd1' };
    putJson(adapter, `public/${VALID_UUID}`, snapshot);
    const result = await getPublicSnapshot(adapter, makeCtx({ params: { uuid: VALID_UUID } }));
    expect(result.status).toBe(200);
    expect(result.body).toEqual(snapshot);
  });

  test('throws 404 when snapshot missing', async () => {
    const adapter = createMemoryAdapter();
    await expectHttpError(
      getPublicSnapshot(adapter, makeCtx({ params: { uuid: VALID_UUID } })),
      404,
      /Snapshot not found/
    );
  });

  test('throws 400 on UUID below 21 chars', async () => {
    const adapter = createMemoryAdapter();
    await expectHttpError(
      getPublicSnapshot(adapter, makeCtx({ params: { uuid: 'too-short' } })),
      400,
      /Invalid uuid/
    );
  });

  test('throws 400 on UUID over 64 chars', async () => {
    const adapter = createMemoryAdapter();
    await expectHttpError(
      getPublicSnapshot(adapter, makeCtx({ params: { uuid: 'a'.repeat(65) } })),
      400,
      /Invalid uuid/
    );
  });

  test('throws 400 on UUID with disallowed characters', async () => {
    const adapter = createMemoryAdapter();
    await expectHttpError(
      getPublicSnapshot(adapter, makeCtx({ params: { uuid: '!!!!!!!!!!!!!!!!!!!!!' } })),
      400,
      /Invalid uuid/
    );
  });
});
