#!/usr/bin/env node
/**
 * Headless-аудит кампании: тот же «Проверить кампанию» из редактора, но из
 * командной строки — для ИИ-мастеров и CI. Запуск:
 *
 *   npm run audit:campaign -- <папка кампании> [--json]
 *
 * Код возврата: 0 — без ошибок (варнинги не блокируют), 1 — есть ERROR-ряды.
 *
 * Что проверяется (та же логика, что validateCampaign в src/editor/campaignAudit.ts):
 *   - ссылки структуры (id, свяи мест/сцен/диалогов, звуки, главы и т.д.);
 *   - JSON Schema пакета;
 *   - наличие медиафайлов, на которые ссылаются данные (json + ink);
 *   - прозрачность углов у изображений в «ролях сверху» (эмблема меню, рамка,
 *     спрайты сцен, фигурки боя): PNG — честный декод, JPEG — формат без
 *     альфы, WebP — по флагу формата (без пиксельного декода, см. Ниже).
 *
 * Ограничения headless-режима (в браузере проверок больше):
 *   - MIME-ответ сервера не эмулируется: «медиа отдаётся как text/html» не ловится;
 *   - WebP с альфой не раскодируется — такой файл не вызовет предупреждения об
 *     углах (браузерный аудит проверяет по-настоящему);
 *   - интерлейсированные/16-битные PNG пропускаются с пометкой.
 *
 * Запуск — ТОЛЬКО через tsx: npm run audit:campaign -- <папка> .
 * Прямой `node scripts/campaign-audit.mts` не работает (ESM-импорты ядра без
 * расширений резолвит только tsx); без репозитория используйте самодостаточный
 * bundle из чемодана: node public/ai/campaign-audit.mjs <папка>.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { join, resolve, extname } from 'path'
import { inflateSync } from 'zlib'

// ─────────────────────────── PNG: декод углов ───────────────────────────

type CornerRGBA = [number, number, number, number]

interface DecodedImage {
  width: number
  height: number
  /** rgba-значения четырёх углов [LT, RT, LB, RB]; null — формат не декодирован */
  corners: CornerRGBA[] | null
  /** 'png' | 'jpeg' | 'webp' | 'other' */
  kind: string
  note?: string
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  if (pb <= pc) return b
  return c
}

/** cheat-декод PNG: 8-бит, без интерлейса, типы 0/2/3/4/6. Углы как RGBA. */
function decodePngCorners(buf: Buffer): DecodedImage {
  if (buf.length < 33 || buf.readUInt32BE(0) !== 0x89504e47) return { width: 0, height: 0, corners: null, kind: 'other' }
  let off = 8
  let width = 0
  let height = 0
  let bitDepth = 0
  let colorType = 0
  let interlace = 0
  let plte: Buffer | null = null
  let trns: Buffer | null = null
  const idat: Buffer[] = []
  while (off + 12 <= buf.length) {
    const len = buf.readUInt32BE(off)
    const type = buf.toString('ascii', off + 4, off + 8)
    const data = buf.subarray(off + 8, off + 8 + len)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      bitDepth = data[8]!
      colorType = data[9]!
      interlace = data[12]!
    } else if (type === 'PLTE') plte = Buffer.from(data)
    else if (type === 'tRNS') trns = Buffer.from(data)
    else if (type === 'IDAT') idat.push(Buffer.from(data))
    else if (type === 'IEND') break
    off += 12 + len
  }
  if (!width || !height) return { width, height, corners: null, kind: 'png', note: 'битый IHDR' }
  if (bitDepth !== 8) return { width, height, corners: null, kind: 'png', note: '16-бит PNG — headless не декодирует' }
  if (interlace !== 0) return { width, height, corners: null, kind: 'png', note: 'интерлейс — headless не декодирует' }
  const channelsByType: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }
  const ch = channelsByType[colorType]
  if (!ch) return { width, height, corners: null, kind: 'png', note: `неизвестный colorType ${colorType}` }

  let raw: Buffer
  try {
    raw = inflateSync(Buffer.concat(idat))
  } catch {
    return { width, height, corners: null, kind: 'png', note: 'IDAT не разжался' }
  }
  const stride = width * ch
  // unfilter по строкам; заодно снимаем альфу четырёх углов.
  const corners: CornerRGBA[] = []
  const targets: Array<[number, number]> = [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]]
  const targetSet = new Map<string, number>(targets.map(([x, y], i) => [`${x},${y}`, i]))
  let prev = Buffer.alloc(stride)
  let cur = Buffer.alloc(stride)
  let p = 0
  main: for (let y = 0; y < height; y++) {
    const f = raw[p]!
    const row = raw.subarray(p + 1, p + 1 + stride)
    if (row.length < stride) return { width, height, corners: null, kind: 'png', note: 'обрезанные IDAT' }
    for (let x = 0; x < stride; x++) {
      const left = x >= ch ? cur[x - ch]! : 0
      const up = prev[x]!
      const upLeft = x >= ch ? prev[x - ch]! : 0
      const v = row[x]!
      switch (f) {
        case 0: cur[x] = v; break
        case 1: cur[x] = (v + left) & 0xff; break
        case 2: cur[x] = (v + up) & 0xff; break
        case 3: cur[x] = (v + ((left + up) >> 1)) & 0xff; break
        case 4: cur[x] = (v + paeth(left, up, upLeft)) & 0xff; break
        default: return { width, height, corners: null, kind: 'png', note: `неизвестный фильтр ${f}` }
      }
    }
    // забрать углы этой строки (y — первая/последняя)
    for (const x of [0, width - 1]) {
      const idx = targetSet.get(`${x},${y}`)
      if (idx === undefined) continue
      const o = x * ch
      let r = 0; let g = 0; let b = 0; let a = 255
      if (colorType === 6) { r = cur[o]!; g = cur[o + 1]!; b = cur[o + 2]!; a = cur[o + 3]! }
      else if (colorType === 2) {
        r = cur[o]!; g = cur[o + 1]!; b = cur[o + 2]!
        if (trns && trns.length >= 6 && (trns.readUInt16BE(0) === r * 257 || trns.readUInt16BE(0) === r) && trns.readUInt16BE(2) === g && trns.readUInt16BE(4) === b) a = 0
      } else if (colorType === 3) {
        const pi = cur[o]!
        if (plte && pi * 3 + 2 < plte.length) { r = plte[pi * 3]!; g = plte[pi * 3 + 1]!; b = plte[pi * 3 + 2]! }
        a = trns && pi < trns.length ? trns[pi]! : 255
      } else if (colorType === 4) { const g4 = cur[o]!; r = g4; g = g4; b = g4; a = cur[o + 1]! }
      else { const g0 = cur[o]!; r = g0; g = g0; b = g0 }
      corners[idx] = [r, g, b, a]
    }
    const tmp = prev; prev = cur; cur = tmp
    p += 1 + stride
    if (y > 10 && corners.filter(Boolean).length === targets.length) break main
  }
  if (corners.filter(Boolean).length !== 4) return { width, height, corners: null, kind: 'png', note: 'не все углы декодированы' }
  return { width, height, corners: corners as CornerRGBA[], kind: 'png' }
}

