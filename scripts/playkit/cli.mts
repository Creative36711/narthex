#!/usr/bin/env node
/**
 * cf-play — headless-плейтест кампании Chronicle Forge.
 *
 * Назначение: дать внешнему ИИ-агенту ВОЗМОЖНОСТЬ играть, не давая доступа к
 * коду движка. Агент получает ровно тот набор действий, который есть у игрока
 * (взаимодействие со слотом, выбор реплики, переход, бой, ожидание), и
 * наблюдение — ровно то, что игрок видит на экране. Внутренние поля состояния
 * доступны только по флагу --debug: это состояние прогона, а не исходники.
 *
 * Сборка в один файл (как campaign-audit.mjs):
 *   npm run build:playkit-bundle   → public/ai/cf-play.mjs
 *
 * Запуск без репозитория движка:
 *   node cf-play.mjs run  <папка кампании> --seed 42 --script route.json --out runs/a
 *   node cf-play.mjs fuzz <папка кампании> --seeds 1-20 --steps 400 --out runs/fuzz
 *   node cf-play.mjs explore <папка кампании> --seed 7 --steps 300
 *   node cf-play.mjs verify <папка прогона> [--expect-engine 0.8.0]
 *
 * Код возврата: 0 — прогон без провалов; 1 — проваленный assert/бой/софтлок;
 * 2 — ошибка вызова.
 */

import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { extname, join, relative, resolve, sep } from 'node:path'
import seedrandom from 'seedrandom'
import { loadCampaign } from '../../src/core/loader'
import { GameEngine } from '../../src/core/engine'
import { PRNG } from '../../src/core/prng'
import { newCharChoice } from '../../src/core/charcreate'
import { ENGINE_VERSION } from '../../src/shared/versions'

const PLAYKIT_VERSION = '0.1.0'
const DEFAULT_ORIGIN = 'http://cf-play.local/'
const MAX_FIGHT_STEPS = 200

// ─────────────────────────────── утилиты ────────────────────────────────────

type AnyObj = Record<string, any>

function die(message: string, code = 2): never {
  console.error(`cf-play: ${message}`)
  process.exit(code)
}

function sha256(data: string | Buffer): string {
  return 'sha256:' + createHash('sha256').update(data).digest('hex')
}

function stableJson(value: unknown): string {
  return JSON.stringify(value, (_k, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return Object.fromEntries(Object.entries(v as AnyObj).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
    }
    return v
  })
}

function parseArgs(argv: string[]): { command: string; positional: string[]; flags: Record<string, string | boolean> } {
  const [command, ...rest] = argv
  const positional: string[] = []
  const flags: Record<string, string | boolean> = {}
  for (let i = 0; i < rest.length; i++) {
    const token = rest[i]!
    if (token.startsWith('--')) {
      const key = token.slice(2)
      const next = rest[i + 1]
      if (next !== undefined && !next.startsWith('--')) {
        flags[key] = next
        i++
      } else {
        flags[key] = true
      }
    } else {
      positional.push(token)
    }
  }
  return { command: command ?? '', positional, flags }
}

async function walk(dir: string, acc: string[] = []): Promise<string[]> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue
      await walk(full, acc)
    } else {
      acc.push(full)
    }
  }
  return acc
}

/**
 * Отпечаток ЛОГИКИ кампании: все json/ink-файлы, без медиа. Медиа не влияет на
 * поведение, а 26 МБ картинок в хеш тянуть незачем.
 */
async function logicDigest(dir: string): Promise<string> {
  const files = (await walk(dir)).filter((f) => ['.json', '.ink', '.dlg'].includes(extname(f).toLowerCase()))
  files.sort()
  const hash = createHash('sha256')
  for (const file of files) {
    hash.update(relative(dir, file).split(sep).join('/'))
    hash.update('\0')
    hash.update(await readFile(file))
    hash.update('\0')
  }
  return 'sha256:' + hash.digest('hex')
}

// ─────────────────────────── окружение Node ─────────────────────────────────

/**
 * Движок написан для браузера, но ядро от DOM не зависит. Подменяем два
 * глобуса: localStorage (сейвы/мета) и fetch (загрузчик пакета читает файлы
 * как будто с сервера). Больше ничего не нужно — аудио и речь уже заглушены
 * проверками `typeof Audio === 'undefined'` внутри движка.
 */
function installShims(campaignDir: string): void {
  const mem = new Map<string, string>()
  ;(globalThis as AnyObj).localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, String(v)),
    removeItem: (k: string) => void mem.delete(k),
    clear: () => mem.clear(),
    key: (i: number) => [...mem.keys()][i] ?? null,
    get length() {
      return mem.size
    },
  }
  ;(globalThis as AnyObj).fetch = async (input: AnyObj) => {
    const url = String(input)
    if (!url.startsWith(DEFAULT_ORIGIN)) throw new Error(`cf-play: внешняя сеть недоступна (${url})`)
    const rel = decodeURIComponent(new URL(url).pathname).replace(/^\/+/, '')
    const target = resolve(campaignDir, rel)
    if (!target.startsWith(resolve(campaignDir))) throw new Error(`cf-play: путь вне кампании (${rel})`)
    return new Response(await readFile(target), { status: 200 })
  }
}

