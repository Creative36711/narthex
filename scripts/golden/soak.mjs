#!/usr/bin/env node
/**
 * GOLD-1.11/GOLD-1.15 real-time browser soak. Owns a single Vite instance,
 * Chromium, browser context, and page for the entire run. The single page.reload()
 * is the explicitly logged save/reload/Continue persistence check at minute 30.
 * GOLD-1.15 is invoked by npm run playthrough:golden; the direct command remains
 * available for the historical GOLD-1.11 mode. Run npm run golden:import first.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { launchChromium, chromiumVersion } from '../visual/local-browser.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const CAMPAIGN_ROOT = join(ROOT, '.golden', 'karkas')
const REPORT_ROOT = join(ROOT, '_tools', 'reports')
const TASK = process.env.GOLDEN_SOAK_TASK ?? 'GOLD-1.11'
if (!['GOLD-1.11', 'GOLD-1.15'].includes(TASK)) throw new Error(`Unsupported golden soak task: ${TASK}`)
const REPORT_DIR = join(REPORT_ROOT, TASK)
const REPORT_PATH = join(REPORT_ROOT, `${TASK}.md`)
const LOG_PATH = join(REPORT_ROOT, `${TASK}.log`)
const SCREENSHOT_DIR = process.env.GOLDEN_SOAK_SCREENSHOT_DIR ? resolve(process.env.GOLDEN_SOAK_SCREENSHOT_DIR) : REPORT_DIR
const RUN_COMMAND = process.env.GOLDEN_SOAK_COMMAND ?? 'npm run golden:import && npm run golden:soak'
const ORCHESTRATOR_RUN_ID = process.env.GOLDEN_SOAK_ORCHESTRATOR_ID ?? null
const BASE_PLAYTHROUGH_RC = process.env.GOLDEN_BASE_PLAYTHROUGH_RC == null ? null : Number(process.env.GOLDEN_BASE_PLAYTHROUGH_RC)
const CI_RUN_ID = process.env.GITHUB_RUN_ID ?? null
const CI_EVENT = process.env.GITHUB_EVENT_NAME ?? null
const CI_SHA = process.env.GITHUB_SHA ?? null
const CI_ATTEMPT = process.env.GITHUB_RUN_ATTEMPT ?? null
const ID = randomUUID()
const PORT = Number(process.env.GOLDEN_SOAK_PORT || 4174)
const BASE_URL = `http://127.0.0.1:${PORT}`
const SESSION_MS = 60 * 60 * 1000
const CHECKPOINT_MS = 5 * 60 * 1000
const ACTION_MS = 45 * 1000
const FIRST_ACTION_MS = 15 * 1000
const MONITOR_MS = 5 * 1000
const SAVE_RELOAD_MS = 30 * 60 * 1000
const SAVE_SLOT = 1
const BRANCH = execFileSync('git', ['branch', '--show-current'], { cwd: ROOT, encoding: 'utf8' }).trim()
const manifest = JSON.parse(readFileSync(join(ROOT, '.golden', 'manifest.json'), 'utf8'))
const campaign = JSON.parse(readFileSync(join(CAMPAIGN_ROOT, 'campaign.json'), 'utf8'))
const SAVE_KEY = `narthex:save:${campaign.id}`
const MANUAL_KEY = `${SAVE_KEY}@${SAVE_SLOT}`

if (campaign.id !== 'b7305faa-8e10-4d26-96bb-f1b5ed5e493f') throw new Error(`Unexpected campaign id: ${campaign.id}`)
if (!existsSync(join(CAMPAIGN_ROOT, 'manifest.json'))) throw new Error('Run npm run golden:import before the soak.')
if (!/^[a-f0-9]{40}$/i.test(String(manifest.commit))) throw new Error('Pinned campaign commit is invalid.')
mkdirSync(REPORT_DIR, { recursive: true })
mkdirSync(SCREENSHOT_DIR, { recursive: true })
// The orchestrator initializes the combined JSONL before its base checks; keep
// those records when this child appends the soak timeline.
if (!ORCHESTRATOR_RUN_ID) writeFileSync(LOG_PATH, '')

const state = {
  browserStartedMs: null, browserStartedAt: null, finishedMs: null, finishedAt: null,
  activeStartedMs: null, activeStartedAt: null, activeEndedMs: null, activeEndedAt: null,
  browser: null, contextCount: 0, pageCount: 0, viteStarts: 0, reloadCount: 0,
  checkpoints: [], actions: [], sessionActionStart: 0, activeActionCount: null,
  lastActionMs: null, maxActionGapMs: 0, activeMaxActionGapMs: null,
  scenes: new Set(), initialHudTime: null, activeStartHudTime: null, activeEndHudTime: null,
  initialGameState: null, startCheckpoint: null, firstClue: null, hudTimeline: [],
  backgroundSamples: 0, emptyBackgroundCount: 0, emptyBackgroundEvents: [],
  pageErrors: [], consoleErrors: [], consoleWarnings: [], httpErrors: [], requestFailures: [],
  startAudio: [], endAudio: null, persistence: null, screenshots: [], failures: [],
}
let browser, context, page, vite
let monitorActive = false
let stopRequested = false
let monitorTask = null

const show = new Set(['run_start', 'browser_ready', 'session_start', 'first_clue_reached', 'five_minute_checkpoint', 'save_reload_verified', 'menu_audio_probe', 'run_summary', 'run_complete', 'run_failure'])
function log(event, data = {}) {
  const item = { at: new Date().toISOString(), task: TASK, runId: ID, event, ...data }
  appendFileSync(LOG_PATH, `${JSON.stringify(item)}\n`)
  if (show.has(event)) console.log(`${item.at} ${event}${data.minute == null ? '' : ` minute=${data.minute}`}`)
  return item
}
function fail(message, details = {}) {
  const failure = { at: new Date().toISOString(), message, ...details }
  state.failures.push(failure)
  log('acceptance_failure', failure)
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  stopRequested = true
  log('stop_requested', { signal })
})

function normalize(value) { return String(value ?? '').replace(/\s+/g, ' ').replace(/^▸\s*/, '').trim() }
function parseHudMinutes(value) {
  const match = String(value ?? '').match(/День\s+(\d+)\s*,\s*(\d{2}):(\d{2})/)
  return match ? ((Number(match[1]) - 1) * 24 + Number(match[2])) * 60 + Number(match[3]) : null
}
function mime(path) {
  return ({ '.avif':'image/avif', '.gif':'image/gif', '.jpeg':'image/jpeg', '.jpg':'image/jpeg', '.json':'application/json', '.md':'text/markdown; charset=utf-8', '.mp3':'audio/mpeg', '.ogg':'audio/ogg', '.png':'image/png', '.svg':'image/svg+xml', '.txt':'text/plain; charset=utf-8', '.webp':'image/webp', '.woff':'font/woff', '.woff2':'font/woff2' })[extname(path).toLowerCase()] || 'application/octet-stream'
}
async function waitForServer() {
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    if (vite.exitCode !== null) throw new Error(`Vite exited early (${vite.exitCode}).`)
    try { if ((await fetch(`${BASE_URL}/`)).ok) return } catch { /* starting */ }
    await delay(200)
  }
  throw new Error(`Vite did not start at ${BASE_URL}.`)
}
async function installCampaignRoutes(target) {
  await target.route('**/campaigns/**', async (route) => {
    const url = new URL(route.request().url())
    const pathname = decodeURIComponent(url.pathname)
    if (pathname === '/campaigns/index.json') {
      return route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', body: JSON.stringify([{ id: campaign.id, title: campaign.title, author: campaign.author, description: campaign.description }]) })
    }
    const prefix = `/campaigns/${campaign.id}/`
    if (!pathname.startsWith(prefix)) return route.continue()
    const relativePath = pathname.slice(prefix.length)
    const file = resolve(CAMPAIGN_ROOT, relativePath)
    if (file !== CAMPAIGN_ROOT && !file.startsWith(`${CAMPAIGN_ROOT}${sep}`)) return route.fulfill({ status: 403, body: 'Forbidden' })
    if (!existsSync(file) || !statSync(file).isFile()) return route.fulfill({ status: 404, contentType: 'text/plain; charset=utf-8', body: `Missing pinned campaign resource: ${relativePath}` })
    return route.fulfill({ status: 200, contentType: mime(file), body: readFileSync(file) })
  })
}

