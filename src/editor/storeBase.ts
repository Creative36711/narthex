import { projectCapabilityMode, type CapabilityMode, type CapabilityModesResolution } from '../core/pack/capability-modes'
import { ENGINE_VERSION } from '../shared/versions'
import { parseRuleFile } from '../shared/ruleFiles'
import type { ProjectPackInput, ProjectPackResolution } from '../core/pack/registry'
import type { CampaignMeta, WorldDef } from '../shared/types'
import type { ManifestDef } from './storeTypes'

type ProjectPackResolver = (project: ProjectPackInput) => ProjectPackResolution
type ProjectCapabilityResolver = (project: ProjectPackInput) => CapabilityModesResolution

/** Internal base: shared state and initial load/capability operations. */
export abstract class EditorStoreBase {
  protected abstract setJson(path: string, data: unknown): void
  protected abstract migrateContent(): void
  protected abstract allPaths(): string[]
  protected abstract fileText(path: string): string
  protected abstract restoreBaseline(): boolean
  protected abstract captureBaseline(): void

  basePath: string // "/campaigns/ash-of-caerden"
  project: ProjectPackInput = { kind: 'narrative' }

  packResolution: ProjectPackResolution | null = null

  capabilityModes: CapabilityModesResolution | null = null

  protected readonly resolveModes?: ProjectCapabilityResolver

  protected projectOriginal: ProjectPackInput | null = null

  protected projectOriginalText: string | null = null

  protected projectFileExists = false

  protected readonly resolvePack?: ProjectPackResolver

  // до load() — безопасные пустые значения: рендер между сменой кампании
  // и загрузкой не должен падать (фидбек №4–5 шестого раунда)
  meta: CampaignMeta = { id: '', title: '' } as CampaignMeta

  world: WorldDef = { regions: [] } as unknown as WorldDef

  manifest: ManifestDef = { scenes: [], entities: [], rules: [], arenas: [], quests: [], encounters: [], cutscenes: [], dialogues: [] }


  /** JSON-документы по путям пакета */
  jsonFiles = new Map<string, unknown>()

  /** текстовые документы (.ink) по путям пакета */
  textFiles = new Map<string, string>()

  /** предупреждения загрузки (битые/перепутанные файлы пакета): показывает баннер */
  loadWarnings: string[] = []


  dirty = new Set<string>()

  protected listeners = new Set<() => void>()


  /** undo: снимки «до изменения» (path + сериализация), максимум 100 шагов */
  protected undoStack: Array<{ path: string; text: string }> = []

  /** текущая сериализация файлов — чтобы снять снимок «до» в момент touch */
  protected snapshots = new Map<string, string>()

  /** содержимое файлов на диске (на момент загрузки/сохранения) — для точного счётчика «несохранено» */
  protected saved = new Map<string, string>()

  /** исходные снимки файлов на момент загрузки/импорта кампании для фиксации изменений мастера */
  protected baseline = new Map<string, string>()

  protected lastTouch = { path: '', group: '', at: 0 }


  /** версия формата сохранённого снимка базы правок мастера (при смене формата старые ключи игнорируются) */
  protected static readonly AI_BASELINE_VERSION = 1

  /** верхний лимит сохраняемого снимка в символах JSON — страховка от квоты localStorage (~5 МБ в браузерах) */
  protected static readonly AI_BASELINE_LIMIT = 4 * 1024 * 1024


  constructor(basePath: string, resolvePack?: ProjectPackResolver, resolveModes?: ProjectCapabilityResolver) {
    this.basePath = basePath
    this.resolvePack = resolvePack
    this.resolveModes = resolveModes
  }


