import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// في التطوير المحلي (npm run dev) نشغّل نفس خدمة الأسعار اللي على Vercel (api/prices.js)،
// والمفاتيح تُقرأ من ملف .env أو .env.local (غير مرفوعة على GitHub): SAHMK_API_KEY و FINNHUB_API_KEY
function apiInDev() {
  return {
    name: 'namaa-api-in-dev',
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), '')
      for (const k of ['SAHMK_API_KEY', 'FINNHUB_API_KEY']) {
        if (env[k] && !process.env[k]) process.env[k] = env[k]
      }
      server.middlewares.use('/api/prices', async (req, res) => {
        const { default: handler } = await server.ssrLoadModule('/api/prices.js')
        req.url = `/api/prices${req.url === '/' ? '' : req.url}`
        await handler(req, res)
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), apiInDev()],
})