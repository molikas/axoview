import { verifyCfAccessJwt } from '../auth';

// Fixture-keypair harness for cf-access JWT signature paths.
// Closes v1.1 Track 5a Finding #2 (deferred during 5a because the prior
// mock-crypto.subtle.verify approach exceeded the orchestrator's boilerplate
// budget). This harness uses real Web Crypto (available on Node 16+ via
// globalThis.crypto) with a generated RSA keypair, so the verifier runs end
// to end without mocking subtle.verify.

const TEAM = 'axoview-test';
const AUD = 'aud-axoview';
const KID = 'fixture-kid-1';

let publicKey: CryptoKey;
let privateKey: CryptoKey;
let foreignPrivateKey: CryptoKey;

beforeAll(async () => {
  const params: RsaHashedKeyGenParams = {
    name: 'RSASSA-PKCS1-v1_5',
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: 'SHA-256'
  };
  const keypair = (await crypto.subtle.generateKey(params, true, ['sign', 'verify'])) as CryptoKeyPair;
  publicKey = keypair.publicKey;
  privateKey = keypair.privateKey;
  // A second keypair, used to produce a JWT signed by a key the JWKS does NOT know.
  const foreign = (await crypto.subtle.generateKey(params, true, ['sign', 'verify'])) as CryptoKeyPair;
  foreignPrivateKey = foreign.privateKey;
});

function b64url(input: string | Uint8Array): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

interface FixturePayload {
  aud?: string | string[];
  iss?: string;
  exp?: number;
  sub?: string;
}

async function signJwt(
  payload: FixturePayload,
  options: { kid?: string; signWith?: CryptoKey } = {}
): Promise<string> {
  const header = { alg: 'RS256', kid: options.kid ?? KID, typ: 'JWT' };
  const headerB64 = b64url(JSON.stringify(header));
  const payloadB64 = b64url(JSON.stringify(payload));
  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', options.signWith ?? privateKey, data);
  return `${headerB64}.${payloadB64}.${b64url(new Uint8Array(sig))}`;
}

function jwksWith(kid: string, key: CryptoKey) {
  return async (_team: string) => new Map([[kid, key]]);
}

function basePayload(overrides: Partial<FixturePayload> = {}): FixturePayload {
  return {
    aud: AUD,
    iss: `https://${TEAM}.cloudflareaccess.com`,
    exp: Math.floor(Date.now() / 1000) + 3600,
    sub: 'user@example.com',
    ...overrides
  };
}

describe('verifyCfAccessJwt — signature paths (fixture keypair)', () => {
  test('valid signature → { valid: true, sub }', async () => {
    const token = await signJwt(basePayload());
    const result = await verifyCfAccessJwt(token, {
      team: TEAM,
      expectedAud: AUD,
      loadKeys: jwksWith(KID, publicKey)
    });
    expect(result).toEqual({ valid: true, sub: 'user@example.com' });
  });

  test('invalid signature (signed by a foreign keypair) → { valid: false }', async () => {
    // Token claims `kid = KID` (which the JWKS knows) but is signed by a
    // different private key. crypto.subtle.verify must reject.
    const token = await signJwt(basePayload(), { signWith: foreignPrivateKey });
    const result = await verifyCfAccessJwt(token, {
      team: TEAM,
      expectedAud: AUD,
      loadKeys: jwksWith(KID, publicKey)
    });
    expect(result).toEqual({ valid: false });
  });

  test('tampered payload (signature no longer matches) → { valid: false }', async () => {
    const original = await signJwt(basePayload({ sub: 'attacker@example.com' }));
    const [headerB64, , sigB64] = original.split('.');
    // Replace the payload segment with a re-encoded different payload while
    // keeping the original signature — classic "swap the claims" attack.
    const tamperedPayloadB64 = b64url(JSON.stringify(basePayload({ sub: 'victim@example.com' })));
    const tampered = `${headerB64}.${tamperedPayloadB64}.${sigB64}`;
    const result = await verifyCfAccessJwt(tampered, {
      team: TEAM,
      expectedAud: AUD,
      loadKeys: jwksWith(KID, publicKey)
    });
    expect(result).toEqual({ valid: false });
  });

  test('kid not present in JWKS → { valid: false }', async () => {
    const token = await signJwt(basePayload(), { kid: 'unknown-kid' });
    const result = await verifyCfAccessJwt(token, {
      team: TEAM,
      expectedAud: AUD,
      loadKeys: jwksWith(KID, publicKey)
    });
    expect(result).toEqual({ valid: false });
  });

  test('expired exp → { valid: false } (clock injected)', async () => {
    const oneHourAgo = Math.floor(Date.now() / 1000) - 3600;
    const token = await signJwt(basePayload({ exp: oneHourAgo + 60 })); // exp 59 min ago
    const result = await verifyCfAccessJwt(token, {
      team: TEAM,
      expectedAud: AUD,
      loadKeys: jwksWith(KID, publicKey),
      now: () => oneHourAgo + 120 // "now" is one minute after exp
    });
    expect(result).toEqual({ valid: false });
  });

  test('aud mismatch → { valid: false } (short-circuits before signature check)', async () => {
    const token = await signJwt(basePayload({ aud: 'aud-other' }));
    const result = await verifyCfAccessJwt(token, {
      team: TEAM,
      expectedAud: AUD,
      loadKeys: jwksWith(KID, publicKey)
    });
    expect(result).toEqual({ valid: false });
  });

  test('aud array containing expected → { valid: true }', async () => {
    const token = await signJwt(basePayload({ aud: ['aud-other', AUD] }));
    const result = await verifyCfAccessJwt(token, {
      team: TEAM,
      expectedAud: AUD,
      loadKeys: jwksWith(KID, publicKey)
    });
    expect(result.valid).toBe(true);
  });

  test('iss missing team domain → { valid: false }', async () => {
    const token = await signJwt(basePayload({ iss: 'https://other-team.cloudflareaccess.com' }));
    const result = await verifyCfAccessJwt(token, {
      team: TEAM,
      expectedAud: AUD,
      loadKeys: jwksWith(KID, publicKey)
    });
    expect(result).toEqual({ valid: false });
  });
});
