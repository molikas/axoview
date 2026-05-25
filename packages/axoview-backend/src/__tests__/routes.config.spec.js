import { getConfig } from '../routes.js';
import { makeCtx } from './helpers/memoryAdapter.js';

describe('getConfig', () => {
  test('returns documented shape with defaults when env is empty', () => {
    const result = getConfig(null, makeCtx({ env: {} }));
    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      googleClientId: null,
      driveScopes: ['https://www.googleapis.com/auth/drive.file'],
      authMode: 'none',
      serverStorage: true
    });
  });

  test('reflects GOOGLE_CLIENT_ID + AUTH_MODE from env', () => {
    const result = getConfig(
      null,
      makeCtx({
        env: { GOOGLE_CLIENT_ID: 'client-123', AUTH_MODE: 'shared-token' }
      })
    );
    expect(result.body.googleClientId).toBe('client-123');
    expect(result.body.authMode).toBe('shared-token');
  });

  test('serverStorage is true unless STORAGE_ENABLED is explicitly false', () => {
    expect(getConfig(null, makeCtx({ env: { STORAGE_ENABLED: false } })).body.serverStorage).toBe(false);
    expect(getConfig(null, makeCtx({ env: { STORAGE_ENABLED: true } })).body.serverStorage).toBe(true);
    expect(getConfig(null, makeCtx({ env: {} })).body.serverStorage).toBe(true);
  });

  test('survives null ctx', () => {
    const result = getConfig(null, null);
    expect(result.status).toBe(200);
    expect(result.body.authMode).toBe('none');
  });
});
