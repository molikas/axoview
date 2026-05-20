/**
 * In `npm run dev` the SPA runs on :3000 and the Express backend on :3001.
 * Everywhere else (Docker, Cloudflare, preview), `/api/*` is same-origin.
 */
export function apiBaseUrl(): string {
  if (
    typeof window !== 'undefined' &&
    window.location.hostname === 'localhost' &&
    window.location.port === '3000'
  ) {
    return 'http://localhost:3001';
  }
  return '';
}