// ─────────────────────────── наблюдение (глаза игрока) ──────────────────────

interface CombatView {
  arena: string
  arenaLabel: string
  round: number
  playerTurn: boolean
  result: string | null
  units: Array<{
    id: string
    label: string
    side: string
    hp: number
    max_hp: number
    dead: boolean
    c: number
    r: number
    distance: number
  }>
  reachable: string[]
  canFlee: boolean
  log: string[]
}

interface Observation {
  step: number
  tick: number
  scene: string
  sceneLabel: string
  location: string
  locationLabel: string
  /** то, что игрок видит в сцене и может нажать */
  visible: Array<{ slot: string; entity: string | null; label: string; kind: string; action: 'talk' | 'use' | 'inspect' | 'none' }>
  /** куда можно уйти одним переходом (только реальные дороги) */
  exits: Array<{ location: string; label: string; cost: number | null }>
  /** открытый диалог: реплики и варианты ответа */
  dialogue: null | {
    npc: string
    npcLabel: string
    lines: Array<{ speaker: string; text: string; action: boolean }>
    choices: Array<{ index: number; text: string }>
    finished: boolean
  }
  /** идёт бой — агент обязан его видеть, иначе играет вслепую */
  combat: CombatView | null
  hud: {
    hp: number
    max_hp: number
    mp: number
    max_mp: number
    needs: Record<string, number>
    quests: Array<{ id: string; label: string; stage: string }>
    inventory: Array<{ item: string; label: string; quantity: number }>
  }
  over: null | { type: string; reason: string; ending?: string }
  /** новые строки журнала с прошлого шага */
  log: string[]
  /** ошибки открытия диалога (битый узел и т.п.) */
  errors: string[]
}

function entityLabel(entity: AnyObj | null | undefined): string {
  if (!entity) return '—'
  return String(entity.label ?? entity.name ?? entity.id ?? '—')
}

function makeObserver(engine: AnyObj, campaign: AnyObj) {
  let logSeen = 0
  let combatLogSeen = 0
  const errorsSeen = new Set<string>()

  function combatView(): CombatView | null {
    const combat = engine.combat as AnyObj | null
    if (!combat) {
      combatLogSeen = 0
      return null
    }
    const player = combat.combatants.find((c: AnyObj) => c.side === 'player' && !c.dead)
    const reachable = player ? [...(combat.reachableHexes().keys() as Iterable<string>)] : []
    const log = (combat.log as string[]) ?? []
    const fresh = log.slice(combatLogSeen)
    combatLogSeen = log.length
    return {
      arena: String(combat.arena?.id ?? ''),
      arenaLabel: String(combat.arena?.label ?? combat.arena?.id ?? ''),
      round: Number(combat.round ?? 0),
      playerTurn: !!combat.isPlayerTurn(),
      result: combat.result ? String(combat.result) : null,
      units: (combat.combatants as AnyObj[]).map((c) => ({
        id: String(c.id),
        label: String(c.label ?? c.id),
        side: String(c.side),
        hp: Number(c.hp ?? 0),
        max_hp: Number(c.maxHp ?? c.hp ?? 0),
        dead: !!c.dead,
        c: Number(c.hex?.c ?? 0),
        r: Number(c.hex?.r ?? 0),
        distance: player ? Number(combat.hexDistance?.(player.hex, c.hex) ?? 0) : 0,
      })),
      reachable: reachable.slice(0, 40),
      canFlee: !!combat.canFlee?.(),
      log: fresh,
    }
  }

  return function observe(step: number): Observation {
    const state = engine.state
    const scene = engine.currentScene()
    const region = engine.findRegion(state.region)
    const location = engine.findLocation(state.location)?.location

    const occupants = (engine.slotOccupants(scene) as AnyObj[])
      .filter((o) => o.entity)
      .map((o) => {
        const entity = o.entity as AnyObj
        const isNpc = entity.type === 'npc'
        const talkable = isNpc && !!entity.dialogue
        return {
          slot: String(o.slot?.id ?? ''),
          entity: String(entity.id ?? ''),
          label: entityLabel(entity),
          kind: String(entity.type ?? ''),
          action: (talkable ? 'talk' : isNpc ? 'inspect' : 'use') as Observation['visible'][number]['action'],
        }
      })

    const exits = region
      ? (engine.visibleLocations(region) as AnyObj[])
          .filter((l) => l.id !== state.location)
          .map((l) => ({ location: String(l.id), label: String(l.label ?? l.id), cost: engine.travelCost(l.id) as number | null }))
          // только прямые дороги: иначе агент «телепортируется» мимо карты
          .filter((l) => l.cost !== null)
      : []

    const dialogueUI = engine.dialogue as AnyObj | null
    const dialogue = dialogueUI
      ? {
          npc: String(dialogueUI.npc?.id ?? ''),
          npcLabel: entityLabel(dialogueUI.npc),
          lines: (dialogueUI.lines as AnyObj[]).map((l) => ({
            speaker: String(l.action ? '' : l.speaker || dialogueUI.npc?.label || ''),
            text: String(l.text ?? ''),
            action: !!l.action,
          })),
          choices: (dialogueUI.choices as AnyObj[]).map((c) => ({ index: Number(c.index), text: String(c.text) })),
          finished: !!dialogueUI.finished,
        }
      : null

    const log = (state.log as string[]) ?? []
    const fresh = log.slice(logSeen)
    logSeen = log.length

    const errors: string[] = []
    const dlgError = engine.lastDialogueError
    if (dlgError && !errorsSeen.has(String(dlgError))) {
      errorsSeen.add(String(dlgError))
      errors.push(String(dlgError))
    }

    return {
      step,
      tick: Number(state.tick),
      scene: String(scene?.id ?? state.scene),
      sceneLabel: String(scene?.label ?? ''),
      location: String(state.location),
      locationLabel: String(location?.label ?? ''),
      visible: occupants,
      exits,
      dialogue,
      combat: combatView(),
      hud: {
        hp: Number(state.player?.hp ?? 0),
        max_hp: Number(state.player?.max_hp ?? 0),
        mp: Number(state.player?.mp ?? 0),
        max_mp: Number(state.player?.max_mp ?? 0),
        needs: { ...(state.player?.needs ?? {}) },
        quests: Object.entries(state.quests ?? {}).map(([id, q]: [string, AnyObj]) => ({
          id,
          label: String(campaign.quests?.[id]?.label ?? id),
          stage: String(q?.stage ?? ''),
        })),
        inventory: ((state.player?.inventory ?? []) as AnyObj[]).map((i) => ({
          item: String(i.item ?? ''),
          label: String(campaign.entities?.[i.item]?.label ?? i.item ?? ''),
          quantity: Number(i.quantity ?? 1),
        })),
      },
      over: state.game_over
        ? { type: String(state.game_over.type), reason: String(state.game_over.reason ?? ''), ending: state.game_over.ending }
        : null,
      log: fresh,
      errors,
    }
  }
}

