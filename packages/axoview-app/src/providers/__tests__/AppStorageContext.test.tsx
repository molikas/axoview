import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { AppStorageProvider, useAppStorage } from '../AppStorageContext';

// AppStorageProvider runs `fetchRuntimeConfig()` and `manager.initialize()` in
// parallel via Promise.all (see AppStorageContext.tsx). This test pins that
// invariant so a regression to sequential `await` would be caught: with both
// endpoints mocked to delay ~200ms each, total init must be ≈200ms (parallel),
// not ≈400ms (sequential).
//
// Single test per file by design — AppStorageProvider uses a module-level
// `manager` singleton and fetchRuntimeConfig caches its result, neither of
// which is cleanly resettable between tests without breaking React's hooks
// dispatcher via jest.resetModules.

describe('AppStorageProvider', () => {
  test('runs runtime-config and storage probes in parallel during init', async () => {
    const PROBE_DELAY = 200;
    const callTimes: number[] = [];
    (global as any).fetch = async (input: RequestInfo | URL) => {
      callTimes.push(Date.now());
      const url = String(input);
      await new Promise((r) => setTimeout(r, PROBE_DELAY));
      if (url.includes('/api/config')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ authMode: 'none' })
        } as Response;
      }
      // /api/storage/status
      return {
        ok: true,
        status: 200,
        json: async () => ({ enabled: false })
      } as Response;
    };

    let observedInitialized = false;
    function InitObserver() {
      const { isInitialized } = useAppStorage();
      React.useEffect(() => {
        if (isInitialized) observedInitialized = true;
      }, [isInitialized]);
      return null;
    }

    const t0 = Date.now();
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
    const elapsed = Date.now() - t0;

    // Both fetches must have been kicked off within a small window of each
    // other (parallel) — not one-after-the-other.
    expect(callTimes.length).toBeGreaterThanOrEqual(2);
    const callGap = Math.abs(callTimes[1] - callTimes[0]);
    expect(callGap).toBeLessThan(50);

    // Total init must be ≈ PROBE_DELAY, not 2 × PROBE_DELAY.
    // Generous upper bound to absorb React/jest overhead.
    expect(elapsed).toBeLessThan(PROBE_DELAY * 1.8);
    expect(elapsed).toBeGreaterThanOrEqual(PROBE_DELAY - 20);
  }, 5000);
});
