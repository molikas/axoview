// Axoview does not ship a service worker; the public/service-worker.js asset
// was removed during the PWA-out work. This helper only unregisters any
// service worker left over from a prior install so returning users don't get
// stuck on cached assets.
export function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
      })
      .catch((error) => {
        console.error(error.message);
      });
  }
}
