import { Compiler, Story } from 'inkjs/full'
import type { GameEngine } from './engine'
import type { NpcDef } from '../shared/types'

/**
 * Dialogue Engine — Ink runtime (ТЗ 4.5).
 * Исходники .ink компилируются при загрузке (inkjs full).
 * External functions пробрасываются в движок.
 */

export interface DialogueLine {
  text: string
  emotion: string
  /** повествование/действие (тег # action) — рендерится курсивом */
  action?: boolean
  /** озвучка реплики: файл пакета или ссылка (тег # voice: …) — итерация 8, блок G */
  voice?: string
}

/** разбор тегов реплики: # emotion: … / # action / # voice: … */
export function parseLineTags(tags: string[]): { emotion: string; action?: boolean; voice?: string } {
  let emotion = 'neutral'
  let action = false
  let voice: string | undefined
  for (const t of tags) {
    const em = t.match(/^emotion:\s*(\w+)/)
    if (em) emotion = em[1]
    if (t.trim() === 'action') action = true
    const vo = t.match(/^voice:\s*(.+)$/)
    if (vo) voice = vo[1].trim()
  }
  return { emotion, action: action || undefined, voice }
}

export interface DialogueUI {
  npc: NpcDef
  lines: DialogueLine[]
  choices: { index: number; text: string }[]
  finished: boolean
}

/**
 * Кэшируется только РЕЗУЛЬТАТ КОМПИЛЯЦИИ (JSON).
 * Экземпляр Story создаётся на каждый забег отдельно — иначе состояние
 * once-выборов протекало бы между рестартами (рогалик!).
 */
const jsonCache = new Map<string, string>()

export function createStory(source: string, cacheKey: string): Story {
  let json = jsonCache.get(cacheKey)
  if (!json) {
    const compiled = new Compiler(source).Compile()
    json = compiled.ToJson() ?? ''
    jsonCache.set(cacheKey, json)
  }
  return new Story(json)
}

export function clearDialogueCache(): void {
  jsonCache.clear()
}

export function bindExternals(story: Story, engine: GameEngine): void {
  const bind = (name: string, fn: (...args: never[]) => unknown) => {
    try {
      story.BindExternalFunction(name, fn as (...args: unknown[]) => unknown, false)
    } catch {
      /* уже привязана */
    }
  }

  bind('has_item', (id: string) => engine.hasItem(id))
  bind('item_count', (id: string) => engine.itemCount(id))
  bind('add_item', (id: string, n: number) => { engine.addItem(id, n); return 0 })
  bind('remove_item', (id: string, n: number) => { engine.removeItem(id, n); return 0 })
  bind('skill_check', (skill: string, difficulty: number) => {
    // порог = навык игрока; сложность смещает порог (50 — нейтральная);
    // успех ставит «галочку» опыта (ТЗ 4.3)
    return engine.playerSkillCheck(skill, difficulty ?? 50).result
  })
  bind('get_need', (id: string) => engine.state.player.needs[id] ?? 0)
  bind('change_need', (id: string, delta: number) => { engine.changeNeed(id, delta); return 0 })
  bind('set_flag', (f: string) => {
    engine.state.flags[f] = true
    // квесты/правила реагируют на флаг сразу (пока не начался бой/торговля),
    // иначе «квест начат» приходил бы только после боя
    if (!engine.combat && !engine.trade) engine.checkRules()
    return 0
  })
  bind('get_flag', (f: string) => !!engine.state.flags[f])
  bind('get_stat', (s: string) => (engine.state.player.stats as unknown as Record<string, number>)[s] ?? 0)
  bind('get_skill', (s: string) => engine.state.player.skills[s] ?? 0)
  bind('get_hp', () => engine.state.player.hp)
  bind('get_luck', () => engine.luck())
  bind('change_luck', (d: number) => { engine.changeLuck(d); return 0 })
  bind('stat_roll', (stat: string, mult: number) => (engine.statCheck(stat, mult > 0 ? mult : 5).success ? 1 : 0))
  bind('opposed_roll', (skill: string, entity: string) => (engine.opposedCheck({ type: 'opposed_check', skill, entity, success_effects: [], fail_effects: [] }).success ? 1 : 0))
  bind('change_hp', (d: number) => { engine.changeHp(d); return 0 })
  bind('advance_time', (ticks: number) => { engine.advanceTicks(ticks); return 0 })
  bind('fire_rule', (ruleId: string) => { engine.fireRule(ruleId); return 0 })
  bind('get_disposition', (target: string) => engine.getDisposition(target))
  bind('change_disposition', (target: string, delta: number) => { engine.changeDisposition(target, delta); return 0 })
  bind('open_trade', (entityId: string) => { engine.openTrade(entityId); return 0 })
  bind('set_description', (entityId: string, text: string) => { engine.setEntityDescription(entityId, text); return 0 })
  bind('join_party', (entityId: string) => { engine.joinParty(entityId); return 0 })
  bind('in_party', (entityId: string) => engine.isInParty(entityId))
  bind('start_quest', (questId: string) => { engine.startQuest(questId); return 0 })
  bind('quest_stage', (questId: string) => engine.state.quests[questId]?.stage ?? '')
  bind('play_cutscene', (id: string) => { engine.playCutscene(id); return 0 })
  bind('sleep', (ticks: number) => {
    engine.advanceTicks(ticks)
    engine.restAndGrow()
    engine.restHeal()
    return 0
  })
  bind('has_status', (id: string) => engine.hasStatus(id))
  bind('apply_status', (id: string, duration: number) => { engine.applyStatus('player', id, duration > 0 ? duration : undefined); return 0 })
  bind('remove_status', (id: string) => { engine.removeStatus('player', id); return 0 })
  bind('weather_is', (id: string) => (engine.state.weather ?? '') === id)
  bind('set_weather', (id: string) => { engine.applyEffects([{ type: 'set_weather', weather: id }]); return 0 })
  bind('unlock_codex', (id: string) => { engine.applyEffects([{ type: 'unlock_codex', entry: id }]); return 0 })
}

/** Прочитать все доступные строки до выбора/конца. */
export function drainStory(story: Story): { lines: DialogueLine[]; choices: { index: number; text: string }[]; finished: boolean } {
  const lines: DialogueLine[] = []
  while (story.canContinue) {
    const text = (story.Continue() ?? '').trim()
    const tags = story.currentTags ?? []
    const { emotion, action, voice } = parseLineTags(tags)
    if (text) lines.push({ text, emotion, action, voice })
  }
  const choices = story.currentChoices.map((c, i) => ({ index: i, text: c.text }))
  return { lines, choices, finished: choices.length === 0 && !story.canContinue }
}
