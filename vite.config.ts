import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Dev-плагин редактора: сохранение файлов кампании на диск.
 * POST /__editor/save  { path: "campaigns/<id>/scenes/x.json", text?: string, base64?: string }
 * В продакшене/Tauri сохранение идёт через экспорт .chronicle (или Tauri fs в будущем).
 */
const MIME: Record<string, string> = {
  '.json': 'application/json; charset=utf-8',
  '.ink': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
}

function editorSavePlugin(): Plugin {
  return {
    name: 'chronicle-editor-save',
    configureServer(server) {
      // отдаём файлы кампаний напрямую с диска: vite не следит за public/campaigns
      // (иначе он перезагружал страницу при каждом сохранении), а его кэш
      // public-файлов не знает о кампаниях, созданных после старта сервера
      server.middlewares.use('/campaigns', (req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return next()
        const urlPath = decodeURIComponent((req.url ?? '').split('?')[0])
        const campaignsDir = path.resolve(server.config.root, 'public/campaigns')
        const target = path.resolve(campaignsDir, '.' + urlPath)
        if (!target.startsWith(campaignsDir + path.sep) && target !== campaignsDir) return next()
        let stat: fs.Stats
        try {
          stat = fs.statSync(target)
        } catch {
          return next()
        }
        if (!stat.isFile()) return next()
        res.setHeader('content-type', MIME[path.extname(target).toLowerCase()] ?? 'application/octet-stream')
        res.setHeader('cache-control', 'no-store')
        res.end(req.method === 'HEAD' ? undefined : fs.readFileSync(target))
      })

      server.middlewares.use('/__editor/save', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('method not allowed')
          return
        }
        let body = ''
        req.on('data', (c) => (body += c))
        req.on('end', () => {
          try {
            const { path: rel, text, base64 } = JSON.parse(body) as {
              path: string
              text?: string
              base64?: string
            }
            const publicDir = path.resolve(server.config.root, 'public')
            const target = path.resolve(publicDir, rel)
            // защита от выхода из public/campaigns
            const campaignsDir = path.resolve(publicDir, 'campaigns')
            if (!target.startsWith(campaignsDir + path.sep)) {
              res.statusCode = 400
              res.end('path outside campaigns dir')
              return
            }
            fs.mkdirSync(path.dirname(target), { recursive: true })
            if (base64 != null) fs.writeFileSync(target, Buffer.from(base64, 'base64'))
            else fs.writeFileSync(target, text ?? '', 'utf-8')
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ ok: true }))
          } catch (e) {
            res.statusCode = 500
            res.end(String(e))
          }
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), editorSavePlugin()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    watch: {
      // редактор пишет файлы кампаний прямо в public/ — без этого vite
      // перезагружал страницу при каждом сохранении/создании кампании
      // (экран «пропадал», создание обрывалось на середине)
      ignored: ['**/public/campaigns/**'],
    },
  },
  build: {
    chunkSizeWarningLimit: 4200, // monaco-editor — крупный, но грузится лениво отдельным чанком
  },
})
