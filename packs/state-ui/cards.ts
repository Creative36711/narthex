import type {
  AutoBattleState,
  BattleActor,
  CardBattleState,
  CardDefinition,
  CardGameDefinition,
  CardPlayLog,
  CardSideState,
} from './types'

const SIDES: readonly BattleActor[] = ['player', 'opponent']

function cardMap(cards: readonly CardDefinition[]): Map<string, CardDefinition> {
  const result = new Map<string, CardDefinition>()
  for (const card of cards) {
    if (result.has(card.id)) throw new TypeError(`Duplicate card id "${card.id}".`)
    result.set(card.id, card)
  }
  return result
}

/** Fisher–Yates using caller-supplied [0, 1) rolls; no hidden or global RNG. */
export function shuffleDeck(cardIds: readonly string[], rolls: readonly number[]): string[] {
  if (rolls.length !== Math.max(0, cardIds.length - 1)) {
    throw new RangeError(`Expected ${Math.max(0, cardIds.length - 1)} shuffle rolls, received ${rolls.length}.`)
  }
  const shuffled = [...cardIds]
  let rollIndex = 0
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const roll = rolls[rollIndex++]!
    if (!Number.isFinite(roll) || roll < 0 || roll >= 1) {
      throw new RangeError(`Shuffle roll ${rollIndex - 1} must be in [0, 1).`)
    }
    const swapIndex = Math.floor(roll * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex]!, shuffled[index]!]
  }
  return shuffled
}

function initialSide(hp: number, energy: number, deck: string[]): CardSideState {
  return { hp, maxHp: hp, block: 0, energy, drawPile: [...deck], hand: [], discardPile: [] }
}

/** Build an immutable battle snapshot from validated card/deck data and explicit shuffle rolls. */
export function createCardBattle(
  game: CardGameDefinition,
  playerShuffleRolls: readonly number[],
  opponentShuffleRolls: readonly number[],
): CardBattleState {
  const decks = new Map(game.decks.map((deck) => [deck.id, deck]))
  const playerDeck = decks.get(game.battle.player_deck)
  const opponentDeck = decks.get(game.battle.opponent_deck)
  if (!playerDeck || !opponentDeck) throw new TypeError('Battle references an unknown deck.')
  const catalog = cardMap(game.cards)
  for (const id of [...playerDeck.cards, ...opponentDeck.cards]) {
    if (!catalog.has(id)) throw new TypeError(`Deck references unknown card "${id}".`)
  }
  return {
    round: 0,
    player: initialSide(game.battle.player_hp, game.battle.energy_per_turn,
      shuffleDeck(playerDeck.cards, playerShuffleRolls)),
    opponent: initialSide(game.battle.opponent_hp, game.battle.energy_per_turn,
      shuffleDeck(opponentDeck.cards, opponentShuffleRolls)),
    winner: null,
    log: [],
  }
}

/** Draw the next card into one side's hand without mutating the source snapshot. */
export function drawCard(
  state: CardBattleState,
  actor: BattleActor,
): { state: CardBattleState; cardId: string | null } {
  if (state.winner) throw new TypeError('Cannot draw after the battle has ended.')
  const side = state[actor]
  const cardId = side.drawPile[0] ?? null
  if (!cardId) return { state, cardId: null }
  return {
    cardId,
    state: { ...state, [actor]: { ...side, drawPile: side.drawPile.slice(1), hand: [...side.hand, cardId] } },
  }
}

function conclude(state: Omit<CardBattleState, 'winner'> & { winner?: CardBattleState['winner'] }): CardBattleState {
  const playerDead = state.player.hp <= 0
  const opponentDead = state.opponent.hp <= 0
  const winner = playerDead && opponentDead ? 'draw'
    : playerDead ? 'opponent'
      : opponentDead ? 'player' : null
  return { ...state, winner }
}

