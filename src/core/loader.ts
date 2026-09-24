import type {
  ArenaDef,
  CampaignData,
  CampaignMeta,
  EncounterTableDef,
  EntityDef,
  QuestDef,
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

interface Manifest {
  scenes: string[]
  entities: string[]
  rules: string[]
  arenas?: string[]
  quests?: string[]
  encounters?: string[]
  dialogues: string[]
}

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
    getJSON<Manifest>(`${basePath}/manifest.json`),
  ])

  const scenes: Record<string, SceneDef> = {}
  const entities: Record<string, EntityDef> = {}
  const rules: Record<string, RuleDef> = {}
  const arenas: Record<string, ArenaDef> = {}
  const quests: Record<string, QuestDef> = {}
  const encounters: Record<string, EncounterTableDef> = {}
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
      const tables = await getJSON<{ encounter_tables: EncounterTableDef[] }>(`${basePath}/rules/${f}`)
      for (const t of tables.encounter_tables) encounters[t.id] = t
    }),
    ...manifest.scenes.map(async (f) => {
      const s = await getJSON<SceneDef>(`${basePath}/scenes/${f}`)
      scenes[s.id] = s
    }),
    ...manifest.entities.map(async (f) => {
      const e = await getJSON<EntityDef>(`${basePath}/entities/${f}`)
      entities[e.id] = e
    }),
    ...manifest.rules.map(async (f) => {
      const r = await getJSON<RuleDef>(`${basePath}/rules/${f}`)
      rules[r.id] = r
    }),
    ...manifest.dialogues.map(async (f) => {
      dialogues[`dialogues/${f}`] = await getText(`${basePath}/dialogues/${f}`)
    }),
  ])

  return { meta, world, scenes, entities, rules, arenas, quests, encounters, dialogues, basePath }
}

export function assetUrl(campaign: CampaignData, path: string): string {
  return `${campaign.basePath}/${path}`
}
