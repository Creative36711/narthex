/**
 * Проверка медиа кампаний: то, что агент иначе смотрит глазами.
 *
 *   npm run media:check             — таблица находок
 *   npm run media:check -- --json   — машинный результат для отчёта
 *
 * Что проверяется и почему именно это:
 *
 * - **формат по сигнатуре, а не по расширению.** `cat.png`, внутри которого
 *   HTML-страница preview, — реальный дефект фазы 2 (27 картинок вместо
 *   изображений). Расширение врёт, сигнатура — нет.
 * - **размеры и альфа.** Портрет без альфы и спрайт с непрозрачным фоном
 *   ломают компоновку сцены; это ловится без браузера.
 * - **остаток хромакея.** `scripts/cutout-chromakey.py` уже один раз съел
 *   бирюзу вместо зелёного фона (кампания «Каркас»). Пиксель считается
 *   остатком, только если зелёный канал доминирует и синий не близок к нему —
 *   та же логика, что в «лечилке», чтобы проверка не ругалась на бирюзу.
 * - **вес файла.** Кампания с 462 картинками не должна тянуть гигабайты:
 *   бюджет на ассет фиксирован ниже и меняется решением, а не «по ситуации».
 * - **объявления отсутствий.** `known_absent_images` в `dev-fixture.json` —
 *   обещание «этих файлов нет намеренно». Если файл появился, объявление
 *   устарело и приёмка перестаёт что-либо значить.
 *
 * Чего здесь нет: декодирования видео и звука. `ffmpeg` в образе отсутствует,
 * а `ffmpeg-static` не ставится (бинарь тянется с закрытого хоста). Поэтому
 * у аудио проверяются сигнатура и вес, а длительность — нет. Это ограничение
 * записано в `docs/agents/toolbox.md`, а не спрятано.
 */
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { inflateSync } from 'node:zlib'

const root = resolve(import.meta.dirname, '..')
const campaignsDir = join(root, 'public', 'campaigns')
const asJson = process.argv.includes('--json')

/** Бюджет на один ассет, байты. Меняется решением, а не правкой под результат. */
const IMAGE_BUDGET = 4 * 1024 * 1024
const AUDIO_BUDGET = 8 * 1024 * 1024
/** Доля «ключевого» зелёного, после которой кромку считаем неубранной. */
const KEY_GREEN_SHARE_LIMIT = 0.005

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif'])
const AUDIO_EXT = new Set(['.ogg', '.mp3', '.wav', '.m4a', '.flac'])
const VIDEO_EXT = new Set(['.mp4', '.webm'])

interface Finding {
  level: 'fail' | 'warn'
  file: string
  code: string
  message: string
}

const findings: Finding[] = []
const fail = (file: string, code: string, message: string) =>
  findings.push({ level: 'fail', file, code, message })
const warn = (file: string, code: string, message: string) =>
  findings.push({ level: 'warn', file, code, message })

interface ImageInfo {
  format: 'png' | 'jpeg' | 'gif' | 'webp' | 'unknown'
  width: number
  height: number
  alpha: boolean | null
}

/** Сигнатуры форматов: проверяем содержимое, а не имя файла. */
function sniff(bytes: Buffer): ImageInfo['format'] {
  if (bytes.length >= 8 && bytes.readUInt32BE(0) === 0x89504e47) return 'png'
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg'
  if (bytes.length >= 6 && bytes.subarray(0, 3).toString('latin1') === 'GIF') return 'gif'
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString('latin1') === 'RIFF' &&
    bytes.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return 'webp'
  }
  return 'unknown'
}

function imageInfo(bytes: Buffer): ImageInfo {
  const format = sniff(bytes)
  switch (format) {
    case 'png': {
      const width = bytes.readUInt32BE(16)
      const height = bytes.readUInt32BE(20)
      const bitDepth = bytes[24]
      const colorType = bytes[25]
      // Альфа есть у gray+alpha (4) и RGBA (6); палитра с tRNS — отдельный случай.
      const alpha = (colorType === 4 || colorType === 6) && bitDepth === 8
      return { format, width, height, alpha }
    }
    case 'jpeg': {
      let offset = 2
      while (offset + 9 < bytes.length) {
        if (bytes[offset] !== 0xff) {
          offset += 1
          continue
        }
        const marker = bytes[offset + 1]
        const length = bytes.readUInt16BE(offset + 2)
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return {
            format,
            width: bytes.readUInt16BE(offset + 7),
            height: bytes.readUInt16BE(offset + 5),
            alpha: false,
          }
        }
        offset += 2 + length
      }
      return { format, width: 0, height: 0, alpha: false }
    }
    case 'gif':
      return { format, width: bytes.readUInt16LE(6), height: bytes.readUInt16LE(8), alpha: true }
    case 'webp': {
      const chunk = bytes.subarray(12, 16).toString('latin1')
      if (chunk === 'VP8X' && bytes.length >= 30) {
        const width = 1 + bytes.readUIntLE(24, 3)
        const height = 1 + bytes.readUIntLE(27, 3)
        const flags = bytes[20]
        return { format, width, height, alpha: (flags & 0x10) !== 0 }
      }
      return { format, width: 0, height: 0, alpha: null }
    }
    default:
      return { format, width: 0, height: 0, alpha: null }
  }
}

