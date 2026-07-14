import { apiBaseUrl } from '../utils/apiBaseUrl';

export interface RuntimeConfig {
  googleClientId: string | null;
  googleApiKey: string | null;
  googleProjectNumber: string | null;
  driveScopes: string[];
  authMode: 'none' | 'shared-token' | 'cf-access';
  serverStorage: boolean;
}

// ADR 0035 §4: a pure-local `npm run dev` boot has no backend serving
// /api/config, so fall back to the build-time PUBLIC_GOOGLE_CLIENT_ID (rsbuild
// exposes PUBLIC_-prefixed vars to the browser bundle) so localhost:3000 — an
// authorized origin — can still start Google sign-in. Empty → null (Drive UI
// stays hidden). On Cloudflare this var is unset and the client id arrives via
// /api/config instead.
const BUILD_TIME_CLIENT_ID = process.env.PUBLIC_GOOGLE_CLIENT_ID || null;

// ADR 0042 §5: same build-time fallback pattern for the Drive preview values —
// null means the key-read rung and the Picker are unavailable (graceful
// degradation, not an error).
const BUILD_TIME_API_KEY = process.env.PUBLIC_GOOGLE_API_KEY || null;
const BUILD_TIME_PROJECT_NUMBER = process.env.PUBLIC_GOOGLE_PROJECT_NUMBER || null;

const DEFAULT_CONFIG: RuntimeConfig = {
  googleClientId: BUILD_TIME_CLIENT_ID,
  googleApiKey: BUILD_TIME_API_KEY,
  googleProjectNumber: BUILD_TIME_PROJECT_NUMBER,
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
      // The build-time id is a true fallback: if the backend omits or nulls
      // googleClientId, keep whatever was baked in at build (local dev).
      if (!cached.googleClientId) cached.googleClientId = BUILD_TIME_CLIENT_ID;
      if (!cached.googleApiKey) cached.googleApiKey = BUILD_TIME_API_KEY;
      if (!cached.googleProjectNumber) cached.googleProjectNumber = BUILD_TIME_PROJECT_NUMBER;
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