/** JPEG: размеры из SOF; альфы в JPEG нет в принципе. */
function jpegDims(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null
  let off = 2
  while (off + 9 < buf.length) {
    if (buf[off] !== 0xff) { off++; continue }
    const marker = buf[off + 1]!
    const len = buf.readUInt16BE(off + 2)
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: buf.readUInt16BE(off + 5), width: buf.readUInt16BE(off + 7) }
    }
    off += 2 + len
  }
  return null
}

/** WebP: размеры и признак альфы по заголовкам чанков (без декода пикселей). */
function webpInfo(buf: Buffer): { width: number; height: number; hasAlpha: boolean } | null {
  if (buf.length < 30 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return null
  const kind = buf.toString('ascii', 12, 16)
  if (kind === 'VP8X') {
    const flags = buf[20]!
    return {
      width: 1 + buf.readUIntLE(24, 3),
      height: 1 + buf.readUIntLE(27, 3),
      hasAlpha: (flags & 0x10) !== 0,
    }
  }
  if (kind === 'VP8 ') {
    return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff, hasAlpha: false }
  }
  if (kind === 'VP8L') {
    // сигнатура 0x2f, затем 14 бит ширины-1 и 14 бит высоты-1; альфа возможна (lossless)
    if (buf[20] !== 0x2f) return null
    const b1 = buf[21]!, b2 = buf[22]!, b3 = buf[23]!, b4 = buf[24]!
    const w = (((b2 & 0x3f) << 8) | b1) + 1
    const h = (((((b4 & 0xf) << 6) | (b3 << 8) | b2) >> 6) & 0x3fff) + 1
    return { width: w, height: h, hasAlpha: true }
  }
  return null
}

