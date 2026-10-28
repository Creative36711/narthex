import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import Ajv2020 from 'ajv/dist/2020.js'
import { advanceState } from './machine'
import { buildStatePanel } from './panel'
import { validateStateMachine } from './validate'
import { buildCardDeckPanel } from './cardsPanel'
import { createCardBattle, drawCard, playCard, resolveAutoBattle, shuffleDeck } from './cards'
import { assertCardGame, validateCardGame } from './validateCards'
import type { CardGameDefinition, StateMachineDefinition } from './types'

const root = resolve(import.meta.dirname, '../..')
const schema = JSON.parse(await readFile(resolve(root, 'packs/state-ui/schema/state-machine.schema.json'), 'utf8'))
const machine = JSON.parse(await readFile(resolve(root, 'packs/state-ui/data/turn-cycle.json'), 'utf8')) as StateMachineDefinition
const ajv = new Ajv2020({ allErrors: true, strict: false })
const validateSchema = ajv.compile(schema)
assert.equal(validateSchema(machine), true, JSON.stringify(validateSchema.errors))
assert.deepEqual(validateStateMachine(machine), [])
console.log('✓ state-ui data: JSON Schema and semantic validator accept the declared turn-cycle machine')

function replay(events: string[]): string[] {
  let state = machine.initial
  const sequence = [state]
  for (const event of events) {
    state = advanceState(machine, state, event)
    sequence.push(state)
  }
  return sequence
}

const events = ['begin', 'finish']
const firstReplay = replay(events)
assert.deepEqual(firstReplay, ['ready', 'active', 'completed'])
assert.deepEqual(replay(events), firstReplay, 'identical event streams must replay deterministically')
assert.throws(() => advanceState(machine, 'ready', 'finish'), /No transition/)
console.log(`✓ deterministic simulation: ${events.join(' → ')} ⇒ ${firstReplay.join(' → ')}`)

const panel = buildStatePanel(machine, 'active')
assert.equal(panel.currentTitle, 'Ход выполняется')
assert.deepEqual(panel.availableEvents.map((item) => item.event), ['finish', 'cancel'])
assert.equal(panel.terminal, false)
assert.throws(() => buildStatePanel(machine, 'missing'), /Unknown current state/)
console.log('✓ read-only state panel: active state and both available events are projected from the manifest data')

const cardsSchema = JSON.parse(await readFile(resolve(root, 'packs/state-ui/schema/cards.schema.json'), 'utf8'))
const game = JSON.parse(await readFile(resolve(root, 'packs/state-ui/data/card-game.json'), 'utf8')) as CardGameDefinition
const validateCardsSchema = ajv.compile(cardsSchema)
assert.equal(validateCardsSchema(game), true, JSON.stringify(validateCardsSchema.errors))
assert.deepEqual(validateCardGame(game), [])
assertCardGame(game)
const gameBeforePanel = JSON.stringify(game)
const cardsPanel = buildCardDeckPanel(game)
assert.equal(cardsPanel.cards.length, game.cards.length)
assert.equal(cardsPanel.decks[0]?.size, game.decks[0]?.cards.length)
assert.equal(JSON.stringify(game), gameBeforePanel, 'card/deck panel must be read-only')
const invalidGame = structuredClone(game)
invalidGame.decks[0]!.cards.push('not-a-card')
assert.ok(validateCardGame(invalidGame).some((problem) => problem.includes('unknown card')))
console.log(`✓ cards and decks: JSON Schema, reference validator, and read-only panel accept ${game.cards.length} cards / ${game.decks.length} decks`)

const playerRolls = [0.13, 0.52, 0.87]
const opponentRolls = [0.66, 0.21, 0.44]
const shuffledPlayer = shuffleDeck(game.decks[0]!.cards, playerRolls)
assert.deepEqual(shuffledPlayer, shuffleDeck(game.decks[0]!.cards, playerRolls))
assert.notDeepEqual(shuffledPlayer, game.decks[0]!.cards)
const setup = createCardBattle(game, playerRolls, opponentRolls)
assert.deepEqual(setup.player.drawPile, shuffledPlayer)
const drawn = drawCard(setup, 'player')
assert.ok(drawn.cardId)
assert.equal(drawn.state.player.hand[0], drawn.cardId)
assert.equal(drawn.state.player.drawPile.length, setup.player.drawPile.length - 1)
const played = playCard(drawn.state, 'player', drawn.cardId, game.cards)
assert.deepEqual(played.player.hand, [])
assert.deepEqual(played.player.discardPile, [drawn.cardId])
assert.ok(played.opponent.hp < setup.opponent.hp || played.player.block > setup.player.block)
assert.equal(setup.player.drawPile.length, game.decks[0]!.cards.length, 'draw/play must not mutate the original setup')
assert.throws(() => playCard({ ...drawn.state, player: { ...drawn.state.player, energy: 0 } }, 'player', drawn.cardId!, game.cards), /Not enough energy/)
console.log(`✓ deck setup and card move: explicit rolls shuffled ${shuffledPlayer.join(', ')}; drew and played ${drawn.cardId}`)

const autobattleA = resolveAutoBattle(setup, game.cards, game.battle.max_rounds)
const autobattleB = resolveAutoBattle(setup, game.cards, game.battle.max_rounds)
assert.deepEqual(autobattleA, autobattleB, 'auto-battle must be deterministic for the same deck order')
assert.ok(autobattleA.winner === 'player' || autobattleA.winner === 'opponent' || autobattleA.winner === 'draw')
assert.ok(autobattleA.log.length > 0)
assert.ok(autobattleA.round <= game.battle.max_rounds)
assert.ok(autobattleA.log.some((entry) => entry.effects.some((effect) => effect.type === 'damage' || effect.type === 'block')))
console.log(`✓ auto-battle: ${autobattleA.winner} after ${autobattleA.round} rounds and ${autobattleA.log.length} card plays`)

const ambiguous = structuredClone(machine)
ambiguous.transitions.push({ id: 'finish-again', from: 'active', event: 'finish', to: 'cancelled' })
assert.ok(validateStateMachine(ambiguous).some((problem) => problem.includes('ambiguous event')))
console.log('✓ negative validator control: duplicate (state, event) transition is rejected')

// Run the checked-in, production player bundle against a real existing campaign.
const player = resolve(root, 'public/ai/cf-play.mjs')
const campaign = resolve(root, 'public/campaigns/ash-of-caerden')
const workspace = await mkdtemp(join(tmpdir(), 'narthex-state-ui-probe-'))
try {
  const checked = spawnSync(process.execPath, [
    player,
    'check',
    campaign,
    '--json',
    '--seeds',
    '1-1',
    '--steps',
    '80',
    '--out',
    join(workspace, 'player-check'),
  ], { cwd: root, encoding: 'utf8', timeout: 180_000, maxBuffer: 16 * 1024 * 1024 })
  assert.equal(checked.status, 0, `${checked.stdout ?? ''}${checked.stderr ?? ''}`)
  const report = JSON.parse(checked.stdout) as {
    verdict?: string
    pack?: { packId?: string; seam?: string; steps?: number }
  }
  assert.equal(report.verdict, 'ok')
  assert.equal(report.pack?.packId, 'narrative')
  assert.equal(report.pack?.seam, 'narrative.sim')
  assert.equal(report.pack?.steps, 1)
  console.log(`✓ real player: cf-play check verdict=${report.verdict}, pack=${report.pack.packId}, seam=${report.pack.seam}, rc=${checked.status}`)
} finally {
  await rm(workspace, { recursive: true, force: true })
}

console.log('STATE_UI_PROBE passed')
