/**
 * Worker jest config (v1.1 Track 5a — DP2 lock 2026-05-25).
 *
 * .cjs extension so the file loads as CommonJS even though the workspace's
 * package.json carries `"type": "module"`. ts-jest transforms TS sources
 * to CommonJS at test time (jest.test.json overrides the worker's ESNext
 * module setting). Tests reach the runtime via Hono's `app.request()` —
 * no wrangler, no Workers runtime — so CJS output is fine.
 *
 * No coverage threshold today: first test pass for this workspace.
 */
const path = require('path');

module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/__tests__/**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: path.resolve(__dirname, 'tsconfig.test.json'),
        useESM: false
      }
    ]
  },
  testPathIgnorePatterns: ['/node_modules/'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/__tests__/**'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov']
};