/** Apply a single affordable card play and its small, declarative damage/block effect list. */
export function playCard(
  state: CardBattleState,
  actor: BattleActor,
  cardId: string,
  cards: readonly CardDefinition[],
): CardBattleState {
  if (state.winner) throw new TypeError('Cannot play a card after the battle has ended.')
  if (!SIDES.includes(actor)) throw new TypeError(`Unknown battle side "${String(actor)}".`)
  const cardsById = cardMap(cards)
  const card = cardsById.get(cardId)
  if (!card) throw new TypeError(`Unknown card "${cardId}".`)
  const actorState = state[actor]
  const targetActor: BattleActor = actor === 'player' ? 'opponent' : 'player'
  const targetState = state[targetActor]
  const handIndex = actorState.hand.indexOf(cardId)
  if (handIndex < 0) throw new TypeError(`Card "${cardId}" is not in the ${actor} hand.`)
  if (!Number.isInteger(card.cost) || card.cost < 0 || actorState.energy < card.cost) {
    throw new TypeError(`Not enough energy to play "${cardId}".`)
  }

  let nextActor = { ...actorState, energy: actorState.energy - card.cost,
    hand: actorState.hand.filter((_, index) => index !== handIndex),
    discardPile: [...actorState.discardPile, cardId] }
  let nextTarget = { ...targetState }
  const effects: CardPlayLog['effects'] = []
  for (const effect of card.effects) {
    if (!Number.isInteger(effect.amount) || effect.amount < 1) {
      throw new TypeError(`Card "${cardId}" has an invalid ${effect.type} amount.`)
    }
    if (effect.type === 'block') {
      nextActor = { ...nextActor, block: nextActor.block + effect.amount }
      effects.push({ type: 'block', amount: effect.amount })
    } else if (effect.type === 'damage') {
      const absorbed = Math.min(nextTarget.block, effect.amount)
      const hpLoss = Math.min(nextTarget.hp, effect.amount - absorbed)
      nextTarget = { ...nextTarget, block: nextTarget.block - absorbed, hp: nextTarget.hp - hpLoss }
      effects.push({ type: 'damage', amount: hpLoss, absorbed })
    } else {
      throw new TypeError(`Card "${cardId}" has an unsupported effect.`)
    }
  }

  const played: CardPlayLog = { round: state.round, actor, cardId, effects }
  return conclude({ ...state, [actor]: nextActor, [targetActor]: nextTarget, log: [...state.log, played] })
}

function valueOf(card: CardDefinition): number {
  return card.effects.reduce((total, effect) => total + (effect.type === 'damage' ? effect.amount * 2 : effect.amount), 0)
}

function autoPlay(state: CardBattleState, actor: BattleActor, cards: readonly CardDefinition[]): CardBattleState {
  let current = state
  const drawn = drawCard(current, actor)
  current = drawn.state
  if (current.winner) return current
  const byId = cardMap(cards)
  const affordable = current[actor].hand
    .map((id) => byId.get(id))
    .filter((card): card is CardDefinition => card !== undefined && card.cost <= current[actor].energy)
    .sort((a, b) => valueOf(b) - valueOf(a) || a.id.localeCompare(b.id))
  const chosen = affordable[0]
  return chosen ? playCard(current, actor, chosen.id, cards) : current
}

function judgeRemainingHp(state: CardBattleState): CardBattleState {
  if (state.winner) return state
  const winner = state.player.hp === state.opponent.hp ? 'draw'
    : state.player.hp > state.opponent.hp ? 'player' : 'opponent'
  return { ...state, winner }
}

/**
 * Resolve a small deterministic auto-battle. Each side draws one card per round and
 * autonomously plays its highest-value affordable card. No engine, clock, or RNG is used.
 */
export function resolveAutoBattle(
  initial: CardBattleState,
  cards: readonly CardDefinition[],
  maxRounds: number,
): AutoBattleState {
  if (!Number.isInteger(maxRounds) || maxRounds < 1) throw new RangeError('maxRounds must be a positive integer.')
  cardMap(cards)
  let state = initial
  for (let round = 1; round <= maxRounds && !state.winner; round += 1) {
    state = {
      ...state,
      round,
      player: { ...state.player, energy: initial.player.energy },
      opponent: { ...state.opponent, energy: initial.opponent.energy },
    }
    for (const actor of SIDES) {
      state = autoPlay(state, actor, cards)
      if (state.winner) break
    }
    if (!state.winner && SIDES.every((actor) =>
      state[actor].drawPile.length === 0 && state[actor].hand.length === 0)) break
  }
  return judgeRemainingHp(state)
}
