require('@testing-library/jest-dom');

// jsdom does not expose TextEncoder/TextDecoder on the test global, though they
// are universal browser globals at runtime (used by svgOptimizer's UTF-8 → base64
// path). Polyfill from Node's util so tests exercise the real code path.
const { TextEncoder, TextDecoder } = require('util');
if (typeof global.TextEncoder === 'undefined') global.TextEncoder = TextEncoder;
if (typeof global.TextDecoder === 'undefined') global.TextDecoder = TextDecoder;
