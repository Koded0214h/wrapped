import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // The privacy wording is derived from the AI settings, so it cannot claim less than the app sends.
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const privacy = env.VITE_AI_PLANNER !== 'on' ? 'local-only' : env.VITE_AI_MODE === 'with-quotes' ? 'ai-quotes' : 'ai-facts'
  return {
    plugins: [react()],
    define: { __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '0.1.0'), __PRIVACY_COPY_MODE__: JSON.stringify(privacy) },
    server: { proxy: { '/api': 'http://127.0.0.1:8787', '/admin': 'http://127.0.0.1:8787' } }
  }
})
