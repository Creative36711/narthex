/**
 * Контракт версий Chronicle Forge.
 *
 * В проекте четыре независимых номера, и их важно не путать (подробно —
 * `docs/compatibility.md`):
 *
 * | Номер                  | Где живёт                     | Кто отвечает |
 * |------------------------|-------------------------------|--------------|
 * | `PACKAGE_FORMAT`       | движок                        | движок       |
 * | `ENGINE_VERSION`       | `package.json` → define vite  | движок       |
 * | `SAVE_VERSION`         | `shared/types.ts`             | движок       |
 * | `meta.version` +       | `campaign.json`               | мастер       |
 * | `meta.save_base_version`                               |
 *
 * Первые три игнорируются мастером полностью: совместимость формата и
 * перенос сохранений — задача движка. Мастер отвечает только за версию
 * кампании и за то, с какой её версии сохранения ещё поддерживаются
 * (`save_base_version`); это число редактор предлагает сам, сравнивая пакеты.
 */

/**
 * Версия формата Campaign Package (структура `campaign.json`/`world.json`/
 * `manifest.json`). Растёт только когда меняется сама форма данных пакета.
 * `campaign.json` может объявить меньший номер (`meta.package_format`) —
 * движок приводит старый пакет к текущему виду в `shared/migrate.ts`.
 */
export const PACKAGE_FORMAT = 1

/**
 * Самый старый формат пакета, который движок умеет читать. Пакеты с меньшим
 * номером отклоняются с внятным сообщением, а не «неожиданным поведением».
 */
export const OLDEST_PACKAGE_FORMAT = 1

/**
 * Версия движка. В сборке подставляется из `package.json` (define в
 * `vite.config.ts`); в headless-прогонах (`tsx scripts/*.mts`) define не
 * применяется, поэтому есть запасное чтение `process.env.npm_package_version`.
 */
declare const __CF_ENGINE_VERSION__: string | undefined

function readEngineVersion(): string {
  if (typeof __CF_ENGINE_VERSION__ === 'string' && __CF_ENGINE_VERSION__) return __CF_ENGINE_VERSION__
  const fromEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.npm_package_version
  return fromEnv || '0.0.0-dev'
}

export const ENGINE_VERSION: string = readEngineVersion()

/** Человекочитаемая сводка «что за движок» — для меню, отчётов и багрепортов. */
export function engineStamp(): string {
  return `Chronicle Forge ${ENGINE_VERSION} (формат пакета v${PACKAGE_FORMAT})`
}

// ────────────────────────── сравнение версий ──────────────────────────

export interface SemVer {
  major: number
  minor: number
  patch: number
  /** хвост после «-»: «1.2.0-beta.1» → «beta.1» */
  pre?: string
}

/**
 * Разбор «1», «1.2», «1.2.3», «1.2.3-beta.1». Всё, что не похоже на версию
 * («latest», пустая строка, мусор), считается версией 0.0.0 — сравнение
 * остаётся определённым, а не падает.
 */
export function parseVersion(text: string | undefined | null): SemVer {
  const m = /^v?\s*(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?/.exec(String(text ?? '').trim())
  if (!m) return { major: 0, minor: 0, patch: 0 }
  return {
    major: Number(m[1]),
    minor: m[2] === undefined ? 0 : Number(m[2]),
    patch: m[3] === undefined ? 0 : Number(m[3]),
    pre: m[4],
  }
}

/** -1 / 0 / 1. Предрелиз («-beta») младше релиза с теми же числами. */
export function compareVersions(a: string | undefined, b: string | undefined): number {
  const x = parseVersion(a)
  const y = parseVersion(b)
  if (x.major !== y.major) return x.major < y.major ? -1 : 1
  if (x.minor !== y.minor) return x.minor < y.minor ? -1 : 1
  if (x.patch !== y.patch) return x.patch < y.patch ? -1 : 1
  if (x.pre === y.pre) return 0
  if (x.pre === undefined) return 1
  if (y.pre === undefined) return -1
  return x.pre < y.pre ? -1 : x.pre > y.pre ? 1 : 0
}

export function versionGreaterOrEqual(a: string | undefined, b: string | undefined): boolean {
  return compareVersions(a, b) >= 0
}

/** Следующая версия по правилу semver: «1.4.2» → major «2.0.0», minor «1.5.0», patch «1.4.3». */
export function bumpVersion(version: string | undefined, kind: 'major' | 'minor' | 'patch'): string {
  const v = parseVersion(version)
  if (kind === 'major') return `${v.major + 1}.0.0`
  if (kind === 'minor') return `${v.major}.${v.minor + 1}.0`
  return `${v.major}.${v.minor}.${v.patch + 1}`
}

/** «1.2.3-beta.1» → «1.2.3» (для отображения и для совместимости сейвов). */
export function stableVersion(version: string | undefined): string {
  const v = parseVersion(version)
  return `${v.major}.${v.minor}.${v.patch}`
}

/**
 * Подходит ли движок пакету. Пакет объявляет минимальную версию движка
 * (`min_engine`, унаследована от поля `engine_version`); максимум движок
 * не ограничивает — вместо этого формат пакета остаётся обратно совместимым.
 */
export interface EngineCheck {
  ok: boolean
  /** что объявил пакет */
  required: string
  /** что реально запущено */
  actual: string
  message: string
}

export function checkEngine(required: string | undefined): EngineCheck {
  const req = String(required ?? '').trim()
  const actual = ENGINE_VERSION
  // пакет ничего не объявил — считаем, что требований нет (старые пакеты)
  if (!req || req === '0' || req === '0.0.0') return { ok: true, required: req || '—', actual, message: '' }
  if (versionGreaterOrEqual(actual, req)) return { ok: true, required: req, actual, message: '' }
  return {
    ok: false,
    required: req,
    actual,
    message: `Кампания рассчитана на движок ${req} и новее, а запущен ${actual}. Обновите Chronicle Forge — иначе правила и механики кампании могут работать неверно.`,
  }
}

// ─────────────────────── формат пакета ───────────────────────

export interface PackageCheck {
  ok: boolean
  /** что объявил пакет (0 — не объявил, считаем v1) */
  declared: number
  /** что понимает этот движок */
  supported: number
  message: string
}

/**
 * Подходит ли формат пакета этому движку. Пакет новее — честный отказ с
 * объяснением (иначе игрок получил бы «странные глюки» вместо причины);
 * пакет старее — нормально, его приводит к текущему виду `shared/migrate.ts`.
 */
export function checkPackage(declared: number | undefined, oldest = OLDEST_PACKAGE_FORMAT): PackageCheck {
  const format = typeof declared === 'number' && declared > 0 ? declared : OLDEST_PACKAGE_FORMAT
  if (format > PACKAGE_FORMAT) {
    return {
      ok: false,
      declared: format,
      supported: PACKAGE_FORMAT,
      message: `Кампания собрана в формате пакета v${format}, а этот движок понимает только до v${PACKAGE_FORMAT}. Обновите Chronicle Forge, чтобы открыть кампанию.`,
    }
  }
  if (format < oldest) {
    return {
      ok: false,
      declared: format,
      supported: PACKAGE_FORMAT,
      message: `Кампания собрана в устаревшем формате пакета v${format} (поддерживается с v${oldest}). Попросите автора выпустить кампанию заново.`,
    }
  }
  return { ok: true, declared: format, supported: PACKAGE_FORMAT, message: '' }
}
