import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import path from 'path';
import pkg from './package.json';
import resolveVersion from '../../scripts/resolve-version.js';

const publicUrl = process.env.PUBLIC_URL || '';
const assetPrefix = publicUrl ? (publicUrl.endsWith('/') ? publicUrl : publicUrl + '/') : '/';
// Version comes from the git tag at build time, not the (frozen) committed
// package.json — see scripts/resolve-version.js + ADR 0045.
const appVersion = process.env.REACT_APP_VERSION || resolveVersion(pkg.version);

// Resolve React from root node_modules to avoid duplicate instances
const rootNodeModules = path.resolve(__dirname, '../../node_modules');

export default defineConfig({
    plugins: [pluginReact()],
    server: {
        // R1 (ADR 0040): in `npm run dev`, serve the editor shell (app.html) for
        // /app and any client-side route beneath it, mirroring the Cloudflare
        // _redirects / nginx rules. The root `/` serves public/index.html (the
        // landing). The canonical R1 routing test is still the production build
        // + scripts/preview-r1.mjs (clean URLs + _redirects can't be fully
        // reproduced by the dev server).
        historyApiFallback: {
            rewrites: [{ from: /^\/app(?:\/.*)?$/, to: '/app.html' }],
        },
    },
    resolve: {
        alias: {
            // Force React to resolve from root node_modules
            'react': path.join(rootNodeModules, 'react'),
            'react-dom': path.join(rootNodeModules, 'react-dom'),
        },
    },
    html: {
        // R1 (ADR 0040): the editor SPA lives under /app, so its shell is emitted
        // as `app.html` (via the `app` entry below) and served at /app. The root
        // `index.html` is the static marketing landing (public/index.html), NOT
        // this template. Assets stay at ${assetPrefix}static — see basename note
        // in App.tsx (router basename is /app, decoupled from assetPrefix).
        template: './app-shell.html',
        templateParameters: {
            assetPrefix: assetPrefix,
            // Stamp the build version onto the boot splash (ADR 0045 §2). Same
            // value the About tab shows; correct in production once the release
            // bump is committed back (ADR 0045 §1).
            appVersion: appVersion,
        },
    },
    source: {
        // Name the entry `app` so the generated HTML is `app.html` (served at
        // /app) rather than colliding with the landing at build/index.html.
        entry: {
            app: './src/index.tsx',
        },
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
            // ADR 0042 §5 — same dev-fallback rail for the Drive sharing key +
            // Picker project number. MUST be defined even when unset: rsbuild
            // replaces only the exact defined expressions, so an unlisted
            // `process.env.PUBLIC_*` read ships a literal `process` to the
            // browser and breaks boot with a ReferenceError.
            'process.env.PUBLIC_GOOGLE_API_KEY': JSON.stringify(
                process.env.PUBLIC_GOOGLE_API_KEY || ''
            ),
            'process.env.PUBLIC_GOOGLE_PROJECT_NUMBER': JSON.stringify(
                process.env.PUBLIC_GOOGLE_PROJECT_NUMBER || ''
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
