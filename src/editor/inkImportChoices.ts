/**
 * Ответы ink-диалога: заголовки «+ [текст]», проверки навыка и сборка выбора.
 *
 * Вынесено из `inkImport.ts`: здесь самая объёмная часть разбора, а модуль
 * импорта оставляет за собой чтение узлов и сборку документа.
 */

import { parseConds } from './inkImportLines'
import {
  braceDelta,
  dedent,
  flowToSections,
  isBlockClose,
  isCondBlockOpen,
  isElseDivider,
  mapGoto,
  parseFlow,
} from './inkImportFlow'
import type { Flow } from './inkImportFlow'
import type { DlgCheck, DlgChoice, DlgCond } from './dialogueDoc'

// ─────────────── ответы ───────────────

export interface RawChoice {
  head: string
  once: boolean
  bodyLines: string[]
}

/** заголовки «+ [текст]» / «* {условия} [текст]» с многострочными условиями */
export function splitChoices(lines: string[], warnings: string[], where: string): RawChoice[] {
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

export interface SkillBlock {
  skill: string
  difficulty: number
  mods: Array<{ conds: DlgCond[]; value: number }>
  fail: Flow
  ok: Flow
}

/** распознать паттерн проверки навыка в теле ответа */
export function extractSkillCheck(lines: string[], warnings: string[], where: string): { head: string[]; rest: string[]; check?: SkillBlock } {
  // Универсальный поиск вызова skill_check: ~ temp X = skill_check("...", ...) или ~ X = skill_check(...)
  const iCall = lines.findIndex((l) => /^\s*~\s*(?:temp\s+)?(\w+)\s*=\s*skill_check\("([^"]+)",\s*(-?\d+|[a-zA-Z_]\w*)\)/.test(l))
  if (iCall < 0) return { head: lines, rest: [] }

  const callMatch = /^\s*~\s*(?:temp\s+)?(\w+)\s*=\s*skill_check\("([^"]+)",\s*(-?\d+|[a-zA-Z_]\w*)\)/.exec(lines[iCall])!
  const varName = callMatch[1]
  const skill = callMatch[2]
  const diffArg = callMatch[3]

  let difficulty = 50
  const mods: Array<{ conds: DlgCond[]; value: number }> = []
  let headEndIdx = iCall

  if (/^-?\d+$/.test(diffArg)) {
    difficulty = Number(diffArg)
  } else {
    // diffArg — имя переменной, например 'd'
    const iD = lines.findIndex((l, idx) => idx < iCall && new RegExp(`^\\s*~\\s*temp\\s+${diffArg}\\s*=\\s*-?\\d+`).test(l))
    if (iD >= 0) {
      headEndIdx = iD
      const dLine = new RegExp(`~\\s*temp\\s+${diffArg}\\s*=\\s*(-?\\d+)`).exec(lines[iD])
      if (dLine) difficulty = Number(dLine[1])
      // модификаторы между iD и iCall
      let mi = iD + 1
      while (mi < iCall) {
        if (isCondBlockOpen(lines[mi])) {
          const openC = lines[mi].trim().replace(/^\{/, '').replace(/:\s*$/, '')
          const valLine = mi + 1 < iCall ? new RegExp(`~\\s*${diffArg}\\s*=\\s*(-?\\d+)`).exec(lines[mi + 1]) : null
          const closeOk = mi + 2 < iCall && isBlockClose(lines[mi + 2])
          if (valLine && closeOk) {
            mods.push({ conds: parseConds(openC, warnings, `${where} (модификатор)`), value: Number(valLine[1]) })
            mi += 3
            continue
          }
          mi++
          continue
        }
        mi++
      }
    }
  }

  // Теперь разбираем блок(и) проверки результата переменной varName:
  let iAfter = iCall + 1
  while (iAfter < lines.length && !lines[iAfter].trim()) iAfter++

  let fail: Flow = { items: [] }
  let ok: Flow = { items: [] }
  let afterIdx = iAfter

  // Вариант 0: Тернарный синтаксис Ink { r: ok | fail } или { r == 1: ok | fail }
  let foundPair = false
  if (iAfter < lines.length) {
    const l1 = lines[iAfter]?.trim() ?? ''
    const mTernary = new RegExp(`^\\{\\s*${varName}(?:\\s*==\\s*1)?\\s*:\\s*(.*?)\\s*\\|\\s*(.*?)\\s*\\}$`).exec(l1)
    if (mTernary) {
      foundPair = true
      afterIdx = iAfter + 1
      ok = parseFlow([mTernary[1].trim()], warnings, `${where} (успех)`)
      fail = parseFlow([mTernary[2].trim()], warnings, `${where} (провал)`)
    }
  }

  // Вариант 1: Однострочные развилки { varName == 1: ... } и { varName == 0: ... } (в любом порядке)
  if (!foundPair && iAfter < lines.length) {
    const l1 = lines[iAfter]?.trim() ?? ''
    const l2 = lines[iAfter + 1]?.trim() ?? ''
    const m1 = new RegExp(`^\\{\\s*${varName}\\s*==\\s*([01])\\s*:\\s*(.*?)\\s*\\}$`).exec(l1)
    const m2 = new RegExp(`^\\{\\s*${varName}\\s*==\\s*([01])\\s*:\\s*(.*?)\\s*\\}$`).exec(l2)
    if (m1 && m2 && m1[1] !== m2[1]) {
      foundPair = true
      afterIdx = iAfter + 2
      const okLine = m1[1] === '1' ? m1[2] : m2[2]
      const failLine = m1[1] === '0' ? m1[2] : m2[2]
      ok = parseFlow([okLine], warnings, `${where} (успех)`)
      fail = parseFlow([failLine], warnings, `${where} (провал)`)
    }
  }

  // Вариант 2: Многострочные или else блоки { varName == ... }
  if (!foundPair && iAfter < lines.length) {
    const isCheckCond = new RegExp(`^\\s*\\{\\s*${varName}\\s*==\\s*("fail"|"fumble"|0|1|"success")`).test(lines[iAfter])
    if (isCheckCond) {
      let depth = braceDelta(lines[iAfter])
      const inner: string[] = []
      afterIdx = iAfter + 1
      for (; afterIdx < lines.length && depth > 0; afterIdx++) {
        const l = lines[afterIdx]
        depth += braceDelta(l)
        if (depth <= 0 && isBlockClose(l)) { afterIdx++; break }
        inner.push(l)
      }
      let d2 = 0
      const fl: string[] = []
      const ol: string[] = []
      let inSecond = false
      for (const l of inner) {
        const d = braceDelta(l)
        if (!inSecond && d2 === 0 && d === 0 && isElseDivider(l)) {
          inSecond = true
          continue
        }
        d2 += d
        ;(inSecond ? ol : fl).push(l)
      }
      const isFailFirst = new RegExp(`^\\s*\\{\\s*${varName}\\s*==\\s*("fail"|"fumble"|0)`).test(lines[iAfter])
      if (isFailFirst) {
        fail = parseFlow(dedent(fl), warnings, `${where} (провал)`)
        ok = parseFlow(dedent(ol), warnings, `${where} (успех)`)
      } else {
        ok = parseFlow(dedent(fl), warnings, `${where} (успех)`)
        fail = parseFlow(dedent(ol), warnings, `${where} (провал)`)
      }
    } else {
      warnings.push(`${where}: не найден блок результата проверки { ${varName} == … }`)
    }
  }

  return {
    head: lines.slice(0, headEndIdx),
    rest: lines.slice(afterIdx),
    check: { skill, difficulty, mods, fail, ok },
  }
}

export function parseChoice(raw: RawChoice, nodeId: string, warnings: string[], where: string, hubName?: string): DlgChoice {
  const hm = /^([+*])\s*(?:(\{.*?\})\s*)?\[(.*?)\](?:\s*(\{.*?\}))?\s*$/.exec(raw.head)
  if (!hm) {
    warnings.push(`${where}: заголовок ответа не разобран`)
    return { text: raw.head.replace(/^[+*]\s*/, '').slice(0, 60), sections: [], goto: 'stay' }
  }
  const condRaw = [hm[2], hm[4]]
    .filter(Boolean)
    .map((s) => s.replace(/^\{/, '').replace(/\}$/, '').trim())
    .filter((s) => s && s !== 'true')
    .join(' && ')
  const conds = condRaw ? parseConds(condRaw, warnings, where) : undefined
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
    goto: mapGoto(choiceTrailing, nodeId, 'stay', hubName),
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
