import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { version } from './package.json';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'production' ? '/ch3ssvid5/' : '/',
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  server: {
    host: true,
  },
  optimizeDeps: {
    include: ['chessops', 'chessops/variant', 'chessops/compat', 'chessops/fen', 'chessops/san'],
    exclude: ['stockfish'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React core — cached separately, rarely changes
          'vendor-react': ['react', 'react-dom', 'react-i18next', 'i18next', 'i18next-browser-languagedetector'],
          // Chess logic — stable library, cached long-term
          'vendor-chess': ['chessops', 'chessground'],
          // P2P sharing — only loaded when sharing
          'vendor-peer': ['peerjs'],
        },
      },
    },
  },
}));
