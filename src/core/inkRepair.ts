/**
 * Починка типовой ошибки в рукописном ink (фидбек 27, п.6).
 *
 * В ink условие выбора пишется ПЕРЕД квадратными скобками:
 *   + { not (get_flag("x")) } [Текст реплики.]
 * ИИ-агенты часто пишут условие ПОСЛЕ скобок:
 *   + [Текст реплики.] { not (get_flag("x")) }
 * Для ink это не условие, а текст, который печатается ПОСЛЕ выбора, поэтому:
 *   1) значение выражения попадает в разговор отдельной строкой («true»);
 *   2) выбор никогда не скрывается: «разовые» и «платные» пункты можно
 *      выбирать снова и снова (правила за ними срабатывают повторно).
 *
 * Функция переносит такие условия на каноничное место. Трогаем строку только
 * когда она однозначно «чистый» выбор (до `[` нет текста) и содержимое
 * фигурных скобок — булево выражение (вызов функции, not/and/or, сравнение);
 * «условный текст» `{ cond: текст }` и альтернативы `{a|b}` не затрагиваются.
 */

// маркеры выбора + необязательная метка `(name)`, уже записанные условия,
// `[текст]`, затем один или несколько `{…}` до конца строки (+ `//` комментарий)
const CHOICE_LINE =
  /^(\s*(?:[*+]\s*)+(?:\([A-Za-z_]\w*\)\s*)?)((?:\{[^{}]*\}\s*)*)\[([^\]]*)\]\s*((?:\{[^{}]*\}\s*)+)(\/\/.*)?$/

/** Похоже ли содержимое `{…}` на булево условие (а не на вывод/условный текст). */
function looksLikeCondition(inner: string): boolean {
  // строки в кавычках не должны влиять на разбор («a:b», «x|y» внутри аргумента)
  const bare = inner.replace(/"[^"]*"/g, '""')
  if (/[|:](?!\|)/.test(bare.replace(/\|\|/g, ''))) return false // `{ cond: текст }` / `{a|b}`
  return /\w\s*\(/.test(bare) || /\b(?:not|and|or)\b/.test(bare) || /&&|\|\||!(?!=)|==|!=|>=|<=|[<>]/.test(bare)
}

function splitBlocks(blocks: string): string[] {
  return blocks.match(/\{[^{}]*\}/g) ?? []
}

export interface InkRepairResult {
  source: string
  /** сколько строк выбора исправлено */
  fixed: number
}

/** Перенести условия выборов, записанные после `]`, перед `[`. */
export function repairInkChoiceConditions(source: string): InkRepairResult {
  let fixed = 0
  const lines = source.split('\n')
  const out = lines.map((line) => {
    const m = CHOICE_LINE.exec(line.replace(/\r$/, ''))
    if (!m) return line
    const after = splitBlocks(m[4])
    if (after.length === 0 || !after.every((b) => looksLikeCondition(b.slice(1, -1)))) return line
    fixed++
    const cr = line.endsWith('\r') ? '\r' : ''
    const before = m[2].trim() ? `${m[2].trim()} ` : ''
    const moved = after.join(' ')
    const comment = m[5] ? ` ${m[5]}` : ''
    return `${m[1].replace(/\s+$/, '')} ${before}${moved} [${m[3]}]${comment}${cr}`
  })
  return { source: fixed ? out.join('\n') : source, fixed }
}

/** Сколько строк выбора в исходнике имеют условие после `]`. */
export function countMisplacedChoiceConditions(source: string): number {
  return repairInkChoiceConditions(source).fixed
}
