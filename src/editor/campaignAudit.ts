import Ajv2020 from 'ajv/dist/2020.js'
import campaignSchemaJson from '../../docs/campaign.schema.json' with { type: 'json' }
import type { ErrorObject, ValidateFunction } from 'ajv'
import type { EditorStore } from './store'
import { charCreationTemplateFindings } from '../core/charcreate'

export type AuditSeverity = 'error' | 'warning' | 'info'
export interface AuditFinding {
  severity: AuditSeverity
  message: string
}
export interface CampaignAuditReport {
  checkedAt: number
  structure: AuditFinding[]
  media: AuditFinding[]
  playtest: AuditFinding[]
}
export interface PlaytestRecord {
  startedAt: number
  finishedAt: number
  contentHash: string
  notes?: string
}

const schema = campaignSchemaJson as typeof campaignSchemaJson & { $id: string }
const ajv = new Ajv2020({ allErrors: true, strict: false })
ajv.addSchema(schema)
const schemaValidators = new Map<string, ValidateFunction>()

function validateSchema(typeName: string, value: unknown, label: string): string[] {
  let validator = schemaValidators.get(typeName)
  if (!validator) {
    validator = ajv.compile({ $ref: `${schema.$id}#/$defs/${typeName}` })
    schemaValidators.set(typeName, validator)
  }
  if (validator(value)) return []
  return (validator.errors ?? []).map((error: ErrorObject) => {
    const at = error.instancePath || '/'
    return `Схема ${label}${at}: ${error.message ?? 'значение недопустимо'}`
  })
}

function validatePackageSchema(store: EditorStore): string[] {
  const issues = [
    ...validateSchema('CampaignMeta', store.meta, 'campaign.json'),
    ...validateSchema('WorldDef', store.world, 'world.json'),
    ...validateSchema('CampaignManifest', store.manifest, 'manifest.json'),
  ]
  const buckets: Array<[string[], string, string]> = [
    [store.manifest.scenes, 'scenes', 'SceneDef'],
    [store.manifest.entities, 'entities', 'EntityDef'],
    [store.manifest.rules, 'rules', 'RuleDef'],
    [store.manifest.arenas ?? [], 'arenas', 'ArenaDef'],
    [store.manifest.quests ?? [], 'quests', 'QuestDef'],
    [store.manifest.cutscenes ?? [], 'cutscenes', 'CutsceneDef'],
    [store.manifest.recipes ?? [], 'recipes', 'RecipeDef'],
    [store.manifest.codex ?? [], 'codex', 'CodexEntryDef'],
  ]
  for (const [files, folder, typeName] of buckets) {
    for (const filename of files) {
      const path = `${folder}/${filename}`
      issues.push(...validateSchema(typeName, store.jsonFiles.get(path), path))
    }
  }
  for (const filename of store.manifest.encounters ?? []) {
    const path = `rules/${filename}`
    issues.push(...validateSchema('EncounterFileDef', store.jsonFiles.get(path), path))
  }
  for (const filename of store.manifest.dialogues ?? []) {
    const path = `dialogues/${filename.replace(/\\.ink$/, '.dlg.json')}`
    const doc = store.jsonFiles.get(path)
    if (doc) issues.push(...validateSchema('DlgDoc', doc, path))
  }
  return issues
}

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
    for (const match of text.matchAll(/["']([^"'\r\n]+\.(?:avif|gif|jpe?g|png|svg|webp|aac|flac|m4a|mp3|ogg|opus|wav|mp4|mov|webm|otf|ttf|woff2?)(?:[?#][^"'\r\n]*)?)["']/gi)) {
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

async function inspectLocalMedia(store: EditorStore, paths: string[]): Promise<AuditFinding[]> {
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
  for (const p of store.entityPaths()) {
    const e = store.entity(p)
    const spr = typeof e.scene_sprite === 'string' ? e.scene_sprite : undefined
    if (spr) out.push({ path: spr, role: `спрайт в сцене «${e.label}» стоит в слоте поверх фона сцены` })
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
async function inspectAlphaRoles(store: EditorStore): Promise<AuditFinding[]> {
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
          message: `«${path}»: ${role}, поэтому требуется прозрачный фон (PNG с альфой); у файла непрозрачные углы — похоже на фон-подложку. Перегенерируйте или вырежьте фон.`,
        })
      }
    } catch {
      // не удалось декодить картинку — не критично, расскажут другие проверки
    }
  }
  return findings
}