/** Единая точка «что за картинка и что в углах» для headless-полифилла. */
function inspectImage(buf: Buffer, ext: string): DecodedImage {
  if (ext === '.png') return decodePngCorners(buf)
  if (ext === '.jpg' || ext === '.jpeg') {
    const d = jpegDims(buf)
    if (!d) return { width: 0, height: 0, corners: null, kind: 'jpeg', note: 'битый JPEG' }
    // JPEG не умеет альфу в принципе — по углам он всегда непрозрачен
    return { width: d.width, height: d.height, corners: [[0, 0, 0, 255], [0, 0, 0, 255], [0, 0, 0, 255], [0, 0, 0, 255]], kind: 'jpeg', note: 'формат без альфы' }
  }
  if (ext === '.webp') {
    const w = webpInfo(buf)
    if (!w) return { width: 0, height: 0, corners: null, kind: 'webp', note: 'битый WebP' }
    if (w.hasAlpha) return { width: w.width, height: w.height, corners: null, kind: 'webp', note: 'WebP с альфой не раскодируется headless — пропуск углов' }
    return { width: w.width, height: w.height, corners: [[0, 0, 0, 255], [0, 0, 0, 255], [0, 0, 0, 255], [0, 0, 0, 255]], kind: 'webp', note: 'формат без альфы' }
  }
  return { width: 0, height: 0, corners: null, kind: 'other', note: `формат ${ext} headless не декодирует` }
}

// ─────────────────────────── полифиллы браузера ───────────────────────────

let CAMPAIGN_ROOT = ''
const mimeByExt: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.avif': 'image/avif', '.bmp': 'image/bmp',
  '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.opus': 'audio/ogg',
  '.wav': 'audio/wav', '.flac': 'audio/flac', '.aac': 'audio/flac',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/mp4',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.json': 'application/json', '.md': 'text/markdown', '.ink': 'text/plain',
}

/** Sentinel-basePath, под который грузится стор — шим срезает его перед чтением с диска. */
const STORE_BASE = '/campaigns/__audit__'

/** blob → относительный путь: fetch-шим помечает, createImageBitmap-шим читает. */
const blobPaths = new WeakMap<Blob, string>()
/** Путь → почему прозрачность углов не проверена (d.note из декодера). */
const imageNotes = new Map<string, string>()

function installFetchShim(): void {
  const decodePath = (url: string): string => {
    return url.split(/[?#]/, 1)[0]!
      .split('/')
      .map((seg) => { try { return decodeURIComponent(seg) } catch { return seg } })
      .join('/')
  }
  ;(globalThis as Record<string, unknown>).fetch = async (input: unknown, init?: { method?: string }) => {
    let rel = decodePath(String(input))
    if (rel.startsWith(STORE_BASE)) rel = rel.slice(STORE_BASE.length)
    rel = rel.replace(/^\/+/, '')
    const abs = resolve(CAMPAIGN_ROOT, rel)
    void init
    if (!abs.startsWith(CAMPAIGN_ROOT) || !existsSync(abs) || !statSync(abs).isFile()) {
      return { ok: false, status: 404, headers: { get: () => null }, blob: async () => new Blob([]) }
    }
    const buf = readFileSync(abs)
    const blob = new Blob([buf])
    blobPaths.set(blob, rel)
    return {
      ok: true,
      status: 200,
      headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? mimeByExt[extname(abs).toLowerCase()] ?? 'application/octet-stream' : null) },
      blob: async () => blob,
    }
  }
}

interface FakeBitmap {
  width: number
  height: number
  __pix: Map<string, CornerRGBA>
  close(): void
}

function installImageShims(): void {
  ;(globalThis as Record<string, unknown>).createImageBitmap = async (blob: Blob) => {
    const buf = Buffer.from(await blob.arrayBuffer())
    const dec = inspectImage(buf, detectExtMagic(buf))
    const pix = new Map<string, CornerRGBA>()
    if (dec.corners && dec.width && dec.height) {
      const w = dec.width, h = dec.height
      const [lt, rt, lb, rb] = dec.corners
      pix.set(`0,0`, lt!)
      pix.set(`${w - 1},0`, rt!)
      pix.set(`0,${h - 1}`, lb!)
      pix.set(`${w - 1},${h - 1}`, rb!)
    } else {
      // недекодированный формат — считаем углы прозрачными (не ругаться), но
      // регистрируем заметку: main() выдаст warning «углы НЕ проверены», чтобы
      // пропуск не был тихим (WebP с альфой, 16-бит PNG, интерлейс, экзотика)
      const rel = blobPaths.get(blob)
      if (rel && dec.note) imageNotes.set(rel, dec.note)
      const w = Math.max(1, dec.width || 1), h = Math.max(1, dec.height || 1)
      pix.set(`0,0`, [0, 0, 0, 0])
      pix.set(`${w - 1},0`, [0, 0, 0, 0])
      pix.set(`0,${h - 1}`, [0, 0, 0, 0])
      pix.set(`${w - 1},${h - 1}`, [0, 0, 0, 0])
    }
    const bmp: FakeBitmap = { width: Math.max(1, dec.width || 1), height: Math.max(1, dec.height || 1), __pix: pix, close() {} }
    return bmp
  }
  ;(globalThis as Record<string, unknown>).OffscreenCanvas = class {
    width: number
    height: number
    constructor(w: number, h: number) { this.width = w; this.height = h }
    getContext(_kind: string, _opts?: unknown) {
      void _kind; void _opts
      let drawn: FakeBitmap | null = null
      return {
        drawImage(bmp: FakeBitmap, _x: number, _y: number) {
          void _x; void _y
          if ((bmp?.width ?? 0) > 0) drawn = bmp
        },
        getImageData(x: number, y: number, _w: number, _h: number) {
          void _w; void _h
          const p = (drawn?.__pix.get(`${x},${y}`) ?? [0, 0, 0, 0]) as CornerRGBA
          return { data: new Uint8ClampedArray([p[0], p[1], p[2], p[3]]) }
        },
      }
    }
  }
}

