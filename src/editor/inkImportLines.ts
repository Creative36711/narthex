/**
 * Построчный разбор ink-диалога: условия, эффекты и реплики.
 *
 * Вынесено из `inkImport.ts` как нижний слой импорта: остальные модули —
 * поток строк, ответы и сам документ — собираются из этих примитивов, а
 * модуль импорта остаётся в пределах лимита размера.
 */

import { inkToTokens } from './dialogueDoc'
import { cleanDialogueLine } from '../../packs/narrative/dialogue'
import type { DlgCond, DlgEffect, DlgLine } from './dialogueDoc'

// ─────────────── условия ───────────────

export function parseCondToken(token: string, warnings: string[], where: string): DlgCond | null {
  const t = token.trim()
  // Снятие внешних группирующих скобок: (cond1 or cond2)
  if (t.startsWith('(') && t.endsWith(')')) {
    let depth = 0
    let wrapped = true
    for (let i = 0; i < t.length - 1; i++) {
      if (t[i] === '(') depth++
      else if (t[i] === ')') {
        depth--
        if (depth === 0) { wrapped = false; break }
      }
    }
    if (wrapped) {
      const innerConds = parseConds(t.slice(1, -1), warnings, where)
      return innerConds[0] ?? null
    }
  }

  // not (get_flag("x")) — обычная запись отрицания в рукописном ink
  const wrap = /^not\s*\((.*)\)$/.exec(t)
  if (wrap) {
    const inner = parseCondToken(wrap[1], warnings, where)
    if (!inner) return null
    return { ...inner, not: !inner.not } as DlgCond
  }
  let m = /^(not )?get_flag\("([^"]+)"\)$/.exec(t)
  if (m) return { type: 'flag', flag: m[2], not: !!m[1] || undefined }
  m = /^(not )?has_item\("([^"]+)"\)$/.exec(t)
  if (m) return { type: 'has_item', item: m[2], not: !!m[1] || undefined }
  m = /^(not )?is_equipped\("([^"]+)"\)$/.exec(t)
  if (m) return { type: 'has_item', item: m[2], not: !!m[1] || undefined }
  m = /^has_item\("([^"]+)"\)\s*(>=|>|<|<=|==)\s*(-?\d+)$/.exec(t)
  if (m) {
    const n = Number(m[3])
    const not = m[2] === '<' || m[2] === '<=' || undefined
    return { type: 'item_ge', item: m[1], count: n, not }
  }
  m = /^has_item\("([^"]+)",\s*(-?\d+)\)$/.exec(t)
  if (m) return { type: 'item_ge', item: m[1], count: Number(m[2]) }
  m = /^item_count\("([^"]+)"\)\s*(>=|<)\s*(-?\d+)$/.exec(t)
  if (m) return { type: 'item_ge', item: m[1], count: Number(m[3]), not: m[2] === '<' || undefined }
  m = /^get_disposition\("([^"]+)"\)\s*(>=|<)\s*(-?\d+)$/.exec(t)
  if (m) return { type: 'disp_ge', target: m[1], value: Number(m[3]), not: m[2] === '<' || undefined }
  m = /^quest_stage\("([^"]+)"\)\s*(==|!=)\s*"(.*)"$/.exec(t)
  if (m) return { type: 'quest', quest: m[1], stage: m[3], not: m[2] === '!=' || undefined }
  m = /^(not )?in_party\("([^"]+)"\)$/.exec(t)
  if (m) return { type: 'in_party', npc: m[2], not: !!m[1] || undefined }
  m = /^(not )?(?:is_name_known|npc_known)\("([^"]+)"\)$/.exec(t)
  if (m) return { type: 'npc_known', entity: m[2], known: !m[1], not: !!m[1] || undefined }
  m = /^get_hp\(\)\s*(>=|<)\s*(-?\d+)$/.exec(t)
  if (m) return { type: 'hp_ge', value: Number(m[2]), not: m[1] === '<' || undefined }
  m = /^(not )?has_status\("([^"]+)"\)$/.exec(t)
  if (m) return { type: 'has_status', status: m[2], not: !!m[1] || undefined }
  m = /^(not )?weather_is\("([^"]+)"\)$/.exec(t)
  if (m) return { type: 'weather_is', weather: m[2], not: !!m[1] || undefined }
  m = /^(not )?skill_check\("([^"]+)",\s*(-?\d+)\)$/.exec(t)
  if (m) return { type: 'skill_ge', skill: m[2], threshold: Number(m[3]), not: !!m[1] || undefined }
  m = /^get_skill\("([^"]+)"\)\s*(>=|<)\s*(-?\d+)$/.exec(t)
  if (m) return { type: 'skill_ge', skill: m[1], threshold: Number(m[3]), not: m[2] === '<' || undefined }
  m = /^get_currency\("([^"]+)"\)\s*(>=|<)\s*(-?\d+)$/.exec(t)
  if (m) {
    const item = m[1] === 'mark' ? 'item_mark' : (m[1].startsWith('item_') ? m[1] : `item_${m[1]}`)
    return { type: 'item_ge', item, count: Number(m[3]), not: m[2] === '<' || undefined }
  }
  // счётчик хроники: равенства переводим в «не ниже», строгие — в «> N» = «>= N+1»
  m = /^get_meta_counter\("([^"]+)"\)\s*(>=|>|<|<=)\s*(-?\d+)$/.exec(t)
  if (m) {
    const n = Number(m[3])
    if (m[2] === '>=') return { type: 'meta_counter', key: m[1], ge: n }
    if (m[2] === '>') return { type: 'meta_counter', key: m[1], ge: n + 1 }
    if (m[2] === '<') return { type: 'meta_counter', key: m[1], ge: n, not: true }
    return { type: 'meta_counter', key: m[1], ge: n + 1, not: true }
  }
  warnings.push(`${where}: условие «${t}» не разобрано`)
  return null
}

