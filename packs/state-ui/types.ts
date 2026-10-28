export interface StateDefinition {
  title: string
  terminal?: boolean
}

export interface StateTransition {
  id: string
  from: string
  event: string
  to: string
}

export interface StateMachineDefinition {
  version: 1
  id: string
  initial: string
  states: Record<string, StateDefinition>
  transitions: StateTransition[]
}

export interface StatePanelModel {
  machineId: string
  currentState: string
  currentTitle: string
  terminal: boolean
  states: Array<{ id: string; title: string; current: boolean; terminal: boolean }>
  availableEvents: Array<{ event: string; transitionId: string; target: string; targetTitle: string }>
}

export type CardEffect =
  | { type: 'damage'; amount: number }
  | { type: 'block'; amount: number }

export interface CardDefinition {
  id: string
  title: string
  cost: number
  effects: CardEffect[]
}

export interface DeckDefinition {
  id: string
  title: string
  cards: string[]
}

export interface CardGameDefinition {
  version: 1
  cards: CardDefinition[]
  decks: DeckDefinition[]
  battle: {
    player_deck: string
    opponent_deck: string
    player_hp: number
    opponent_hp: number
    energy_per_turn: number
    max_rounds: number
  }
}

export type BattleActor = 'player' | 'opponent'
export type BattleWinner = BattleActor | 'draw' | null

export interface CardSideState {
  hp: number
  maxHp: number
  block: number
  energy: number
  drawPile: string[]
  hand: string[]
  discardPile: string[]
}

export interface CardPlayLog {
  round: number
  actor: BattleActor
  cardId: string
  effects: Array<
    | { type: 'damage'; amount: number; absorbed: number }
    | { type: 'block'; amount: number }
  >
}

export interface CardBattleState {
  round: number
  player: CardSideState
  opponent: CardSideState
  winner: BattleWinner
  log: CardPlayLog[]
}

export type AutoBattleState = CardBattleState

export interface CardDeckPanelModel {
  cards: Array<{ id: string; title: string; cost: number; effects: string[] }>
  decks: Array<{ id: string; title: string; cards: string[]; size: number }>
  battle: {
    playerDeck: string
    opponentDeck: string
    playerHp: number
    opponentHp: number
    energyPerTurn: number
    maxRounds: number
  }
}
