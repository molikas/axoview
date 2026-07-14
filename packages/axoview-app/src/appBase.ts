// The URL path the editor SPA is mounted under.
//
// R1 (ADR 0040): the marketing landing owns the site root (`/`); the editor
// lives under `/app`. `PUBLIC_URL` still prefixes for sub-path self-host
// deploys, so the basename is `${PUBLIC_URL}/app` (e.g. `/app`, or `/foo/app`
// when PUBLIC_URL=`/foo`). Shared by the router basename (App.tsx) and share-URL
// construction (shareUrl.ts) so the two never disagree.
const publicUrl = (process.env.PUBLIC_URL || '').replace(/\/$/, '');

export const APP_BASENAME = `${publicUrl}/app`;

/**
 * The `${origin}${APP_BASENAME}/display` prefix shared by every read-only link
 * builder (public-snapshot `shareUrl.ts`, Drive `driveSharing.ts`). Anchored to
 * the page origin — never a backend-derived host — so the link is openable as
 * copied (see shareUrl.ts). Empty origin (SSR/test with no window) degrades to
 * a relative path.
 */
export function appDisplayBase(): string {
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : '';
  return `${origin}${APP_BASENAME}/display`;
}
