import type { CardDeckPanelModel, CardGameDefinition } from './types'

/** Read-only card/deck projection for authoring; the source definitions are never modified. */
export function buildCardDeckPanel(game: CardGameDefinition): CardDeckPanelModel {
  const deckIds = new Set(game.decks.map((deck) => deck.id))
  if (!deckIds.has(game.battle.player_deck) || !deckIds.has(game.battle.opponent_deck)) {
    throw new TypeError('Battle setup references a deck that is not declared.')
  }
  return {
    cards: game.cards.map((card) => ({
      id: card.id,
      title: card.title,
      cost: card.cost,
      effects: card.effects.map((effect) => `${effect.type}:${effect.amount}`),
    })),
    decks: game.decks.map((deck) => ({
      id: deck.id,
      title: deck.title,
      cards: [...deck.cards],
      size: deck.cards.length,
    })),
    battle: {
      playerDeck: game.battle.player_deck,
      opponentDeck: game.battle.opponent_deck,
      playerHp: game.battle.player_hp,
      opponentHp: game.battle.opponent_hp,
      energyPerTurn: game.battle.energy_per_turn,
      maxRounds: game.battle.max_rounds,
    },
  }
}
