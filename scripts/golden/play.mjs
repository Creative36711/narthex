#!/usr/bin/env node
/**
 * Reproducible browser route for GOLD-1.2 and the GOLD-1.4 save/load probe.
 * The pinned, ignored .golden/karkas tree is served through Playwright routing;
 * the runner never copies or edits campaign files.
 *
 *   node scripts/golden/play.mjs       # original GOLD-1.2 route
 *   npm run golden:save-load            # route + save, page reload, slot load
 *
 * GOLD-1.4 artifacts: _tools/reports/GOLD-1.4.log and
 * _tools/reports/GOLD-1.4/*.png.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { extname, dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync, spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { launchChromium, chromiumVersion } from '../visual/local-browser.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const CAMPAIGN_ROOT = join(ROOT, '.golden', 'karkas')
const MANIFEST_PATH = join(ROOT, '.golden', 'manifest.json')
const SAVE_LOAD_MODE = process.argv.includes('--save-load')
const TASK = SAVE_LOAD_MODE ? 'GOLD-1.4' : 'GOLD-1.2'
const OUTPUT_DIR = join(ROOT, '_tools', 'reports', TASK)
const LOG_PATH = join(ROOT, '_tools', 'reports', `${TASK}.log`)
const PORT = Number(process.env.GOLDEN_PORT || 4173)
const BASE_URL = `http://127.0.0.1:${PORT}`
const WIDTH = 1440
const HEIGHT = 900
const SAVE_SLOT = 1
const BRANCH = execFileSync('git', ['branch', '--show-current'], { cwd: ROOT, encoding: 'utf8' }).trim()

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'))
const campaign = JSON.parse(readFileSync(join(CAMPAIGN_ROOT, 'campaign.json'), 'utf8'))
if (
  manifest.repository !== 'Creative36711/campaign-1' ||
  manifest.commit !== '71dbbc1056fd34679cf9017ee7dc5ecff29d666c' ||
  manifest.sha256 !== 'd424a914ed2714e9c643f428e5a8eba515cbc0aaba3b3a2d4746362ccad3cf4b' ||
  manifest.tree?.archive_sha256 !== manifest.sha256 ||
  manifest.tree?.sha256 !== '132a5c09987aff80c9dfe2f69f1195e642295f666fc906545f00d5fccce62c76' ||
  !existsSync(join(CAMPAIGN_ROOT, 'manifest.json'))
) {
  throw new Error('Pinned GOLD-1 campaign tree/manifest is missing or does not match .golden/manifest.json; run npm run golden:import first.')
}

mkdirSync(OUTPUT_DIR, { recursive: true })
writeFileSync(LOG_PATH, '')
const log = (event, data = {}) => {
  const record = { at: new Date().toISOString(), event, ...data }
  appendFileSync(LOG_PATH, `${JSON.stringify(record)}\n`)
  const summary = data.step ? ` ${data.step}` : ''
  console.log(`${record.at} ${event}${summary}`)
  return record
}

const server = spawn(process.execPath, [
  join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'),
  '--host', '127.0.0.1',
  '--port', String(PORT),
  '--strictPort',
], { cwd: ROOT, detached: true, stdio: ['ignore', 'pipe', 'pipe'] })
server.stdout.on('data', (chunk) => log('vite_stdout', { text: String(chunk).trim() }))
server.stderr.on('data', (chunk) => log('vite_stderr', { text: String(chunk).trim() }))
server.on('error', (error) => log('vite_error', { message: error.message }))

let browser
let page
let activeStep = 'setup'
const events = []
const actionLog = []
let route404Project = 0

const recordAction = (action, details = {}) => {
  const item = { at: new Date().toISOString(), step: activeStep, action, ...details }
  actionLog.push(item)
  log('action', item)
}
const addEvent = (type, details = {}) => {
  const item = { at: new Date().toISOString(), step: activeStep, type, ...details }
  events.push(item)
  log('browser_event', item)
}

async function waitForServer(timeoutMs = 60000) {
  const until = Date.now() + timeoutMs
  while (Date.now() < until) {
    if (server.exitCode !== null) throw new Error(`Vite exited early with code ${server.exitCode}`)
    try {
      const response = await fetch(`${BASE_URL}/`)
      if (response.ok) return
    } catch { /* Vite is still starting. */ }
    await delay(200)
  }
  throw new Error(`Vite did not answer at ${BASE_URL} within ${timeoutMs} ms`)
}

function mimeType(path) {
  return ({
    '.avif': 'image/avif', '.gif': 'image/gif', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg',
    '.json': 'application/json', '.md': 'text/markdown; charset=utf-8', '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg', '.png': 'image/png', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8',
    '.webp': 'image/webp', '.woff': 'font/woff', '.woff2': 'font/woff2',
  })[extname(path).toLowerCase()] || 'application/octet-stream'
}

function jsonResponse(status, body) {
  return { status, contentType: 'application/json; charset=utf-8', body: JSON.stringify(body) }
}

async function installCampaignRoutes(targetPage) {
  await targetPage.route('**/campaigns/**', async (route) => {
    const url = new URL(route.request().url())
    const pathname = decodeURIComponent(url.pathname)
    if (pathname === '/campaigns/index.json') {
      return route.fulfill(jsonResponse(200, [{
        id: campaign.id,
        title: campaign.title,
        author: campaign.author,
        description: campaign.description,
      }]))
    }

    const prefix = `/campaigns/${campaign.id}/`
    if (!pathname.startsWith(prefix)) return route.continue()
    const relativePath = pathname.slice(prefix.length)
    const file = resolve(CAMPAIGN_ROOT, relativePath)
    if (file !== CAMPAIGN_ROOT && !file.startsWith(`${CAMPAIGN_ROOT}${sep}`)) {
      return route.fulfill({ status: 403, contentType: 'text/plain', body: 'Forbidden' })
    }
    if (!existsSync(file) || !statSync(file).isFile()) {
      if (relativePath === 'project.json') route404Project++
      return route.fulfill({
        status: 404,
        contentType: 'text/plain; charset=utf-8',
        body: `Missing pinned campaign resource: ${relativePath}`,
      })
    }
    return route.fulfill({ status: 200, contentType: mimeType(file), body: readFileSync(file) })
  })
}

