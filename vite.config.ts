import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['@emnapi/core']
  },
  build: {
    rollupOptions: {
      external: []
    }
  }
})