function recordAction(action, details = {}) {
  const now = Date.now()
  const gap = state.lastActionMs == null ? null : now - state.lastActionMs
  if (state.activeStartedMs != null && gap != null) {
    state.maxActionGapMs = Math.max(state.maxActionGapMs, gap)
    if (gap > 60_000) fail('UI/game action gap exceeded 60 seconds.', { gapSeconds: gap / 1000, action })
  }
  const item = { at: new Date(now).toISOString(), elapsedSeconds: state.activeStartedMs == null ? null : Number(((now - state.activeStartedMs) / 1000).toFixed(1)), action, gapSeconds: gap == null ? null : Number((gap / 1000).toFixed(1)), ...details }
  state.actions.push(item)
  state.lastActionMs = now
  log('ui_action', item)
}
async function click(locator, action, details = {}, timeout = 15_000) {
  await locator.waitFor({ state: 'visible', timeout })
  await locator.click({ timeout })
  recordAction(action, details)
}
async function button(name, action = `click:${name}`) {
  await click(page.getByRole('button', { name, exact: true }).first(), action)
}
async function fill(locator, value, action, details = {}) {
  await locator.waitFor({ state: 'visible', timeout: 15_000 })
  await locator.fill(value)
  recordAction(action, details)
}

async function waitForPaint() {
  await page.waitForFunction(() => [...document.images].every((image) => image.complete), undefined, { timeout: 12_000 }).catch(() => {})
  await page.waitForTimeout(250)
}
async function waitForBackgroundReady() {
  await page.waitForFunction(() => {
    const map = document.querySelector('.map-screen')
    const scene = document.querySelector('.scene-stage')
    const menu = document.querySelector('.main-menu')
    const image = map?.querySelector('img.map-bg') || scene?.querySelector('img.scene-bg') || menu?.querySelector('img.menu-bg')
    const vector = map?.querySelector('svg.map-bg, .map-bg svg') || scene?.querySelector('.scene-bg svg')
    const fallback = map?.querySelector('.map-bg-fallback') || scene?.querySelector('.scene-bg-fallback')
    return !image || image.complete || !!vector || !!fallback
  }, undefined, { timeout: 10_000 }).catch(() => {})
}
async function runtimeState() {
  return page.evaluate((key) => {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return null
      const envelope = JSON.parse(raw)
      const s = envelope?.state ?? envelope
      return { scene: s?.scene ?? null, location: s?.location ?? null, tick: Number.isFinite(s?.tick) ? s.tick : null, flags: s?.flags && typeof s.flags === 'object' ? s.flags : {}, game_over: s?.game_over ?? null, hudTime: document.querySelector('.hud-time')?.textContent?.trim() ?? null }
    } catch { return null }
  }, SAVE_KEY)
}
async function screenState() {
  return page.evaluate((key) => {
    let runtime = null
    try { const raw = localStorage.getItem(key); const envelope = raw ? JSON.parse(raw) : null; runtime = envelope?.state ?? envelope } catch { /* no save yet */ }
    const map = document.querySelector('.map-screen')
    const scene = document.querySelector('.scene-stage')
    const menu = document.querySelector('.main-menu')
    const creation = document.querySelector('.char-create')
    let bg = { kind: 'not-applicable', empty: false, source: null, width: null, height: null }
    if (map) {
      const image = map.querySelector('img.map-bg')
      const vector = map.querySelector('svg.map-bg, .map-bg svg')
      const fallback = map.querySelector('.map-bg-fallback')
      if (fallback) bg = { kind: 'map-fallback', empty: true, source: null, width: null, height: null }
      else if (image) bg = { kind: 'map-image', empty: !image.complete || image.naturalWidth === 0 || image.naturalHeight === 0, source: image.currentSrc || image.src, width: image.naturalWidth, height: image.naturalHeight }
      else if (vector) bg = { kind: 'map-art', empty: false, source: 'inline-svg', width: null, height: null }
      else bg = { kind: 'map-missing', empty: true, source: null, width: null, height: null }
    } else if (scene) {
      const image = scene.querySelector('img.scene-bg')
      const vector = scene.querySelector('.scene-bg svg')
      const fallback = scene.querySelector('.scene-bg-fallback')
      if (fallback) bg = { kind: 'scene-fallback', empty: true, source: null, width: null, height: null }
      else if (image) bg = { kind: 'scene-image', empty: !image.complete || image.naturalWidth === 0 || image.naturalHeight === 0, source: image.currentSrc || image.src, width: image.naturalWidth, height: image.naturalHeight }
      else if (vector) bg = { kind: 'scene-art', empty: false, source: 'inline-svg', width: null, height: null }
      else bg = { kind: 'scene-missing', empty: true, source: null, width: null, height: null }
    } else if (menu) {
      const image = menu.querySelector('img.menu-bg')
      if (image) bg = { kind: 'menu-image', empty: !image.complete || image.naturalWidth === 0 || image.naturalHeight === 0, source: image.currentSrc || image.src, width: image.naturalWidth, height: image.naturalHeight }
      else bg = { kind: 'menu-missing', empty: true, source: null, width: null, height: null }
    } else if (creation) bg = { kind: 'hero-creation', empty: false, source: null, width: null, height: null }
    const hudTime = document.querySelector('.hud-time')?.textContent?.trim() ?? null
    const match = String(hudTime ?? '').match(/День\s+(\d+)\s*,\s*(\d{2}):(\d{2})/)
    const hudMinutes = match ? ((Number(match[1]) - 1) * 24 + Number(match[2])) * 60 + Number(match[3]) : null
    return { screen: map ? 'map' : scene ? 'scene' : menu ? 'menu' : creation ? 'hero-creation' : 'other', scene: runtime?.scene ?? null, location: runtime?.location ?? null, tick: Number.isFinite(runtime?.tick) ? runtime.tick : null, flags: runtime?.flags && typeof runtime.flags === 'object' ? runtime.flags : {}, hudTime, hudMinutes, background: bg, emptyBackground: bg.empty === true, sceneLabel: document.querySelector('.scene-name')?.textContent?.trim() ?? null }
  }, SAVE_KEY)
}
function noteBackground(metrics, source) {
  state.backgroundSamples++
  if (metrics.scene) state.scenes.add(metrics.scene)
  if (!metrics.emptyBackground) return
  state.emptyBackgroundCount++
  const item = { at: new Date().toISOString(), source, screen: metrics.screen, scene: metrics.scene, hudTime: metrics.hudTime, background: metrics.background, cumulative: state.emptyBackgroundCount }
  state.emptyBackgroundEvents.push(item)
  log('empty_background_sample', item)
}
async function sampleBackground(source) {
  if (!page || page.isClosed()) return null
  await waitForBackgroundReady()
  const metrics = await screenState()
  noteBackground(metrics, source)
  return metrics
}
async function monitorBackgrounds() {
  while (monitorActive) {
    try { await sampleBackground('continuous-5s-monitor') }
    catch (error) { log('background_monitor_error', { message: String(error?.stack ?? error).slice(0, 1500) }) }
    await delay(MONITOR_MS)
  }
}
async function checkpoint(minute, screenshotName = null) {
  await waitForBackgroundReady()
  const metrics = await screenState()
  noteBackground(metrics, `checkpoint-${minute}`)
  let screenshot = null
  if (screenshotName) {
    const path = join(SCREENSHOT_DIR, screenshotName)
    await page.screenshot({ path, type: 'png', fullPage: false, animations: 'disabled' })
    screenshot = { path: relative(ROOT, path).split(sep).join('/'), width: 1440, height: 900, bytes: statSync(path).size }
    state.screenshots.push(screenshot)
  }
  const activeFlags = Object.entries(metrics.flags ?? {}).filter(([, value]) => Boolean(value)).map(([name]) => name).sort()
  const clueFlags = activeFlags.filter((name) => name.startsWith('clue_') || name === 'pump_seen')
  const cp = {
    minute, at: new Date().toISOString(), elapsedSeconds: Number(((Date.now() - state.activeStartedMs) / 1000).toFixed(1)),
    scene: metrics.scene, location: metrics.location, tick: metrics.tick, hudTime: metrics.hudTime,
    flags: activeFlags, clueFlags, pageerror: state.pageErrors.length,
    consoleError: state.consoleErrors.length, httpError: state.httpErrors.length,
    emptyBackgroundCount: state.emptyBackgroundCount,
    actionsSincePreviousCheckpoint: state.actions.length - (state.checkpoints.at(-1)?.actionsCumulative ?? state.sessionActionStart),
    actionsCumulative: state.actions.length, sceneLabel: metrics.sceneLabel, background: metrics.background, screenshot,
  }
  state.checkpoints.push(cp)
  if (minute === 0) state.startCheckpoint = cp
  log('five_minute_checkpoint', cp)
  return cp
}
async function waitForScene(sceneId, timeout = 25_000) {
  const id = sceneId.replace(/^scene_/, '')
  await page.waitForFunction(({ id, key }) => {
    const image = document.querySelector('img.scene-bg')
    const src = image?.getAttribute('src') || ''
    if (src.includes(`/scene_${id}.`) || src.includes(`/scene_${id}_`)) return true
    try { const raw = localStorage.getItem(key); const s = raw ? (JSON.parse(raw)?.state ?? JSON.parse(raw)) : null; return s?.scene === `scene_${id}` && image?.complete && image.naturalWidth > 0 } catch { return false }
  }, { id, key: SAVE_KEY }, { timeout })
  await waitForPaint()
  const s = await runtimeState()
  if (s?.scene) state.scenes.add(s.scene)
  return s
}

