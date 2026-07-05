import { GoogleDriveProvider } from '../providers/GoogleDriveProvider';
import { useAuthStore } from '../../../stores/authStore';
import { useNotificationStore } from '../../../stores/notificationStore';

function mockResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  } as Response;
}

let fetchMock: jest.Mock;

/** Provider with the root pre-resolved (skips ensureRoot's network) + fast retries. */
function makeProvider(): GoogleDriveProvider {
  const p = new GoogleDriveProvider();
  (p as unknown as { rootFolderId: string }).rootFolderId = 'root';
  (p as unknown as { retryDelays: number[] }).retryDelays = [0, 0, 0];
  return p;
}

beforeEach(() => {
  useAuthStore.setState({
    status: 'AUTHENTICATED',
    accessToken: 'test-token',
    expiresAt: Date.now() + 3600_000,
    user: null,
    _requestToken: null,
    _revoke: null,
    _waiters: []
  });
  useNotificationStore.setState({ queue: [] });
  localStorage.clear();
  fetchMock = jest.fn();
  (global as unknown as { fetch: unknown }).fetch = fetchMock;
});

describe('GoogleDriveProvider', () => {
  test('listDiagrams maps Drive files → DiagramMeta[] and excludes the manifest', async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse({
        files: [
          { id: 'd1', name: 'Alpha', modifiedTime: '2026-07-05T10:00:00Z', parents: ['root'] },
          { id: 'sub', name: 'Beta', modifiedTime: '2026-07-05T11:00:00Z', parents: ['folderX'] },
          { id: 'm', name: 'axoview-manifest.json', modifiedTime: '2026-07-05T09:00:00Z', parents: ['root'] }
        ]
      })
    );
    const list = await makeProvider().listDiagrams();
    expect(list).toEqual([
      { id: 'd1', name: 'Alpha', lastModified: '2026-07-05T10:00:00Z', folderId: null },
      { id: 'sub', name: 'Beta', lastModified: '2026-07-05T11:00:00Z', folderId: 'folderX' }
    ]);
  });

  test('loadDiagram fetches media and returns parsed JSON', async () => {
    const doc = { title: 'X', items: [] };
    fetchMock.mockResolvedValueOnce(mockResponse(doc));
    await expect(makeProvider().loadDiagram('d1')).resolves.toEqual(doc);
    expect(fetchMock.mock.calls[0][0]).toContain('/files/d1?alt=media');
  });

  test('saveDiagram sends a media PATCH with a JSON content-type', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ id: 'd1' }));
    await makeProvider().saveDiagram('d1', { title: 'Y' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/upload/drive/v3/files/d1?uploadType=media');
    expect((init as RequestInit).method).toBe('PATCH');
    expect((init as { headers: Record<string, string> }).headers['Content-Type']).toBe(
      'application/json'
    );
  });

  test('createDiagram uploads into the root folder and returns the new id', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ id: 'new-id' }));
    const id = await makeProvider().createDiagram({ title: 'Fresh' }, null);
    expect(id).toBe('new-id');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/upload/drive/v3/files?uploadType=multipart');
    const body = (init as { body: string }).body;
    expect(body).toContain('"parents":["root"]');
    expect(body).toContain('Fresh');
  });

  test('deleteDiagram trashes (never hard-deletes)', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ id: 'd1' }));
    await makeProvider().deleteDiagram('d1');
    const [url, init] = fetchMock.mock.calls[0];
    expect((init as RequestInit).method).toBe('PATCH');
    expect((init as { body: string }).body).toContain('"trashed":true');
    expect(url).not.toContain('uploadType');
  });

  test('moveItem swaps parents', async () => {
    fetchMock
      .mockResolvedValueOnce(mockResponse({ parents: ['oldFolder'] }))
      .mockResolvedValueOnce(mockResponse({ id: 'd1' }));
    await makeProvider().moveItem('d1', 'diagram', 'newFolder');
    const patchUrl = fetchMock.mock.calls[1][0] as string;
    expect(patchUrl).toContain('addParents=newFolder');
    expect(patchUrl).toContain('removeParents=oldFolder');
  });

  test('401 forces SESSION_EXPIRED and throws', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ error: 'unauthorized' }, 401));
    await expect(makeProvider().loadDiagram('d1')).rejects.toThrow();
    expect(useAuthStore.getState().status).toBe('SESSION_EXPIRED');
  });

  test('retries a transient 503 then succeeds', async () => {
    fetchMock
      .mockResolvedValueOnce(mockResponse({ error: 'busy' }, 503))
      .mockResolvedValueOnce(mockResponse({ error: 'busy' }, 503))
      .mockResolvedValueOnce(mockResponse({ ok: true }));
    await expect(makeProvider().loadDiagram('d1')).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test('gives up after exhausting retries', async () => {
    fetchMock.mockResolvedValue(mockResponse({ error: 'busy' }, 503));
    await expect(makeProvider().loadDiagram('d1')).rejects.toThrow(/503/);
    expect(fetchMock).toHaveBeenCalledTimes(4); // initial + 3 retries
  });

  test('a permanent 403 (Drive API disabled) fails fast, surfacing Google\'s message', async () => {
    fetchMock.mockResolvedValue(
      mockResponse(
        {
          error: {
            code: 403,
            status: 'PERMISSION_DENIED',
            message:
              'Google Drive API has not been used in project 485371025824 before or it is disabled.'
          }
        },
        403
      )
    );
    await expect(makeProvider().loadDiagram('d1')).rejects.toThrow(/has not been used/);
    expect(fetchMock).toHaveBeenCalledTimes(1); // no retry storm
  });

  test('a rate-limit 403 IS retried', async () => {
    fetchMock
      .mockResolvedValueOnce(
        mockResponse({ error: { errors: [{ reason: 'userRateLimitExceeded' }] } }, 403)
      )
      .mockResolvedValueOnce(mockResponse({ ok: true }));
    await expect(makeProvider().loadDiagram('d1')).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('root discovery: adopts an existing marker folder', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ files: [{ id: 'existing-root' }] }));
    const p = new GoogleDriveProvider();
    (p as unknown as { retryDelays: number[] }).retryDelays = [0, 0, 0];
    await expect(p.hasConfiguredRoot()).resolves.toBe(true);
    expect(localStorage.getItem('axoview-drive-root')).toBe('existing-root');
  });

  test('root discovery: no marker → not configured', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ files: [] }));
    const p = new GoogleDriveProvider();
    (p as unknown as { retryDelays: number[] }).retryDelays = [0, 0, 0];
    await expect(p.hasConfiguredRoot()).resolves.toBe(false);
  });

  test('reads the token via getValidToken only — unauth throws before any fetch', async () => {
    useAuthStore.setState({ status: 'UNAUTHENTICATED', accessToken: null, expiresAt: null });
    await expect(makeProvider().loadDiagram('d1')).rejects.toThrow(/signed in/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
