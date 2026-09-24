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
  meta!: CampaignMeta
  world!: WorldDef
  manifest!: ManifestDef

  /** JSON-документы по путям пакета */
  jsonFiles = new Map<string, unknown>()
  /** текстовые документы (.ink) по путям пакета */
  textFiles = new Map<string, string>()

  dirty = new Set<string>()
  private listeners = new Set<() => void>()

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
    this.meta = (await (await get('campaign.json')).json()) as CampaignMeta
    this.world = (await (await get('world.json')).json()) as WorldDef
    this.manifest = (await (await get('manifest.json')).json()) as ManifestDef

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
    await Promise.all(jobs)
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

  // ─────────────── правки ───────────────

  touch(path: string): void {
    this.dirty.add(path)
    this.notify()
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
      this.dirty.delete(p)
    }
    this.notify()
  }
}
