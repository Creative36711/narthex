/**
 * Визуальный формат диалога (фидбек №20): мастер редактирует узлы и ответы
 * формами, а редактор генерирует из них .ink для движка.
 * Исходник хранится рядом: dialogues/<имя>.dlg.json (движок его не читает).
 */

export type DlgEmotion = 'neutral' | 'happy' | 'angry'

export interface DlgLine {
  text: string
  emotion?: DlgEmotion
  /** авторская ремарка (курсивом, не влияет на портрет) */
  action?: boolean
}

export type DlgEffect =
  | { type: 'set_flag'; flag: string }
  | { type: 'add_item'; item: string; qty: number }
  | { type: 'remove_item'; item: string; qty: number }
  | { type: 'fire_rule'; rule: string }
  | { type: 'join_party'; npc: string }
  | { type: 'open_trade'; npc: string }
  | { type: 'start_quest'; quest: string }
  | { type: 'advance_time'; ticks: number }

export interface DlgChoice {
  text: string
  /** показывать только если флаг установлен */
  if_flag?: string
  /** показывать только если флаг НЕ установлен */
  if_not_flag?: string
  /** одноразовый в рамках одного разговора (в новом разговоре вернётся) */
  once?: boolean
  /** ответ НПС на этот вариант */
  lines: DlgLine[]
  effects: DlgEffect[]
  /** куда дальше: id узла, 'stay' (те же варианты) или 'end' (конец разговора) */
  goto: string
}

export interface DlgNode {
  id: string
  label: string
  lines: DlgLine[]
  choices: DlgChoice[]
}

export interface DlgDoc {
  version: 1
  nodes: DlgNode[] // nodes[0] — начало разговора (knot main)
}

export function newDlgDoc(): DlgDoc {
  return {
    version: 1,
    nodes: [
      {
        id: 'main',
        label: 'Начало разговора',
        lines: [{ text: 'Привет, путник.' }],
        choices: [{ text: 'До встречи.', lines: [], effects: [], goto: 'end' }],
      },
    ],
  }
}

const EXTERNALS = `EXTERNAL get_flag(f)
EXTERNAL set_flag(f)
EXTERNAL add_item(id, n)
EXTERNAL remove_item(id, n)
EXTERNAL fire_rule(id)
EXTERNAL join_party(id)
EXTERNAL open_trade(id)
EXTERNAL start_quest(q)
EXTERNAL advance_time(t)
`

/** одна реплика → строка ink с тегами */
function inkLine(l: DlgLine, indent: string): string {
  const text = l.text.replace(/\s+/g, ' ').trim()
  const tags: string[] = []
  if (l.emotion && l.emotion !== 'neutral') tags.push(`# emotion: ${l.emotion}`)
  if (l.action) tags.push('# action')
  return `${indent}${text}${tags.length ? ' ' + tags.join(' ') : ''}`
}

function inkEffect(e: DlgEffect, indent: string): string {
  switch (e.type) {
    case 'set_flag': return `${indent}~ set_flag("${e.flag}")`
    case 'add_item': return `${indent}~ add_item("${e.item}", ${e.qty})`
    case 'remove_item': return `${indent}~ remove_item("${e.item}", ${e.qty})`
    case 'fire_rule': return `${indent}~ fire_rule("${e.rule}")`
    case 'join_party': return `${indent}~ join_party("${e.npc}")`
    case 'open_trade': return `${indent}~ open_trade("${e.npc}")`
    case 'start_quest': return `${indent}~ start_quest("${e.quest}")`
    case 'advance_time': return `${indent}~ advance_time(${e.ticks})`
  }
}

/** генерация .ink из документа (hub-паттерн: реплики не перепечатываются) */
export function generateInk(doc: DlgDoc): string {
  const out: string[] = [EXTERNALS]
  for (const node of doc.nodes) {
    out.push(`=== ${node.id} ===`)
    for (const l of node.lines) out.push(inkLine(l, ''))
    if (node.choices.length === 0) {
      out.push('-> DONE', '')
      continue
    }
    out.push(`-> ${node.id}_hub`, '', `=== ${node.id}_hub ===`)
    // защита от зависания: должен существовать всегда доступный вариант
    const hasAlways = node.choices.some((c) => !c.once && !c.if_flag && !c.if_not_flag)
    for (const c of node.choices) {
      const conds: string[] = []
      if (c.if_flag) conds.push(`get_flag("${c.if_flag}")`)
      if (c.if_not_flag) conds.push(`not get_flag("${c.if_not_flag}")`)
      const condStr = conds.length ? `{ ${conds.join(' && ')} } ` : ''
      const marker = c.once ? '*' : '+'
      out.push(`${marker} ${condStr}[${c.text.replace(/\s+/g, ' ').trim()}]`)
      for (const e of c.effects) out.push(inkEffect(e, '    '))
      for (const l of c.lines) out.push(inkLine(l, '    '))
      // open_trade / fire_rule сами закрывают диалог — после них всегда конец
      const forcedEnd = c.effects.some((e) => e.type === 'open_trade' || e.type === 'fire_rule')
      if (forcedEnd || c.goto === 'end') out.push('    -> DONE')
      else if (c.goto === 'stay' || c.goto === node.id) out.push(`    -> ${node.id}_hub`)
      else out.push(`    -> ${c.goto}`)
    }
    if (!hasAlways) out.push('+ [Закончить разговор.]', '    -> DONE')
    out.push(`- -> ${node.id}_hub`, '')
  }
  return out.join('\n')
}
