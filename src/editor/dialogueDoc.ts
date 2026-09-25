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

export type TokenKind = 'count' | 'hp' | 'need' | 'skill'

export const TOKEN_KINDS: Array<{ id: TokenKind; label: string; hint: string }> = [
  { id: 'count', label: 'Количество предмета', hint: 'сколько штук предмета у героя' },
  { id: 'hp', label: 'Здоровье', hint: 'текущее здоровье героя' },
  { id: 'need', label: 'Потребность', hint: 'текущее значение потребности' },
  { id: 'skill', label: 'Навык', hint: 'текущее значение навыка' },
]

const TOKEN_WORD: Record<TokenKind, string> = {
  count: 'счёт',
  hp: 'здоровье',
  need: 'потребность',
  skill: 'навык',
}

export interface TextPart {
  text: string
  /** токен (если часть — подставляемое значение) */
  token?: { kind: TokenKind; id: string }
}

export function tokenString(kind: TokenKind, id?: string): string {
  return id ? `{${TOKEN_WORD[kind]}:${id}}` : `{${TOKEN_WORD[kind]}}`
}

const TOKEN_RE = /\{\s*(счёт|счет|здоровье|потребность|навык)\s*(?::\s*([^}]*?))?\s*\}/gi

function kindByWord(word: string): TokenKind {
  const w = word.toLowerCase().replace('ё', 'е')
  if (w === 'счет') return 'count'
  if (w === 'здоровье') return 'hp'
  if (w === 'потребность') return 'need'
  return 'skill'
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
      case 'count': return `{item_count("${key}")}`
      case 'hp': return `{get_hp()}`
      case 'need': return `{get_need("${key}")}`
      case 'skill': return `{get_skill("${key}")}`
    }
  })
}

/** старые «сырые» ink-выражения в тексте → токены (мягкая миграция) */
export function inkToTokens(text: string): string {
  return text
    .replace(/\{\s*item_count\(\s*["']([^"']+)["']\s*\)\s*\}/gi, (_m, id: string) => tokenString('count', id))
    .replace(/\{\s*get_hp\(\s*\)\s*\}/gi, () => tokenString('hp'))
    .replace(/\{\s*get_need\(\s*["']([^"']+)["']\s*\)\s*\}/gi, (_m, id: string) => tokenString('need', id))
    .replace(/\{\s*get_skill\(\s*["']([^"']+)["']\s*\)\s*\}/gi, (_m, id: string) => tokenString('skill', id))
}

/** настроение (состояние портрета): базовые + свои состояния из формы NPC */
export type DlgEmotion = string

export interface DlgLine {
  text: string
  emotion?: DlgEmotion
  /** авторская ремарка (курсивом, не влияет на портрет) */
  action?: boolean
}

/** условие показа/ветвления (все условия списка должны выполниться) */
export type DlgCond =
  | { type: 'flag'; flag: string; not?: boolean }
  | { type: 'item_ge'; item: string; count: number; not?: boolean } // предметов ≥ n (not: < n)
  | { type: 'has_item'; item: string; not?: boolean }
  | { type: 'disp_ge'; target: string; value: number; not?: boolean } // отношение ≥ (not: <)
  | { type: 'quest'; quest: string; stage: string; not?: boolean } // квест на стадии ('' = не начат)
  | { type: 'in_party'; npc: string; not?: boolean }
  | { type: 'hp_ge'; value: number; not?: boolean } // здоровье ≥ (not: <)

export type DlgEffect =
  | { type: 'set_flag'; flag: string }
  | { type: 'add_item'; item: string; qty: number }
  | { type: 'remove_item'; item: string; qty: number }
  | { type: 'fire_rule'; rule: string }
  | { type: 'join_party'; npc: string }
  | { type: 'open_trade'; npc: string }
  | { type: 'start_quest'; quest: string }
  | { type: 'advance_time'; ticks: number }
  | { type: 'change_need'; need: string; delta: number }
  | { type: 'change_hp'; delta: number }
  | { type: 'sleep'; ticks: number }
  | { type: 'change_disposition'; target: string; delta: number }
  | { type: 'play_cutscene'; cutscene: string }

