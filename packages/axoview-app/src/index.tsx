import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import 'react-quill-new/dist/quill.snow.css';
import App from './App';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';
import { ErrorBoundary } from 'react-error-boundary';
import ErrorBoundaryFallbackUI from './components/ErrorBoundary';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n';
import { migrateFossflowStorageKeys } from './utils/migrationShim';

// Must run before any storage provider reads localStorage/sessionStorage.
// Idempotent and gated by a sentinel key — safe to call on every boot.
migrateFossflowStorageKeys();

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

// The perf harness sets this flag (localStorage, pre-boot) to skip StrictMode's
// dev-only double-render, which production never does — so frame measurements
// reflect production render cost instead of 2× dev work. No effect on normal
// dev/prod boots (flag absent). See packages/axoview-e2e/perf/.
const perfNoStrict = (() => {
  try {
    return localStorage.getItem('axoview-perf-harness') === '1';
  } catch {
    return false;
  }
})();

const tree = (
  <I18nextProvider i18n={i18n}>
    <ErrorBoundary FallbackComponent={ErrorBoundaryFallbackUI}>
      <App />
    </ErrorBoundary>
  </I18nextProvider>
);

root.render(
  perfNoStrict ? tree : <React.StrictMode>{tree}</React.StrictMode>
);

// Axoview does not use PWA/offline support — always unregister any active service worker.
serviceWorkerRegistration.unregister();
