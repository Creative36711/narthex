/**
 * Отпечаток состояния: одинаковые данные дают одинаковую строку в браузере и
 * в Node. Без `crypto`, без зависимостей, без локали — иначе детерминизм
 * проверялся бы «на глаз» (ADR 0013, карточки 4.4 и 4.6).
 *
 * Это не криптография: отпечаток ловит расхождение кода, а не подделку.
 */

/** Каноническая запись значения: ключи по алфавиту, типы размечены. */
export function canonicalJson(value: unknown): string {
  return encode(value, '(root)')
}

function encode(value: unknown, path: string): string {
  if (value === null) return 'null'
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return encodeNumber(value)
  if (typeof value === 'undefined') return 'undefined'
  if (Array.isArray(value)) {
    return `[${value.map((item, index) => encode(item, `${path}[${index}]`)).join(',')}]`
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    // `undefined` в объекте — то же, что отсутствие поля: JSON так и читает.
    const keys = Object.keys(record).filter((key) => record[key] !== undefined).sort()
    const parts = keys.map((key) => `${JSON.stringify(key)}:${encode(record[key], `${path}.${key}`)}`)
    return `{${parts.join(',')}}`
  }
  throw new TypeError(`canonicalJson: ${typeof value} не входит в состояние (${path})`)
}

/**
 * Числа пишутся без кавычек, поэтому строки с ним не столкнутся: строка всегда
 * в кавычках. Нечисла и `-0` получают собственные метки — `JSON.stringify`
 * превратил бы их в `null` и `0` и спрятал бы расхождение.
 */
function encodeNumber(value: number): string {
  if (Number.isNaN(value)) return 'nan'
  if (value === Infinity) return 'inf'
  if (value === -Infinity) return '-inf'
  if (Object.is(value, -0)) return '-0'
  return JSON.stringify(value)
}

const FNV_PRIME = 0x01000193
const FNV_OFFSET = 0x811c9dc5
const SECOND_OFFSET = 0x9e3779b9
const SECOND_PRIME = 0x85ebca6b

/**
 * 64-битный FNV-1a двумя 32-битными полосами — без BigInt: он нужен и в
 * браузере, и в старом Node без лишних условий.
 */
export function stableHash(text: string): string {
  let low = FNV_OFFSET
  let high = SECOND_OFFSET
  // `for…of` идёт по кодовым точкам, а не по половинам суррогатов.
  for (const char of text) {
    const code = char.codePointAt(0) as number
    low = Math.imul(low ^ code, FNV_PRIME) >>> 0
    high = Math.imul(high ^ code, SECOND_PRIME) >>> 0
  }
  return low.toString(16).padStart(8, '0') + high.toString(16).padStart(8, '0')
}

/** Отпечаток состояния забега: `stateFingerprint(engine.state)`. */
export function stateFingerprint(state: unknown): string {
  return stableHash(canonicalJson(state))
}
