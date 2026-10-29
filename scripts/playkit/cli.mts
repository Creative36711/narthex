#!/usr/bin/env node
/**
 * cf-play — headless-плейтест кампании Narthex.
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
import { existsSync } from 'node:fs'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import seedrandom from 'seedrandom'
import { loadCampaign } from '../../src/core/loader'
import { GameEngine } from '../../src/core/engine'
import '../../packs/narrative/operations'
import { PRNG } from '../../src/core/prng'
import { PackHost } from '../../src/core/pack/host'
import { newCharChoice } from '../../src/core/charcreate'
import { ENGINE_VERSION } from '../../src/shared/versions'
import { analyzeCampaign, formatGraphReport } from './analyze'
import { findNarrativeCode, NARRATIVE_CODE_LIST } from './narrative-codes'
import { readInstalledPackCatalogue, resolveProjectCapabilityModesForCheck, resolveProjectPackForCheck } from './project-pack'
import { createPlaykitAdventureSession, type PlaykitAdventureSession } from './adventure-runtime'
import { TurnExecutor } from '../../src/core/turn'
import {
  formatCycleReport,
  loadCycleProject,
  runCycleProjects,
  type CycleAdapter,
  type CycleAssertion,
  type CycleProject,
  type CycleSetup,
} from './cycle-check'
import { createRealtimeProjectSetup } from './realtime-project'
import {
  createNarrativePackBinding,
  loadNarrativeContent,
  NARRATIVE_PACK_MANIFEST,
  narrativeEntryEvent,
} from '../../packs/narrative/runtime'
import type { NarrativeState } from '../../packs/narrative/types'

const PLAYKIT_VERSION = '0.1.0'
const CLI_DIR = dirname(fileURLToPath(import.meta.url))
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

type FlagValue = string | boolean
type Flags = Record<string, FlagValue | FlagValue[]>

function parseArgs(argv: string[]): { command: string; positional: string[]; flags: Flags } {
  const [command, ...rest] = argv
  const positional: string[] = []
  const flags: Flags = {}
  const put = (key: string, value: FlagValue) => {
    const current = flags[key]
    if (current === undefined) flags[key] = value
    else if (Array.isArray(current)) current.push(value)
    else flags[key] = [current, value]
  }
  for (let i = 0; i < rest.length; i++) {
    const token = rest[i]!
    if (token.startsWith('--')) {
      const key = token.slice(2)
      const next = rest[i + 1]
      if (next !== undefined && !next.startsWith('--')) {
        put(key, next)
        i++
      } else {
        put(key, true)
      }
    } else {
      positional.push(token)
    }
  }
  return { command: command ?? '', positional, flags }
}

function flagList(flags: Flags, key: string): string[] {
  const value = flags[key]
  if (value === undefined) return []
  return (Array.isArray(value) ? value : [value]).map(String)
}

function flagText(flags: Flags, key: string): string | null {
  const value = flags[key]
  if (value === undefined || value === true) return null
  return String(Array.isArray(value) ? value[value.length - 1] : value)
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
  /** реальные хотспоты перехода в другую сцену этой кампании */
  navigation: Array<{ scene: string; label: string }>
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
  /** состояние подключённого adventure-пака, если проект объявил его в registry */
  adventure?: Record<string, unknown>
}

function entityLabel(entity: AnyObj | null | undefined): string {
  if (!entity) return '—'
  return String(entity.label ?? entity.name ?? entity.id ?? '—')
}

