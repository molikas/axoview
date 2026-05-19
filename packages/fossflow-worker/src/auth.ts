import type { Context, Next } from 'hono';

interface JwtHeader { alg: string; kid?: string; typ?: string }
interface JwtPayload { aud?: string | string[]; exp?: number; iss?: string }

/**
 * Auth middleware for Axoview Worker. Three modes selected by env.AUTH_MODE:
 *
 *   none           — no auth. Worker logs a warning at startup. Dev only.
 *   shared-token   — requires `Authorization: Bearer <env.AUTH_SHARED_SECRET>`.
 *   cf-access      — verifies `Cf-Access-Jwt-Assertion` against Cloudflare
 *                    Access JWKS. Audience must match env.CF_ACCESS_AUD.
 *                    Locks down to the Cloudflare Access policy on the
 *                    deployed hostname.
 *
 * Public-namespace bypass: GET /api/public/diagrams/:uuid is the only route
 * that bypasses auth unconditionally. Owners must still be authenticated to
 * publish/unpublish snapshots — the bypass is read-only.
 */
export function isPublicRoute(method: string, pathname: string): boolean {
  if (method === 'GET' && (pathname === '/api/config' || pathname === '/api/storage/status')) {
    return true;
  }
  return method === 'GET' && /^\/api\/public\/diagrams\/[A-Za-z0-9_-]{21,64}$/.test(pathname);
}

export function authMiddleware() {
  return async (c: Context, next: Next) => {
    const env = c.env as Record<string, any>;
    const mode = (env.AUTH_MODE as string) || 'none';
    const url = new URL(c.req.url);

    if (isPublicRoute(c.req.method, url.pathname)) {
      return next();
    }

    if (mode === 'none') {
      return next();
    }

    if (mode === 'shared-token') {
      const secret = env.AUTH_SHARED_SECRET;
      if (!secret) {
        return c.json({ error: 'Server auth misconfigured' }, 500);
      }
      const header = c.req.header('authorization') || '';
      if (!header.startsWith('Bearer ')) {
        return c.json({ error: 'Unauthorized' }, 401);
      }
      const token = header.slice('Bearer '.length).trim();
      if (!constantTimeEquals(token, secret)) {
        return c.json({ error: 'Unauthorized' }, 401);
      }
      return next();
    }

    if (mode === 'cf-access') {
      const team = env.CF_ACCESS_TEAM_DOMAIN;
      const aud = env.CF_ACCESS_AUD;
      if (!team || !aud) {
        return c.json({ error: 'Server auth misconfigured' }, 500);
      }
      const jwt = c.req.header('cf-access-jwt-assertion');
      if (!jwt) return c.json({ error: 'Unauthorized' }, 401);
      try {
        const ok = await verifyCfAccessJwt(jwt, team, aud);
        if (!ok) return c.json({ error: 'Unauthorized' }, 401);
      } catch (err) {
        console.error('cf-access verify failed', err);
        return c.json({ error: 'Unauthorized' }, 401);
      }
      return next();
    }

    return c.json({ error: 'Unknown AUTH_MODE' }, 500);
  };
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ---------------------------------------------------------------------------
// CF Access JWT verification (RS256 via Web Crypto)
// ---------------------------------------------------------------------------

const jwksCache: { url: string | null; keys: Map<string, CryptoKey>; fetchedAt: number } = {
  url: null,
  keys: new Map(),
  fetchedAt: 0
};
const JWKS_TTL_MS = 60 * 60 * 1000;

async function loadJwks(team: string): Promise<Map<string, CryptoKey>> {
  const url = `https://${team}.cloudflareaccess.com/cdn-cgi/access/certs`;
  const now = Date.now();
  if (jwksCache.url === url && now - jwksCache.fetchedAt < JWKS_TTL_MS && jwksCache.keys.size) {
    return jwksCache.keys;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
  const data: { keys: any[] } = await res.json();
  const keys = new Map<string, CryptoKey>();
  for (const jwk of data.keys || []) {
    if (!jwk.kid) continue;
    const cryptoKey = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );
    keys.set(jwk.kid, cryptoKey);
  }
  jwksCache.url = url;
  jwksCache.keys = keys;
  jwksCache.fetchedAt = now;
  return keys;
}

function base64UrlDecodeToBytes(s: string): Uint8Array {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(s.length + ((4 - (s.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64UrlDecodeToString(s: string): string {
  return new TextDecoder().decode(base64UrlDecodeToBytes(s));
}

async function verifyCfAccessJwt(jwt: string, team: string, expectedAud: string): Promise<boolean> {
  const parts = jwt.split('.');
  if (parts.length !== 3) return false;
  const [headerB64, payloadB64, sigB64] = parts;

  let header: JwtHeader;
  let payload: JwtPayload;
  try {
    header = JSON.parse(base64UrlDecodeToString(headerB64));
    payload = JSON.parse(base64UrlDecodeToString(payloadB64));
  } catch {
    return false;
  }

  if (header.alg !== 'RS256' || !header.kid) return false;

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === 'number' && payload.exp < now) return false;

  const aud = payload.aud;
  const audMatches = Array.isArray(aud)
    ? aud.includes(expectedAud)
    : aud === expectedAud;
  if (!audMatches) return false;

  if (payload.iss && !payload.iss.includes(team)) return false;

  const keys = await loadJwks(team);
  const key = keys.get(header.kid);
  if (!key) return false;

  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signature = base64UrlDecodeToBytes(sigB64);
  return crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    signature as unknown as BufferSource,
    data as unknown as BufferSource
  );
}