export async function validateCampaign(store: EditorStore, lastPlaytest?: PlaytestRecord | null): Promise<CampaignAuditReport> {
  let structure: AuditFinding[] = []
  try {
    structure.push(...store.validateContent().map((message) => ({ severity: 'error' as const, message })))
  } catch (error) {
    structure.push({ severity: 'error', message: `Проверка ссылок завершилась ошибкой: ${String(error)}` })
  }
  try {
    structure.push(...validatePackageSchema(store).map((message) => ({ severity: 'error' as const, message })))
  } catch (error) {
    structure.push({ severity: 'error', message: `Проверка JSON Schema завершилась ошибкой: ${String(error)}` })
  }
  if (store.meta.char_creation) {
    structure.push(...charCreationTemplateFindings(store.meta.char_creation).map((message) => ({
      severity: 'warning' as const,
      message: `Шаблон создания персонажа: ${message}`,
    })))
  }
  // Флаги без пояснения «для чего нужен»: человек ещё вспомнит сам, а ИИ-агент
  // и чужой мастер — нет. Для ИИ-кампаний поле обязательное (требование чемодана).
  for (const f of store.meta.flags ?? []) {
    if (!f.description?.trim()) {
      structure.push({
        severity: 'warning',
        message: `Флаг «${f.label}»: не заполнено поле «Для чего нужен» — без него непонятно, какое событие запоминает флаг и где он читается.`,
      })
    }
  }
  // Правила-«призраки»: после санитарной загрузки массивы всегда на месте,
  // но ручная правка JSON могла их убрать — ловим до выхода в игру.
  for (const p of store.rulePaths()) {
    const r = store.rule(p)
    if (!Array.isArray(r.conditions) || !Array.isArray(r.effects)) {
      structure.push({
        severity: 'error',
        message: `Правило «${r.label ?? r.id}» (${p}): отсутствуют массивы conditions/effects — правило сломает движок при старте.`,
      })
    }
  }

  // фон там, где его быть не должно: эмблема меню, спрайты сцен, фигурки боя
  structure.push(...(await inspectAlphaRoles(store)))

  const mediaRefs = collectCampaignMedia(store)
  const localFindings = await inspectLocalMedia(store, mediaRefs.local)
  const media: AuditFinding[] = localFindings.filter((finding) => finding.severity !== 'info')
  if (mediaRefs.local.length && media.length === 0) {
    media.push({ severity: 'info', message: `Проверено локальных медиафайлов: ${mediaRefs.local.length}; все найдены.` })
  }
  for (const url of mediaRefs.external) {
    media.push({
      severity: 'warning',
      message: `Внешнее медиа требует сети и не включается автоматически в пакет: ${url}`,
    })
  }
  if (media.length === 0) media.push({ severity: 'info', message: 'Ссылок на медиафайлы не найдено.' })

  const playtest: AuditFinding[] = []
  if (!lastPlaytest) {
    playtest.push({ severity: 'info', message: 'После текущей версии кампании плейтест не запускался.' })
  } else if (lastPlaytest.contentHash !== campaignContentHash(store)) {
    playtest.push({ severity: 'warning', message: `Последний плейтест завершён ${new Date(lastPlaytest.finishedAt).toLocaleString()}; после него содержимое менялось — запустите плейтест повторно.` })
    if (lastPlaytest.notes?.trim()) playtest.push({ severity: 'info', message: `Записанный результат предыдущей версии: ${lastPlaytest.notes.trim()}` })
  } else {
    playtest.push({ severity: 'info', message: `Плейтест запускался ${new Date(lastPlaytest.startedAt).toLocaleString()} и завершён возвратом в редактор. Автоматическая оценка прохождения невозможна.` })
    if (lastPlaytest.notes?.trim()) playtest.push({ severity: 'info', message: `Результат мастера: ${lastPlaytest.notes.trim()}` })
    else playtest.push({ severity: 'warning', message: 'Результат прохождения не записан. Во время плейтеста нажмите «Записать результат».' })
  }
  playtest.push({ severity: 'info', message: 'Эта проверка не симулирует игровой маршрут. Для проверки взаимодействий используйте кнопку «Плейтест».' })

  return { checkedAt: Date.now(), structure, media, playtest }
}

export function formatCampaignAuditReport(report: CampaignAuditReport): string {
  const lines = [
    `Проверка Chronicle Forge — ${new Date(report.checkedAt).toLocaleString()}`,
    '',
    'СТРУКТУРА И ССЫЛКИ',
    ...(report.structure.length ? report.structure.map((finding) => `${finding.severity.toUpperCase()}: ${finding.message}`) : ['ПРОБЛЕМ НЕТ']),
    'МЕДИА И ФАЙЛЫ',
    ...(report.media.length ? report.media.map((finding) => `${finding.severity.toUpperCase()}: ${finding.message}`) : ['ПРОБЛЕМ НЕТ']),
    'ПЛЕЙТЕСТ',
    ...(report.playtest.length ? report.playtest.map((finding) => `${finding.severity.toUpperCase()}: ${finding.message}`) : ['ИНФОРМАЦИЯ НЕ ЗАПИСАНА']),
  ]
  return lines.join('\n')
}

export function auditCounts(report: CampaignAuditReport): { errors: number; warnings: number; info: number } {
  const findings = [...report.structure, ...report.media, ...report.playtest]
  return {
    errors: findings.filter((finding) => finding.severity === 'error').length,
    warnings: findings.filter((finding) => finding.severity === 'warning').length,
    info: findings.filter((finding) => finding.severity === 'info').length,
  }
}