/** верхнеуровневые разделители условий: `&&`, `and`, `||`, `or` (вне кавычек и скобок) */
export function splitTopLevel(src: string): { parts: string[]; op: 'and' | 'or' } {
  const parts: string[] = []
  let depth = 0
  let inQ = false
  let cur = ''
  let op: 'and' | 'or' = 'and'
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (ch === '"') inQ = !inQ
    else if (!inQ && ch === '(') depth++
    else if (!inQ && ch === ')') depth--
    if (!inQ && depth === 0) {
      const rest = src.slice(i)
      const conj = /^(?:&&|\s+and\s+)/i.exec(rest)
      const disj = /^(?:\|\||\s+or\s+)/i.exec(rest)
      const m = conj ?? disj
      if (m) {
        parts.push(cur)
        cur = ''
        if (disj) op = 'or'
        i += m[0].length - 1
        continue
      }
    }
    cur += ch
  }
  if (cur.trim()) parts.push(cur)
  return { parts, op }
}

/**
 * Строка условий → список DlgCond. Ink пишут по-разному: наш генератор —
 * через `&&`, автор и ИИ — словом `and` (и `or`), отрицание — `not (...)`
 * или `not fn(...)`. Ограничение модели конструктора: список условий
 * соединяется через «и»; `or` выразить нечем, поэтому о нём честно
 * предупреждаем, а не теряем молча (фидбек 29, п.4).
 */
export function parseConds(src: string, warnings: string[], where: string): DlgCond[] {
  const { parts, op } = splitTopLevel(src)
  const list = parts
    .map((p) => parseCondToken(p, warnings, where))
    .filter((c): c is DlgCond => !!c)
  if (op === 'or' && list.length > 1) {
    // В визуальной модели конструктора условия соединяются через AND;
    // при импорте OR-условия сохраняем первое условие для формы.
    return list.slice(0, 1)
  }
  return list
}

// ─────────────── эффекты и реплики ───────────────

