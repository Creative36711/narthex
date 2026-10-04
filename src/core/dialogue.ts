import { Compiler, Story } from 'inkjs/full'
import { repairInkChoiceConditions } from './inkRepair'
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
    try {
      // ИИ-кампании часто пишут условие выбора ПОСЛЕ `]` — для ink это вывод
      // текста («true» в реплике) и выбор не скрывается. Переносим на место.
      const repaired = repairInkChoiceConditions(source)
      if (repaired.fixed > 0) {
        console.warn(`[ink] «${cacheKey}»: условий выбора перенесено перед «[»: ${repaired.fixed}`)
      }
      const compiled = new Compiler(repaired.source).Compile()
      json = compiled.ToJson() ?? ''
    } catch (err) {
      // inkjs часто бросает голое «Compilation failed» без строк — добавим ключ
      // и хвост исходника, чтобы мастер/плейтест видел, какой диалог сломан.
      const hint = err instanceof Error ? err.message : String(err)
      const preview = source.split('\n').slice(0, 40).join('\n')
      throw new Error(`Ink «${cacheKey}»: ${hint}\n--- ink preview ---\n${preview}\n---`)
    }
    jsonCache.set(cacheKey, json)
  }
  return new Story(json)
}

export function clearDialogueCache(): void {
  jsonCache.clear()
}

/**
 * Имя первого knot в ink-исходнике (`=== name ===`). Нужен как фолбэк, когда
 * у диалога нет канонического `main` (ИИ-кампании часто стартуют с `n_start`).
 */