async function waitForPaint() {
  await page.waitForFunction(() => [...document.images].every((img) => img.complete), undefined, { timeout: 12000 }).catch(() => {})
  await page.waitForTimeout(500)
}

async function measureScreen() {
  await waitForPaint()
  return page.evaluate(() => {
    const text = document.body?.innerText?.replace(/\n{2,}/g, '\n').trim() ?? ''
    const scene = document.querySelector('.scene-stage')
    const menu = document.querySelector('.main-menu')
    const creation = document.querySelector('.char-create')
    const map = document.querySelector('.map-screen')
    let background = { kind: 'not-applicable', empty: false, source: null, width: null, height: null }

    // The map is an overlay above the still-mounted scene, so inspect it first.
    if (map) {
      const image = map.querySelector('img.map-bg')
      const art = map.querySelector('svg.map-bg, .map-bg svg')
      const fallback = map.querySelector('.map-bg-fallback')
      if (fallback) background = { kind: 'map-fallback', empty: true, source: null, width: null, height: null }
      else if (image) background = {
        kind: 'map-image',
        empty: !image.complete || image.naturalWidth === 0 || image.naturalHeight === 0,
        source: image.currentSrc || image.src,
        width: image.naturalWidth,
        height: image.naturalHeight,
      }
      else if (art) background = { kind: 'map-art', empty: false, source: 'inline-svg', width: null, height: null }
      else background = { kind: 'map-background-missing', empty: true, source: null, width: null, height: null }
    } else if (scene) {
      const image = scene.querySelector('img.scene-bg')
      const art = scene.querySelector('.scene-bg svg')
      const fallback = scene.querySelector('.scene-bg-fallback')
      if (fallback) background = { kind: 'fallback', empty: true, source: null, width: null, height: null }
      else if (image) background = {
        kind: 'image',
        empty: !image.complete || image.naturalWidth === 0 || image.naturalHeight === 0,
        source: image.currentSrc || image.src,
        width: image.naturalWidth,
        height: image.naturalHeight,
      }
      else if (art) background = { kind: 'art', empty: false, source: 'inline-svg', width: null, height: null }
      else background = { kind: 'missing', empty: true, source: null, width: null, height: null }
    } else if (menu) {
      const image = menu.querySelector('img.menu-bg')
      background = image ? {
        kind: 'menu-image',
        empty: !image.complete || image.naturalWidth === 0 || image.naturalHeight === 0,
        source: image.currentSrc || image.src,
        width: image.naturalWidth,
        height: image.naturalHeight,
      } : { kind: 'menu-background-missing', empty: true, source: null, width: null, height: null }
    } else if (creation) {
      background = { kind: 'character-creation-panel', empty: false, source: null, width: null, height: null }
    }

    const sceneImage = scene?.querySelector('img.scene-bg')
    const sceneSrc = sceneImage?.currentSrc || sceneImage?.src || ''
    const match = sceneSrc.match(/\/scene_([a-z0-9_-]+)(?:_[a-z0-9_-]+)?\.(?:jpg|jpeg|png|webp)(?:\?|$)/i)
    const message = document.querySelector('.message-overlay')?.innerText?.replace(/\n{2,}/g, '\n').trim() ?? ''
    return {
      text: text.slice(0, 2200),
      sceneId: match ? `scene_${match[1]}` : null,
      sceneLabel: document.querySelector('.scene-name')?.textContent?.trim() ?? null,
      locationLabel: document.querySelector('.scene-location')?.textContent?.trim() ?? null,
      hudTime: document.querySelector('.hud-time')?.textContent?.trim() ?? null,
      background,
      emptyBackgrounds: background.empty ? 1 : 0,
      activeMessage: message.slice(0, 1200),
      screen: map ? 'map' : scene ? 'scene' : menu ? 'menu' : creation ? 'character-creation' : 'other',
    }
  })
}

function stepEvents(step) {
  const current = events.filter((item) => item.step === step)
  const pages = current.filter((item) => item.type === 'pageerror')
  const consoles = current.filter((item) => item.type === 'console_error')
  const http = current.filter((item) => item.type === 'http_error')
  return {
    pageerror: pages.length,
    consoleError: consoles.length,
    httpErrors: http.length,
    requestFailures: current.filter((item) => item.type === 'request_failed').length,
    expectedProjectJson404: http.filter((item) => item.expected === 'optional-project-json').length,
    details: current,
  }
}

function pngSize(path) {
  const bytes = readFileSync(path)
  if (bytes.length < 24 || bytes.toString('hex', 0, 8) !== '89504e470d0a1a0a') return null
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), bytes: bytes.length }
}

async function checkpoint(step, label, sceneId = null, filename = null) {
  activeStep = step
  const metrics = await measureScreen()
  let screenshot = null
  if (filename) {
    const path = join(OUTPUT_DIR, filename)
    await page.screenshot({ path, type: 'png', fullPage: false, animations: 'disabled' })
    const dimensions = pngSize(path)
    screenshot = { path: relative(ROOT, path).split(sep).join('/'), ...dimensions }
  }
  const counts = stepEvents(step)
  const result = {
    step,
    label,
    sceneId: sceneId ?? metrics.sceneId,
    screen: metrics.screen,
    hudTime: metrics.hudTime,
    background: metrics.background,
    emptyBackgrounds: metrics.emptyBackgrounds,
    pageerror: counts.pageerror,
    consoleError: counts.consoleError,
    httpErrors: counts.httpErrors,
    requestFailures: counts.requestFailures,
    expectedProjectJson404: counts.expectedProjectJson404,
    screenshot,
    text: metrics.text,
    activeMessage: metrics.activeMessage,
  }
  log('checkpoint', result)
  return result
}

function beginStep(step, label) {
  activeStep = step
  log('step_start', { step, label })
}

