import {
  generatePairingCode,
  normalizePairingCode,
  isValidPairingCode
} from '../pairing';

describe('pairing code (ADR 0046 §3 v1)', () => {
  it('generates a high-entropy grouped code with no ambiguous characters', () => {
    for (let i = 0; i < 50; i += 1) {
      const code = generatePairingCode();
      // AXV- then three dash-separated groups of 4 (12 entropy chars ≈ 59 bits).
      expect(code).toMatch(/^AXV-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
      // No 0/O/1/I/L (transcription hazards).
      expect(code.slice(4)).not.toMatch(/[01OIL]/);
    }
  });

  it('mints distinct codes (entropy sanity)', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i += 1) seen.add(generatePairingCode());
    expect(seen.size).toBe(100);
  });

  it('normalises a pasted code (case + whitespace)', () => {
    expect(normalizePairingCode('  axv-ab2k-cd3m-ef4n  ')).toBe(
      'AXV-AB2K-CD3M-EF4N'
    );
  });

  it('validates format', () => {
    expect(isValidPairingCode('AXV-AB2K-CD3M-EF4N')).toBe(true);
    expect(isValidPairingCode('AXV-AB2K')).toBe(false);
    expect(isValidPairingCode('nope')).toBe(false);
    expect(isValidPairingCode('AXV-AB2K-CD3M-EF4NZZ')).toBe(false);
  });
});
