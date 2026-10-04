/**
 * Визуальный формат диалога: мастер редактирует узлы, реплики, условия и
 * проверки формами, а редактор генерирует из них .ink для движка.
 * Исходник хранится рядом: dialogues/<имя>.dlg.json (движок его не читает).
 *
 * v2 (фидбек №12 четвёртого раунда): условия (флаги, предметы, отношение,
 * квесты, отряд, здоровье), проверки навыков с ветками успех/провал,
 * условные блоки реплик, название диалога.
 *
 * v2 + токены (итерация 8, блок B): в тексте реплики вместо ink-выражений
 * вида {item_count("item_silver")} мастер вставляет кнопкой человекочитаемые
 * токены: {счёт:item_silver}, {здоровье}, {потребность:warmth},
 * {навык:persuade}. generateInk() переводит их в ink-выражения; старые
 * тексты с «сырым» ink мигрируются на токены при открытии (inkToTokens).
 */

// ─────────────── токены значений в тексте реплик ───────────────

export type TokenKind = 'name' | 'count' | 'hp' | 'hp_max' | 'mp' | 'mp_max' | 'luck' | 'level' | 'xp' | 'day' | 'stat' | 'skill' | 'need' | 'currency'

export const TOKEN_KINDS: Array<{ id: TokenKind; label: string; hint: string }> = [
  { id: 'name', label: 'Имя героя', hint: 'обращение к герою по имени из характеристики' },
  { id: 'count', label: 'Количество предмета', hint: 'сколько штук предмета у героя' },
  { id: 'hp', label: 'Здоровье', hint: 'текущее здоровье героя' },
  { id: 'hp_max', label: 'Здоровье (макс.)', hint: 'максимум здоровья героя' },
  { id: 'mp', label: 'Мана', hint: 'текущая мана героя' },
  { id: 'mp_max', label: 'Мана (макс.)', hint: 'максимум маны героя' },
  { id: 'luck', label: 'Очки удачи', hint: 'текущие очки удачи' },
  { id: 'level', label: 'Уровень', hint: 'уровень героя (статистика)' },
  { id: 'xp', label: 'Опыт', hint: 'очки опыта героя' },
  { id: 'day', label: 'День забега', hint: 'номер дня с начала забега' },
  { id: 'stat', label: 'Характеристика', hint: 'СИЛ, ВЫН, ЛОВК и прочие' },
  { id: 'skill', label: 'Навык', hint: 'текущее значение навыка' },
  { id: 'need', label: 'Потребность', hint: 'текущее значение потребности (голод, жажда…)' },
  { id: 'currency', label: 'Валюта', hint: 'сколько монет/пепла у героя' },
]

const TOKEN_WORD: Record<TokenKind, string> = {
  name: 'имя',
  count: 'счёт',
  hp: 'здоровье',
  hp_max: 'здоровье_макс',
  mp: 'мана',
  mp_max: 'мана_макс',
  luck: 'удача',
  level: 'уровень',
  xp: 'опыт',
  day: 'день',
  stat: 'стат',
  skill: 'навык',
  need: 'потребность',
  currency: 'валюта',
}

export interface TextPart {
  text: string
  /** токен (если часть — подставляемое значение) */
  token?: { kind: TokenKind; id: string }
}

export function tokenString(kind: TokenKind, id?: string): string {
  return id ? `{${TOKEN_WORD[kind]}:${id}}` : `{${TOKEN_WORD[kind]}}`
}

const TOKEN_RE = /\{\s*(имя|герой|счёт|счет|здоровье_макс|здоровье|мана_макс|мана|удача|уровень|опыт|день|стат|потребность|валюта|навык)\s*(?::\s*([^}]*?))?\s*\}/gi

function kindByWord(word: string): TokenKind {
  const w = word.toLowerCase().replace('ё', 'е')
  switch (w) {
    case 'имя': case 'герой': return 'name'
    case 'счет': return 'count'
    case 'здоровье': return 'hp'
    case 'здоровье_макс': return 'hp_max'
    case 'мана': return 'mp'
    case 'мана_макс': return 'mp_max'
    case 'удача': return 'luck'
    case 'уровень': return 'level'
    case 'опыт': return 'xp'
    case 'день': return 'day'
    case 'стат': return 'stat'
    case 'потребность': return 'need'
    case 'валюта': return 'currency'
    default: return 'skill'
  }
}