async function clickButton(name, options = {}) {
  const locator = page.getByRole('button', { name, exact: true }).first()
  await locator.waitFor({ state: 'visible', timeout: options.timeout ?? 15000 })
  await locator.click({ timeout: options.timeout ?? 15000 })
}

async function settleStoryOverlays(maxMs = 30000, options = {}) {
  const includeDialogue = options.includeDialogue !== false
  const deadline = Date.now() + maxMs
  let passes = 0
  while (Date.now() < deadline && passes++ < 80) {
    const cutscene = page.locator('.cutscene-overlay')
    if (await cutscene.count()) {
      const skip = cutscene.getByRole('button', { name: /^(Пропустить|Закрыть)$/ }).last()
      if (await skip.count()) {
        await skip.click({ timeout: 1500 }).catch(async () => cutscene.locator('.cs-stage').click({ timeout: 1500 }))
        recordAction('dismiss_cutscene', { method: await skip.count() ? 'button' : 'stage-click' })
      } else {
        await cutscene.locator('.cs-stage').click({ position: { x: 100, y: 100 }, timeout: 1500 })
        recordAction('advance_cutscene_slide', { method: 'stage-click' })
      }
      await page.waitForTimeout(150)
      continue
    }

    const narrative = page.locator('.scene-narrative-overlay')
    if (await narrative.count()) {
      const skip = narrative.getByRole('button', { name: /Пропустить/ }).first()
      if (await skip.count()) {
        await skip.click({ timeout: 1500 })
        recordAction('skip_scene_narrative')
      } else {
        await narrative.getByRole('button').last().click({ timeout: 1500 })
        recordAction('advance_scene_narrative')
      }
      await page.waitForTimeout(150)
      continue
    }

    // Postcards are rendered after message overlays and intercept their pointer
    // events; dismiss the topmost postcard first, then the queued message below.
    const postcard = page.locator('.cf-postcard, .postcard-overlay, .postcard-layer').first()
    if (await postcard.count()) {
      const text = (await postcard.getAttribute('aria-label').catch(() => null)) || (await postcard.innerText().catch(() => '')).replace(/\n{2,}/g, '\n').slice(0, 1000)
      const button = postcard.getByRole('button').last()
      if (await button.count()) await button.click({ timeout: 1500 })
      else await postcard.click({ timeout: 1500 })
      recordAction('dismiss_postcard', { text, method: await button.count() ? 'button' : 'postcard-click' })
      await page.waitForTimeout(150)
      continue
    }

    const message = page.locator('.message-overlay').first()
    if (await message.count()) {
      const text = (await message.innerText().catch(() => '')).replace(/\n{2,}/g, '\n').slice(0, 1000)
      const ok = message.getByRole('button', { name: 'Ок', exact: true })
      const continueButton = message.getByRole('button', { name: /^(Продолжить|Далее|Закрыть)$/ }).last()
      if (await ok.count()) await ok.click({ timeout: 1500 })
      else if (await continueButton.count()) await continueButton.click({ timeout: 1500 })
      else await message.click({ timeout: 1500 })
      recordAction('dismiss_message', { text, method: await ok.count() ? 'ok-button' : 'overlay-button-or-click' })
      await page.waitForTimeout(150)
      continue
    }

    const dialogue = page.locator('.dialogue-overlay')
    if (includeDialogue && await dialogue.count()) {
      const button = dialogue.getByRole('button').last()
      if (await button.count()) {
        await button.click({ timeout: 1500 })
        recordAction('advance_dialogue')
        await page.waitForTimeout(150)
        continue
      }
    }

    await page.waitForTimeout(450)
    const allOverlays = '.cutscene-overlay, .scene-narrative-overlay, .message-overlay, .dialogue-overlay, .cf-postcard, .postcard-overlay, .postcard-layer'
    const nonDialogueOverlays = '.cutscene-overlay, .scene-narrative-overlay, .message-overlay, .cf-postcard, .postcard-overlay, .postcard-layer'
    const lateOverlay = page.locator(includeDialogue ? allOverlays : nonDialogueOverlays)
    if (await lateOverlay.count()) continue
    return true
  }
  const visibleSelector = includeDialogue
    ? '.cutscene-overlay, .scene-narrative-overlay, .message-overlay, .dialogue-overlay'
    : '.cutscene-overlay, .scene-narrative-overlay, .message-overlay'
  throw new Error(`Story overlays did not settle in ${maxMs} ms; visible=${await page.locator(visibleSelector).count()}`)
}

async function waitForScene(sceneId, timeout = 20000) {
  await page.waitForFunction((id) => {
    const source = document.querySelector('img.scene-bg')?.getAttribute('src') || ''
    return source.includes(`/scene_${id}.`) || source.includes(`/scene_${id}_`)
  }, sceneId, { timeout })
  await waitForPaint()
}

function parseHudMinutes(value) {
  if (!value) return null
  const match = value.match(/День\s+(\d+)\s*,\s*(\d{2}):(\d{2})/)
  if (!match) return null
  return ((Number(match[1]) - 1) * 24 + Number(match[2])) * 60 + Number(match[3])
}

const AUTO_SAVE_KEY = `narthex:save:${campaign.id}`
const MANUAL_SAVE_KEY = `narthex:save:${campaign.id}@${SAVE_SLOT}`

