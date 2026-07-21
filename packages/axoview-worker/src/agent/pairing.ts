// Ephemeral pairing code (ADR 0046 §3 v1) — a short, human-transcribable token the
// tab shows and the user pastes into their MCP client. No accounts, no persistent
// credential custody → free-tier-trivial and keeps ADR 0010 §4 storage-tenancy
// intact. The DO keyed by this code binds code ⇄ tab-WS; TTL is enforced in the DO.

// Crockford-ish alphabet: no 0/O/1/I/L to avoid transcription errors.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
// S2 (2026-07-21): the code is the ONLY auth binding MCP-client → tab, and it
// rides the URL (`/mcp/<code>`), so a short 4-char code (~9.2e5 combinations) was
// brute-forceable within the 10-min TTL. It is copy-pasted, never hand-typed, so
// length is nearly free: 12 chars over a 31-symbol alphabet ≈ 31^12 ≈ 7.6e17 ≈
// 59 bits — infeasible to scan even without rate-limiting. Displayed grouped
// (AXV-XXXX-XXXX-XXXX) for readability; the DO key is the un-grouped string.
const CODE_LEN = 12;
const GROUP = 4;

export const generatePairingCode = (): string => {
  const bytes = new Uint8Array(CODE_LEN);
  crypto.getRandomValues(bytes);
  let s = '';
  for (let i = 0; i < bytes.length; i += 1) {
    if (i > 0 && i % GROUP === 0) s += '-';
    s += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return `AXV-${s}`;
};

// A pasted code is normalised (upper-case, strip spaces) before it keys a DO.
// Internal group dashes are preserved (they are part of the canonical code); only
// stray whitespace is removed.
export const normalizePairingCode = (raw: string): string =>
  raw.trim().toUpperCase().replace(/\s+/g, '');

// AXV- then three dash-separated groups of 4 alphabet chars.
const CODE_RE = /^AXV-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/;
export const isValidPairingCode = (code: string): boolean => CODE_RE.test(code);
