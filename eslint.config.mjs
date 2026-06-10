import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/node_modules/**',
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/__snapshots__/**',
      '**/coverage/**',
      '**/*.config.js',
      '**/*.config.mjs',
      '**/*.config.ts',
    ]
  },
  {
    files: ['packages/axoview-lib/src/**/*.{ts,tsx}', 'packages/axoview-app/src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      }
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'react-hooks': reactHooks,
    },
    rules: {
      // React hooks
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // TypeScript
      // Promoted from 'warn' to 'error' on 2026-05-25 after v1.1 no-explicit-any
      // Phase 3 closed the last 55 sites in axoview-lib (Phases 1+2: 89 sites
      // in axoview-app; Phase 3: 55 in axoview-lib; combined: 144 sites typed).
      // Baseline is now 0 across both eslint-covered workspaces; future `any`
      // is a build-blocker.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],

      // Safety
      'no-console': ['warn', { allow: ['error', 'warn'] }],
      'no-debugger': 'error',

      // Basic recommended (subset — no type-aware rules to keep it fast)
      'no-undef': 'off', // TypeScript handles this
      'no-redeclare': 'off', // TypeScript handles this
    }
  }
];
