import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { AppStorageProvider, useAppStorage } from '../AppStorageContext';

// Post-collapse single-probe contract (ADR 0009 D2). The previous version of
// this test pinned dual-probe parallelism; that invariant is no longer
// relevant because /api/storage/status is gone and mode now comes from a
// single /api/config response. The replacement test asserts:
//   1. exactly one fetch fires during boot,
//   2. its URL is /api/config,
//   3. AppStorageContext propagates the serverStorage flag from that response
//      onto isServerStorage (so consumers gate the session-mode UI correctly).
//
// Single test per file by design — AppStorageProvider uses a module-level
// `manager` singleton and fetchRuntimeConfig caches its result, neither of
// which is cleanly resettable between tests without breaking React's hooks
// dispatcher via jest.resetModules.

describe('AppStorageProvider', () => {
  test('issues a single /api/config probe and derives mode from its serverStorage flag', async () => {
    const fetchedUrls: string[] = [];
    (global as any).fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      fetchedUrls.push(url);
      if (url.includes('/api/config')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ authMode: 'shared-token', serverStorage: true })
        } as Response;
      }
      throw new Error(`unexpected fetch during boot: ${url}`);
    };

    let observedInitialized = false;
    let observedServerStorage: boolean | null = null;
    function InitObserver() {
      const { isInitialized, isServerStorage } = useAppStorage();
      React.useEffect(() => {
        if (isInitialized) {
          observedInitialized = true;
          observedServerStorage = isServerStorage;
        }
      }, [isInitialized, isServerStorage]);
      return null;
    }

    await act(async () => {
      render(
        <AppStorageProvider>
          <InitObserver />
        </AppStorageProvider>
      );
    });
    await waitFor(() => expect(observedInitialized).toBe(true), {
      timeout: 2000
    });

    // Exactly one boot probe.
    expect(fetchedUrls).toHaveLength(1);
    expect(fetchedUrls[0]).toMatch(/\/api\/config$/);
    // No legacy /api/storage/status probe.
    expect(fetchedUrls.some((u) => u.includes('/api/storage/status'))).toBe(false);
    // Mode derived from the config's serverStorage boolean.
    expect(observedServerStorage).toBe(true);
  }, 5000);
});