  setCapabilityMode(capabilityId: string, mode: CapabilityMode, availableCaps: readonly string[], requiredCaps: readonly string[] = []): void {
    if (!availableCaps.includes(capabilityId)) throw new Error(`Возможность «${capabilityId}» не принадлежит установленному паку.`)
    if (mode === 'off' && requiredCaps.includes(capabilityId)) {
      throw new Error(`Обязательную возможность «${capabilityId}» нельзя выключить.`)
    }
    const project: ProjectPackInput = this.projectFileExists
      ? { ...this.project }
      : {
          format: 2,
          id: this.meta.id || 'new-project',
          title: this.meta.title || 'Новый проект',
          kind: typeof this.project.kind === 'string' ? this.project.kind : 'narrative',
          caps: [...availableCaps],
          engine: { min: ENGINE_VERSION },
          entry: 'world.json',
        }
    const caps = Array.isArray(project.caps)
      ? project.caps.filter((value): value is string => typeof value === 'string')
      : [...availableCaps]
    const originallyDeclared = Array.isArray(this.projectOriginal?.caps) && this.projectOriginal.caps.includes(capabilityId)
    if (!caps.includes(capabilityId)) caps.push(capabilityId)
    const currentOptions = project.cap_options && typeof project.cap_options === 'object' && !Array.isArray(project.cap_options)
      ? { ...(project.cap_options as Record<string, unknown>) }
      : {}
    const originalOptions = this.projectOriginal?.cap_options && typeof this.projectOriginal.cap_options === 'object' && !Array.isArray(this.projectOriginal.cap_options)
      ? this.projectOriginal.cap_options as Record<string, unknown>
      : {}
    const originalOption = originalOptions[capabilityId]
    const originalMode = this.projectOriginal
      ? projectCapabilityMode(this.projectOriginal, capabilityId)
      : 'core'

    if (mode === originalMode && this.projectOriginal) {
      if (originalOption === undefined) delete currentOptions[capabilityId]
      else currentOptions[capabilityId] = originalOption
      if (!originallyDeclared) {
        const index = caps.indexOf(capabilityId)
        if (index >= 0) caps.splice(index, 1)
      }
    } else if (mode === 'core') {
      const currentOption = currentOptions[capabilityId]
      const version = currentOption && typeof currentOption === 'object' && !Array.isArray(currentOption)
        ? (currentOption as Record<string, unknown>).version
        : undefined
      if (version === undefined) delete currentOptions[capabilityId]
      else currentOptions[capabilityId] = { version }
    } else {
      const currentOption = currentOptions[capabilityId]
      const version = currentOption && typeof currentOption === 'object' && !Array.isArray(currentOption)
        ? (currentOption as Record<string, unknown>).version
        : undefined
      currentOptions[capabilityId] = { mode, version: Number.isInteger(version) && Number(version) > 0 ? version : 1 }
    }

    const next: ProjectPackInput = { ...project, caps }
    if (Object.keys(currentOptions).length) next.cap_options = currentOptions
    else delete next.cap_options
    const capabilityModes = this.resolveModes?.(next) ?? null
    if (capabilityModes?.status === 'invalid') throw new Error(capabilityModes.message)
    // запись манифеста проекта идёт штатным внутренним API setJson: он сам ведёт
    // проект, режимы, снимок для undo и помечает файл изменённым.
    this.setJson('project.json', next)
  }


  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }


  notify(): void {
    for (const fn of this.listeners) fn()
  }


  async load(): Promise<void> {
    const get = async (rel: string) => {
      const res = await fetch(`${this.basePath}/${rel}?t=${Date.now()}`)
      if (!res.ok) throw new Error(`Не удалось загрузить ${rel}: ${res.status}`)
      return res
    }
    // json с понятной ошибкой: при отсутствии файла dev-сервер отдаёт html —
    // сообщаем «файл отсутствует/повреждён», а не «unexpected token <»
    const getJson = async <T>(rel: string): Promise<T> => {
      const text = await (await get(rel)).text()
      try {
        return JSON.parse(text) as T
      } catch {
        throw new Error(`Файл ${rel} отсутствует или повреждён (кампания записана не полностью?)`)
      }
    }
    this.project = { kind: 'narrative' }
    this.projectOriginal = null
    this.projectOriginalText = null
    this.projectFileExists = false
    const projectResponse = await fetch(`${this.basePath}/project.json?t=${Date.now()}`)
    if (projectResponse.ok) {
      const projectText = await projectResponse.text()
      try {
        this.project = JSON.parse(projectText) as ProjectPackInput
        this.projectFileExists = true
        this.projectOriginalText = projectText
        this.projectOriginal = JSON.parse(projectText) as ProjectPackInput
      } catch {
        const contentType = projectResponse.headers.get('content-type') ?? ''
        if (contentType.includes('text/html') || /^\s*<!doctype html/i.test(projectText)) {
          this.project = { kind: 'narrative' }
        } else {
          throw new Error('Файл project.json повреждён.')
        }
      }
    } else if (projectResponse.status === 404) {
      // Format 1 predates project.json; its documented kind is narrative.
      this.project = { kind: 'narrative' }
    } else {
      throw new Error(`Не удалось загрузить project.json: ${projectResponse.status}`)
    }
    this.packResolution = this.resolvePack?.(this.project) ?? null
    if (this.packResolution?.status === 'missing') return
    this.capabilityModes = this.resolveModes?.(this.project) ?? null
    if (this.capabilityModes?.status === 'invalid') throw new Error(this.capabilityModes.message)

    this.meta = await getJson<CampaignMeta>('campaign.json')
    this.world = await getJson<WorldDef>('world.json')
    this.manifest = await getJson<ManifestDef>('manifest.json')

    const jobs: Promise<void>[] = []
    const loadJson = (rel: string) =>
      jobs.push(get(rel).then(async (r) => void this.jsonFiles.set(rel, await r.json())))
    const loadText = (rel: string) =>
      jobs.push(get(rel).then(async (r) => void this.textFiles.set(rel, await r.text())))

    for (const f of this.manifest.scenes) loadJson(`scenes/${f}`)
    for (const f of this.manifest.entities) loadJson(`entities/${f}`)
    for (const f of this.manifest.rules) loadJson(`rules/${f}`)
    for (const f of this.manifest.arenas ?? []) loadJson(`arenas/${f}`)
    for (const f of this.manifest.quests ?? []) loadJson(`quests/${f}`)
    for (const f of this.manifest.encounters ?? []) {
      jobs.push(
        (async () => {
          let r = await fetch(`${this.basePath}/encounters/${f}?t=${Date.now()}`)
          let path = `encounters/${f}`
          if (!r.ok) {
            r = await fetch(`${this.basePath}/rules/${f}?t=${Date.now()}`)
            path = `rules/${f}`
          }
          if (r.ok) {
            try {
              this.jsonFiles.set(path, await r.json())
            } catch {
              // malformed json
            }
          }
        })(),
      )
    }
    for (const f of this.manifest.cutscenes ?? []) loadJson(`cutscenes/${f}`)
    for (const f of this.manifest.recipes ?? []) loadJson(`recipes/${f}`)
    for (const f of this.manifest.codex ?? []) loadJson(`codex/${f}`)
    for (const f of this.manifest.dialogues) loadText(`dialogues/${f}`)
    // визуальные исходники конструктора диалогов (могут отсутствовать)
    for (const f of this.manifest.dialogues) {
      const rel = `dialogues/${f.replace(/\.ink$/, '.dlg.json')}`
      jobs.push(
        fetch(`${this.basePath}/${rel}?t=${Date.now()}`)
          .then(async (r) => {
            if (r.ok && (r.headers.get('content-type') ?? '').includes('json')) {
              this.jsonFiles.set(rel, await r.json())
            }
          })
          .catch(() => undefined),
      )
    }
    await Promise.all(jobs)
    // санитарная обработка manifest.rules: ИИ-агенты порой кладут туда таблицы
    // встреч или правила без id/conditions — редактор не должен падать на них
    this.sanitizeRules()
    // мягкие миграции старого контента (итерация 8): условия потребностей,
    // переходы «в локацию» из сцен
    this.migrateContent()
    // базовые снимки для undo + состояние диска
    for (const p of this.allPaths()) {
      this.snapshots.set(p, this.fileText(p))
      this.saved.set(p, this.fileText(p))
    }
    // база для диффа правок мастера: сначала пробуем восстановить снимок из
    // прошлых сессий (отслеживание переживает закрытие редактора и всей игры),
    // а если его нет — фиксируем текущее состояние как точку отсчёта
    if (!this.restoreBaseline()) this.captureBaseline()
  }


  /**
   * Разбор файлов из manifest.rules: таблицы встреч уходят в manifest.encounters,
   * файлы без id отбрасываются, у правил восстанавливаются массивы conditions/
   * effects. Всё предупреждениями в loadWarnings — их показывает баннер редактора.
   */
  protected sanitizeRules(): void {
    this.loadWarnings = []
    const kept: string[] = []
    const seenIds = new Set<string>()
    for (const f of this.manifest.rules) {
      const rel = `rules/${f}`
      const verdict = parseRuleFile(f, this.jsonFiles.get(rel))
      if (verdict.warnings.length) this.loadWarnings.push(...verdict.warnings)
      if (verdict.kind === 'rule') {
        if (seenIds.has(verdict.rule.id)) {
          this.loadWarnings.push(`rules/${f}: дубль id «${verdict.rule.id}» — файл исключён из manifest.rules.`)
          continue
        }
        seenIds.add(verdict.rule.id)
        this.jsonFiles.set(rel, verdict.rule)
        kept.push(f)
      } else if (verdict.kind === 'encounters') {
        this.jsonFiles.set(rel, { encounter_tables: verdict.tables })
        if (!this.manifest.encounters) this.manifest.encounters = []
        if (!this.manifest.encounters.includes(f)) this.manifest.encounters.push(f)
      }
    }
    const dropped = this.manifest.rules.length - kept.length
    if (dropped > 0) this.manifest.rules = kept
  }
}