// ─────────────────────────── действия (руки игрока) ─────────────────────────

type ActionResult = { ok: boolean; detail: string; menu?: boolean }

function combatAct(engine: AnyObj, action: AnyObj): ActionResult {
  const combat = engine.combat as AnyObj | null
  if (!combat) return { ok: false, detail: 'боя нет' }
  const kind = String(action.do ?? '').replace(/^combat_/, '')

  if (kind === 'attack') {
    const target = combat.combatants.find((c: AnyObj) => !c.dead && c.side === 'enemy' && (!action.target || c.id === action.target))
    if (!target) return { ok: false, detail: 'нет цели' }
    combat.playerAttack(String(target.id))
    return { ok: true, detail: `атака → ${target.label}` }
  }
  if (kind === 'move') {
    combat.playerMoveTo({ c: Number(action.c), r: Number(action.r) })
    return { ok: true, detail: `перемещение → ${action.c},${action.r}` }
  }
  if (kind === 'end_turn') {
    combat.playerEndTurn()
    return { ok: true, detail: 'конец хода' }
  }
  if (kind === 'flee') {
    combat.playerFlee()
    return { ok: true, detail: 'попытка отступления' }
  }
  if (kind === 'close') {
    // кнопка «Продолжить» на экране исхода — без неё бой не закрывается
    engine.endCombat()
    return { ok: true, detail: 'экран боя закрыт («Продолжить»)' }
  }
  if (kind === 'item') {
    combat.playerUseItem(String(action.item ?? ''))
    return { ok: true, detail: `предмет в бою: ${action.item}` }
  }
  if (kind === 'ability') {
    combat.useAbility(String(action.ability ?? ''), String(action.target ?? ''))
    return { ok: true, detail: `способность ${action.ability}` }
  }
  return { ok: false, detail: `неизвестное боевое действие «${kind}»` }
}

/**
 * `fight` — тестовый помощник: доводит текущий бой до конца простой политикой
 * «атакуй первого живого врага, иначе заверши ход». Это не новое право агента,
 * а композиция тех же player-действий; в транскрипт пишется как один шаг.
 */
function fight(engine: AnyObj): ActionResult {
  const combat = engine.combat as AnyObj | null
  if (!combat) return { ok: true, detail: 'боя нет' }
  let strikes = 0
  for (let i = 0; i < MAX_FIGHT_STEPS; i++) {
    const current = engine.combat as AnyObj | null
    if (!current) return { ok: true, detail: `бой окончен (${strikes} атак)` }
    if (current.result) {
      engine.endCombat()
      return { ok: true, detail: `бой окончен: ${current.result} (${strikes} атак)` }
    }
    if (!current.isPlayerTurn()) {
      current.playerEndTurn()
      continue
    }
    const target = (current.combatants as AnyObj[]).find((c) => !c.dead && c.side === 'enemy')
    if (!target) {
      current.playerEndTurn()
      continue
    }
    try {
      current.playerAttack(String(target.id))
      strikes++
    } catch {
      current.playerEndTurn()
    }
  }
  return { ok: false, detail: `бой не завершился за ${MAX_FIGHT_STEPS} шагов` }
}

