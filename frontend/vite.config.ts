import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'icons/icon.svg',
        'icons/icon-180x180.png',
        'icons/icon-192x192.png',
        'icons/icon-512x512.png',
        'splash/*.png',
      ],
      manifest: {
        name: 'Laundry Pesantren',
        short_name: 'Laundry',
        description: 'Sistem Pelacak Cucian Berbasis Barcode untuk Pesantren',
        theme_color: '#4f46e5',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        lang: 'id',
        icons: [
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        categories: ['productivity', 'utilities'],
        shortcuts: [
          {
            name: 'Lacak Cucian',
            short_name: 'Lacak',
            url: '/track',
            icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192' }],
          },
          {
            name: 'Scanner QR',
            short_name: 'Scanner',
            url: '/scanner',
            icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192' }],
          },
        ],
      },
      workbox: {
        // Serve index.html for all navigation requests (SPA offline support)
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/socket\.io\//],
        // Cache strategies
        runtimeCaching: [
          {
            // Cache public tracking API — use relative path, works in any environment
            urlPattern: /\/api\/public\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-public-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60, // 1 hour
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Cache static assets
            urlPattern: /\.(?:js|css|woff2?|png|jpg|svg)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-assets',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
              },
            },
          },
        ],
        // Precache all app shell files
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
      devOptions: {
        enabled: true, // Enable PWA in dev mode for testing
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