/** Read the browser's persisted envelope without changing it. */
async function readStoredSnapshot(key, source) {
  const snapshot = await page.evaluate(({ key, source }) => {
    const raw = localStorage.getItem(key)
    if (!raw) return { source, key, present: false }
    let envelope
    try { envelope = JSON.parse(raw) } catch (error) {
      return { source, key, present: false, parseError: String(error) }
    }
    const state = envelope?.state ?? envelope
    const flags = state?.flags && typeof state.flags === 'object' ? state.flags : {}
    const sortedFlags = Object.fromEntries(Object.entries(flags).sort(([a], [b]) => a.localeCompare(b)))
    const setFlags = Object.entries(sortedFlags)
      .filter(([, value]) => Boolean(value))
      .map(([name, value]) => ({ name, value }))
    return {
      source,
      key,
      present: true,
      campaignId: envelope?.campaign_id ?? state?.campaign_id ?? null,
      saveVersion: envelope?.save_version ?? state?.save_version ?? null,
      campaignVersion: envelope?.campaign_version ?? null,
      createdAt: envelope?.created_at ?? null,
      updatedAt: envelope?.updated_at ?? null,
      scene: state?.scene ?? null,
      location: state?.location ?? null,
      tick: Number.isFinite(state?.tick) ? state.tick : null,
      flags: sortedFlags,
      setFlags,
      rawChars: raw.length,
      hudTime: document.querySelector('.hud-time')?.textContent?.trim() ?? null,
    }
  }, { key, source })
  snapshot.hudMinutes = parseHudMinutes(snapshot.hudTime)
  return snapshot
}

function compareSnapshots(before, after, stage) {
  const beforeFlags = before.flags ?? {}
  const afterFlags = after.flags ?? {}
  const flagNames = [...new Set([...Object.keys(beforeFlags), ...Object.keys(afterFlags)])].sort()
  const flagChanges = flagNames.flatMap((name) => {
    const beforePresent = Object.hasOwn(beforeFlags, name)
    const afterPresent = Object.hasOwn(afterFlags, name)
    const beforeValue = beforePresent ? beforeFlags[name] : null
    const afterValue = afterPresent ? afterFlags[name] : null
    const beforeSet = Boolean(beforeValue)
    const afterSet = Boolean(afterValue)
    if (JSON.stringify(beforeValue) === JSON.stringify(afterValue) && beforePresent === afterPresent) return []
    return [{
      stage,
      flag: name,
      before: beforeValue,
      after: afterValue,
      lost: beforeSet && !afterSet,
      gained: !beforeSet && afterSet,
    }]
  })
  const time = {
    beforeTick: before.tick ?? null,
    afterTick: after.tick ?? null,
    tickDelta: Number.isFinite(before.tick) && Number.isFinite(after.tick) ? after.tick - before.tick : null,
    beforeHudTime: before.hudTime ?? null,
    afterHudTime: after.hudTime ?? null,
    beforeHudMinutes: before.hudMinutes ?? null,
    afterHudMinutes: after.hudMinutes ?? null,
    hudMinutesDelta: Number.isFinite(before.hudMinutes) && Number.isFinite(after.hudMinutes)
      ? after.hudMinutes - before.hudMinutes
      : null,
  }
  const scene = { before: before.scene ?? null, after: after.scene ?? null, same: before.scene === after.scene }
  const location = { before: before.location ?? null, after: after.location ?? null, same: before.location === after.location }
  const discrepancies = [
    ...flagChanges.map((item) => ({ kind: 'flag', ...item })),
    ...(scene.same ? [] : [{ kind: 'scene', stage, before: scene.before, after: scene.after }]),
    ...(location.same ? [] : [{ kind: 'location', stage, before: location.before, after: location.after }]),
    ...(time.tickDelta === 0 || time.tickDelta === null ? [] : [{ kind: 'game-time-tick', stage, before: time.beforeTick, after: time.afterTick, delta: time.tickDelta }]),
    ...(time.hudMinutesDelta === 0 || time.hudMinutesDelta === null ? [] : [{ kind: 'game-time-hud-minutes', stage, before: time.beforeHudMinutes, after: time.afterHudMinutes, delta: time.hudMinutesDelta }]),
  ]
  return {
    stage,
    beforeSource: before.source,
    afterSource: after.source,
    flagChanges,
    scene,
    location,
    time,
    discrepancyCount: discrepancies.length,
    discrepancies,
  }
}

async function revealDialogueChoices(dialogue) {
  const skip = dialogue.getByRole('button', { name: /Пропустить/ }).first()
  if (await skip.count()) await skip.click({ timeout: 5000 })
  await page.waitForFunction(() => {
    const overlay = document.querySelector('.dialogue-overlay')
    return !!overlay?.querySelector('.dialogue-choices .choice-btn')
  }, undefined, { timeout: 10000 })
}