/**
 * Минимальный декодер PNG (8 бит, без чересстрочности).
 *
 * Возвращает долю пикселей «ключевого» зелёного или `null`, если файл в этот
 * путь не укладывается: тогда проверка честно говорит «не проверено», а не
 * «чисто».
 */
function keyGreenShare(bytes: Buffer): number | null {
  if (sniff(bytes) !== 'png' || bytes.length < 33) return null
  const bitDepth = bytes[24]
  const colorType = bytes[25]
  const interlace = bytes[28]
  if (bitDepth !== 8 || interlace !== 0) return null
  if (colorType !== 2 && colorType !== 6) return null
  const channels = colorType === 6 ? 4 : 3
  const width = bytes.readUInt32BE(16)
  const height = bytes.readUInt32BE(20)

  const idat: Buffer[] = []
  let offset = 8
  while (offset + 8 <= bytes.length) {
    const length = bytes.readUInt32BE(offset)
    const type = bytes.subarray(offset + 4, offset + 8).toString('latin1')
    if (type === 'IDAT') idat.push(bytes.subarray(offset + 8, offset + 8 + length))
    offset += 12 + length
  }
  if (idat.length === 0) return null

  let raw: Buffer
  try {
    raw = inflateSync(Buffer.concat(idat))
  } catch {
    return null
  }

  const stride = width * channels
  if (raw.length < (stride + 1) * height) return null
  const pixels = Buffer.alloc(stride * height)
  const paeth = (a: number, b: number, c: number) => {
    const p = a + b - c
    const pa = Math.abs(p - a)
    const pb = Math.abs(p - b)
    const pc = Math.abs(p - c)
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
  }
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)]
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride)
    for (let x = 0; x < stride; x += 1) {
      const left = x >= channels ? pixels[y * stride + x - channels] : 0
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0
      const upLeft = y > 0 && x >= channels ? pixels[(y - 1) * stride + x - channels] : 0
      let value = line[x]
      if (filter === 1) value += left
      else if (filter === 2) value += up
      else if (filter === 3) value += Math.floor((left + up) / 2)
      else if (filter === 4) value += paeth(left, up, upLeft)
      pixels[y * stride + x] = value & 0xff
    }
  }

  let total = 0
  let keyed = 0
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const base = y * stride + x * channels
      const r = pixels[base]
      const g = pixels[base + 1]
      const b = pixels[base + 2]
      const a = channels === 4 ? pixels[base + 3] : 255
      total += 1
      if (a < 8) continue
      // Строгий «ключевой» зелёный: насыщенный, без синей составляющей.
      if (g > 200 && r < 40 && b < 40) keyed += 1
    }
  }
  return total === 0 ? null : keyed / total
}

function walk(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.')) continue
    const full = join(dir, name)
    const stat = statSync(full)
    if (stat.isDirectory()) out.push(...walk(full))
    else out.push(full)
  }
  return out
}

function campaignDirs(): string[] {
  try {
    return readdirSync(campaignsDir)
      .map((name) => join(campaignsDir, name))
      .filter((path) => statSync(path).isDirectory())
  } catch {
    return []
  }
}

interface CampaignReport {
  id: string
  assets: number
  images: number
  audio: number
  video: number
  bytes: number
  declaredAbsent: number
  keyGreenChecked: number
  /** PNG, которые не удалось декодировать упрощённым путём: «не проверено», а не «чисто». */
  pngUnchecked: number
}

const reports: CampaignReport[] = []
const byHash = new Map<string, string[]>()

