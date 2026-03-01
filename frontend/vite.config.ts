import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // Backend URL: Use env var if set, otherwise use Docker service name or localhost
  // In Docker: Use 'backend' service name (from docker-compose network)
  // Local dev: defaults to http://localhost:3002
  const backendUrl = process.env.VITE_BACKEND_URL || env.VITE_BACKEND_URL || 'http://backend:3002'

  // Allowed hosts for domain access (comma-separated in env var)
  // Example: VITE_ALLOWED_HOSTS=myapp.example.com,app.mydomain.org
  const allowedHostsEnv = process.env.VITE_ALLOWED_HOSTS || env.VITE_ALLOWED_HOSTS || ''
  const allowedHosts = allowedHostsEnv ? allowedHostsEnv.split(',').map(h => h.trim()) : true

  return {
    plugins: [react()],
    server: {
      port: 5173,
      host: '0.0.0.0',
      allowedHosts,
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
        },
        '/uploads': {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: mode !== 'production',
      minify: 'esbuild',
      target: 'es2020',
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            axios: ['axios'],
            // CodeMirror is heavy and only used in custom widget script editor
            codemirror: ['codemirror', '@codemirror/lang-javascript', '@codemirror/autocomplete', '@codemirror/view', '@codemirror/state', '@lezer/highlight'],
          },
        },
      },
      chunkSizeWarningLimit: 1000,
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-router-dom', 'axios'],
    },
  }
})
