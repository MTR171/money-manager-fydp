import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load .env (including VITE_API_URL written by tunnel_runner.py)
  const env = loadEnv(mode, process.cwd(), '')

  // Only proxy /api when NOT using an external Ngrok backend URL
  const useProxy = !env.VITE_API_URL

  return {
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version || "1.1.0"),
      __BUILD_DATE__: JSON.stringify(new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })),
    },
    plugins: [
      react(),

      // ── PWA Plugin ───────────────────────────────────────────────────────
      VitePWA({
        // 'autoUpdate' silently installs a new service worker when available
        // and reloads once the user's tab is idle/refocused.
        registerType: 'autoUpdate',

        // Assets to precache in addition to the Vite-built bundle
        includeAssets: [
          'icon.svg',
          'icon-192.png',
          'icon-512.png',
          'icon-512-maskable.png',
          'apple-touch-icon.png',
          'favicon.svg',
        ],

        // ── Web App Manifest ──────────────────────────────────────────────
        manifest: {
          name: 'Money Manager AI',
          short_name: 'MoneyManager',
          description: 'AI-powered personal finance manager — track expenses, get smart recommendations, predict overspending risk.',
          theme_color: '#0f172a',
          background_color: '#ffffff',
          display: 'standalone',           // hides browser chrome — native-app feel
          display_override: ['standalone', 'minimal-ui'],
          orientation: 'portrait-primary',
          scope: '/',
          start_url: '/?source=pwa',       // lets you distinguish PWA vs browser traffic
          lang: 'en',
          categories: ['finance', 'productivity'],
          screenshots: [],                  // add 1280×720 screenshots here for richer install dialog
          icons: [
            {
              src: 'icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'icon-512-maskable.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',   // adaptive icon on Android (safe-zone aware)
            },
            {
              src: 'apple-touch-icon.png',
              sizes: '180x180',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'icon.svg',
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'any maskable',
            },
          ],
          shortcuts: [
            {
              name: 'Add Transaction',
              short_name: 'Add',
              description: 'Quickly add a new transaction',
              url: '/?action=add-transaction',
              icons: [{ src: 'icon-192.png', sizes: '192x192' }],
            },
          ],
        },

        // ── Workbox Service Worker Strategy ───────────────────────────────
        workbox: {
          // Precache all build artifacts
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,ttf,eot}'],

          // Skip waiting — activate the new SW immediately on install
          skipWaiting: true,
          clientsClaim: true,

          // Do not cache ngrok URLs (they change every session)
          navigateFallbackDenylist: [/ngrok-free\.app/, /ngrok\.io/],

          runtimeCaching: [
            // ── API calls: NetworkFirst with 10-second timeout ──────────
            // Serves stale data when offline so the app doesn't break.
            {
              urlPattern: ({ url }) =>
                url.pathname.startsWith('/api/') ||
                /ngrok-free\.app\/api\//.test(url.href) ||
                /ngrok\.io\/api\//.test(url.href),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache-v1',
                networkTimeoutSeconds: 10,
                expiration: {
                  maxEntries: 80,
                  maxAgeSeconds: 5 * 60,   // 5 minutes stale tolerance
                },
                cacheableResponse: { statuses: [0, 200] },
                backgroundSync: {
                  name: 'api-retry-queue',
                  options: { maxRetentionTime: 24 * 60 },  // retry for 24 h
                },
              },
            },

            // ── Google Fonts (if ever added): CacheFirst 1 year ─────────
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-stylesheets',
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-webfonts',
                expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },

            // ── Images: CacheFirst 30 days ───────────────────────────────
            {
              urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|avif|ico)$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'images-cache-v1',
                expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },

            // ── JS/CSS chunks: StaleWhileRevalidate ──────────────────────
            {
              urlPattern: /\.(?:js|css)$/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'static-resources-v1',
                expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 7 },
              },
            },
          ],
        },

        // Enable PWA in dev mode so you can test the manifest/SW locally
        devOptions: {
          enabled: true,
          type: 'module',
          navigateFallback: 'index.html',
        },
      }),
    ],

    // ── Dev Server ──────────────────────────────────────────────────────────
    server: {
      port: 5173,
      host: '0.0.0.0',   // bind to all interfaces for Ngrok forwarding
      ...(useProxy && {
        proxy: {
          '/api': {
            target: 'http://localhost:8000',
            changeOrigin: true,
            secure: false,
          },
        },
      }),
    },

    // ── Preview Server (npm run preview) ────────────────────────────────────
    preview: {
      port: 4173,
      host: '0.0.0.0',
    },
  }
})
