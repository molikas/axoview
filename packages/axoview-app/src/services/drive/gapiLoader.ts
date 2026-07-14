/**
 * On-demand loader for the Google API platform script (gapi) and the Google
 * Picker module ('picker'), used by the read-only display route's per-file
 * access grant (ADR 0042 §2 rung 3). The script is injected once per page; the
 * module loads once. CSP already allows `script-src https://apis.google.com`
 * (ADR 0035), so no header change is needed for the script itself.
 * (The 'drive-share' ShareClient module was dropped 2026-07-14 — access
 * management moved to the Drive REST v3 permissions API; see driveSharing.ts.)
 */
const GAPI_SRC = 'https://apis.google.com/js/api.js';

// gapi.load supports a config-object form alongside the bare-callback form; we
// use it so a failed/blocked module load can REJECT instead of hanging.
interface GapiLoadConfig {
  callback: () => void;
  onerror?: (reason?: unknown) => void;
  timeout?: number;
  ontimeout?: () => void;
}

export type Gapi = {
  load: (name: string, config: GapiLoadConfig | (() => void)) => void;
} & Record<string, unknown>;

// A module that never finishes loading (blocked network, CSP, cookie policy)
// would otherwise leave every awaiter — the Picker gate button, the share
// dialog — spinning forever. Bound it.
const MODULE_LOAD_TIMEOUT_MS = 15_000;

declare global {
  interface Window {
    gapi?: Gapi;
  }
}

let scriptPromise: Promise<Gapi> | null = null;
const modulePromises = new Map<string, Promise<Gapi>>();

function loadScript(): Promise<Gapi> {
  if (window.gapi) return Promise.resolve(window.gapi);
  if (!scriptPromise) {
    scriptPromise = new Promise<Gapi>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = GAPI_SRC;
      script.async = true;
      script.onload = () => {
        if (window.gapi) {
          resolve(window.gapi);
        } else {
          scriptPromise = null;
          reject(new Error('gapi script loaded without window.gapi'));
        }
      };
      script.onerror = () => {
        // Reset so a transient network failure can be retried on next call.
        scriptPromise = null;
        reject(new Error('Failed to load the Google API script'));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

export function loadGapiModule(name: 'picker'): Promise<Gapi> {
  let promise = modulePromises.get(name);
  if (!promise) {
    promise = loadScript().then(
      (gapi) =>
        new Promise<Gapi>((resolve, reject) => {
          gapi.load(name, {
            callback: () => resolve(gapi),
            onerror: (reason) =>
              reject(new Error(`gapi.load('${name}') failed: ${String(reason)}`)),
            timeout: MODULE_LOAD_TIMEOUT_MS,
            ontimeout: () => reject(new Error(`gapi.load('${name}') timed out`))
          });
        })
    );
    // A rejected load clears the cache so a later call can retry the module.
    promise.catch(() => modulePromises.delete(name));
    modulePromises.set(name, promise);
  }
  return promise;
}
