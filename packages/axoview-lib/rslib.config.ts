import { defineConfig } from '@rslib/core';
import { pluginReact } from '@rsbuild/plugin-react';

const packageJson = require('./package.json');
const resolveVersion = require('../../scripts/resolve-version.js');

export default defineConfig({
  lib: [
    {
      format: 'cjs',
      syntax: 'es2021',
      output: {
        distPath: { root: './dist' },
      },
      style: {
        inject: false,
      },
    },
    {
      format: 'esm',
      syntax: 'es2021',
      output: {
        distPath: { root: './dist/esm' },
      },
      style: {
        inject: false,
      },
    },
  ],
  plugins: [pluginReact()],
  source: {
    entry: {
      index: './src/index.ts',
    },
    define: {
      // Version comes from the git tag at build time, not the (frozen) committed
      // package.json — see scripts/resolve-version.js + ADR 0045.
      PACKAGE_VERSION: JSON.stringify(resolveVersion(packageJson.version)),
      REPOSITORY_URL: JSON.stringify(packageJson.repository.url),
    },
  },
  resolve: {
    alias: {
      src: './src',
      components: './src/components',
      stores: './src/stores',
      styles: './src/styles',
      utils: './src/utils',
      hooks: './src/hooks',
      types: './src/types',
    },
  },
  output: {
    externals: ['react', 'react-dom'],
    target: 'node',
    filename: {
      css: 'styles.css',
    },
  },
});
