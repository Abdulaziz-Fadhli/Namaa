import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// في التطوير المحلي (npm run dev) نشغّل نفس خدمة الأسعار اللي على Vercel (api/prices.js)،
// والمفتاح يُقرأ من ملف .env.local (غير مرفوع على GitHub): SAHMK_API_KEY=...
function apiInDev() {
  return {
    name: 'namaa-api-in-dev',
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), '')
      if (env.SAHMK_API_KEY && !process.env.SAHMK_API_KEY) process.env.SAHMK_API_KEY = env.SAHMK_API_KEY
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
