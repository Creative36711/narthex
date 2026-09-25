import { allLocations, migrateMeta, migrateNavigation } from '../shared/migrate'
import type {
  ArenaDef,
  CampaignMeta,
  EntityDef,
  QuestDef,
  RuleDef,
  SceneDef,
  WorldDef,
} from '../shared/types'

/**
 * Хранилище редактора: raw-файлы Campaign Package в памяти.
 * Пути файлов — относительные внутри пакета ("scenes/scene_x.json", "dialogues/y.ink").
 * Сохранение: dev-эндпоинт vite (POST /__editor/save) пишет в public/campaigns/<id>/.
 */

export interface ManifestDef {
  scenes: string[]
  entities: string[]
  rules: string[]
  arenas?: string[]
  quests?: string[]
  encounters?: string[]
  dialogues: string[]
}

export type EditorSection =
  | 'campaign'
  | 'world'
  | 'scenes'
  | 'entities'
  | 'rules'
  | 'quests'
  | 'dialogues'
  | 'arenas'

export class EditorStore {
  basePath: string // "/campaigns/ash-of-caerden"
  // до load() — безопасные пустые значения: рендер между сменой кампании
  // и загрузкой не должен падать (фидбек №4–5 шестого раунда)
  meta: CampaignMeta = { id: '', title: '' } as CampaignMeta
  world: WorldDef = { regions: [] } as unknown as WorldDef
  manifest: ManifestDef = { scenes: [], entities: [], rules: [], arenas: [], quests: [], encounters: [], dialogues: [] }

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
  private lastTouch = { path: '', at: 0 }

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

  scene(path: string): SceneDef {
    return this.jsonFiles.get(path) as SceneDef
  }
  entity(path: string): EntityDef {
    return this.jsonFiles.get(path) as EntityDef
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
  options(kind: 'entity' | 'scene' | 'location' | 'quest' | 'arena' | 'rule' | 'item' | 'npc' | 'dialogue' | 'faction' | 'skill' | 'need' | 'disposition' | 'itemCategory' | 'flag'): Array<{ id: string; label: string }> {
    const out: Array<{ id: string; label: string }> = []
    if (kind === 'entity' || kind === 'item' || kind === 'npc') {
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

  ids(kind: 'entity' | 'scene' | 'location' | 'quest' | 'arena' | 'rule' | 'item' | 'npc'): string[] {
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
        }
      }
      if (!sc.states.length) issues.push(`Сцена «${sc.label}»: нет ни одного состояния (фона)`)
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
    for (const p of this.rulePaths()) {
      const r = this.rule(p)
      if (!r) continue
      for (const cond of r.conditions ?? []) {
        if (cond.type === 'player_enters_scene' && !sceneIds.has(cond.scene)) {
          issues.push(`Правило «${r.label}»: условие ссылается на несуществующую сцену «${cond.scene}»`)
        }
      }
      for (const ef of r.effects ?? []) {
        if (ef.type === 'start_quest' && !questIds.has(ef.quest)) {
          issues.push(`Правило «${r.label}»: квест «${ef.quest}» не найден`)
        }
      }
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
    return issues
  }

  // ─────────────── правки ───────────────

  touch(path: string): void {
    const now = Date.now()
    const prev = this.snapshots.get(path)
    // группируем серию быстрых правок одного файла (набор текста) в один шаг undo
    const sameBurst = this.lastTouch.path === path && now - this.lastTouch.at < 900
    if (prev !== undefined && !sameBurst) {
      this.undoStack.push({ path, text: prev })
      if (this.undoStack.length > 100) this.undoStack.shift()
    }
    this.lastTouch = { path, at: now }
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
    this.lastTouch = { path: '', at: 0 }
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