function act(engine: AnyObj, campaign: AnyObj, action: AnyObj): ActionResult {
  const kind = String(action.do ?? '')

  if (kind === 'fight') return fight(engine)
  if (kind.startsWith('combat_')) return combatAct(engine, action)

  if (kind === 'interact') {
    const scene = engine.currentScene()
    const occupants = (engine.slotOccupants(scene) as AnyObj[]).filter((o) => o.entity)
    const target = occupants.find(
      (o) =>
        (action.entity && String(o.entity.id) === String(action.entity)) ||
        (action.slot && String(o.slot?.id) === String(action.slot)),
    )
    if (!target) return { ok: false, detail: `в сцене нет «${action.entity ?? action.slot}»` }
    const done = engine.interactWithSlot(target)
    if (!done && target.entity.type !== 'npc') {
      const options = engine.itemInteractOptions(target.entity) as AnyObj[]
      if (options.length)
        return {
          ok: false,
          menu: true,
          detail: `у «${entityLabel(target.entity)}» есть выбор действия: ${options.map((o, i) => `[${i}] ${o.label}`).join(' · ')} → interact_option`,
        }
    }
    return { ok: !!done, detail: done ? `взаимодействие с ${entityLabel(target.entity)}` : `нет реакции (${action.entity})` }
  }

  if (kind === 'choose') {
    const ui = engine.dialogue
    if (!ui) return { ok: false, detail: 'диалог не открыт' }
    let index = typeof action.index === 'number' ? action.index : -1
    if (index < 0 && action.text) {
      index = (ui.choices as AnyObj[]).findIndex((c) => String(c.text) === String(action.text))
    }
    if (index < 0 || index >= (ui.choices as AnyObj[]).length)
      return { ok: false, detail: `нет варианта ${JSON.stringify(action.index ?? action.text)}` }
    const text = String((ui.choices as AnyObj[])[index]?.text ?? '')
    engine.chooseDialogueOption(index)
    return { ok: true, detail: `выбор: ${text}` }
  }

  if (kind === 'interact_option') {
    const scene = engine.currentScene()
    const occupants = (engine.slotOccupants(scene) as AnyObj[]).filter((o) => o.entity)
    const target = occupants.find((o) => String(o.entity.id) === String(action.entity))
    if (!target) return { ok: false, detail: `в сцене нет «${action.entity}»` }
    const options = engine.itemInteractOptions(target.entity) as AnyObj[]
    const option = options[Number(action.index ?? 0)]
    if (!option) return { ok: false, detail: `нет варианта ${action.index}` }
    engine.runItemInteract(target.entity, option)
    return { ok: true, detail: `${entityLabel(target.entity)}: ${option.label}` }
  }

  if (kind === 'travel') {
    const to = String(action.to ?? '')
    const cost = engine.travelCost(to)
    if (cost === null) return { ok: false, detail: `нет перехода в ${to}` }
    engine.travelTo(to)
    return { ok: true, detail: `переход → ${to} (${cost} тик.)` }
  }

  if (kind === 'wait') {
    const ticks = Math.max(1, Number(action.ticks ?? 1))
    engine.advanceTicks(ticks)
    return { ok: true, detail: `ожидание ${ticks} тик.` }
  }

  if (kind === 'use') {
    const item = String(action.item ?? '')
    if (!engine.hasItem(item)) return { ok: false, detail: `нет предмета ${item}` }
    engine.useItem(item)
    return { ok: true, detail: `использован ${item}` }
  }

  if (kind === 'equip') {
    engine.equipItem(String(action.item ?? ''))
    return { ok: true, detail: `надето ${action.item}` }
  }

  return { ok: false, detail: `неизвестное действие «${kind}»` }
}

function checkExpectation(engine: AnyObj, expectation: AnyObj): { name: string; ok: boolean; detail: string } {
  const state = engine.state
  if (expectation.scene !== undefined) {
    const ok = state.scene === expectation.scene
    return { name: `scene=${expectation.scene}`, ok, detail: ok ? '' : `сейчас ${state.scene}` }
  }
  if (expectation.flag !== undefined) {
    const ok = !!state.flags[String(expectation.flag)]
    return { name: `flag=${expectation.flag}`, ok, detail: ok ? '' : 'флаг не установлен' }
  }
  if (expectation.no_flag !== undefined) {
    const ok = !state.flags[String(expectation.no_flag)]
    return { name: `no_flag=${expectation.no_flag}`, ok, detail: ok ? '' : 'флаг установлен' }
  }
  if (expectation.has_item !== undefined) {
    const ok = !!engine.hasItem(String(expectation.has_item))
    return { name: `has_item=${expectation.has_item}`, ok, detail: ok ? '' : 'предмета нет' }
  }
  if (expectation.game_over !== undefined) {
    const want = expectation.game_over
    const ok = want === null ? !state.game_over : state.game_over?.type === want
    return { name: `game_over=${String(want)}`, ok, detail: ok ? '' : `сейчас ${stableJson(state.game_over)}` }
  }
  if (expectation.tick_at_least !== undefined) {
    const ok = state.tick >= Number(expectation.tick_at_least)
    return { name: `tick>=${expectation.tick_at_least}`, ok, detail: ok ? '' : `тик ${state.tick}` }
  }
  if (expectation.quest_at_stage !== undefined) {
    const { quest, stage } = expectation.quest_at_stage
    const ok = state.quests?.[quest]?.stage === stage
    return { name: `quest ${quest}=${stage}`, ok, detail: ok ? '' : `сейчас ${state.quests?.[quest]?.stage}` }
  }
  return { name: `unknown expectation ${stableJson(expectation)}`, ok: false, detail: 'неизвестная проверка' }
}

