require('@testing-library/jest-dom');

// jsdom@29 doesn't expose crypto.randomUUID — polyfill from Node's built-in
if (typeof crypto.randomUUID !== 'function') {
  const { randomUUID } = require('crypto');
  Object.defineProperty(globalThis.crypto, 'randomUUID', {
    value: randomUUID,
    writable: false,
    configurable: true
  });
}

// jsdom@20 (bundled with jest-environment-jsdom@29) ships an AbortSignal that
// is missing the static .timeout() method. Production code falls back to no
// signal when .timeout is unavailable, so timeout-based tests can't observe
// the abort behavior we care about. Polyfill from AbortController.
if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout !== 'function') {
  AbortSignal.timeout = (ms) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(new DOMException('TimeoutError', 'TimeoutError')), ms);
    return controller.signal;
  };
}
