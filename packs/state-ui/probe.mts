import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createServer } from 'vite'
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve, relative } from 'node:path'
import { launchChromium } from '../../scripts/visual/local-browser.mjs'
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

// Check the published state-ui campaign, then play it through the real browser.
const player = resolve(root, 'public/ai/cf-play.mjs')
const campaign = resolve(root, 'public/campaigns/stone-tablet-siege')
const project = JSON.parse(await readFile(resolve(root, 'packs/state-ui/data/stone-tablet-siege/project.json'), 'utf8')) as { kind?: string }
assert.equal(project.kind, 'state-ui')
const campaignMeta = JSON.parse(await readFile(resolve(campaign, 'campaign.json'), 'utf8')) as {
  endings?: Array<{ id?: string; title?: string; label?: string }>
}
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
    '400',
    '--out',
    join(workspace, 'player-check'),
  ], { cwd: root, encoding: 'utf8', timeout: 180_000, maxBuffer: 16 * 1024 * 1024 })
  assert.equal(checked.status, 0, `${checked.stdout ?? ''}${checked.stderr ?? ''}`)
  const report = JSON.parse(checked.stdout) as {
    verdict?: string
    campaign?: { id?: string }
    pack?: { packId?: string; seam?: string; steps?: number }
    sweep?: { endings?: string[]; finals?: Record<string, number> }
  }
  assert.equal(report.verdict, 'ok')
  assert.equal(report.campaign?.id, 'stone-tablet-siege')
  assert.ok(report.sweep?.endings?.some((id) => id === 'ending_draw' || id === 'ending_lesson'))
  assert.equal(report.pack?.steps, 1)
  console.log(`✓ cf-play target: public/campaigns/stone-tablet-siege; data pack=state-ui; runtime seam=${report.pack?.seam}; verdict=${report.verdict}; static finals=${JSON.stringify(report.sweep?.finals)}; rc=${checked.status}`)

  const artifactLog = resolve(root, '_tools/reports/NAR-5.22-state-ui-browser.log')
  const artifactPng = resolve(root, '_tools/reports/NAR-5.22-state-ui-ending.png')
  await mkdir(dirname(artifactLog), { recursive: true })
  await rm(artifactLog, { force: true })
  await rm(artifactPng, { force: true })

  const server = await createServer({
    root,
    logLevel: 'error',
    server: { host: '127.0.0.1', port: 0, strictPort: false, hmr: false },
  })
  let browser: Awaited<ReturnType<typeof launchChromium>> | undefined
  try {
    await server.listen()
    const address = server.httpServer?.address()
    assert.ok(address && typeof address !== 'string', 'Vite server did not expose a TCP address')
    const baseUrl = `http://127.0.0.1:${address.port}`
    browser = await launchChromium({ locale: 'ru' })
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'ru' })
    const pageErrors: string[] = []
    const consoleErrors: string[] = []
    const steps: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })

    await page.route('**/campaigns/index.json*', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{
        id: 'stone-tablet-siege',
        title: '[DEV] Пепельный круг: последняя рука',
        description: 'NAR-5.22 internal state-ui browser probe',
      }]),
    }))
    await page.goto(baseUrl, { waitUntil: 'networkidle' })
    steps.push('Opened the real Vite player; routed its campaign index to the internal fixture only.')
    await page.getByRole('button', { name: 'Кампании', exact: true }).click()
    await page.locator('.campaign-row').filter({ hasText: /Пепельный круг/ }).locator('.campaign-card').click()
    await page.getByRole('button', { name: 'Новый забег', exact: true }).click()
    await page.waitForTimeout(350)
    for (let i = 0; i < 12; i++) {
      const skip = page.getByText('Пропустить ⏭', { exact: false })
      if (!(await skip.count())) break
      await skip.first().click({ force: true }).catch(() => {})
      await page.waitForTimeout(100)
    }
    await page.getByRole('button', { name: /Сесть за стол/ }).click({ force: true })
    await page.waitForTimeout(250)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(150)
    await page.getByRole('button', { name: /Смотритель/ }).click({ force: true })
    steps.push('Started a new run, entered the table scene, and opened the Keeper dialogue.')

    async function advanceToCardChoices(round: number): Promise<void> {
      for (let attempt = 0; attempt < 24; attempt++) {
        if (await page.locator('.end-overlay').count()) return
        const help = page.getByRole('button', { name: 'Понятно', exact: true })
        if (await help.count()) {
          await help.first().click({ force: true })
          await page.waitForTimeout(100)
          continue
        }
        if (await page.getByRole('button', { name: /^▸ Карта/ }).count()) return
        const next = page.getByRole('button', { name: 'Далее ▶', exact: true })
        if (await next.count()) {
          await next.last().click({ force: true })
          await page.waitForTimeout(120)
          continue
        }
        const skip = page.getByRole('button', { name: 'Пропустить ⏭', exact: true })
        if (await skip.count()) {
          await skip.first().click({ force: true })
          await page.waitForTimeout(120)
          continue
        }
        await page.waitForTimeout(100)
      }
      throw new Error(`Round ${round}: player did not reach a card choice. Screen: ${(await page.locator('body').innerText()).slice(-700)}`)
    }

    const selections = [
      { round: 1, name: /Щит.*закрыть тяжёлый удар/i, text: 'Round 1: Shield counters the heavy blow (2 points).' },
      { round: 2, name: /Щит.*выждать и сохранить позицию/i, text: 'Round 2: Shield holds position (1 point).' },
      { round: 3, name: /Выпад.*ответить на первый жест/i, text: 'Round 3: Lunge misses the feint (0 points).' },
    ]
    for (const selection of selections) {
      await advanceToCardChoices(selection.round)
      const choices = page.getByRole('button', { name: selection.name })
      assert.ok(await choices.count(), `Round ${selection.round}: expected card is not offered`)
      await choices.first().click({ force: true })
      steps.push(selection.text)
      await page.waitForTimeout(200)
    }

    await page.waitForFunction(() => document.querySelector('.end-overlay') !== null, null, { timeout: 10_000 })
    const endingTitle = (await page.locator('.end-panel h1').innerText()).trim()
    const endingText = (await page.locator('.end-overlay').innerText()).replace(/\s+/g, ' ').trim()
    const ending = campaignMeta.endings?.find((item) => item.title === endingTitle || item.label === endingTitle)
    assert.ok(ending, `No campaign ending matches browser title: ${endingTitle}`)
    assert.equal(ending.id, 'ending_draw', `Unexpected state-ui ending: ${endingTitle} (${endingText})`)
    assert.match(endingText, /закончилась вничью/i)
    assert.deepEqual(pageErrors, [], 'real browser reported a page error')
    await page.screenshot({ path: artifactPng, fullPage: true })
    const screenshot = await stat(artifactPng)
    assert.ok(screenshot.size > 1_000, `Ending screenshot is unexpectedly small: ${screenshot.size} bytes`)

    const log = [
      'NAR-5.22 — real-browser state-ui playthrough',
      `timestamp: ${new Date().toISOString()}`,
      `target: public/campaigns/stone-tablet-siege`,
      `data pack: state-ui (packs/state-ui/data/stone-tablet-siege/project.json)`,
      `runtime seam: ${report.pack?.seam} (structural cf-play metadata; browser choices below are the gameplay proof)`,
      `player: Vite app at ${baseUrl}; Chromium ${browser.version()}`,
      ...steps.map((step, index) => `step ${index + 1}: ${step}`),
      `ending id: ${ending.id}`,
      `ending title: ${endingTitle}`,
      `ending text: ${endingText}`,
      `page errors: ${pageErrors.length}`,
      `console errors: ${consoleErrors.length}`,
      ...consoleErrors.map((item) => `  console: ${item}`),
      `screenshot: ${relative(root, artifactPng)} (${screenshot.size} bytes)`,
      'result: PASS',
    ].join('\n') + '\n'
    await writeFile(artifactLog, log, 'utf8')
    console.log(`✓ real browser: public/campaigns/stone-tablet-siege; pack=state-ui; ending=${ending.id}; pageErrors=${pageErrors.length}; screenshot=${relative(root, artifactPng)}`)
    console.log(`✓ browser artifacts: ${relative(root, artifactLog)}; ${relative(root, artifactPng)} (${screenshot.size} bytes)`)
  } finally {
    await browser?.close()
    await server.close()
  }
} finally {
  await rm(workspace, { recursive: true, force: true })
}

console.log('STATE_UI_PROBE passed')
