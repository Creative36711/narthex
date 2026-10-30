import type { CardGameDefinition } from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** Checks authored card/deck references and battle setup not expressed by local JSON Schema refs. */
export function validateCardGame(value: unknown): string[] {
  const problems: string[] = []
  if (!isRecord(value)) return ['card game must be an object']
  if (value.version !== 1) problems.push('version must be 1')

  const cards = value.cards
  if (!Array.isArray(cards) || cards.length === 0) return [...problems, 'cards must be a non-empty array']
  const cardIds = new Set<string>()
  for (const [index, candidate] of cards.entries()) {
    if (!isRecord(candidate)) {
      problems.push(`card ${index} must be an object`)
      continue
    }
    const { id, title, cost, effects } = candidate
    if (typeof id !== 'string' || id.trim() === '') problems.push(`card ${index} id must be a non-empty string`)
    else if (cardIds.has(id)) problems.push(`duplicate card id "${id}"`)
    else cardIds.add(id)
    if (typeof title !== 'string' || title.trim() === '') problems.push(`card "${String(id)}" title must be non-empty`)
    if (!Number.isInteger(cost) || (cost as number) < 0) problems.push(`card "${String(id)}" cost must be a non-negative integer`)
    if (!Array.isArray(effects) || effects.length === 0) {
      problems.push(`card "${String(id)}" must have at least one effect`)
    } else {
      for (const [effectIndex, effect] of effects.entries()) {
        if (!isRecord(effect) || (effect.type !== 'damage' && effect.type !== 'block') ||
          !Number.isInteger(effect.amount) || (effect.amount as number) < 1) {
          problems.push(`card "${String(id)}" effect ${effectIndex} must be positive damage or block`)
        }
      }
    }
  }

  const decks = value.decks
  if (!Array.isArray(decks) || decks.length === 0) return [...problems, 'decks must be a non-empty array']
  const deckIds = new Set<string>()
  for (const [index, candidate] of decks.entries()) {
    if (!isRecord(candidate)) {
      problems.push(`deck ${index} must be an object`)
      continue
    }
    const { id, title, cards: deckCards } = candidate
    if (typeof id !== 'string' || id.trim() === '') problems.push(`deck ${index} id must be a non-empty string`)
    else if (deckIds.has(id)) problems.push(`duplicate deck id "${id}"`)
    else deckIds.add(id)
    if (typeof title !== 'string' || title.trim() === '') problems.push(`deck "${String(id)}" title must be non-empty`)
    if (!Array.isArray(deckCards) || deckCards.length === 0) {
      problems.push(`deck "${String(id)}" must contain at least one card`)
    } else {
      for (const cardId of deckCards) {
        if (typeof cardId !== 'string' || !cardIds.has(cardId)) {
          problems.push(`deck "${String(id)}" references unknown card "${String(cardId)}"`)
        }
      }
    }
  }

  const battle = value.battle
  if (!isRecord(battle)) {
    problems.push('battle must be an object')
  } else {
    if (typeof battle.player_deck !== 'string' || !deckIds.has(battle.player_deck)) {
      problems.push(`battle references unknown player deck "${String(battle.player_deck)}"`)
    }
    if (typeof battle.opponent_deck !== 'string' || !deckIds.has(battle.opponent_deck)) {
      problems.push(`battle references unknown opponent deck "${String(battle.opponent_deck)}"`)
    }
    for (const field of ['player_hp', 'opponent_hp', 'energy_per_turn', 'max_rounds'] as const) {
      if (!Number.isInteger(battle[field]) || (battle[field] as number) < 1) {
        problems.push(`battle ${field} must be a positive integer`)
      }
    }
  }
  return problems
}

export function assertCardGame(value: unknown): asserts value is CardGameDefinition {
  const problems = validateCardGame(value)
  if (problems.length > 0) throw new TypeError(`Invalid card game: ${problems.join('; ')}`)
}
