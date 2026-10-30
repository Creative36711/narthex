/**
 * Поток строк ink-диалога: блоки условий, шаги и хвосты переходов.
 *
 * Вынесено из `inkImport.ts`: это слой между построчным разбором и сборкой
 * ответов, у него один публичный результат — `flowToSections`.
 */

import { parseConds, parseEffectLine, parseTextLine } from './inkImportLines'
import type { DlgSection, DlgStep } from './dialogueDoc'

// ─────────────── поток строк: шаги, секции, хвост ───────────────

export type FlowItem = { t: 'step'; s: DlgStep } | { t: 'sec'; sec: DlgSection }

export interface Flow {
  items: FlowItem[]
  /** последний одиночный «-> куда» потока (без учёта узла-владельца) */
  tail?: string
}

export const isCondBlockOpen = (line: string) => /^\s*\{[^}]*:\s*$/.test(line)
export const isElseDivider = (line: string) => /^\s*-\s*else\s*:\s*$/.test(line)
export const isBlockClose = (line: string) => /^\s*\}\s*$/.test(line)
export const braceDelta = (line: string) => (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length

export function dedent(arr: string[]): string[] {
  const mins = arr.filter((a) => a.trim()).map((a) => (/^(\s+)/.exec(a)?.[1] ?? '').length)
  const min = mins.length ? Math.min(...mins) : 0
  return min ? arr.map((a) => a.slice(min)) : arr
}

/** «-> где» → семантика конструктора */
export function mapGoto(targetRaw: string | undefined, nodeId: string, fallback?: string, hubName?: string): string {
  if (!targetRaw) return fallback ?? 'stay'
  const t = targetRaw.trim()
  if (t === 'DONE' || t === 'END') return 'end'
  if (t === `${nodeId}_hub` || t === nodeId || t === 'hub' || (hubName && t === hubName)) return 'stay'
  if (t.endsWith('_hub')) {
    const base = t.replace(/_hub$/, '')
    if (base === nodeId || (nodeId.endsWith('_talk') && nodeId.replace(/_talk$/, '') === base)) return 'stay'
    return base
  }
  if (nodeId.endsWith('_talk') && nodeId.replace(/_talk$/, '') === t) return 'stay'
  return t
}

/** условная секция `{ c: … - else: … }`; возвращает секцию и число прочитанных строк */
export function parseCondBlock(lines: string[], start: number, warnings: string[], where: string): { sec: DlgSection; consumed: number } {
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
  const secSteps: DlgStep[] = []
  for (const it of fa.items) {
    if (it.t === 'step') secSteps.push(it.s)
    else if (it.t === 'sec') {
      secSteps.push(...it.sec.steps)
      if (it.sec.else_steps) secSteps.push(...it.sec.else_steps)
    }
  }
  const sec: DlgSection = { conds, steps: secSteps }
  if (fa.tail) sec.goto = fa.tail
  if (inB) {
    const fb = parseFlow(dedent(b), warnings, `${where} (иначе)`)
    const elseSteps: DlgStep[] = []
    for (const it of fb.items) {
      if (it.t === 'step') elseSteps.push(it.s)
      else if (it.t === 'sec') {
        elseSteps.push(...it.sec.steps)
        if (it.sec.else_steps) elseSteps.push(...it.sec.else_steps)
      }
    }
    sec.else_steps = elseSteps
    if (fb.tail) sec.else_goto = fb.tail
  }
  return { sec, consumed: i - start }
}

export function parseFlow(lines: string[], warnings: string[], where: string): Flow {
  const items: FlowItem[] = []
  const flow: Flow = { items }
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()
    if (!trimmed) { i++; continue }
    if (trimmed.startsWith('//')) { i++; continue }
    if (/^(EXTERNAL|VAR|LIST|INCLUDE|CONST)\b/.test(trimmed)) { i++; continue }
    if (trimmed.startsWith('->')) {
      flow.tail = trimmed.slice(2).trim()
      i++
      continue
    }
    const singleCond = /^\s*\{\s*([^:]+?)\s*:\s*(.+?)\s*\}\s*$/.exec(trimmed)
    if (singleCond) {
      const condSrc = singleCond[1].trim()
      const content = singleCond[2].trim()
      const conds = parseConds(condSrc, warnings, where)
      const pipeIdx = content.indexOf('|')
      if (pipeIdx >= 0) {
        const okText = content.slice(0, pipeIdx).trim()
        const elseText = content.slice(pipeIdx + 1).trim()
        const sec: DlgSection = {
          conds,
          steps: okText ? [{ kind: 'line', line: parseTextLine(okText) }] : [],
          else_steps: elseText ? [{ kind: 'line', line: parseTextLine(elseText) }] : [],
        }
        items.push({ t: 'sec', sec })
      } else {
        const sec: DlgSection = {
          conds,
          steps: [{ kind: 'line', line: parseTextLine(content) }],
        }
        items.push({ t: 'sec', sec })
      }
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
      if (/^~\s*set_dialogue_timer\b/.test(trimmed)) {
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
