import { defineConfig } from 'vite';
import legacy from '@vitejs/plugin-legacy';
import { resolve } from 'path';

export default defineConfig(({ command, mode }) => {
  const isProduction = mode === 'production';

  return {
    // Point d'entrée
    root: './',
    
    // Configuration du serveur de développement
    server: {
      port: 8080,
      host: true,
      open: true,
      cors: true,
      // Support HMR pour Phaser
      hmr: {
        overlay: true
      }
    },

    // Configuration de prévisualisation
    preview: {
      port: 4173,
      host: true
    },

    // Configuration des chemins d'alias
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        '@assets': resolve(__dirname, 'assets'),
        '@scenes': resolve(__dirname, 'src/scenes'),
        '@game': resolve(__dirname, 'src/game'),
        '@utils': resolve(__dirname, 'src/utils')
      }
    },

    // Configuration de build
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: isProduction ? true : false,
      minify: isProduction ? 'terser' : false,
      
      // Configuration pour optimiser Phaser
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html')
        },
        output: {
          manualChunks: {
            // Séparer Phaser dans son propre chunk
            phaser: ['phaser'],
            // Séparer Colyseus
            colyseus: ['colyseus.js']
          }
        }
      },

      // Options de compression
      terserOptions: {
        compress: {
          drop_console: isProduction,
          drop_debugger: isProduction
        }
      },

      // Taille des chunks
      chunkSizeWarningLimit: 1000,
      
      // Assets inline threshold
      assetsInlineLimit: 4096
    },

    // Plugins
    plugins: [
      // Support des navigateurs legacy
      legacy({
        targets: ['> 1%', 'last 2 versions', 'not dead'],
        additionalLegacyPolyfills: ['regenerator-runtime/runtime']
      })
    ],

    // Configuration des assets statiques
    publicDir: 'public',

    // Optimisation des dépendances
    optimizeDeps: {
      include: ['phaser', 'colyseus.js'],
      exclude: []
    },

    // Variables d'environnement
    define: {
      __DEV__: !isProduction,
      __PROD__: isProduction
    },

    // Configuration CSS
    css: {
      devSourcemap: !isProduction
    },

    // Configuration du mode worker (si nécessaire)
    worker: {
      format: 'es'
    }
  };
});