function detectExtMagic(buf: Buffer): string {
  if (buf.length >= 4 && buf.readUInt32BE(0) === 0x89504e47) return '.png'
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xd8) return '.jpg'
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return '.webp'
  if (buf.length >= 6 && buf.toString('ascii', 0, 6).startsWith('GIF')) return '.gif'
  return '.png' // дефолт: пробуем как PNG (сработает ли — решит декодер)
}

// ─────────────────────────── загрузка кампании ───────────────────────────

interface ParsedArgs {
  root: string
  json: boolean
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2).filter((a) => a !== '--')
  const json = args.includes('--json')
  const root = args.find((a) => !a.startsWith('--'))
  if (!root) {
    console.error('Использование: npm run audit:campaign -- <папка кампании> [--json]')
    process.exit(2)
  }
  const abs = resolve(process.cwd(), root)
  if (!existsSync(join(abs, 'campaign.json'))) {
    console.error(`Не похоже на папку кампании (нет campaign.json): ${abs}`)
    process.exit(2)
  }
  return { root: abs, json }
}

async function main(): Promise<void> {
  const { root, json } = parseArgs(process.argv)
  CAMPAIGN_ROOT = resolve(root)
  installFetchShim()
  installImageShims()

  // динамический импорт — чтобы полифиллы гарантированно встали раньше загрузки модулей
  const { EditorStore } = await import('../src/editor/store')
  const { validateCampaign, formatCampaignAuditReport, auditCounts } = await import('../src/editor/campaignAudit')

  const store = new EditorStore(STORE_BASE)
  const readJson = (p: string): unknown => JSON.parse(readFileSync(join(CAMPAIGN_ROOT, p), 'utf-8'))

  store.meta = readJson('campaign.json') as typeof store.meta
  store.world = readJson('world.json') as typeof store.world
  store.manifest = existsSync(join(CAMPAIGN_ROOT, 'manifest.json'))
    ? (readJson('manifest.json') as typeof store.manifest)
    : ({} as typeof store.manifest)

  const JSON_DIRS = ['scenes', 'entities', 'rules', 'quests', 'arenas', 'cutscenes', 'recipes', 'codex', 'encounters']
  for (const dir of [...JSON_DIRS, 'dialogues']) {
    const full = join(CAMPAIGN_ROOT, dir)
    if (!existsSync(full)) continue
    for (const name of readdirSync(full)) {
      const sub = join(full, name)
      if (!statSync(sub).isFile()) continue
      const rel = `${dir}/${name}`
      if (name.endsWith('.json')) {
        try {
          store.jsonFiles.set(rel, readJson(rel))
        } catch (e) {
          console.error(`Предупреждение: ${rel} не читается как JSON (${String(e)}) — учтено как битый.`)
        }
      } else if (name.endsWith('.ink') || name.endsWith('.md')) {
        store.textFiles.set(rel, readFileSync(sub, 'utf-8'))
      }
    }
  }

  const report = await validateCampaign(store, null)
  // форматы, чьи углы headless не смог проверить: честный warning вместо тихого
  // пропуска — иначе сценарист проносит «прозрачный» спрайт с непрозрачными углами
  for (const [path, note] of imageNotes) {
    report.media.push({
      severity: 'warning',
      message: `«${path}»: прозрачность углов headless НЕ проверена (${note}). Роль изображения требует прозрачного фона; проверьте углы кнопкой «Проверить кампанию» в редакторе или конвертируйте в PNG 8-бит без интерлейса.`,
    })
  }

  if (json) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    console.log(`Headless-аудит кампании: ${CAMPAIGN_ROOT}`)
    console.log(`Файлов в покрытии: json ${store.jsonFiles.size}, ink/md ${store.textFiles.size}`)
    console.log(formatCampaignAuditReport(report))
  }
  const counts = auditCounts(report)
  console.error(`Итого: ${counts.errors} ошибок, ${counts.warnings} предупреждений, ${counts.info} заметок`)
  process.exit(counts.errors > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error('Аудит упал целиком:', e)
  process.exit(1)
})