async function settleOverlays(timeout = 30_000, includeDialogue = true) {
  const deadline = Date.now() + timeout
  let loops = 0
  while (Date.now() < deadline && loops++ < 100) {
    const cutscene = page.locator('.cutscene-overlay')
    if (await cutscene.count()) {
      const skip = cutscene.getByRole('button', { name: /^(Пропустить|Закрыть)$/ }).last()
      if (await skip.count()) await click(skip, 'dismiss_cutscene')
      else await click(cutscene.locator('.cs-stage'), 'advance_cutscene')
      continue
    }
    const narrative = page.locator('.scene-narrative-overlay')
    if (await narrative.count()) {
      const skip = narrative.getByRole('button', { name: /Пропустить/ }).first()
      if (await skip.count()) await click(skip, 'skip_scene_narrative')
      else await click(narrative.getByRole('button').last(), 'advance_scene_narrative')
      continue
    }
    const postcard = page.locator('.cf-postcard, .postcard-overlay, .postcard-layer').first()
    if (await postcard.count()) {
      const b = postcard.getByRole('button').last()
      if (await b.count()) await click(b, 'dismiss_postcard')
      else await click(postcard, 'dismiss_postcard_overlay')
      continue
    }
    const message = page.locator('.message-overlay').first()
    if (await message.count()) {
      const ok = message.getByRole('button', { name: 'Ок', exact: true })
      const next = message.getByRole('button', { name: /^(Продолжить|Далее|Закрыть)$/ }).last()
      if (await ok.count()) await click(ok, 'dismiss_message')
      else if (await next.count()) await click(next, 'dismiss_message')
      else await click(message, 'dismiss_message_overlay')
      continue
    }
    const dialogue = page.locator('.dialogue-overlay')
    if (includeDialogue && await dialogue.count()) {
      const b = dialogue.getByRole('button').last()
      if (await b.count()) { await click(b, 'advance_dialogue'); continue }
    }
    const selector = includeDialogue ? '.cutscene-overlay,.scene-narrative-overlay,.message-overlay,.dialogue-overlay,.cf-postcard,.postcard-overlay,.postcard-layer' : '.cutscene-overlay,.scene-narrative-overlay,.message-overlay,.cf-postcard,.postcard-overlay,.postcard-layer'
    if (!(await page.locator(selector).count())) return
    await page.waitForTimeout(200)
  }
  throw new Error(`Narrative overlays did not settle within ${timeout}ms.`)
}
async function audioProbe(phase) {
  await page.waitForTimeout(1600)
  const attempts = await page.evaluate(() => (window.__GOLDEN11_AUDIO__ || []).map(({ element, record }) => ({
    requestedSource: record.source, currentSource: element.currentSrc || element.src || record.source,
    durationSeconds: Number.isFinite(element.duration) ? Number(element.duration.toFixed(3)) : null,
    currentTimeSeconds: Number(element.currentTime.toFixed(3)), playingEvent: record.playingEvent,
    playError: record.playError, paused: element.paused, volume: element.volume, loop: element.loop, readyState: element.readyState,
  })))
  const menu = attempts.filter((x) => x.currentSource?.includes('music_menu.mp3') || x.requestedSource?.includes('music_menu.mp3'))
  const asset = 'assets/audio/music/music_menu.mp3'
  const fileSizeBytes = existsSync(join(CAMPAIGN_ROOT, asset)) ? statSync(join(CAMPAIGN_ROOT, asset)).size : 0
  const result = { phase, asset, fileSizeBytes, attempts: menu, playbackObserved: menu.some((x) => x.playingEvent || x.currentTimeSeconds > 0) }
  if (phase.startsWith('start')) state.startAudio.push(result); else state.endAudio = result
  log('menu_audio_probe', result)
  return result
}

async function talkToIra() {
  const slot = page.locator('.slot-hotspot').filter({ hasText: /пульта/ }).first()
  await click(slot, 'interact_with_ira', { entity: 'npc_ira', slotLabel: 'У пульта' })
  const dialogue = page.locator('.dialogue-overlay')
  await dialogue.waitFor({ state: 'visible', timeout: 12_000 })
  const skip = dialogue.getByRole('button', { name: /Пропустить/ }).first()
  if (await skip.count()) await click(skip, 'skip_ira_dialogue_line')
  await page.waitForFunction(() => !!document.querySelector('.dialogue-overlay .dialogue-choices .choice-btn'), undefined, { timeout: 12_000 })
  const choice = dialogue.getByRole('button', { name: /Расскажи, что случилось в ночь тринадцатого\./ }).first()
  const label = normalize(await choice.innerText())
  await click(choice, 'choose_ira_story_question', { choice: label })
  await settleOverlays(25_000, false)
  const skipAgain = dialogue.getByRole('button', { name: /Пропустить/ }).first()
  if (await skipAgain.count()) await click(skipAgain, 'skip_ira_response')
  await page.waitForFunction(() => !!document.querySelector('.dialogue-overlay .dialogue-choices .choice-btn'), undefined, { timeout: 12_000 })
  const finish = dialogue.getByRole('button', { name: /Закончить разговор/ }).last()
  if (await finish.count()) await click(finish, 'end_ira_dialogue')
  else {
    const leave = dialogue.getByRole('button', { name: /Мне пора/ }).last()
    if (!(await leave.count())) throw new Error('Ira dialogue has no end/leave control.')
    await click(leave, 'leave_ira_dialogue')
    if (await dialogue.count()) {
      const last = dialogue.getByRole('button', { name: /Закончить разговор/ }).last()
      if (await last.count()) await click(last, 'end_ira_dialogue')
    }
  }
  await dialogue.waitFor({ state: 'detached', timeout: 12_000 })
  await settleOverlays(20_000, false)
  const s = await runtimeState()
  if (!s?.flags?.ira_story) throw new Error(`Expected ira_story flag; state=${JSON.stringify(s)}`)
  log('gameplay_flag_assertion', { flag: 'ira_story', value: s.flags.ira_story, scene: s.scene, tick: s.tick, hudTime: s.hudTime })
  return s
}
async function investigateFirstClue() {
  for (let attempt = 1; attempt <= 8; attempt++) {
    const pumpSlot = page.locator('.slot-hotspot').filter({ hasText: 'Седьмая помпа' }).first()
    await click(pumpSlot, 'first_clue_interact_with_pump', { attempt, entity: 'item_pump_drive' })
    const itemDialog = page.locator('.itemdlg-overlay')
    await itemDialog.waitFor({ state: 'visible', timeout: 12_000 })
    const inspect = page.getByRole('button', { name: /Осмотреть привод/ }).first()
    const option = normalize(await inspect.innerText())
    await click(inspect, 'first_clue_inspect_pump_drive', { attempt, option })

    for (let dialogIndex = 1; dialogIndex <= 8; dialogIndex++) {
      const outcome = page.locator('.message-overlay:not(.itemdlg-overlay)').first()
      await outcome.waitFor({ state: 'visible', timeout: 12_000 })
      const text = normalize(await outcome.innerText()).slice(0, 1200)
      const reroll = outcome.getByRole('button', { name: 'Перебросить за удачу', exact: true })
      if (await reroll.count()) {
        await click(reroll, 'first_clue_reroll_for_luck', { attempt, dialogIndex, text })
        await page.waitForTimeout(150)
        continue
      }
      if (text.includes('Муфта срезана ровно') && text.includes('рукавица')) {
        const ok = outcome.getByRole('button', { name: 'Ок', exact: true })
        if (await ok.count()) await click(ok, 'dismiss_first_clue_success', { attempt })
        else await click(outcome, 'dismiss_first_clue_success_overlay', { attempt })
        await settleOverlays(10_000, false)
        const clueState = await runtimeState()
        if (clueState?.flags?.clue_glove !== true) throw new Error(`First-clue message appeared but clue_glove was not set: ${JSON.stringify(clueState)}`)
        const firstClue = {
          at: new Date().toISOString(),
          elapsedSeconds: Number(((Date.now() - state.activeStartedMs) / 1000).toFixed(1)),
          scene: clueState.scene,
          location: clueState.location,
          tick: clueState.tick,
          hudTime: clueState.hudTime,
          flag: 'clue_glove',
          flagValue: clueState.flags.clue_glove,
          attempt,
          pageerror: state.pageErrors.length,
          emptyBackgroundCount: state.emptyBackgroundCount,
          actionsSincePreviousCheckpoint: state.actions.length - (state.checkpoints.at(-1)?.actionsCumulative ?? state.sessionActionStart),
          actionsCumulative: state.actions.length,
          message: text,
        }
        state.firstClue = firstClue
        log('first_clue_reached', firstClue)
        return firstClue
      }
      if (text.includes('Масло, ржавчина, срез металла.')) {
        const ok = outcome.getByRole('button', { name: 'Ок', exact: true })
        await click(ok, 'dismiss_first_clue_failure', { attempt, dialogIndex, text })
        await page.waitForTimeout(150)
        break
      }
      const ok = outcome.getByRole('button', { name: 'Ок', exact: true })
      if (!(await ok.count())) throw new Error(`Unexpected first-clue result: ${JSON.stringify({ text, buttons: await outcome.getByRole('button').allTextContents() })}`)
      await click(ok, 'dismiss_first_clue_followup', { attempt, dialogIndex, text })
      await page.waitForTimeout(150)
    }
    await settleOverlays(10_000, false)
  }
  throw new Error('The first clue was not found after 8 real investigation attempts.')
}
async function travelToPump() {
  const mapNav = page.locator('.nav-zone').filter({ hasText: 'На схему ярусов' }).first()
  await click(mapNav, 'open_map_from_gate')
  await page.locator('.map-screen').waitFor({ state: 'visible', timeout: 12_000 })
  await waitForPaint()
  const pin = page.locator('.map-pin').filter({ hasText: 'Седьмая помпа' }).first()
  await pin.waitFor({ state: 'visible', timeout: 12_000 })
  const reachable = await pin.evaluate((element) => element.classList.contains('reachable') || element.classList.contains('here'))
  if (!reachable) throw new Error(`Map destination is not reachable: ${await pin.innerText()}`)
  const destination = normalize(await pin.innerText())
  await click(pin, 'select_map_destination', { destination })
  const confirm = page.locator('.travel-confirm')
  await confirm.waitFor({ state: 'visible', timeout: 12_000 })
  const card = normalize(await confirm.innerText())
  await click(confirm.getByRole('button', { name: 'В путь', exact: true }), 'start_travel', { destination, travelCard: card })
  const journey = page.locator('.travel-journey-overlay')
  await journey.waitFor({ state: 'visible', timeout: 12_000 })
  await click(journey, 'complete_travel_journey', { destination })
  await page.locator('.map-screen').waitFor({ state: 'detached', timeout: 15_000 })
  const s = await waitForScene('scene_pump_hall')
  await settleOverlays(20_000)
  log('travel_arrival', { destination, scene: s?.scene, location: s?.location, tick: s?.tick, hudTime: s?.hudTime })
  return s
}
async function navigateScene(label, sceneId, action) {
  const nav = page.locator('.nav-zone').filter({ hasText: label }).first()
  await click(nav, action, { navigation: label, destinationScene: sceneId })
  const s = await waitForScene(sceneId)
  await settleOverlays(15_000)
  log('scene_visit', { scene: s?.scene, location: s?.location, tick: s?.tick, hudTime: s?.hudTime })
}
async function shaftCircuit(n) {
  const before = await runtimeState()
  if (before?.scene !== 'scene_pump_hall') throw new Error(`Expected pump hall before shaft visit, found ${before?.scene}`)
  await navigateScene('Спуститься в шахту помпы', 'scene_pump_shaft', `soak_${n}_descend_to_shaft`)
  await navigateScene('Подняться в машинный зал', 'scene_pump_hall', `soak_${n}_return_to_pump_hall`)
}