// ─────────────────────────────── прогон ─────────────────────────────────────

interface RunConfig {
  campaignDir: string
  seed: string
  outDir: string | null
  debug: boolean
  routeName?: string
  quiet: boolean
}

interface RunResult {
  playkit: string
  engine: string
  campaign: { id: string; title: string; version: string; logicDigest: string }
  seed: string
  route: string | null
  mode: 'run' | 'fuzz' | 'explore'
  status: 'ok' | 'failed' | 'softlock' | 'error'
  steps: number
  assertions: Array<{ name: string; ok: boolean; detail: string }>
  stats: AnyObj
  coverage: AnyObj
  hashes: { transcript: string; run: string }
  error?: string
}

async function loadEngine(campaignDir: string, seed: string, _debug: boolean) {
  installShims(campaignDir)
  const campaign = (await loadCampaign(DEFAULT_ORIGIN)) as AnyObj
  const engine = new GameEngine(campaign as never) as AnyObj
  // seed задаётся до первого хода: rng создаётся в конструкторе случайным,
  // поэтому пересоздаём его и метим состояние — иначе прогон невоспроизводим.
  engine.rng = new PRNG(seed)
  engine.state.seed = engine.rng.seed

  const creation = campaign.meta?.char_creation
  if (creation) {
    const template = campaign.entities[campaign.meta.default_player]
    engine.applyCharCreation(newCharChoice(creation, template, campaign.meta))
  }
  engine.start()
  return { campaign, engine, engineVersion: String(ENGINE_VERSION) }
}

function renderTranscript(config: RunConfig, campaign: AnyObj, engineVersion: string, digest: string, steps: AnyObj[]): string {
  const lines: string[] = []
  lines.push(`# Прогон cf-play · ${campaign.meta.title}`)
  lines.push('')
  lines.push(`- кампания: \`${campaign.meta.id}\` v${campaign.meta.version}`)
  lines.push(`- движок: ${engineVersion} · playkit ${PLAYKIT_VERSION}`)
  lines.push(`- seed: \`${config.seed}\` · логика кампании: \`${digest.slice(0, 23)}…\``)
  lines.push('')
  for (const step of steps) {
    const obs = step.observation as Observation
    lines.push(`## ${obs.step}. тик ${obs.tick} · ${obs.sceneLabel || obs.scene}`)
    lines.push('')
    if (step.action) lines.push(`**Действие:** ${step.action.detail}`)
    if (obs.dialogue) {
      lines.push('')
      lines.push(`**Диалог с ${obs.dialogue.npcLabel}:**`)
      for (const line of obs.dialogue.lines) {
        lines.push(line.action ? `- *${line.text}*` : `- **${line.speaker}:** ${line.text}`)
      }
      if (obs.dialogue.choices.length) {
        lines.push('')
        lines.push('**Варианты:**')
        for (const choice of obs.dialogue.choices) lines.push(`- [${choice.index}] ${choice.text}`)
      }
    }
    if (obs.combat) {
      lines.push('')
      lines.push(`**Бой** (${obs.combat.arenaLabel}, раунд ${obs.combat.round})${obs.combat.result ? ` — ${obs.combat.result}` : ''}`)
      for (const unit of obs.combat.units) {
        lines.push(`- ${unit.dead ? '💀 ' : ''}${unit.label} [${unit.side}] HP ${unit.hp}/${unit.max_hp} @ ${unit.c}/${unit.r}`)
      }
      if (obs.combat.playerTurn) lines.push(`- ваш ход · достижимо клеток: ${obs.combat.reachable.length}`)
      for (const entry of obs.combat.log) lines.push(`- бой: ${entry}`)
    }
    for (const entry of obs.log) lines.push(`- журнал: ${entry}`)
    for (const error of obs.errors) lines.push(`- ⚠️ ошибка: ${error}`)
    lines.push(
      '',
      `\`HP ${obs.hud.hp}/${obs.hud.max_hp} · MP ${obs.hud.mp}/${obs.hud.max_mp} · выходы: ${
        obs.exits.map((e) => `${e.label}${e.cost === null ? '' : ` (${e.cost})`}`).join(', ') || 'нет'
      }\``,
      '',
    )
    if (obs.over) lines.push(`**Финал:** ${obs.over.type} — ${obs.over.reason}${obs.over.ending ? ` (${obs.over.ending})` : ''}`, '')
  }
  return lines.join('\n') + '\n'
}