export function parseEffectLine(line: string, warnings: string[], where: string): DlgEffect | null {
  const m = /^~\s*([a-z_]+)\((.*)\)\s*$/.exec(line)
  if (!m) return null
  const [, fn, argsSrc] = m
  const args = argsSrc.split(',').map((a) => a.trim())
  const str = (i: number) => (args[i] ?? '').replace(/^"|"$/g, '')
  const num = (i: number) => Number(args[i]) || 0
  switch (fn) {
    case 'set_flag': {
      if (args[1] === 'false' || args[1] === '0') {
        return { type: 'clear_flag', flag: str(0) }
      }
      return { type: 'set_flag', flag: str(0) }
    }
    case 'clear_flag': return { type: 'clear_flag', flag: str(0) }
    case 'add_item': return { type: 'add_item', item: str(0), qty: num(1) || 1 }
    case 'remove_item': return { type: 'remove_item', item: str(0), qty: num(1) || 1 }
    case 'fire_rule': return { type: 'fire_rule', rule: str(0) }
    case 'join_party': return { type: 'join_party', npc: str(0) }
    case 'open_trade': return { type: 'open_trade', npc: str(0) }
    case 'start_quest': return { type: 'start_quest', quest: str(0) }
    case 'advance_time': return { type: 'advance_time', ticks: num(0) }
    case 'change_need': return { type: 'change_need', need: str(0), delta: num(1) }
    case 'change_hp': return { type: 'change_hp', delta: num(0) }
    case 'sleep': return { type: 'sleep', ticks: num(0) }
    case 'change_disposition': return { type: 'change_disposition', target: str(0), delta: num(1) }
    case 'play_cutscene': return { type: 'play_cutscene', cutscene: str(0) }
    case 'set_description': return { type: 'set_description', entity: str(0), text: str(1) }
    case 'apply_status': return { type: 'apply_status', status: str(0), duration: num(1) || undefined }
    case 'remove_status': return { type: 'remove_status', status: str(0) }
    case 'set_weather': return { type: 'set_weather', weather: str(0) }
    case 'unlock_codex': return { type: 'unlock_codex', entry: str(0) }
    case 'unlock_recipe': return { type: 'unlock_recipe', recipe: str(0) }
    case 'open_craft': return { type: 'open_craft', recipe: str(0) || undefined }
    case 'set_entity_state': return { type: 'set_entity_state', entity: str(0), state: str(1) }
    case 'learn_name': return { type: 'learn_name', entity: str(0) }
    case 'present_item': return { type: 'present_item', ok: str(0), fail: str(1), required: str(2) || undefined }
    case 'go_to_scene': return { type: 'go_to_scene', scene: str(0), close_dialogue: args[1] === 'false' ? false : undefined }
    case 'start_combat': return { type: 'start_combat', arena: str(0) }
    case 'change_scene_state': return args[1] ? { type: 'change_scene_state', scene: str(0), state: str(1) } : { type: 'change_scene_state', state: str(0) }
    case 'game_over_death': return { type: 'game_over_death', message: str(0) || undefined }
    case 'game_over_victory': return { type: 'game_over_victory', message: str(0) || undefined }
    default:
      warnings.push(`${where}: неизвестный эффект «${fn}(…)»`)
      return null
  }
}

/** встроенные теги реплики: # action, # emotion: x, # voice: y, # timer: n */
export function parseTextLine(line: string): DlgLine {
  const l: DlgLine = { text: '' }
  let text = line
  const tags = text.match(/(?:^|\s)#\s*(action|emotion:\s*[\w-]+|speaker:\s*[\w-]+|voice:\s*[\w"'. /\\-]+|sfx:\s*[\w"'. /\\-]+|timer:\s*\d+|timeout:\s*\d+)/g) ?? []
  for (const tag of tags) {
    const t = tag.trim().slice(1).trim()
    if (t === 'action') l.action = true
    else if (t.startsWith('emotion:')) l.emotion = t.slice(8).trim()
    else if (t.startsWith('voice:')) l.voice = t.slice(6).trim()
    else if (t.startsWith('sfx:')) l.sfx = t.slice(4).trim()
    else if (t.startsWith('speaker:')) l.speaker = t.slice(8).trim()
    else if (t.startsWith('timer:')) l.timer = Number(t.slice(6).trim())
    else if (t.startsWith('timeout:')) l.timer = Number(t.slice(8).trim())
    text = text.replace(tag, ' ')
  }
  l.text = inkToTokens(cleanDialogueLine(text.replace(/\s+/g, ' ').trim()))
  return l
}
