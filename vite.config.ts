import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

/** версия движка берётся из package.json — единый источник (см. shared/versions.ts) */
const pkg = createRequire(import.meta.url)('./package.json') as { version: string }

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

      // проверка существования каталога, включая папки без записи в index.json
      server.middlewares.use('/__editor/campaign-exists', (req, res) => {
        if (req.method !== 'GET') {
          res.statusCode = 405
          res.end('method not allowed')
          return
        }
        try {
          const id = new URL(req.url ?? '/', 'http://vite.local').searchParams.get('id')
          if (!id || /[\\/\0]/.test(id) || id === '.' || id === '..') {
            res.statusCode = 400
            res.end('invalid campaign id')
            return
          }
          const campaignsDir = path.resolve(server.config.root, 'public/campaigns')
          const target = path.resolve(campaignsDir, id)
          const exists = target.startsWith(campaignsDir + path.sep) && fs.existsSync(target)
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ exists }))
        } catch (e) {
          res.statusCode = 500
          res.end(String(e))
        }
      })

      // Список файлов нужен, чтобы отличить точный повтор .chronicle от пакета,
      // в котором изменились не только файлы, но и их состав.
      server.middlewares.use('/__editor/campaign-files', (req, res) => {
        if (req.method !== 'GET') {
          res.statusCode = 405
          res.end('method not allowed')
          return
        }
        try {
          const id = new URL(req.url ?? '/', 'http://vite.local').searchParams.get('id')
          if (!id || !/^[a-z0-9][a-z0-9_-]*$/i.test(id)) {
            res.statusCode = 400
            res.end('invalid campaign id')
            return
          }
          const campaignsDir = path.resolve(server.config.root, 'public/campaigns')
          const target = path.resolve(campaignsDir, id)
          if (!target.startsWith(campaignsDir + path.sep) || !fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
            res.statusCode = 404
            res.end('campaign directory not found')
            return
          }
          const files: string[] = []
          const walk = (directory: string): void => {
            for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
              const file = path.join(directory, entry.name)
              if (entry.isDirectory()) walk(file)
              else if (entry.isFile()) files.push(path.relative(target, file).split(path.sep).join('/'))
            }
          }
          walk(target)
          files.sort()
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ files }))
        } catch (error) {
          res.statusCode = 500
          res.end(String(error))
        }
      })

      // Атомарное резервирование локального ID: mkdirSync без recursive
      // сериализует два окна/процесса, выбравших одну и ту же случайную строку.
      server.middlewares.use('/__editor/reserve-campaign', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('method not allowed')
          return
        }
        let body = ''
        req.on('data', (chunk) => (body += chunk))
        req.on('end', () => {
          try {
            const { id } = JSON.parse(body) as { id: string }
            if (typeof id !== 'string' || !/^[a-z0-9][a-z0-9_-]*$/i.test(id)) {
              res.statusCode = 400
              res.end('invalid campaign id')
              return
            }
            const campaignsDir = path.resolve(server.config.root, 'public/campaigns')
            const target = path.resolve(campaignsDir, id)
            if (!target.startsWith(campaignsDir + path.sep)) {
              res.statusCode = 400
              res.end('path outside campaigns dir')
              return
            }
            try {
              fs.mkdirSync(target)
            } catch (error) {
              if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
                res.statusCode = 409
                res.end('campaign id already exists')
                return
              }
              throw error
            }
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ reserved: true }))
          } catch (error) {
            res.statusCode = 500
            res.end(String(error))
          }
        })
      })

      // удаление тестовых/ненужных кампаний (используется смоуками для уборки)
      server.middlewares.use('/__editor/delete', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('method not allowed')
          return
        }
        let body = ''
        req.on('data', (c) => (body += c))
        req.on('end', () => {
          try {
            const { path: rel } = JSON.parse(body) as { path: string }
            const campaignsDir = path.resolve(server.config.root, 'public/campaigns')
            const target = path.resolve(campaignsDir, rel)
            if (!target.startsWith(campaignsDir + path.sep) || target === campaignsDir) {
              res.statusCode = 400
              res.end('path outside campaigns dir')
              return
            }
            fs.rmSync(target, { recursive: true, force: true })
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ ok: true }))
          } catch (e) {
            res.statusCode = 500
            res.end(String(e))
          }
        })
      })

      // скачивание внешнего ассета по ссылке (итерация 8, блок C):
      // браузер не может прочитать чужой файл без CORS, а dev-сервер — может
      server.middlewares.use('/__editor/fetch', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('method not allowed')
          return
        }
        let body = ''
        req.on('data', (c) => (body += c))
        req.on('end', async () => {
          try {
            const { url } = JSON.parse(body) as { url: string }
            if (!/^https?:\/\//i.test(url)) {
              res.statusCode = 400
              res.end('only http(s) urls are allowed')
              return
            }
            const remote = await fetch(url)
            if (!remote.ok) {
              res.statusCode = 502
              res.setHeader('content-type', 'application/json')
              res.end(JSON.stringify({ error: `remote ${remote.status}` }))
              return
            }
            const buf = Buffer.from(await remote.arrayBuffer())
            res.setHeader('content-type', 'application/json')
            res.end(
              JSON.stringify({
                base64: buf.toString('base64'),
                mime: remote.headers.get('content-type') ?? '',
              }),
            )
          } catch (e) {
            res.statusCode = 500
            res.end(String(e))
          }
        })
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
  // версия движка доступна в рантайме как __CF_ENGINE_VERSION__ (shared/versions.ts)
  define: {
    __CF_ENGINE_VERSION__: JSON.stringify(pkg.version),
  },
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
