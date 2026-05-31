import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

/**
 * Vite config do client-app (PWA do cliente final).
 *
 * Build target ES2022 + esbuild minify — pequeno e moderno.
 * vite-plugin-pwa gera service worker (Workbox) e injeta o manifest.
 * Alias `@/` aponta pra `src/` — mesmo padrão do `web/` Next.js.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3002,
    strictPort: true,
  },
  preview: {
    port: 3002,
    strictPort: true,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          query: ['@tanstack/react-query'],
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      // 'prompt' permite que a app mostre um "nova versão disponível" e o
      // usuário decida quando recarregar (UX melhor que autoUpdate silencioso).
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons/*'],
      manifest: {
        id: '/',
        name: 'Cortex — Portal do cliente',
        short_name: 'Cortex',
        description:
          'O portal do cliente Cortex: acompanhe obrigações, baixe guias e converse com o escritório de contabilidade.',
        lang: 'pt-BR',
        dir: 'ltr',
        theme_color: '#0B1324',
        background_color: '#EBEBFE',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        categories: ['business', 'finance', 'productivity'],
        icons: [
          { src: '/icons/icon-192.png',           sizes: '192x192', type: 'image/png',                      },
          { src: '/icons/icon-512.png',           sizes: '512x512', type: 'image/png',                      },
          { src: '/icons/icon-maskable-192.png',  sizes: '192x192', type: 'image/png', purpose: 'maskable'  },
          { src: '/icons/icon-maskable-512.png',  sizes: '512x512', type: 'image/png', purpose: 'maskable'  },
          { src: '/favicon.svg',                  sizes: 'any',     type: 'image/svg+xml', purpose: 'any'   },
        ],
        // Atalhos do app (long-press no ícone em Android, menu rápido no iOS 18+)
        shortcuts: [
          {
            name: 'Obrigações',
            short_name: 'Obrigações',
            description: 'Ver vencimentos e baixar guias',
            url: '/obrigacoes',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
          },
          {
            name: 'Nova solicitação',
            short_name: 'Solicitar',
            description: 'Abrir um chamado pro escritório',
            url: '/solicitacoes',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
          },
          {
            name: 'Documentos',
            short_name: 'Documentos',
            description: 'Guias e arquivos disponíveis',
            url: '/documentos',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
          },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackAllowlist: [/^(?!\/api).*$/],
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
        runtimeCaching: [
          // Supabase REST/storage — network first com fallback de 5s
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-rest',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 96, maxAgeSeconds: 60 * 15 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Storage do Supabase (downloads) — cache first é seguro porque URLs assinadas mudam
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'supabase-storage',
              expiration: { maxEntries: 64, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // API Go — network only (tem assinaturas curtas)
          {
            urlPattern: /^https:\/\/cortex-production-.*\.up\.railway\.app\/.*/,
            handler: 'NetworkOnly',
          },
          // Google Fonts — stale-while-revalidate
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'gfonts-stylesheets' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gfonts-webfonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        enabled: false, // ative pra debugar SW localmente
      },
    }),
  ],
})
