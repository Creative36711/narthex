/**
 * Политика намеренно отсутствующих изображений (D-076).
 *
 * Почему отдельный модуль: список отсутствующих медиа принадлежит кампании, а
 * не проверке. Если он живёт внутри harness, проверка знает ровно те пути,
 * которые проходит маршрут, и молча пропускает всё остальное. Здесь одна
 * функция-источник истины: её читают и строгий браузерный экзамен, и страж
 * `check:dev-campaigns`, и смоук `smoke:absence-policy`.
 *
 * Объявление — поле `known_absent_images` в маркере полигона
 * (`dev-fixture.json`, старое имя `smoke-fixture.json`). У проекта витрины
 * маркера нет, поэтому объявлений нет и любое отсутствие — находка.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export const MARKER_FILES = ['dev-fixture.json', 'smoke-fixture.json']

const IMAGE_EXTENSIONS = /\.(?:avif|gif|jpe?g|png|svg|webp)$/i

/** Путь внутри кампании без query, ведущего слэша и URL-кодирования. */
export function normalizeAssetPath(path) {
  const withoutQuery = String(path).split('?')[0].split('#')[0]
  const withoutPrefix = withoutQuery.replace(/^\/+/, '')
  try {
    return decodeURIComponent(withoutPrefix)
  } catch {
    return withoutPrefix
  }
}

/** Похоже ли на изображение (по расширению в пути). */
export function isImagePath(path) {
  return IMAGE_EXTENSIONS.test(normalizeAssetPath(path))
}

function readMarker(campaignDir) {
  for (const name of MARKER_FILES) {
    const file = join(campaignDir, name)
    if (!existsSync(file)) continue
    try {
      return { file, data: JSON.parse(readFileSync(file, 'utf8')) }
    } catch {
      return { file, data: null }
    }
  }
  return null
}

/**
 * Объявленные отсутствия кампании.
 * @param {string} campaignsRoot каталог с кампаниями
 * @param {string} campaignId id кампании (он же имя каталога)
 */
export function declaredAbsences(campaignsRoot, campaignId) {
  const marker = readMarker(join(campaignsRoot, campaignId))
  if (!marker || marker.data === null || marker.data.visibility !== 'internal') return []
  const list = marker.data.known_absent_images
  if (!Array.isArray(list)) return []
  return [...new Set(list.filter((entry) => typeof entry === 'string').map(normalizeAssetPath))].sort()
}

/** Маркер есть и объявляет кампанию внутренней. */
export function isInternalCampaign(campaignsRoot, campaignId) {
  const marker = readMarker(join(campaignsRoot, campaignId))
  return !!marker && marker.data !== null && marker.data.visibility === 'internal'
}

/**
 * Классификация наблюдаемого отказа изображения.
 *
 * - `declared` — путь объявлен отсутствующим: печатается как факт, не находка;
 * - `stale` — путь объявлен, но файл отдаётся как изображение: декларация
 *   устарела, это находка;
 * - `unexpected` — отсутствие не объявлено: находка.
 */
export function classifyImageFailure({ path, status, contentType, declared = [] }) {
  const normalized = normalizeAssetPath(path)
  const isDeclared = declared.includes(normalized)
  const servedAsImage = typeof contentType === 'string' && contentType.toLowerCase().startsWith('image/')
  if (isDeclared) return servedAsImage ? 'stale' : 'declared'
  return 'unexpected'
}

/** Провести по списку отказов и вернуть разделение на объявленные и находки. */
export function splitImageFailures(failures, declared) {
  const declaredHits = []
  const findings = []
  for (const failure of failures) {
    const verdict = classifyImageFailure({ ...failure, declared })
    if (verdict === 'declared') declaredHits.push({ ...failure, verdict })
    else findings.push({ ...failure, verdict })
  }
  return { declaredHits, findings }
}

export const ABSENCE_POLICY_VERSION = 1