function panel(kind) {
  const controls = page.locator('.hud-right .hud-btn')
  const defs = {
    inventory: [controls.filter({ hasText: /Вещи|Инвентарь/ }).first(), page.locator('.panel-overlay').filter({ has: page.locator('.inv-list') }).first()],
    character: [controls.filter({ hasText: /Герой|Персонаж/ }).first(), page.locator('.panel-overlay').filter({ has: page.locator('.stat-grid') }).first()],
    journal: [controls.filter({ hasText: /Журнал/ }).first(), page.locator('.panel-overlay').filter({ has: page.locator('.log-list') }).first()],
    map: [controls.filter({ hasText: /Карта/ }).first(), page.locator('.map-screen').first(), true],
    saves: [page.locator('.hud-right .hud-btn[aria-label="Сохранения"]'), page.locator('.panel-overlay').filter({ hasText: 'Автосейв' }).first()],
    help: [page.locator('.hud-right .hud-btn[data-tip="Справка"]'), page.locator('.help-overlay').first()],
  }
  if (!defs[kind]) throw new Error(`Unknown panel ${kind}`)
  return { button: defs[kind][0], panel: defs[kind][1], map: defs[kind][2] === true }
}
async function panelRoundTrip(kind, cycle) {
  const p = panel(kind)
  await click(p.button, `open_${kind}_panel`, { cycle })
  await p.panel.waitFor({ state: 'visible', timeout: 10_000 })
  if (kind === 'inventory') {
    const all = p.panel.getByRole('button', { name: 'Все', exact: true }).first()
    if (await all.count()) await click(all, 'inspect_inventory_filter', { cycle })
  } else if (kind === 'journal') {
    const tab = p.panel.getByRole('button', { name: /Сюжет/ }).first()
    if (await tab.count()) await click(tab, 'inspect_journal_story_tab', { cycle })
  } else if (kind === 'help') {
    const section = p.panel.locator('.help-title').first()
    if (await section.count()) await click(section, 'inspect_help_section', { cycle })
  }
  const close = p.map ? p.panel.getByRole('button', { name: /Закрыть/ }).first() : p.panel.locator('.panel-header button').first()
  await click(close, `close_${kind}_panel`, { cycle })
  await p.panel.waitFor({ state: 'detached', timeout: 10_000 })
}

async function snapshot(key, source) {
  return page.evaluate(({ key, source }) => {
    const raw = localStorage.getItem(key)
    if (!raw) return { source, present: false, key }
    let envelope
    try { envelope = JSON.parse(raw) } catch (error) { return { source, present: false, key, error: String(error) } }
    const s = envelope?.state ?? envelope
    const flags = s?.flags && typeof s.flags === 'object' ? Object.fromEntries(Object.entries(s.flags).sort(([a], [b]) => a.localeCompare(b))) : {}
    const hudTime = document.querySelector('.hud-time')?.textContent?.trim() ?? null
    const match = String(hudTime ?? '').match(/День\s+(\d+)\s*,\s*(\d{2}):(\d{2})/)
    const hudMinutes = match ? ((Number(match[1]) - 1) * 24 + Number(match[2])) * 60 + Number(match[3]) : null
    return { source, present: true, key, scene: s?.scene ?? null, location: s?.location ?? null, tick: Number.isFinite(s?.tick) ? s.tick : null, flags, setFlags: Object.entries(flags).filter(([, value]) => Boolean(value)).map(([name, value]) => ({ name, value })), hudTime, hudMinutes }
  }, { key, source })
}
function compareSnapshots(before, after, stage) {
  const left = before.flags ?? {}, right = after.flags ?? {}
  const names = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort()
  const changedFlags = names.filter((name) => Object.hasOwn(left, name) !== Object.hasOwn(right, name) || JSON.stringify(left[name]) !== JSON.stringify(right[name])).map((name) => ({ flag: name, before: left[name] ?? null, after: right[name] ?? null }))
  const discrepancies = [
    ...changedFlags.map((x) => ({ kind: 'flag', ...x })),
    ...(before.tick === after.tick ? [] : [{ kind: 'tick', before: before.tick, after: after.tick }]),
    ...(before.hudMinutes === after.hudMinutes ? [] : [{ kind: 'hud-time', before: before.hudTime, after: after.hudTime }]),
    ...(before.scene === after.scene ? [] : [{ kind: 'scene', before: before.scene, after: after.scene }]),
    ...(before.location === after.location ? [] : [{ kind: 'location', before: before.location, after: after.location }]),
  ]
  return { stage, flagChanges: changedFlags, beforeFlags: before.setFlags ?? [], afterFlags: after.setFlags ?? [], beforeTick: before.tick, afterTick: after.tick, beforeHudTime: before.hudTime, afterHudTime: after.hudTime, beforeScene: before.scene, afterScene: after.scene, discrepancyCount: discrepancies.length, discrepancies }
}
async function saveReloadContinue() {
  const before = await snapshot(SAVE_KEY, 'autosave immediately before manual save')
  if (!before.present || !before.flags?.ira_story || (TASK === 'GOLD-1.15' && !before.flags?.clue_glove)) {
    const expected = TASK === 'GOLD-1.15' ? 'ira_story/clue_glove' : 'ira_story'
    throw new Error(`Autosave or expected ${expected} flag(s) missing before persistence verification.`)
  }
  const p = panel('saves')
  await click(p.button, 'open_saves_for_persistence_probe')
  await p.panel.waitFor({ state: 'visible', timeout: 10_000 })
  const slot = p.panel.locator('.save-slot-row').filter({ hasText: 'Слот 1' }).first()
  await click(slot.getByRole('button', { name: 'Записать', exact: true }), 'write_manual_save_slot_1', { tick: before.tick, hudTime: before.hudTime })
  await page.waitForFunction((key) => {
    const raw = localStorage.getItem(key)
    if (!raw) return false
    try { return !!(JSON.parse(raw)?.state ?? JSON.parse(raw)) } catch { return false }
  }, MANUAL_KEY, { timeout: 10_000 })
  const manual = await snapshot(MANUAL_KEY, 'manual slot 1 after save')
  const manualComparison = compareSnapshots(before, manual, 'autosave vs explicit manual save')
  await click(p.panel.locator('.panel-header button').first(), 'close_save_panel_before_reload')
  await p.panel.waitFor({ state: 'detached', timeout: 10_000 })

  state.reloadCount++
  recordAction('page_reload_for_save_continue_verification', { reloadOrdinal: state.reloadCount, explicitlyPermitted: true })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.locator('.main-menu .campaign-title').waitFor({ state: 'visible', timeout: 30_000 })
  await waitForPaint()
  await click(page.getByRole('button', { name: 'Продолжить', exact: true }).first(), 'continue_after_reload', { savedScene: before.scene, savedTick: before.tick, savedHudTime: before.hudTime })
  const migration = page.locator('.modal-overlay[role="dialog"]')
  if (await migration.count()) {
    const continueRun = migration.getByRole('button', { name: /Продолжить забег/ }).first()
    if (!(await continueRun.count())) throw new Error('Save report modal prevented Continue.')
    await click(continueRun, 'confirm_continue_from_save_report')
  }
  await waitForScene(before.scene || 'scene_pump_hall')
  await settleOverlays(20_000)
  const after = await snapshot(SAVE_KEY, 'autosave after reload and Continue')
  const reloadComparison = compareSnapshots(before, after, 'page.reload + Continue')
  state.persistence = { reloadCount: state.reloadCount, before, manual, after, manualComparison, reloadComparison }
  log('save_reload_verified', {
    reloadCount: state.reloadCount,
    before: { scene: before.scene, location: before.location, tick: before.tick, hudTime: before.hudTime, setFlags: before.setFlags },
    manual: { scene: manual.scene, location: manual.location, tick: manual.tick, hudTime: manual.hudTime, setFlags: manual.setFlags },
    after: { scene: after.scene, location: after.location, tick: after.tick, hudTime: after.hudTime, setFlags: after.setFlags },
    manualComparison, reloadComparison,
  })
}

