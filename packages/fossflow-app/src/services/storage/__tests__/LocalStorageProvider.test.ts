import { LocalStorageProvider } from '../providers/LocalStorageProvider';

const BASE = 'http://localhost:3001';

// ---------------------------------------------------------------------------
// Fetch mock helpers
// ---------------------------------------------------------------------------

type FetchImpl = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function mockResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  } as Response;
}

function setFetch(impl: FetchImpl) {
  (global as any).fetch = impl;
}

function setFetchSequence(...responses: Array<Response | Error>) {
  let idx = 0;
  (global as any).fetch = async () => {
    const r = responses[idx++] ?? mockResponse({ error: 'no more mocks' }, 500);
    if (r instanceof Error) throw r;
    return r;
  };
}

// ---------------------------------------------------------------------------
// Provider factory
// ---------------------------------------------------------------------------

async function serverProvider(): Promise<LocalStorageProvider> {
  setFetchSequence(mockResponse({ enabled: true, version: '1.0.0' }));
  const p = new LocalStorageProvider(BASE);
  await p.isAvailable();
  expect(p.usingServer).toBe(true);
  return p;
}

async function offlineProvider(): Promise<LocalStorageProvider> {
  setFetchSequence(new Error('Network error'));
  const p = new LocalStorageProvider(BASE);
  await p.isAvailable();
  expect(p.usingServer).toBe(false);
  return p;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  (global as any).fetch = undefined;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LocalStorageProvider', () => {
  // ---- isAvailable ----------------------------------------------------------

  test('isAvailable() aborts a hanging /api/storage/status probe within ~1s and stays offline', async () => {
    // Mimic a downed backend that never responds — only the AbortSignal kills it.
    (global as any).fetch = (_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError'))
        );
      });
    const provider = new LocalStorageProvider(BASE);
    const t0 = Date.now();
    await provider.isAvailable();
    const elapsed = Date.now() - t0;
    // 800ms timeout + jitter — must NOT take the old 5000ms.
    expect(elapsed).toBeLessThan(1500);
    expect(elapsed).toBeGreaterThanOrEqual(700);
    expect(provider.usingServer).toBe(false);
  }, 3000);

  // ---- listDiagrams ---------------------------------------------------------

  test('listDiagrams() returns parsed list from server', async () => {
    const provider = await serverProvider();
    const serverDiagrams = [
      { id: 'diag-1', name: 'My Diagram', lastModified: '2026-04-14T10:00:00.000Z', folderId: null }
    ];
    setFetchSequence(mockResponse(serverDiagrams));

    const list = await provider.listDiagrams();

    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('diag-1');
    expect(list[0].name).toBe('My Diagram');
    expect(typeof list[0].lastModified).toBe('string');
    expect(list[0].folderId).toBeNull();
  });

  test('listDiagrams() falls back to sessionStorage when server unavailable', async () => {
    const provider = await offlineProvider();
    const meta = [
      { id: 'sess-1', name: 'Session Diagram', lastModified: '2026-01-01T00:00:00Z', folderId: null }
    ];
    sessionStorage.setItem('fossflow_diagrams', JSON.stringify(meta));

    const list = await provider.listDiagrams();

    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('sess-1');
  });

  // ---- saveDiagram ----------------------------------------------------------

  test('saveDiagram() sends correct PUT body', async () => {
    const provider = await serverProvider();

    let capturedBody: unknown;
    setFetch(async (_input, init) => {
      capturedBody = JSON.parse((init as RequestInit).body as string);
      return mockResponse({ success: true });
    });

    await provider.saveDiagram('diag-1', { title: 'Updated', items: [] });

    expect((capturedBody as any).title).toBe('Updated');
  });

  // ---- leanIfModel (ADR 0003 + requiredPacks) -------------------------------

  test('saveDiagram() strips pack icons but keeps imported icons (ADR 0003)', async () => {
    const provider = await serverProvider();

    let body: any;
    setFetch(async (_input, init) => {
      body = JSON.parse((init as RequestInit).body as string);
      return mockResponse({ success: true });
    });

    await provider.saveDiagram('d1', {
      items: [{ id: 'i1', name: 'n', icon: 'aws_ec2' }],
      icons: [
        { id: 'aws_ec2', name: 'EC2', url: 'data:x', collection: 'aws' },
        { id: 'iso_box', name: 'Box', url: 'data:x', collection: 'isoflow' },
        { id: 'usr_a', name: 'My logo', url: 'data:y', collection: 'imported' }
      ]
    });

    expect(body.icons).toHaveLength(1);
    expect(body.icons[0].id).toBe('usr_a');
  });

  test('saveDiagram() derives requiredPacks from items × full icons', async () => {
    const provider = await serverProvider();

    let body: any;
    setFetch(async (_input, init) => {
      body = JSON.parse((init as RequestInit).body as string);
      return mockResponse({ success: true });
    });

    await provider.saveDiagram('d1', {
      items: [
        { id: 'i1', name: 'n', icon: 'aws_ec2' },
        { id: 'i2', name: 'n', icon: 'material_Abc' },
        { id: 'i3', name: 'n', icon: 'iso_box' } // isoflow shouldn't appear
      ],
      icons: [
        { id: 'aws_ec2', name: 'EC2', url: 'd', collection: 'aws' },
        { id: 'aws_unused', name: 'X', url: 'd', collection: 'aws' }, // not used
        { id: 'gcp_unused', name: 'Y', url: 'd', collection: 'gcp' }, // not used
        { id: 'material_Abc', name: 'Abc', url: 'd', collection: 'material' },
        { id: 'iso_box', name: 'Box', url: 'd', collection: 'isoflow' }
      ]
    });

    expect(body.requiredPacks.sort()).toEqual(['aws', 'material']);
  });

  // Regression: the bug that prompted this work — re-importing a lean payload
  // (icons already stripped to imported-only) used to overwrite the good
  // requiredPacks list with [] because nothing in icons[] resolved against
  // items[]. Lean inputs must preserve the field they came in with.
  test('saveDiagram() preserves existing requiredPacks when input is already lean', async () => {
    const provider = await serverProvider();

    let body: any;
    setFetch(async (_input, init) => {
      body = JSON.parse((init as RequestInit).body as string);
      return mockResponse({ success: true });
    });

    await provider.saveDiagram('d1', {
      items: [
        { id: 'i1', name: 'n', icon: 'aws_ec2' },
        { id: 'i2', name: 'n', icon: 'material_Abc' }
      ],
      icons: [
        // Only an imported icon — pack icons have already been stripped
        { id: 'usr_a', name: 'logo', url: 'd', collection: 'imported' }
      ],
      requiredPacks: ['aws', 'material']
    });

    expect(body.requiredPacks.sort()).toEqual(['aws', 'material']);
  });

  // ---- createDiagram --------------------------------------------------------

  test('createDiagram() returns new id from server', async () => {
    const provider = await serverProvider();
    setFetchSequence(mockResponse({ success: true, id: 'new-diag-1' }, 201));

    const id = await provider.createDiagram({ title: 'New', items: [] });

    expect(id).toBe('new-diag-1');
  });

  // ---- deleteDiagram --------------------------------------------------------

  test('deleteDiagram(id, soft=true) sends PATCH with deletedAt, not DELETE', async () => {
    const provider = await serverProvider();

    let calledMethod: string | undefined;
    let capturedBody: unknown;
    setFetch(async (_input, init) => {
      calledMethod = (init as RequestInit)?.method;
      capturedBody = JSON.parse((init as RequestInit).body as string);
      return mockResponse({ success: true });
    });

    await provider.deleteDiagram('diag-1', true);

    expect(calledMethod).toBe('PATCH');
    expect((capturedBody as any).deletedAt).toBeTruthy();
  });

  test('deleteDiagram(id, soft=false) removes permanently via DELETE', async () => {
    const provider = await serverProvider();

    let calledMethod: string | undefined;
    setFetch(async (_input, init) => {
      calledMethod = (init as RequestInit)?.method;
      return mockResponse({ success: true });
    });

    await provider.deleteDiagram('diag-1', false);

    expect(calledMethod).toBe('DELETE');
  });

  // ---- createFolder ---------------------------------------------------------

  test('createFolder() creates and returns id', async () => {
    const provider = await serverProvider();
    setFetchSequence(mockResponse({ success: true, id: 'folder-1' }, 201));

    const id = await provider.createFolder('My Folder', null);

    expect(id).toBe('folder-1');
  });

  // ---- moveItem -------------------------------------------------------------

  test('moveItem() sends correct PATCH body for diagram', async () => {
    const provider = await serverProvider();

    let capturedBody: unknown;
    setFetch(async (_input, init) => {
      capturedBody = JSON.parse((init as RequestInit).body as string);
      return mockResponse({ success: true });
    });

    await provider.moveItem('diag-1', 'diagram', 'folder-42');

    expect((capturedBody as any).targetFolderId).toBe('folder-42');
  });

  // ---- renameDiagram (session) ---------------------------------------------

  // MQA #14: session-mode rename used to update the diagrams list only, leaving
  // the per-diagram blob's `title` stuck on the old name. The export path reads
  // from the blob, so any unopened-after-rename diagram exported with the old
  // title. Rename must now mirror the new name into the blob.
  test('renameDiagram (session) syncs blob.title + blob.name with new name', async () => {
    const provider = await offlineProvider();
    const meta = [
      { id: 'sess-1', name: 'Old Name', lastModified: '2026-01-01T00:00:00Z', folderId: null }
    ];
    sessionStorage.setItem('fossflow_diagrams', JSON.stringify(meta));
    sessionStorage.setItem(
      'fossflow_diagram_sess-1',
      JSON.stringify({ title: 'Old Name', items: [], views: [], icons: [], colors: [] })
    );

    await provider.renameDiagram('sess-1', 'New Name');

    const listAfter = JSON.parse(sessionStorage.getItem('fossflow_diagrams') ?? '[]');
    expect(listAfter[0].name).toBe('New Name');

    const blobAfter = JSON.parse(sessionStorage.getItem('fossflow_diagram_sess-1') ?? '{}');
    expect(blobAfter.title).toBe('New Name');
    expect(blobAfter.name).toBe('New Name');
  });

  test('renameDiagram (session) leaves listing rename in place when blob is corrupted', async () => {
    const provider = await offlineProvider();
    const meta = [
      { id: 'sess-1', name: 'Old Name', lastModified: '2026-01-01T00:00:00Z', folderId: null }
    ];
    sessionStorage.setItem('fossflow_diagrams', JSON.stringify(meta));
    sessionStorage.setItem('fossflow_diagram_sess-1', 'not-json');

    await expect(provider.renameDiagram('sess-1', 'New Name')).resolves.toBeUndefined();
    const listAfter = JSON.parse(sessionStorage.getItem('fossflow_diagrams') ?? '[]');
    expect(listAfter[0].name).toBe('New Name');
  });

  // ---- server timeout fallback ----------------------------------------------

  test('server unavailability falls back to sessionStorage for listDiagrams', async () => {
    const provider = await offlineProvider();

    const meta = [
      { id: 'fallback-1', name: 'Fallback', lastModified: '2026-01-01T00:00:00Z', folderId: null }
    ];
    sessionStorage.setItem('fossflow_diagrams', JSON.stringify(meta));

    const list = await provider.listDiagrams();

    expect(list[0].id).toBe('fallback-1');
  });
});
