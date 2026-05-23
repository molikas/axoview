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
root.render(
  <React.StrictMode>
    <I18nextProvider i18n={i18n}>
      <ErrorBoundary FallbackComponent={ErrorBoundaryFallbackUI}>
        <App />
      </ErrorBoundary>
    </I18nextProvider>
  </React.StrictMode>
);

// Axoview does not use PWA/offline support — always unregister any active service worker.
serviceWorkerRegistration.unregister();