async function writeRun(config: RunConfig, result: RunResult, steps: AnyObj[], engine: AnyObj, campaign: AnyObj, debug: boolean): Promise<string> {
  const transcript = renderTranscript(config, campaign, result.engine, result.campaign.logicDigest, steps)
  result.hashes.transcript = sha256(transcript)
  const runJson = stableJson({ config: { seed: config.seed, route: result.route, mode: result.mode }, steps })
  result.hashes.run = sha256(runJson)

  if (config.outDir) {
    await mkdir(config.outDir, { recursive: true })
    await writeFile(join(config.outDir, 'transcript.md'), transcript, 'utf8')
    await writeFile(join(config.outDir, 'run.json'), runJson, 'utf8')
    await writeFile(join(config.outDir, 'result.json'), JSON.stringify(result, null, 2), 'utf8')
    if (debug) await writeFile(join(config.outDir, 'state.final.json'), JSON.stringify(engine.state, null, 2), 'utf8')
  }
  return transcript
}

function collectCoverage(engine: AnyObj, campaign: AnyObj, seen: { scenes: Set<string>; locations: Set<string>; dialogues: Set<string>; choices: Set<string>; endings: Set<string> }): AnyObj {
  const allScenes = Object.keys(campaign.scenes ?? {})
  const allLocations = Object.values(campaign.world?.regions ?? {}).flatMap((r: AnyObj) => (r.locations ?? []).map((l: AnyObj) => l.id))
  const allDialogues = Object.values(campaign.entities ?? {})
    .filter((e: AnyObj) => e.type === 'npc' && e.dialogue)
    .map((e: AnyObj) => e.id)
  const allEndings = Object.keys(campaign.meta?.endings ?? {})
  const state = engine.state
  return {
    scenes: { seen: [...seen.scenes].sort(), missing: allScenes.filter((s) => !seen.scenes.has(s)).sort() },
    locations: { seen: [...seen.locations].sort(), missing: allLocations.filter((l) => !seen.locations.has(l)).sort() },
    dialogues: { seen: [...seen.dialogues].sort(), missing: allDialogues.filter((d) => !seen.dialogues.has(d)).sort() },
    choices: { seen: [...seen.choices].sort(), total: seen.choices.size },
    endings: { seen: [...seen.endings].sort(), missing: allEndings.filter((e) => !seen.endings.has(e)).sort() },
    final: { game_over: state.game_over, tick: state.tick },
  }
}

async function cmdRun(config: RunConfig, script: AnyObj): Promise<RunResult> {
  const { campaign, engine, engineVersion } = await loadEngine(config.campaignDir, config.seed, config.debug)
  const observe = makeObserver(engine, campaign)
  const steps: AnyObj[] = []
  const assertions: Array<{ name: string; ok: boolean; detail: string }> = []
  const seen = { scenes: new Set<string>(), locations: new Set<string>(), dialogues: new Set<string>(), choices: new Set<string>(), endings: new Set<string>() }
  let status: RunResult['status'] = 'ok'

  const record = (step: number, action: AnyObj | null, detail: string) => {
    const observation = observe(step)
    seen.scenes.add(observation.scene)
    seen.locations.add(observation.location)
    if (observation.dialogue) seen.dialogues.add(observation.dialogue.npc)
    if (observation.over?.ending) seen.endings.add(String(observation.over.ending))
    for (const choice of observation.dialogue?.choices ?? []) seen.choices.add(choice.text)
    steps.push({ step, action: action ? { ...action, detail } : null, observation })
    return observation
  }

  record(0, null, 'старт')
  const actions: AnyObj[] = Array.isArray(script.steps) ? script.steps : Array.isArray(script) ? script : []
  for (const action of actions) {
    if (action.do === 'expect') {
      const check = checkExpectation(engine, action)
      assertions.push(check)
      if (!check.ok) status = 'failed'
      continue
    }
    if (action.do === 'snapshot') {
      record(steps.length, action, `снимок: ${action.label ?? ''}`)
      continue
    }
    const outcome = act(engine, campaign, action)
    if (!outcome.ok && !outcome.menu) {
      assertions.push({ name: `action:${action.do}`, ok: false, detail: outcome.detail })
      status = 'failed'
    }
    const observation = record(steps.length, action, outcome.detail)
    if (observation.errors.length) status = 'failed'
    if (observation.over) break
  }
  if (engine.lastDialogueError) status = 'failed'

  const result: RunResult = {
    playkit: PLAYKIT_VERSION,
    engine: engineVersion,
    campaign: {
      id: String(campaign.meta.id),
      title: String(campaign.meta.title),
      version: String(campaign.meta.version),
      logicDigest: await logicDigest(config.campaignDir),
    },
    seed: config.seed,
    route: config.routeName ?? null,
    mode: 'run',
    status,
    steps: steps.length,
    assertions,
    stats: engine.state.stats_run ?? {},
    coverage: collectCoverage(engine, campaign, seen),
    hashes: { transcript: '', run: '' },
  }
  await writeRun(config, result, steps, engine, campaign, config.debug)
  return result
}

