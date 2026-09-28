import { migrateCampaign, migrateEntity } from '../shared/migrate'
import { checkEngine, checkPackage } from '../shared/versions'
import type {
  ArenaDef,
  CampaignManifest,
  EncounterFileDef,
  CampaignData,
  CodexEntryDef,
  CutsceneDef,
  CampaignMeta,
  EncounterTableDef,
  EntityDef,
  QuestDef,
  RecipeDef,
  RuleDef,
  SceneDef,
  WorldDef,
} from '../shared/types'

/**
 * Загрузка Campaign Package из директории (Фаза 0 — распакованная структура;
 * .chronicle-архив появится вместе с редактором в Фазе 4).
 *
 * Манифест manifest.json перечисляет файлы пакета, чтобы фронтенд мог
 * загрузить их без листинга директорий.
 */

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Не удалось загрузить ${url}: ${res.status}`)
  return res.json() as Promise<T>
}

async function getText(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Не удалось загрузить ${url}: ${res.status}`)
  return res.text()
}

export async function loadCampaign(basePath: string): Promise<CampaignData> {
  const [meta, world, manifest] = await Promise.all([
    getJSON<CampaignMeta>(`${basePath}/campaign.json`),
    getJSON<WorldDef>(`${basePath}/world.json`),
    getJSON<CampaignManifest>(`${basePath}/manifest.json`),
  ])

  // Контракт версий (docs/compatibility.md): пакет новее движка — честный
  // отказ до загрузки десятков файлов, а не «странные глюки» в игре.
  const pkg = checkPackage(meta.package_format)
  if (!pkg.ok) throw new Error(pkg.message)
  const engine = checkEngine(meta.min_engine ?? meta.engine_version)
  if (!engine.ok) console.warn(`[chronicle] ${engine.message}`)

  const scenes: Record<string, SceneDef> = {}
  const entities: Record<string, EntityDef> = {}
  const rules: Record<string, RuleDef> = {}
  const arenas: Record<string, ArenaDef> = {}
  const quests: Record<string, QuestDef> = {}
  const encounters: Record<string, EncounterTableDef> = {}
  const cutscenes: Record<string, CutsceneDef> = {}
  const recipes: Record<string, RecipeDef> = {}
  const codex: Record<string, CodexEntryDef> = {}
  const dialogues: Record<string, string> = {}

  await Promise.all([
    ...(manifest.arenas ?? []).map(async (f) => {
      const a = await getJSON<ArenaDef>(`${basePath}/arenas/${f}`)
      arenas[a.id] = a
    }),
    ...(manifest.quests ?? []).map(async (f) => {
      const q = await getJSON<QuestDef>(`${basePath}/quests/${f}`)
      quests[q.id] = q
    }),
    ...(manifest.encounters ?? []).map(async (f) => {
      const tables = await getJSON<EncounterFileDef>(`${basePath}/rules/${f}`)
      for (const t of tables.encounter_tables) encounters[t.id] = t
    }),
    ...(manifest.cutscenes ?? []).map(async (f) => {
      const c = await getJSON<CutsceneDef>(`${basePath}/cutscenes/${f}`)
      cutscenes[c.id] = c
    }),
    ...(manifest.recipes ?? []).map(async (f) => {
      const r = await getJSON<RecipeDef>(`${basePath}/recipes/${f}`)
      recipes[r.id] = r
    }),
    ...(manifest.codex ?? []).map(async (f) => {
      const c = await getJSON<CodexEntryDef>(`${basePath}/codex/${f}`)
      codex[c.id] = c
    }),
    ...manifest.scenes.map(async (f) => {
      const s = await getJSON<SceneDef>(`${basePath}/scenes/${f}`)
      scenes[s.id] = s
    }),
    ...manifest.entities.map(async (f) => {
      const e = await getJSON<EntityDef>(`${basePath}/entities/${f}`)
      entities[e.id] = migrateEntity(e)
    }),
    ...manifest.rules.map(async (f) => {
      const r = await getJSON<RuleDef>(`${basePath}/rules/${f}`)
      rules[r.id] = r
    }),
    ...manifest.dialogues.map(async (f) => {
      dialogues[`dialogues/${f}`] = await getText(`${basePath}/dialogues/${f}`)
    }),
  ])

  // мягкие миграции старого контента (итерация 8): условия потребностей,
  // переходы «в локацию» из сцен и т.п.
  migrateCampaign(meta, world, scenes)

  return { meta, world, scenes, entities, rules, arenas, quests, encounters, cutscenes, recipes, codex, dialogues, basePath }
}

/**
 * Путь к ассету кампании. Внешние ссылки (http:// и https://) отдаются
 * как есть — кампания может ссылаться на картинки/звук с любого хостинга
 * (итерация 8, блок C).
 */
export function assetUrl(campaign: CampaignData, path: string): string {
  if (!path) return path
  if (/^https?:\/\//i.test(path) || path.startsWith('data:') || path.startsWith('blob:')) return path
  return `${campaign.basePath}/${path}`
}

/** Это внешняя ссылка, а не файл внутри пакета? */
export function isExternalUrl(path: string): boolean {
  return /^(https?:)?\/\//i.test(path) || path.startsWith('data:') || path.startsWith('blob:')
}
