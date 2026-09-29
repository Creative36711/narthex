/**
 * Импорт рукописного ink-диалога в визуальную модель конструктора (DlgDoc).
 *
 * Охват — диалект, который сам конструктор и генерирует (generateInk), плюс
 * «рукописные» отличия рабочих кампаний: многострочные условия ответов,
 * проверки навыка из паттерна temp d → skill_check → fail/else, терминальные
 * хвосты-узлы без хаба. Нечитаемые строки собираются в warnings и не рвут
 * импорт: мастер решает, доработать ли их в конструкторе руками.
 *
 * round-trip: generateInk(inkToDlgDoc(ink)) семантически повторяет исходник
 * (не побуквенно: комментарии и форматирование не переживают).
 */
import { generateInk, inkToTokens, newDlgDoc } from './dialogueDoc'
import type { DlgCheck, DlgChoice, DlgCond, DlgDoc, DlgEffect, DlgLine, DlgNode, DlgSection, DlgStep } from './dialogueDoc'

export interface InkImportResult {
  doc: DlgDoc
  warnings: string[]
}

// ─────────────── условия ───────────────

function parseCondToken(token: string, warnings: string[], where: string): DlgCond | null {
  const t = token.trim()
  let m = /^(not )?get_flag\("([^"]+)"\)$/.exec(t)
  if (m) return { type: 'flag', flag: m[2], not: !!m[1] || undefined }
  m = /^(not )?has_item\("([^"]+)"\)$/.exec(t)
  if (m) return { type: 'has_item', item: m[2], not: !!m[1] || undefined }
  m = /^item_count\("([^"]+)"\)\s*(>=|<)\s*(-?\d+)$/.exec(t)
  if (m) return { type: 'item_ge', item: m[1], count: Number(m[3]), not: m[2] === '<' || undefined }
  m = /^get_disposition\("([^"]+)"\)\s*(>=|<)\s*(-?\d+)$/.exec(t)
  if (m) return { type: 'disp_ge', target: m[1], value: Number(m[3]), not: m[2] === '<' || undefined }
  m = /^quest_stage\("([^"]+)"\)\s*(==|!=)\s*"(.*)"$/.exec(t)
  if (m) return { type: 'quest', quest: m[1], stage: m[3], not: m[2] === '!=' || undefined }
  m = /^(not )?in_party\("([^"]+)"\)$/.exec(t)
  if (m) return { type: 'in_party', npc: m[2], not: !!m[1] || undefined }
  m = /^get_hp\(\)\s*(>=|<)\s*(-?\d+)$/.exec(t)
  if (m) return { type: 'hp_ge', value: Number(m[2]), not: m[1] === '<' || undefined }
  m = /^(not )?has_status\("([^"]+)"\)$/.exec(t)
  if (m) return { type: 'has_status', status: m[2], not: !!m[1] || undefined }
  m = /^(not )?weather_is\("([^"]+)"\)$/.exec(t)
  if (m) return { type: 'weather_is', weather: m[2], not: !!m[1] || undefined }
  warnings.push(`${where}: условие «${t}» не разобрано`)
  return null
}

/** строка условий с top-level «&&» → список DlgCond (скобки/кавычки не режем) */
export function parseConds(src: string, warnings: string[], where: string): DlgCond[] {
  const parts: string[] = []
  let depth = 0
  let inQ = false
  let cur = ''
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (ch === '"') inQ = !inQ
    if (!inQ && ch === '(') depth++
    if (!inQ && ch === ')') depth--
    if (!inQ && depth === 0 && src.startsWith('&&', i)) {
      parts.push(cur)
      cur = ''
      i++
      continue
    }
    cur += ch
  }
  if (cur.trim()) parts.push(cur)
  return parts
    .map((p) => parseCondToken(p, warnings, where))
    .filter((c): c is DlgCond => !!c)
}

// ─────────────── эффекты и реплики ───────────────