async function probeStartMenuAudio() {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' })
  await page.locator('.main-menu .campaign-title').waitFor({ state: 'visible', timeout: 30_000 })
  await waitForPaint()
  monitorActive = true
  monitorTask = monitorBackgrounds()
  await sampleBackground('initial-menu')
  const before = await audioProbe('start-before-user-gesture')
  await page.mouse.click(30, 30)
  recordAction('user_gesture_for_menu_audio', { target: 'main menu background' })
  const after = await audioProbe('start-after-user-gesture')
  if (!after.fileSizeBytes || !after.playbackObserved) fail('Start menu audio file/playback probe did not pass.', { before, after })
  log('menu_audio_start_summary', { before, after })
}
async function newRun() {
  await button('Новый забег', 'start_new_game')
  await page.locator('.char-create').waitFor({ state: 'visible', timeout: 15_000 })
  await fill(page.locator('.char-name'), `${TASK} soak`, 'enter_hero_name', { name: `${TASK} soak` })
  await click(page.getByRole('button', { name: /Дознаватель Надзора/ }).first(), 'select_hero_profession')
  await click(page.getByRole('button', { name: /Сыскарь/ }).first(), 'select_hero_specialty')
  await page.locator('.char-create').evaluate((element) => { element.scrollTop = 0 })
  await button('Начать забег', 'confirm_new_game')
  await waitForScene('scene_gate_hall')
  await settleOverlays(30_000)
  const start = await runtimeState()
  state.initialHudTime = start?.hudTime
  if (!state.initialHudTime) throw new Error('HUD time was not available after starting the game.')
  state.scenes.add(start.scene)

  if (TASK !== 'GOLD-1.15') {
    // Keep the standalone GOLD-1.11 command's historical timing anchor intact.
    log('initial_game_state', { scene: start.scene, location: start.location, tick: start.tick, hudTime: start.hudTime, flags: start.flags })
    await travelToPump()
    const ira = await talkToIra()
    const anchor = panel('saves')
    await click(anchor.button, 'session_start_anchor_open_saves')
    await anchor.panel.waitFor({ state: 'visible', timeout: 10_000 })
    await click(anchor.panel.locator('.panel-header button').first(), 'session_start_anchor_close_saves')
    await anchor.panel.waitFor({ state: 'detached', timeout: 10_000 })

    state.activeStartedMs = Date.now()
    state.activeStartedAt = new Date(state.activeStartedMs).toISOString()
    state.activeStartHudTime = ira.hudTime
    state.sessionActionStart = state.actions.length
    log('session_start', { at: state.activeStartedAt, scene: ira.scene, location: ira.location, tick: ira.tick, hudTime: ira.hudTime, verifiedFlag: 'ira_story', durationSecondsRequired: SESSION_MS / 1000 })
    await checkpoint(0, 'minute-00-session-start.png')
    return
  }

  if (start.scene !== 'scene_gate_hall') throw new Error(`Fresh game did not start at scene 1: ${JSON.stringify(start)}`)
  const openingFlags = Object.entries(start.flags ?? {}).filter(([, value]) => Boolean(value)).map(([name]) => name).sort()
  const clueFlags = openingFlags.filter((name) => name.startsWith('clue_') || name === 'pump_seen')
  if (clueFlags.length) throw new Error(`Fresh game unexpectedly starts with clue flags: ${JSON.stringify(clueFlags)}`)
  state.initialGameState = { scene: start.scene, sceneOrdinal: 1, location: start.location, tick: start.tick, hudTime: start.hudTime, flags: openingFlags, clueFlags }
  state.activeStartedMs = Date.now()
  state.activeStartedAt = new Date(state.activeStartedMs).toISOString()
  state.activeStartHudTime = start.hudTime
  state.sessionActionStart = state.actions.length
  log('initial_game_state', state.initialGameState)
  log('session_start', { at: state.activeStartedAt, from: 'fresh-game-start', scene: start.scene, sceneOrdinal: 1, location: start.location, tick: start.tick, hudTime: start.hudTime, openingFlags, clueFlags, durationSecondsRequired: SESSION_MS / 1000 })
  await checkpoint(0, 'minute-00-game-start.png')

  await travelToPump()
  await talkToIra()
  await investigateFirstClue()
}

async function runSession() {
  const endAt = state.activeStartedMs + SESSION_MS
  let nextAction = state.activeStartedMs + FIRST_ACTION_MS
  let nextCheckpoint = state.activeStartedMs + CHECKPOINT_MS
  let nextTrip = state.activeStartedMs + 20 * 60_000
  let tripCount = 0, cycle = 0, persistenceDone = false
  const panels = ['saves', 'help']
  while (true) {
    if (stopRequested) throw new Error('Soak was interrupted before the 60-minute acceptance window finished.')
    const now = Date.now()
    const elapsed = now - state.activeStartedMs
    if (now >= nextCheckpoint) {
      const minute = Math.round((nextCheckpoint - state.activeStartedMs) / 60_000)
      await checkpoint(minute, minute === 30 ? 'minute-30-save-checkpoint.png' : minute === 60 ? 'minute-60-session-end.png' : null)
      nextCheckpoint += CHECKPOINT_MS
      continue
    }
    if (!persistenceDone && elapsed >= SAVE_RELOAD_MS) {
      await saveReloadContinue()
      persistenceDone = true
      continue
    }
    if (tripCount < 2 && now >= nextTrip) {
      tripCount++
      await shaftCircuit(tripCount)
      nextTrip += 25 * 60_000
      continue
    }
    if (now >= nextAction) {
      cycle++
      await panelRoundTrip(panels[(cycle - 1) % panels.length], cycle)
      nextAction += ACTION_MS
      continue
    }
    if (now >= endAt) break
    const nextDue = Math.min(endAt, nextAction, nextCheckpoint, nextTrip, persistenceDone ? endAt : state.activeStartedMs + SAVE_RELOAD_MS)
    await delay(Math.max(25, Math.min(1_000, nextDue - Date.now())))
  }
  if (state.checkpoints.at(-1)?.minute !== 60) await checkpoint(60, 'minute-60-session-end.png')
  state.activeEndedMs = Date.now()
  state.activeEndedAt = new Date(state.activeEndedMs).toISOString()
  state.activeActionCount = state.actions.length - state.sessionActionStart
  const tailGap = state.lastActionMs == null ? null : state.activeEndedMs - state.lastActionMs
  if (tailGap != null) {
    state.maxActionGapMs = Math.max(state.maxActionGapMs, tailGap)
    if (tailGap > 60_000) fail('Last UI/game action was more than 60 seconds before session end.', { gapSeconds: tailGap / 1000 })
  }
  state.activeMaxActionGapMs = state.maxActionGapMs
  const ending = await runtimeState()
  state.activeEndHudTime = ending?.hudTime
  log('active_session_end', { at: state.activeEndedAt, elapsedSeconds: Number(((state.activeEndedMs - state.activeStartedMs) / 1000).toFixed(1)), scene: ending?.scene, location: ending?.location, tick: ending?.tick, hudTime: state.activeEndHudTime, actions: state.activeActionCount, maxActionGapSeconds: Number((state.activeMaxActionGapMs / 1000).toFixed(1)), scenes: [...state.scenes] })
}
async function probeEndMenuAudio() {
  const exit = page.locator('.hud-right .hud-btn[data-tip^="Выйти в главное меню"]')
  await click(exit, 'open_exit_to_menu_confirmation')
  await button('Выйти', 'confirm_exit_to_menu')
  await page.locator('.main-menu .campaign-title').waitFor({ state: 'visible', timeout: 20_000 })
  await waitForPaint()
  await page.mouse.click(30, 30)
  recordAction('user_gesture_for_end_menu_audio', { target: 'main menu background' })
  const result = await audioProbe('end-after-60-minute-session')
  if (!result.fileSizeBytes || !result.playbackObserved) fail('End menu audio file/playback probe did not pass.', { result })
}

