import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '0.1.0'), __PRIVACY_COPY_MODE__: JSON.stringify(process.env.PRIVACY_COPY_MODE || process.env.VITE_PRIVACY_COPY_MODE || 'ai-facts') },
  server: { proxy: { '/api': 'http://127.0.0.1:8787', '/admin': 'http://127.0.0.1:8787' } }
})
