import { useAuthStore } from '../authStore';
import { useNotificationStore } from '../notificationStore';

function reset() {
  useAuthStore.setState({
    status: 'UNAUTHENTICATED',
    user: null,
    accessToken: null,
    expiresAt: null,
    _requestToken: null,
    _revoke: null,
    _waiters: []
  });
  useNotificationStore.setState({ queue: [] });
}

beforeEach(() => {
  reset();
  // fetchUserInfo() fires fire-and-forget after a token; stub it benignly.
  (global as unknown as { fetch: unknown }).fetch = jest.fn(async () => ({
    ok: false,
    status: 404,
    json: async () => ({})
  }));
});

describe('authStore', () => {
  test('initial status is UNAUTHENTICATED', () => {
    expect(useAuthStore.getState().status).toBe('UNAUTHENTICATED');
  });

  test('signIn() moves to AUTHENTICATING then AUTHENTICATED on success', async () => {
    const requestToken = jest.fn();
    useAuthStore.getState()._setBridge({ requestToken, revoke: jest.fn() });
    const p = useAuthStore.getState().signIn();
    expect(useAuthStore.getState().status).toBe('AUTHENTICATING');
    expect(requestToken).toHaveBeenCalledTimes(1);
    useAuthStore.getState()._onToken({ access_token: 'tok', expires_in: 3600 });
    await p;
    expect(useAuthStore.getState().status).toBe('AUTHENTICATED');
    expect(useAuthStore.getState().accessToken).toBe('tok');
  });

  test('signIn() denial returns to UNAUTHENTICATED and pushes an info notice', async () => {
    useAuthStore.getState()._setBridge({ requestToken: jest.fn(), revoke: jest.fn() });
    const p = useAuthStore.getState().signIn();
    useAuthStore.getState()._onError(new Error('popup_closed'));
    await p;
    expect(useAuthStore.getState().status).toBe('UNAUTHENTICATED');
    expect(
      useNotificationStore.getState().queue.some((n) => n.severity === 'info')
    ).toBe(true);
  });

  test('the access token is never written to localStorage', async () => {
    const spy = jest.spyOn(Storage.prototype, 'setItem');
    useAuthStore.getState()._setBridge({ requestToken: jest.fn(), revoke: jest.fn() });
    const p = useAuthStore.getState().signIn();
    useAuthStore.getState()._onToken({ access_token: 'secret-token', expires_in: 3600 });
    await p;
    await useAuthStore.getState().getValidToken();
    useAuthStore.getState().signOut();
    const wroteToken = spy.mock.calls.some((c) => String(c[1]).includes('secret-token'));
    expect(wroteToken).toBe(false);
    spy.mockRestore();
  });

  test('getValidToken() returns the token when healthy (not near expiry)', async () => {
    useAuthStore.setState({
      status: 'AUTHENTICATED',
      accessToken: 'tok',
      expiresAt: Date.now() + 60 * 60 * 1000
    });
    await expect(useAuthStore.getState().getValidToken()).resolves.toBe('tok');
  });

  test('getValidToken() attempts a silent refresh when near expiry', async () => {
    const requestToken = jest.fn();
    useAuthStore.getState()._setBridge({ requestToken, revoke: jest.fn() });
    useAuthStore.setState({
      status: 'AUTHENTICATED',
      accessToken: 'old',
      expiresAt: Date.now() + 1000
    });
    const p = useAuthStore.getState().getValidToken();
    expect(useAuthStore.getState().status).toBe('REFRESHING');
    expect(requestToken).toHaveBeenCalledWith({ prompt: '' });
    useAuthStore.getState()._onToken({ access_token: 'new', expires_in: 3600 });
    await expect(p).resolves.toBe('new');
    expect(useAuthStore.getState().status).toBe('AUTHENTICATED');
  });

  test('getValidToken() returns null when unauthenticated', async () => {
    await expect(useAuthStore.getState().getValidToken()).resolves.toBeNull();
  });

  test('signOut() clears status + token and revokes', () => {
    const revoke = jest.fn();
    useAuthStore.getState()._setBridge({ requestToken: jest.fn(), revoke });
    useAuthStore.setState({
      status: 'AUTHENTICATED',
      accessToken: 'tok',
      expiresAt: Date.now() + 100000
    });
    useAuthStore.getState().signOut();
    expect(useAuthStore.getState().status).toBe('UNAUTHENTICATED');
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(revoke).toHaveBeenCalledWith('tok');
  });

  test('a failed refresh moves to SESSION_EXPIRED with a persistent re-signin notice', async () => {
    useAuthStore.getState()._setBridge({ requestToken: jest.fn(), revoke: jest.fn() });
    useAuthStore.setState({
      status: 'AUTHENTICATED',
      accessToken: 'old',
      expiresAt: Date.now() + 1000
    });
    const p = useAuthStore.getState().getValidToken();
    useAuthStore.getState()._onError(new Error('refresh failed'));
    await expect(p).resolves.toBeNull();
    expect(useAuthStore.getState().status).toBe('SESSION_EXPIRED');
    const notice = useNotificationStore
      .getState()
      .queue.find((n) => n.severity === 'warning');
    expect(notice?.persistent).toBe(true);
    expect(notice?.action?.label).toBe('Sign in again');
  });

  test('signOut settles an in-flight refresh and a late grant cannot resurrect the session', async () => {
    useAuthStore.getState()._setBridge({ requestToken: jest.fn(), revoke: jest.fn() });
    useAuthStore.setState({
      status: 'AUTHENTICATED',
      accessToken: 'old',
      expiresAt: Date.now() + 1000
    });
    const pending = useAuthStore.getState().getValidToken(); // REFRESHING + waiter
    expect(useAuthStore.getState().status).toBe('REFRESHING');
    useAuthStore.getState().signOut();
    await expect(pending).resolves.toBeNull(); // settled, not hung
    expect(useAuthStore.getState().status).toBe('UNAUTHENTICATED');
    // A late grant from the abandoned request must be ignored, not resurrect.
    useAuthStore.getState()._onToken({ access_token: 'new', expires_in: 3600 });
    expect(useAuthStore.getState().status).toBe('UNAUTHENTICATED');
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  test('markExpired settles an in-flight refresh (getValidToken resolves null)', async () => {
    useAuthStore.getState()._setBridge({ requestToken: jest.fn(), revoke: jest.fn() });
    useAuthStore.setState({
      status: 'AUTHENTICATED',
      accessToken: 'old',
      expiresAt: Date.now() + 1000
    });
    const pending = useAuthStore.getState().getValidToken();
    useAuthStore.getState().markExpired();
    await expect(pending).resolves.toBeNull();
    expect(useAuthStore.getState().status).toBe('SESSION_EXPIRED');
  });

  test('markExpired() forces SESSION_EXPIRED exactly once', () => {
    useAuthStore.setState({
      status: 'AUTHENTICATED',
      accessToken: 'tok',
      expiresAt: Date.now() + 100000
    });
    useAuthStore.getState().markExpired();
    expect(useAuthStore.getState().status).toBe('SESSION_EXPIRED');
    expect(useAuthStore.getState().accessToken).toBeNull();
    const before = useNotificationStore.getState().queue.length;
    useAuthStore.getState().markExpired();
    expect(useNotificationStore.getState().queue.length).toBe(before);
  });
});