function counts() {
  return {
    pageerror: state.pageErrors.length,
    consoleError: state.consoleErrors.length,
    consoleWarning: state.consoleWarnings.length,
    httpError: state.httpErrors.length,
    requestFailed: state.requestFailures.length,
    expectedOptional404: state.httpErrors.filter((x) => x.expected === 'optional-project-json-not-shipped').length,
    nonOptionalHttp: state.httpErrors.filter((x) => !x.expected).length,
  }
}
function acceptance() {
  const c = counts()
  const browserDurationSeconds = state.browserStartedMs == null || state.finishedMs == null ? 0 : (state.finishedMs - state.browserStartedMs) / 1000
  const activeDurationSeconds = state.activeStartedMs == null || state.activeEndedMs == null ? 0 : (state.activeEndedMs - state.activeStartedMs) / 1000
  const durationSeconds = TASK === 'GOLD-1.15' ? activeDurationSeconds : browserDurationSeconds
  const sessionActions = state.activeActionCount ?? state.actions.length - state.sessionActionStart
  const maxGap = state.activeMaxActionGapMs ?? state.maxActionGapMs
  const delta = parseHudMinutes(state.activeEndHudTime) - parseHudMinutes(state.initialHudTime)
  const hudPoints = [
    { elapsedSeconds: 0, source: 'fresh-game-start', hudTime: state.initialHudTime },
    ...state.checkpoints.map(({ elapsedSeconds, minute, hudTime }) => ({ elapsedSeconds, source: `checkpoint-${minute}`, hudTime })),
    ...(state.firstClue ? [{ elapsedSeconds: state.firstClue.elapsedSeconds, source: 'first-clue', hudTime: state.firstClue.hudTime }] : []),
    ...(state.activeEndedMs == null ? [] : [{ elapsedSeconds: activeDurationSeconds, source: 'active-session-end', hudTime: state.activeEndHudTime }]),
  ].map((point) => ({ ...point, hudMinutes: parseHudMinutes(point.hudTime) }))
    .sort((a, b) => a.elapsedSeconds - b.elapsedSeconds)
  state.hudTimeline = hudPoints
  const hudRegressions = hudPoints.slice(1).flatMap((point, index) => {
    const previous = hudPoints[index]
    return point.hudMinutes == null || previous.hudMinutes == null || point.hudMinutes < previous.hudMinutes
      ? [{ previous, point }]
      : []
  })
  if (durationSeconds < 3600) {
    const message = TASK === 'GOLD-1.15'
      ? 'durationSeconds is below 3600 of active gameplay from fresh-game start.'
      : 'durationSeconds is below 3600 from browser start to runner finish.'
    fail(message, { durationSeconds, activeDurationSeconds })
  }
  if (activeDurationSeconds < 3600) fail('Active gameplay lasted less than 3600 seconds.', { activeDurationSeconds })
  if (TASK === 'GOLD-1.15') {
    if (!state.initialGameState || state.initialGameState.scene !== 'scene_gate_hall' || state.initialGameState.sceneOrdinal !== 1) fail('The soak did not start at the campaign opening scene.', { initialGameState: state.initialGameState })
    if (!state.startCheckpoint || state.startCheckpoint.minute !== 0 || state.startCheckpoint.scene !== 'scene_gate_hall' || state.startCheckpoint.clueFlags?.length) fail('The first checkpoint was not a clean-clue fresh-game start at scene 1.', { startCheckpoint: state.startCheckpoint })
    if (!state.firstClue || state.firstClue.flag !== 'clue_glove' || state.firstClue.flagValue !== true) fail('The campaign first clue was not reached and marked in the timeline.', { firstClue: state.firstClue })
    if (hudRegressions.length) fail('HUD time moved backward or was unavailable in the timeline.', { hudRegressions })
  }
  if (state.checkpoints.length < 12) fail('Fewer than 12 five-minute checkpoints.', { checkpoints: state.checkpoints.length })
  if (c.pageerror) fail('pageerror count must be zero.', { events: state.pageErrors })
  if (state.emptyBackgroundCount) fail('Empty-background count must be zero.', { events: state.emptyBackgroundEvents })
  if (sessionActions < 60) fail('Fewer than 60 active-session UI/game actions.', { sessionActions })
  if (maxGap > 60_000) fail('Maximum action gap exceeded 60 seconds.', { maxGapSeconds: maxGap / 1000 })
  if (state.scenes.size < 3) fail('Fewer than three scenes visited.', { scenes: [...state.scenes] })
  if (!Number.isFinite(delta) || delta <= 0) fail('HUD time did not increase from initial game scene to active-session end.', { initial: state.initialHudTime, end: state.activeEndHudTime, delta })
  if (state.reloadCount !== 1) fail('Expected exactly one permitted page.reload().', { reloadCount: state.reloadCount })
  if (!state.persistence) fail('Save/reload/Continue verification did not complete.')
  else {
    if (state.persistence.manualComparison.discrepancyCount !== 0) fail('Manual save discrepancies are nonzero.', { comparison: state.persistence.manualComparison })
    if (state.persistence.reloadComparison.discrepancyCount !== 0) fail('Reload + Continue discrepancies are nonzero.', { comparison: state.persistence.reloadComparison })
  }
  if (state.contextCount !== 1 || state.pageCount !== 1) fail('Expected exactly one browser context and page.', { contextCount: state.contextCount, pageCount: state.pageCount })
  if (state.viteStarts !== 1) fail('Expected one uninterrupted Vite instance.', { viteStarts: state.viteStarts })
  if (c.nonOptionalHttp) fail('Unclassified HTTP errors were observed.', { events: state.httpErrors })
  if (!state.startAudio.some((x) => x.phase === 'start-after-user-gesture' && x.playbackObserved)) fail('Start menu audio playback was not observed.')
  if (!state.endAudio?.playbackObserved) fail('End menu audio playback was not observed.')
  return { durationSeconds: Number(durationSeconds.toFixed(1)), browserDurationSeconds: Number(browserDurationSeconds.toFixed(1)), activeDurationSeconds: Number(activeDurationSeconds.toFixed(1)), sessionActions, maxActionGapSeconds: Number((maxGap / 1000).toFixed(1)), checkpointCount: state.checkpoints.length, scenes: [...state.scenes], sceneCount: state.scenes.size, initialGameState: state.initialGameState, startCheckpoint: state.startCheckpoint, firstClue: state.firstClue, hudTimeline: hudPoints, hudRegressions: hudRegressions.length, initialHudTime: state.initialHudTime, activeStartHudTime: state.activeStartHudTime, activeEndHudTime: state.activeEndHudTime, hudTimeDeltaMinutes: delta, emptyBackgroundCount: state.emptyBackgroundCount, backgroundSamples: state.backgroundSamples, ...c }
}
function escapeTable(value) { return String(value ?? '').replaceAll('|', '\\|').replace(/\r?\n/g, ' ') }
function report(summary) {
  const timelineRows = state.checkpoints.map((cp) => ({
    elapsed: cp.elapsedSeconds,
    row: `| ${cp.minute} | ${cp.at} | ${cp.scene ?? '—'} | ${cp.hudTime ?? '—'} | ${cp.pageerror} | ${cp.emptyBackgroundCount} | ${cp.actionsSincePreviousCheckpoint} | ${cp.actionsCumulative} |`,
  }))
  if (state.firstClue) timelineRows.push({
    elapsed: state.firstClue.elapsedSeconds,
    row: `| first clue (t+${state.firstClue.elapsedSeconds}s) | ${state.firstClue.at} | ${state.firstClue.scene} | ${state.firstClue.hudTime} | ${state.firstClue.pageerror} | ${state.firstClue.emptyBackgroundCount} | ${state.firstClue.actionsSincePreviousCheckpoint} | ${state.firstClue.actionsCumulative} |`,
  })
  const timeline = timelineRows.sort((a, b) => a.elapsed - b.elapsed).map((x) => x.row).join('\n')
  const consoleRows = state.consoleErrors.length ? state.consoleErrors.map((x) => `| ${x.at} | ${escapeTable(x.text)} | ${escapeTable(x.location?.url)} |`).join('\n') : '| — | None observed; listener remained active and no console.error event was suppressed. | — |'
  const httpRows = state.httpErrors.length ? state.httpErrors.map((x) => `| ${x.status} | ${escapeTable(x.url)} | ${x.expected || 'Unclassified; acceptance failure'} |`).join('\n') : '| — | None observed. | — |'
  const requestRows = state.requestFailures.length ? state.requestFailures.map((x) => `| ${x.at} | ${escapeTable(x.failure)} | ${escapeTable(x.url)} |`).join('\n') : '| — | None observed. | — |'
  const audioRows = [...state.startAudio, ...(state.endAudio ? [state.endAudio] : [])].map((x) => `| ${x.phase} | ${x.fileSizeBytes} | ${x.playbackObserved} | ${escapeTable(JSON.stringify(x.attempts))} |`).join('\n') || '| — | 0 | Not completed | — |'
  const flags = state.persistence ? state.persistence.before.setFlags.map((x) => x.name).join(', ') : 'not recorded'
  const failRows = state.failures.length ? state.failures.map((x) => `- **FAIL:** ${escapeTable(x.message)}`).join('\n') : '- None.'
  const screenshotRows = state.screenshots.map((x) => `- ${TASK === 'GOLD-1.15' ? x.path.split('/').at(-1) : x.path} — ${x.width}×${x.height}, ${x.bytes} bytes${TASK === 'GOLD-1.15' ? ' (temporary, not committed)' : ''}`).join('\n') || '- No screenshots captured.'
  const httpReason = cOptional(summary) ? `The ${summary.expectedOptional404} optional project.json 404 response(s) are retained above. The pinned campaign package does not ship this optional metadata file; these are not game-asset or runtime failures.` : 'No optional project.json 404 was observed.'
  const reportTitle = TASK === 'GOLD-1.15' ? '# GOLD-1.15 — one-hour golden playthrough from fresh game to first clue' : '# GOLD-1.11 — Real-time browser soak'
  const durationLine = TASK === 'GOLD-1.15'
    ? `- durationSeconds (active gameplay from fresh-game start through the one-hour soak): **${summary.durationSeconds}**; activeDurationSeconds: **${summary.activeDurationSeconds}**; browser wall time: **${summary.browserDurationSeconds}** (all seconds; active duration must be ≥ 3600).`
    : `- durationSeconds (browser start to runner finish): **${summary.durationSeconds}**; active-game duration: **${summary.activeDurationSeconds}** (both required ≥ 3600).`
  const firstClueLines = TASK === 'GOLD-1.15'
    ? [
      `- First checkpoint: scene 1 \`${summary.startCheckpoint?.scene ?? 'not reached'}\`; HUD **${summary.startCheckpoint?.hudTime ?? 'not reached'}**; opening flags: ${summary.startCheckpoint?.flags?.join(', ') || 'none'}; clue flags: ${summary.startCheckpoint?.clueFlags?.join(', ') || 'none'}.`,
      `- First clue marker: \`${summary.firstClue?.flag ?? 'not reached'}=${summary.firstClue?.flagValue ?? 'n/a'}\` at t+${summary.firstClue?.elapsedSeconds ?? 'n/a'}s; scene ${summary.firstClue?.scene ?? 'n/a'}; HUD ${summary.firstClue?.hudTime ?? 'n/a'}; attempt ${summary.firstClue?.attempt ?? 'n/a'}.`,
      `- HUD timeline regressions: **${summary.hudRegressions}**; no time was injected or rewound.`,
      '- **Explicit card discrepancy:** the card asks for HUD 08:00 and an empty flags object at the fresh-game checkpoint. The pinned campaign actually starts at `scene_gate_hall`, HUD 07:00, with `case_opened` and `gate_intro_done`; its clue flags are empty. The runner records that real state and does not change campaign data, clear flags, or jump time.',
    ]
    : []
  return [
    reportTitle, '',
    `**Verdict:** ${state.failures.length ? 'FAIL' : 'PASS'}`, `**Branch:** ${BRANCH}`, `**Run ID:** ${ID}`,
    `**Pinned campaign:** ${manifest.repository}@${manifest.commit}; tree SHA-256 ${manifest.tree?.sha256}`,
    `**Browser:** ${state.browser ?? 'not launched'}`, `**Vite:** one instance at ${BASE_URL}; no restart`,
    `**Command:** ${RUN_COMMAND}`, `**Soak subcommand:** npm run golden:soak`, `**Orchestrator run ID:** ${ORCHESTRATOR_RUN_ID ?? 'standalone'}; base playthrough rc=${BASE_PLAYTHROUGH_RC ?? 'n/a'}`, `**CI context:** event=${CI_EVENT ?? 'local'}; run=${CI_RUN_ID ?? 'n/a'}; attempt=${CI_ATTEMPT ?? 'n/a'}; sha=${CI_SHA ?? 'n/a'}`, '',
    '## Duration and acceptance', '',
    `- Browser started: ${state.browserStartedAt ?? 'not recorded'}; runner completed: ${state.finishedAt ?? 'not recorded'}.`,
    `- Active gameplay: ${state.activeStartedAt ?? 'not recorded'} → ${state.activeEndedAt ?? 'not recorded'}.`,
    durationLine,
    ...firstClueLines,
    `- Checkpoints: **${summary.checkpointCount}** at minutes ${state.checkpoints.map((x) => x.minute).join(', ')} (required ≥ 12).`,
    `- Active-session actions: **${summary.sessionActions}** (required ≥ 60); maximum action gap: **${summary.maxActionGapSeconds}s** (limit ≤ 60s).`,
    `- Scenes: **${summary.sceneCount}** — ${summary.scenes.join(', ')} (required ≥ 3).`,
    `- HUD: initial ${summary.initialHudTime}; active start ${summary.activeStartHudTime}; active end ${summary.activeEndHudTime}; change ${summary.hudTimeDeltaMinutes} in-game minutes.`,
    `- pageerror: **${summary.pageerror}**; empty-background count: **${summary.emptyBackgroundCount}** across ${summary.backgroundSamples} samples.`,
    `- console.error: **${summary.consoleError}**; HTTP errors: **${summary.httpError}** (${summary.expectedOptional404} documented optional 404; ${summary.nonOptionalHttp} unclassified).`,
    `- Contexts/pages: ${state.contextCount}/${state.pageCount}; page.reload count: ${state.reloadCount}; Vite starts: ${state.viteStarts}.`,
    '', TASK === 'GOLD-1.15' ? '## Timeline: fresh game → first clue → one-hour soak' : '## Five-minute timeline', '',
    '| Minute / event | Timestamp UTC | Scene | HUD time | pageerror cumulative | empty backgrounds cumulative | Actions since prior | Actions cumulative |',
    '|---|---|---|---|---:|---:|---:|---:|', timeline || '| — | No checkpoints | — | — | — | — | — | — |', '',
    '## Save, reload, and Continue', '',
    state.persistence ? `- Manual save vs pre-save snapshot discrepancies: ${state.persistence.manualComparison.discrepancyCount}.\n- Reload + Continue discrepancies (flags/time/scene/location): ${state.persistence.reloadComparison.discrepancyCount}.\n- Persisted flags before/after: ${flags} / ${state.persistence.after.setFlags.map((x) => x.name).join(', ')}.\n- Tick ${state.persistence.before.tick} → ${state.persistence.after.tick}; HUD ${state.persistence.before.hudTime} → ${state.persistence.after.hudTime}.\n- Same context and Vite instance; the one permitted page.reload occurred at minute 30.` : '- Verification did not complete.',
    '', '## Menu audio probes', '',
    '| Phase | Asset bytes | Playback observed | Captured attempts |', '|---|---:|---|---|', audioRows, '',
    'The runner measured the pinned music_menu.mp3 file and observed actual media play/playing state; the probe does not suppress browser errors.', '',
    '## Error accounting — events are not suppressed', '',
    '### console.error', '', '| Timestamp UTC | Message | Source URL |', '|---|---|---|', consoleRows, '',
    '### HTTP responses ≥ 400', '', '| Status | URL | Classification / reason |', '|---:|---|---|', httpRows, '', httpReason, '',
    '### Failed requests', '', '| Timestamp UTC | Failure | URL |', '|---|---|---|', requestRows, '',
    '## Screenshots', '', screenshotRows, '',
    '## Gates and CI', '',
    `- Local soak: ${state.failures.length ? 'FAIL' : 'PASS'}; base campaign/negative entry: rc=${BASE_PLAYTHROUGH_RC ?? 'not captured'}.`,
    '- The common `npm run playthrough:golden` entry invokes the existing `npm run golden:soak`; the golden workflow runs on `push` to `main` without a conditional and gives the job at least 75 minutes.',
    '- CI run ID and merge-push conclusion are supplied by the workflow; see the run summary uploaded with this report.', '',
    '## Failures', '', failRows, '', '## Artifacts', '',
    `- ${relative(ROOT, REPORT_PATH).split(sep).join('/')}`,
    `- ${relative(ROOT, LOG_PATH).split(sep).join('/')}`,
    `- Temporary screenshot output: ${SCREENSHOT_DIR}`,
  ].join('\n') + '\n'
}
function cOptional(summary) { return summary.expectedOptional404 > 0 }

