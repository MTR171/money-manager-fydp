import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// ── PWA Service Worker Registration ──────────────────────────────────────────
// vite-plugin-pwa provides a virtual module 'virtual:pwa-register' that handles
// service worker registration with the configured strategy (autoUpdate).
// We import it lazily so it never blocks the initial render.
if ('serviceWorker' in navigator) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({
      // Called when a new service worker is waiting to activate.
      // With registerType: 'autoUpdate' the plugin reloads automatically,
      // but you can show a toast here if you prefer manual confirmation.
      onNeedRefresh() {
        // autoUpdate mode handles this silently — no user action needed.
        console.info('[PWA] New content available, will update on next reload.');
      },
      onOfflineReady() {
        // The app is now fully cached and works offline.
        console.info('[PWA] App ready to work offline.');
      },
      onRegistered(registration) {
        console.info('[PWA] Service worker registered:', registration?.scope);
      },
      onRegisterError(error) {
        console.error('[PWA] Service worker registration failed:', error);
      },
    });
  }).catch((err) => {
    // The virtual module is only present after a build — this error is expected
    // in plain `vite dev` mode when devOptions.enabled is false.
    console.info('[PWA] Service worker module not available in this environment.', err?.message);
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
