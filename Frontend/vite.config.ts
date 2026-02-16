import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3001,
        host: '0.0.0.0',
        proxy: {
          '/api': {
            target: env.VITE_API_URL || 'http://localhost:5000',
            changeOrigin: true,
            secure: false,
          }
        }
      },
      plugins: [react()],
      define: {
        'process.env.MISTRAL_API_KEY': JSON.stringify(env.VITE_MISTRAL_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        outDir: 'dist',
        rollupOptions: {
          output: {
            manualChunks: {
              vendor: ['react', 'react-dom'],
              charts: ['recharts'],
              icons: ['lucide-react']
            }
          }
        },
        chunkSizeWarningLimit: 1000,
        minify: 'esbuild',
        sourcemap: false,
        target: 'esnext'
      },
      optimizeDeps: {
        include: ['react', 'react-dom', 'recharts', 'lucide-react'],
        exclude: ['firebase']
      }
    };
});