/** шаг: реплика или игровое действие (порядок важен) */
export type DlgStep =
  | { kind: 'line'; line: DlgLine }
  | { kind: 'effect'; effect: DlgEffect }

/**
 * Блок шагов с необязательным условием. Если условие есть — можно задать
 * ветку «иначе». goto ('' — продолжить, 'end', 'stay', id узла) уводит
 * разговор из середины блока.
 */
export interface DlgSection {
  conds?: DlgCond[]
  steps: DlgStep[]
  goto?: string
  else_steps?: DlgStep[]
  else_goto?: string
}

/** проверка навыка с ветками успеха и провала */
export interface DlgCheck {
  skill: string
  difficulty: number
  /** изменённая сложность при условиях (например «легче, если пришли с тыла») */
  mods?: Array<{ conds: DlgCond[]; value: number }>
  success: { sections: DlgSection[]; goto: string }
  fail: { sections: DlgSection[]; goto: string }
}

export interface DlgChoice {
  text: string
  /** показывать вариант только при условиях */
  conds?: DlgCond[]
  /** одноразовый в рамках одного разговора (в новом разговоре вернётся) */
  once?: boolean
  /** ответ НПС (блоки с условиями) */
  sections: DlgSection[]
  /** проверка навыка после ответа (ветки успех/провал) */
  check?: DlgCheck
  /** куда дальше: id узла, 'stay' (те же варианты) или 'end' (конец разговора) */
  goto: string
}

export interface DlgNode {
  id: string
  label: string
  sections: DlgSection[]
  choices: DlgChoice[]
  /** узел без вариантов: куда перейти после реплик ('end' по умолчанию) */
  goto?: string
}

export interface DlgDoc {
  version: 2
  /** название диалога для мастера (в списках вместо имени файла) */
  label?: string
  nodes: DlgNode[] // nodes[0] — начало разговора (knot main)
}

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

export function migrateDlgDoc(raw: unknown): DlgDoc {
  const doc = raw as { version: number; label?: string; nodes: unknown[] }
  // v2: тексты могли содержать «сырой» ink (item_count(...) и т.п.) — переводим в токены
  if (doc.version === 2) return migrateLineTexts(doc as DlgDoc)
  const v1nodes = doc.nodes as DlgNodeV1[]
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
  return migrateLineTexts(migrated)
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
  }
}

/** open_trade / fire_rule сами закрывают диалог — после них всегда конец */
function isTerminalEffect(e: DlgEffect): boolean {
  return e.type === 'open_trade' || e.type === 'fire_rule'
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

  // EXTERNAL-декларации — только для использованных функций
  const FNS = [
    'get_flag', 'set_flag', 'add_item', 'remove_item', 'item_count', 'has_item',
    'skill_check', 'get_disposition', 'change_disposition', 'in_party', 'join_party',
    'open_trade', 'fire_rule', 'start_quest', 'quest_stage', 'advance_time',
    'change_need', 'change_hp', 'get_hp', 'sleep', 'get_need', 'get_stat', 'get_skill',
    'play_cutscene',
  ]
  const SIG: Record<string, string> = {
    get_flag: '(f)', set_flag: '(f)', add_item: '(id, n)', remove_item: '(id, n)',
    item_count: '(id)', has_item: '(id)', skill_check: '(s, d)', get_disposition: '(t)',
    change_disposition: '(t, d)', in_party: '(id)', join_party: '(id)', open_trade: '(id)',
    fire_rule: '(id)', start_quest: '(q)', quest_stage: '(q)', advance_time: '(t)',
    change_need: '(id, d)', change_hp: '(d)', get_hp: '()', sleep: '(t)',
    get_need: '(id)', get_stat: '(s)', get_skill: '(s)',
    play_cutscene: '(id)',
  }
  const externals = FNS.filter((f) => body.includes(`${f}(`)).map((f) => `EXTERNAL ${f}${SIG[f]}`)
  return `${externals.join('\n')}\n\n${body}`
}
