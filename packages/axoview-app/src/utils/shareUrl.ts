import { APP_BASENAME } from './../appBase';

/**
 * Build a share URL from a share UUID using the current browser origin.
 *
 * Why: the backend returns its own `url` derived from `req.get('host')`, which
 * in `npm run dev` is the backend port (:3001) — not the SPA port (:3000) the
 * user is actually on. Always anchor user-facing share links to the page
 * origin so the link is openable without modification.
 *
 * R1 (ADR 0040): the editor is served under /app, so display routes live at
 * `${APP_BASENAME}/display/*` — the share URL must carry that prefix.
 */
export function shareUrlFromUuid(uuid: string): string {
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : '';
  return `${origin}${APP_BASENAME}/display/p/${uuid}`;
}