export function firstInkKnot(source: string): string | null {
  const m = source.match(/===\s*([A-Za-z_][\w]*)\s*===/)
  return m?.[1] ?? null
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
    // успех ставит «галочку» опыта (ТЗ 4.3).
    // КОНТРАКТ: возвращается СТРОКА результата (critical|hard|success|fail|
    // fumble). Её сравнивает сгенерированный конструктором ink
    // (`{ r == "fail" || r == "fumble": … }`, dialogueDoc.ts) — менять тип
    // возврата нельзя, иначе ветка провала станет недостижимой.
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
  // плейсхолдеры реплик (фидбек №11): «упоминать персонажа по имени и много
  // чего другого» — токены конструктора диалогов разворачиваются в эти вызовы
  bind('get_hp_max', () => engine.state.player.max_hp)
  bind('get_mp', () => engine.state.player.mp)
  bind('get_mp_max', () => engine.state.player.max_mp)
  bind('get_player_name', () => engine.state.player.name ?? 'герой')
  bind('get_run_day', () => Math.floor((engine.state.tick ?? 0) / Math.max(1, engine.campaign.meta.ticks_per_day || 24)) + 1)
  bind('get_level', () => engine.state.player.level ?? 1)
  bind('get_xp', () => engine.state.player.xp ?? 0)
  bind('get_currency', (id: string) => engine.state.player.currencies?.[id] ?? 0)
  bind('get_luck', () => engine.luck())
  bind('change_luck', (d: number) => { engine.changeLuck(d); return 0 })
  // производные опции (аудит B6): усталость, рассудок, репутация, достаток, страсти, причастность
  bind('get_fatigue', () => engine.fatigue())
  bind('change_fatigue', (d: number) => { engine.changeFatigue(d); return 0 })
  bind('get_sanity', () => engine.sanity())
  bind('change_sanity', (d: number) => { engine.changeSanity(d); return 0 })
  bind('get_reputation', () => engine.reputation())
  bind('change_reputation', (d: number) => { engine.changeReputation(d); return 0 })
  bind('change_wealth', (levels: number) => { engine.changeWealth(levels); return 0 })
  bind('get_passion', (id: string) => engine.passion(id))
  bind('change_passion', (id: string, delta: number) => { engine.changePassion(id, delta); return 0 })
  bind('get_allegiance', (id: string) => engine.allegiance(id))
  bind('change_allegiance', (id: string, points: number) => { engine.changeAllegiance(id, points); return 0 })
  bind('train_stat', (stat: string, delta: number) => { engine.trainStat(stat, delta); return 0 })
  // опасности, преступления, цены (аудит B7)
  bind('hazard_fall', (meters: number, skill: string) => { engine.applyFall(meters > 0 ? meters : 10, skill || undefined); return 0 })
  bind('commit_crime', (id: string, bounty: number) => { engine.commitCrime(id, bounty > 0 ? bounty : 0); return 0 })
  bind('get_bounty', () => engine.bountyTotal())
  bind('set_price_event', (id: string) => { engine.setPriceEvent(id, true); return 0 })
  bind('clear_price_event', (id: string) => { engine.setPriceEvent(id || '', false); return 0 })
  // прокачка уровни/черты (аудит B8, opt-in)
  bind('grant_xp', (n: number) => { engine.grantXp(n > 0 ? n : 0); return 0 })
  bind('grant_feat', (id: string) => { engine.grantFeat(id); return 0 })
  bind('get_level', () => engine.level())
  // мета-прогресс (аудит B8b)
  bind('meta_currency', (id: string, amount: number) => { engine.grantMetaCurrency(id, amount); return 0 })
  bind('get_meta_currency', (id: string) => engine.metaCurrency(id))
  bind('has_meta_achievement', (id: string) => (engine.metaAchievementDone(id) ? 1 : 0))
  // счётчики хроники в диалогах (design-doc §9, пункт 3): «реплика нового круга»
  // читается как { get_meta_counter("endings_seen") > 0: … }
  bind('get_meta_counter', (key: string) => engine.metaCounter(key))
  // таблицы случайных событий и генераторы (аудит B9)
  bind('roll_table', (table: string) => { engine.rollEventTable(table, { forced: true }); return 0 })
  bind('gen', (generator: string, key: string) => engine.genValue(generator, key))
  bind('gen_seeded', (generator: string, key: string, seed: string) => engine.genValue(generator, key, seed))
  bind('stat_roll', (stat: string, mult: number) => (engine.statCheck(stat, mult > 0 ? mult : 5).success ? 1 : 0))
  bind('opposed_roll', (skill: string, entity: string) => (engine.opposedCheck({ type: 'opposed_check', skill, entity, success_effects: [], fail_effects: [] }).success ? 1 : 0))
  bind('change_hp', (d: number) => { engine.changeHp(d); return 0 })
  bind('advance_time', (ticks: number) => { engine.advanceTicks(ticks); return 0 })
  bind('fire_rule', (ruleId: string) => { engine.fireRule(ruleId); return 0 })
  bind('get_disposition', (target: string) => engine.getDisposition(target))
  bind('change_disposition', (target: string, delta: number) => { engine.changeDisposition(target, delta); return 0 })
  bind('open_trade', (entityId: string) => { engine.openTrade(entityId); return 0 })
  // смена облика/эмоции прямо из реплики (design-doc §9): портрет в диалоге и
  // спрайт в сцене переключаются без правила-посредника
  bind('set_entity_state', (entityId: string, state: string) => {
    engine.applyEffects([{ type: 'set_entity_state', entity: entityId, state: state ?? '' }])
    return 0
  })
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
  bind('unlock_recipe', (id: string) => { engine.applyEffects([{ type: 'unlock_recipe', recipe: id }]); return 0 })
}

/**
 * Строка целиком из булева литерала — это вывод значения выражения, а не
 * реплика: так «true» попадало в разговор, когда условие стояло в текстовой
 * позиции (фидбек 27, п.6). Основная починка — repairInkChoiceConditions;
 * этот фильтр — страховка для остальных форм записи.
 */
const SYSTEM_LITERAL_LINE = /^(?:true|false)$/i

/** Прочитать все доступные строки до выбора/конца. */
export function drainStory(story: Story): { lines: DialogueLine[]; choices: { index: number; text: string }[]; finished: boolean } {
  const lines: DialogueLine[] = []
  while (story.canContinue) {
    const text = (story.Continue() ?? '').trim()
    const tags = story.currentTags ?? []
    const { emotion, action, voice } = parseLineTags(tags)
    if (text && !SYSTEM_LITERAL_LINE.test(text)) lines.push({ text, emotion, action, voice })
  }
  const choices = story.currentChoices.map((c, i) => ({ index: i, text: c.text }))
  return { lines, choices, finished: choices.length === 0 && !story.canContinue }
}