/** разобрать текст реплики на обычные куски и токены (для предпросмотра) */
export function parseTokens(text: string): TextPart[] {
  const out: TextPart[] = []
  let last = 0
  for (const m of text.matchAll(TOKEN_RE)) {
    const at = m.index ?? 0
    if (at > last) out.push({ text: text.slice(last, at) })
    out.push({ text: m[0], token: { kind: kindByWord(m[1]), id: (m[2] ?? '').trim() } })
    last = at + m[0].length
  }
  if (last < text.length) out.push({ text: text.slice(last) })
  return out
}

/** токены → ink-выражения (то, что понимает движок) */
export function tokensToInk(text: string): string {
  return text.replace(TOKEN_RE, (_m, word: string, id?: string) => {
    const kind = kindByWord(word)
    const key = (id ?? '').trim()
    switch (kind) {
      case 'name': return `{get_player_name()}`
      case 'count': return `{item_count("${key}")}`
      case 'hp': return `{get_hp()}`
      case 'hp_max': return `{get_hp_max()}`
      case 'mp': return `{get_mp()}`
      case 'mp_max': return `{get_mp_max()}`
      case 'luck': return `{get_luck()}`
      case 'level': return `{get_level()}`
      case 'xp': return `{get_xp()}`
      case 'day': return `{get_run_day()}`
      case 'stat': return `{get_stat("${key}")}`
      case 'need': return `{get_need("${key}")}`
      case 'skill': return `{get_skill("${key}")}`
      case 'currency': return `{get_currency("${key}")}`
    }
  })
}

/** старые «сырые» ink-выражения в тексте → токены (мягкая миграция) */
export function inkToTokens(text: string): string {
  return text
    .replace(/\{\s*get_player_name\(\s*\)\s*\}/gi, () => tokenString('name'))
    .replace(/\{\s*item_count\(\s*["']([^"']+)["']\s*\)\s*\}/gi, (_m, id: string) => tokenString('count', id))
    .replace(/\{\s*get_hp_max\(\s*\)\s*\}/gi, () => tokenString('hp_max'))
    .replace(/\{\s*get_hp\(\s*\)\s*\}/gi, () => tokenString('hp'))
    .replace(/\{\s*get_mp_max\(\s*\)\s*\}/gi, () => tokenString('mp_max'))
    .replace(/\{\s*get_mp\(\s*\)\s*\}/gi, () => tokenString('mp'))
    .replace(/\{\s*get_luck\(\s*\)\s*\}/gi, () => tokenString('luck'))
    .replace(/\{\s*get_level\(\s*\)\s*\}/gi, () => tokenString('level'))
    .replace(/\{\s*get_xp\(\s*\)\s*\}/gi, () => tokenString('xp'))
    .replace(/\{\s*get_run_day\(\s*\)\s*\}/gi, () => tokenString('day'))
    .replace(/\{\s*get_stat\(\s*["']([^"']+)["']\s*\)\s*\}/gi, (_m, id: string) => tokenString('stat', id))
    .replace(/\{\s*get_need\(\s*["']([^"']+)["']\s*\)\s*\}/gi, (_m, id: string) => tokenString('need', id))
    .replace(/\{\s*get_skill\(\s*["']([^"']+)["']\s*\)\s*\}/gi, (_m, id: string) => tokenString('skill', id))
    .replace(/\{\s*get_currency\(\s*["']([^"']+)["']\s*\)\s*\}/gi, (_m, id: string) => tokenString('currency', id))
}

