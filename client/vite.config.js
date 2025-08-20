import { defineConfig } from 'vite';
import legacy from '@vitejs/plugin-legacy';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';

  return {
    // Point d'entrée
    root: './',

    // Dév server
    server: {
      port: 8080,
      host: true,
      open: true,
      cors: true,
      // Proxy dev: évite CORS et mappe API/WS vers les backends locaux
      proxy: !isProduction
        ? {
            // API -> Node (3000)
            '/api': {
              target: 'http://127.0.0.1:3000',
              changeOrigin: true,
            },
            // WebSocket Colyseus -> 3000
            '/colyseus': {
              target: 'http://127.0.0.1:3000',
              ws: true,
              changeOrigin: true,
              rewrite: (p) => p.replace(/^\/colyseus/, ''),
            },
          }
        : undefined,
      // HMR Phaser
      hmr: {
        overlay: true,
      },
    },

    // Preview (vite preview)
    preview: {
      port: 4173,
      host: true,
    },

    // Alias
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        '@assets': resolve(__dirname, 'assets'),
        '@scenes': resolve(__dirname, 'src/scenes'),
        '@game': resolve(__dirname, 'src/game'),
        '@utils': resolve(__dirname, 'src/utils'),
      },
    },

    // Build
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: isProduction ? true : false,
      minify: isProduction ? 'terser' : false,

      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
        },
        output: {
          manualChunks: {
            phaser: ['phaser'],
            colyseus: ['colyseus.js'],
          },
        },
      },

      terserOptions: {
        compress: {
          drop_console: isProduction,
          drop_debugger: isProduction,
        },
      },

      chunkSizeWarningLimit: 1000,
      assetsInlineLimit: 4096,
    },

    // Plugins
    plugins: [
      legacy({
        targets: ['> 1%', 'last 2 versions', 'not dead'],
        additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
      }),
    ],

    publicDir: 'public',

    optimizeDeps: {
      include: ['phaser', 'colyseus.js'],
      exclude: [],
    },

    define: {
      __DEV__: !isProduction,
      __PROD__: isProduction,
    },

    css: {
      devSourcemap: !isProduction,
    },

    worker: {
      format: 'es',
    },
  };
});
