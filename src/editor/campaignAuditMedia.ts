import type { EditorStore } from './store'
import type { AuditFinding } from './campaignAuditTypes'

const MEDIA_EXTENSION = /\.(?:avif|gif|jpe?g|png|svg|webp|aac|flac|m4a|mp3|ogg|opus|wav|mp4|mov|webm|otf|ttf|woff2?)(?:[?#].*)?$/i

function isExternal(path: string): boolean {
  return /^(?:https?:)?\/\//i.test(path)
}

function mediaType(path: string): string {
  const clean = path.split(/[?#]/, 1)[0].toLowerCase()
  if (/\.(?:png|jpe?g|gif|svg|webp|avif)$/.test(clean)) return 'изображение'
  if (/\.(?:aac|flac|m4a|mp3|ogg|opus|wav)$/.test(clean)) return 'аудио'
  if (/\.(?:mp4|mov|webm)$/.test(clean)) return 'видео'
  return 'шрифт'
}

function expectedMime(path: string): string | undefined {
  const clean = path.split(/[?#]/, 1)[0].toLowerCase()
  if (/\.jpe?g$/.test(clean)) return 'image/jpeg'
  if (/\.png$/.test(clean)) return 'image/png'
  if (/\.webp$/.test(clean)) return 'image/webp'
  if (/\.svg$/.test(clean)) return 'image/svg+xml'
  if (/\.avif$/.test(clean)) return 'image/avif'
  if (/\.(?:aac)$/.test(clean)) return 'audio/aac'
  if (/\.(?:mp3)$/.test(clean)) return 'audio/mpeg'
  if (/\.(?:m4a)$/.test(clean)) return 'audio/mp4'
  if (/\.(?:ogg|opus)$/.test(clean)) return 'audio/ogg'
  if (/\.(?:wav)$/.test(clean)) return 'audio/wav'
  if (/\.(?:mp4)$/.test(clean)) return 'video/mp4'
  if (/\.(?:webm)$/.test(clean)) return 'video/webm'
  if (/\.(?:woff2?)$/.test(clean)) return `font/woff${clean.endsWith('.woff2') ? '2' : ''}`
  if (/\.ttf$/.test(clean)) return 'font/ttf'
  if (/\.otf$/.test(clean)) return 'font/otf'
  return undefined
}

/** Собирает ссылки на локальные и внешние медиа из всех данных кампании. */
export function collectCampaignMedia(store: EditorStore): { local: string[]; external: string[] } {
  const local = new Set<string>()
  const external = new Set<string>()
  const visit = (value: unknown): void => {
    if (typeof value === 'string') {
      const path = value.trim()
      if (!MEDIA_EXTENSION.test(path)) return
      if (isExternal(path)) external.add(path)
      else if (!/^(?:data|blob):/i.test(path)) local.add(path.split(/[?#]/, 1)[0].replace(/^\.\//, ''))
      return
    }
    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }
    if (value && typeof value === 'object') {
      Object.values(value).forEach(visit)
    }
  }

  visit(store.meta)
  visit(store.world)
  for (const value of store.jsonFiles.values()) visit(value)
  for (const text of store.textFiles.values()) {
    // 1. Ссылки в кавычках: "assets/..." или 'assets/...'
    for (const match of text.matchAll(/["']([^"'\r\n]+\.(?:avif|gif|jpe?g|png|svg|webp|aac|flac|m4a|mp3|ogg|opus|wav|mp4|mov|webm|otf|ttf|woff2?)(?:[?#][^"'\r\n]*)?)["']/gi)) {
      const path = match[1].trim()
      if (isExternal(path)) external.add(path)
      else local.add(path.split(/[?#]/, 1)[0].replace(/^\.\//, ''))
    }
    // 2. Ремарки ink без кавычек: # voice: assets/audio/..., # sfx: ..., # music: ...
    for (const match of text.matchAll(/#\s*(?:voice|sfx|music|ambient|sound|audio)\s*:\s*([^\s\r\n]+\.(?:avif|gif|jpe?g|png|svg|webp|aac|flac|m4a|mp3|ogg|opus|wav|mp4|mov|webm|otf|ttf|woff2?))/gi)) {
      const path = match[1].trim()
      if (isExternal(path)) external.add(path)
      else local.add(path.split(/[?#]/, 1)[0].replace(/^\.\//, ''))
    }
    // 3. Любые упоминания путей assets/... без кавычек
    for (const match of text.matchAll(/\b(assets\/[^\s"'\r\n,;)]+\.(?:avif|gif|jpe?g|png|svg|webp|aac|flac|m4a|mp3|ogg|opus|wav|mp4|mov|webm|otf|ttf|woff2?))/gi)) {
      const path = match[1].trim()
      if (isExternal(path)) external.add(path)
      else local.add(path.split(/[?#]/, 1)[0].replace(/^\.\//, ''))
    }
  }
  return { local: [...local].sort(), external: [...external].sort() }
}

/** Отпечаток данных — позволяет отметить, если после плейтеста контент менялся. */
export function campaignContentHash(store: EditorStore): string {
  const content = store.allPaths().sort().map((path) => `${path}\n${store.fileText(path)}`).join('\n\u0000\n')
  let hash = 0x811c9dc5
  for (let i = 0; i < content.length; i++) {
    hash ^= content.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export async function inspectLocalMedia(store: EditorStore, paths: string[]): Promise<AuditFinding[]> {
  return Promise.all(paths.map(async (path): Promise<AuditFinding> => {
    if (!path || path.startsWith('/') || path.includes('\\') || path.split('/').includes('..')) {
      return { severity: 'error', message: `Недопустимый путь медиа: «${path}». Используйте относительный путь внутри кампании.` }
    }
    try {
      const url = `${store.basePath}/${path.split('/').map(encodeURIComponent).join('/')}`
      let response = await fetch(url, { method: 'HEAD', cache: 'no-store' })
      if (response.status === 405 || response.status === 501) response = await fetch(url, { method: 'GET', cache: 'no-store' })
      if (!response.ok || (response.headers.get('content-type') ?? '').toLowerCase().includes('text/html')) {
        return { severity: 'error', message: `Не найден ${mediaType(path)} «${path}».` }
      }
      const actualMime = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
      const expected = expectedMime(path)
      if (expected && actualMime && actualMime !== expected && actualMime !== 'application/octet-stream') {
        return { severity: 'warning', message: `Файл «${path}» отдаётся как ${actualMime}, ожидался ${expected}; проверьте воспроизведение.` }
      }
      if (actualMime === 'application/octet-stream') {
        return { severity: 'warning', message: `Файл «${path}» отдаётся как неизвестный бинарный тип; плеер может не распознать формат.` }
      }
      return { severity: 'info', message: `Файл найден: ${path}` }
    } catch {
      return { severity: 'error', message: `Не удалось проверить ${mediaType(path)} «${path}».` }
    }
  }))
}

/** Роли изображений, где фон — гарантированный брак: картинка кладётся поверх другого контента. */
function alphaRolePaths(store: EditorStore): Array<{ path: string; role: string }> {
  const out: Array<{ path: string; role: string }> = []
  const art = store.meta.theme?.menu?.title_art
  if (art) out.push({ path: art, role: 'эмблема меню (theme.menu.title_art) лежит поверх фона меню' })
  const frameImg = store.meta.theme?.frame?.image
  if (frameImg) out.push({ path: frameImg, role: 'рамка интерфейса (theme.frame.image) обрамляет окна' })

  for (const atm of store.meta.atmospherics ?? []) {
    if (atm.sprite) out.push({ path: atm.sprite, role: `спрайт атмосферной частицы «${atm.label || atm.id}»` })
  }

  for (const p of store.entityPaths()) {
    const e = store.entity(p)
    const spr = typeof e.scene_sprite === 'string' ? e.scene_sprite : undefined
    if (spr) out.push({ path: spr, role: `спрайт в сцене «${e.label}» стоит в слоте поверх фона сцены` })
    if ('scene_sprite_states' in e && e.scene_sprite_states) {
      for (const [st, img] of Object.entries(e.scene_sprite_states as Record<string, string>)) {
        if (typeof img === 'string') out.push({ path: img, role: `спрайт состояния «${st}» в сцене «${e.label}»` })
      }
    }
    const fig = 'combat_figure' in e && typeof e.combat_figure === 'string' ? e.combat_figure : undefined
    if (fig) out.push({ path: fig, role: `фигурка боя «${e.label}» стоит поверх арены` })
  }
  return out
}

/**
 * Проверка альфа-канала по углам картинки: если все четыре угла непрозрачные,
 * изображение почти наверняка с фоном (квадрат-подложка в меню/сцене/бою).
 * Дыра найдена на кампании «Ржавая литургия»: эмблема меню пришла чёрным
 * квадратом — чемодан теперь требует прозрачность, а аудит ловит нарушение.
 */
export async function inspectAlphaRoles(store: EditorStore): Promise<AuditFinding[]> {
  const findings: AuditFinding[] = []
  for (const { path, role } of alphaRolePaths(store)) {
    if (isExternal(path) || path.startsWith('data:') || path.startsWith('blob:')) continue
    try {
      const url = `${store.basePath}/${path.split('/').map(encodeURIComponent).join('/')}`
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) continue // «файл не найден» уже расскажет медиа-проверка
      const bmp = await createImageBitmap(await res.blob())
      const w = bmp.width
      const h = bmp.height
      if (!w || !h) continue
      const ctx = new OffscreenCanvas(w, h).getContext('2d', { willReadFrequently: true })
      if (!ctx) continue
      ctx.drawImage(bmp, 0, 0)
      const corners: Array<[number, number]> = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]]
      const opaque = corners.every(([x, y]) => ctx.getImageData(x, y, 1, 1).data[3] === 255)
      bmp.close?.()
      if (opaque) {
        findings.push({
          severity: 'warning',
          message: `«${path}»: ${role}, поэтому требуется прозрачный фон (PNG с альфой); у файла непрозрачные углы — похоже на фон-подложку или нарисованную шахматку. Сгенерируйте на хромакее и вырежьте: python3 scripts/cutout-chromakey.py "${path}"`,
        })
      }
    } catch {
      // картинку не удалось декодировать: раньше это был тихий пропуск, и
      // сценарист искренне верил, что «углы проверены». Честно говорим, что
      // именно не проверено — иначе сюда пролезает «прозрачный» спрайт с
      // непрозрачными углами (WebP с альфой, 16-бит/интерлейс PNG в headless,
      // битый файл или экзотический формат в браузере).
      findings.push({
        severity: 'warning',
        message: `«${path}»: ${role}, требуется прозрачный фон, но углы проверить не удалось — изображение не декодируется (битый файл или формат вне поддержки проверки). Конвертируйте в PNG 8-бит без интерлейса и перепроверьте.`,
      })
    }
  }
  return findings
}
