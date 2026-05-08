import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/couchdb': {
        target: 'http://localhost:5984',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/couchdb/, ''),
      }
    }
  }
})
