import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Update target if your API runs on a different port
const DEV_API_TARGET = 'http://localhost:5199'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 8080,
    strictPort: true,
    proxy: {
      '/api': {
        target: DEV_API_TARGET,
        changeOrigin: true,
        secure: false
      }
    }
  },
  preview: {
    port: 8080
  }
})
