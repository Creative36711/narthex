/**
 * Статический анализ кампании для ИИ-агента: то, что человек делает глазами в
 * редакторе, а агент не видит вовсе.
 *
 * Здесь НЕТ прохождения игры. Это разбор пакета как графа: что достижимо,
 * что ссылается в пустоту, какие флаги/квесты/концовки мертвы. Дешёво,
 * детерминированно и без ложных «прошёл/не прошёл».
 */

type AnyObj = Record<string, any>

// Имена узлов и целей бывают кириллицей — берём любой не-пробельный токен.
const INK_KNOT = /^[ \t]*={2,}[ \t]*([^\s=][^\n=]*?)[ \t]*=*[ \t]*$/gm
const INK_FUNCTION_KNOT = /^[ \t]*={2,}[ \t]*function[ \t]+([^\s(]+)/gm
const INK_DIVERT = /(?:^|[^\w>-])->[ \t]*([^\s<>{}[\](),;]+)/g
const INK_FLAG_READ = /get_flag\(\s*["']([^"']+)["']\s*\)/g
const INK_FLAG_WRITE = /(?:set_flag|clear_flag|toggle_flag)\(\s*["']([^"']+)["']/g
const INK_SCENE_JUMP = /go_to_scene\(\s*["']([^"']+)["']\s*\)/g
const INK_TELEPORT = /teleport_player\(\s*["']([^"']+)["']/g
const INK_QUEST_START = /start_quest\(\s*["']([^"']+)["']\s*\)/g
const INK_QUEST_ADVANCE = /advance_quest\(\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']\s*\)/g
const INK_COMBAT = /start_combat\(\s*["']([^"']+)["']\s*\)/g

export type Severity = 'error' | 'warning' | 'info'

export interface Finding {
  code: string
  severity: Severity
  message: string
  where?: string
  hint?: string
}

export interface GraphReport {
  campaign: { id: string; title: string; version: string }
  counts: Record<string, number>
  reachability: {
    scenes: { total: number; reachable: string[]; unreachable: string[] }
    locations: { total: number; reachable: string[]; unreachable: string[] }
  }
  dialogues: Array<{ path: string; knots: string[]; problems: Finding[] }>
  findings: Finding[]
}

// ─────────────────────────── обход структуры ────────────────────────────────

interface Walk {
  effects: AnyObj[]
  conditions: AnyObj[]
}

const WRITE_FLAG = new Set(['set_flag', 'clear_flag', 'toggle_flag'])
const READ_FLAG = new Set(['flag_set', 'flag_not_set'])
const QUEST_EFFECT = new Set(['start_quest', 'advance_quest', 'fail_quest'])
const QUEST_CONDITION = new Set(['quest_at_stage'])
const TELEPORT = new Set(['teleport_player'])
const ENTER_CONDITION = new Set(['player_enters_scene', 'player_enters_location'])
const START_COMBAT = new Set(['start_combat'])
const START_DIALOGUE = new Set(['start_dialogue'])

/** Один проход по всему пакету: собираем эффекты и условия по типу. */
export function walkCampaign(campaign: AnyObj): Walk {
  const effects: AnyObj[] = []
  const conditions: AnyObj[] = []
  const seen = new Set<unknown>()

  const visit = (value: unknown, depth: number): void => {
    if (depth > 40 || value === null || typeof value !== 'object') return
    if (seen.has(value)) return
    seen.add(value)
    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1)
      return
    }
    const type = typeof (value as AnyObj).type === 'string' ? String((value as AnyObj).type) : ''
    if (WRITE_FLAG.has(type) || QUEST_EFFECT.has(type) || TELEPORT.has(type) || START_COMBAT.has(type) || START_DIALOGUE.has(type)) {
      effects.push(value as AnyObj)
      // вложенные эффекты внутри эффектов (success_effects и т.п.) тоже нужны
    }
    if (READ_FLAG.has(type) || QUEST_CONDITION.has(type) || ENTER_CONDITION.has(type)) conditions.push(value as AnyObj)
    for (const entry of Object.values(value as AnyObj)) visit(entry, depth + 1)
  }

  visit(campaign, 0)
  return { effects, conditions }
}

// ─────────────────────────── ink-разбор ─────────────────────────────────────

export function parseInk(source: string): {
  knots: string[]
  functions: string[]
  targets: string[]
  missingTargets: string[]
  flagReads: string[]
  flagWrites: string[]
  sceneJumps: string[]
  teleports: string[]
  questStarts: string[]
  questAdvances: Array<[string, string]>
  combats: string[]
} {
  const knots: string[] = []
  const functions: string[] = []
  for (const m of source.matchAll(INK_KNOT)) {
    const name = m[1]!
    if (/^function\b/.test(name)) continue
    knots.push(name)
  }
  for (const m of source.matchAll(INK_FUNCTION_KNOT)) functions.push(m[1]!)

  const targets: string[] = []
  for (const m of source.matchAll(INK_DIVERT)) {
    const name = m[1]!
    if (name === 'DONE' || name === 'END') continue
    targets.push(name)
  }
  const defined = new Set([...knots, ...functions, 'DONE', 'END'])
  const missingTargets = [...new Set(targets.filter((t) => !defined.has(t)))]

  const collect = (re: RegExp, pick: (m: RegExpMatchArray) => string): string[] => [...new Set([...source.matchAll(re)].map(pick))]
  return {
    knots,
    functions,
    targets: [...new Set(targets)],
    missingTargets,
    flagReads: collect(INK_FLAG_READ, (m) => m[1]!),
    flagWrites: collect(INK_FLAG_WRITE, (m) => m[1]!),
    sceneJumps: collect(INK_SCENE_JUMP, (m) => m[1]!),
    teleports: collect(INK_TELEPORT, (m) => m[1]!),
    questStarts: collect(INK_QUEST_START, (m) => m[1]!),
    questAdvances: [...source.matchAll(INK_QUEST_ADVANCE)].map((m) => [m[1]!, m[2]!] as [string, string]),
    combats: collect(INK_COMBAT, (m) => m[1]!),
  }
}

// ─────────────────────────── граф кампании ──────────────────────────────────

interface Graph {
  /** scene → сцены, куда из неё можно попасть */
  sceneEdges: Map<string, Set<string>>
  /** location → локации, куда можно уехать */
  locationEdges: Map<string, Set<string>>
  /** scene → есть ли вообще выход (любой) */
  sceneHasExit: Map<string, boolean>
  /** где-то эффектом задан переход в сцену/локацию */
  effectScenes: Set<string>
  effectLocations: Set<string>
  /** location → сцены, доступные на локации (arrival_scene + scenes) */
  locationScenes: Map<string, string[]>
}

function buildGraph(campaign: AnyObj, ink: Array<ReturnType<typeof parseInk>>): Graph {
  const sceneEdges = new Map<string, Set<string>>()
  const locationEdges = new Map<string, Set<string>>()
  const sceneHasExit = new Map<string, boolean>()
  const effectScenes = new Set<string>()
  const effectLocations = new Set<string>()
  const locationScenes = new Map<string, string[]>()

  for (const scene of Object.values(campaign.scenes ?? {}) as AnyObj[]) {
    const out = new Set<string>()
    for (const zone of (scene.navigation ?? []) as AnyObj[]) {
      if (zone.go_to_scene) out.add(String(zone.go_to_scene))
    }
    sceneEdges.set(String(scene.id), out)
    sceneHasExit.set(
      String(scene.id),
      (scene.navigation ?? []).some((z: AnyObj) => z.go_to_scene || z.open_map),
    )
  }

  for (const region of Object.values(campaign.world?.regions ?? {}) as AnyObj[]) {
    for (const location of (region.locations ?? []) as AnyObj[]) {
      const out = new Set<string>()
      for (const conn of (location.travel_connections ?? []) as AnyObj[]) out.add(String(conn.to))
      locationEdges.set(String(location.id), out)
      const here = [...((location.scenes ?? []) as string[]), location.arrival_scene]
        .filter(Boolean)
        .map(String)
      locationScenes.set(String(location.id), [...new Set(here)])
    }
  }

  const { effects } = walkCampaign(campaign)
  for (const effect of effects) {
    if (effect.type === 'teleport_player') {
      if (effect.scene) effectScenes.add(String(effect.scene))
      if (effect.location) effectLocations.add(String(effect.location))
    }
  }
  for (const parsed of ink) {
    for (const sceneId of parsed.sceneJumps) effectScenes.add(sceneId)
    for (const locationId of parsed.teleports) effectLocations.add(locationId)
  }

  return { sceneEdges, locationEdges, sceneHasExit, effectScenes, effectLocations, locationScenes }
}

function collectGraph(campaign: AnyObj, graph: Graph, startScene: string, startLocation: string, startRegion: string) {
  const scenes = new Set(Object.keys(campaign.scenes ?? {}))
  const locations = new Set([...graph.locationEdges.keys()])

  const reachableScenes = new Set<string>()
  const reachableLocations = new Set<string>()

  // Граф двудольный: сцена → локация (scene.location) и локация → сцены
  // (arrival_scene + scenes). Плюс дороги между локациями и навигация между сценами.
  // Поэтому обходим в один проход, пока множества не перестанут расти.
  let changed = true
  const addScene = (id: string) => {
    if (scenes.has(id) && !reachableScenes.has(id)) {
      reachableScenes.add(id)
      changed = true
    }
  }
  const addLocation = (id: string) => {
    if (locations.has(id) && !reachableLocations.has(id)) {
      reachableLocations.add(id)
      changed = true
    }
  }
  addScene(startScene)
  addLocation(startLocation)
  for (const id of graph.effectScenes) addScene(id)
  for (const id of graph.effectLocations) addLocation(id)

  while (changed) {
    changed = false
    for (const sceneId of [...reachableScenes]) {
      for (const next of graph.sceneEdges.get(sceneId) ?? []) addScene(next)
      const locationId = campaign.scenes?.[sceneId]?.location
      if (locationId) addLocation(String(locationId))
    }
    for (const locationId of [...reachableLocations]) {
      for (const sceneId of graph.locationScenes.get(locationId) ?? []) addScene(sceneId)
      for (const next of graph.locationEdges.get(locationId) ?? []) addLocation(next)
    }
  }
  void startRegion

  return {
    scenes: { total: scenes.size, reachable: [...reachableScenes].sort(), unreachable: [...scenes].filter((s) => !reachableScenes.has(s)).sort() },
    locations: {
      total: locations.size,
      reachable: [...reachableLocations].sort(),
      unreachable: [...locations].filter((l) => !reachableLocations.has(l)).sort(),
    },
  }
}

// ─────────────────────────── основной отчёт ─────────────────────────────────

export function analyzeCampaign(campaign: AnyObj): GraphReport {
  const findings: Finding[] = []
  const meta = campaign.meta ?? {}
  const dialogues: GraphReport['dialogues'] = []

  // Порядок диалогов не должен зависеть от того, как файлы прочитались:
  // кампания собирается из параллельных чтений, и ключи `dialogues` приходили
  // в разном порядке — тогда `report.json`, `graph.json` и их md-версии
  // менялись от прогона к прогону при том же кампейне. Сортируем по пути —
  // и граф, и находки становятся воспроизводимыми.
  const parsedInk = Object.entries(campaign.dialogues ?? {})
    .map(([path, source]) => ({
      path,
      parsed: parseInk(String(source)),
    }))
    .sort((a, b) => a.path.localeCompare(b.path))

  const graph = buildGraph(campaign, parsedInk.map((d) => d.parsed))
  const startScene = String(meta.starting_scene ?? '')
  const startLocation = String(meta.starting_location ?? '')
  const startRegion = String(meta.starting_region ?? '')
  const reachability = collectGraph(campaign, graph, startScene, startLocation, startRegion)

  // ── ink: битые переходы, пустые диалоги, ссылки на несуществующие сцены
  for (const { path, parsed } of parsedInk) {
    const problems: Finding[] = []
    for (const target of parsed.missingTargets) {
      problems.push({
        code: 'ink_missing_knot',
        severity: 'error',
        message: `переход на несуществующий узел «${target}»`,
        where: path,
        hint: 'Опечатка в -> или узел не объявлен === knot ===',
      })
    }
    if (!parsed.knots.length) {
      problems.push({ code: 'ink_no_knots', severity: 'error', message: 'в диалоге нет ни одного узла', where: path })
    }
    for (const sceneId of parsed.sceneJumps) {
      if (sceneId && !campaign.scenes?.[sceneId]) {
        problems.push({ code: 'ink_scene_missing', severity: 'error', message: `go_to_scene → несуществующая сцена «${sceneId}»`, where: path })
      }
    }
    for (const arenaId of parsed.combats) {
      if (arenaId && !campaign.arenas?.[arenaId]) {
        problems.push({ code: 'ink_arena_missing', severity: 'error', message: `start_combat → несуществующая арена «${arenaId}»`, where: path })
      }
    }
    for (const [questId, stageId] of parsed.questAdvances) {
      const quest = campaign.quests?.[questId]
      if (!quest) problems.push({ code: 'ink_quest_missing', severity: 'error', message: `advance_quest → несуществующий квест «${questId}»`, where: path })
      else if (!(quest.stages ?? []).some((s: AnyObj) => s.id === stageId))
        problems.push({ code: 'ink_quest_stage_missing', severity: 'error', message: `advance_quest «${questId}» → несуществующая стадия «${stageId}»`, where: path })
    }
    findings.push(...problems)
    dialogues.push({ path, knots: parsed.knots, problems })
  }

  // ── мир: дороги и сцены локаций
  for (const region of Object.values(campaign.world?.regions ?? {}) as AnyObj[]) {
    for (const location of (region.locations ?? []) as AnyObj[]) {
      for (const conn of (location.travel_connections ?? []) as AnyObj[]) {
        if (conn.to && !(campaign.world?.regions ?? []).some((r: AnyObj) => (r.locations ?? []).some((l: AnyObj) => l.id === conn.to))) {
          findings.push({
            code: 'travel_target_missing',
            severity: 'error',
            message: `дорога из «${location.id}» ведёт в несуществующую локацию «${conn.to}»`,
            where: 'world.json',
          })
        }
      }
      const listed = ([...(location.scenes ?? []), location.arrival_scene].filter(Boolean) as string[])
      for (const sceneId of listed) {
        if (!campaign.scenes?.[sceneId]) {
          findings.push({
            code: 'location_scene_missing',
            severity: 'error',
            message: `локация «${location.id}» ссылается на несуществующую сцену «${sceneId}»`,
            where: 'world.json',
            hint: 'Сцена удалена или переименована — игрок увидит пустую локацию',
          })
        }
      }
    }
  }

  // ── сцены
  for (const scene of Object.values(campaign.scenes ?? {}) as AnyObj[]) {
    if (!graph.sceneHasExit.get(String(scene.id))) {
      const locationId = String(scene.location ?? '')
      const locationHasRoads = (graph.locationEdges.get(locationId)?.size ?? 0) > 0
      if (!locationHasRoads) {
        findings.push({
          code: 'scene_dead_end',
          severity: 'warning',
          message: `сцена «${scene.label ?? scene.id}» без навигации, и из локации «${locationId}» нет дорог`,
          where: `scenes/${scene.id}`,
          hint: 'Игрок попадёт сюда и не сможет выйти',
        })
      }
    }
    if (scene.location && !(campaign.world?.regions ?? []).some((r: AnyObj) => (r.locations ?? []).some((l: AnyObj) => l.id === scene.location))) {
      findings.push({
        code: 'scene_location_missing',
        severity: 'error',
        message: `сцена «${scene.label ?? scene.id}» привязана к несуществующей локации «${scene.location}»`,
        where: `scenes/${scene.id}`,
      })
    }
    for (const zone of (scene.navigation ?? []) as AnyObj[]) {
      if (zone.go_to_scene && !campaign.scenes?.[zone.go_to_scene]) {
        findings.push({
          code: 'nav_scene_missing',
          severity: 'error',
          message: `переход «${zone.label ?? zone.id ?? '?'}» ведёт в несуществующую сцену «${zone.go_to_scene}»`,
          where: `scenes/${scene.id}`,
        })
      }
      if (zone.intercept_dialogue && !campaign.entities?.[zone.intercept_dialogue]) {
        findings.push({
          code: 'nav_intercept_missing',
          severity: 'error',
          message: `перехват перехода ссылается на несуществующую сущность «${zone.intercept_dialogue}»`,
          where: `scenes/${scene.id}`,
        })
      }
      if (zone.intercept_rule && !campaign.rules?.[zone.intercept_rule]) {
        findings.push({
          code: 'nav_rule_missing',
          severity: 'error',
          message: `перехват перехода ссылается на несуществующее правило «${zone.intercept_rule}»`,
          where: `scenes/${scene.id}`,
        })
      }
    }
    for (const slot of (scene.slots ?? []) as AnyObj[]) {
      if (slot.default_entity && !campaign.entities?.[slot.default_entity]) {
        findings.push({
          code: 'slot_entity_missing',
          severity: 'error',
          message: `слот «${slot.label ?? slot.id}» назначает несуществующую сущность «${slot.default_entity}»`,
          where: `scenes/${scene.id}`,
        })
      }
      const slotType = Array.isArray(slot.type) ? slot.type : [slot.type]
      if (slotType.includes('person') && !slot.default_entity && !slot.condition) {
        const usedBySchedule = (Object.values(campaign.entities ?? {}) as AnyObj[]).some((entity) =>
          (entity.schedule ?? []).some((entry: AnyObj) => entry.scene === scene.id && entry.slot === slot.id),
        )
        if (!usedBySchedule) {
          findings.push({
            code: 'slot_person_empty',
            severity: 'info',
            message: `слот «${slot.label ?? slot.id}» для персонажа всегда пуст: нет default_entity и никто не приходит по расписанию`,
            where: `scenes/${scene.id}`,
          })
        }
      }
    }
  }

  for (const sceneId of reachability.scenes.unreachable) {
    findings.push({
      code: 'scene_unreachable',
      severity: 'warning',
      message: `сцена «${campaign.scenes?.[sceneId]?.label ?? sceneId}» недостижима ни навигацией, ни эффектом`,
      where: `scenes/${sceneId}`,
      hint: 'Контент есть, но игрок до него не дойдёт',
    })
  }
  for (const locationId of reachability.locations.unreachable) {
    findings.push({
      code: 'location_unreachable',
      severity: 'warning',
      message: `локация «${locationId}» недостижима по дорогам и телепортам`,
      where: `world.json`,
    })
  }

  // ── эффекты: ссылки на несуществующие сущности
  const { effects, conditions } = walkCampaign(campaign)
  for (const effect of effects) {
    if (effect.type === 'teleport_player') {
      if (effect.location && !campaign.world?.regions?.some?.((r: AnyObj) => (r.locations ?? []).some((l: AnyObj) => l.id === effect.location)) && !reachability.locations.total) {
        findings.push({ code: 'teleport_location_missing', severity: 'error', message: `teleport_player → несуществующая локация «${effect.location}»` })
      }
      if (effect.scene && !campaign.scenes?.[effect.scene]) {
        findings.push({ code: 'teleport_scene_missing', severity: 'error', message: `teleport_player → несуществующая сцена «${effect.scene}»` })
      }
    }
    if (effect.type === 'start_combat' && effect.arena && !campaign.arenas?.[effect.arena]) {
      findings.push({ code: 'combat_arena_missing', severity: 'error', message: `start_combat → несуществующая арена «${effect.arena}»` })
    }
    if (effect.type === 'start_dialogue' && effect.entity && !campaign.entities?.[effect.entity]) {
      findings.push({ code: 'dialogue_entity_missing', severity: 'error', message: `start_dialogue → несуществующая сущность «${effect.entity}»` })
    }
  }

  // ── флаги: записан vs прочитан
  const flagWrites = new Set<string>()
  const flagReads = new Set<string>()
  for (const effect of effects) if (WRITE_FLAG.has(effect.type) && effect.flag) flagWrites.add(String(effect.flag))
  for (const condition of conditions) if (READ_FLAG.has(condition.type) && condition.flag) flagReads.add(String(condition.flag))
  for (const { parsed } of parsedInk) {
    for (const flag of parsed.flagWrites) flagWrites.add(flag)
    for (const flag of parsed.flagReads) flagReads.add(flag)
  }
  for (const flag of (meta.flags ?? []) as AnyObj[]) flagWrites.add(String(flag.id))

  for (const flag of flagReads) {
    if (!flagWrites.has(flag)) {
      findings.push({
        code: 'flag_read_never_written',
        severity: 'error',
        message: `флаг «${flag}» читается, но нигде не выставляется — ветка мертва`,
        hint: 'Опечатка в имени флага или забыт set_flag',
      })
    }
  }
  for (const flag of flagWrites) {
    if (!flagReads.has(flag)) {
      findings.push({
        code: 'flag_written_never_read',
        severity: 'warning',
        message: `флаг «${flag}» выставляется, но нигде не читается`,
        hint: 'Мёртвый флаг: либо забыт потребитель, либо лишний эффект',
      })
    }
  }

  // ── квесты: стадии
  for (const quest of Object.values(campaign.quests ?? {}) as AnyObj[]) {
    const stageIds = new Set((quest.stages ?? []).map((s: AnyObj) => String(s.id)))
    const referenced = new Set<string>()
    for (const effect of effects) {
      if (effect.type !== 'advance_quest' || effect.quest !== quest.id) continue
      if (effect.stage && !stageIds.has(String(effect.stage))) {
        findings.push({
          code: 'quest_stage_missing',
          severity: 'error',
          message: `квест «${quest.label ?? quest.id}»: эффект ведёт в несуществующую стадию «${effect.stage}»`,
          where: `quests/${quest.id}`,
        })
      }
      if (effect.stage) referenced.add(String(effect.stage))
    }
    for (const { parsed } of parsedInk) {
      for (const [questId, stageId] of parsed.questAdvances) {
        if (questId !== quest.id) continue
        referenced.add(stageId)
        if (!stageIds.has(stageId)) {
          findings.push({
            code: 'quest_stage_missing',
            severity: 'error',
            message: `квест «${quest.label ?? quest.id}»: ink ведёт в несуществующую стадию «${stageId}»`,
          })
        }
      }
    }
    // стадия достигается и переходом из другой стадии, а не только эффектом
    for (const stage of (quest.stages ?? []) as AnyObj[]) {
      for (const transition of (stage.transitions ?? []) as AnyObj[]) {
        if (transition.to) referenced.add(String(transition.to))
      }
    }
    const first = (quest.stages ?? [])[0]?.id
    for (const stage of quest.stages ?? []) {
      if (String(stage.id) === String(first)) continue
      if (!referenced.has(String(stage.id)) && !(stage.auto !== undefined)) {
        findings.push({
          code: 'quest_stage_unreferenced',
          severity: 'info',
          message: `квест «${quest.label ?? quest.id}»: стадия «${stage.label ?? stage.id}» нигде не включается эффектом`,
          where: `quests/${quest.id}`,
        })
      }
    }
  }

  // ── диалоги: ссылки NPC и сироты
  const referencedDialogues = new Set<string>()
  for (const entity of Object.values(campaign.entities ?? {}) as AnyObj[]) {
    if (entity.type === 'npc' && entity.dialogue) referencedDialogues.add(String(entity.dialogue))
  }
  for (const encounter of Object.values(campaign.encounters ?? {}) as AnyObj[]) {
    for (const entry of encounter.entries ?? []) {
      if (entry.type === 'dialogue' && entry.entity) {
        const npc = campaign.entities?.[entry.entity]
        if (npc?.dialogue) referencedDialogues.add(String(npc.dialogue))
      }
    }
  }
  const inkPaths = new Set(parsedInk.map((d) => d.path))
  for (const ref of referencedDialogues) {
    const normalized = ref.startsWith('dialogues/') ? ref : `dialogues/${ref.replace(/\.ink$/, '')}.ink`
    if (!inkPaths.has(normalized) && !inkPaths.has(ref)) {
      findings.push({
        code: 'dialogue_file_missing',
        severity: 'error',
        message: `NPC ссылается на отсутствующий диалог «${ref}»`,
      })
    }
  }
  for (const path of inkPaths) {
    if (![...referencedDialogues].some((ref) => ref === path || path.endsWith(ref) || ref.endsWith(path.replace(/^dialogues\//, '')))) {
      findings.push({
        code: 'dialogue_orphan',
        severity: 'info',
        message: `диалог «${path}» никем не используется`,
        hint: 'Либо забыт NPC, либо файл остался от удалённого персонажа',
      })
    }
  }

  // ── концовки
  const endings = (meta.endings ?? []) as AnyObj[]
  for (const ending of endings) {
    for (const condition of ending.conditions ?? []) {
      const flag = condition.flag as string | undefined
      if ((condition.type === 'flag_set' || condition.type === 'flag_not_set') && flag && !flagWrites.has(flag)) {
        findings.push({
          code: 'ending_condition_dead',
          severity: 'warning',
          message: `концовка «${ending.label ?? ending.id}» зависит от флага «${flag}», который нигде не выставляется`,
          where: `campaign.json → endings`,
        })
      }
    }
  }

  const counts = {
    scenes: Object.keys(campaign.scenes ?? {}).length,
    locations: reachability.locations.total,
    entities: Object.keys(campaign.entities ?? {}).length,
    dialogues: parsedInk.length,
    inkKnots: parsedInk.reduce((sum, d) => sum + d.parsed.knots.length, 0),
    rules: Object.keys(campaign.rules ?? {}).length,
    quests: Object.keys(campaign.quests ?? {}).length,
    endings: endings.length,
    arenas: Object.keys(campaign.arenas ?? {}).length,
    flagsWritten: flagWrites.size,
    flagsRead: flagReads.size,
  }

  // Полный порядок, а не «по важности и коду»: две находки одного кода в разных
  // местах иначе менялись бы местами от прогона к прогону, и хеш отчёта был бы
  // случайным. Тай-брейк по тексту и месту закрывает последний источник шума.
  findings.sort(
    (a, b) =>
      severityRank(a.severity) - severityRank(b.severity) ||
      a.code.localeCompare(b.code) ||
      a.message.localeCompare(b.message) ||
      String(a.where).localeCompare(String(b.where)),
  )
  return {
    campaign: { id: String(meta.id ?? ''), title: String(meta.title ?? ''), version: String(meta.version ?? '') },
    counts,
    reachability,
    dialogues,
    findings,
  }
}

function severityRank(severity: Severity): number {
  return severity === 'error' ? 0 : severity === 'warning' ? 1 : 2
}

export function formatGraphReport(report: GraphReport): string {
  const counts = report.findings.reduce<Record<Severity, number>>(
    (acc, finding) => {
      acc[finding.severity] += 1
      return acc
    },
    { error: 0, warning: 0, info: 0 },
  )
  const lines: string[] = []
  lines.push(`# Граф кампании · ${report.campaign.title}`)
  lines.push('')
  lines.push(
    `сцен ${report.counts.scenes} · локаций ${report.counts.locations} · диалогов ${report.counts.dialogues} ` +
      `(${report.counts.inkKnots} узлов) · квестов ${report.counts.quests} · концовок ${report.counts.endings} · ` +
      `флагов ${report.counts.flagsWritten}/${report.counts.flagsRead} (пишутся/читаются)`,
  )
  lines.push('')
  lines.push(`Ошибок: ${counts.error} · предупреждений: ${counts.warning} · заметок: ${counts.info}`)
  lines.push('')

  if (report.findings.length) {
    lines.push('## Находки')
    lines.push('')
    for (const finding of report.findings) {
      const mark = finding.severity === 'error' ? '✗' : finding.severity === 'warning' ? '!' : '·'
      lines.push(`- ${mark} \`${finding.code}\` ${finding.message}${finding.where ? ` — \`${finding.where}\`` : ''}`)
      if (finding.hint) lines.push(`  - ${finding.hint}`)
    }
    lines.push('')
  } else {
    lines.push('Находок нет.')
    lines.push('')
  }

  const unreachableScenes = report.reachability.scenes.unreachable
  lines.push('## Достижимость')
  lines.push('')
  lines.push(
    `Сцены: ${report.reachability.scenes.reachable.length} из ${report.reachability.scenes.total} достижимы` +
      (unreachableScenes.length ? `, недостижимы: ${unreachableScenes.join(', ')}` : ''),
  )
  lines.push(
    `Локации: ${report.reachability.locations.reachable.length} из ${report.reachability.locations.total} достижимы` +
      (report.reachability.locations.unreachable.length ? `, недостижимы: ${report.reachability.locations.unreachable.join(', ')}` : ''),
  )
  lines.push('')
  return lines.join('\n')
}
