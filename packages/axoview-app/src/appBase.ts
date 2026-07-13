// The URL path the editor SPA is mounted under.
//
// R1 (ADR 0040): the marketing landing owns the site root (`/`); the editor
// lives under `/app`. `PUBLIC_URL` still prefixes for sub-path self-host
// deploys, so the basename is `${PUBLIC_URL}/app` (e.g. `/app`, or `/foo/app`
// when PUBLIC_URL=`/foo`). Shared by the router basename (App.tsx) and share-URL
// construction (shareUrl.ts) so the two never disagree.
const publicUrl = (process.env.PUBLIC_URL || '').replace(/\/$/, '');

export const APP_BASENAME = `${publicUrl}/app`;
