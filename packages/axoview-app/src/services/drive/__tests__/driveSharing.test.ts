import {
  drivePreviewUrl,
  getFileShareMeta,
  getAccessSummary,
  openNativeShareDialog
} from '../driveSharing';
import { loadGapiModule } from '../gapiLoader';
import { useAuthStore } from '../../../stores/authStore';

jest.mock('../gapiLoader', () => ({
  loadGapiModule: jest.fn()
}));
const loadGapiModuleMock = loadGapiModule as jest.Mock;

function mockResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  } as Response;
}

let fetchMock: jest.Mock;
let windowOpenMock: jest.Mock;

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
  fetchMock = jest.fn();
  (global as unknown as { fetch: unknown }).fetch = fetchMock;
  windowOpenMock = jest.fn();
  window.open = windowOpenMock as unknown as typeof window.open;
  loadGapiModuleMock.mockReset();
});

describe('drivePreviewUrl', () => {
  // jsdom origin is http://localhost; APP_BASENAME is '/app' (PUBLIC_URL unset).
  test('builds origin + APP_BASENAME + /display/drive/<fileId>', () => {
    expect(drivePreviewUrl('file-1')).toBe(
      'http://localhost/app/display/drive/file-1'
    );
  });

  test('appends ?resourceKey= only when non-null', () => {
    expect(drivePreviewUrl('file-1', 'rk-9')).toBe(
      'http://localhost/app/display/drive/file-1?resourceKey=rk-9'
    );
    expect(drivePreviewUrl('file-1', null)).toBe(
      'http://localhost/app/display/drive/file-1'
    );
  });

  test('URL-encodes the resourceKey', () => {
    expect(drivePreviewUrl('f', 'a/b&c')).toBe(
      'http://localhost/app/display/drive/f?resourceKey=a%2Fb%26c'
    );
  });
});

describe('getFileShareMeta', () => {
  test('requests webViewLink,resourceKey with the auth token and maps nulls', async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse({ webViewLink: 'https://drive.google.com/file/d/f1/view' })
    );
    await expect(getFileShareMeta('f1')).resolves.toEqual({
      webViewLink: 'https://drive.google.com/file/d/f1/view',
      resourceKey: null
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/files/f1?fields=webViewLink,resourceKey');
    expect((init as { headers: Record<string, string> }).headers.Authorization).toBe(
      'Bearer test-token'
    );
  });

  test('throws on a non-OK response', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ error: {} }, 404));
    await expect(getFileShareMeta('f1')).rejects.toThrow('404');
  });
});

describe('getAccessSummary', () => {
  test("maps a type:'anyone' permission → anyone-with-link", async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse({
        permissions: [
          { type: 'user', role: 'owner' },
          { type: 'anyone', role: 'reader' }
        ]
      })
    );
    await expect(getAccessSummary('f1')).resolves.toBe('anyone-with-link');
    expect(fetchMock.mock.calls[0][0]).toContain('/files/f1/permissions');
  });

  test('maps user-only permissions → restricted', async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse({ permissions: [{ type: 'user', role: 'owner' }] })
    );
    await expect(getAccessSummary('f1')).resolves.toBe('restricted');
  });

  test('maps a missing permissions array → restricted', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({}));
    await expect(getAccessSummary('f1')).resolves.toBe('restricted');
  });

  test("drains nextPageToken — an 'anyone' grant on page 2 → anyone-with-link", async () => {
    fetchMock
      .mockResolvedValueOnce(
        mockResponse({
          permissions: [{ type: 'user', role: 'owner' }],
          nextPageToken: 'page-2'
        })
      )
      .mockResolvedValueOnce(
        mockResponse({ permissions: [{ type: 'anyone', role: 'reader' }] })
      );
    await expect(getAccessSummary('f1')).resolves.toBe('anyone-with-link');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // The second request carried the drained page token.
    expect(fetchMock.mock.calls[1][0]).toContain('pageToken=page-2');
  });

  test('restricted only after ALL pages are drained (no early short-circuit)', async () => {
    fetchMock
      .mockResolvedValueOnce(
        mockResponse({
          permissions: [{ type: 'user', role: 'owner' }],
          nextPageToken: 'page-2'
        })
      )
      .mockResolvedValueOnce(
        mockResponse({ permissions: [{ type: 'user', role: 'writer' }] })
      );
    await expect(getAccessSummary('f1')).resolves.toBe('restricted');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('openNativeShareDialog', () => {
  test('drives the ShareClient with token + itemIds on success', async () => {
    const client = {
      setOAuthToken: jest.fn(),
      setItemIds: jest.fn(),
      showSettingsDialog: jest.fn()
    };
    const ctor = jest.fn(() => client);
    loadGapiModuleMock.mockResolvedValueOnce({
      load: jest.fn(),
      drive: { share: { ShareClient: ctor } }
    });
    await openNativeShareDialog('f1', '123456789012');
    expect(ctor).toHaveBeenCalledWith('123456789012');
    expect(client.setOAuthToken).toHaveBeenCalledWith('test-token');
    expect(client.setItemIds).toHaveBeenCalledWith(['f1']);
    expect(client.showSettingsDialog).toHaveBeenCalled();
    expect(windowOpenMock).not.toHaveBeenCalled();
  });

  test('falls back to the API-returned webViewLink when gapi load rejects', async () => {
    loadGapiModuleMock.mockRejectedValueOnce(new Error('cookies blocked'));
    fetchMock.mockResolvedValueOnce(
      mockResponse({ webViewLink: 'https://drive.google.com/file/d/f1/view' })
    );
    await openNativeShareDialog('f1', null);
    expect(windowOpenMock).toHaveBeenCalledWith(
      'https://drive.google.com/file/d/f1/view',
      '_blank',
      'noopener'
    );
  });

  test('falls back to open?id= when the webViewLink fetch also fails', async () => {
    loadGapiModuleMock.mockRejectedValueOnce(new Error('network'));
    fetchMock.mockResolvedValueOnce(mockResponse({ error: {} }, 403));
    await openNativeShareDialog('f1', null);
    expect(windowOpenMock).toHaveBeenCalledWith(
      'https://drive.google.com/open?id=f1',
      '_blank',
      'noopener'
    );
  });

  test('falls back when the module loads without a ShareClient constructor', async () => {
    loadGapiModuleMock.mockResolvedValueOnce({ load: jest.fn() });
    fetchMock.mockResolvedValueOnce(
      mockResponse({ webViewLink: 'https://drive.google.com/file/d/f1/view' })
    );
    await openNativeShareDialog('f1', null);
    expect(windowOpenMock).toHaveBeenCalledWith(
      'https://drive.google.com/file/d/f1/view',
      '_blank',
      'noopener'
    );
  });
});