function makeObserver(engine: AnyObj, campaign: AnyObj, adventure?: PlaykitAdventureSession | null) {
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

    const navigation = (Array.isArray(scene?.navigation) ? scene.navigation : []).flatMap((zone: AnyObj) => {
      const target = typeof zone.go_to_scene === 'string' ? zone.go_to_scene : ''
      return target && campaign.scenes?.[target]
        ? [{ scene: target, label: String(zone.label ?? target) }]
        : []
    })

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
      navigation,
      dialogue,
      combat: combatView(),
      hud: {
        hp: Number(state.player?.hp ?? 0),
        max_hp: Number(state.player?.max_hp ?? 0),
        mp: Number(state.player?.mp ?? 0),
        max_mp: Number(state.player?.max_mp ?? 0),
        needs: { ...(state.player?.needs ?? {}) },
        quests: Object.entries((state.quests ?? {}) as Record<string, AnyObj>).map(([id, q]) => ({
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
      ...(adventure ? { adventure: adventure.observe() } : {}),
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

function act(engine: AnyObj, campaign: AnyObj, action: AnyObj, adventure?: PlaykitAdventureSession | null): ActionResult {
  const kind = String(action.do ?? '')

  if (kind.startsWith('adventure_')) {
    if (!adventure) return { ok: false, detail: 'проект не подключил adventure runtime через registry' }
    try {
      return { ok: true, detail: adventure.act(engine, action) }
    } catch (error) {
      return { ok: false, detail: String((error as Error)?.message ?? error) }
    }
  }

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

  if (kind === 'dialogue_close') {
    if (engine.dialogue) engine.endDialogue()
    return { ok: true, detail: 'диалог закрыт' }
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

  if (kind === 'move') {
    const to = String(action.to ?? '')
    const scene = engine.currentScene()
    const navigation = (Array.isArray(scene?.navigation) ? scene.navigation : []) as AnyObj[]
    const zone = navigation.find((candidate) => candidate.go_to_scene === to)
    if (!zone) return { ok: false, detail: `нет перехода в сцену ${to}` }
    const moved = engine.navigate(zone)
    return moved
      ? { ok: true, detail: `переход в сцену → ${to}` }
      : { ok: false, detail: `переход в сцену ${to} заблокирован` }
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

function checkExpectation(engine: AnyObj, expectation: AnyObj, adventure?: PlaykitAdventureSession | null): { name: string; ok: boolean; detail: string } {
  const state = engine.state
  if (expectation.adventure_ending !== undefined) {
    const actual = adventure?.state.adventure.ending ?? null
    const ok = actual === expectation.adventure_ending
    return { name: `adventure_ending=${expectation.adventure_ending}`, ok, detail: ok ? '' : `сейчас ${String(actual)}` }
  }
  if (expectation.adventure_scene !== undefined) {
    const actual = adventure?.state.scene ?? null
    const ok = actual === expectation.adventure_scene
    return { name: `adventure_scene=${expectation.adventure_scene}`, ok, detail: ok ? '' : `сейчас ${String(actual)}` }
  }
  if (expectation.adventure_cursor !== undefined) {
    const actual = adventure?.state.adventure.cursor ?? null
    const ok = actual === expectation.adventure_cursor
    return { name: `adventure_cursor=${expectation.adventure_cursor}`, ok, detail: ok ? '' : `сейчас ${String(actual)}` }
  }
  if (expectation.adventure_item !== undefined) {
    const { item, quantity = 1 } = expectation.adventure_item
    const actual = adventure?.state.inventory?.[item] ?? 0
    const ok = actual >= quantity
    return { name: `adventure_item=${item}×${quantity}`, ok, detail: ok ? '' : `сейчас ${actual}` }
  }
  if (expectation.adventure_message_contains !== undefined) {
    const actual = adventure?.state.adventure.message ?? ''
    const ok = actual.includes(String(expectation.adventure_message_contains))
    return { name: `adventure_message_contains=${expectation.adventure_message_contains}`, ok, detail: ok ? '' : `сейчас ${actual || '(пусто)'}` }
  }
  if (expectation.dialogue_open !== undefined) {
    const ok = !!engine.dialogue === Boolean(expectation.dialogue_open)
    return { name: `dialogue_open=${expectation.dialogue_open}`, ok, detail: ok ? '' : `сейчас ${engine.dialogue ? 'открыт' : 'закрыт'}` }
  }
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

/** Отладочные правки состояния — аналог панели отладки у человека. */
interface Injection {
  flags: Array<[string, boolean]>
  variables: Array<[string, number | string]>
  items: Array<[string, number]>
  tick: number | null
  scene: string | null
  hp: number | null
  god: boolean
  /** состояние облика сущности: id → state */
  entities: Array<[string, string]>
  /** квест → стадия */
  quests: Array<[string, string]>
  weather: string | null
  /** валюта → количество */
  currencies: Array<[string, number]>
  /** навык → значение */
  skills: Array<[string, number]>
}

function parseInjection(flags: Flags): Injection {
  const injection: Injection = {
    flags: [],
    variables: [],
    items: [],
    tick: null,
    scene: null,
    hp: null,
    god: false,
    entities: [],
    quests: [],
    weather: null,
    currencies: [],
    skills: [],
  }
  for (const entry of flagList(flags, 'set')) {
    const [name, raw] = entry.split('=')
    if (!name) continue
    const value = raw === undefined ? true : !['0', 'false', 'no', ''].includes(raw.toLowerCase())
    injection.flags.push([name, value])
  }
  for (const entry of flagList(flags, 'var')) {
    const [name, raw = '0'] = entry.split('=')
    if (!name) continue
    const num = Number(raw)
    injection.variables.push([name, raw.trim() !== '' && Number.isFinite(num) ? num : raw])
  }
  for (const entry of flagList(flags, 'item')) {
    const [id, raw = '1'] = entry.split(':')
    if (!id) continue
    injection.items.push([id, Math.max(1, Number(raw) || 1)])
  }
  const tick = flagText(flags, 'tick')
  if (tick !== null && Number.isFinite(Number(tick))) injection.tick = Number(tick)
  injection.scene = flagText(flags, 'scene')
  const hp = flagText(flags, 'hp')
  if (hp !== null && Number.isFinite(Number(hp))) injection.hp = Number(hp)
  injection.god = !!flags.god
  for (const entry of flagList(flags, 'entity')) {
    const [id, state = ''] = entry.split('=')
    if (id) injection.entities.push([id, state])
  }
  for (const entry of flagList(flags, 'quest')) {
    const [id, stage = ''] = entry.split('=')
    if (id && stage) injection.quests.push([id, stage])
  }
  injection.weather = flagText(flags, 'weather')
  for (const entry of flagList(flags, 'currency')) {
    const [id, raw = '0'] = entry.split(':')
    if (id) injection.currencies.push([id, Number(raw) || 0])
  }
  for (const entry of flagList(flags, 'skill')) {
    const [id, raw = '0'] = entry.split('=')
    if (id) injection.skills.push([id, Number(raw) || 0])
  }
  return injection
}

function injectionNotes(injection: Injection): string[] {
  const notes: string[] = []
  for (const [name, value] of injection.flags) notes.push(`флаг ${name}=${value}`)
  for (const [name, value] of injection.variables) notes.push(`переменная ${name}=${String(value)}`)
  for (const [id, qty] of injection.items) notes.push(`предмет ${id}×${qty}`)
  if (injection.tick !== null) notes.push(`тик → ${injection.tick}`)
  if (injection.scene) notes.push(`переход в сцену ${injection.scene}`)
  if (injection.hp !== null) notes.push(`HP → ${injection.hp}`)
  if (injection.god) notes.push('режим бессмертия')
  for (const [id, state] of injection.entities) notes.push(`облик ${id} → ${state || 'сброс'}`)
  for (const [id, stage] of injection.quests) notes.push(`квест ${id} → ${stage}`)
  if (injection.weather) notes.push(`погода → ${injection.weather}`)
  for (const [id, qty] of injection.currencies) notes.push(`валюта ${id}+${qty}`)
  for (const [id, value] of injection.skills) notes.push(`навык ${id}=${value}`)
  return notes
}

function emptyInjection(): Injection {
  return {
    flags: [],
    variables: [],
    items: [],
    tick: null,
    scene: null,
    hp: null,
    god: false,
    entities: [],
    quests: [],
    weather: null,
    currencies: [],
    skills: [],
  }
}

function isInjected(injection: Injection): boolean {
  return (
    injection.flags.length > 0 ||
    injection.variables.length > 0 ||
    injection.items.length > 0 ||
    injection.tick !== null ||
    injection.scene !== null ||
    injection.hp !== null ||
    injection.god
  )
}

function applyInjection(engine: AnyObj, injection: Injection): void {
  const state = engine.state
  for (const [name, value] of injection.flags) {
    if (value) state.flags[name] = true
    else delete state.flags[name]
  }
  for (const [name, value] of injection.variables) state.variables[name] = value
  for (const [id, qty] of injection.items) engine.addItem(id, qty, { silent: true })
  if (injection.hp !== null) state.player.hp = Math.max(0, Math.min(state.player.max_hp, injection.hp))
  if (injection.tick !== null) state.tick = Math.max(state.tick, injection.tick)
  if (injection.god) engine.debugInvincible = true
  for (const [id, state] of injection.entities) engine.applyEffect({ type: 'set_entity_state', entity: id, state })
  for (const [id, stage] of injection.quests) engine.advanceQuestTo(id, stage)
  if (injection.weather) engine.applyEffect({ type: 'set_weather', weather: injection.weather })
  for (const [id, qty] of injection.currencies) {
    state.currencies ??= {}
    state.currencies[id] = Number(state.currencies[id] ?? 0) + qty
  }
  for (const [id, value] of injection.skills) {
    state.player.skills ??= {}
    state.player.skills[id] = value
  }
  engine.checkRules()
  if (injection.scene) {
    // сцена без своей локации оставила бы игрока «в воздухе»: переносим и локацию
    const target = engine.campaign?.scenes?.[injection.scene]
    if (target?.location && state.current_location !== target.location) {
      state.current_location = target.location
    }
    engine.goToScene(injection.scene)
  }
}

interface RunConfig {
  campaignDir: string
  seed: string
  outDir: string | null
  debug: boolean
  routeName?: string
  quiet: boolean
  injection: Injection
  record: string | null
  followNavigation?: boolean
}

interface RunResult {
  playkit: string
  engine: string
  campaign: { id: string; title: string; version: string; logicDigest: string }
  seed: string
  route: string | null
  mode: 'run' | 'fuzz' | 'explore' | 'sweep'
  /** honest — честное прохождение; injected — с отладочными правками состояния */
  evidence: 'honest' | 'injected'
  injected: string[]
  status: 'ok' | 'failed' | 'softlock' | 'error'
  steps: number
  assertions: Array<{ name: string; ok: boolean; detail: string }>
  stats: AnyObj
  coverage: AnyObj
  hashes: { transcript: string; run: string }
  error?: string
}

async function loadEngine(campaignDir: string, seed: string, _debug: boolean, injection: Injection) {
  installShims(campaignDir)
  const campaign = (await loadCampaign(DEFAULT_ORIGIN)) as AnyObj
  const projectModes = await resolveProjectCapabilityModesForCheck(campaignDir)
  if (projectModes?.activeCaps !== null && projectModes?.activeCaps !== undefined) {
    campaign.meta.caps = projectModes.activeCaps
  }
  if (projectModes) campaign.meta.project_cap_options = projectModes.projectOptions
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
  applyInjection(engine, injection)
  return { campaign, engine, engineVersion: String(ENGINE_VERSION) }
}

function renderTranscript(config: RunConfig, campaign: AnyObj, engineVersion: string, digest: string, steps: AnyObj[]): string {
  const lines: string[] = []
  lines.push(`# Прогон cf-play · ${campaign.meta.title}`)
  lines.push('')
  lines.push(`- кампания: \`${campaign.meta.id}\` v${campaign.meta.version}`)
  lines.push(`- движок: ${engineVersion} · playkit ${PLAYKIT_VERSION}`)
  lines.push(`- seed: \`${config.seed}\` · логика кампании: \`${digest.slice(0, 23)}…\``)
  const notes = injectionNotes(config.injection)
  if (notes.length) lines.push(`- **отладочные правки:** ${notes.join('; ')}`)
  lines.push('')
  for (const step of steps) {
    const obs = step.observation as Observation
    lines.push(`## ${obs.step}. тик ${obs.tick} · ${obs.sceneLabel || obs.scene}`)
    lines.push('')
    if (step.action) lines.push(`**Действие:** ${step.action.detail}`)
    if (obs.adventure) {
      const avatar = obs.adventure.avatar as AnyObj
      lines.push(`**Приключение:** курсор ${obs.adventure.cursor}; аватар ${avatar?.x},${avatar?.y}; сцена ${obs.adventure.scene}`)
      const inventory = Object.entries((obs.adventure.inventory ?? {}) as Record<string, number>).map(([id, quantity]) => `${id}×${quantity}`).join(', ')
      if (inventory) lines.push(`**Инвентарь пака:** ${inventory}`)
      if (obs.adventure.message) lines.push(`**Сообщение:** ${obs.adventure.message}`)
      if (obs.adventure.ending) lines.push(`**Развязка:** ${obs.adventure.ending}`)
    }
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

  if (config.record && result.mode !== 'run') {
    const actions = steps
      .slice(1)
      .map((step) => step.action)
      .filter((action): action is AnyObj => !!action)
      .map((action) => {
        const { detail: _detail, ...rest } = action
        return rest
      })
    const route = { name: `${result.campaign.id} / записано ${result.mode} seed ${result.seed}`, steps: actions }
    await mkdir(dirname(resolve(config.record)), { recursive: true })
    await writeFile(resolve(config.record), JSON.stringify(route, null, 2) + '\n', 'utf8')
  }

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
  const allLocations = (Object.values(campaign.world?.regions ?? {}) as AnyObj[]).flatMap((r) => ((r.locations ?? []) as AnyObj[]).map((l) => l.id))
  const allDialogues = (Object.values(campaign.entities ?? {}) as AnyObj[])
    .filter((e) => e.type === 'npc' && e.dialogue)
    .map((e) => e.id)
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
  const { campaign, engine, engineVersion } = await loadEngine(config.campaignDir, config.seed, config.debug, config.injection)
  const adventure = await createPlaykitAdventureSession(config.campaignDir, engine)
  const observe = makeObserver(engine, campaign, adventure)
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
      const check = checkExpectation(engine, action, adventure)
      assertions.push(check)
      if (!check.ok) status = 'failed'
      continue
    }
    if (action.do === 'snapshot') {
      record(steps.length, action, `снимок: ${action.label ?? ''}`)
      continue
    }
    const outcome = act(engine, campaign, action, adventure)
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
    evidence: isInjected(config.injection) ? 'injected' : 'honest',
    injected: injectionNotes(config.injection),
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

function navigationProgressSignature(engine: AnyObj): string {
  const state = { ...(engine.state as AnyObj) }
  delete state.log

  const dialogue = engine.dialogue as AnyObj | null
  const combat = engine.combat as AnyObj | null
  return sha256(
    stableJson({
      state,
      dialogue: dialogue
        ? {
            npc: String(dialogue.npc?.id ?? ''),
            choices: ((dialogue.choices ?? []) as AnyObj[]).map((choice) => String(choice.text ?? '')),
            finished: !!dialogue.finished,
          }
        : null,
      combat: combat
        ? {
            round: Number(combat.round ?? 0),
            result: combat.result ? String(combat.result) : null,
            units: ((combat.combatants ?? []) as AnyObj[]).map((unit) => ({
              id: String(unit.id ?? ''),
              hp: Number(unit.hp ?? 0),
              dead: !!unit.dead,
            })),
          }
        : null,
    }),
  )
}

function navigationAttemptKey(from: string, to: string, progressSignature: string): string {
  return JSON.stringify([from, to, progressSignature])
}

function chooseAction(
  rng: () => number,
  observation: Observation,
  mode: 'fuzz' | 'explore',
  visitedLocations: Set<string>,
  visitedScenes: Set<string>,
  attemptedNavigations: Set<string>,
  progressSignature: string,
  followNavigation: boolean,
): AnyObj | null {
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
    if (followNavigation) {
      for (const navigation of observation.navigation) {
        const fresh = !visitedScenes.has(navigation.scene)
        const attempted = attemptedNavigations.has(navigationAttemptKey(observation.scene, navigation.scene, progressSignature))
        if (mode === 'fuzz' || (fresh && !attempted)) options.push({ do: 'move', to: navigation.scene })
      }
    }
    for (const exit of observation.exits) options.push({ do: 'travel', to: exit.location })
    options.push({ do: 'wait', ticks: 1 })
  }
  if (!options.length) return null
  if (mode === 'explore') {
    // Сохраняем приоритет обхода карты; затем уходим в новую сцену по хотспоту.
    const freshLocation = options.find((option) => option.do === 'travel' && !visitedLocations.has(option.to))
    if (freshLocation) return freshLocation
    const freshNavigation = options.find((option) => option.do === 'move')
    if (freshNavigation) return freshNavigation
  }
  return options[Math.floor(rng() * options.length)]!
}

async function cmdSearch(config: RunConfig, mode: 'fuzz' | 'explore', stepsLimit: number): Promise<RunResult> {
  const { campaign, engine, engineVersion } = await loadEngine(config.campaignDir, config.seed, config.debug, config.injection)
  const rng = seedrandom(`${config.seed}:${mode}`) as unknown as () => number
  const observe = makeObserver(engine, campaign)
  const steps: AnyObj[] = []
  const seen = { scenes: new Set<string>(), locations: new Set<string>(), dialogues: new Set<string>(), choices: new Set<string>(), endings: new Set<string>() }
  let status: RunResult['status'] = 'ok'
  let stale = 0
  let lastSignature = ''
  const attemptedNavigations = new Set<string>()

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
    const progressSignature = config.followNavigation === false ? '' : navigationProgressSignature(engine)
    const action = chooseAction(
      rng,
      observation,
      mode,
      seen.locations,
      seen.scenes,
      attemptedNavigations,
      progressSignature,
      config.followNavigation !== false,
    )
    if (!action) {
      status = 'softlock'
      break
    }
    if (action.do === 'move') {
      attemptedNavigations.add(navigationAttemptKey(observation.scene, String(action.to), progressSignature))
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
    evidence: isInjected(config.injection) ? 'injected' : 'honest',
    injected: injectionNotes(config.injection),
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

// ──────────────────────────────── check ─────────────────────────────────────

async function cmdCheck(
  config: RunConfig,
  seeds: [number, number],
  stepsLimit: number,
  routesDir: string | null,
  packRegistryPath: string | null = null,
): Promise<{ result: AnyObj; text: string }> {
  const packResolution = await resolveProjectPackForCheck(config.campaignDir, packRegistryPath)
  if (packResolution?.status === 'missing') {
    const diagnostic = packResolution.diagnostic
    return {
      result: {
        campaign: { id: basename(config.campaignDir), title: basename(config.campaignDir) },
        verdict: 'failed',
        problems: [diagnostic.message],
        error: diagnostic,
      },
      text: `${diagnostic.code}: ${diagnostic.message}`,
    }
  }
  const { campaign, engine } = await loadEngine(config.campaignDir, config.seed, false, emptyInjection())
  const graph = analyzeCampaign(campaign)
  const errors = graph.findings.filter((finding) => finding.severity === 'error')
  const warnings = graph.findings.filter((finding) => finding.severity === 'warning')

  // Statically invalid data already has a precise diagnostic. Valid campaigns must
  // execute a real pack event; construction or sim failure aborts the check.
  let pack: AnyObj = null
  if (!errors.length) {
    const content = await loadNarrativeContent(config.campaignDir)
    const binding = createNarrativePackBinding(content, NARRATIVE_PACK_MANIFEST)
    const host = engine.attachPackSim(binding)
    if (!(host instanceof PackHost)) throw new Error('PACK_RUNTIME_MISSING: cf-play did not receive a PackHost')
    const event = narrativeEntryEvent(content, binding.state)
    const before = binding.state
    const after = engine.runPackSim(event, seeds[0]) as NarrativeState
    const execution = engine.packExecution
    if (!execution || execution.steps !== 1) throw new Error('PACK_RUNTIME_MISSING: narrative.sim did not execute')
    pack = {
      ...execution,
      event: event.type,
      from: { scene: before.scene, location: before.location, fmv: before.fmv?.phase ?? null },
      to: { scene: after.scene, location: after.location, fmv: after.fmv?.phase ?? null },
    }
  }

  const routeFiles: string[] = []
  const dir = routesDir ?? join(config.campaignDir, 'routes')
  if (existsSync(dir)) {
    for (const name of await readdir(dir)) if (name.endsWith('.json')) routeFiles.push(join(dir, name))
  }
  const routeRuns: AnyObj[] = []
  for (const file of routeFiles.sort()) {
    const script = JSON.parse(await readFile(file, 'utf8')) as AnyObj
    const out = config.outDir ? join(config.outDir, 'routes', basename(file, '.json')) : null
    const routeSeed = script.seed === undefined ? config.seed : String(script.seed)
    const run = await cmdRun({ ...config, seed: routeSeed, outDir: out, routeName: file }, script)
    routeRuns.push({ file, status: run.status, steps: run.steps, assertions: run.assertions, transcript: run.hashes.transcript })
  }

  const sweep = await cmdSweep(
    { ...config, quiet: true, outDir: config.outDir ? join(config.outDir, 'sweep') : null },
    seeds,
    stepsLimit,
  )
  const sweepResult = sweep.result
  const visited = new Set<string>()
  // покрытие из sweep.result.coverage.scenes.seen
  const seenScenes = ((sweepResult.coverage as AnyObj)?.scenes ?? {}) as AnyObj
  for (const scene of (seenScenes.seen ?? []) as string[]) visited.add(String(scene))
  const uncovered = (graph.reachability.scenes.reachable as string[]).filter((scene) => !visited.has(scene))

  const problems: string[] = []
  if (errors.length) problems.push(`статических ошибок: ${errors.length}`)
  for (const run of routeRuns) if (run.status !== 'ok') problems.push(`маршрут ${run.file}: ${run.status}`)
  if (sweepResult.status !== 'ok') problems.push(`sweep: ${sweepResult.status}`)

  const verdict = problems.length ? 'failed' : 'ok'
  const result = {
    campaign: { id: graph.campaign.id, title: graph.campaign.title },
    verdict,
    problems,
    pack,
    graph: {
      counts: graph.counts,
      errors: errors.map((finding) => `${finding.code}: ${finding.message}`),
      warnings: warnings.map((finding) => `${finding.code}: ${finding.message}`),
      reachability: graph.reachability,
    },
    routes: routeRuns,
    sweep: {
      status: sweepResult.status,
      seeds: (sweepResult.stats as AnyObj)?.seeds,
      finals: (sweepResult.stats as AnyObj)?.finals,
      endings: (sweepResult.stats as AnyObj)?.endings,
      deaths: (sweepResult.stats as AnyObj)?.deaths,
    },
    coverage: { visited: visited.size, total: graph.reachability.scenes.reachable.length, seen: [...visited].sort(), uncovered },
  }

  const text: string[] = []
  text.push(`# Проверка кампании · ${graph.campaign.title}`)
  text.push('')
  text.push(verdict === 'ok' ? '✓ проверка пройдена' : '✗ проверка не пройдена')
  if (problems.length) {
    text.push('')
    for (const problem of problems) text.push(`- ✗ ${problem}`)
  }
  text.push('')
  text.push('## Статика')
  text.push(`${graph.counts.scenes} сцен · ${graph.counts.locations} локаций · ${graph.counts.dialogues} диалогов · ${graph.counts.inkKnots} узлов ink`)
  text.push(`ошибок ${errors.length} · предупреждений ${warnings.length}`)
  for (const finding of [...errors, ...warnings].slice(0, 12)) text.push(`- ${finding.code}: ${finding.message}`)
  text.push('')
  text.push('## Маршруты')
  if (!routeFiles.length) text.push(`маршрутов нет (${dir}) — прогон только по seed'ам`)
  for (const run of routeRuns) text.push(`- ${basename(run.file)}: ${run.status}, шагов ${run.steps}`)
  text.push('')
  text.push('## Матрица seed\'ов')
  text.push(`seed'ов ${(sweepResult.stats as AnyObj)?.seeds ?? 0} · исходы ${JSON.stringify((sweepResult.stats as AnyObj)?.finals ?? {})}`)
  const endings = ((sweepResult.stats as AnyObj)?.endings ?? []) as string[]
  if (endings.length) text.push(`концовки: ${endings.join(', ')}`)
  if (Object.keys(((sweepResult.stats as AnyObj)?.deaths ?? {}) as AnyObj).length) {
    text.push(`смерти: ${JSON.stringify((sweepResult.stats as AnyObj)?.deaths)}`)
  }
  text.push('')
  text.push('## Покрытие')
  text.push(`посещено ${visited.size} из ${graph.reachability.scenes.reachable.length} достижимых сцен`)
  if (visited.size) text.push(`сцены: ${[...visited].sort().join(', ')}`)
  if (uncovered.length) text.push(`не покрыто: ${uncovered.slice(0, 15).join(', ')}${uncovered.length > 15 ? ` … ещё ${uncovered.length - 15}` : ''}`)

  if (config.outDir) {
    await mkdir(config.outDir, { recursive: true })
    await writeFile(join(config.outDir, 'report.json'), JSON.stringify(result, null, 2), 'utf8')
    await writeFile(join(config.outDir, 'report.md'), text.join('\n') + '\n', 'utf8')
    await writeFile(join(config.outDir, 'graph.json'), JSON.stringify(graph, null, 2), 'utf8')
    await writeFile(join(config.outDir, 'graph.md'), formatGraphReport(graph), 'utf8')
  }
  return { result, text: text.join('\n') + '\n' }
}

// ─────────────────────────── обзор диалога ─────────────────────────────────

interface DialogueBranch {
  path: number[]
  lines: Array<{ speaker: string; text: string }>
  choices: string[]
  chosen: string[]
  flags: Record<string, boolean>
  quests: Record<string, string>
  combat: string | null
  over: string | null
  closed: boolean
  errors: string[]
}

async function cmdDialogue(
  config: RunConfig,
  target: string,
  maxDepth: number,
  maxNodes: number,
): Promise<{ branches: DialogueBranch[]; report: AnyObj; text: string }> {
  const { campaign, engine } = await loadEngine(config.campaignDir, config.seed, true, config.injection)
  const { GameEngine } = await import('../../src/core/engine')

  let npcId = target
  if (!campaign.entities?.[npcId] || campaign.entities[npcId].type !== 'npc') {
    const found = (Object.values(campaign.entities ?? {}) as AnyObj[]).find(
      (entity) => entity.type === 'npc' && String(entity.dialogue ?? '') === target,
    )
    if (!found) throw new Error(`не найден NPC или диалог «${target}»`)
    npcId = String(found.id)
  }
  const npc = campaign.entities[npcId] as AnyObj
  const baseState = JSON.parse(JSON.stringify(engine.state)) as AnyObj
  const baseFlags = { ...(baseState.flags ?? {}) }
  const baseQuests = Object.fromEntries(Object.entries((baseState.quests ?? {}) as Record<string, AnyObj>).map(([id, q]) => [id, String(q?.stage ?? '')]))

  const branches: DialogueBranch[] = []
  const seenFlags = new Set<string>()
  const queue: Array<{ path: number[]; chosen: string[] }> = [{ path: [], chosen: [] }]
  let truncated = false

  while (queue.length) {
    if (branches.length >= maxNodes) {
      truncated = true
      break
    }
    const item = queue.shift()!
    const state = JSON.parse(JSON.stringify(baseState)) as AnyObj
    const probe = new GameEngine(campaign as never, state as never) as AnyObj
    const lines: Array<{ speaker: string; text: string }> = []
    const errors: string[] = []
    const pushLine = (speaker: string, text: string) => {
      const last = lines[lines.length - 1]
      if (last && last.text === text && last.speaker === speaker) return
      lines.push({ speaker, text })
    }
    try {
      probe.startDialogue(npcId)
    } catch (error) {
      errors.push(String((error as Error)?.message ?? error))
    }
    if (probe.lastDialogueError) errors.push(String(probe.lastDialogueError))
    for (const index of item.path) {
      if (!probe.dialogue) break
      probe.chooseDialogueOption(index)
      if (probe.lastDialogueError && !errors.includes(String(probe.lastDialogueError))) {
        errors.push(String(probe.lastDialogueError))
      }
    }
    // История хранит и реплики, и эхо выбора; текущие строки берём из неё,
    // а из открытого диалога — только то, чего в истории ещё нет.
    for (const line of (probe.dialogueHistory ?? []) as AnyObj[]) {
      pushLine(String(line.speaker ?? npc.label ?? ''), String(line.text ?? ''))
    }
    const ui = probe.dialogue as AnyObj | null
    for (const line of ((ui?.lines ?? []) as AnyObj[])) {
      if (line.action) continue
      pushLine(String(line.speaker ?? npc.label ?? ''), String(line.text ?? ''))
    }

    const flags = Object.fromEntries(
      Object.entries(probe.state.flags ?? {}).filter(([name, value]) => !baseFlags[name] && value),
    ) as Record<string, boolean>
    for (const name of Object.keys(flags)) seenFlags.add(name)
    const quests = Object.fromEntries(
      Object.entries((probe.state.quests ?? {}) as Record<string, AnyObj>)
        .map(([id, q]) => [id, String(q?.stage ?? '')])
        .filter(([id, stage]) => baseQuests[id] !== stage),
    ) as Record<string, string>

    const choices = ui ? ((ui.choices ?? []) as AnyObj[]).map((choice) => String(choice.text)) : []
    branches.push({
      path: item.path,
      lines,
      choices,
      chosen: item.chosen,
      flags,
      quests,
      combat: probe.combat ? String(probe.combat.arena?.id ?? 'combat') : null,
      over: probe.state.game_over ? `${probe.state.game_over.type}: ${probe.state.game_over.reason ?? ''}` : null,
      closed: !ui && !probe.combat && !probe.state.game_over,
      errors,
    })

    if (ui && choices.length && item.path.length < maxDepth) {
      for (let index = 0; index < choices.length; index++) {
        queue.push({ path: [...item.path, index], chosen: [...item.chosen, choices[index]!] })
      }
    }
  }

  const uniqueLines = new Set(branches.flatMap((branch) => branch.lines.map((line) => line.text))).size
  const uniqueChoices = new Set(branches.flatMap((branch) => branch.choices)).size
  const report = {
    npc: npcId,
    npcLabel: String(npc.label ?? npcId),
    dialogue: String(npc.dialogue ?? ''),
    branches: branches.length,
    maxDepth,
    truncated,
    uniqueLines,
    uniqueChoices,
    flags: [...seenFlags].sort(),
    closedWithoutEffect: branches.filter((branch) => branch.closed).length,
    errors: [...new Set(branches.flatMap((branch) => branch.errors))],
    paths: branches.map((branch) => ({
      chosen: branch.chosen,
      choicesLeft: branch.choices.length,
      flags: branch.flags,
      quests: branch.quests,
      combat: branch.combat,
      over: branch.over,
    })),
  }

  const lines: string[] = []
  lines.push(`# Разбор диалога · ${report.npcLabel}`)
  lines.push('')
  lines.push(`файл \`${report.dialogue}\` · ветвей ${report.branches} · реплик ${report.uniqueLines} · вариантов ${report.uniqueChoices}`)
  if (truncated) lines.push('')
  if (truncated) lines.push('> обход обрезан по лимиту ветвей; увеличьте --max-nodes')
  if (report.errors.length) {
    lines.push('', '## Ошибки')
    for (const error of report.errors) lines.push(`- ✗ ${error}`)
  }
  const flagLine = report.flags.length ? report.flags.join(', ') : 'нет'
  lines.push('', `**Флаги, которые выставляет разговор:** ${flagLine}`)
  lines.push('', '## Ветви')
  for (const branch of branches) {
    const path = branch.chosen.length ? branch.chosen.join(' → ') : '(начало)'
    lines.push('')
    lines.push(`### ${path}`)
    for (const line of branch.lines.slice(0, 12)) lines.push(`- ${line.speaker ? `**${line.speaker}:** ` : ''}${line.text}`)
    if (branch.lines.length > 12) lines.push(`- … ещё ${branch.lines.length - 12} реплик`)
    if (branch.choices.length) lines.push(`- варианты: ${branch.choices.map((choice) => `«${choice}»`).join(' · ')}`)
    if (Object.keys(branch.flags).length) lines.push(`- флаги: ${Object.keys(branch.flags).join(', ')}`)
    if (Object.keys(branch.quests).length) lines.push(`- квесты: ${Object.entries(branch.quests).map(([id, stage]) => `${id}→${stage}`).join(', ')}`)
    if (branch.combat) lines.push(`- бой: ${branch.combat}`)
    if (branch.over) lines.push(`- финал: ${branch.over}`)
    if (branch.closed) lines.push('- диалог закрылся без последствий (нет боя, финала и новых вариантов)')
  }
  return { branches, report, text: lines.join('\n') + '\n' }
}

// ──────────────────────────────── sweep ─────────────────────────────────────

async function cmdSweep(config: RunConfig, seeds: [number, number], stepsLimit: number): Promise<{ result: RunResult; text: string }> {
  const runs: RunResult[] = []
  const scenes = new Set<string>()
  const locations = new Set<string>()
  const dialogues = new Set<string>()
  const endings = new Set<string>()
  const deaths: Record<string, number> = {}
  const finals: Record<string, number> = {}

  for (let seed = seeds[0]; seed <= seeds[1]; seed++) {
    const one = await cmdSearch(
      { ...config, seed: String(seed), outDir: config.outDir ? join(config.outDir, `seed-${seed}`) : null },
      'explore',
      stepsLimit,
    )
    runs.push(one)
    for (const scene of (one.coverage.scenes as AnyObj).seen) scenes.add(String(scene))
    for (const location of (one.coverage.locations as AnyObj).seen) locations.add(String(location))
    for (const dialogue of (one.coverage.dialogues as AnyObj).seen) dialogues.add(String(dialogue))
    for (const ending of (one.coverage.endings as AnyObj).seen) endings.add(String(ending))
    const over = (one.coverage.final as AnyObj)?.game_over as AnyObj | null
    const key = over ? `${over.type}: ${over.reason ?? ''}` : 'не завершён'
    finals[over?.type ?? 'open'] = (finals[over?.type ?? 'open'] ?? 0) + 1
    if (over?.type === 'death') deaths[key] = (deaths[key] ?? 0) + 1
    if (!config.quiet) console.log(`seed ${seed}: ${one.status}, шагов ${one.steps}, финал ${over?.type ?? '—'}`)
  }

  const bad = runs.filter((run) => run.status !== 'ok')
  const first = runs[0]!
  const result: RunResult = {
    ...first,
    mode: 'sweep',
    status: bad.length ? 'failed' : 'ok',
    steps: runs.reduce((sum, run) => sum + run.steps, 0),
    assertions: bad.map((run) => ({ name: `seed ${run.seed}`, ok: false, detail: run.status })),
    stats: {
      seeds: runs.length,
      ok: runs.length - bad.length,
      failed: bad.length,
      finals,
      endings: [...endings].sort(),
      deaths,
    },
    hashes: { transcript: '', run: '' },
  }

  const lines: string[] = []
  lines.push(`# Обзор прогонов · ${first.campaign.title}`)
  lines.push('')
  lines.push(`seed'ов ${runs.length} · успешных ${runs.length - bad.length} · проблемных ${bad.length} · движок ${first.engine}`)
  lines.push('')
  lines.push(`Посещено сцен: ${scenes.size} · локаций: ${locations.size} · диалогов: ${dialogues.size} · концовок: ${endings.size}`)
  lines.push(`Сцены: ${[...scenes].sort().join(', ') || 'нет'}`)
  lines.push('')
  lines.push('## Исходы')
  const reportedFinals = { ...finals, open: finals.open ?? 0 }
  for (const [type, count] of Object.entries(reportedFinals).sort((a, b) => b[1] - a[1])) lines.push(`- ${type}: ${count}`)
  if (Object.keys(deaths).length) {
    lines.push('', '## Причины смерти')
    for (const [reason, count] of Object.entries(deaths).sort((a, b) => b[1] - a[1])) lines.push(`- ${reason}: ${count}`)
  }
  if (endings.size) lines.push('', `Концовки: ${[...endings].join(', ')}`)
  if (bad.length) {
    lines.push('', '## Проблемные прогоны')
    for (const run of bad) lines.push(`- seed ${run.seed}: ${run.status}`)
  }
  if (config.outDir) {
    await mkdir(config.outDir, { recursive: true })
    await writeFile(join(config.outDir, 'sweep.json'), JSON.stringify(result, null, 2), 'utf8')
    await writeFile(join(config.outDir, 'sweep.md'), lines.join('\n') + '\n', 'utf8')
  }
  return { result, text: lines.join('\n') + '\n' }
}

async function cmdVerify(dir: string, expectEngine: string | null, honestOnly: boolean): Promise<number> {
  const resultRaw = await readFile(join(dir, 'result.json'), 'utf8')
  const transcript = await readFile(join(dir, 'transcript.md'), 'utf8')
  const runRaw = await readFile(join(dir, 'run.json'), 'utf8')
  const result = JSON.parse(resultRaw) as RunResult
  const failures: string[] = []
  if (sha256(transcript) !== result.hashes.transcript) failures.push('transcript.md не совпадает с хешем в result.json')
  if (sha256(runRaw) !== result.hashes.run) failures.push('run.json не совпадает с хешем в result.json')
  if (expectEngine && result.engine !== expectEngine) failures.push(`движок ${result.engine} ≠ ожидаемого ${expectEngine}`)
  if (result.status !== 'ok') failures.push(`статус прогона: ${result.status}`)
  if (honestOnly && result.evidence === 'injected') failures.push('прогон с отладочными правками состояния не годится как приёмка (--honest)')
  if (failures.length) {
    for (const f of failures) console.error(`✗ ${f}`)
    return 1
  }
  console.log(`✓ прогон цел: ${result.campaign.id} seed ${result.seed}, движок ${result.engine}, шагов ${result.steps}`)
  return 0
}

async function cmdExplainCatalogue(): Promise<number> {
  const packs = await readInstalledPackCatalogue()
  if (!packs.length) die('explain: каталог packs/registry.json недоступен')
  for (const pack of packs) {
    console.log(`${pack.id} — ${pack.title} · v${pack.version} · runtime ${pack.runtime}`)
    console.log(`  capabilities: ${(pack.caps ?? []).join(', ') || 'нет'}`)
    console.log(`  panels: ${pack.provides.panels.map((panel) => panel.id).join(', ')}`)
    console.log(`  validators: ${pack.provides.validators.map((validator) => validator.id).join(', ')}`)
    console.log(`  probes: ${pack.provides.probes.map((probe) => probe.id).join(', ')}`)
    const seams = pack.provides.seams ?? []
    if (seams.length) console.log(`  seams: ${seams.map((seam) => `${String(seam.id)} (${String(seam.kind)})`).join(', ')}`)
  }
  return 0
}

function printKnownNarrativeCodes(): void {
  console.error(`Известные коды narrative (${NARRATIVE_CODE_LIST.length}):`)
  for (const entry of [...NARRATIVE_CODE_LIST].sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0))) {
    console.error(`  ${entry.code}`)
  }
}

function cmdExplainCode(code: string | null): number {
  if (!code) {
    console.error('cf-play explain: укажите код диагностической находки')
    printKnownNarrativeCodes()
    return 2
  }
  const explanation = findNarrativeCode(code)
  if (!explanation) {
    console.error(`cf-play explain: неизвестный код «${code}»`)
    printKnownNarrativeCodes()
    return 2
  }
  console.log(`${explanation.code} — ${explanation.title}`)
  console.log(`Почему: ${explanation.why}`)
  console.log(`Где искать: ${explanation.where}`)
  console.log(`Минимальный фикс: ${explanation.fix}`)
  return 0
}

async function cmdExample(): Promise<number> {
  const candidates = [
    join(CLI_DIR, 'examples', 'narrative'),
    join(CLI_DIR, 'examples', 'ash-of-caerden'),
    resolve(process.cwd(), 'public/campaigns/ash-of-caerden'),
    resolve(process.cwd(), 'packs/narrative/data/ash-of-caerden'),
    resolve(CLI_DIR, '../../public/campaigns/ash-of-caerden'),
    resolve(CLI_DIR, '../../packs/narrative/data/ash-of-caerden'),
  ]
  const campaignDir = candidates.find((candidate) => existsSync(join(candidate, 'campaign.json')))
  if (!campaignDir) {
    die('example: эталон narrative не найден; используйте кит с examples/narrative или запустите из клона Narthex')
  }
  const config: RunConfig = {
    campaignDir,
    seed: '1',
    outDir: null,
    debug: false,
    quiet: false,
    injection: emptyInjection(),
    record: null,
    // Keep the documented sample's long-standing golden coverage; normal check/explore/sweep follow navigation.
    followNavigation: false,
  }
  const { result, text } = await cmdCheck(config, [1, 5], 300, null)
  process.stdout.write(text)
  const counts = (result.graph?.counts ?? {}) as AnyObj
  const deaths = (result.sweep?.deaths ?? {}) as Record<string, number>
  const deathTotal = Object.values(deaths).reduce((sum, count) => sum + Number(count), 0)
  const errors = Array.isArray(result.graph?.errors) ? result.graph.errors.length : 0
  const warnings = Array.isArray(result.graph?.warnings) ? result.graph.warnings.length : 0
  const coverage = (result.coverage ?? {}) as AnyObj
  console.log(
    `Эталон: ${counts.scenes} сцен · ${counts.locations} локаций · ${counts.dialogues} диалогов · ` +
      `${counts.inkKnots} ink · ошибок ${errors} · предупреждений ${warnings} · смертей ${deathTotal} · ` +
      `покрытие ${coverage.visited} из ${coverage.total}`,
  )
  return result.verdict === 'ok' ? 0 : 1
}

async function cmdCycles() {
  const repositoryRoot = resolve(CLI_DIR, '../..')
  const projects: CycleProject[] = await Promise.all([
    loadCycleProject(join(repositoryRoot, 'public/campaigns/ash-of-caerden')),
    loadCycleProject(join(repositoryRoot, '_tools/projects/realtime-wall')),
  ])
  const adapters: Readonly<Record<string, CycleAdapter>> = {
    turn: async (project) => {
      const { campaign, engine } = await loadEngine(project.directory, 'NAR-4.5-cycle-check', false, emptyInjection())
      const ticksPerDay = Number(campaign.meta.ticks_per_day)
      if (!Number.isFinite(ticksPerDay) || ticksPerDay <= 0) {
        throw new TypeError(`CF_PLAY_TURN_TICKS_INVALID: ${ticksPerDay}`)
      }
      const initialTick = Number(engine.state.tick)
      const assertions: CycleAssertion[] = [{
        name: 'the turn executor advances exactly one campaign tick',
        path: 'tick',
        op: 'equals',
        expected: initialTick + 1,
      }]
      const setup: CycleSetup = {
        executor: new TurnExecutor(engine),
        steps: [{ dt: (24 * 60 * 60 * 1000) / ticksPerDay, input: [] }],
        assertions,
        summaryPaths: ['tick', 'scene', 'location'],
      }
      return setup
    },
    realtime: createRealtimeProjectSetup,
  }
  return runCycleProjects(projects, adapters)
}

// ──────────────────────────────── main ──────────────────────────────────────

const USAGE = [
  'команды: check | cycles | graph | dialogue | run | explore | sweep | verify | explain | example',
  '',
  '  node cf-play.mjs example [narrative]',
  '  node cf-play.mjs cycles [--json]  # общая проверка turn и realtime проектов',
  '  node cf-play.mjs explain <код> | --catalogue',
  '  node cf-play.mjs check    <папка кампании> [--seeds 1-5] [--steps 300] [--routes dir] [--pack-registry file] [--out runs/check]',
  '',
  '  node cf-play.mjs graph    <папка кампании> [--out dir] [--json]',
  '  node cf-play.mjs dialogue <папка кампании> <npcId|dialogues/x.ink> [--depth 3] [--max-nodes 40]',
  '  node cf-play.mjs run      <папка кампании> --seed 42 --script route.json --out runs/a',
  '  node cf-play.mjs explore  <папка кампании> --seed 7 --steps 300 [--record route.json]',
  '  node cf-play.mjs fuzz     <папка кампании> --seeds 1-20 --steps 400 [--record route.json]',
  '  node cf-play.mjs sweep    <папка кампании> --seeds 1-20 [--steps 300] [--out runs/sweep]',
  '  node cf-play.mjs verify   <папка прогона> [--expect-engine 0.8.0] [--honest]',
  '',
  'отладочные правки состояния (как панель отладки в редакторе):',
  '  --set flag=1  --var name=3  --item id:2  --tick 40  --scene scene_id  --hp 5  --god',
  '  --entity npc_id=state  --quest quest_id=stage  --weather weather_id',
  '  --currency coin:5  --skill melee=60',
].join('\n')

async function main(): Promise<void> {
  const { command, positional, flags } = parseArgs(process.argv.slice(2))
  const campaignDir = positional[0] ? resolve(positional[0]) : ''
  const seed = String(flags.seed ?? '1')
  const outDir = flagText(flags, 'out') ? resolve(String(flagText(flags, 'out'))) : null
  const debug = !!flags.debug
  const asJson = !!flags.json

  if (command === 'explain') {
    if (flags.catalogue) process.exit(await cmdExplainCatalogue())
    process.exit(cmdExplainCode(positional[0] ?? null))
  }

  if (command === 'example') {
    const requested = positional[0]
    if (requested && requested !== 'narrative' && requested !== 'ash-of-caerden') {
      die(`example: неизвестный пример «${requested}» (доступен narrative)`)
    }
    process.exit(await cmdExample())
  }

  if (command === 'verify') {
    if (!campaignDir) die('verify: укажите папку прогона (с result.json)')
    process.exit(
      await cmdVerify(campaignDir, flagText(flags, 'expect-engine'), !!flags.honest),
    )
  }

  if (command === 'cycles') {
    if (positional.length) die('cycles: проектный набор задаётся внутренними манифестами, дополнительные пути не нужны')
    const report = await cmdCycles()
    if (asJson) console.log(JSON.stringify(report, null, 2))
    else process.stdout.write(formatCycleReport(report))
    process.exit(report.ok ? 0 : 1)
  }

  const CAMPAIGN_COMMANDS = ['check', 'graph', 'dialogue', 'run', 'fuzz', 'explore', 'sweep']
  if (CAMPAIGN_COMMANDS.includes(command) && campaignDir && !existsSync(join(campaignDir, 'campaign.json'))) {
    die(`${command}: в «${campaignDir}» нет campaign.json — это не папка кампании`)
  }

  if (command === 'check') {
    if (!campaignDir) die('check: укажите папку кампании')
    const range = flagText(flags, 'seeds') ?? '1-5'
    const [from, to] = range.includes('-') ? range.split('-').map(Number) : [Number(range), Number(range)]
    const config: RunConfig = {
      campaignDir,
      seed,
      outDir: outDir ?? resolve(join(campaignDir, '.cf-play', 'check')),
      debug,
      quiet: asJson,
      injection: emptyInjection(),
      record: null,
    }
    const { result, text } = await cmdCheck(
      config,
      [from!, to!],
      Number(flagText(flags, 'steps') ?? 300),
      flagText(flags, 'routes') ? resolve(String(flagText(flags, 'routes'))) : null,
      flagText(flags, 'pack-registry') ? resolve(String(flagText(flags, 'pack-registry'))) : null,
    )
    if (asJson) console.log(JSON.stringify(result, null, 2))
    else console.log(text)
    process.exit(result.verdict === 'ok' ? 0 : 1)
  }

  if (command === 'graph') {
    if (!campaignDir) die('graph: укажите папку кампании')
    const { campaign } = await loadEngine(campaignDir, seed, debug, parseInjection(flags))
    const report = analyzeCampaign(campaign)
    const text = formatGraphReport(report)
    if (outDir) {
      await mkdir(outDir, { recursive: true })
      await writeFile(join(outDir, 'graph.json'), JSON.stringify(report, null, 2), 'utf8')
      await writeFile(join(outDir, 'graph.md'), text, 'utf8')
    }
    if (asJson) console.log(JSON.stringify(report, null, 2))
    else console.log(text)
    const errors = report.findings.filter((finding) => finding.severity === 'error').length
    process.exit(errors ? 1 : 0)
  }

  if (!['dialogue', 'run', 'fuzz', 'explore', 'sweep'].includes(command)) die(USAGE)
  if (!campaignDir) die(`${command}: укажите папку кампании`)

  const config: RunConfig = {
    campaignDir,
    seed,
    outDir,
    debug,
    quiet: asJson,
    routeName: flagText(flags, 'route') ?? undefined,
    injection: parseInjection(flags),
    record: flagText(flags, 'record') ? resolve(String(flagText(flags, 'record'))) : null,
  }

  if (command === 'dialogue') {
    const target = positional[1]
    if (!target) die('dialogue: укажите npcId или путь диалога (dialogues/x.ink)')
    const { report, text } = await cmdDialogue(
      config,
      target,
      Number(flagText(flags, 'depth') ?? 3),
      Number(flagText(flags, 'max-nodes') ?? 40),
    )
    if (outDir) {
      await mkdir(outDir, { recursive: true })
      await writeFile(join(outDir, 'dialogue.json'), JSON.stringify(report, null, 2), 'utf8')
      await writeFile(join(outDir, 'dialogue.md'), text, 'utf8')
    }
    if (asJson) console.log(JSON.stringify(report, null, 2))
    else console.log(text)
    process.exit(report.errors.length ? 1 : 0)
  }

  if (command === 'sweep') {
    const range = flagText(flags, 'seeds') ?? '1-10'
    const [from, to] = range.includes('-') ? range.split('-').map(Number) : [Number(range), Number(range)]
    const { result, text } = await cmdSweep(config, [from!, to!], Number(flagText(flags, 'steps') ?? 300))
    if (asJson) console.log(JSON.stringify(result, null, 2))
    else console.log(text)
    process.exit(result.status === 'ok' ? 0 : 1)
  }

  if (command === 'run' && config.record) {
    die('run: --record не нужен — маршрут записывается из explore/fuzz, а run его проигрывает')
  }

  let result: RunResult
  if (command === 'run') {
    const scriptPath = flagText(flags, 'script')
    if (!scriptPath) die('run: нужен --script route.json')
    const script = JSON.parse(await readFile(resolve(scriptPath), 'utf8')) as AnyObj
    result = await cmdRun(config, script)
  } else if (command === 'explore') {
    result = await cmdSearch(config, 'explore', Number(flagText(flags, 'steps') ?? 300))
  } else {
    const range = flagText(flags, 'seeds') ?? '1-10'
    const [from, to] = range.includes('-') ? range.split('-').map(Number) : [Number(range), Number(range)]
    const runs: RunResult[] = []
    for (let current = from!; current <= to!; current++) {
      const one = await cmdSearch(
        { ...config, seed: String(current), outDir: outDir ? join(outDir, `seed-${current}`) : null },
        'fuzz',
        Number(flagText(flags, 'steps') ?? 400),
      )
      runs.push(one)
      if (!asJson) console.log(`seed ${current}: ${one.status}, шагов ${one.steps}, финал ${one.coverage.final?.game_over?.type ?? '—'}`)
    }
    const bad = runs.filter((run) => run.status !== 'ok')
    result = {
      ...runs[0]!,
      mode: 'fuzz',
      status: bad.length ? 'failed' : 'ok',
      steps: runs.reduce((sum, run) => sum + run.steps, 0),
      assertions: bad.map((run) => ({ name: `seed ${run.seed}`, ok: false, detail: run.status })),
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
        {
          status: result.status,
          evidence: result.evidence,
          injected: result.injected,
          campaign: result.campaign,
          seed: result.seed,
          steps: result.steps,
          assertions: result.assertions,
          coverage: result.coverage,
          hashes: result.hashes,
        },
        null,
        2,
      ),
    )
  } else {
    console.log(`\n${result.status === 'ok' ? '✓' : '✗'} ${result.campaign.title}: ${result.status}, шагов ${result.steps}, seed ${result.seed}`)
    if (result.evidence === 'injected') console.log(`  ! прогон с отладочными правками: ${result.injected.join('; ')}`)
    if (config.outDir) console.log(`  transcript: ${join(config.outDir, 'transcript.md')}`)
    const scenes = result.coverage.scenes as AnyObj
    if (scenes?.missing?.length) console.log(`  не посещено сцен: ${scenes.missing.length} из ${scenes.missing.length + scenes.seen.length}`)
  }
  process.exit(result.status === 'ok' ? 0 : 1)
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`cf-play: ${message}`)
  if (process.argv.includes('--debug') && error instanceof Error && error.stack) console.error(error.stack)
  process.exit(2)
})
