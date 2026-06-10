import { apiBaseUrl } from '../utils/apiBaseUrl';

export interface RuntimeConfig {
  googleClientId: string | null;
  driveScopes: string[];
  authMode: 'none' | 'shared-token' | 'cf-access';
  serverStorage: boolean;
}

const DEFAULT_CONFIG: RuntimeConfig = {
  googleClientId: null,
  driveScopes: ['https://www.googleapis.com/auth/drive.file'],
  authMode: 'none',
  serverStorage: false
};

let cached: RuntimeConfig | null = null;
let inflight: Promise<RuntimeConfig> | null = null;

export async function fetchRuntimeConfig(): Promise<RuntimeConfig> {
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      // 800ms is generous for any healthy backend (docker prod ≈45ms) and
      // caps the worst case when the backend is absent — Chrome/Windows can
      // otherwise spend ~2s on a dual-stack connect probe before reporting
      // ECONNREFUSED to JS.
      const response = await fetch(`${apiBaseUrl()}/api/config`, {
        signal: AbortSignal.timeout(800)
      });
      if (!response.ok) throw new Error(String(response.status));
      const data = (await response.json()) as Partial<RuntimeConfig>;
      cached = { ...DEFAULT_CONFIG, ...data };
    } catch (err) {
      // ADR 0009 D2: explicit Local-mode fallback on /api/config failure.
      // The previous silent swallow hid backend outages on boot.
      console.warn(
        '[useRuntimeConfig] /api/config probe failed; falling back to defaults (Local mode)',
        err
      );
      cached = { ...DEFAULT_CONFIG };
    }
    return cached;
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}
