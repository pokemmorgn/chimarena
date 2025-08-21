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
      proxy: !isProduction
        ? {
            '/api': {
              target: 'http://127.0.0.1:3000',
              changeOrigin: true,
            },
            '/colyseus': {
              target: 'http://127.0.0.1:3000',
              ws: true,
              changeOrigin: true,
              rewrite: (p) => p.replace(/^\/colyseus/, ''),
            },
          }
        : undefined,
      hmr: {
        overlay: true,
      },
    },

    // Preview
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
      sourcemap: true,              // ⬅️ toujours garder les sources
      minify: false,                // ⬅️ désactive la minification
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
        },
        output: {
          manualChunks: {
            phaser: ['phaser'],
          },
        },
      },

      terserOptions: {
        compress: {
          drop_console: false,      // ⬅️ NE SUPPRIME RIEN
          drop_debugger: false,     // ⬅️ garde même les debugger;
          pure_funcs: [],           // ⬅️ aucune fonction supprimée
        },
      },

      chunkSizeWarningLimit: 1000,
      assetsInlineLimit: 4096,
    },

    plugins: [
      legacy({
        targets: ['> 1%', 'last 2 versions', 'not dead'],
        additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
      }),
    ],

    publicDir: 'public',

    optimizeDeps: {
      exclude: [],
    },

    define: {
      __DEV__: !isProduction,
      __PROD__: isProduction,
      __DEBUG__: true,   // ⬅️ flag global que tu peux utiliser dans ton code
    },

    css: {
      devSourcemap: true,
    },

    worker: {
      format: 'es',
    },
  };
});
