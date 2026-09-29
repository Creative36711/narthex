/**
 * Отчёт о починке кампании: повторы схлопываются.
 *
 * Импорт пакета с 30 «не найдено — создана заглушка» не должен показывать
 * 30 одинаковых строк: мастер их не прочитает. Одинаковые по смыслу
 * сообщения (различаются только именем объекта в кавычках) сворачиваются
 * в одну строку со счётчиком и списком имён. Ничего не теряется: полный
 * список остаётся в отчёте, который мастер отдаёт агенту, и в копировании
 * текста модалки.
 *
 * Формат строки не меняется без нужды: первая фраза группы печатается
 * дословно, следом добавляется «(таких N: …)».
 */

/** имена объектов, которые в сообщениях всегда ходят в кавычках-ёлочках */
const QUOTED = /[«"]([^«»"]+)[»"]/g
/** числа внутри сообщения (их тоже считаем частью «шаблона») */
const NUMBERS = /\b\d+\b/g

const KEY = (s: string): string => s.replace(QUOTED, '«»').replace(NUMBERS, '#').trim()

const namesOf = (s: string): string[] => [...s.matchAll(QUOTED)].map((m) => m[1])

export interface GroupedIssues {
  /** строки для показа мастеру */
  lines: string[]
  /** сколько исходных сообщений схлопнуто */
  collapsed: number
  /** сколько сообщений было всего */
  total: number
}

/**
 * Схлопывает повторы. `minRepeat` — с какого числа одинаковых сообщений
 * имеет смысл сворачивать (двух строк жалко не терять: имена полезнее
 * счётчика).
 */
export function groupIssues(items: readonly string[], minRepeat = 3): GroupedIssues {
  const order: string[] = []
  const groups = new Map<string, { first: string; names: string[]; count: number }>()
  for (const raw of items) {
    const line = String(raw ?? '').trim()
    if (!line) continue
    const key = KEY(line)
    const g = groups.get(key)
    if (!g) {
      groups.set(key, { first: line, names: namesOf(line), count: 1 })
      order.push(key)
    } else {
      g.count++
      for (const n of namesOf(line)) if (!g.names.includes(n)) g.names.push(n)
    }
  }
  let collapsed = 0
  const lines: string[] = []
  for (const key of order) {
    const g = groups.get(key)!
    // две-три одинаковые строки полезнее сводки: имена нужны мастеру
    if (g.count < minRepeat) {
      for (let i = 0; i < g.count; i++) lines.push(g.first)
      continue
    }
    collapsed += g.count - 1
    const show = g.names.slice(0, 3)
    const tail = g.names.length > show.length ? ', …' : ''
    lines.push(`${g.first} (таких ${g.count}: ${show.join(', ')}${tail})`)
  }
  return { lines, collapsed, total: items.length }
}

/** подпись к списку: «схлопнуто N повторов» — только если что-то схлопнулось */
export function groupNote(grouped: GroupedIssues): string {
  if (!grouped.collapsed) return ''
  return `Повторы схлопнуты: ${grouped.total} замечаний показаны как ${grouped.lines.length} строк.`
}
