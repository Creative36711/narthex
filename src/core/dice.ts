import type { PRNG } from './prng'

/** Разбор и бросок нотации вида "1d6+1", "2d8-2", "d100", "3". */
export function rollDice(notation: string, rng: PRNG): number {
  const m = notation.trim().match(/^(\d*)[dD](\d+)([+-]\d+)?$/)
  if (!m) {
    const flat = Number(notation)
    if (Number.isFinite(flat)) return flat
    throw new Error(`Некорректная нотация костей: ${notation}`)
  }
  const count = m[1] ? parseInt(m[1], 10) : 1
  const sides = parseInt(m[2], 10)
  const mod = m[3] ? parseInt(m[3], 10) : 0
  let total = mod
  for (let i = 0; i < count; i++) total += rng.int(1, sides)
  return total
}

export const d100 = (rng: PRNG) => rng.int(1, 100)