async function startBrowser() {
  const launchRequestedAt = new Date().toISOString()
  browser = await launchChromium({ locale: 'ru-RU', timezoneId: 'Europe/Vilnius' })
  state.browserStartedMs = Date.now()
  state.browserStartedAt = new Date(state.browserStartedMs).toISOString()
  state.browser = chromiumVersion()
  context = await browser.newContext({ viewport: { width: 1440, height: 900 }, screen: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: 'ru-RU', timezoneId: 'Europe/Vilnius' })
  state.contextCount++
  page = await context.newPage()
  state.pageCount++
  page.setDefaultTimeout(15_000)
  await installCampaignRoutes(page)
  await page.addInitScript(() => {
    window.__GOLDEN11_AUDIO__ = []
    const original = HTMLMediaElement.prototype.play
    HTMLMediaElement.prototype.play = function (...args) {
      const record = { source: this.currentSrc || this.src || '', playingEvent: false, playError: null }
      window.__GOLDEN11_AUDIO__.push({ element: this, record })
      this.addEventListener('playing', () => { record.playingEvent = true }, { once: true })
      const result = original.apply(this, args)
      if (result?.catch) result.catch((error) => { record.playError = `${error?.name || 'Error'}: ${error?.message || String(error)}` })
      return result
    }
  })
  page.on('pageerror', (error) => {
    const item = { at: new Date().toISOString(), text: String(error?.stack ?? error).slice(0, 3000), url: page.url() }
    state.pageErrors.push(item); log('pageerror', item)
  })
  page.on('console', (message) => {
    if (message.type() === 'error') { const item = { at: new Date().toISOString(), text: message.text().slice(0, 2000), location: message.location() }; state.consoleErrors.push(item); log('console_error', item) }
    if (message.type() === 'warning') { const item = { at: new Date().toISOString(), text: message.text().slice(0, 1200), location: message.location() }; state.consoleWarnings.push(item); log('console_warning', item) }
  })
  page.on('response', (response) => {
    if (response.status() < 400) return
    let path = response.url()
    try { path = new URL(response.url()).pathname } catch { /* keep URL */ }
    const expected = response.status() === 404 && path.endsWith('/project.json') ? 'optional-project-json-not-shipped' : null
    const item = { at: new Date().toISOString(), status: response.status(), url: response.url(), expected }
    state.httpErrors.push(item); log('http_error', item)
  })
  page.on('requestfailed', (request) => {
    const item = { at: new Date().toISOString(), url: request.url(), failure: request.failure()?.errorText ?? 'unknown' }
    state.requestFailures.push(item); log('request_failed', item)
  })
  log('browser_ready', { browser: state.browser, startedAt: state.browserStartedAt, launchRequestedAt, contexts: state.contextCount, pages: state.pageCount, viewport: '1440x900', locale: 'ru-RU', timezone: 'Europe/Vilnius' })
}
async function startVite() {
  vite = spawn(process.execPath, [join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], { cwd: ROOT, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] })
  state.viteStarts++
  vite.stdout.on('data', (chunk) => log('vite_stdout', { text: String(chunk).trim() }))
  vite.stderr.on('data', (chunk) => log('vite_stderr', { text: String(chunk).trim() }))
  vite.on('error', (error) => log('vite_error', { message: error.message }))
  await waitForServer()
  log('vite_ready', { url: BASE_URL, starts: state.viteStarts })
}
async function stopVite() {
  if (!vite || vite.exitCode !== null) return
  try { if (process.platform !== 'win32' && vite.pid) process.kill(-vite.pid, 'SIGTERM'); else vite.kill('SIGTERM') } catch { /* may already be gone */ }
  await Promise.race([new Promise((resolveExit) => vite.once('exit', resolveExit)), delay(5_000)])
  if (vite.exitCode === null) { try { if (process.platform !== 'win32' && vite.pid) process.kill(-vite.pid, 'SIGKILL'); else vite.kill('SIGKILL') } catch { /* final shutdown */ } }
}

