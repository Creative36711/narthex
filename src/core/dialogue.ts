import { Compiler, Story, type CompilerOptions } from 'inkjs/full'
import type { GameEngine } from './engine'
import type { NpcDef } from '../shared/types'
import { playInteraction } from '../shared/audio'

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
  /** звуковой эффект реплики: id звука из meta.sounds или путь к файлу (# sfx: …) */
  sfx?: string
  /** секундный таймер показа реплики (# timer: 3 или # timeout: 3) */
  timer?: number
}

/** разбор тегов реплики: # emotion: … / # action / # voice: … / # sfx: … / # timer: N */
export function parseLineTags(tags: string[]): { emotion: string; action?: boolean; voice?: string; sfx?: string; timer?: number } {
  let emotion = 'neutral'
  let action = false
  let voice: string | undefined
  let sfx: string | undefined
  let timer: number | undefined
  for (const t of tags) {
    const em = t.match(/^emotion:\s*(\w+)/)
    if (em) emotion = em[1]
    if (t.trim() === 'action') action = true
    const vo = t.match(/^voice:\s*(.+)$/)
    if (vo) voice = vo[1].trim()
    const sf = t.match(/^(?:sfx|sound):\s*(.+)$/)
    if (sf) sfx = sf[1].trim()
    const tm = t.match(/^(?:timer|timeout):\s*(\d+)/)
    if (tm) timer = Number(tm[1])
  }
  return { emotion, action: action || undefined, voice, sfx, timer }
}

export interface DialogueHistoryEntry {
  speaker: string
  text: string
  emotion?: string
  action?: boolean
  isChoice?: boolean
}

export interface DialogueUI {
  npc: NpcDef
  lines: DialogueLine[]
  choices: { index: number; text: string }[]
  finished: boolean
  /** накопленная история реплик текущего разговора для просмотра игроком (backlog) */
  history?: DialogueHistoryEntry[]
  /**
   * Дедлайн на раздумье, объявленный ink-ом (`~ set_dialogue_timer`).
   * Плеер показывает обратный отсчёт и по нулю зовёт `engine.dialogueTimeout()`.
   */
  timer?: { seconds: number; knot?: string }
  /**
   * Режим предъявления предмета/улики (`~ present_item`).
   * Плеер открывает выбор из инвентаря игрока.
   */
  presenting?: { ok: string; fail: string; required?: string }
}

/**
 * Кэшируется только РЕЗУЛЬТАТ КОМПИЛЯЦИИ (JSON).
 * Экземпляр Story создаётся на каждый забег отдельно — иначе состояние
 * once-выборов протекало бы между рестартами (рогалик!).
 */
const jsonCache = new Map<string, string>()

/**
 * Автоматическая подготовка рукописного ink к безошибочной компиляции:
 * 1. Удаление markdown-разделителей (* * *, ***, ---, ___), которые inkjs принимает за пустые выборы;
 * 2. Нормализация маркеров списков перед блоками условий (* { cond: -> { cond:);
 * 3. Нормализация вызовов функций (open_craft() -> open_craft(""));
 * 4. Защита от несуществующих переходов (например -> main_choice -> -> main_hub);
 * 5. Автоматическое объявление всех нехватающих EXTERNAL функций движка;
 * 6. Автоматическое объявление интерполированных строковых переменных ({имя}, {hero}).
 */
