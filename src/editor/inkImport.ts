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
import { generateInk, newDlgDoc } from './dialogueDoc'
import type { DlgDoc, DlgNode } from './dialogueDoc'
import { extractDialogueTimer, humanizeKnotLabel } from './inkImportKnots'
import { parseChoice, splitChoices } from './inkImportChoices'
import { flowToSections, mapGoto, parseFlow } from './inkImportFlow'

export { parseConds } from './inkImportLines'
export { extractDialogueTimer }

export interface InkImportResult {
  doc: DlgDoc
  warnings: string[]
}

// ─────────────── весь документ ───────────────

export function inkToDlgDoc(ink: string, label?: string): InkImportResult {
  const warnings: string[] = []
  const doc: DlgDoc = newDlgDoc(label)
  doc.nodes = []

  interface Knot { name: string; lines: string[] }
  const knots: Knot[] = []
  let curKnot: Knot | null = null
  const preludeLines: string[] = []

  const rawLines = ink.split('\n')
  const preprocessed: string[] = []
  for (const raw of rawLines) {
    const trimmed = raw.trim()
    // Markdown-разделители (* * *, ***, ---, ___) не являются выбором Ink
    if (/^(\*\s*){3,}$/.test(trimmed) || /^[-_]{3,}$/.test(trimmed)) continue
    // Маркер списка перед условным блоком: "  * { has_item... : " -> "  { has_item... :"
    // Если в строке есть квадратные скобки выбора [...] — звездочку не трогаем!
    const cleaned = (raw.includes('[') && raw.includes(']'))
      ? raw
      : raw.replace(/^(\s*)[*+-]\s*(\{.*?:)/, '$1$2')
    preprocessed.push(cleaned)
  }

  for (const line of preprocessed) {
    const km = /^===\s*([^\s=]+)(?:\s*===)?\s*$/.exec(line)
    if (km) {
      curKnot = { name: km[1], lines: [] }
      knots.push(curKnot)
    } else if (curKnot) {
      curKnot.lines.push(line)
    } else {
      preludeLines.push(line)
    }
  }

  const isMeaningful = (l: string) => {
    const t = l.trim()
    if (!t) return false
    if (t.startsWith('//') || t.startsWith('/*')) return false
    if (/^(EXTERNAL|VAR|LIST|INCLUDE)\b/.test(t)) return false
    return true
  }
  const cleanPrelude = preludeLines.filter(isMeaningful)

  if (!knots.length) {
    if (cleanPrelude.length > 0) {
      // Файл без явных узлов «=== имя ===» — весь файл разбирается как начальный узел
      knots.push({ name: 'main', lines: preludeLines })
    } else {
      warnings.push('в файле нет строк диалога — импорт дал пустой шаблон')
    }
  } else if (cleanPrelude.length > 0) {
    // В файле есть строки до первого узла — они формируют стартовую реплику
    knots.unshift({ name: 'start', lines: preludeLines })
  }

  const byName = new Map(knots.map((k) => [k.name, k]))

  /** узел с ответами: строки вида `+ [текст]` / `* {условие} [текст]` */
  const hasChoices = (k: { lines: string[] }) => k.lines.some((l) => /^[+*]\s/.test(l.trim()))

  const hubOf = new Map<string, Knot>()
  const claimedHubs = new Set<string>()

  for (const knot of knots) {
    // Автосклеивание только для пар вида X и X_hub (или X_talk и X_hub)
    if (knot.name.endsWith('_hub')) continue
    let h = byName.get(`${knot.name}_hub`)
    if (!h && knot.name.endsWith('_talk')) {
      h = byName.get(`${knot.name.replace(/_talk$/, '')}_hub`)
    }
    if (!h && !hasChoices(knot)) {
      // Ищем явный переход `-> something_hub` в узле только если у него нет собственных выборов
      for (let li = knot.lines.length - 1; li >= 0; li--) {
        const tm = /^\s*->\s*([^\s]+_hub)\s*$/.exec(knot.lines[li])
        if (tm && byName.has(tm[1])) {
          h = byName.get(tm[1])
          break
        }
      }
    }
    if (h && h.name !== knot.name && !claimedHubs.has(h.name)) {
      hubOf.set(knot.name, h)
      claimedHubs.add(h.name)
    }
  }

  for (const knot of knots) {
    if (claimedHubs.has(knot.name)) continue
    const hub = hubOf.get(knot.name)
    const selfTimer = extractDialogueTimer(knot.lines)

    if (!hub && hasChoices(knot)) {
      const first = knot.lines.findIndex((l) => /^[+*]\s/.test(l.trim()))
      const lead = parseFlow(knot.lines.slice(0, first), warnings, `узел ${knot.name}`)
      const normId = knot.name.endsWith('_hub') && !byName.has(knot.name.replace(/_hub$/, ''))
        ? knot.name.replace(/_hub$/, '')
        : knot.name
      const node: DlgNode = {
        id: normId,
        label: doc.nodes.length === 0 ? 'Начало разговора' : humanizeKnotLabel(knot.name, knot.lines),
        sections: flowToSections(lead, knot.name),
        choices: [],
      }
      if (selfTimer) node.timer = selfTimer
      const raws = splitChoices(knot.lines.slice(first), warnings, `узел ${knot.name}`)
      node.choices = raws.map((c) => parseChoice(c, knot.name, warnings, `ответ «${c.head.slice(0, 40)}»`))
      doc.nodes.push(node)
      continue
    }

    const flow = parseFlow(knot.lines, warnings, `узел ${knot.name}`)
    const sections = flowToSections(flow, knot.name)
    const normId = knot.name.endsWith('_hub') && !byName.has(knot.name.replace(/_hub$/, ''))
      ? knot.name.replace(/_hub$/, '')
      : knot.name
    const node: DlgNode = {
      id: normId,
      label: doc.nodes.length === 0 ? 'Начало разговора' : humanizeKnotLabel(knot.name, knot.lines),
      sections,
      choices: [],
    }
    if (selfTimer) node.timer = selfTimer

    if (hub) {
      const hubTimer = extractDialogueTimer(hub.lines)
      if (hubTimer) node.timer = hubTimer
      const raws = splitChoices(hub.lines, warnings, `узел ${knot.name}`)
      node.choices = raws.map((c) => parseChoice(c, knot.name, warnings, `ответ «${c.head.slice(0, 40)}»`, hub?.name))
      if (flow.tail && flow.tail !== hub.name && flow.tail !== `${knot.name}_hub`) {
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
    if (knot.name.endsWith('_hub') && !claimedHubs.has(knot.name) && !doc.nodes.some((n) => n.id === knot.name || n.id === knot.name.replace(/_hub$/, ''))) {
      warnings.push(`хаб «${knot.name}» без одноимённого узла — перенесён отдельно`)
      const raws = splitChoices(knot.lines, warnings, `хаб ${knot.name}`)
      doc.nodes.push({
        id: knot.name,
        label: humanizeKnotLabel(knot.name, knot.lines),
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
