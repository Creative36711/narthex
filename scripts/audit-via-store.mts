import { readFileSync, readdirSync, existsSync } from 'fs'
import { join, resolve } from 'path'
import { createServer } from 'http'
import { spawnSync } from 'child_process'
import type { AddressInfo } from 'net'
import { EditorStore } from '../src/editor/store'
import { validateCampaign, auditCounts, formatCampaignAuditReport } from '../src/editor/campaignAudit'

const root = resolve('_ai-temp/campaing')

// ── статический сервер: проверка наличия медиа ходит по HTTP ───────────────
const MIME: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.opus': 'audio/opus', '.wav': 'audio/wav',
  '.aac': 'audio/aac', '.flac': 'audio/flac', '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
  '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2',
}
const server = createServer((req, res) => {
  const rel = decodeURIComponent((req.url ?? '/').split('?')[0]).replace(/^\/+/, '')
  const file = join(root, rel)
  if (file.startsWith(root) && existsSync(file) && !rel.endsWith('/')) {
    const data = readFileSync(file)
    res.writeHead(200, { 'content-type': MIME[file.slice(file.lastIndexOf('.'))] ?? 'application/octet-stream' })
    res.end(req.method === 'HEAD' ? undefined : data)
  } else { res.writeHead(404); res.end() }
})
await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
const port = (server.address() as AddressInfo).port

// ── DOM-шимы для альфа-пробы изображений: движок рассчитывает на
// createImageBitmap/OffscreenCanvas (браузер). В node подсовываем декод
// через Pillow (/tmp/pil-venv), чтобы аудит узла давал тот же результат,
// что и аудит в приложении. Углы читаются одним прогоном на изображение. ──
const PY = existsSync('/tmp/pil-venv/bin/python') ? '/tmp/pil-venv/bin/python' : 'python3'
const PROBE = `
import sys, json
from PIL import Image
p = sys.argv[1]
im = Image.open(p).convert('RGBA')
w, h = im.size
pts = [(0,0),(w-1,0),(0,h-1),(w-1,h-1)]
print(json.dumps({'w': w, 'h': h, 'a': [im.getpixel(pt)[3] for pt in pts]}))
`
function probeImage(file: string): { w: number; h: number; corners: number[] } | null {
  const r = spawnSync(PY, ['-c', PROBE, file], { encoding: 'utf-8', timeout: 15000 })
  if (r.status !== 0) return null
  try { const j = JSON.parse(r.stdout.trim()) as { w: number; h: number; a: number[] }; return { w: j.w, h: j.h, corners: j.a } } catch { return null }
}
let imgSeq = 0
class BitmapShim {
  constructor(public width: number, public height: number, public file: string) {}
  close(): void { /* noop */ }
}
class CtxShim {
  constructor(private bmp?: BitmapShim) {}
  drawImage(bmp: BitmapShim): void { this.bmp = bmp }
  getImageData(x: number, y: number): { data: Uint8ClampedArray } {
    const px = this.bmp ? probeImage(this.bmp.file) : null
    let alpha = 0
    if (px && this.bmp) {
      const xi = x === 0 ? 0 : 1
      const yi = y === 0 ? 0 : 1
      alpha = px.corners[yi * 2 + xi] ?? 0
    }
    void imgSeq
    return { data: new Uint8ClampedArray([0, 0, 0, alpha]) }
  }
}
class CanvasShim {
  constructor(public width: number, public height: number) {}
  getContext(): CtxShim { return new CtxShim() }
}
const g = globalThis as Record<string, unknown>
g.createImageBitmap = async (blob: { arrayBuffer(): Promise<ArrayBuffer> }): Promise<BitmapShim> => {
  const buf = Buffer.from(await blob.arrayBuffer())
  const file = `/tmp/audit-alpha-probe-${imgSeq++}.img`
  const { writeFileSync } = await import('fs')
  writeFileSync(file, buf)
  const px = probeImage(file)
  if (!px) throw new Error('decode failed')
  return new BitmapShim(px.w, px.h, file)
}
g.OffscreenCanvas = CanvasShim

// ── наполнение стора содержимым пакета ─────────────────────────────────────
const store = new EditorStore(`http://127.0.0.1:${port}`)
store.meta = JSON.parse(readFileSync(join(root, 'campaign.json'), 'utf-8'))
store.world = JSON.parse(readFileSync(join(root, 'world.json'), 'utf-8'))
store.manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf-8'))

function walk(dir: string, prefix = '') {
  const full = join(root, dir)
  if (!existsSync(full)) return
  for (const name of readdirSync(full)) {
    const rel = prefix ? `${prefix}/${name}` : name
    const sub = join(full, name)
    if (name.endsWith('.json')) {
      store.jsonFiles.set(rel, JSON.parse(readFileSync(sub, 'utf-8')))
    } else if (name.endsWith('.ink') || name.endsWith('.md')) {
      store.textFiles.set(rel, readFileSync(sub, 'utf-8'))
    }
  }
}

for (const sub of ['scenes', 'entities', 'rules', 'quests', 'arenas', 'cutscenes', 'recipes', 'codex', 'dialogues', 'encounters']) {
  walk(sub, sub)
}

console.log('Store jsonFiles count:', store.jsonFiles.size)
console.log('Store textFiles count:', store.textFiles.size)

const issues = store.validateContent()
console.log('\n--- Проверка store.validateContent() ---')
console.log('Найдено замечаний:', issues.length)
for (const iss of issues) {
  console.log(' ·', iss)
}

try {
  const report = await validateCampaign(store)
  console.log('\n--- Полный отчет validateCampaign ---')
  const counts = auditCounts(report)
  console.log('Errors:', counts.errors)
  console.log('Warnings:', counts.warnings)
  console.log('Info:', counts.info)
  console.log(formatCampaignAuditReport(report))
} finally {
  server.close()
}
