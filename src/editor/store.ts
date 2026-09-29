import { allLocations, migrateMeta, migrateNavigation } from '../shared/migrate'
import { isExternalUrl } from '../core/loader'
import { compareVersions } from '../shared/versions'
import type {
  ArenaDef,
  CampaignManifest,
  CampaignMeta,
  CodexEntryDef,
  CutsceneDef,
  Effect,
  EntityDef,
  QuestDef,
  RecipeDef,
  RuleDef,
  SceneDef,
  WorldDef,
} from '../shared/types'

/**
 * Хранилище редактора: raw-файлы Campaign Package в памяти.
 * Пути файлов — относительные внутри пакета ("scenes/scene_x.json", "dialogues/y.ink").
 * Сохранение: dev-эндпоинт vite (POST /__editor/save) пишет в public/campaigns/<id>/.
 */

export type ManifestDef = CampaignManifest

export type EditorSection =
  | 'campaign'
  | 'world'
  | 'scenes'
  | 'entities'
  | 'rules'
  | 'quests'
  | 'dialogues'
  | 'arenas'
  | 'cutscenes'
  | 'combat'
  | 'recipes'
  | 'codex'

export class EditorStore {
  basePath: string // "/campaigns/ash-of-caerden"
  // до load() — безопасные пустые значения: рендер между сменой кампании
  // и загрузкой не должен падать (фидбек №4–5 шестого раунда)
  meta: CampaignMeta = { id: '', title: '' } as CampaignMeta
  world: WorldDef = { regions: [] } as unknown as WorldDef
  manifest: ManifestDef = { scenes: [], entities: [], rules: [], arenas: [], quests: [], encounters: [], cutscenes: [], dialogues: [] }

  /** JSON-документы по путям пакета */
  jsonFiles = new Map<string, unknown>()
  /** текстовые документы (.ink) по путям пакета */
  textFiles = new Map<string, string>()

  dirty = new Set<string>()
  private listeners = new Set<() => void>()

  /** undo: снимки «до изменения» (path + сериализация), максимум 100 шагов */
  private undoStack: Array<{ path: string; text: string }> = []
  /** текущая сериализация файлов — чтобы снять снимок «до» в момент touch */
  private snapshots = new Map<string, string>()
  /** содержимое файлов на диске (на момент загрузки/сохранения) — для точного счётчика «несохранено» */
  private saved = new Map<string, string>()
  private lastTouch = { path: '', group: '', at: 0 }

  constructor(basePath: string) {
    this.basePath = basePath
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
    for (const f of this.manifest.encounters ?? []) loadJson(`rules/${f}`)
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
    // мягкие миграции старого контента (итерация 8): условия потребностей,
    // переходы «в локацию» из сцен
    this.migrateContent()
    // базовые снимки для undo + состояние диска
    for (const p of this.allPaths()) {
      this.snapshots.set(p, this.fileText(p))
      this.saved.set(p, this.fileText(p))
    }
  }

  // ─────────────── доступ с типами ───────────────

  scenePaths(): string[] {
    return this.manifest.scenes.map((f) => `scenes/${f}`)
  }
  entityPaths(): string[] {
    return this.manifest.entities.map((f) => `entities/${f}`)
  }
  rulePaths(): string[] {
    return this.manifest.rules.map((f) => `rules/${f}`)
  }
  arenaPaths(): string[] {
    return (this.manifest.arenas ?? []).map((f) => `arenas/${f}`)
  }
  questPaths(): string[] {
    return (this.manifest.quests ?? []).map((f) => `quests/${f}`)
  }
  dialoguePaths(): string[] {
    return this.manifest.dialogues.map((f) => `dialogues/${f}`)
  }
  cutscenePaths(): string[] {
    return (this.manifest.cutscenes ?? []).map((f) => `cutscenes/${f}`)
  }
  recipePaths(): string[] {
    return (this.manifest.recipes ?? []).map((f) => `recipes/${f}`)
  }
  codexPaths(): string[] {
    return (this.manifest.codex ?? []).map((f) => `codex/${f}`)
  }