function chooseAction(rng: () => number, observation: Observation, mode: 'fuzz' | 'explore', visited: Set<string>): AnyObj | null {
  const options: AnyObj[] = []
  if (observation.combat) {
    if (observation.combat.result) return { do: 'combat_close' }
    const enemies = observation.combat.units.filter((u) => u.side === 'enemy' && !u.dead)
    for (const enemy of enemies) options.push({ do: 'combat_attack', target: enemy.id })
    options.push({ do: 'combat_end_turn' })
    if (observation.combat.canFlee) options.push({ do: 'combat_flee' })
    return options[Math.floor(rng() * options.length)]!
  }
  if (observation.dialogue?.choices?.length) {
    for (const choice of observation.dialogue.choices) options.push({ do: 'choose', index: choice.index })
  } else {
    for (const item of observation.visible) {
      if (item.entity && item.action !== 'none') options.push({ do: 'interact', entity: item.entity })
    }
    for (const exit of observation.exits) options.push({ do: 'travel', to: exit.location })
    options.push({ do: 'wait', ticks: 1 })
  }
  if (!options.length) return null
  if (mode === 'explore') {
    // жадный обход: сначала локации, где ещё не были, потом всё подряд
    const fresh = options.find((o) => o.do === 'travel' && !visited.has(o.to))
    if (fresh) return fresh
  }
  return options[Math.floor(rng() * options.length)]!
}

async function cmdSearch(config: RunConfig, mode: 'fuzz' | 'explore', stepsLimit: number): Promise<RunResult> {
  const { campaign, engine, engineVersion } = await loadEngine(config.campaignDir, config.seed, config.debug)
  const rng = seedrandom(`${config.seed}:${mode}`) as unknown as () => number
  const observe = makeObserver(engine, campaign)
  const steps: AnyObj[] = []
  const seen = { scenes: new Set<string>(), locations: new Set<string>(), dialogues: new Set<string>(), choices: new Set<string>(), endings: new Set<string>() }
  let status: RunResult['status'] = 'ok'
  let stale = 0
  let lastSignature = ''

  const record = (action: AnyObj | null, detail: string) => {
    const observation = observe(steps.length)
    seen.scenes.add(observation.scene)
    seen.locations.add(observation.location)
    if (observation.dialogue) seen.dialogues.add(observation.dialogue.npc)
    if (observation.over?.ending) seen.endings.add(String(observation.over.ending))
    for (const choice of observation.dialogue?.choices ?? []) seen.choices.add(choice.text)
    steps.push({ step: steps.length, action: action ? { ...action, detail } : null, observation })
    const combatSignature = observation.combat
      ? `${observation.combat.round}/${observation.combat.units.map((u) => `${u.id}:${u.hp}`).join(',')}`
      : ''
    return `${observation.scene}/${observation.tick}/${observation.hud.hp}/${combatSignature}/${observation.dialogue?.choices?.map((c) => c.text).join('|') ?? ''}/${observation.over?.type ?? ''}`
  }

  lastSignature = record(null, 'старт')
  for (let i = 0; i < stepsLimit; i++) {
    const observation = steps[steps.length - 1]!.observation as Observation
    if (observation.over) break
    const action = chooseAction(rng, observation, mode, seen.locations)
    if (!action) {
      status = 'softlock'
      break
    }
    const outcome = act(engine, campaign, action)
    if (!outcome.ok) stale++
    const signature = record(action, outcome.detail)
    const after = steps[steps.length - 1]!.observation as Observation
    if (after.errors.length) {
      status = 'failed'
      break
    }
    if (signature === lastSignature) stale++
    else stale = 0
    lastSignature = signature
    if (stale > 60) {
      status = 'softlock'
      break
    }
  }

  const result: RunResult = {
    playkit: PLAYKIT_VERSION,
    engine: engineVersion,
    campaign: {
      id: String(campaign.meta.id),
      title: String(campaign.meta.title),
      version: String(campaign.meta.version),
      logicDigest: await logicDigest(config.campaignDir),
    },
    seed: config.seed,
    route: null,
    mode,
    status,
    steps: steps.length,
    assertions: [],
    stats: engine.state.stats_run ?? {},
    coverage: collectCoverage(engine, campaign, seen),
    hashes: { transcript: '', run: '' },
  }
  await writeRun(config, result, steps, engine, campaign, config.debug)
  return result
}