async function run() {
  log('run_start', { command: RUN_COMMAND, soakCommand: 'npm run golden:soak', orchestratorRunId: ORCHESTRATOR_RUN_ID, basePlaythroughRc: BASE_PLAYTHROUGH_RC, ciRunId: CI_RUN_ID, ciEvent: CI_EVENT, ciSha: CI_SHA, ciAttempt: CI_ATTEMPT, branch: BRANCH, url: BASE_URL, campaign: campaign.title, campaignCommit: manifest.commit, treeSha256: manifest.tree?.sha256, durationSecondsRequired: 3600, activeDurationSecondsRequired: 3600, firstCheckpoint: 'fresh-game-start', checkpointIntervalSeconds: 300, actionIntervalSeconds: 45, backgroundMonitorSeconds: 5, saveReloadMinute: 30 })
  console.log(`${TASK} soak start: ${ID}; command=${RUN_COMMAND}; invoking npm run golden:soak; activeDurationSecondsRequired=3600`)
  await startVite()
  await startBrowser()
  await probeStartMenuAudio()
  await newRun()
  await runSession()
  await probeEndMenuAudio()
  log('soak_work_complete', { checkpoints: state.checkpoints.length, activeActionCount: state.activeActionCount, activeEndedAt: state.activeEndedAt })
}

try {
  await run()
} catch (error) {
  const detail = String(error?.stack ?? error).slice(0, 8000)
  log('run_failure', { message: detail })
  fail('Runner threw before completing all acceptance checks.', { error: detail })
} finally {
  monitorActive = false
  if (monitorTask) await Promise.race([monitorTask.catch(() => {}), delay(2_000)])
  await browser?.close().catch(() => {})
  await stopVite()
  state.finishedMs = Date.now()
  state.finishedAt = new Date(state.finishedMs).toISOString()
  let summary
  try { summary = acceptance() }
  catch (error) { fail('Could not construct acceptance summary.', { error: String(error?.stack ?? error) }); summary = { durationSeconds: 0, activeDurationSeconds: 0, sessionActions: 0, maxActionGapSeconds: 0, checkpointCount: state.checkpoints.length, scenes: [], sceneCount: state.scenes.size, initialHudTime: state.initialHudTime, activeStartHudTime: state.activeStartHudTime, activeEndHudTime: state.activeEndHudTime, hudTimeDeltaMinutes: null, emptyBackgroundCount: state.emptyBackgroundCount, backgroundSamples: state.backgroundSamples, ...counts() } }
  log('run_summary', { verdict: state.failures.length ? 'FAIL' : 'PASS', ...summary, failures: state.failures, startAudio: state.startAudio, endAudio: state.endAudio, persistence: state.persistence, consoleErrors: state.consoleErrors, httpErrors: state.httpErrors, requestFailures: state.requestFailures })
  writeFileSync(REPORT_PATH, report(summary))
  log('run_complete', { verdict: state.failures.length ? 'FAIL' : 'PASS', durationSeconds: summary.durationSeconds, browserDurationSeconds: summary.browserDurationSeconds, activeDurationSeconds: summary.activeDurationSeconds, firstClue: summary.firstClue, startCheckpoint: { scene: summary.startCheckpoint?.scene, hudTime: summary.startCheckpoint?.hudTime, flags: summary.startCheckpoint?.flags, clueFlags: summary.startCheckpoint?.clueFlags }, hudRegressions: summary.hudRegressions, checkpoints: summary.checkpointCount, actions: summary.sessionActions, maxActionGapSeconds: summary.maxActionGapSeconds, pageerror: summary.pageerror, emptyBackgroundCount: summary.emptyBackgroundCount, consoleError: summary.consoleError, httpError: summary.httpError, failures: state.failures, report: relative(ROOT, REPORT_PATH).split(sep).join('/'), log: relative(ROOT, LOG_PATH).split(sep).join('/') })
}
if (state.failures.length) process.exitCode = 1