  scene(path: string): SceneDef {
    return this.jsonFiles.get(path) as SceneDef
  }
  entity(path: string): EntityDef {
    const e = this.jsonFiles.get(path) as EntityDef
    // мягкая миграция: у старых NPC нет описания — подставляем пустое
    if (e && e.type === 'npc' && typeof (e as { description?: string }).description !== 'string') {
      ;(e as { description?: string }).description = ''
    }
    return e
  }
  rule(path: string): RuleDef {
    return this.jsonFiles.get(path) as RuleDef
  }
  arena(path: string): ArenaDef {
    return this.jsonFiles.get(path) as ArenaDef
  }
  quest(path: string): QuestDef {
    return this.jsonFiles.get(path) as QuestDef
  }
  cutscene(path: string): CutsceneDef {
    return this.jsonFiles.get(path) as CutsceneDef
  }
  recipe(path: string): RecipeDef {
    return this.jsonFiles.get(path) as RecipeDef
  }
  codexEntry(path: string): CodexEntryDef {
    return this.jsonFiles.get(path) as CodexEntryDef
  }

  /** списки id для подсказок в полях */
  /** все флаги, упомянутые в правилах/квестах/ink — для подсказок в конструкторах */
  knownFlags(): string[] {
    const flags = new Set<string>()
    const scan = (o: unknown): void => {
      if (Array.isArray(o)) { o.forEach(scan); return }
      if (o && typeof o === 'object') {
        const r = o as Record<string, unknown>
        if (typeof r.flag === 'string') flags.add(r.flag)
        for (const v of Object.values(r)) scan(v)
      }
    }
    for (const p of this.rulePaths()) scan(this.rule(p))
    for (const p of this.questPaths()) scan(this.quest(p))
    for (const [, text] of this.textFiles) {
      for (const m of text.matchAll(/(?:get_flag|set_flag)\("([^"]+)"\)/g)) flags.add(m[1])
    }
    return [...flags].sort()
  }

  /** пары id+label для выпадающих списков (в UI мастер видит названия, не id) */
  options(kind: 'entity' | 'scene' | 'location' | 'quest' | 'arena' | 'rule' | 'item' | 'npc' | 'dialogue' | 'faction' | 'skill' | 'need' | 'disposition' | 'itemCategory' | 'flag' | 'cutscene' | 'status' | 'ability' | 'weather' | 'codex' | 'recipe' | 'currency'): Array<{ id: string; label: string }> {
    const out: Array<{ id: string; label: string }> = []
    if (kind === 'currency') {
      for (const c of this.meta.currencies ?? []) out.push({ id: c.id, label: c.label })
    } else if (kind === 'entity' || kind === 'item' || kind === 'npc') {
      for (const p of this.entityPaths()) {
        const e = this.entity(p)
        if (!e) continue
        if (kind === 'entity' || e.type === kind) out.push({ id: e.id, label: e.label || e.id })
      }
    } else if (kind === 'scene') {
      for (const p of this.scenePaths()) {
        const sc = this.scene(p)
        if (sc) out.push({ id: sc.id, label: sc.label || sc.id })
      }
    } else if (kind === 'quest') {
      for (const p of this.questPaths()) {
        const q = this.quest(p)
        if (q) out.push({ id: q.id, label: q.label || q.id })
      }
    } else if (kind === 'arena') {
      for (const p of this.arenaPaths()) {
        const a = this.arena(p)
        if (a) out.push({ id: a.id, label: a.label || a.id })
      }
    } else if (kind === 'rule') {
      for (const p of this.rulePaths()) {
        const r = this.rule(p)
        if (r) out.push({ id: r.id, label: r.label || r.id })
      }
    } else if (kind === 'cutscene') {
      for (const p of this.cutscenePaths()) {
        const c = this.cutscene(p)
        if (c) out.push({ id: c.id, label: c.label || c.id })
      }
    } else if (kind === 'location') {
      const walk = (regions: typeof this.world.regions) => {
        for (const r of regions) {
          for (const l of r.locations) out.push({ id: l.id, label: l.label || l.id })
          if (r.sub_regions) walk(r.sub_regions)
        }
      }
      walk(this.world.regions)
    } else if (kind === 'dialogue') {
      for (const p of this.dialoguePaths()) {
        const doc = this.jsonFiles.get(p.replace(/\.ink$/, '.dlg.json')) as { label?: string } | undefined
        out.push({ id: p, label: doc?.label || p.replace('dialogues/', '').replace(/\.ink$/, '') })
      }
    } else if (kind === 'faction') {
      for (const f of this.meta.factions ?? []) out.push({ id: f.id, label: f.label || f.id })
    } else if (kind === 'skill') {
      for (const sk of this.meta.skills ?? []) out.push({ id: sk.id, label: sk.label || sk.id })
    } else if (kind === 'need') {
      for (const n of this.meta.needs) out.push({ id: n.id, label: n.label || n.id })
    } else if (kind === 'status') {
      for (const s of this.meta.statuses ?? []) out.push({ id: s.id, label: s.label || s.id })
    } else if (kind === 'ability') {
      for (const a of this.meta.abilities ?? []) out.push({ id: a.id, label: a.label || a.id })
    } else if (kind === 'weather') {
      out.push({ id: '', label: 'Ясно' })
      for (const w of this.meta.weathers ?? []) out.push({ id: w.id, label: w.label || w.id })
    } else if (kind === 'codex') {
      for (const p of this.codexPaths()) {
        const c = this.codexEntry(p)
        if (c) out.push({ id: c.id, label: c.label || c.id })
      }
    } else if (kind === 'recipe') {
      for (const p of this.recipePaths()) {
        const r = this.recipe(p)
        if (r) out.push({ id: r.id, label: r.label || r.id })
      }
    } else if (kind === 'disposition') {
      // отношение можно менять и к фракции, и к отдельному NPC
      for (const f of this.meta.factions ?? []) out.push({ id: f.id, label: `${f.label || f.id} (фракция)` })
      for (const o of this.options('npc')) out.push({ id: o.id, label: `${o.label} (NPC)` })
    } else if (kind === 'itemCategory') {
      for (const c of this.meta.item_categories ?? []) out.push({ id: c.id, label: c.label || c.id })
    } else if (kind === 'flag') {
      const seen = new Set<string>()
      for (const f of this.meta.flags ?? []) {
        out.push({ id: f.id, label: f.label || f.id })
        seen.add(f.id)
      }
      // флаги, встречающиеся в контенте, но не описанные в реестре
      for (const f of this.knownFlags()) if (!seen.has(f)) out.push({ id: f, label: f })
    }
    return out.sort((a, b) => a.label.localeCompare(b.label, 'ru'))
  }

  /** название стадии или журнальной записи квеста (для сводок правил) */
  questStageLabel(questId: string, key: string): string {
    for (const p of this.questPaths()) {
      const q = this.quest(p)
      if (q?.id !== questId) continue
      const st = q.stages.find((s) => s.id === key)
      return st?.label ?? key
    }
    return key
  }

  /** src для предпросмотра ассета: файл пакета или внешняя ссылка (итерация 8, блок C) */
  assetSrc(path: string | undefined | null): string {
    if (!path) return ''
    if (isExternalUrl(path)) return path
    return `${this.basePath}/${path}`
  }

  /** название по id (для сводок) */
  labelFor(kind: string, id: string): string {
    return this.options(kind as Parameters<EditorStore['options']>[0]).find((o) => o.id === id)?.label ?? id
  }

  /** сохранить бинарный файл (картинку) в кампанию; возвращает путь внутри кампании */
  async saveBinary(relPath: string, file: File): Promise<string> {
    const buf = await file.arrayBuffer()
    let bin = ''
    const bytes = new Uint8Array(buf)
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
    const b64 = btoa(bin)
    const res = await fetch(this.saveEndpoint(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: `${this.campaignRel()}/${relPath}`, base64: b64 }),
    })
    if (!res.ok) throw new Error(`${relPath}: ${res.status} ${await res.text()}`)
    return relPath
  }

  ids(kind: 'entity' | 'scene' | 'location' | 'quest' | 'arena' | 'rule' | 'item' | 'npc' | 'cutscene' | 'recipe' | 'codex'): string[] {
    const out: string[] = []
    if (kind === 'entity' || kind === 'item' || kind === 'npc') {
      for (const p of this.entityPaths()) {
        const e = this.entity(p)
        if (!e) continue
        if (kind === 'entity' || e.type === kind) out.push(e.id)
      }
    } else if (kind === 'scene') {
      for (const p of this.scenePaths()) out.push(this.scene(p)?.id ?? '')
    } else if (kind === 'quest') {
      for (const p of this.questPaths()) out.push(this.quest(p)?.id ?? '')
    } else if (kind === 'arena') {
      for (const p of this.arenaPaths()) out.push(this.arena(p)?.id ?? '')
    } else if (kind === 'rule') {
      for (const p of this.rulePaths()) out.push(this.rule(p)?.id ?? '')
    } else if (kind === 'cutscene') {
      for (const p of this.cutscenePaths()) out.push(this.cutscene(p)?.id ?? '')
    } else if (kind === 'recipe') {
      for (const p of this.recipePaths()) out.push(this.recipe(p)?.id ?? '')
    } else if (kind === 'codex') {
      for (const p of this.codexPaths()) out.push(this.codexEntry(p)?.id ?? '')
    } else if (kind === 'location') {
      const walk = (regions: typeof this.world.regions) => {
        for (const r of regions) {
          for (const l of r.locations) out.push(l.id)
          if (r.sub_regions) walk(r.sub_regions)
        }
      }
      walk(this.world.regions)
    }
    return out.filter(Boolean).sort()
  }

  // ─────────────── миграции и валидация ───────────────

  /**
   * Мягкие миграции контента (итерация 8). Старый формат остаётся читаемым:
   * одиночные location/item в условиях потребностей превращаются в списки,
   * переходы «в локацию» из сцен — в «открыть карту».
   */
  migrateContent(): string[] {
    const notes: string[] = []
    migrateMeta(this.meta)
    for (const p of this.scenePaths()) {
      const sc = this.scene(p)
      if (!sc) continue
      const before = JSON.stringify(sc.navigation)
      migrateNavigation(sc, this.world)
      if (JSON.stringify(sc.navigation) !== before) {
        notes.push(`Сцена «${sc.label}»: переход «в локацию» заменён на «открыть карту»`)
      }
    }
    return notes
  }

  /**
   * Проверка целостности кампании (итерация 8, А6/блок F).
   * Возвращает список проблем по-русски — импорт и загрузка не падают,
   * мастеру показывается отчёт.
   */
  validateContent(): string[] {
    const issues: string[] = []

    // версии и совместимость (docs/compatibility.md)
    const semver = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/
    if (!this.meta.version) issues.push('Кампания: не заполнена версия (нужна для обновлений и совместимости сохранений)')
    else if (!semver.test(this.meta.version)) issues.push(`Кампания: версия «${this.meta.version}» не похожа на semver (ожидается вид 1.4.2)`)
    const minEngine = this.meta.min_engine ?? this.meta.engine_version
    if (minEngine && !/^\d+(\.\d+){0,2}(?:-[0-9A-Za-z.-]+)?$/.test(minEngine)) {
      issues.push(`Кампания: минимальный движок «${minEngine}» не похож на номер версии`)
    }
    if (this.meta.save_base_version) {
      if (!semver.test(this.meta.save_base_version)) issues.push(`Кампания: граница сохранений «${this.meta.save_base_version}» не похожа на semver`)
      else if (compareVersions(this.meta.save_base_version, this.meta.version) > 0) {
        issues.push(`Кампания: граница сохранений ${this.meta.save_base_version} новее версии кампании ${this.meta.version} — так сохранения не откроются ни у кого`)
      }
    }

    const scenes: Record<string, SceneDef> = {}
    for (const p of this.scenePaths()) {
      const sc = this.scene(p)
      if (sc) scenes[sc.id] = sc
    }
    const locationIds = new Set(this.ids('location'))
    const sceneIds = new Set(Object.keys(scenes))
    const entityIds = new Set(this.ids('entity'))
    const questIds = new Set(this.ids('quest'))
    const arenaIds = new Set(this.ids('arena'))
    const ruleIds = new Set(this.ids('rule'))
    const cutsceneIds = new Set(this.ids('cutscene'))
    const recipeIds = new Set(this.ids('recipe'))
    const entitiesById = new Map<string, EntityDef>()
    for (const p of this.entityPaths()) {
      const e = this.entity(p)
      if (e) entitiesById.set(e.id, e)
    }
    const itemUsedAsNpc = new Set<string>()

    // катсцены: слайды
    for (const p of this.cutscenePaths()) {
      const c = this.cutscene(p)
      if (!c) continue
      if (!c.slides?.length) issues.push(`Катсцена «${c.label}»: нет ни одного слайда`)
    }

    // мировая карта
    for (const loc of allLocations(this.world)) {
      for (const sc of loc.scenes) {
        if (!sceneIds.has(sc)) issues.push(`Локация «${loc.label}»: сцены «${sc}» нет в кампании`)
      }
      if (loc.arrival_scene && !loc.scenes.includes(loc.arrival_scene)) {
        issues.push(`Локация «${loc.label}»: сцена по прибытии «${loc.arrival_scene}» не входит в список её сцен`)
      }
      if (loc.arena && !arenaIds.has(loc.arena)) {
        issues.push(`Локация «${loc.label}»: арена «${loc.arena}» не найдена`)
      }
      for (const tc of loc.travel_connections) {
        if (!locationIds.has(tc.to)) issues.push(`Локация «${loc.label}»: дорога ведёт в несуществующую локацию «${tc.to}»`)
      }
    }

    // сцены: локация, внутренние переходы, слоты
    for (const p of this.scenePaths()) {
      const sc = this.scene(p)
      if (!sc) continue
      if (sc.location && !locationIds.has(sc.location)) {
        issues.push(`Сцена «${sc.label}»: локация «${sc.location}» не найдена`)
      }
      for (const nav of sc.navigation) {
        if (!nav.go_to_scene) continue
        const target = scenes[nav.go_to_scene]
        if (!target) {
          issues.push(`Сцена «${sc.label}»: переход «${nav.label}» ведёт в несуществующую сцену «${nav.go_to_scene}»`)
        } else if (target.location !== sc.location) {
          issues.push(
            `Сцена «${sc.label}»: переход «${nav.label}» ведёт в сцену другой локации «${target.label}» ` +
              `(между локациями — только через карту)`,
          )
        }
      }
      for (const slot of sc.slots) {
        if (slot.default_entity && !entityIds.has(slot.default_entity)) {
          issues.push(`Сцена «${sc.label}»: в слоте стоит несуществующая сущность «${slot.default_entity}»`)
        } else if (slot.default_entity && !slot.default_entity.startsWith('item') && entitiesById.get(slot.default_entity)?.type === 'item') {
          itemUsedAsNpc.add(slot.default_entity)
        }
      }
      if (!sc.states.length) issues.push(`Сцена «${sc.label}»: нет ни одного состояния (фона)`)
      for (const st of sc.states) {
        if (!st.image && !st.art) issues.push(`Сцена «${sc.label}»: у состояния «${st.label}» нет ни изображения, ни векторного фона`)
      }
    }

    // сущности: диалоги, расписания
    for (const p of this.entityPaths()) {
      const e = this.entity(p)
      if (!e || e.type !== 'npc') continue
      if (e.dialogue && !this.textFiles.has(e.dialogue)) {
        issues.push(`Персонаж «${e.label}»: диалог «${e.dialogue}» не найден`)
      }
      for (const s of e.schedule ?? []) {
        if (!sceneIds.has(s.scene)) issues.push(`Персонаж «${e.label}»: расписание ссылается на несуществующую сцену «${s.scene}»`)
        else if (scenes[s.scene] && !scenes[s.scene].slots.some((sl) => sl.id === s.slot)) {
          issues.push(`Персонаж «${e.label}»: в сцене «${scenes[s.scene].label}» нет слота «${s.slot}»`)
        }
      }
      for (const ov of e.presence_overrides ?? []) {
        if (!sceneIds.has(ov.scene)) {
          issues.push(`Персонаж «${e.label}»: особое место ссылается на несуществующую сцену «${ov.scene}»`)
        }
      }
      for (const s of e.trader?.sells ?? []) {
        if (!entityIds.has(s.item)) issues.push(`Персонаж «${e.label}»: в прилавке нет предмета «${s.item}»`)
      }
    }

    // правила и квесты
    const collectEffects = (list: Effect[] | undefined): Effect[] => {
      const acc: Effect[] = []
      for (const ef of list ?? []) {
        acc.push(ef)
        if (ef.type === 'skill_check_gate' || ef.type === 'stat_check' || ef.type === 'opposed_check' || ef.type === 'group_stat_check') {
          acc.push(...collectEffects(ef.success_effects), ...collectEffects(ef.fail_effects))
        } else if (ef.type === 'start_combat') {
          acc.push(...collectEffects(ef.on_victory), ...collectEffects(ef.on_fled), ...collectEffects(ef.on_defeat))
        } else if (ef.type === 'start_pursuit') {
          acc.push(...collectEffects(ef.on_fail))
        }
      }
      return acc
    }
    const rulesById = new Map<string, RuleDef>()
    const fireEdges = new Map<string, string[]>()
    for (const p of this.rulePaths()) {
      const r = this.rule(p)
      if (!r) continue
      rulesById.set(r.id, r)
      for (const cond of r.conditions ?? []) {
        if (cond.type === 'player_enters_scene' && !sceneIds.has(cond.scene)) {
          issues.push(`Правило «${r.label}»: условие ссылается на несуществующую сцену «${cond.scene}»`)
        }
        if ((cond.type === 'entity_alive' || cond.type === 'entity_dead' || cond.type === 'in_party') && entitiesById.get(cond.entity)?.type === 'item') {
          itemUsedAsNpc.add(cond.entity)
        }
      }
      const allEf = collectEffects(r.effects)
      const targets: string[] = []
      for (const ef of allEf) {
        if (ef.type === 'start_quest' && !questIds.has(ef.quest)) {
          issues.push(`Правило «${r.label}»: квест «${ef.quest}» не найден`)
        }
        if (ef.type === 'play_cutscene' && !cutsceneIds.has(ef.cutscene)) {
          issues.push(`Правило «${r.label}»: катсцена «${ef.cutscene}» не найдена`)
        }
        if (ef.type === 'unlock_recipe' && !recipeIds.has(ef.recipe)) {
          issues.push(`Правило «${r.label}»: рецепт «${ef.recipe}» не найден`)
        }
        if (ef.type === 'set_entity_state' && !entityIds.has(ef.entity)) {
          issues.push(`Правило «${r.label}»: сущность «${ef.entity}» не найдена`)
        }
        if (ef.type === 'fire_rule') {
          if (!ruleIds.has(ef.rule)) {
            issues.push(`Правило «${r.label}»: правило «${ef.rule}» не найдено`)
          } else {
            targets.push(ef.rule)
          }
        }
        if ((ef.type === 'start_dialogue' || ef.type === 'join_party' || ef.type === 'leave_party') && entitiesById.get(ef.entity)?.type === 'item') {
          itemUsedAsNpc.add(ef.entity)
        }
        if (ef.type === 'start_combat') {
          for (const en of [...(ef.enemies ?? []), ...(ef.allies ?? [])]) {
            if (entitiesById.get(en.entity)?.type === 'item') itemUsedAsNpc.add(en.entity)
          }
        }
      }
      if (targets.length) fireEdges.set(r.id, [...new Set(targets)])
    }
    // проверка циклов и глубины цепочки fire_rule (Задача 10: запрет циклов и глубина ≤ 2)
    for (const [startId, r] of rulesById) {
      const walk = (curId: string, path: string[]) => {
        for (const nextId of fireEdges.get(curId) ?? []) {
          if (path.includes(nextId)) {
            if (nextId === startId) {
              issues.push(`Правило «${r.label}»: обнаружен цикл вызова fire_rule (${[...path, nextId].join(' → ')})`)
            }
            continue
          }
          const nextPath = [...path, nextId]
          // path содержит [startId, hop1, hop2, ...]: число переходов fire_rule = nextPath.length - 1
          if (nextPath.length - 1 > 2) {
            issues.push(`Правило «${r.label}»: глубина цепочки fire_rule превышает 2 (${nextPath.join(' → ')})`)
            continue
          }
          walk(nextId, nextPath)
        }
      }
      walk(startId, [startId])
    }
    for (const p of this.questPaths()) {
      const q = this.quest(p)
      if (!q) continue
      if (!q.stages.length) issues.push(`Квест «${q.label}»: нет ни одной стадии`)
      else {
        const ids = new Set(q.stages.map((s) => s.id))
        for (const st of q.stages) {
          for (const t of st.transitions ?? []) {
            if (!ids.has(t.to)) issues.push(`Квест «${q.label}»: переход стадии «${st.label ?? st.id}» в несуществующую стадию «${t.to}»`)
          }
        }
        // стартовая сцена/сущность игрока
        if (this.meta.starting_scene && !sceneIds.has(this.meta.starting_scene)) {
          issues.push(`Кампания: стартовая сцена «${this.meta.starting_scene}» не найдена`)
        }
      }
    }

    // старт кампании
    if (!locationIds.has(this.meta.starting_location)) {
      issues.push(`Кампания: стартовая локация «${this.meta.starting_location}» не найдена`)
    }
    if (!entityIds.has(this.meta.default_player)) {
      issues.push(`Кампания: персонаж игрока «${this.meta.default_player}» не найден`)
    }
    for (const need of this.meta.needs ?? []) {
      if (need.on_zero_effect && need.on_zero_effect !== 'death' && !ruleIds.has(need.on_zero_effect)) {
        issues.push(`Потребность «${need.label}»: правило «${need.on_zero_effect}» не найдено`)
      }
    }

    // диалоги конструктора: структурный переход stay
    for (const f of this.manifest.dialogues ?? []) {
      const key = f.replace(/\.ink$/, '')
      const doc = this.jsonFiles.get(`dialogues/${key}.dlg.json`) as { nodes?: Array<{ id: string; goto?: string; sections?: Array<{ goto?: string; else_goto?: string }> }> } | undefined
      if (!doc || !Array.isArray(doc.nodes)) continue
      const nodeIds = new Set(doc.nodes.map((n) => n.id))
      for (const n of doc.nodes) {
        for (const s of n.sections ?? []) {
          for (const g of [s.goto, s.else_goto]) {
            if (g && g !== 'end' && !nodeIds.has(g)) {
              const stayHint = g === 'stay' ? ' («stay» допустим только в вариантах ответа)' : ''
              issues.push(`Диалог «${key}»: переход «${g}» ведёт в несуществующий узел диалога — заменён на «конец»${stayHint}`)
            }
          }
        }
        if (n.goto && n.goto !== 'end' && !nodeIds.has(n.goto)) {
          const stayHint = n.goto === 'stay' ? ' («stay» допустим только в вариантах ответа)' : ''
          issues.push(`Диалог «${key}»: переход «${n.goto}» ведёт в несуществующий узел диалога — заменён на «конец»${stayHint}`)
        }
      }
    }

    if (itemUsedAsNpc.size > 0) {
      const list = [...itemUsedAsNpc]
      const hint = 'Как правильно: см. рецепт «интерактивный проп» в гайде'
      if (list.length === 1) {
        issues.push(`Сущность «${list[0]}» используется как персонаж, но описана как предмет — оставлено как есть. ${hint}`)
      } else {
        const shown = list.length > 5 ? `${list.slice(0, 5).join(', ')}, …` : list.join(', ')
        issues.push(`Сущности ${shown} (${list.length} шт.) используются как персонажи, но описаны как предметы — оставлено как есть. ${hint}`)
      }
    }
    return issues
  }

  // ─────────────── правки ───────────────

  touch(path: string, group = ''): void {
    const now = Date.now()
    const prev = this.snapshots.get(path)
    // группируем только СЕРИИ ОДНОТИПНЫХ правок, явно помеченных группой
    // (например набор текста); структурные изменения (добавил слот, удалил
    // правило…) всегда дают отдельный шаг отката — без группировки
    const sameBurst = group !== '' && this.lastTouch.path === path && this.lastTouch.group === group && now - this.lastTouch.at < 900
    if (prev !== undefined && !sameBurst) {
      this.undoStack.push({ path, text: prev })
      if (this.undoStack.length > 100) this.undoStack.shift()
    }
    this.lastTouch = { path, group, at: now }
    this.snapshots.set(path, this.fileText(path))
    if (this.saved.get(path) === this.fileText(path)) this.dirty.delete(path)
    else this.dirty.add(path)
    this.notify()
  }

  canUndo(): boolean {
    return this.undoStack.length > 0
  }

  /** откат последнего изменения */
  undo(): string | null {
    const step = this.undoStack.pop()
    if (!step) return null
    const { path, text } = step
    if (path === 'campaign.json') this.meta = JSON.parse(text)
    else if (path === 'world.json') this.world = JSON.parse(text)
    else if (path === 'manifest.json') this.manifest = JSON.parse(text)
    else if (this.textFiles.has(path)) this.textFiles.set(path, text)
    else this.jsonFiles.set(path, JSON.parse(text))
    this.snapshots.set(path, text)
    // если откат вернул файл к состоянию на диске — он больше не «несохранён»
    if (this.saved.get(path) === text) this.dirty.delete(path)
    else this.dirty.add(path)
    this.lastTouch = { path: '', group: '', at: 0 }
    this.notify()
    return path
  }

  setJson(path: string, data: unknown): void {
    this.jsonFiles.set(path, data)
    this.touch(path)
  }

  setText(path: string, text: string): void {
    this.textFiles.set(path, text)
    this.touch(path)
  }

  setMeta(meta: CampaignMeta): void {
    this.meta = meta
    this.touch('campaign.json')
  }

  setWorld(world: WorldDef): void {
    this.world = world
    this.touch('world.json')
  }

  /** создать новый файл и внести в манифест */
  createFile(section: keyof ManifestDef, filename: string, data: unknown | string): string {
    const dir = section === 'encounters' ? 'rules' : section
    const path = `${dir}/${filename}`
    const list = (this.manifest[section] ?? (this.manifest[section] = [] as string[])) as string[]
    if (!list.includes(filename)) list.push(filename)
    if (typeof data === 'string') this.textFiles.set(path, data)
    else this.jsonFiles.set(path, data)
    this.dirty.add(path)
    this.dirty.add('manifest.json')
    this.notify()
    return path
  }

  deleteFile(section: keyof ManifestDef, filename: string): void {
    const dir = section === 'encounters' ? 'rules' : section
    const path = `${dir}/${filename}`
    const list = (this.manifest[section] ?? []) as string[]
    const i = list.indexOf(filename)
    if (i >= 0) list.splice(i, 1)
    this.jsonFiles.delete(path)
    this.textFiles.delete(path)
    this.dirty.delete(path)
    this.dirty.add('manifest.json')
    this.notify()
  }

  // ─────────────── сохранение ───────────────

  fileText(path: string): string {
    if (path === 'campaign.json') return JSON.stringify(this.meta, null, 2)
    if (path === 'world.json') return JSON.stringify(this.world, null, 2)
    if (path === 'manifest.json') return JSON.stringify(this.manifest, null, 2)
    if (this.textFiles.has(path)) return this.textFiles.get(path)!
    return JSON.stringify(this.jsonFiles.get(path), null, 2)
  }

  allPaths(): string[] {
    return [
      'campaign.json',
      'world.json',
      'manifest.json',
      ...this.jsonFiles.keys(),
      ...this.textFiles.keys(),
    ]
  }

  /** "campaigns/<id>" — относительный путь пакета внутри public/ */
  campaignRel(): string {
    const path = this.basePath.startsWith('http') ? new URL(this.basePath).pathname : this.basePath
    return path.replace(/^\//, '')
  }

  /** URL dev-эндпоинта сохранения (работает и в браузере, и в node-тестах) */
  saveEndpoint(): string {
    return this.basePath.startsWith('http')
      ? new URL('/__editor/save', this.basePath).toString()
      : '/__editor/save'
  }

  /** сохранить на диск через dev-эндпоинт vite */
  async saveToDisk(paths?: string[]): Promise<void> {
    const targets = paths ?? [...this.dirty]
    const campaignRel = this.campaignRel()
    for (const p of targets) {
      const res = await fetch(this.saveEndpoint(), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: `${campaignRel}/${p}`, text: this.fileText(p) }),
      })
      if (!res.ok) throw new Error(`Сохранение ${p}: ${res.status} ${await res.text()}`)
      this.saved.set(p, this.fileText(p))
      this.dirty.delete(p)
    }
    this.notify()
  }
}
