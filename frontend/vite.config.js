import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    allowedHosts: ['frontend', 'localhost', '.localhost'], // Fix for Vite 5.4+ blocking Docker host headers
    watch: {
      usePolling: true, // Needed for Docker on Windows
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
  },
})