for (const dir of campaignDirs()) {
  const id = relative(campaignsDir, dir)
  const files = walk(dir)
  const media = files.filter((file) => {
    const lower = file.toLowerCase()
    const ext = lower.slice(lower.lastIndexOf('.'))
    return IMAGE_EXT.has(ext) || AUDIO_EXT.has(ext) || VIDEO_EXT.has(ext)
  })

  let images = 0
  let audio = 0
  let video = 0
  let bytes = 0
  let keyGreenChecked = 0
  let pngUnchecked = 0
  const rel = (file: string) => relative(root, file).split(sep).join('/')

  for (const file of media) {
    const buffer = readFileSync(file)
    const size = buffer.length
    bytes += size
    const lower = file.toLowerCase()
    const ext = lower.slice(lower.lastIndexOf('.'))
    const hash = createHash('sha256').update(buffer).digest('hex')
    const known = byHash.get(hash) ?? []
    known.push(rel(file))
    byHash.set(hash, known)

    if (IMAGE_EXT.has(ext)) {
      images += 1
      const info = imageInfo(buffer)
      if (info.format === 'unknown') {
        fail(rel(file), 'not-an-image', `расширение ${ext}, а сигнатура не изображение (вероятно HTML/404)`)
        continue
      }
      if (info.width === 0 || info.height === 0) {
        fail(rel(file), 'no-dimensions', 'не удалось прочитать размеры — файл повреждён или обрезан')
      }
      if (size > IMAGE_BUDGET) {
        fail(rel(file), 'over-budget', `${(size / 1024 / 1024).toFixed(2)} МБ при пределе 4 МБ`)
      }
      const share = info.format === 'png' ? keyGreenShare(buffer) : null
      if (info.format === 'png' && share === null) pngUnchecked += 1
      if (share !== null) {
        keyGreenChecked += 1
        if (share > KEY_GREEN_SHARE_LIMIT) {
          fail(
            rel(file),
            'key-green-left',
            `${(share * 100).toFixed(2)}% непрозрачных пикселей — ключевой зелёный не вырезан (предел 0.5%)`,
          )
        }
      }
      continue
    }

    if (AUDIO_EXT.has(ext)) {
      audio += 1
      const isOgg = buffer.subarray(0, 4).toString('latin1') === 'OggS'
      const isMp3 =
        buffer.subarray(0, 3).toString('latin1') === 'ID3' || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)
      const isWav = buffer.subarray(0, 4).toString('latin1') === 'RIFF'
      const isFlac = buffer.subarray(0, 4).toString('latin1') === 'fLaC'
      if (!isOgg && !isMp3 && !isWav && !isFlac) {
        fail(rel(file), 'not-audio', `расширение ${ext}, а сигнатура не аудио`)
      }
      if (size > AUDIO_BUDGET) {
        fail(rel(file), 'over-budget', `${(size / 1024 / 1024).toFixed(2)} МБ при пределе 8 МБ`)
      }
      continue
    }

    if (VIDEO_EXT.has(ext)) {
      video += 1
      const isMp4 = buffer.subarray(4, 8).toString('latin1') === 'ftyp'
      const isWebm = buffer.readUInt32BE(0) === 0x1a45dfa3
      if (!isMp4 && !isWebm) fail(rel(file), 'not-a-video', `расширение ${ext}, а сигнатура не видео`)
    }
  }

  // Объявленные отсутствия: обещание должно оставаться правдой.
  let declaredAbsent = 0
  const fixturePath = join(dir, 'dev-fixture.json')
  try {
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as { known_absent_images?: unknown }
    if (Array.isArray(fixture.known_absent_images)) {
      declaredAbsent = fixture.known_absent_images.length
      for (const entry of fixture.known_absent_images) {
        if (typeof entry !== 'string') {
          fail(rel(fixturePath), 'bad-absence', 'в known_absent_images не строка')
          continue
        }
        if (existsSyncSafe(join(dir, entry))) {
          fail(rel(fixturePath), 'absence-stale', `${entry} объявлен отсутствующим, но лежит в репозитории`)
        }
      }
    }
  } catch {
    // Файла нет — значит и объявлений нет: не находка.
  }

  reports.push({ id, assets: media.length, images, audio, video, bytes, declaredAbsent, keyGreenChecked, pngUnchecked })
}

function existsSyncSafe(path: string): boolean {
  try {
    return statSync(path).isFile()
  } catch {
    return false
  }
}

for (const [hash, files] of byHash) {
  if (files.length > 1) {
    warn(files[1], 'duplicate', `тот же файл (${hash.slice(0, 12)}), что и ${files[0]}`)
  }
}

const failures = findings.filter((finding) => finding.level === 'fail')
const warnings = findings.filter((finding) => finding.level === 'warn')

if (asJson) {
  console.log(JSON.stringify({ campaigns: reports, findings, failures: failures.length, warnings: warnings.length }, null, 2))
} else {
  console.log('Медиа кампаний')
  if (reports.length === 0) console.log('  (кампаний нет)')
  for (const report of reports) {
    console.log(
      `  ${report.id.padEnd(28)} ${String(report.assets).padStart(3)} ассетов · ` +
        `${report.images} изображений · ${report.audio} аудио · ${report.video} видео · ` +
        `${(report.bytes / 1024).toFixed(1)} КБ · отсутствий объявлено ${report.declaredAbsent}`,
    )
  }

  console.log('\nНаходки')
  if (findings.length === 0) {
    console.log('  (пусто)')
  } else {
    for (const finding of findings) {
      console.log(`  ${finding.level === 'fail' ? '✗' : '·'} ${finding.file}: ${finding.message} [${finding.code}]`)
    }
  }

  const unchecked = reports.reduce((sum, report) => sum + report.pngUnchecked, 0)
  if (unchecked > 0) {
    console.log(`\n  ${unchecked} PNG вне проверки хромакея (не 8 бит или с чересстрочностью) — это «не проверено», а не «чисто».`)
  }
  console.log(`\nИтого: ${failures.length} провалов, ${warnings.length} предупреждений.`)
}

if (failures.length > 0) process.exit(1)