async function cmdVerify(dir: string, expectEngine: string | null): Promise<number> {
  const resultRaw = await readFile(join(dir, 'result.json'), 'utf8')
  const transcript = await readFile(join(dir, 'transcript.md'), 'utf8')
  const runRaw = await readFile(join(dir, 'run.json'), 'utf8')
  const result = JSON.parse(resultRaw) as RunResult
  const failures: string[] = []
  if (sha256(transcript) !== result.hashes.transcript) failures.push('transcript.md не совпадает с хешем в result.json')
  if (sha256(runRaw) !== result.hashes.run) failures.push('run.json не совпадает с хешем в result.json')
  if (expectEngine && result.engine !== expectEngine) failures.push(`движок ${result.engine} ≠ ожидаемого ${expectEngine}`)
  if (result.status !== 'ok') failures.push(`статус прогона: ${result.status}`)
  if (failures.length) {
    for (const f of failures) console.error(`✗ ${f}`)
    return 1
  }
  console.log(`✓ прогон цел: ${result.campaign.id} seed ${result.seed}, движок ${result.engine}, шагов ${result.steps}`)
  return 0
}

// ──────────────────────────────── main ──────────────────────────────────────

const USAGE = [
  'команды: run | fuzz | explore | verify',
  '',
  '  node cf-play.mjs run     <папка кампании> --seed 42 --script route.json --out runs/a',
  '  node cf-play.mjs fuzz    <папка кампании> --seeds 1-20 --steps 400 --out runs/fuzz',
  '  node cf-play.mjs explore <папка кампании> --seed 7 --steps 300',
  '  node cf-play.mjs verify  <папка прогона> [--expect-engine 0.8.0]',
].join('\n')

async function main(): Promise<void> {
  const { command, positional, flags } = parseArgs(process.argv.slice(2))
  const campaignDir = positional[0] ? resolve(positional[0]) : ''
  const seed = String(flags.seed ?? '1')
  const outDir = flags.out ? resolve(String(flags.out)) : null
  const debug = !!flags.debug
  const asJson = !!flags.json

  if (command === 'verify') {
    if (!campaignDir) die('verify: укажите папку прогона (с result.json)')
    process.exit(await cmdVerify(campaignDir, flags['expect-engine'] ? String(flags['expect-engine']) : null))
  }

  if (!['run', 'fuzz', 'explore'].includes(command)) die(USAGE)
  if (!campaignDir) die(`${command}: укажите папку кампании`)

  const config: RunConfig = {
    campaignDir,
    seed,
    outDir,
    debug,
    quiet: asJson,
    routeName: flags.route ? String(flags.route) : undefined,
  }

  let result: RunResult
  if (command === 'run') {
    const scriptPath = flags.script ? String(flags.script) : ''
    if (!scriptPath) die('run: нужен --script route.json')
    const script = JSON.parse(await readFile(resolve(scriptPath), 'utf8')) as AnyObj
    result = await cmdRun(config, script)
  } else if (command === 'explore') {
    result = await cmdSearch(config, 'explore', Number(flags.steps ?? 300))
  } else {
    const range = String(flags.seeds ?? '1-10')
    const [from, to] = range.includes('-') ? range.split('-').map(Number) : [Number(range), Number(range)]
    const runs: RunResult[] = []
    for (let s = from!; s <= to!; s++) {
      const one = await cmdSearch({ ...config, seed: String(s), outDir: outDir ? join(outDir, `seed-${s}`) : null }, 'fuzz', Number(flags.steps ?? 400))
      runs.push(one)
      if (!asJson) console.log(`seed ${s}: ${one.status}, шагов ${one.steps}, финал ${one.coverage.final?.game_over?.type ?? '—'}`)
    }
    const bad = runs.filter((r) => r.status !== 'ok')
    result = {
      ...runs[0]!,
      mode: 'fuzz',
      status: bad.length ? 'failed' : 'ok',
      steps: runs.reduce((a, r) => a + r.steps, 0),
      assertions: bad.map((r) => ({ name: `seed ${r.seed}`, ok: false, detail: r.status })),
      coverage: runs[0]!.coverage,
      hashes: { transcript: '', run: '' },
    }
    if (outDir) {
      await mkdir(outDir, { recursive: true })
      await writeFile(join(outDir, 'result.json'), JSON.stringify(result, null, 2), 'utf8')
    }
  }

  if (asJson) {
    console.log(
      JSON.stringify(
        { status: result.status, campaign: result.campaign, seed: result.seed, steps: result.steps, assertions: result.assertions, coverage: result.coverage, hashes: result.hashes },
        null,
        2,
      ),
    )
  } else {
    console.log(`\n${result.status === 'ok' ? '✓' : '✗'} ${result.campaign.title}: ${result.status}, шагов ${result.steps}, seed ${result.seed}`)
    if (config.outDir) console.log(`  transcript: ${join(config.outDir, 'transcript.md')}`)
    const scenes = result.coverage.scenes as AnyObj
    if (scenes?.missing?.length) console.log(`  не посещено сцен: ${scenes.missing.length} из ${scenes.missing.length + scenes.seen.length}`)
  }
  process.exit(result.status === 'ok' ? 0 : 1)
}

main().catch((error) => {
  console.error(`cf-play: ${error?.stack || error}`)
  process.exit(2)
})
