require('@testing-library/jest-dom');

// jsdom does not expose TextEncoder/TextDecoder on the test global, though they
// are universal browser globals at runtime (used by svgOptimizer's UTF-8 → base64
// path). Polyfill from Node's util so tests exercise the real code path.
const { TextEncoder, TextDecoder } = require('util');
if (typeof global.TextEncoder === 'undefined') global.TextEncoder = TextEncoder;
if (typeof global.TextDecoder === 'undefined') global.TextDecoder = TextDecoder;

// jsdom's `crypto` (older jsdom builds) lacks randomUUID, which generateId()
// uses. Polyfill from Node's crypto so id-minting code paths run under test.
const nodeCrypto = require('crypto');
if (typeof global.crypto === 'undefined') {
  Object.defineProperty(global, 'crypto', {
    value: { randomUUID: () => nodeCrypto.randomUUID() },
    configurable: true
  });
} else if (typeof global.crypto.randomUUID !== 'function') {
  // jsdom's Crypto exists but predates randomUUID — attach it in place.
  Object.defineProperty(global.crypto, 'randomUUID', {
    value: () => nodeCrypto.randomUUID(),
    configurable: true
  });
}