// Типы формата .dlg.json живут в shared/types.ts (единый источник правды —
// они же входят в монолитный JSON кампании, итерация 8, блок F).
// Реэкспорт — чтобы существующие импорты из dialogueDoc не ломались.
export type {
  DlgEmotion,
  DlgLine,
  DlgCond,
  DlgEffect,
  DlgStep,
  DlgSection,
  DlgCheck,
  DlgChoice,
  DlgNode,
  DlgDoc,
} from '../shared/types'
import type { DlgCond, DlgDoc, DlgEffect, DlgLine, DlgSection, DlgStep } from '../shared/types'
import { dlgDocFromScript, type ScriptRefs } from './dlgScript'

export function newDlgDoc(label?: string): DlgDoc {
  return {
    version: 2,
    label,
    nodes: [
      {
        id: 'main',
        label: 'Начало разговора',
        sections: [{ steps: [{ kind: 'line', line: { text: 'Привет, путник.' } }] }],
        choices: [{ text: 'До встречи.', sections: [], goto: 'end' }],
      },
    ],
  }
}

// ─────────────── миграция старого формата (v1) ───────────────

interface DlgChoiceV1 {
  text: string
  if_flag?: string
  if_not_flag?: string
  once?: boolean
  lines: DlgLine[]
  effects: DlgEffect[]
  goto: string
}
interface DlgNodeV1 {
  id: string
  label: string
  lines: DlgLine[]
  choices: DlgChoiceV1[]
}

/** привести документ любой версии к v2 (v1 мигрируется на лету) */
function migrateLineTexts(doc: DlgDoc): DlgDoc {
  const fixLine = (l: DlgLine) => {
    if (l.text) l.text = inkToTokens(l.text)
  }
  // v2: тексты могли содержать «сырой» ink (item_count(...) и т.п.) — переводим в токены
  const fixSections = (sections: DlgSection[]) => {
    for (const sec of sections) {
      for (const st of sec.steps) if (st.kind === 'line') fixLine(st.line)
      for (const st of sec.else_steps ?? []) if (st.kind === 'line') fixLine(st.line)
    }
  }
  for (const node of doc.nodes) {
    fixSections(node.sections)
    for (const c of node.choices) {
      c.text = inkToTokens(c.text ?? '')
      fixSections(c.sections)
      if (c.check) {
        fixSections(c.check.success.sections)
        fixSections(c.check.fail.sections)
      }
    }
  }
  return doc
}

/**
 * Привести документ любой версии к v2.
 *
 * Если структуры нет, а текст мастерского сценария есть (`script` — так пишет
 * ИИ и так сохраняет редактор), структура собирается из текста: нужны реестры
 * кампании (`refs`, см. `refsFromMonolith`). Без реестров документ остаётся
 * как есть — редактор разберёт его сам и покажет ошибки строками.
 */
export function migrateDlgDoc(raw: unknown, refs?: ScriptRefs): DlgDoc {
  const doc = raw as { version: number; label?: string; nodes?: unknown[]; script?: string }
  const out = doc.version === 2 ? (doc as unknown as DlgDoc) : migrateV1(doc as { version: number; label?: string; nodes: DlgNodeV1[] })
  out.nodes ??= []
  if (out.script && !out.nodes.length && refs) dlgDocFromScript(out, refs)
  return migrateLineTexts(out)
}

/** старый формат (v1): строки+эффекты вместо секций */
function migrateV1(doc: { version: number; label?: string; nodes: DlgNodeV1[] }): DlgDoc {
  const v1nodes = doc.nodes
  const migrated: DlgDoc = {
    version: 2,
    label: doc.label,
    nodes: v1nodes.map((n) => ({
      id: n.id,
      label: n.label,
      sections: n.lines.length ? [{ steps: n.lines.map((l) => ({ kind: 'line', line: l }) as DlgStep) }] : [],
      choices: n.choices.map((c) => {
        const conds: DlgCond[] = []
        if (c.if_flag) conds.push({ type: 'flag', flag: c.if_flag })
        if (c.if_not_flag) conds.push({ type: 'flag', flag: c.if_not_flag, not: true })
        const steps: DlgStep[] = [
          ...c.effects.map((e) => ({ kind: 'effect', effect: e }) as DlgStep),
          ...c.lines.map((l) => ({ kind: 'line', line: l }) as DlgStep),
        ]
        return {
          text: c.text,
          conds: conds.length ? conds : undefined,
          once: c.once,
          sections: steps.length ? [{ steps }] : [],
          goto: c.goto,
        }
      }),
    })),
  }
  return migrated
}

