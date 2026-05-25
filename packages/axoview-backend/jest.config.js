/**
 * Backend jest config (v1.1 Track 5a — DP2 lock 2026-05-25).
 *
 * Backend is ESM ("type": "module" in package.json). Native ESM via
 * NODE_OPTIONS=--experimental-vm-modules — no transform. The `test` script
 * in package.json sets the flag.
 *
 * No coverage threshold today: Track 5a is the first test pass for this
 * workspace; coverage thresholds are deferred per the tactical's "Out of
 * scope" rule (no threshold promotion until 5a + 5e land). See §12 M7 in
 * the technical review — the 10% global gate applies to axoview-lib only.
 */
export default {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/__tests__/**/*.spec.js'],
  testPathIgnorePatterns: ['/node_modules/'],
  transform: {},
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/__tests__/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov']
};
