/** @type {import('ts-jest').JestConfigWithTsJest} */
// React loads its production build when NODE_ENV === 'production', which breaks
// act() in tests. Ensure it is always 'test' regardless of the inherited environment.
process.env.NODE_ENV = 'test';

module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  modulePaths: ['node_modules', '<rootDir>'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    // SVG files are inlined as strings at build time (rslib); in Jest they just need
    // to be non-empty strings so gridTileUrl truthiness checks pass.
    "\\.svg$": "<rootDir>/src/__mocks__/fileMock.ts",
    // Force React to resolve from root node_modules to avoid duplicate React instances
    "^react$": "<rootDir>/../../node_modules/react",
    "^react-dom$": "<rootDir>/../../node_modules/react-dom",
    "^react-dom/client$": "<rootDir>/../../node_modules/react-dom/client",
    "^react/jsx-runtime$": "<rootDir>/../../node_modules/react/jsx-runtime",
    "^react/jsx-dev-runtime$": "<rootDir>/../../node_modules/react/jsx-dev-runtime"
  },
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '\\.d\\.ts$'
  ],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/__tests__/**',
    '!src/types/**',
    '!src/index.ts'
  ],
  // Floors ratcheted 2026-07-05 (technical-review-2026-07 §8b): global floors sit
  // ~5-7pp under measured reality (37.4% stmts / 25.1% branches) so the tested core
  // can't silently erode; the two well-covered areas carry their own higher floors
  // (directory paths aggregate; measured: reducers 89.0/70.7, schemas 99.2/94.1).
  coverageThreshold: {
    global: {
      branches: 20,
      functions: 25,
      lines: 30,
      statements: 30
    },
    './src/stores/reducers/': {
      statements: 85,
      branches: 65
    },
    './src/schemas/': {
      statements: 95,
      branches: 90
    }
  },
  coverageReporters: ['json', 'lcov', 'text', 'html']
};
