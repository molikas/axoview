import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import path from 'path';
import pkg from './package.json';

const publicUrl = process.env.PUBLIC_URL || '';
const assetPrefix = publicUrl ? (publicUrl.endsWith('/') ? publicUrl : publicUrl + '/') : '/';
const appVersion = process.env.REACT_APP_VERSION || pkg.version;

// Resolve React from root node_modules to avoid duplicate instances
const rootNodeModules = path.resolve(__dirname, '../../node_modules');

export default defineConfig({
    plugins: [pluginReact()],
    resolve: {
        alias: {
            // Force React to resolve from root node_modules
            'react': path.join(rootNodeModules, 'react'),
            'react-dom': path.join(rootNodeModules, 'react-dom'),
        },
    },
    html: {
        template: './public/index.html',
        templateParameters: {
            assetPrefix: assetPrefix,
        },
    },
    source: {
        // Define global constants that will be replaced at build time
        define: {
            'process.env.PUBLIC_URL': JSON.stringify(publicUrl),
            'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
            'process.env.REACT_APP_VERSION': JSON.stringify(appVersion),
            // ADR 0035 §4 — build-time Google client id for pure-local `npm run
            // dev` (no backend serving /api/config). Public identifier; empty on
            // Cloudflare (the id arrives via /api/config there).
            'process.env.PUBLIC_GOOGLE_CLIENT_ID': JSON.stringify(
                process.env.PUBLIC_GOOGLE_CLIENT_ID || ''
            ),
        },
    },
    output: {
        distPath: {
            root: 'build',
        },
        // https://rsbuild.rs/guide/advanced/browser-compatibility
        polyfill: 'usage',
        assetPrefix: assetPrefix,
        copy: [
            {
                from: './src/i18n',
                to: 'i18n/app',
            },
        ]
    }
});
