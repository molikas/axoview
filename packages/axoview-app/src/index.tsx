import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import 'react-quill-new/dist/quill.snow.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
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

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

// Axoview does not use PWA/offline support — always unregister any active service worker.
serviceWorkerRegistration.unregister();
