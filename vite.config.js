import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
      '/nvidia-api': {
        target: 'https://integrate.api.nvidia.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/nvidia-api/, ''),
      },
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
      '/ws':  { target: 'http://localhost:8000', ws: true, changeOrigin: true },
    },
  },
})
