import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Dev-плагин редактора: сохранение файлов кампании на диск.
 * POST /__editor/save  { path: "campaigns/<id>/scenes/x.json", text?: string, base64?: string }
 * В продакшене/Tauri сохранение идёт через экспорт .chronicle (или Tauri fs в будущем).
 */
function editorSavePlugin(): Plugin {
  return {
    name: 'chronicle-editor-save',
    configureServer(server) {
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
  },
  build: {
    chunkSizeWarningLimit: 4200, // monaco-editor — крупный, но грузится лениво отдельным чанком
  },
})