function parseEffectLine(line: string, warnings: string[], where: string): DlgEffect | null {
  const m = /^~\s*([a-z_]+)\((.*)\)\s*$/.exec(line)
  if (!m) return null
  const [, fn, argsSrc] = m
  const args = argsSrc.split(',').map((a) => a.trim())
  const str = (i: number) => (args[i] ?? '').replace(/^"|"$/g, '')
  const num = (i: number) => Number(args[i]) || 0
  switch (fn) {
    case 'set_flag': return { type: 'set_flag', flag: str(0) }
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
    case 'set_entity_state': return { type: 'set_entity_state', entity: str(0), state: str(1) }
    default:
      warnings.push(`${where}: неизвестный эффект «${fn}(…)»`)
      return null
  }
}

/** встроенные теги реплики: # action, # emotion: x, # voice: y */
function parseTextLine(line: string): DlgLine {
  const l: DlgLine = { text: '' }
  let text = line
  const tags = text.match(/(?:^|\s)#(action|emotion:\s*[\w-]+|voice:\s*[\w"'. -]+)/g) ?? []
  for (const tag of tags) {
    const t = tag.trim().slice(1)
    if (t === 'action') l.action = true
    else if (t.startsWith('emotion:')) l.emotion = t.slice(8).trim()
    else if (t.startsWith('voice:')) l.voice = t.slice(6).trim()
    text = text.replace(tag, '')
  }
  l.text = inkToTokens(text.replace(/\s+/g, ' ').trim())
  return l
}

// ─────────────── поток строк: шаги, секции, хвост ───────────────

type FlowItem = { t: 'step'; s: DlgStep } | { t: 'sec'; sec: DlgSection }

interface Flow {
  items: FlowItem[]
  /** последний одиночный «-> куда» потока (без учёта узла-владельца) */
  tail?: string
}

const isCondBlockOpen = (line: string) => /^\s*\{[^}]*:\s*$/.test(line)
const isElseDivider = (line: string) => /^\s*-\s*else\s*:\s*$/.test(line)
const isBlockClose = (line: string) => /^\s*\}\s*$/.test(line)
const braceDelta = (line: string) => (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length

function dedent(arr: string[]): string[] {
  const mins = arr.filter((a) => a.trim()).map((a) => (/^(\s+)/.exec(a)?.[1] ?? '').length)
  const min = mins.length ? Math.min(...mins) : 0
  return min ? arr.map((a) => a.slice(min)) : arr
}

/** «-> где» → семантика конструктора */
export function mapGoto(targetRaw: string | undefined, nodeId: string, fallback?: string): string {
  if (!targetRaw) return fallback ?? 'stay'
  const t = targetRaw.trim()
  if (t === 'DONE' || t === 'END') return 'end'
  if (t === `${nodeId}_hub` || t === nodeId) return 'stay'
  if (t.endsWith('_hub')) return t.replace(/_hub$/, '')
  return t
}

/** условная секция `{ c: … - else: … }`; возвращает секцию и число прочитанных строк */
function parseCondBlock(lines: string[], start: number, warnings: string[], where: string): { sec: DlgSection; consumed: number } {
  const open = lines[start].trim()
  const condSrc = open.replace(/^\{/, '').replace(/:\s*$/, '')
  const conds = parseConds(condSrc, warnings, where)
  let depth = braceDelta(open)
  const inner: string[] = []
  let i = start + 1
  for (; i < lines.length && depth > 0; i++) {
    const l = lines[i]
    depth += braceDelta(l)
    if (depth <= 0 && isBlockClose(l)) { i++ ; break } // закрывающую «}» съедаем
    inner.push(l)
  }
  // разрез по top-level «- else:»
  let d2 = 0
  const a: string[] = []
  const b: string[] = []
  let inB = false
  for (const l of inner) {
    const d = braceDelta(l)
    if (!inB && d2 === 0 && d === 0 && isElseDivider(l)) {
      inB = true
      continue
    }
    d2 += d
    ;(inB ? b : a).push(l)
  }
  const fa = parseFlow(dedent(a), warnings, `${where} (условие)`)
  const sec: DlgSection = { conds, steps: fa.items.flatMap((it) => (it.t === 'step' ? [it.s] : [])) }
  for (const it of fa.items) {
    if (it.t === 'sec') warnings.push(`${where}: вложенные условные блоки внутри секции не поддержаны — вынесены в шаги потеряны`)
  }
  if (fa.tail) sec.goto = fa.tail
  if (inB) {
    const fb = parseFlow(dedent(b), warnings, `${where} (иначе)`)
    sec.else_steps = fb.items.flatMap((it) => (it.t === 'step' ? [it.s] : []))
    if (fb.tail) sec.else_goto = fb.tail
  }
  return { sec, consumed: i - start }
}

function parseFlow(lines: string[], warnings: string[], where: string): Flow {
  const items: FlowItem[] = []
  const flow: Flow = { items }
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()
    if (!trimmed) { i++; continue }
    if (trimmed.startsWith('->')) {
      flow.tail = trimmed.slice(2).trim()
      i++
      continue
    }
    if (isCondBlockOpen(line)) {
      const { sec, consumed } = parseCondBlock(lines, i, warnings, where)
      items.push({ t: 'sec', sec })
      i += consumed
      continue
    }
    if (trimmed.startsWith('~')) {
      if (/^~\s*(temp|VAR)\b/.test(trimmed)) {
        warnings.push(`${where}: временная переменная «${trimmed.slice(0, 50)}…» вне проверки навыка — пропущена`)
        i++
        continue
      }
      const eff = parseEffectLine(trimmed, warnings, where)
      if (eff) items.push({ t: 'step', s: { kind: 'effect', effect: eff } })
      else warnings.push(`${where}: строка «${trimmed.slice(0, 60)}…» не разобрана`)
      i++
      continue
    }
    items.push({ t: 'step', s: { kind: 'line', line: parseTextLine(trimmed) } })
    i++
  }
  return flow
}

/** смежные шаги секции собираются в плоские секции, условные блоки — отдельные */
export function flowToSections(flow: Flow, nodeId?: string): DlgSection[] {
  const sections: DlgSection[] = []
  let plain: DlgStep[] = []
  const flush = () => {
    if (plain.length) { sections.push({ steps: plain }); plain = [] }
  }
  for (const it of flow.items) {
    if (it.t === 'sec') {
      flush()
      const sec = { ...it.sec }
      if (nodeId) {
        if (sec.goto) sec.goto = mapGoto(sec.goto, nodeId)
        if (sec.else_goto) sec.else_goto = mapGoto(sec.else_goto, nodeId)
      }
      sections.push(sec)
    } else {
      plain.push(it.s)
    }
  }
  flush()
  return sections
}

// ─────────────── ответы ───────────────

interface RawChoice {
  head: string
  once: boolean
  bodyLines: string[]
}

/** заголовки «+ [текст]» / «* {условия} [текст]» с многострочными условиями */
function splitChoices(lines: string[], warnings: string[], where: string): RawChoice[] {
  const out: RawChoice[] = []
  let cur: RawChoice | null = null
  let i = 0
  while (i < lines.length) {
    const trimmed = lines[i].trim()
    if (trimmed.startsWith('- ->')) { i++; continue }
    if (/^[+*]\s/.test(trimmed)) {
      let head = trimmed
      let balance = (head.match(/\[/g) ?? []).length - (head.match(/\]/g) ?? []).length
      while (balance > 0 && i + 1 < lines.length) {
        i++
        head += ' ' + lines[i].trim()
        balance = (head.match(/\[/g) ?? []).length - (head.match(/\]/g) ?? []).length
      }
      cur = { head, once: trimmed[0] === '*', bodyLines: [] }
      out.push(cur)
      i++
      continue
    }
    if (cur) {
      cur.bodyLines.push(lines[i])
    } else if (trimmed) {
      warnings.push(`${where}: строка вне ответа «${trimmed.slice(0, 60)}…»`)
    }
    i++
  }
  return out
}

interface SkillBlock {
  skill: string
  difficulty: number
  mods: Array<{ conds: DlgCond[]; value: number }>
  fail: Flow
  ok: Flow
}

/** распознать паттерн проверки навыка в теле ответа */
function extractSkillCheck(lines: string[], warnings: string[], where: string): { head: string[]; rest: string[]; check?: SkillBlock } {
  const iD = lines.findIndex((l) => /^\s*~\s*temp d\s*=\s*-?\d+\s*$/.test(l))
  const iR = lines.findIndex((l) => /^\s*~\s*temp r\s*=\s*skill_check\("[\w-]+",\s*d\)\s*$/.test(l))
  if (iD < 0 || iR < 0 || iR <= iD) return { head: lines, rest: [] }
  const dLine = /~\s*temp d\s*=\s*(-?\d+)/.exec(lines[iD])
  const rLine = /skill_check\("([^"]+)",\s*d\)/.exec(lines[iR])
  // модификаторы: { c: \n ~ d = V \n }
  const mods: Array<{ conds: DlgCond[]; value: number }> = []
  let mi = iD + 1
  while (mi < iR) {
    if (isCondBlockOpen(lines[mi])) {
      const openC = lines[mi].trim().replace(/^\{/, '').replace(/:\s*$/, '')
      const valLine = mi + 1 < iR ? /~\s*d\s*=\s*(-?\d+)/.exec(lines[mi + 1]) : null
      const closeOk = mi + 2 < iR && isBlockClose(lines[mi + 2])
      if (valLine && closeOk) {
        mods.push({ conds: parseConds(openC, warnings, `${where} (модификатор)`), value: Number(valLine[1]) })
        mi += 3
        continue
      }
      warnings.push(`${where}: модификатор сложности не разобран`)
      mi++
      continue
    }
    if (lines[mi].trim()) warnings.push(`${where}: строка между temp d/r пропущена «${lines[mi].trim().slice(0, 50)}…»`)
    mi++
  }
  // блок результата
  let iAfter = iR + 1
  while (iAfter < lines.length && !lines[iAfter].trim()) iAfter++
  let fail: Flow = { items: [] }
  let ok: Flow = { items: [] }
  let afterIdx = iAfter
  if (iAfter < lines.length && /^\s*\{\s*r\s*==\s*"fail"\s*(\|\|\s*r\s*==\s*"fumble")?\s*:\s*$/.test(lines[iAfter])) {
    let depth = braceDelta(lines[iAfter])
    const inner: string[] = []
    afterIdx = iAfter + 1
    for (; afterIdx < lines.length && depth > 0; afterIdx++) {
      const l = lines[afterIdx]
      depth += braceDelta(l)
      if (depth <= 0 && isBlockClose(l)) { afterIdx++; break } // «}» — часть блока
      inner.push(l)
    }
    let d2 = 0
    const fl: string[] = []
    const ol: string[] = []
    let inOk = false
    for (const l of inner) {
      const d = braceDelta(l)
      if (!inOk && d2 === 0 && d === 0 && isElseDivider(l)) {
        inOk = true
        continue
      }
      d2 += d
      ;(inOk ? ol : fl).push(l)
    }
    fail = parseFlow(dedent(fl), warnings, `${where} (провал)`)
    ok = parseFlow(dedent(ol), warnings, `${where} (успех)`)
    afterIdx = afterIdx > lines.length ? lines.length : afterIdx
  } else {
    warnings.push(`${where}: не найден блок результата проверки { r == "fail" … }`)
  }
  if (!dLine || !rLine) {
    warnings.push(`${where}: строки temp d/r нечитаемы — проверка не восстановлена`)
    return { head: lines, rest: [] }
  }
  return {
    head: lines.slice(0, iD),
    rest: lines.slice(afterIdx),
    check: { skill: rLine[1], difficulty: Number(dLine[1]), mods, fail, ok },
  }
}

function parseChoice(raw: RawChoice, nodeId: string, warnings: string[], where: string): DlgChoice {
  const hm = /^([+*])\s*(?:(\{.*\})\s*)?\[(.*)\]\s*$/.exec(raw.head)
  if (!hm) {
    warnings.push(`${where}: заголовок ответа не разобран`)
    return { text: raw.head.replace(/^[+*]\s*/, '').slice(0, 60), sections: [], goto: 'stay' }
  }
  const conds = hm[2] ? parseConds(hm[2].replace(/^\{/, '').replace(/\}$/, ''), warnings, where) : undefined
  const { head, rest, check } = extractSkillCheck(raw.bodyLines, warnings, where)

  const headFlow = parseFlow(head, warnings, `${where} (ответ)`)
  const sections = flowToSections(headFlow, nodeId)
  if (check && headFlow.tail) warnings.push(`${where}: переход «-> ${headFlow.tail}» до проверки навыка — перенесён в хвост ответа`)

  const restFlow = parseFlow(rest, warnings, `${where} (хвост ответа)`)
  if (restFlow.items.length) warnings.push(`${where}: содержимое после блока проверки — ${restFlow.items.length} стр.; конструктор выполняет проверку последней, перенесите текст в ветки`)

  const choiceTrailing = restFlow.tail ?? headFlow.tail

  const choice: DlgChoice = {
    text: hm[3],
    conds: conds?.length ? conds : undefined,
    once: raw.once || undefined,
    sections,
    goto: mapGoto(choiceTrailing, nodeId),
  }
  if (check) {
    choice.check = {
      skill: check.skill,
      difficulty: check.difficulty,
      mods: check.mods.length ? check.mods : undefined,
      success: { sections: flowToSections(check.ok, nodeId), goto: mapGoto(check.ok.tail ?? choiceTrailing, nodeId) },
      fail: { sections: flowToSections(check.fail, nodeId), goto: mapGoto(check.fail.tail ?? choiceTrailing, nodeId) },
    } satisfies DlgCheck
  }
  return choice
}

// ─────────────── весь документ ───────────────

export function inkToDlgDoc(ink: string, label?: string): InkImportResult {
  const warnings: string[] = []
  const doc: DlgDoc = newDlgDoc(label)
  doc.nodes = []

  interface Knot { name: string; lines: string[] }
  const knots: Knot[] = []
  let curKnot: Knot | null = null
  for (const line of ink.split('\n')) {
    const km = /^===\s*([\w-]+)\s*===\s*$/.exec(line)
    if (km) {
      curKnot = { name: km[1], lines: [] }
      knots.push(curKnot)
    } else if (curKnot) {
      curKnot.lines.push(line)
    }
  }
  if (!knots.length) warnings.push('в файле нет узлов «=== имя ===» — импорт дал пустой шаблон')
  const byName = new Map(knots.map((k) => [k.name, k]))

  for (const knot of knots) {
    const isHub = knot.name.endsWith('_hub') && byName.has(knot.name.replace(/_hub$/, ''))
    if (isHub) continue
    const hub = byName.get(`${knot.name}_hub`)
    const flow = parseFlow(knot.lines, warnings, `узел ${knot.name}`)
    const sections = flowToSections(flow, knot.name)
    const node: DlgNode = {
      id: knot.name,
      label: doc.nodes.length === 0 ? 'Начало разговора' : knot.name.replace(/_/g, ' '),
      sections,
      choices: [],
    }
    if (hub) {
      const raws = splitChoices(hub.lines, warnings, `узел ${knot.name}`)
      node.choices = raws.map((c) => parseChoice(c, knot.name, warnings, `ответ «${c.head.slice(0, 40)}»`))
      // хвост узла перед хабом повторяется генератором автоматически: не переносим,
      // но иной (не в хаб) переход — редкий; фиксируем
      if (flow.tail && flow.tail !== `${knot.name}_hub`) {
        warnings.push(`узел ${knot.name}: переход «-> ${flow.tail}» до ответов не сохранился в модели (конструктор всегда ведёт в ответы)`)
      }
    } else {
      const g = mapGoto(flow.tail, knot.name, '')
      if (g && g !== 'stay') node.goto = g
    }
    doc.nodes.push(node)
  }

  // хабы без родителя сиротами — собираем как самостоятельные узлы ответов
  for (const knot of knots) {
    if (knot.name.endsWith('_hub') && !byName.has(knot.name.replace(/_hub$/, ''))) {
      warnings.push(`хаб «${knot.name}» без одноимённого узла — перенесён отдельно`)
      const raws = splitChoices(knot.lines, warnings, `хаб ${knot.name}`)
      doc.nodes.push({
        id: knot.name,
        label: knot.name.replace(/_/g, ' '),
        sections: [],
        choices: raws.map((c) => parseChoice(c, knot.name, warnings, `ответ «${c.head.slice(0, 40)}»`)),
      })
    }
  }

  if (!doc.nodes.length) {
    doc.nodes.push({
      id: 'main',
      label: 'Начало разговора',
      sections: [{ steps: [{ kind: 'line', line: { text: 'Привет.' } }] }],
      choices: [{ text: 'До встречи.', sections: [], goto: 'end' }],
    })
  }
  return { doc, warnings }
}

/** «после импорта»: пересобранный ink документа (для предпросмотра эквивалентности) */
export function regenInk(doc: DlgDoc): string {
  return generateInk(doc)
}
