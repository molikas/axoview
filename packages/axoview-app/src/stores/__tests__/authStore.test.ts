import { useAuthStore } from '../authStore';
import { useNotificationStore } from '../notificationStore';

function reset() {
  useAuthStore.setState({
    status: 'UNAUTHENTICATED',
    user: null,
    accessToken: null,
    expiresAt: null,
    driveScopeGranted: null,
    _requestToken: null,
    _revoke: null,
    _waiters: [],
    _absorbStaleError: false
  });
  useNotificationStore.setState({ queue: [] });
  localStorage.clear(); // profile-hint isolation between tests
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

  test('driveScopeGranted tracks the ACTUALLY granted scopes (granular consent)', async () => {
    useAuthStore.getState()._setBridge({ requestToken: jest.fn(), revoke: jest.fn() });
    // Granted with the Drive checkbox checked.
    let p = useAuthStore.getState().signIn();
    useAuthStore.getState()._onToken({
      access_token: 'tok',
      expires_in: 3600,
      scope: 'openid email profile https://www.googleapis.com/auth/drive.file'
    });
    await p;
    expect(useAuthStore.getState().driveScopeGranted).toBe(true);
    // signOut clears the flag along with the session.
    useAuthStore.getState().signOut();
    expect(useAuthStore.getState().driveScopeGranted).toBeNull();
    // Granted with the Drive checkbox left UNCHECKED — identity only.
    p = useAuthStore.getState().signIn();
    useAuthStore.getState()._onToken({
      access_token: 'tok2',
      expires_in: 3600,
      scope: 'openid email profile'
    });
    await p;
    expect(useAuthStore.getState().status).toBe('AUTHENTICATED');
    expect(useAuthStore.getState().driveScopeGranted).toBe(false);
  });

  test('a scope-less token response (older GIS shape) does not false-alarm', async () => {
    useAuthStore.getState()._setBridge({ requestToken: jest.fn(), revoke: jest.fn() });
    const p = useAuthStore.getState().signIn();
    useAuthStore.getState()._onToken({ access_token: 'tok', expires_in: 3600 });
    await p;
    expect(useAuthStore.getState().driveScopeGranted).toBe(true);
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

  // ---------------------------------------------------------------------------
  // Remember-me (storage-ux-unification 2026-07-06): profile hint + silent
  // boot reconnect. The hint persists IDENTITY only — the token test above
  // still guards that no credential ever reaches localStorage.
  // ---------------------------------------------------------------------------

  test('a successful grant persists the profile hint (identity only)', async () => {
    (global as unknown as { fetch: unknown }).fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ name: 'Igor', email: 'igor@example.com', picture: 'http://x/a.png' })
    }));
    useAuthStore.getState()._setBridge({ requestToken: jest.fn(), revoke: jest.fn() });
    const p = useAuthStore.getState().signIn();
    useAuthStore.getState()._onToken({ access_token: 'tok', expires_in: 3600 });
    await p;
    // fetchUserInfo is fire-and-forget; flush the microtask queue.
    await new Promise((r) => setTimeout(r, 0));
    const raw = localStorage.getItem('axoview-google-profile');
    expect(raw).toContain('igor@example.com');
    expect(raw).not.toContain('tok');
    expect(useAuthStore.getState().user?.email).toBe('igor@example.com');
  });

  test('signOut() clears the profile hint', async () => {
    localStorage.setItem(
      'axoview-google-profile',
      JSON.stringify({ name: 'Igor', email: 'i@x.y', avatarUrl: '' })
    );
    useAuthStore.getState()._setBridge({ requestToken: jest.fn(), revoke: jest.fn() });
    useAuthStore.setState({ status: 'AUTHENTICATED', accessToken: 'tok', expiresAt: Date.now() + 100000 });
    useAuthStore.getState().signOut();
    expect(localStorage.getItem('axoview-google-profile')).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });

  test('attemptSilentReconnect() is a no-op without a hint or bridge', async () => {
    const requestToken = jest.fn();
    // No user (no hint) → no-op even with a bridge.
    useAuthStore.getState()._setBridge({ requestToken, revoke: jest.fn() });
    await useAuthStore.getState().attemptSilentReconnect();
    expect(requestToken).not.toHaveBeenCalled();
    expect(useAuthStore.getState().status).toBe('UNAUTHENTICATED');
  });

  test('attemptSilentReconnect() → RECONNECTING → AUTHENTICATED on silent grant', async () => {
    const requestToken = jest.fn();
    useAuthStore.getState()._setBridge({ requestToken, revoke: jest.fn() });
    useAuthStore.setState({ user: { name: 'Igor', email: 'i@x.y', avatarUrl: '' } });
    const p = useAuthStore.getState().attemptSilentReconnect();
    expect(useAuthStore.getState().status).toBe('RECONNECTING');
    // Silent requests must carry the login_hint — a multi-account browser
    // fails a hint-less prompt:'' with "interaction required".
    expect(requestToken).toHaveBeenCalledWith({ prompt: '', hint: 'i@x.y' });
    useAuthStore.getState()._onToken({ access_token: 'tok', expires_in: 3600 });
    await p;
    expect(useAuthStore.getState().status).toBe('AUTHENTICATED');
  });

  test('a failed silent reconnect degrades QUIETLY (no toast, hint kept)', async () => {
    useAuthStore.getState()._setBridge({ requestToken: jest.fn(), revoke: jest.fn() });
    useAuthStore.setState({ user: { name: 'Igor', email: 'i@x.y', avatarUrl: '' } });
    const p = useAuthStore.getState().attemptSilentReconnect();
    useAuthStore.getState()._onError(new Error('cookies blocked'));
    await p;
    expect(useAuthStore.getState().status).toBe('UNAUTHENTICATED');
    // Quiet: neither the info "cancelled" toast nor the expired warning fires.
    expect(useNotificationStore.getState().queue.length).toBe(0);
    // The identity stays so the avatar can show the reconnect affordance.
    expect(useAuthStore.getState().user?.name).toBe('Igor');
  });

  test('getValidToken() piggybacks on an in-flight reconnect instead of double-requesting', async () => {
    const requestToken = jest.fn();
    useAuthStore.getState()._setBridge({ requestToken, revoke: jest.fn() });
    useAuthStore.setState({ user: { name: 'Igor', email: 'i@x.y', avatarUrl: '' } });
    const reconnect = useAuthStore.getState().attemptSilentReconnect();
    const tokenP = useAuthStore.getState().getValidToken();
    expect(requestToken).toHaveBeenCalledTimes(1); // no second GIS request
    useAuthStore.getState()._onToken({ access_token: 'tok', expires_in: 3600 });
    await reconnect;
    await expect(tokenP).resolves.toBe('tok');
  });

  // ---------------------------------------------------------------------------
  // Superseded-request error absorption: GIS gives no request correlation, so
  // when an interactive signIn overlaps an in-flight silent request, the
  // silent request's late error must not cancel the interactive attempt.
  // ---------------------------------------------------------------------------

  test('a late silent-reconnect error cannot cancel an interactive signIn (grant still lands)', async () => {
    const requestToken = jest.fn();
    useAuthStore.getState()._setBridge({ requestToken, revoke: jest.fn() });
    useAuthStore.setState({ user: { name: 'Igor', email: 'i@x.y', avatarUrl: '' } });
    const silent = useAuthStore.getState().attemptSilentReconnect();
    expect(useAuthStore.getState().status).toBe('RECONNECTING');
    const interactive = useAuthStore.getState().signIn(); // supersedes the silent attempt
    expect(useAuthStore.getState().status).toBe('AUTHENTICATING');
    // The superseded silent request fails late — absorbed, not a cancel.
    useAuthStore.getState()._onError(new Error('popup_failed_to_open'));
    expect(useAuthStore.getState().status).toBe('AUTHENTICATING');
    expect(useNotificationStore.getState().queue.length).toBe(0); // no "cancelled" toast
    // The user's popup grant lands normally.
    useAuthStore.getState()._onToken({ access_token: 'tok', expires_in: 3600 });
    await Promise.all([silent, interactive]);
    expect(useAuthStore.getState().status).toBe('AUTHENTICATED');
    expect(useAuthStore.getState().accessToken).toBe('tok');
  });

  test('only ONE error is absorbed — the next error is the popup\'s own cancel', async () => {
    useAuthStore.getState()._setBridge({ requestToken: jest.fn(), revoke: jest.fn() });
    useAuthStore.setState({ user: { name: 'Igor', email: 'i@x.y', avatarUrl: '' } });
    void useAuthStore.getState().attemptSilentReconnect();
    const interactive = useAuthStore.getState().signIn();
    useAuthStore.getState()._onError(new Error('late silent failure')); // absorbed
    useAuthStore.getState()._onError(new Error('popup_closed')); // the real cancel
    await interactive;
    expect(useAuthStore.getState().status).toBe('UNAUTHENTICATED');
  });
});