// ─────────────── генерация ink ───────────────

function q(s: string): string {
  return `"${s.replace(/"/g, '\\"')}"`
}

export function condInk(c: DlgCond): string {
  switch (c.type) {
    case 'flag':
      return c.not ? `not get_flag(${q(c.flag)})` : `get_flag(${q(c.flag)})`
    case 'item_ge':
      return c.not ? `item_count(${q(c.item)}) < ${c.count}` : `item_count(${q(c.item)}) >= ${c.count}`
    case 'has_item':
      return c.not ? `not has_item(${q(c.item)})` : `has_item(${q(c.item)})`
    case 'disp_ge':
      return c.not ? `get_disposition(${q(c.target)}) < ${c.value}` : `get_disposition(${q(c.target)}) >= ${c.value}`
    case 'quest':
      return `quest_stage(${q(c.quest)}) ${c.not ? '!=' : '=='} ${q(c.stage)}`
    case 'in_party':
      return c.not ? `not in_party(${q(c.npc)})` : `in_party(${q(c.npc)})`
    case 'hp_ge':
      return c.not ? `get_hp() < ${c.value}` : `get_hp() >= ${c.value}`
    case 'has_status':
      return c.not ? `not has_status(${q(c.status)})` : `has_status(${q(c.status)})`
    case 'weather_is':
      return c.not ? `not weather_is(${q(c.weather)})` : `weather_is(${q(c.weather)})`
    case 'skill_ge':
      return c.not ? `get_skill(${q(c.skill)}) < ${c.threshold}` : `get_skill(${q(c.skill)}) >= ${c.threshold}`
    case 'meta_counter':
      return c.not ? `get_meta_counter(${q(c.key)}) < ${c.ge}` : `get_meta_counter(${q(c.key)}) >= ${c.ge}`
  }
}

function condsInk(conds: DlgCond[]): string {
  return conds.map(condInk).join(' && ')
}

/** одна реплика → строка ink с тегами (токены превращаются в ink-выражения) */
function inkLine(l: DlgLine, indent: string): string {
  const text = tokensToInk(l.text).replace(/\s+/g, ' ').trim()
  const tags: string[] = []
  if (l.emotion && l.emotion !== 'neutral') tags.push(`# emotion: ${l.emotion}`)
  if (l.action) tags.push('# action')
  if (l.voice) tags.push(`# voice: ${l.voice}`)
  return `${indent}${text}${tags.length ? ' ' + tags.join(' ') : ''}`
}

function inkEffect(e: DlgEffect, indent: string): string {
  switch (e.type) {
    case 'set_flag': return `${indent}~ set_flag(${q(e.flag)})`
    case 'add_item': return `${indent}~ add_item(${q(e.item)}, ${e.qty})`
    case 'remove_item': return `${indent}~ remove_item(${q(e.item)}, ${e.qty})`
    case 'fire_rule': return `${indent}~ fire_rule(${q(e.rule)})`
    case 'join_party': return `${indent}~ join_party(${q(e.npc)})`
    case 'open_trade': return `${indent}~ open_trade(${q(e.npc)})`
    case 'start_quest': return `${indent}~ start_quest(${q(e.quest)})`
    case 'advance_time': return `${indent}~ advance_time(${e.ticks})`
    case 'change_need': return `${indent}~ change_need(${q(e.need)}, ${e.delta})`
    case 'change_hp': return `${indent}~ change_hp(${e.delta})`
    case 'sleep': return `${indent}~ sleep(${e.ticks})`
    case 'change_disposition': return `${indent}~ change_disposition(${q(e.target)}, ${e.delta})`
    case 'play_cutscene': return `${indent}~ play_cutscene(${q(e.cutscene)})`
    case 'set_description': return `${indent}~ set_description(${q(e.entity)}, ${q(e.text)})`
    case 'apply_status': return `${indent}~ apply_status(${q(e.status)}, ${e.duration ?? 0})`
    case 'remove_status': return `${indent}~ remove_status(${q(e.status)})`
    case 'set_weather': return `${indent}~ set_weather(${q(e.weather)})`
    case 'unlock_codex': return `${indent}~ unlock_codex(${q(e.entry)})`
    case 'unlock_recipe': return `${indent}~ unlock_recipe(${q(e.recipe)})`
    case 'open_craft': return e.recipe ? `${indent}~ open_craft(${q(e.recipe)})` : `${indent}~ open_craft()`
    case 'set_entity_state': return `${indent}~ set_entity_state(${q(e.entity)}, ${q(e.state)})`
  }
}