async function chooseDialogue(text) {
  const dialogue = page.locator('.dialogue-overlay')
  await dialogue.waitFor({ state: 'visible', timeout: 10000 })
  await revealDialogueChoices(dialogue)
  const option = dialogue.getByRole('button', { name: new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).first()
  await option.waitFor({ state: 'visible', timeout: 10000 })
  const label = (await option.innerText()).replace(/\s+/g, ' ').trim()
  await option.click()
  recordAction('choose_dialogue_option', { choice: text, button: label })
  await page.waitForTimeout(200)
  return dialogue
}

async function endDialogueIfOpen(dialogue) {
  if (!(await dialogue.count())) return
  if (!(await dialogue.isVisible().catch(() => false))) return
  await revealDialogueChoices(dialogue)
  const end = dialogue.getByRole('button', { name: /Закончить разговор/ }).last()
  if (await end.count()) {
    await end.click()
    recordAction('end_dialogue')
  } else {
    const leave = dialogue.getByRole('button', { name: /Мне пора/ }).last()
    if (await leave.count()) {
      await leave.click()
      recordAction('leave_dialogue')
      await page.waitForTimeout(150)
      if (await dialogue.isVisible().catch(() => false)) await endDialogueIfOpen(dialogue)
    }
  }
}

async function resolveInvestigationOutcome(attempt) {
  const transcript = []
  for (let dialogIndex = 1; dialogIndex <= 8; dialogIndex++) {
    const outcome = page.locator('.message-overlay:not(.itemdlg-overlay)').first()
    await outcome.waitFor({ state: 'visible', timeout: 10000 })
    const text = (await outcome.innerText()).replace(/\n{2,}/g, '\n').trim().slice(0, 1200)
    const reroll = outcome.getByRole('button', { name: 'Перебросить за удачу', exact: true })
    if (await reroll.count()) {
      transcript.push({ kind: 'luck-offer', text, decision: 'reroll' })
      recordAction('reroll_investigation_for_luck', { attempt, dialogIndex, text })
      await reroll.click()
      await page.waitForTimeout(150)
      continue
    }

    if (text.includes('Муфта срезана ровно') && text.includes('рукавица')) {
      transcript.push({ kind: 'clue-success', text })
      return { clueFound: true, message: text, transcript }
    }
    if (text.includes('Масло, ржавчина, срез металла.')) {
      transcript.push({ kind: 'investigation-failure', text })
      const ok = outcome.getByRole('button', { name: 'Ок', exact: true })
      await ok.waitFor({ state: 'visible', timeout: 3000 })
      await ok.click()
      recordAction('dismiss_investigation_failure', { attempt, text })
      return { clueFound: false, message: text, transcript }
    }

    const ok = outcome.getByRole('button', { name: 'Ок', exact: true })
    if (!(await ok.count())) {
      const buttons = await outcome.getByRole('button').allTextContents()
      throw new Error(`Unexpected investigation dialog: ${JSON.stringify({ text, buttons })}`)
    }
    transcript.push({ kind: 'follow-up-message', text })
    recordAction('dismiss_investigation_followup', { attempt, text })
    await ok.click()
    await page.waitForTimeout(150)
  }
  throw new Error(`Investigation attempt ${attempt} produced too many message dialogs: ${JSON.stringify(transcript)}`)
}

async function audioProbe() {
  await page.waitForTimeout(1600)
  const records = await page.evaluate(() => (window.__GOLDEN12_AUDIO__ || []).map(({ element, record }) => ({
    requestedSource: record.source,
    currentSource: element.currentSrc || element.src || record.source,
    durationSeconds: Number.isFinite(element.duration) ? Number(element.duration.toFixed(3)) : null,
    currentTimeSeconds: Number(element.currentTime.toFixed(3)),
    playingEvent: record.playingEvent,
    playError: record.playError,
    paused: element.paused,
    volume: element.volume,
    loop: element.loop,
    readyState: element.readyState,
  })))
  const menu = records.filter((item) => item.currentSource?.includes('music_menu.mp3') || item.requestedSource?.includes('music_menu.mp3'))
  const played = menu.some((item) => item.playingEvent || item.currentTimeSeconds > 0)
  const expectedFile = 'assets/audio/music/music_menu.mp3'
  const fileSizeBytes = statSync(join(CAMPAIGN_ROOT, expectedFile)).size
  const summary = { expectedFile, fileSizeBytes, attempts: menu, playbackObserved: played }
  log('menu_audio_probe', summary)
  return summary
}

async function main() {
  log('run_start', {
    task: TASK,
    command: SAVE_LOAD_MODE ? 'npm run golden:import && npm run golden:save-load' : 'npm run golden:import && npm run golden:play',
    branch: BRANCH,
    baseUrl: BASE_URL,
    viewport: `${WIDTH}x${HEIGHT}`,
    campaignId: campaign.id,
    campaignTitle: campaign.title,
    campaignCommit: manifest.commit,
    archiveSha256: manifest.sha256,
    treeSha256: manifest.tree.sha256,
    startingScene: campaign.starting_scene,
    startingLocation: campaign.starting_location,
    startingTick: campaign.starting_tick,
    tickLabel: campaign.tick_label,
  })

  await waitForServer()
  log('vite_ready', { url: BASE_URL })
  browser = await launchChromium()
  log('browser_ready', { browser: chromiumVersion() })
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    screen: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
    locale: 'ru-RU',
    timezoneId: 'Europe/Vilnius',
  })
  page = await context.newPage()
  page.setDefaultTimeout(15000)
  await installCampaignRoutes(page)
  await page.addInitScript(() => {
    window.__GOLDEN12_AUDIO__ = []
    const originalPlay = HTMLMediaElement.prototype.play
    HTMLMediaElement.prototype.play = function (...args) {
      const record = { source: this.currentSrc || this.src || '', playingEvent: false, playError: null }
      window.__GOLDEN12_AUDIO__.push({ element: this, record })
      this.addEventListener('playing', () => { record.playingEvent = true }, { once: true })
      const result = originalPlay.apply(this, args)
      if (result && typeof result.catch === 'function') {
        result.catch((error) => { record.playError = `${error?.name || 'Error'}: ${error?.message || String(error)}` })
      }
      return result
    }
  })
  page.on('pageerror', (error) => addEvent('pageerror', { text: String(error).slice(0, 1200) }))
  page.on('console', (message) => {
    if (message.type() === 'error') addEvent('console_error', { text: message.text().slice(0, 1200) })
    else if (message.type() === 'warning') addEvent('console_warning', { text: message.text().slice(0, 800) })
  })
  page.on('response', (response) => {
    if (response.status() >= 400) {
      const url = response.url()
      const expected = response.status() === 404 && new URL(url).pathname.endsWith('/project.json')
        ? 'optional-project-json'
        : null
      addEvent('http_error', { status: response.status(), url, expected })
    }
  })
  page.on('requestfailed', (request) => addEvent('request_failed', {
    url: request.url(),
    failure: request.failure()?.errorText ?? 'unknown',
  }))

  beginStep('01-menu', 'Главное меню; звук темы кампании')
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' })
  await page.locator('.main-menu .campaign-title').waitFor({ state: 'visible', timeout: 30000 })
  await waitForPaint()
  const initialMenuAudio = await audioProbe()
  const menuCheckpoint = await checkpoint('01-menu', 'Главное меню', null, '01-menu.png')

  // Первый реальный pointer-жест проверяет обычный путь разблокировки аудио.
  // Клик по «Кампании» остаётся в меню; модальное окно сразу закрывается.
  await page.mouse.click(30, 30)
  recordAction('user_gesture_for_audio', { target: 'main menu background' })
  await page.waitForTimeout(600)
  const postGestureAudio = await audioProbe()
  const campaignsButton = page.getByRole('button', { name: 'Кампании', exact: true })
  if (await campaignsButton.count()) {
    await campaignsButton.click()
    await page.locator('.campaigns-overlay').waitFor({ state: 'visible', timeout: 8000 })
    recordAction('open_campaign_catalog')
    await page.locator('.campaigns-head button').click()
    await page.locator('.campaigns-overlay').waitFor({ state: 'detached', timeout: 8000 })
    recordAction('close_campaign_catalog')
  }
  const finalMenuAudio = await audioProbe()

  beginStep('02-hero', 'Создание героя')
  await clickButton('Новый забег')
  await page.locator('.char-create').waitFor({ state: 'visible', timeout: 12000 })
  await page.locator('.char-name').fill('Проба GOLD-1.2')
  await page.getByRole('button', { name: /Дознаватель Надзора/ }).click()
  await page.getByRole('button', { name: /Сыскарь/ }).click()
  await page.locator('.char-create').evaluate((element) => { element.scrollTop = 0 })
  await page.waitForTimeout(250)
  const heroChoices = await page.evaluate(() => ({
    name: document.querySelector('.char-name')?.value ?? null,
    selected: [...document.querySelectorAll('.char-prof-card.sel .char-prof-label')].map((item) => item.textContent?.trim()),
    startDisabled: [...document.querySelectorAll('.char-create-foot button')].find((button) => button.textContent?.includes('Начать забег'))?.disabled ?? null,
    visibleText: document.querySelector('.char-create')?.innerText?.replace(/\n{2,}/g, '\n').slice(0, 1100) ?? '',
  }))
  recordAction('configure_hero', heroChoices)
  const heroCheckpoint = await checkpoint('02-hero', 'Герой выбран на экране создания персонажа', null, '02-hero-creation.png')

  beginStep('03-gate', 'Первый вход в шлюз')
  await clickButton('Начать забег')
  await waitForScene('gate_hall')
  await settleStoryOverlays()
  await waitForScene('gate_hall')
  const gateCheckpoint = await checkpoint('03-gate', 'Первая сцена — Шлюзовая камера', 'scene_gate_hall', '03-gate.png')

  beginStep('route-map', 'Карта: переход из шлюза к седьмой помпе')
  const mapNav = page.locator('.nav-zone').filter({ hasText: 'На схему ярусов' }).first()
  await mapNav.waitFor({ state: 'visible', timeout: 10000 })
  await mapNav.click()
  await page.locator('.map-screen').waitFor({ state: 'visible', timeout: 10000 })
  await waitForPaint()
  const mapCheckpoint = await checkpoint('route-map', 'Промежуточный экран карты', null, 'route-map.png')
  const pumpPin = page.locator('.map-pin').filter({ hasText: 'Седьмая помпа' }).first()
  await pumpPin.waitFor({ state: 'visible', timeout: 10000 })
  const pinText = (await pumpPin.innerText()).replace(/\s+/g, ' ').trim()
  await pumpPin.click()
  await page.locator('.travel-confirm').waitFor({ state: 'visible', timeout: 10000 })
  const travelDialogText = (await page.locator('.travel-confirm').innerText()).replace(/\s+/g, ' ').trim()
  recordAction('select_map_destination', { pin: pinText, confirm: travelDialogText })
  await clickButton('В путь')
  recordAction('start_travel', { origin: 'loc_gate', destination: 'loc_pump7', expectedCostTicks: 1 })

  beginStep('04-machine-hall', 'Машинный зал седьмой помпы')
  await waitForScene('pump_hall', 25000)
  await settleStoryOverlays()
  await waitForScene('pump_hall')
  const machineCheckpoint = await checkpoint('04-machine-hall', 'Машинный зал седьмой помпы', 'scene_pump_hall', '04-machine-hall.png')

  let dialogueCheckpoint = null
  if (SAVE_LOAD_MODE) {
    beginStep('04a-dialogue-choice', 'Диалог с Ирой: выбран вопрос о ночи тринадцатого')
    const iraSlot = page.locator('.slot-hotspot').filter({ hasText: /пульта/ }).first()
    await iraSlot.waitFor({ state: 'visible', timeout: 10000 })
    await iraSlot.click()
    recordAction('interact_with_ira', { slotLabel: 'Девушка у пульта', entity: 'npc_ira' })
    const dialogue = await chooseDialogue('Расскажи, что случилось в ночь тринадцатого.')
    await settleStoryOverlays(20000, { includeDialogue: false })
    await revealDialogueChoices(dialogue)
    await endDialogueIfOpen(dialogue)
    await dialogue.waitFor({ state: 'detached', timeout: 10000 })
    await settleStoryOverlays(20000, { includeDialogue: false })
    dialogueCheckpoint = await checkpoint('04a-dialogue-choice', 'Диалог завершён; флаг ira_story ожидается до сохранения', 'scene_pump_hall')
  }

  beginStep('05-first-clue', 'Первая улика: осмотр привода')
  const beforeClueTime = await page.locator('.hud-time').innerText().catch(() => null)
  const attempts = []
  let clueMessage = ''
  let clueFound = false
  for (let attempt = 1; attempt <= 8; attempt++) {
    const pumpEngineSlot = page.locator('.slot-hotspot').filter({ hasText: 'Седьмая помпа' }).first()
    await pumpEngineSlot.waitFor({ state: 'visible', timeout: 10000 })
    await pumpEngineSlot.click()
    await page.locator('.itemdlg-overlay').waitFor({ state: 'visible', timeout: 10000 })
    const option = page.getByRole('button', { name: /Осмотреть привод/ }).first()
    const hint = (await option.innerText()).replace(/\s+/g, ' ').trim()
    await option.click()
    const outcome = await resolveInvestigationOutcome(attempt)
    clueMessage = outcome.message
    const attemptTime = await page.locator('.hud-time').innerText().catch(() => null)
    clueFound = outcome.clueFound
    const result = {
      attempt,
      option: hint,
      hudTime: attemptTime,
      success: clueFound,
      message: clueMessage.slice(0, 1200),
      transcript: outcome.transcript,
    }
    attempts.push(result)
    recordAction('investigate_pump_drive', result)
    if (clueFound) break
    if (attempt < 8) await page.waitForTimeout(300)
  }
  if (SAVE_LOAD_MODE && clueFound) {
    const clueOutcome = page.locator('.message-overlay:not(.itemdlg-overlay)').first()
    if (await clueOutcome.count()) {
      const ok = clueOutcome.getByRole('button', { name: 'Ок', exact: true })
      if (await ok.count()) await ok.click()
      else await clueOutcome.click()
      recordAction('dismiss_clue_success_message')
      await page.waitForTimeout(250)
    }
    await settleStoryOverlays(10000, { includeDialogue: false })
  }
  const clueCheckpoint = await checkpoint('05-first-clue', 'Первая улика после осмотра привода', 'scene_pump_hall', '05-first-clue.png')
  const afterClueTime = await page.locator('.hud-time').innerText().catch(() => null)
  const startMinutes = parseHudMinutes(gateCheckpoint.hudTime)
  const endMinutes = parseHudMinutes(afterClueTime)
  const gameMinutes = startMinutes !== null && endMinutes !== null ? endMinutes - startMinutes : null
  const soundSummary = {
    initial: initialMenuAudio,
    afterUserGesture: postGestureAudio,
    atMenuExit: finalMenuAudio,
    observedPlayback: initialMenuAudio.playbackObserved || postGestureAudio.playbackObserved || finalMenuAudio.playbackObserved,
  }

  let persistence = null
  let beforeSaveCheckpoint = null
  let reloadMenuCheckpoint = null
  let resumeCheckpoint = null
  let afterLoadCheckpoint = null
  if (SAVE_LOAD_MODE && clueFound) {
    beginStep('06-before-save', 'Контроль состояния и кадр перед сохранением')
    await waitForPaint()
    const beforeSaveRuntime = await readStoredSnapshot(AUTO_SAVE_KEY, 'autosave/runtime snapshot before manual save')
    if (!beforeSaveRuntime.present) throw new Error(`No pre-save autosave found at ${AUTO_SAVE_KEY}`)
    recordAction('state_before_save', { snapshot: beforeSaveRuntime })
    beforeSaveCheckpoint = await checkpoint('06-before-save', 'Машинный зал и найденная улика до записи в слот', 'scene_pump_hall', 'before-save.png')

    await page.getByRole('button', { name: 'Сохранения', exact: true }).click()
    const savesPanel = page.locator('.panel-overlay')
    await savesPanel.waitFor({ state: 'visible', timeout: 10000 })
    const saveRow = page.locator('.save-slot-row').filter({ hasText: `Слот ${SAVE_SLOT}` }).first()
    await saveRow.getByRole('button', { name: 'Записать', exact: true }).click()
    await page.waitForFunction((key) => {
      try { return !!localStorage.getItem(key) } catch { return false }
    }, MANUAL_SAVE_KEY, { timeout: 10000 })
    const savedSlot = await readStoredSnapshot(MANUAL_SAVE_KEY, `manual slot ${SAVE_SLOT} immediately after save`)
    if (!savedSlot.present) throw new Error(`Manual slot ${SAVE_SLOT} was not persisted at ${MANUAL_SAVE_KEY}`)
    recordAction('manual_save_written', { slot: SAVE_SLOT, snapshot: savedSlot })

    const requiredFlags = ['case_opened', 'gate_intro_done', 'met_ira', 'ira_story', 'clue_glove']
    const requiredFlagValues = Object.fromEntries(requiredFlags.map((name) => [name, savedSlot.flags?.[name] ?? null]))
    const missingRequiredFlags = requiredFlags.filter((name) => savedSlot.flags?.[name] !== true)
    if (missingRequiredFlags.length) {
      throw new Error(`Expected route/dialogue/clue flags were not true in the saved slot: ${JSON.stringify({ missingRequiredFlags, requiredFlagValues })}`)
    }

    const saveComparison = compareSnapshots(beforeSaveRuntime, savedSlot, 'save serialization')
    log('save_comparison', saveComparison)

    beginStep('07-page-reload', 'Перезагрузка вкладки после записи слота')
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.locator('.main-menu .campaign-title').waitFor({ state: 'visible', timeout: 30000 })
    await waitForPaint()
    reloadMenuCheckpoint = await checkpoint('07-after-reload-menu', 'Главное меню после page.reload()', null, 'after-reload-menu.png')

    beginStep('07a-continue-autosave', 'Загрузка автосохранения после перезагрузки')
    await page.getByRole('button', { name: 'Продолжить', exact: true }).click()
    await waitForScene('pump_hall', 25000)
    await settleStoryOverlays(20000)
    await waitForScene('pump_hall')
    const afterReloadContinue = await readStoredSnapshot(AUTO_SAVE_KEY, 'autosave/runtime after reload and Continue')
    if (!afterReloadContinue.present) throw new Error(`Autosave missing after Continue at ${AUTO_SAVE_KEY}`)
    recordAction('state_after_reload_continue', { snapshot: afterReloadContinue })
    const reloadComparison = compareSnapshots(beforeSaveRuntime, afterReloadContinue, 'page reload + Continue rehydration')
    log('reload_continue_comparison', reloadComparison)
    resumeCheckpoint = await checkpoint('07a-after-reload-continue', 'Сцена и время после восстановления автосохранения', 'scene_pump_hall')

    beginStep('08-load-manual-slot', `Загрузка слота ${SAVE_SLOT} после перезагрузки`)
    await page.getByRole('button', { name: 'Сохранения', exact: true }).click()
    await savesPanel.waitFor({ state: 'visible', timeout: 10000 })
    const loadRow = page.locator('.save-slot-row').filter({ hasText: `Слот ${SAVE_SLOT}` }).first()
    await loadRow.getByRole('button', { name: 'Загрузить', exact: true }).click()
    await savesPanel.waitFor({ state: 'detached', timeout: 10000 })
    await waitForScene('pump_hall', 25000)
    await waitForPaint()
    const afterLoadRuntime = await readStoredSnapshot(AUTO_SAVE_KEY, `autosave/runtime after loading manual slot ${SAVE_SLOT}`)
    if (!afterLoadRuntime.present) throw new Error(`No autosave/runtime snapshot after loading manual slot ${SAVE_SLOT}`)
    recordAction('state_after_manual_load', { slot: SAVE_SLOT, snapshot: afterLoadRuntime })
    afterLoadCheckpoint = await checkpoint('08-after-load', `Сцена после загрузки ручного слота ${SAVE_SLOT}`, 'scene_pump_hall', 'after-load.png')
    const loadComparison = compareSnapshots(savedSlot, afterLoadRuntime, `manual slot ${SAVE_SLOT} load/rehydration`)
    log('load_comparison', loadComparison)

    const allComparisons = [saveComparison, reloadComparison, loadComparison]
    const discrepancies = allComparisons.flatMap((comparison) => comparison.discrepancies)
    const loadedFlagValues = Object.fromEntries(requiredFlags.map((name) => [name, afterLoadRuntime.flags?.[name] ?? null]))
    const missingLoadedFlags = requiredFlags.filter((name) => afterLoadRuntime.flags?.[name] !== true)
    if (missingLoadedFlags.length) {
      throw new Error(`Expected flags missing after rehydration: ${JSON.stringify({ missingLoadedFlags, loadedFlagValues })}`)
    }
    persistence = {
      autoSaveKey: AUTO_SAVE_KEY,
      manualSaveKey: MANUAL_SAVE_KEY,
      slot: SAVE_SLOT,
      requiredFlags,
      requiredFlagValuesBeforeLoad: requiredFlagValues,
      requiredFlagValuesAfterLoad: loadedFlagValues,
      observedAbsentFlags: ['pump_seen'].map((name) => ({
        flag: name,
        scene: 'scene_pump_hall',
        step: '04-machine-hall',
        beforeSave: beforeSaveRuntime.flags?.[name] ?? null,
        saved: savedSlot.flags?.[name] ?? null,
        afterLoad: afterLoadRuntime.flags?.[name] ?? null,
        interpretation: 'не был установлен до сохранения; не является потерей при сохранении/загрузке',
      })),
      flagsSetBeforeSave: savedSlot.setFlags,
      flagsSetAfterLoad: afterLoadRuntime.setFlags,
      beforeSaveRuntime,
      savedSlot,
      afterReloadContinue,
      afterLoadRuntime,
      comparisons: allComparisons,
      discrepancies,
      discrepancyCount: discrepancies.length,
      verdict: discrepancies.length === 0 ? 'потерь нет' : 'есть численные расхождения',
    }
    log('persistence_result', persistence)
  }

  const checkpoints = [
    menuCheckpoint, heroCheckpoint, gateCheckpoint, mapCheckpoint, machineCheckpoint,
    dialogueCheckpoint, clueCheckpoint, beforeSaveCheckpoint, reloadMenuCheckpoint, resumeCheckpoint, afterLoadCheckpoint,
  ].filter(Boolean)
  const pageErrors = events.filter((item) => item.type === 'pageerror')
  const consoleErrors = events.filter((item) => item.type === 'console_error')
  const emptyBackgrounds = checkpoints.reduce((total, checkpointItem) => total + (checkpointItem.emptyBackgrounds ?? 0), 0)
  const browserErrorSummary = {
    pageerrorCount: pageErrors.length,
    pageerrors: pageErrors.map(({ step, text }) => ({ step, text })),
    consoleErrorCount: consoleErrors.length,
    consoleErrors: consoleErrors.map(({ step, text }) => ({ step, text })),
    httpErrorCount: events.filter((item) => item.type === 'http_error').length,
    requestFailureCount: events.filter((item) => item.type === 'request_failed').length,
    emptyBackgrounds,
    checkpointCount: checkpoints.length,
  }
  log('browser_error_summary', browserErrorSummary)

  const summary = {
    task: TASK,
    menu: menuCheckpoint,
    hero: heroCheckpoint,
    gate: gateCheckpoint,
    routeMap: mapCheckpoint,
    machineHall: machineCheckpoint,
    dialogueChoice: dialogueCheckpoint,
    firstClue: clueCheckpoint,
    beforeSave: beforeSaveCheckpoint,
    afterReloadMenu: reloadMenuCheckpoint,
    afterReloadContinue: resumeCheckpoint,
    afterLoad: afterLoadCheckpoint,
    sound: soundSummary,
    clueFound,
    clueAttempts: attempts,
    hudTimeAtFirstClueStart: beforeClueTime,
    hudTimeAfterFirstClue: afterClueTime,
    observedGameMinutes: gameMinutes,
    targetGameMinutes: 60,
    projectJson404Count: route404Project,
    persistence,
    browser: browserErrorSummary,
    result: !clueFound ? 'stop-no-clue-after-8-investigations' : (persistence?.verdict ?? 'route-complete'),
  }
  log('run_summary', summary)
  console.log(`ARTIFACTS: ${relative(ROOT, LOG_PATH).split(sep).join('/')} ; ${relative(ROOT, OUTPUT_DIR).split(sep).join('/')}/`)

  if (!clueFound || browserErrorSummary.pageerrorCount > 0 || emptyBackgrounds > 0 || (SAVE_LOAD_MODE && !persistence)) process.exitCode = 1
}

try {
  await main()
} catch (error) {
  log('run_failure', { step: activeStep, message: String(error?.stack ?? error).slice(0, 4000) })
  process.exitCode = 1
} finally {
  try { await browser?.close() } catch { /* browser already exited */ }
  if (server.pid) {
    try { process.kill(-server.pid, 'SIGTERM') } catch { server.kill('SIGTERM') }
    await Promise.race([
      new Promise((resolvePromise) => server.once('close', resolvePromise)),
      delay(3000),
    ])
    if (server.exitCode === null) {
      try { process.kill(-server.pid, 'SIGKILL') } catch { server.kill('SIGKILL') }
    }
  }
  log('cleanup', { serverStopped: server.exitCode !== null })
}