export function sanitizeInkSource(source: string): string {
  let lines = source.split('\n')
  lines = lines.filter((l) => !/^\s*(\*\s*){3,}\s*$/.test(l) && !/^\s*[-_]{3,}\s*$/.test(l))
  lines = lines.map((l) => {
    if (l.includes('[') && l.includes(']')) return l
    return l.replace(/^(\s*)[*+-]\s*(\{.*?:)/, '$1$2')
  })
  lines = lines.map((l) => l.replace(/\bopen_craft\(\)/g, 'open_craft("")'))

  // Защита от повторного объявления ~ temp <var> внутри одного узла Ink
  const knotDeclaredTemps = new Set<string>()
  lines = lines.map((l) => {
    if (/^===\s*([^\s=]+)/.test(l.trim())) {
      knotDeclaredTemps.clear()
      return l
    }
    const tm = /^\s*~\s*temp\s+(\w+)\s*=/.exec(l)
    if (tm) {
      const v = tm[1]
      if (knotDeclaredTemps.has(v)) {
        return l.replace(/^\s*~\s*temp\s+/, '    ~ ')
      }
      knotDeclaredTemps.add(v)
    }
    return l
  })

  // Сбор существующих узлов knot: === knotName ===
  const knotNames = new Set<string>()
  for (const l of lines) {
    const km = /^===\s*([^\s=]+)/.exec(l.trim())
    if (km) knotNames.add(km[1])
  }
  const defaultHub = knotNames.has('main_hub')
    ? 'main_hub'
    : (knotNames.has('main') ? 'main' : (knotNames.values().next().value ?? 'DONE'))

  // Исправление невалидных divert
  lines = lines.map((l) => {
    return l.replace(/->\s*([a-zA-Z0-9_]+)/g, (full, target) => {
      if (target === 'DONE' || target === 'END' || knotNames.has(target)) return full
      return `-> ${defaultHub}`
    })
  })

  let text = lines.join('\n')

  const externals = [
    'get_flag(f)', 'has_item(id)', 'item_count(id)', 'get_disposition(t)',
    'quest_stage(q)', 'in_party(e)', 'get_hp()', 'has_status(s)', 'weather_is(w)',
    'get_skill(s)', 'get_currency(c)', 'get_meta_counter(k)', 'skill_check(s, d)',
    'set_flag(f)', 'clear_flag(f)', 'apply_status(p, s, d)', 'remove_status(p, s)',
    'set_weather(w)', 'unlock_codex(e)', 'unlock_recipe(r)', 'open_trade(n)',
    'open_craft(r)', 'add_item(id, n)', 'remove_item(id, q)', 'change_disposition(t, d)',
    'join_party(e)', 'start_combat(a)', 'start_quest(q)', 'advance_quest(q, s)',
    'fail_quest(q)', 'journal_update(q, k)', 'fire_rule(r)', 'change_hp(d)',
    'change_need(n, d)', 'advance_time(t)', 'sleep(h)', 'set_dialogue_timer(s, k)',
    'present_item(o, f, r)', 'play_sound(s, v)', 'set_entity_state(e, s)',
    'learn_name(id)', 'is_name_known(id)', 'npc_known(id)', 'go_to_scene(s)', 'change_scene_state(s)',
    'game_over_death(m)', 'game_over_victory(m)',
  ]

  const declared = new Set<string>()
  for (const m of text.matchAll(/EXTERNAL\s+(\w+)/g)) {
    declared.add(m[1])
  }

  const missing: string[] = []
  for (const ext of externals) {
    const name = ext.split('(')[0]
    if (!declared.has(name) && new RegExp(`\\b${name}\\s*\\(`).test(text)) {
      missing.push(`EXTERNAL ${ext}`)
    }
  }

  // Необъявленные переменные в интерполяциях {имя}, {hero}, {player}
  const vars: string[] = []
  for (const m of text.matchAll(/\{([a-zA-Zа-яА-ЯёЁ_][a-zA-Z0-9а-яА-ЯёЁ_]*)\}/g)) {
    const v = m[1]
    if (v !== 'else' && v !== 'true' && v !== 'false' && !declared.has(v) && !text.includes(`VAR ${v}`)) {
      vars.push(`VAR ${v} = "Герой"`)
    }
  }

  const preamble = [...missing, ...new Set(vars)].join('\n')
  return preamble ? `${preamble}\n${text}` : text
}

export function createStory(source: string, cacheKey: string): Story {
  let json = jsonCache.get(cacheKey)
  if (!json) {
    const cleanSource = sanitizeInkSource(source)
    const errors: string[] = []
    try {
      const compiler = new Compiler(cleanSource, {
        errorHandler: (msg: string, type: unknown) => {
          if (type === 2 || String(type).toLowerCase().includes('error')) errors.push(msg)
        },
      } as unknown as CompilerOptions)
      const compiled = compiler.Compile()
      json = compiled.ToJson() ?? ''
    } catch (err) {
      // inkjs часто бросает голое «Compilation failed» без строк — добавим ключ
      // и подробный список ошибок компилятора, чтобы мастер видел строку и причину.
      const hint = errors.length ? errors.join('; ') : (err instanceof Error ? err.message : String(err))
      const preview = cleanSource.split('\n').slice(0, 40).join('\n')
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
  const m = source.match(/===\s*([^\s=]+)(?:\s*===)?/)
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
    // успех ставит «галочку» опыта (ТЗ 4.3). Возвращаем 1/0, а не строку
    // результата: в ink условие `{ skill_check(...): … }` со строкой было бы
    // истинным всегда — ветвление «успел/не успел» не работало (design-doc §9).
    return engine.playerSkillCheck(skill, difficulty ?? 50).success ? 1 : 0
  })
  bind('get_need', (id: string) => engine.state.player.needs[id] ?? 0)
  bind('change_need', (id: string, delta: number) => { engine.changeNeed(id, delta); return 0 })
  bind('set_flag', (f: string, ...rest: unknown[]) => {
    const val = rest[0]
    if (val === false || val === 0 || val === 'false') {
      delete engine.state.flags[f]
    } else {
      engine.state.flags[f] = (val as any) ?? true
    }
    // квесты/правила реагируют на флаг сразу (пока не начался бой/торговля),
    // иначе «квест начат» приходил бы только после боя
    if (!engine.combat && !engine.trade) engine.checkRules()
    return 0
  })
  bind('clear_flag', (f: string) => {
    delete engine.state.flags[f]
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
  // открыть изготовление из реплики («применить ключ к клапану»); пустой
  // аргумент — весь список рецептов (эффект open_craft)
  bind('open_craft', (recipeId: string) => { engine.openCraft(recipeId || undefined); return 0 })
  // дедлайн на раздумье в диалоге: `~ set_dialogue_timer(15, "node_x")`
  bind('set_dialogue_timer', (seconds: number, knot?: string) => {
    engine.setDialogueTimer(Number(seconds) || 0, knot)
    return 0
  })
  // предъявление предмета / улики из инвентаря: `~ present_item("ok_knot", "fail_knot", "item_id")`
  bind('present_item', (okKnot: string, failKnot: string, required?: string) => {
    engine.promptPresentItem(okKnot, failKnot, required)
    return 0
  })
  // воспроизведение звукового эффекта прямо из реплики или команды: `~ play_sound("snd_id", 0.8)`
  bind('play_sound', (sound: string, volume?: number) => {
    playInteraction(sound, { sound }, volume != null ? Number(volume) : 1)
    return 0
  })
  // смена облика/эмоции прямо из реплики (design-doc §9): портрет в диалоге и
  // спрайт в сцене переключаются без правила-посредника
  bind('set_entity_state', (entityId: string, state: string) => {
    engine.applyEffects([{ type: 'set_entity_state', entity: entityId, state: state ?? '' }])
    return 0
  })
  bind('set_description', (entityId: string, text: string) => { engine.setEntityDescription(entityId, text); return 0 })
  bind('join_party', (entityId: string) => { engine.joinParty(entityId); return 0 })
  bind('in_party', (entityId: string) => (engine.isInParty(entityId) ? 1 : 0))
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
  bind('learn_name', (id: string) => {
    engine.learnNpcName(id)
    return 0
  })
  bind('is_name_known', (id: string) => (engine.isNpcNameKnown(id) ? 1 : 0))
  bind('npc_known', (id: string) => (engine.isNpcNameKnown(id) ? 1 : 0))
  bind('go_to_scene', (sceneId: string) => {
    engine.goToSceneFromDialogue(sceneId, true)
    return 0
  })
  bind('start_combat', (arenaId: string) => {
    engine.startCombatFromDialogue(arenaId)
    return 0
  })
  bind('change_scene_state', (state: string) => {
    engine.changeSceneState(state)
    return 0
  })
  bind('game_over_death', (reason: string) => {
    engine.gameOver('death', reason || 'Гибель героя')
    return 0
  })
  bind('game_over_victory', (reason: string) => {
    engine.gameOver('victory', reason || 'Триумф героя')
    return 0
  })
}

/**
 * Строки-«системные литералы»: inkjs некоторых сборок печатает значение
 * выражения как строку, когда условие записано в текстовой позиции
 * (например, после квадратных скобок выбора): игрок видит «true» посреди
 * разговора (фидбек 27, п.6). Такие строки не являются репликами.
 */
const SYSTEM_LITERAL_LINE = /^(?:true|false|null|undefined|nan)$/i

/** Очистить технические префиксы говорящего и кавычки прямой речи от ИИ (например, «Ирина: «Текст»» -> «Текст») */
export function cleanDialogueLine(raw: string): string {
  let text = raw.trim()
  // 1. Префикс говорящего в кавычках: Имя: «Текст» или Имя: "Текст"
  const quotedSpeaker = text.match(/^([\p{Lu}\p{Lt}][\p{L}\p{M}\s.-]{0,35}):\s*[«"“]([\s\S]+?)[»"”]$/u)
  if (quotedSpeaker && quotedSpeaker[2].trim()) {
    return quotedSpeaker[2].trim()
  }
  // 2. Внешние парные кавычки всей строки: «Текст» / "Текст"
  const fullQuotes = text.match(/^[«"“]([\s\S]+)[»"”]$/u)
  if (fullQuotes && fullQuotes[1].trim()) {
    const inner = fullQuotes[1].trim()
    if (!inner.includes('»') && !inner.includes('"')) {
      return inner
    }
  }
  return text
}

/** Прочитать все доступные строки до выбора/конца. */
export function drainStory(story: Story): { lines: DialogueLine[]; choices: { index: number; text: string }[]; finished: boolean } {
  const lines: DialogueLine[] = []
  while (story.canContinue) {
    const rawText = (story.Continue() ?? '').trim()
    const text = cleanDialogueLine(rawText)
    const tags = story.currentTags ?? []
    const { emotion, action, voice, sfx, timer } = parseLineTags(tags)
    if (text && !SYSTEM_LITERAL_LINE.test(text)) lines.push({ text, emotion, action, voice, sfx, timer })
  }
  const choices = story.currentChoices.map((c, i) => ({ index: i, text: c.text }))
  return { lines, choices, finished: choices.length === 0 && !story.canContinue }
}


