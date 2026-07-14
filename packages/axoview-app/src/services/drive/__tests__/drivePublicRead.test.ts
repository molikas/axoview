import { readDriveDisplayFile } from '../drivePublicRead';
import { useAuthStore } from '../../../stores/authStore';

function mockResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  } as Response;
}

let fetchMock: jest.Mock;

function signedIn(): void {
  useAuthStore.setState({
    status: 'AUTHENTICATED',
    accessToken: 'test-token',
    expiresAt: Date.now() + 3600_000,
    user: null,
    _requestToken: null,
    _revoke: null,
    _waiters: []
  });
}

function signedOut(): void {
  useAuthStore.setState({
    status: 'UNAUTHENTICATED',
    accessToken: null,
    expiresAt: null,
    user: null,
    _requestToken: null,
    _revoke: null,
    _waiters: []
  });
}

function headersOf(call: unknown[]): Record<string, string> {
  return ((call[1] as RequestInit | undefined)?.headers ?? {}) as Record<string, string>;
}

beforeEach(() => {
  signedOut();
  fetchMock = jest.fn();
  (global as unknown as { fetch: unknown }).fetch = fetchMock;
});

describe('readDriveDisplayFile — ladder ordering', () => {
  test('public proxy read succeeds → returns data without touching the token rung', async () => {
    const doc = { title: 'Public', items: [] };
    fetchMock.mockResolvedValueOnce(mockResponse(doc));
    const result = await readDriveDisplayFile({
      fileId: 'fid',
      resourceKey: null,
      publicPreview: true
    });
    expect(result).toEqual({ ok: true, data: doc });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = fetchMock.mock.calls[0][0] as string;
    // Rung 1 goes to OUR server proxy — the API key never appears client-side.
    expect(url).toContain('/api/public/drive/fid');
    expect(url).not.toContain('key=');
    expect(url).not.toContain('googleapis.com');
    expect(headersOf(fetchMock.mock.calls[0]).Authorization).toBeUndefined();
  });

  test('failed proxy read falls through to the token read (proxy first, Bearer second)', async () => {
    signedIn();
    const doc = { title: 'Granted' };
    fetchMock
      .mockResolvedValueOnce(mockResponse({ error: 'not-public' }, 404))
      .mockResolvedValueOnce(mockResponse(doc));
    const result = await readDriveDisplayFile({
      fileId: 'fid',
      resourceKey: null,
      publicPreview: true
    });
    expect(result).toEqual({ ok: true, data: doc });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain('/api/public/drive/fid');
    expect(fetchMock.mock.calls[1][0]).toContain('googleapis.com');
    expect(fetchMock.mock.calls[1][0]).not.toContain('/api/public/');
    expect(headersOf(fetchMock.mock.calls[1]).Authorization).toBe('Bearer test-token');
  });

  test('publicPreview false skips rung 1 — token read is the first fetch', async () => {
    signedIn();
    fetchMock.mockResolvedValueOnce(mockResponse({ title: 'Own' }));
    const result = await readDriveDisplayFile({
      fileId: 'fid',
      resourceKey: null,
      publicPreview: false
    });
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('googleapis.com');
    expect(headersOf(fetchMock.mock.calls[0]).Authorization).toBe('Bearer test-token');
  });

  test('afterGrant skips the public proxy rung (a just-granted file is private)', async () => {
    signedIn();
    fetchMock.mockResolvedValueOnce(mockResponse({ title: 'Granted' }));
    const result = await readDriveDisplayFile({
      fileId: 'fid',
      resourceKey: null,
      publicPreview: true,
      afterGrant: true
    });
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('googleapis.com');
    expect(headersOf(fetchMock.mock.calls[0]).Authorization).toBe('Bearer test-token');
  });

  test('proxy 410 (trashed/deleted) → not-found terminal, never falls to the token rung', async () => {
    signedIn();
    fetchMock.mockResolvedValueOnce(mockResponse({ error: 'gone' }, 410));
    const result = await readDriveDisplayFile({
      fileId: 'fid',
      resourceKey: null,
      publicPreview: true
    });
    expect(result).toEqual({ ok: false, reason: 'not-found' });
    // Signed in, so a fall-through would make a 2nd (token) call — assert it didn't.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('/api/public/drive/fid');
  });

  test('proxy 413 (too-large public file) → not-found terminal, no token rung', async () => {
    signedIn();
    fetchMock.mockResolvedValueOnce(mockResponse({ error: 'too-large' }, 413));
    const result = await readDriveDisplayFile({
      fileId: 'fid',
      resourceKey: null,
      publicPreview: true
    });
    expect(result).toEqual({ ok: false, reason: 'not-found' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('proxy 503 (transient) → transient/Retry for an ANONYMOUS viewer, never the sign-in gate', async () => {
    // Signed out: pre-fix, a transient outage on a public file wrongly demanded
    // sign-in (which cannot help). Now it maps to Retry without a token rung.
    fetchMock.mockResolvedValueOnce(mockResponse({ error: 'upstream-error' }, 503));
    const result = await readDriveDisplayFile({
      fileId: 'fid',
      resourceKey: null,
      publicPreview: true
    });
    expect(result).toEqual({ ok: false, reason: 'transient' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('publicPreview false + signed out → needs-signin with zero network calls', async () => {
    const result = await readDriveDisplayFile({
      fileId: 'fid',
      resourceKey: null,
      publicPreview: false
    });
    expect(result).toEqual({ ok: false, reason: 'needs-signin' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('readDriveDisplayFile — resourceKey', () => {
  test('rides the proxy URL on rung 1 and the header on the token rung', async () => {
    signedIn();
    fetchMock
      .mockResolvedValueOnce(mockResponse({ error: 'not-public' }, 404))
      .mockResolvedValueOnce(mockResponse({ title: 'X' }));
    await readDriveDisplayFile({
      fileId: 'fid',
      resourceKey: 'rk-1',
      publicPreview: true
    });
    expect(fetchMock.mock.calls[0][0]).toContain('resourceKey=rk-1');
    expect(headersOf(fetchMock.mock.calls[1])['X-Goog-Drive-Resource-Keys']).toBe('fid/rk-1');
  });

  test('absent → no resourceKey on the proxy URL nor the token header', async () => {
    signedIn();
    fetchMock
      .mockResolvedValueOnce(mockResponse({ error: 'not-public' }, 404))
      .mockResolvedValueOnce(mockResponse({ title: 'X' }));
    await readDriveDisplayFile({
      fileId: 'fid',
      resourceKey: null,
      publicPreview: true
    });
    expect(fetchMock.mock.calls[0][0]).not.toContain('resourceKey=');
    expect(headersOf(fetchMock.mock.calls[1])['X-Goog-Drive-Resource-Keys']).toBeUndefined();
  });
});

describe('readDriveDisplayFile — failure mapping', () => {
  test('token read 403 → needs-grant (per-file Picker grant missing)', async () => {
    signedIn();
    fetchMock.mockResolvedValueOnce(mockResponse({ error: 'appNotAuthorizedToFile' }, 403));
    const result = await readDriveDisplayFile({
      fileId: 'fid',
      resourceKey: null,
      publicPreview: false
    });
    expect(result).toEqual({ ok: false, reason: 'needs-grant' });
  });

  test('token read 404 → needs-grant (drive.file hides ungranted files)', async () => {
    signedIn();
    fetchMock.mockResolvedValueOnce(mockResponse({ error: 'notFound' }, 404));
    const result = await readDriveDisplayFile({
      fileId: 'fid',
      resourceKey: null,
      publicPreview: false
    });
    expect(result).toEqual({ ok: false, reason: 'needs-grant' });
  });

  test('404 after the Picker grant → not-found (terminal)', async () => {
    signedIn();
    fetchMock.mockResolvedValueOnce(mockResponse({ error: 'notFound' }, 404));
    const result = await readDriveDisplayFile({
      fileId: 'fid',
      resourceKey: null,
      publicPreview: false,
      afterGrant: true
    });
    expect(result).toEqual({ ok: false, reason: 'not-found' });
  });

  test('token read 401 → needs-signin AND arms the auth-store expiry', async () => {
    signedIn();
    fetchMock.mockResolvedValueOnce(mockResponse({ error: 'unauthorized' }, 401));
    const result = await readDriveDisplayFile({
      fileId: 'fid',
      resourceKey: null,
      publicPreview: false
    });
    expect(result).toEqual({ ok: false, reason: 'needs-signin' });
    // markExpired() nulls the token + flips to SESSION_EXPIRED so getValidToken
    // can't re-hand the dead token to the gate's auto-retry (no spin loop).
    expect(useAuthStore.getState().status).toBe('SESSION_EXPIRED');
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  test('token read 403 rateLimitExceeded → transient (not needs-grant)', async () => {
    signedIn();
    fetchMock.mockResolvedValueOnce(
      mockResponse(
        { error: { errors: [{ reason: 'rateLimitExceeded' }] } },
        403
      )
    );
    const result = await readDriveDisplayFile({
      fileId: 'fid',
      resourceKey: null,
      publicPreview: false
    });
    expect(result).toEqual({ ok: false, reason: 'transient' });
  });

  test('token read 5xx → transient', async () => {
    signedIn();
    fetchMock.mockResolvedValueOnce(mockResponse({ error: 'backend' }, 503));
    const result = await readDriveDisplayFile({
      fileId: 'fid',
      resourceKey: null,
      publicPreview: false
    });
    expect(result).toEqual({ ok: false, reason: 'transient' });
  });

  test('network failure on both rungs → transient', async () => {
    signedIn();
    fetchMock.mockRejectedValue(new Error('offline'));
    const result = await readDriveDisplayFile({
      fileId: 'fid',
      resourceKey: null,
      publicPreview: true
    });
    expect(result).toEqual({ ok: false, reason: 'transient' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