/** open_trade / open_craft / fire_rule сами закрывают диалог — после них всегда конец */
function isTerminalEffect(e: DlgEffect): boolean {
  return e.type === 'open_trade' || e.type === 'open_craft' || e.type === 'fire_rule'
}

export function generateInk(docRaw: DlgDoc): string {
  const doc = migrateDlgDoc(docRaw)
  const out: string[] = []

  const target = (nodeId: string, g: string | undefined, fallback: string): string => {
    const t = g || fallback
    if (t === 'end') return 'DONE'
    if (t === 'stay' || t === nodeId) return `${nodeId}_hub`
    return t
  }

  /** шаги; возвращает true, если поток завершён (терминальный эффект) */
  const emitSteps = (steps: DlgStep[], indent: string): boolean => {
    for (const st of steps) {
      if (st.kind === 'line') out.push(inkLine(st.line, indent))
      else {
        out.push(inkEffect(st.effect, indent))
        if (isTerminalEffect(st.effect)) {
          out.push(`${indent}-> DONE`)
          return true
        }
      }
    }
    return false
  }

  const emitSections = (nodeId: string, sections: DlgSection[], indent: string): void => {
    for (const sec of sections) {
      if (sec.conds && sec.conds.length > 0) {
        out.push(`${indent}{ ${condsInk(sec.conds)}:`)
        const done = emitSteps(sec.steps, indent + '    ')
        if (!done && sec.goto) out.push(`${indent}    -> ${target(nodeId, sec.goto, sec.goto)}`)
        if ((sec.else_steps && sec.else_steps.length > 0) || sec.else_goto) {
          out.push(`${indent}- else:`)
          const edone = emitSteps(sec.else_steps ?? [], indent + '    ')
          if (!edone && sec.else_goto) out.push(`${indent}    -> ${target(nodeId, sec.else_goto, sec.else_goto)}`)
        }
        out.push(`${indent}}`)
      } else {
        const done = emitSteps(sec.steps, indent)
        if (!done && sec.goto) out.push(`${indent}-> ${target(nodeId, sec.goto, sec.goto)}`)
      }
    }
  }

  for (const node of doc.nodes) {
    out.push(`=== ${node.id} ===`)
    emitSections(node.id, node.sections, '')
    if (node.choices.length === 0) {
      out.push(`-> ${target(node.id, node.goto, 'end')}`, '')
      continue
    }
    out.push(`-> ${node.id}_hub`, '', `=== ${node.id}_hub ===`)
    // дедлайн на раздумье: сколько секунд игрок выбирает ответ и куда уйти,
    // если промолчал; 0/пусто — без таймера (фидбек 27, §9)
    const secs = node.timer?.seconds ?? 0
    if (secs > 0) {
      // второй аргумент обязателен: inkjs сверяет число аргументов с EXTERNAL,
      // пустая строка означает «по истечении разговор заканчивается»
      const knot = node.timer?.node && node.timer.node !== 'end' ? q(node.timer.node) : '""'
      out.push(`~ set_dialogue_timer(${Math.max(1, Math.round(secs))}, ${knot})`)
    }
    // защита от зависания: должен существовать всегда доступный вариант
    const hasAlways = node.choices.some((c) => !c.once && (!c.conds || c.conds.length === 0))
    for (const c of node.choices) {
      const condStr = c.conds && c.conds.length > 0 ? `{ ${condsInk(c.conds)} } ` : ''
      const marker = c.once ? '*' : '+'
      out.push(`${marker} ${condStr}[${c.text.replace(/\s+/g, ' ').trim()}]`)
      emitSections(node.id, c.sections, '    ')
      if (c.check) {
        out.push(`    ~ temp d = ${c.check.difficulty}`)
        for (const m of c.check.mods ?? []) {
          out.push(`    { ${condsInk(m.conds)}:`, `        ~ d = ${m.value}`, '    }')
        }
        out.push(`    ~ temp r = skill_check(${q(c.check.skill)}, d)`)
        out.push('    { r == "fail" || r == "fumble":')
        emitSections(node.id, c.check.fail.sections, '        ')
        out.push(`        -> ${target(node.id, c.check.fail.goto, 'stay')}`)
        out.push('    - else:')
        emitSections(node.id, c.check.success.sections, '        ')
        out.push(`        -> ${target(node.id, c.check.success.goto, 'stay')}`)
        out.push('    }')
      } else {
        out.push(`    -> ${target(node.id, c.goto, 'stay')}`)
      }
    }
    if (!hasAlways) out.push('+ [Закончить разговор.]', '    -> DONE')
    out.push(`- -> ${node.id}_hub`, '')
  }

  const body = out.join('\n')

  // EXTERNAL-декларации — только для использованных функций.
  // Список должен покрывать ВСЕ вызовы из inkEffect() и токенов реплик,
  // иначе inkjs падает с «Compilation failed» на валидном диалоге
  // (unlock_recipe / unlock_codex / apply_status / set_weather / …).
  const FNS = [
    'get_flag', 'set_flag', 'add_item', 'remove_item', 'item_count', 'has_item',
    'skill_check', 'get_disposition', 'change_disposition', 'in_party', 'join_party',
    'open_trade', 'fire_rule', 'start_quest', 'quest_stage', 'advance_time',
    'change_need', 'change_hp', 'get_hp', 'sleep', 'get_need', 'get_stat', 'get_skill',
    'play_cutscene',
    // DlgEffect, добавленные позже блоков статусов/погоды/кодекса/рецептов
    'set_description', 'apply_status', 'remove_status', 'set_weather',
    'unlock_codex', 'unlock_recipe', 'open_craft', 'set_dialogue_timer',
    // токены реплик ({имя}, {здоровье_макс}, …) — без EXTERNAL inkjs не компилирует
    'get_player_name', 'get_hp_max', 'get_mp', 'get_mp_max', 'get_luck',
    'get_level', 'get_xp', 'get_run_day', 'get_currency',
  ]
  const SIG: Record<string, string> = {
    get_flag: '(f)', set_flag: '(f)', add_item: '(id, n)', remove_item: '(id, n)',
    item_count: '(id)', has_item: '(id)', skill_check: '(s, d)', get_disposition: '(t)',
    change_disposition: '(t, d)', in_party: '(id)', join_party: '(id)', open_trade: '(id)',
    fire_rule: '(id)', start_quest: '(q)', quest_stage: '(q)', advance_time: '(t)',
    change_need: '(id, d)', change_hp: '(d)', get_hp: '()', sleep: '(t)',
    get_need: '(id)', get_stat: '(s)', get_skill: '(s)',
    play_cutscene: '(id)',
    set_description: '(id, t)', apply_status: '(id, d)', remove_status: '(id)',
    set_weather: '(id)', unlock_codex: '(id)', unlock_recipe: '(id)', open_craft: '(id)',
    set_dialogue_timer: '(s, t)',
    get_player_name: '()', get_hp_max: '()', get_mp: '()', get_mp_max: '()',
    get_luck: '()', get_level: '()', get_xp: '()', get_run_day: '()', get_currency: '(id)',
  }
  const externals = FNS.filter((f) => body.includes(`${f}(`)).map((f) => `EXTERNAL ${f}${SIG[f]}`)
  return `${externals.join('\n')}\n\n${body}`
}
