#!/usr/bin/env node
/**
 * Browser proof for GOLD-1.10: reach three endings from the manifest-pinned
 * campaign through real scene interactions and currently available dialogue choices.
 * The imported .golden tree is read-only; this runner never writes game state.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { extname, dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync, spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { launchChromium, chromiumVersion } from '../visual/local-browser.mjs'
import { readGoldenManifest, verifyImportedTree } from './manifest-pin.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const CAMPAIGN_ROOT = join(ROOT, '.golden', 'karkas')
const MANIFEST_PATH = join(ROOT, '.golden', 'manifest.json')
const TASK = 'GOLD-1.10'
const OUTPUT_DIR = join(ROOT, '_tools', 'reports', TASK)
const LOG_PATH = join(ROOT, '_tools', 'reports', `${TASK}.log`)
const REPORT_PATH = join(ROOT, '_tools', 'reports', `${TASK}.md`)
const PORT = Number(process.env.GOLDEN_PORT || 4174)
const BASE_URL = `http://127.0.0.1:${PORT}`
const WIDTH = 1440
const HEIGHT = 900
const EXPECTED_ENDING_IDS = ['ending_pump', 'ending_vein', 'ending_closed']
const UNREACHED_REASONS = {
  ending_silence_kell: 'Не запускался маршрут взрыва затвора с гибелью Келла; в этом прогоне выбраны другие три финала.',
  ending_silence_stood: 'Не запускался финальный разговор/проверка убеждения Келла у затвора.',
  ending_silence_rigged: 'Не собирался заряд и не выполнялся маршрут установки на замедлитель.',
  ending_silence: 'Базовая ветка «Тишина» не выбиралась; выполнены помпа, Жила и закрытие дела.',
  ending_flood: 'Срок 72 часа намеренно не выжидался; финал потопа не запускался.',
  ending_death: 'Смерть героя намеренно не вызывалась; это не один из трёх проверяемых маршрутов.',
}

const manifest = readGoldenManifest(MANIFEST_PATH, CAMPAIGN_ROOT)
const campaign = JSON.parse(readFileSync(join(CAMPAIGN_ROOT, 'campaign.json'), 'utf8'))
const SAVE_KEY = `narthex:save:${campaign.id}`
const META_KEY = `narthex:meta:${campaign.id}`
const campaignEndings = Array.isArray(campaign.endings) ? campaign.endings : []
for (const id of EXPECTED_ENDING_IDS) {
  if (!campaignEndings.some((ending) => ending.id === id)) {
    throw new Error(`Expected ending data ID is absent from the pinned campaign: ${id}`)
  }
}

// DlgDoc choices have no native stable IDs. These source references are used
// only to locate intended choices in the pinned data. The actual selection ID
// is computed afresh from the 0-based live index in the visible choice list.
const DIALOGUE_CHOICE_TARGETS = {
  reshGiveCore: { npcId: 'npc_resh', sourceRef: 'dialogues/resh.dlg.json#Начало[8]' },
  reshLeave: { npcId: 'npc_resh', sourceRef: 'dialogues/resh.dlg.json#Начало[14]' },
  veinReturnCore: { npcId: 'npc_vein', sourceRef: 'dialogues/vein.dlg.json#Начало[2]' },
  kastShowLedger: { npcId: 'npc_kast', sourceRef: 'dialogues/kast.dlg.json#Начало[2]' },
  kastSubmitLedger: { npcId: 'npc_kast', sourceRef: 'dialogues/kast.dlg.json#Гроссбух[0]' },
}

const dlgDocs = new Map()
function dialogueDoc(file) {
  if (!dlgDocs.has(file)) {
    dlgDocs.set(file, JSON.parse(readFileSync(join(CAMPAIGN_ROOT, file), 'utf8')))
  }
  return dlgDocs.get(file)
}
function resolveChoiceSource(sourceRef) {
  const match = /^(.*?)#(.+)\[(\d+)\]$/.exec(sourceRef)
  if (!match) throw new Error(`Malformed dialogue source reference: ${sourceRef}`)
  const [, file, nodeId, ordinalText] = match
  const ordinal = Number(ordinalText)
  const node = dialogueDoc(file).nodes?.find((candidate) => candidate.id === nodeId)
  const choice = node?.choices?.[ordinal]
  if (!choice) throw new Error(`Dialogue source reference does not resolve in imported data: ${sourceRef}`)
  const spokenLines = (choice.sections ?? []).flatMap((section) => section.steps ?? [])
    .filter((step) => step.kind === 'line' && step.line?.text)
    .map((step) => step.line.text)
  return { sourceRef, file, nodeId, ordinal, text: choice.text, spokenLines }
}
for (const target of Object.values(DIALOGUE_CHOICE_TARGETS)) resolveChoiceSource(target.sourceRef)

mkdirSync(OUTPUT_DIR, { recursive: true })
writeFileSync(LOG_PATH, '')
const events = []
const backgroundSamples = []
let browser
let page
let activeRun = 'setup'
let activeStage = 'setup'
let routeStepCount = 0
let routeStartedAt = 0
let routeActionSequence = 0
let routeActions = []
let routeLastDialogue = null
let lastKnownSceneId = null
let expectedProjectJson404 = 0

function log(event, data = {}) {
  const record = { at: new Date().toISOString(), event, run: activeRun, stage: activeStage, ...data }
  appendFileSync(LOG_PATH, `${JSON.stringify(record)}\n`)
  const suffix = data.action ? ` ${data.action}` : data.step ? ` ${data.step}` : ''
  console.log(`${record.at} ${event}${suffix}`)
  return record
}
function browserEvent(type, details = {}) {
  const item = { at: new Date().toISOString(), run: activeRun, stage: activeStage, type, ...details }
  events.push(item)
  log('browser_event', item)
}
function setStage(stage) {
  activeStage = stage
}
function routeStep(action, details = {}) {
  routeStepCount++
  routeActionSequence++
  const item = {
    at: new Date().toISOString(),
    run: activeRun,
    sequence: routeActionSequence,
    step: routeStepCount,
    action,
    ...details,
  }
  routeActions.push(item)
  log('route_step', item)
  return item
}
function uiAction(action, details = {}) {
  log('ui_action', { action, ...details })
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
      if (relativePath === 'project.json') expectedProjectJson404++
      return route.fulfill({
        status: 404,
        contentType: 'text/plain; charset=utf-8',
        body: `Missing pinned campaign resource: ${relativePath}`,
      })
    }
    return route.fulfill({ status: 200, contentType: mimeType(file), body: readFileSync(file) })
  })
}
async function waitForServer(timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Vite exited early with code ${server.exitCode}`)
    try {
      const response = await fetch(`${BASE_URL}/`)
      if (response.ok) return
    } catch { /* Vite is still starting. */ }
    await delay(200)
  }
  throw new Error(`Vite did not answer at ${BASE_URL} within ${timeoutMs} ms`)
}
async function waitForPaint() {
  await page.waitForFunction(() => [...document.images].every((image) => image.complete), undefined, { timeout: 15000 })
  await page.waitForFunction(() => {
    const ready = (root, imageSelector, artSelector, fallbackSelector) => {
      if (!root) return null
      if (fallbackSelector && root.querySelector(fallbackSelector)) return false
      const image = imageSelector ? root.querySelector(imageSelector) : null
      if (image) return image.complete && image.naturalWidth > 0 && image.naturalHeight > 0
      return artSelector ? !!root.querySelector(artSelector) : true
    }
    const ending = ready(document.querySelector('.end-overlay'), 'img.end-bg', '.end-bg svg', '.end-bg-fallback')
    if (ending !== null) return ending
    const map = ready(document.querySelector('.map-screen'), 'img.map-bg', 'svg.map-bg, .map-bg svg', '.map-bg-fallback')
    if (map !== null) return map
    const scene = ready(document.querySelector('.scene-stage'), 'img.scene-bg', '.scene-bg svg', '.scene-bg-fallback')
    if (scene !== null) return scene
    const menu = ready(document.querySelector('.main-menu'), 'img.menu-bg', '', '')
    if (menu !== null) return menu
    return true
  }, undefined, { timeout: 15000 })
  await page.waitForTimeout(350)
}
async function measureScreen() {
  await waitForPaint()
  const metrics = await page.evaluate((fallbackSceneId) => {
    const text = document.body?.innerText?.replace(/\n{2,}/g, '\n').trim() ?? ''
    const scene = document.querySelector('.scene-stage')
    const ending = document.querySelector('.end-overlay')
    const menu = document.querySelector('.main-menu')
    const creation = document.querySelector('.char-create')
    const map = document.querySelector('.map-screen')
    let background = { kind: 'not-applicable', empty: false, source: null, width: null, height: null }
    const imageMetrics = (image, kind) => ({
      kind,
      empty: !image.complete || image.naturalWidth === 0 || image.naturalHeight === 0,
      source: image.currentSrc || image.src || null,
      width: image.naturalWidth || null,
      height: image.naturalHeight || null,
    })
    if (ending) {
      const image = ending.querySelector('img.end-bg')
      background = image
        ? imageMetrics(image, 'ending-image')
        : { kind: 'ending-background-missing', empty: true, source: null, width: null, height: null }
    } else if (map) {
      const image = map.querySelector('img.map-bg')
      const art = map.querySelector('svg.map-bg, .map-bg svg')
      const fallback = map.querySelector('.map-bg-fallback')
      if (fallback) background = { kind: 'map-fallback', empty: true, source: null, width: null, height: null }
      else if (image) background = imageMetrics(image, 'map-image')
      else if (art) background = { kind: 'map-art', empty: false, source: 'inline-svg', width: null, height: null }
      else background = { kind: 'map-background-missing', empty: true, source: null, width: null, height: null }
    } else if (scene) {
      const image = scene.querySelector('img.scene-bg')
      const art = scene.querySelector('.scene-bg svg')
      const fallback = scene.querySelector('.scene-bg-fallback')
      if (fallback) background = { kind: 'fallback', empty: true, source: null, width: null, height: null }
      else if (image) background = imageMetrics(image, 'scene-image')
      else if (art) background = { kind: 'scene-art', empty: false, source: 'inline-svg', width: null, height: null }
      else background = { kind: 'scene-background-missing', empty: true, source: null, width: null, height: null }
    } else if (menu) {
      const image = menu.querySelector('img.menu-bg')
      background = image
        ? imageMetrics(image, 'menu-image')
        : { kind: 'menu-background-missing', empty: true, source: null, width: null, height: null }
    } else if (creation) {
      background = { kind: 'character-creation-panel', empty: false, source: null, width: null, height: null }
    }
    const title = ending?.querySelector('.end-panel h1')?.textContent?.trim() ?? null
    const message = document.querySelector('.message-overlay:not(.itemdlg-overlay)')?.innerText?.replace(/\n{2,}/g, '\n').trim() ?? ''
    return {
      text: text.slice(0, 2600),
      sceneId: fallbackSceneId,
      sceneLabel: document.querySelector('.scene-name')?.textContent?.trim() ?? null,
      locationLabel: document.querySelector('.scene-location')?.textContent?.trim() ?? null,
      hudTime: document.querySelector('.hud-time')?.textContent?.trim() ?? null,
      title,
      background,
      emptyBackgrounds: background.empty ? 1 : 0,
      activeMessage: message.slice(0, 1200),
      screen: ending ? 'ending' : map ? 'map' : scene ? 'scene' : menu ? 'menu' : creation ? 'character-creation' : 'other',
    }
  }, lastKnownSceneId)
  return metrics
}
async function checkpoint(label, screenshotName = null) {
  const metrics = await measureScreen()
  const sample = {
    at: new Date().toISOString(),
    run: activeRun,
    stage: activeStage,
    label,
    screen: metrics.screen,
    sceneId: metrics.sceneId,
    background: metrics.background,
    emptyBackgrounds: metrics.emptyBackgrounds,
  }
  backgroundSamples.push(sample)
  let screenshot = null
  if (screenshotName) {
    const path = join(OUTPUT_DIR, screenshotName)
    await page.screenshot({ path, type: 'png', fullPage: false, animations: 'disabled' })
    const bytes = readFileSync(path)
    if (bytes.length < 24 || bytes.toString('hex', 0, 8) !== '89504e470d0a1a0a') {
      throw new Error(`Screenshot is not a valid PNG: ${path}`)
    }
    screenshot = {
      path: relative(ROOT, path).split(sep).join('/'),
      width: bytes.readUInt32BE(16),
      height: bytes.readUInt32BE(20),
      bytes: bytes.length,
    }
    if (screenshot.width !== WIDTH || screenshot.height !== HEIGHT) {
      throw new Error(`Final screenshot dimensions ${screenshot.width}x${screenshot.height}; expected ${WIDTH}x${HEIGHT}`)
    }
  }
  log('checkpoint', { label, ...sample, title: metrics.title, hudTime: metrics.hudTime, screenshot })
  return { ...sample, ...metrics, screenshot }
}
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').replace(/^▸\s*/, '').trim()
}
async function waitForScene(sceneId, timeout = 25000) {
  const bareId = sceneId.replace(/^scene_/, '')
  await page.waitForFunction(({ id, saveKey }) => {
    const image = document.querySelector('img.scene-bg')
    const source = image?.getAttribute('src') || ''
    if (source.includes(`/scene_${id}.`) || source.includes(`/scene_${id}_`)) return true
    // Campaign animated backgrounds may use a generic path such as
    // assets/img/scenes/anim/dry_row_fire_3.jpg; confirm their canonical scene
    // from the runtime autosave and require a loaded, non-empty scene image.
    try {
      const raw = localStorage.getItem(saveKey)
      const envelope = raw ? JSON.parse(raw) : null
      const state = envelope?.state ?? envelope
      return state?.scene === `scene_${id}` && !!image?.complete && image.naturalWidth > 0
    } catch { return false }
  }, { id: bareId, saveKey: SAVE_KEY }, { timeout })
  lastKnownSceneId = `scene_${bareId}`
  await waitForPaint()
}
async function resolveCombatIfPresent(maxActions = 180) {
  const overlay = page.locator('.combat-overlay')
  if (!(await overlay.count())) return false
  const previousStage = activeStage
  setStage('random-encounter-combat')
  log('combat_start', { policy: 'real UI attacks, movement, and pass-turn; no state mutation' })
  let actions = 0
  let waitLogged = false
  while (actions < maxActions) {
    if (!(await overlay.count())) {
      if (await page.locator('.end-overlay').count()) {
        throw new Error(`Combat ended the run before a campaign ending: ${normalizeText(await page.locator('.end-panel h1').innerText().catch(() => 'unknown ending'))}`)
      }
      log('combat_finished', { actions })
      setStage(previousStage)
      return true
    }
    const tutorial = overlay.getByRole('button', { name: /Понятно, в бой/ }).first()
    if (await tutorial.count()) {
      await tutorial.click()
      uiAction('combat_tutorial_dismissed')
      continue
    }
    const victoryContinue = overlay.locator('.combat-victory').getByRole('button', { name: 'Продолжить', exact: true })
    if (await victoryContinue.count()) {
      await victoryContinue.click()
      await overlay.waitFor({ state: 'detached', timeout: 15000 })
      log('combat_finished', { actions, result: 'victory' })
      setStage(previousStage)
      return true
    }
    const defeat = overlay.locator('.combat-defeat')
    if (await defeat.count()) {
      throw new Error(`Combat defeat/down state interrupted the ending route: ${normalizeText(await defeat.innerText())}`)
    }
    const passTurn = overlay.locator('button[data-tip^="Закончить ход без атаки"]').first()
    if (!(await passTurn.count()) && !waitLogged) {
      waitLogged = true
      log('combat_wait_state', {
        turn: normalizeText(await overlay.locator('.combat-turn').innerText().catch(() => '')),
        buttons: (await overlay.locator('button').allInnerTexts()).map(normalizeText),
        text: normalizeText(await overlay.innerText().catch(() => '')).slice(0, 1800),
      })
    }
    if (await passTurn.count()) {
      const fleeButton = overlay.locator('button[data-tip^="Отступление из боя"]').first()
      if (await fleeButton.count()) {
        await fleeButton.click()
        actions++
        log('combat_action', { action: 'flee', actionNumber: actions })
        await page.waitForTimeout(180)
        continue
      }
      const attackable = overlay.locator('svg.combat-grid polygon.hex-attack').first()
      if (await attackable.count()) {
        const targetIndex = await page.evaluate(() => {
          const stage = document.querySelector('.combat-stage')
          const svg = stage?.querySelector('svg.combat-grid')
          const polygon = svg?.querySelector('polygon.hex-attack')
          if (!stage || !svg || !polygon) return 0
          const points = [...polygon.points]
          const x = points.reduce((sum, point) => sum + point.x, 0) / points.length
          const y = points.reduce((sum, point) => sum + point.y, 0) / points.length
          const view = svg.viewBox.baseVal
          const tokens = [...stage.querySelectorAll('.token-figure.figure-enemy:not(.token-dead), .token.token-enemy:not(.token-dead)')]
          const centers = tokens.map((element) => {
            const left = Number.parseFloat(element.style.left) / 100 * view.width
            const top = Number.parseFloat(element.style.top) / 100 * view.height
            const width = Number.parseFloat(element.style.width) / 100 * view.width
            return { x: left + width / 2, y: top + width / 2 }
          })
          return centers.length ? centers.reduce((best, center, index) =>
            Math.hypot(center.x - x, center.y - y) < Math.hypot(centers[best].x - x, centers[best].y - y) ? index : best, 0) : 0
        })
        const enemyTokens = overlay.locator('.combat-stage .token-figure.figure-enemy:not(.token-dead), .combat-stage .token.token-enemy:not(.token-dead)')
        await enemyTokens.nth(targetIndex).click()
        actions++
        log('combat_action', { action: 'attack', actionNumber: actions, targetIndex })
        await page.waitForTimeout(160)
        continue
      }
      const move = await page.evaluate(() => {
        const stage = document.querySelector('.combat-stage')
        const svg = stage?.querySelector('svg.combat-grid')
        if (!stage || !svg) return null
        const view = svg.viewBox.baseVal
        const enemies = [...stage.querySelectorAll('.token-enemy, .token-figure.figure-enemy')]
          .filter((element) => !element.classList.contains('token-dead'))
          .map((element) => {
            const left = Number.parseFloat(element.style.left) / 100 * view.width
            const top = Number.parseFloat(element.style.top) / 100 * view.height
            const width = Number.parseFloat(element.style.width) / 100 * view.width
            return { x: left + width / 2, y: top + width / 2 }
          })
        const player = [...stage.querySelectorAll('.token-player, .token-figure.figure-player')]
          .find((element) => element.classList.contains('figure-active'))
        const px = Number.parseFloat(player?.style.left ?? '0') / 100 * view.width + Number.parseFloat(player?.style.width ?? '0') / 100 * view.width / 2
        const py = Number.parseFloat(player?.style.top ?? '0') / 100 * view.height + Number.parseFloat(player?.style.width ?? '0') / 100 * view.height / 2
        const cells = [...svg.querySelectorAll('polygon.hex-reach')].map((polygon, index) => {
          const points = [...polygon.points]
          const x = points.reduce((sum, point) => sum + point.x, 0) / points.length
          const y = points.reduce((sum, point) => sum + point.y, 0) / points.length
          const distance = enemies.length
            ? Math.min(...enemies.map((enemy) => Math.hypot(enemy.x - x, enemy.y - y)))
            : Number.POSITIVE_INFINITY
          return { index, x, y, distance, fromPlayer: Math.hypot(px - x, py - y) }
        }).filter((cell) => cell.fromPlayer > 1)
        cells.sort((a, b) => a.distance - b.distance || a.fromPlayer - b.fromPlayer)
        return cells[0] ?? null
      })
      if (move) {
        await overlay.locator('svg.combat-grid polygon.hex-reach').nth(move.index).click()
        actions++
        log('combat_action', { action: 'move-toward-enemy', actionNumber: actions, distance: Number(move.distance.toFixed(1)) })
        await page.waitForTimeout(160)
        continue
      }
      await passTurn.click()
      actions++
      log('combat_action', { action: 'pass-turn', actionNumber: actions })
      await page.waitForTimeout(220)
      continue
    }
    await page.waitForTimeout(180)
    actions++
  }
  throw new Error(`Combat did not finish in ${maxActions} UI decisions.`)
}
async function exitIncidentalDialogue() {
  const dialogue = page.locator('.dialogue-overlay').first()
  await revealDialogueChoices(dialogue)
  const buttons = dialogue.locator('.dialogue-choices .choice-btn')
  const available = (await buttons.allInnerTexts()).map(normalizeText)
  const safeText = ['Иди своей дорогой.', 'Мне пора.']
  const choiceText = safeText.find((text) => available.includes(text))
  if (choiceText) {
    const choice = dialogue.getByRole('button', { name: new RegExp(escapeRegExp(choiceText)) }).first()
    await choice.click()
    routeStep('incidental_dialogue_exit', { choice: choiceText, availableChoices: available })
    await endFinishedDialogueIfOpen()
    return
  }
  const end = dialogue.getByRole('button', { name: /Закончить разговор/ }).last()
  if (await end.count()) {
    await end.click()
    uiAction('end_incidental_dialogue', { availableChoices: available })
    return
  }
  throw new Error(`Unexpected runtime dialogue during an ending route; refusing to guess a choice: ${JSON.stringify(available)}`)
}
async function settleStoryOverlays(maxMs = 40000) {
  const deadline = Date.now() + maxMs
  let passes = 0
  while (Date.now() < deadline && passes++ < 140) {
    const ending = page.locator('.end-overlay')
    if (await ending.count()) return true

    const combat = page.locator('.combat-overlay')
    if (await combat.count()) {
      await resolveCombatIfPresent()
      continue
    }
    const incidentalDialogue = page.locator('.dialogue-overlay').first()
    if (await incidentalDialogue.count()) {
      await exitIncidentalDialogue()
      continue
    }

    const cutscene = page.locator('.cutscene-overlay').first()
    if (await cutscene.count()) {
      const skip = cutscene.getByRole('button', { name: /^(Пропустить|Закрыть)$/ }).last()
      if (await skip.count()) {
        await skip.click({ timeout: 2000 }).catch(async () => cutscene.locator('.cs-stage').click({ timeout: 2000 }))
        uiAction('dismiss_cutscene', { method: 'button-or-stage' })
      } else {
        await cutscene.locator('.cs-stage').click({ position: { x: 100, y: 100 }, timeout: 2000 })
        uiAction('advance_cutscene_slide', { method: 'stage-click' })
      }
      await page.waitForTimeout(120)
      continue
    }

    const narrative = page.locator('.scene-narrative-overlay').first()
    if (await narrative.count()) {
      const skip = narrative.getByRole('button', { name: /Пропустить/ }).first()
      if (await skip.count()) {
        // Escape is the scene-intro skip control's explicit keyboard binding;
        // clicking the nested button would bubble into the parent advance handler.
        await page.keyboard.press('Escape')
        uiAction('skip_scene_narrative', { method: 'Escape' })
      } else {
        await narrative.getByRole('button').last().click({ timeout: 2000 })
        uiAction('advance_scene_narrative')
      }
      await page.waitForTimeout(120)
      continue
    }

    // Message/luck dialogs may be layered above campaign postcards or another
    // queued message. Resolve the top-level luck choice before clicking lower
    // message buttons, which would be intercepted.
    const reroll = page.getByRole('button', { name: 'Перебросить за удачу', exact: true }).last()
    if (await reroll.count()) {
      const text = normalizeText(await reroll.locator('xpath=ancestor::div[contains(@class,"message-overlay")]').innerText().catch(() => ''))
      await reroll.click({ timeout: 2000 })
      uiAction('reroll_for_luck', { text })
      await page.waitForTimeout(180)
      continue
    }
    const message = page.locator('.message-overlay:not(.itemdlg-overlay)').last()
    if (await message.count()) {
      const text = (await message.innerText().catch(() => '')).replace(/\n{2,}/g, '\n').trim().slice(0, 1200)
      const ok = message.getByRole('button', { name: 'Ок', exact: true })
      const continueButton = message.getByRole('button', { name: /^(Продолжить|Далее|Закрыть|Оставить как есть)$/ }).last()
      if (await ok.count()) await ok.click({ timeout: 2000 })
      else if (await continueButton.count()) await continueButton.click({ timeout: 2000 })
      else await message.click({ timeout: 2000 })
      uiAction('dismiss_message', { text, method: await ok.count() ? 'ok-button' : 'overlay-button-or-click' })
      await page.waitForTimeout(120)
      continue
    }

    const postcard = page.locator('.cf-postcard, .postcard-overlay, .postcard-layer').first()
    if (await postcard.count()) {
      const text = (await postcard.getAttribute('aria-label').catch(() => null)) ||
        (await postcard.innerText().catch(() => '')).replace(/\n{2,}/g, '\n').slice(0, 900)
      const button = postcard.getByRole('button').last()
      if (await button.count()) await button.click({ timeout: 2000 })
      else await postcard.click({ timeout: 2000 })
      uiAction('dismiss_postcard', { text, method: await button.count() ? 'button' : 'postcard-click' })
      await page.waitForTimeout(120)
      continue
    }

    await page.waitForTimeout(200)
    const pending = page.locator('.cutscene-overlay, .scene-narrative-overlay, .cf-postcard, .postcard-overlay, .postcard-layer, .message-overlay:not(.itemdlg-overlay)')
    if (await pending.count()) continue
    return true
  }
  const visible = await page.locator('.cutscene-overlay, .scene-narrative-overlay, .cf-postcard, .postcard-overlay, .postcard-layer, .message-overlay:not(.itemdlg-overlay)').count()
  throw new Error(`Story overlays did not settle in ${maxMs} ms; visible=${visible}`)
}
async function revealDialogueChoices(dialogue) {
  await dialogue.waitFor({ state: 'visible', timeout: 12000 })
  const skip = dialogue.getByRole('button', { name: /Пропустить/ }).first()
  if (await skip.count()) await skip.click({ timeout: 6000 })
  await page.waitForFunction(() => {
    const overlay = document.querySelector('.dialogue-overlay')
    return !!overlay?.querySelector('.dialogue-choices .choice-btn')
  }, undefined, { timeout: 12000 })
}
async function endFinishedDialogueIfOpen() {
  const dialogue = page.locator('.dialogue-overlay')
  if (!(await dialogue.count()) || !(await dialogue.isVisible().catch(() => false))) return
  await revealDialogueChoices(dialogue)
  const end = dialogue.getByRole('button', { name: /Закончить разговор/ }).last()
  if (await end.count()) {
    await end.click()
    uiAction('end_finished_dialogue')
    await dialogue.waitFor({ state: 'detached', timeout: 10000 })
  }
}
async function chooseDialogueById(targetKey) {
  const target = DIALOGUE_CHOICE_TARGETS[targetKey]
  if (!target) throw new Error(`Unknown dialogue choice target key: ${targetKey}`)
  const def = resolveChoiceSource(target.sourceRef)
  const dialogue = page.locator('.dialogue-overlay')
  await revealDialogueChoices(dialogue)
  const buttons = dialogue.locator('.dialogue-choices .choice-btn:not(.end)')
  const available = (await buttons.allInnerTexts()).map(normalizeText)
  const liveMatches = available.flatMap((text, index) => text === def.text ? [index] : [])
  if (liveMatches.length !== 1) {
    throw new Error(`Target ${targetKey} must match exactly one currently available live choice. Expected=${JSON.stringify(def.text)}; matches=${JSON.stringify(liveMatches)}; available=${JSON.stringify(available)}`)
  }
  // DialogueOverlay renders d.choices in order; each visible button's zero-based
  // position is the live choice index passed to engine.chooseDialogueOption.
  const liveRuntimeIndex = liveMatches[0]
  const liveId = `runtime:${target.npcId}#${def.nodeId}[${liveRuntimeIndex}]`
  const locator = buttons.nth(liveRuntimeIndex)
  await locator.waitFor({ state: 'visible', timeout: 8000 })
  if (normalizeText(await locator.innerText()) !== def.text) {
    throw new Error(`Live dialogue choice index ${liveRuntimeIndex} changed before click for ${targetKey}.`)
  }
  await locator.click()
  routeStep('dialogue_choice', {
    choiceId: liveId,
    liveRuntimeIndex,
    targetKey,
    sourceRef: def.sourceRef,
    choice: def.text,
    spokenLinesFromPinnedDialogue: def.spokenLines,
    availableChoices: available,
  })
  if (def.spokenLines.length) routeLastDialogue = { choiceId: liveId, targetKey, choice: def.text, spokenLines: def.spokenLines }
  await page.waitForTimeout(180)
  const stillOpen = await dialogue.isVisible().catch(() => false)
  if (stillOpen && def.spokenLines.length && !(await page.locator('.end-overlay').count())) {
    await revealDialogueChoices(dialogue)
    const observed = normalizeText(await dialogue.locator('.dialogue-lines').innerText().catch(() => ''))
    if (observed) routeLastDialogue = { choiceId: liveId, targetKey, choice: def.text, spokenLines: [observed] }
  }
  return liveId
}
const NPC_SLOT_ORDINALS = {
  scene_face: { npc_resh: 1, npc_vein: 0 },
  scene_office: { npc_kast: 0, npc_kell: 1 },
}
async function openNpcDialogue(labelPattern, npcId) {
  const state = await readRuntimeState()
  const expectedOrdinal = NPC_SLOT_ORDINALS[state?.scene]?.[npcId]
  const candidates = page.locator('.slot-hotspot.slot-npc')
  let slot = page.locator('.slot-hotspot').filter({ hasText: labelPattern }).first()
  let usedOrdinalFallback = false
  if (!(await slot.isVisible().catch(() => false))) {
    if (expectedOrdinal == null) throw new Error(`No NPC slot mapping for ${npcId} at ${state?.scene ?? 'unknown scene'}.`)
    slot = candidates.nth(expectedOrdinal)
    usedOrdinalFallback = true
  }
  await slot.waitFor({ state: 'visible', timeout: 12000 })
  const label = normalizeText(await slot.innerText())
  await slot.click()
  const dialogue = page.locator('.dialogue-overlay')
  await dialogue.waitFor({ state: 'visible', timeout: 12000 })
  uiAction('open_npc_dialogue', { npcId, slot: label, usedOrdinalFallback, slotOrdinal: usedOrdinalFallback ? expectedOrdinal : null })
  return dialogue
}
async function interactItem(labelPattern, optionLabel, actionName, expectedOptions = null) {
  const slot = page.locator('.slot-hotspot').filter({ hasText: labelPattern }).first()
  await slot.waitFor({ state: 'visible', timeout: 12000 })
  const slotText = normalizeText(await slot.innerText())
  await slot.click()
  const dialog = page.locator('.itemdlg-overlay')
  await dialog.waitFor({ state: 'visible', timeout: 10000 })
  const options = dialog.locator('button.itemdlg-option')
  const matches = []
  const optionTexts = []
  for (let i = 0; i < await options.count(); i++) {
    const option = options.nth(i)
    const label = normalizeText(await option.locator('span').first().innerText().catch(() => option.innerText()))
    optionTexts.push(label)
    if (label === optionLabel) matches.push(option)
  }
  if (!matches.length) {
    throw new Error(`Item option not available for ${actionName}: wanted=${JSON.stringify(optionLabel)}; slot=${JSON.stringify(slotText)}; available=${JSON.stringify(optionTexts)}`)
  }
  await matches[0].click()
  await dialog.waitFor({ state: 'detached', timeout: 8000 })
  routeStep(actionName, { slot: slotText, option: optionLabel, availableOptions: optionTexts, duplicateMatches: matches.length })
  await settleStoryOverlays()
  if (expectedOptions) {
    // Caller uses the expected label as an assertion note; actual gating was checked above.
    log('item_option_gate', { actionName, expectedOptions, availableOptions: optionTexts })
  }
  return optionTexts
}
async function navigateScene(label, sceneId, actionName = null) {
  const zone = page.locator('.nav-zone').filter({ hasText: label }).first()
  await zone.waitFor({ state: 'visible', timeout: 12000 })
  await zone.click()
  const next = `scene_${sceneId.replace(/^scene_/, '')}`
  await waitForScene(next)
  await settleStoryOverlays()
  routeStep(actionName ?? 'navigate_scene', { navigation: label, sceneId: next })
  await checkpoint(`${activeRun}:${next}`)
}
async function openMap() {
  const mapNav = page.locator('.nav-zone').filter({ hasText: 'На схему ярусов' }).first()
  await mapNav.waitFor({ state: 'visible', timeout: 12000 })
  await mapNav.click()
  await page.locator('.map-screen').waitFor({ state: 'visible', timeout: 12000 })
  await waitForPaint()
  await checkpoint(`${activeRun}:map-open`)
}
async function travelTo(locationLabel, arrivalScene, actionName = null) {
  await openMap()
  const pin = page.locator('.map-pin').filter({ hasText: locationLabel }).first()
  await pin.waitFor({ state: 'visible', timeout: 12000 })
  if (!(await pin.evaluate((element) => element.classList.contains('reachable') || element.classList.contains('here')))) {
    throw new Error(`Map destination is visible but not reachable: ${locationLabel}; pin=${await pin.innerText()}`)
  }
  const pinText = normalizeText(await pin.innerText())
  await pin.click()
  const confirm = page.locator('.travel-confirm')
  await confirm.waitFor({ state: 'visible', timeout: 10000 })
  const confirmText = normalizeText(await confirm.innerText())
  const start = confirm.getByRole('button', { name: 'В путь', exact: true })
  await start.waitFor({ state: 'visible', timeout: 10000 })
  await start.click()
  const journey = page.locator('.travel-journey-overlay')
  await journey.waitFor({ state: 'visible', timeout: 10000 })
  await journey.click()
  await page.locator('.map-screen').waitFor({ state: 'detached', timeout: 12000 })
  const expectedSceneId = `scene_${arrivalScene.replace(/^scene_/, '')}`
  try {
    await waitForScene(expectedSceneId)
  } catch (error) {
    const diagnostics = await page.evaluate(() => ({
      sceneImages: [...document.querySelectorAll('img.scene-bg')].map((image) => ({ src: image.getAttribute('src'), complete: image.complete, width: image.naturalWidth })),
      overlays: [...document.querySelectorAll('.combat-overlay, .dialogue-overlay, .message-overlay, .map-screen, .end-overlay')].map((overlay) => ({ className: overlay.className, text: overlay.innerText?.slice(0, 300) })),
    }))
    log('travel_arrival_failure', { destination: locationLabel, expectedSceneId, state: await readRuntimeState(), diagnostics, error: String(error?.message ?? error) })
    throw error
  }
  await settleStoryOverlays()
  routeStep(actionName ?? 'travel', { destination: locationLabel, mapPin: pinText, travelCard: confirmText, arrivalScene: `scene_${arrivalScene.replace(/^scene_/, '')}` })
  await checkpoint(`${activeRun}:arrival-${arrivalScene}`)
}
async function readRuntimeState() {
  return page.evaluate((key) => {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return null
      const envelope = JSON.parse(raw)
      const state = envelope?.state ?? envelope
      return {
        scene: state?.scene ?? null,
        location: state?.location ?? null,
        tick: Number.isFinite(state?.tick) ? state.tick : null,
        flags: state?.flags ?? {},
        revealed_locations: state?.revealed_locations ?? [],
        inventory: state?.player?.inventory ?? [],
        game_over: state?.game_over ?? null,
      }
    } catch { return null }
  }, SAVE_KEY)
}
const itemDefinitions = new Map()
function importedItemLabel(itemId) {
  if (!itemDefinitions.has(itemId)) {
    const file = join(CAMPAIGN_ROOT, 'entities', `${itemId}.json`)
    itemDefinitions.set(itemId, JSON.parse(readFileSync(file, 'utf8')))
  }
  const definition = itemDefinitions.get(itemId)
  if (!definition?.label) throw new Error(`Imported item has no label for live inventory check: ${itemId}`)
  return definition.label
}
async function hasItem(itemId) {
  const label = importedItemLabel(itemId)
  const controls = page.locator('.hud-right .hud-btn')
  let inventoryButton = controls.filter({ hasText: /Вещи|Инвентарь/ }).first()
  if (!(await inventoryButton.count())) inventoryButton = controls.nth(1)
  await inventoryButton.waitFor({ state: 'visible', timeout: 8000 })
  await inventoryButton.click()
  const panel = page.locator('.panel-overlay').filter({ has: page.locator('.inv-list') }).first()
  await panel.waitFor({ state: 'visible', timeout: 8000 })
  const names = (await panel.locator('.inv-item-name').allInnerTexts()).map(normalizeText)
  const present = names.includes(normalizeText(label))
  await panel.locator('.panel-header button').first().click()
  await panel.waitFor({ state: 'detached', timeout: 8000 })
  uiAction('inspect_inventory_item', { itemId, label, present })
  return present
}
async function hasFlag(flag) {
  const state = await readRuntimeState()
  return !!state?.flags?.[flag]
}
async function ensureItemWithRetry({ labelPattern, optionLabel, itemId, actionName, maxAttempts = 8 }) {
  const attempts = []
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (await hasItem(itemId)) return attempts
    await interactItem(labelPattern, optionLabel, `${actionName}_attempt_${attempt}`)
    await settleStoryOverlays()
    const success = await hasItem(itemId)
    attempts.push({ attempt, itemId, success })
    log('check_attempt', { actionName, attempt, itemId, success, state: await readRuntimeState() })
    if (success) return attempts
  }
  throw new Error(`${actionName} did not produce ${itemId} after ${maxAttempts} natural UI attempts.`)
}
async function openReshRoomWithLockpick(maxAttempts = 12) {
  const attempts = []
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const before = await readRuntimeState()
    if (before?.scene === 'scene_pump_room') return attempts
    if (before?.scene !== 'scene_pump_hall') {
      throw new Error(`Cannot use the real lockpick route to Resh’s room from ${JSON.stringify(before)}`)
    }
    await interactItem(/Дверь каморки мастера/, 'Взломать замок', `unlock_resh_room_attempt_${attempt}`)
    const after = await readRuntimeState()
    const success = after?.scene === 'scene_pump_room'
    attempts.push({ attempt, success, scene: after?.scene, tick: after?.tick })
    log('lockpick_attempt', { attempt, success, state: after })
    if (success) return attempts
    if (await page.locator('.end-overlay').count()) throw new Error('Unexpected ending while lockpicking Resh’s room.')
  }
  throw new Error(`Could not unlock Resh’s room through its live lockpick option after ${maxAttempts} tries: ${JSON.stringify(attempts)}`)
}
async function startFreshRun(firstRun) {
  if (firstRun) {
    await page.getByRole('button', { name: 'Новый забег', exact: true }).click()
    await page.locator('.char-create').waitFor({ state: 'visible', timeout: 15000 })
    await page.locator('.char-name').fill('Дознаватель GOLD-1.10')
    await page.getByRole('button', { name: /Помповый мастер/ }).first().click()
    await page.getByRole('button', { name: /Боец ярусов/ }).first().click()
    const readSkill = async (row) => Number((await row.locator('.char-stat-val').innerText()).replace(/[^\d]/g, ''))
    const rowFor = (label) => page.locator('.char-skill-row').filter({ hasText: label }).first()
    const transfers = []
    const skillPointsLeft = async () => Number((await page.locator('.char-budget').filter({ hasText: 'Свободных очков навыков:' }).locator('b').first().innerText()).replace(/[^\d]/g, ''))
    const donors = ['Следствие', 'Кулачный бой', 'Стрельба', 'Торг', 'Лечение', 'Запугивание', 'Знание жилы', 'Убеждение']
    async function lowerSkill(targetLabel, targetValue) {
      const target = rowFor(targetLabel)
      await target.waitFor({ state: 'visible', timeout: 8000 })
      while (await readSkill(target) > targetValue) {
        const from = await readSkill(target)
        const minus = target.getByRole('button').first()
        if (await minus.isDisabled()) throw new Error(`Cannot lower ${targetLabel} to ${targetValue}; current=${from}`)
        await minus.click()
        transfers.push({ fromSkill: targetLabel, fromBefore: from, toSkill: 'free-points', toAfter: from - 1 })
      }
    }
    async function raiseSkill(targetLabel, targetValue) {
      const target = rowFor(targetLabel)
      await target.waitFor({ state: 'visible', timeout: 8000 })
      while (await readSkill(target) < targetValue) {
        if (await skillPointsLeft() > 0) {
          const before = await readSkill(target)
          await target.getByRole('button').last().click()
          transfers.push({ fromSkill: 'free-points', fromBefore: null, toSkill: targetLabel, toAfter: before + 1 })
          continue
        }
        let donated = false
        for (const donorLabel of donors) {
          if (donorLabel === targetLabel) continue
          const donor = rowFor(donorLabel)
          const minus = donor.getByRole('button').first()
          if (await minus.count() && !(await minus.isDisabled())) {
            const from = await readSkill(donor)
            await minus.click()
            await target.getByRole('button').last().click()
            transfers.push({ fromSkill: donorLabel, fromBefore: from, toSkill: targetLabel, toAfter: await readSkill(target) })
            donated = true
            break
          }
        }
        if (!donated) throw new Error(`Could not allocate enough character points to ${targetLabel}; current=${await readSkill(target)}, target=${targetValue}`)
      }
    }
    await lowerSkill('Скрытность', 20)
    for (const [label, value] of [
      ['Ремонт', 70], ['Взлом', 45], ['Внимание', 35], ['Уклонение', 70], ['Клинок', 70],
    ]) await raiseSkill(label, value)
    const skillSnapshot = await page.evaluate(() => {
      const read = (label) => [...document.querySelectorAll('.char-skill-row')]
        .find((row) => row.querySelector('.char-skill-name')?.textContent?.trim().replace(/\*$/, '') === label)
        ?.querySelector('.char-stat-val')?.textContent?.trim() ?? null
      return {
        repair: read('Ремонт'), lockpick: read('Взлом'), perception: read('Внимание'),
        dodge: read('Уклонение'), stealth: read('Скрытность'), blade: read('Клинок'),
        validationProblems: [...document.querySelectorAll('.char-problems li')].map((item) => item.textContent?.trim()),
      }
    })
    const expectedSkills = { repair: '70%', lockpick: '45%', perception: '35%', dodge: '70%', stealth: '20%', blade: '70%' }
    if (Object.entries(expectedSkills).some(([key, value]) => skillSnapshot[key] !== value)) {
      throw new Error(`Character build did not reach planned skill values: ${JSON.stringify(skillSnapshot)}`)
    }
    if (skillSnapshot.validationProblems.length) throw new Error(`Character build is invalid: ${JSON.stringify(skillSnapshot.validationProblems)}`)
    log('character_build', { name: 'Дознаватель GOLD-1.10', profession: 'prof_wright', calling: 'call_fighter', skillSnapshot, transfers })
    await page.getByRole('button', { name: 'Начать забег', exact: true }).click()
  } else {
    await page.locator('.end-overlay').waitFor({ state: 'visible', timeout: 15000 })
    await page.getByRole('button', { name: 'Начать новый забег', exact: true }).click()
  }
  await page.locator('.end-overlay').waitFor({ state: 'detached', timeout: 15000 }).catch(() => {})
  await page.locator('.char-create').waitFor({ state: 'detached', timeout: 15000 }).catch(() => {})
  await waitForScene('scene_gate_hall')
  await settleStoryOverlays()
  await waitForScene('scene_gate_hall')
  await checkpoint(`${activeRun}:scene_gate_hall`)
  uiAction(firstRun ? 'start_first_run' : 'restart_run_in_same_browser_session', { campaignId: campaign.id, sceneId: 'scene_gate_hall' })
  routeStartedAt = Date.now()
  routeStepCount = 0
  routeActionSequence = 0
  routeActions = []
  routeLastDialogue = null
}
async function prepareReshAndCore() {
  await travelTo('Седьмая помпа', 'scene_pump_hall', 'travel_gate_to_pump7')
  await openReshRoomWithLockpick()
  routeStep('enter_resh_room_by_lockpick', { sceneId: 'scene_pump_room', viaCampaignRule: 'rule_unlock_resh_room' })
  await interactItem(/Стол мастера/, 'Прочесть записи', 'read_resh_notes')
  await navigateScene('В машинный зал', 'scene_pump_hall', 'return_to_pump_hall')
  const notesState = await readRuntimeState()
  log('resh_notes_effect_state', { flags: notesState?.flags, revealed_locations: notesState?.revealed_locations })
  if (!notesState?.flags?.deep_revealed || !notesState?.revealed_locations?.includes('loc_deep9')) {
    throw new Error('Reading Resh’s notes did not set deep_revealed and reveal loc_deep9 through campaign effects.')
  }
  await navigateScene('Спуститься в шахту помпы', 'scene_pump_shaft', 'enter_pump_shaft')
  await ensureItemWithRetry({
    labelPattern: /Лебёдка/,
    optionLabel: 'Проверить трос',
    itemId: 'item_rope',
    actionName: 'recover_rope_from_winch',
    maxAttempts: 8,
  })
  await interactItem(/Лестница вниз/, 'Спуститься на верёвке', 'recover_valve_by_rope')
  await navigateScene('Подняться в машинный зал', 'scene_pump_hall', 'return_from_pump_shaft')
  if (!(await hasItem('item_valve'))) throw new Error('The rope route down the pump shaft did not yield item_valve.')
  await travelTo('Восьмой ярус', 'scene_dry_row', 'travel_pump7_to_ward8')
  await navigateScene('В затопленную галерею', 'scene_flood_gallery', 'enter_flood_gallery')
  await navigateScene('К затвору', 'scene_sluice', 'reach_sluice')
  await interactItem(/Механизм затвора/, 'Установить клапан', 'install_valve_in_sluice')
  await travelTo('Девятый ярус', 'scene_drift', 'travel_ward8_to_deep9')
  if (!(await hasFlag('sluice_ready'))) throw new Error('Installing item_valve did not make the sluice_ready campaign flag true.')
  await navigateScene('В забой', 'scene_face', 'enter_blind_face')
  await openNpcDialogue(/Мастер у жилы/, 'npc_resh')
  const reshCoreChoiceId = await chooseDialogueById('reshGiveCore')
  await chooseDialogueById('reshLeave')
  await endFinishedDialogueIfOpen()
  await settleStoryOverlays()
  if (!(await hasItem('item_core')) || !(await hasItem('item_key_cache'))) {
    throw new Error('The available Resh dialogue choice did not grant the campaign core and cache key.')
  }
  const state = await readRuntimeState()
  if (!state || state.scene !== 'scene_face' || state.location !== 'loc_deep9') {
    throw new Error(`Unexpected runtime scene/location after Resh dialogue: ${JSON.stringify(state)}`)
  }
  return { state, reshCoreChoiceId }
}
async function startEndingRun(endingId, firstRun) {
  activeRun = endingId
  activeStage = 'start'
  routeStepCount = 0
  routeActionSequence = 0
  routeActions = []
  routeLastDialogue = null
  await startFreshRun(firstRun)
  // Start the per-ending counter after the UI has created the fresh run and the gate intro is dismissed.
  routeStartedAt = Date.now()
  routeStep(firstRun ? 'start_first_run' : 'restart_run_in_same_browser_session', { campaignId: campaign.id, sceneId: 'scene_gate_hall' })
  log('ending_route_start', { endingId, viewport: `${WIDTH}x${HEIGHT}`, scene: 'scene_gate_hall' })
}
async function finishEnding(expectedId) {
  setStage('ending-screen')
  await settleStoryOverlays(45000)
  await page.locator('.end-overlay').waitFor({ state: 'visible', timeout: 30000 })
  await waitForPaint()
  const endingDef = campaignEndings.find((ending) => ending.id === expectedId)
  if (!endingDef) throw new Error(`No ending definition for ${expectedId}`)
  const visibleTitle = normalizeText(await page.locator('.end-panel h1').innerText())
  if (visibleTitle !== normalizeText(endingDef.title)) {
    throw new Error(`End screen title mismatch for ${expectedId}: actual=${JSON.stringify(visibleTitle)} expected=${JSON.stringify(endingDef.title)}`)
  }
  const metaResult = await page.evaluate((key) => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  }, META_KEY)
  const endingsSeen = Array.isArray(metaResult?.endings) ? metaResult.endings : []
  if (!endingsSeen.includes(expectedId)) {
    throw new Error(`The runtime ending ID is not present in the campaign meta-history: expected=${expectedId}, seen=${JSON.stringify(endingsSeen)}`)
  }
  const metrics = await measureScreen()
  if (!metrics.sceneId) throw new Error(`Unable to determine ending scene from the final browser frame for ${expectedId}`)
  const screenshotName = `${expectedId}.png`
  const finalCheckpoint = await checkpoint(`${expectedId}:final-frame`, screenshotName)
  const elapsedMs = Date.now() - routeStartedAt
  const result = {
    endingId: expectedId,
    title: visibleTitle,
    scene: metrics.sceneId,
    location: metrics.locationLabel,
    stepCount: routeStepCount,
    elapsedMs,
    elapsedSeconds: Number((elapsedMs / 1000).toFixed(2)),
    finalDialogue: routeLastDialogue,
    endingAction: routeActions.at(-1) ?? null,
    screenshot: finalCheckpoint.screenshot,
    metaEndingsSeen: endingsSeen,
    routeActions,
  }
  log('ending_reached', result)
  return result
}

async function runPumpEnding(firstRun) {
  await startEndingRun('ending_pump', firstRun)
  const prepared = await prepareReshAndCore()
  await navigateScene('Назад в штольню', 'scene_drift', 'leave_blind_face_for_drift')
  await travelTo('Восьмой ярус', 'scene_dry_row', 'travel_deep9_to_ward8')
  await travelTo('Седьмая помпа', 'scene_pump_hall', 'travel_ward8_to_pump7')
  const attempts = []
  for (let attempt = 1; attempt <= 12; attempt++) {
    if (await page.locator('.end-overlay').count()) break
    await interactItem(/Седьмая помпа/, 'Вставить сердцевину и запустить помпу', `start_pump_attempt_${attempt}`)
    await settleStoryOverlays(45000)
    if (await page.locator('.end-overlay').count()) break
    const state = await readRuntimeState()
    const message = await page.locator('.message-overlay:not(.itemdlg-overlay)').first().innerText().catch(() => '')
    attempts.push({ attempt, scene: state?.scene, tick: state?.tick, message: normalizeText(message).slice(0, 500) })
    if (state?.flags?.end_pump) throw new Error('end_pump flag is true but EndScreen is not visible.')
  }
  log('pump_launch_attempts', { attempts })
  if (!(await page.locator('.end-overlay').count())) throw new Error(`Pump ending not reached after attempts: ${JSON.stringify(attempts)}`)
  if (routeLastDialogue?.choiceId !== prepared.reshCoreChoiceId) {
    throw new Error(`Pump route lacks the live-index Resh dialogue choice proof: ${JSON.stringify(routeLastDialogue)}`)
  }
  return finishEnding('ending_pump')
}
async function runVeinEnding(firstRun) {
  await startEndingRun('ending_vein', firstRun)
  await prepareReshAndCore()
  await openNpcDialogue(/Жила/, 'npc_vein')
  const veinChoiceId = await chooseDialogueById('veinReturnCore')
  await endFinishedDialogueIfOpen()
  await settleStoryOverlays()
  if (!(await page.locator('.end-overlay').count())) await page.locator('.end-overlay').waitFor({ state: 'visible', timeout: 30000 })
  if (routeLastDialogue?.choiceId !== veinChoiceId) {
    throw new Error(`Vein ending was not selected through its live-index dialogue choice: ${JSON.stringify(routeLastDialogue)}`)
  }
  return finishEnding('ending_vein')
}
async function runClosedEnding(firstRun) {
  await startEndingRun('ending_closed', firstRun)
  await prepareReshAndCore()
  await navigateScene('Назад в штольню', 'scene_drift', 'leave_blind_face_for_cache')
  await interactItem(/Схрон мастера/, 'Отпереть ключом', 'open_resh_cache')
  await travelTo('Восьмой ярус', 'scene_dry_row', 'travel_deep9_to_ward8')
  if (!(await hasItem('item_ledger'))) throw new Error('Opening Resh’s cache did not grant item_ledger.')
  await travelTo('Седьмая помпа', 'scene_pump_hall', 'travel_ward8_to_pump7')
  await travelTo('Контора Надзора', 'scene_office', 'travel_pump7_to_surface')
  await openNpcDialogue(/Каст/, 'npc_kast')
  await chooseDialogueById('kastShowLedger')
  const kastSubmitChoiceId = await chooseDialogueById('kastSubmitLedger')
  await endFinishedDialogueIfOpen()
  await settleStoryOverlays()
  if (!(await page.locator('.end-overlay').count())) await page.locator('.end-overlay').waitFor({ state: 'visible', timeout: 30000 })
  if (routeLastDialogue?.choiceId !== kastSubmitChoiceId) {
    throw new Error(`Closed ending was not selected through its live-index Kast choice: ${JSON.stringify(routeLastDialogue)}`)
  }
  return finishEnding('ending_closed')
}
function markdownCell(value) {
  return String(value ?? '—').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>').trim()
}
function dialogueCell(value) {
  if (!value) return '—'
  const lines = value.spokenLines?.length ? value.spokenLines : [value.choice]
  return `**${markdownCell(value.choice)}** — ${lines.map((line) => `“${markdownCell(line)}”`).join(' ')}`
}
function actionCell(value) {
  if (!value) return '—'
  const details = value.choiceId ? `; ${value.choiceId}` : ''
  return `\`${markdownCell(value.action)}\` (step ${value.step}${details})`
}
function buildReport(results, diagnostics, allEndingRows, verdict) {
  const rows = results.map((result) => `| \`${result.endingId}\` | \`${result.scene}\` | ${actionCell(result.endingAction)} | ${result.stepCount} | ${result.elapsedSeconds.toFixed(2)} s | ${dialogueCell(result.finalDialogue)} |`).join('\n')
  const allRows = allEndingRows.map((row) => `| \`${row.id}\` | ${row.reached ? 'reached' : 'unreached'} | ${markdownCell(row.reason ?? row.title)} |`).join('\n')
  const consoleText = diagnostics.consoleErrors.length
    ? diagnostics.consoleErrors.map((error) => `- **${error.run} / ${error.stage}:** \`${markdownCell(error.text)}\``).join('\n')
    : '- None.'
  const screenshotRows = results.map((result) => `- \`${result.screenshot.path}\` — ${result.screenshot.width}×${result.screenshot.height}, ${result.screenshot.bytes} bytes`).join('\n')
  return `# GOLD-1.10 — Campaign ending reachability\n\n` +
    `**Verdict: ${verdict}.** Three distinct ending data IDs were reached consecutively in one Chromium browser context; no flags, scenes, or ending states were set by the runner.\n\n` +
    `- Branch: \`${execFileSync('git', ['branch', '--show-current'], { cwd: ROOT, encoding: 'utf8' }).trim()}\`\n` +
    `- Campaign: ${campaign.title} (\`${campaign.id}\`)\n` +
    `- Pin: \`${manifest.repository}@${manifest.commit}\`; archive URL: ${manifest.url}\n` +
    `- Archive: ${manifest.size_bytes} bytes; SHA-256: \`${manifest.sha256}\`; tree SHA-256: \`${manifest.tree.sha256}\`\n` +
    `- Browser: ${chromiumVersion()}; viewport: ${WIDTH}×${HEIGHT}; same tab/context for all three runs\n` +
    `- Imported ending data: ${campaignEndings.length}; reached: ${results.length}; distinct reached IDs: ${new Set(results.map((result) => result.endingId)).size}\n\n` +
    `## Reached endings\n\n` +
    `| Ending ID | Scene | UI action reaching ending | Step count | Elapsed time | Final dialogue |\n|---|---|---|---:|---:|---|\n${rows}\n\n` +
    `## All campaign endings\n\n` +
    `| Ending ID | Status | Reason / title |\n|---|---|---|\n${allRows}\n\n` +
    `## Browser diagnostics\n\n` +
    `- pageerror: **${diagnostics.pageErrors.length}**\n` +
    `- Empty-background samples: **${diagnostics.emptyBackgroundCount}** / ${diagnostics.backgroundSampleCount}\n` +
    `- Console errors: **${diagnostics.consoleErrors.length}**\n${consoleText}\n` +
    `- HTTP error responses: ${diagnostics.httpErrors.length} (optional project.json 404s: ${expectedProjectJson404})\n` +
    `- Failed requests: ${diagnostics.requestFailures.length}\n\n` +
    `## Final frames\n\n${screenshotRows}\n\n` +
    `## Dialogue-choice ID convention\n\n` +
    `The pinned DlgDoc choice objects have no native stable IDs. For each intended choice, the runner resolves an auxiliary source reference in the pinned data, matches it uniquely against the currently rendered choices, records the live 0-based runtime ID as \`runtime:<npc>#<node>[<live-index>]\`, rechecks the indexed button text, and clicks that exact button. Selected runtime IDs and source references are in the run log; the reversible convention is documented in \`docs/decisions/GOLD-1.5.md\`.\n`
}

let server
async function main() {
  activeRun = 'setup'
  activeStage = 'setup'
  log('run_start', {
    task: TASK,
    branch: execFileSync('git', ['branch', '--show-current'], { cwd: ROOT, encoding: 'utf8' }).trim(),
    head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
    baseUrl: BASE_URL,
    viewport: `${WIDTH}x${HEIGHT}`,
    campaignId: campaign.id,
    campaignTitle: campaign.title,
    saveStorageKey: SAVE_KEY,
    metaStorageKey: META_KEY,
    campaignRepository: manifest.repository,
    campaignCommit: manifest.commit,
    archiveUrl: manifest.url,
    archiveBytes: manifest.size_bytes,
    archiveSha256: manifest.sha256,
    treeArchiveSha256: manifest.tree.archive_sha256,
    treeSha256: manifest.tree.sha256,
    startingScene: campaign.starting_scene,
    startingLocation: campaign.starting_location,
    startingTick: campaign.starting_tick,
    endingIdsInData: campaignEndings.map((ending) => ending.id),
    targetEndingIds: EXPECTED_ENDING_IDS,
    dialogueChoiceTargets: DIALOGUE_CHOICE_TARGETS,
    dialogueChoiceIdConvention: 'runtime:<npc>#<node>[<0-based-live-index>]',
  })
  const verifiedTree = await verifyImportedTree(manifest, CAMPAIGN_ROOT)
  log('imported_tree_verified', verifiedTree)
  server = spawn(process.execPath, [
    join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'),
    '--host', '127.0.0.1', '--port', String(PORT), '--strictPort',
  ], { cwd: ROOT, detached: true, stdio: ['ignore', 'pipe', 'pipe'] })
  server.stdout.on('data', (chunk) => log('vite_stdout', { text: String(chunk).trim() }))
  server.stderr.on('data', (chunk) => log('vite_stderr', { text: String(chunk).trim() }))
  server.on('error', (error) => log('vite_error', { message: error.message }))
  await waitForServer()
  log('vite_ready', { url: BASE_URL })
  browser = await launchChromium({ locale: 'ru-RU', timezoneId: 'Europe/Vilnius' })
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
  page.on('pageerror', (error) => browserEvent('pageerror', { text: String(error?.stack ?? error) }))
  page.on('console', (message) => {
    if (message.type() === 'error') browserEvent('console_error', { text: message.text() })
    else if (message.type() === 'warning') browserEvent('console_warning', { text: message.text() })
  })
  page.on('response', (response) => {
    if (response.status() >= 400) {
      const url = response.url()
      const expected = response.status() === 404 && new URL(url).pathname.endsWith('/project.json')
        ? 'optional-project-json'
        : null
      browserEvent('http_error', { status: response.status(), url, expected })
    }
  })
  page.on('requestfailed', (request) => browserEvent('request_failed', {
    url: request.url(), failure: request.failure()?.errorText ?? 'unknown',
  }))

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' })
  await page.locator('.main-menu .campaign-title').waitFor({ state: 'visible', timeout: 30000 })
  await settleStoryOverlays()
  await checkpoint('main-menu')

  const results = []
  results.push(await runPumpEnding(true))
  results.push(await runVeinEnding(false))
  results.push(await runClosedEnding(false))

  const reachedIds = new Set(results.map((result) => result.endingId))
  const distinctReachedIds = [...reachedIds]
  const allEndingRows = campaignEndings.map((ending) => {
    const reached = reachedIds.has(ending.id)
    return {
      id: ending.id,
      title: ending.title,
      reached,
      reason: reached ? `Runtime meta store contains data ID ${ending.id}; final screen title matched.` :
        (UNREACHED_REASONS[ending.id] ?? 'Не входил в три целевых UI-маршрута этого прогона.'),
    }
  })
  const diagnostics = {
    pageErrors: events.filter((event) => event.type === 'pageerror'),
    consoleErrors: events.filter((event) => event.type === 'console_error'),
    httpErrors: events.filter((event) => event.type === 'http_error'),
    requestFailures: events.filter((event) => event.type === 'request_failed'),
    backgroundSampleCount: backgroundSamples.length,
    emptyBackgroundCount: backgroundSamples.filter((sample) => sample.emptyBackgrounds > 0).length,
    emptyBackgroundSamples: backgroundSamples.filter((sample) => sample.emptyBackgrounds > 0),
  }
  const allExpectedReached = EXPECTED_ENDING_IDS.every((id) => reachedIds.has(id))
  const screenshotsValid = results.length === 3 && results.every((result) => result.screenshot.width === WIDTH && result.screenshot.height === HEIGHT)
  const verdict = results.length === 3 && allExpectedReached && reachedIds.size === 3 && allEndingRows.length === 9 &&
    screenshotsValid && diagnostics.pageErrors.length === 0 && diagnostics.emptyBackgroundCount === 0 ? 'PASS' : 'FAIL'
  const report = buildReport(results, diagnostics, allEndingRows, verdict)
  writeFileSync(REPORT_PATH, report)
  log('run_diagnostics', {
    pageerrorCount: diagnostics.pageErrors.length,
    consoleErrorCount: diagnostics.consoleErrors.length,
    consoleErrors: diagnostics.consoleErrors.map((event) => ({ run: event.run, stage: event.stage, text: event.text })),
    httpErrorCount: diagnostics.httpErrors.length,
    httpErrors: diagnostics.httpErrors.map((event) => ({ run: event.run, stage: event.stage, status: event.status, url: event.url, expected: event.expected })),
    requestFailureCount: diagnostics.requestFailures.length,
    emptyBackgroundCount: diagnostics.emptyBackgroundCount,
    backgroundSampleCount: diagnostics.backgroundSampleCount,
    emptyBackgroundSamples: diagnostics.emptyBackgroundSamples,
  })
  log('run_complete', {
    verdict,
    endingIds: results.map((result) => result.endingId),
    distinctEndingIds: distinctReachedIds,
    allEndingCount: campaignEndings.length,
    reachedCount: reachedIds.size,
    report: relative(ROOT, REPORT_PATH).split(sep).join('/'),
    screenshots: results.map((result) => result.screenshot.path),
  })
  console.log(`${TASK} ${verdict}: ${results.map((result) => result.endingId).join(', ')}`)
  console.log(`Report: ${relative(ROOT, REPORT_PATH).split(sep).join('/')}`)
  console.log(`Log: ${relative(ROOT, LOG_PATH).split(sep).join('/')}`)
  if (verdict !== 'PASS') process.exitCode = 1
}

try {
  await main()
} catch (error) {
  log('run_failure', { message: String(error?.stack ?? error) })
  process.exitCode = 1
} finally {
  try { await browser?.close() } catch { /* already closed */ }
  if (server?.pid) {
    try { process.kill(-server.pid, 'SIGTERM') } catch { server.kill('SIGTERM') }
    await Promise.race([
      new Promise((resolvePromise) => server.once('close', resolvePromise)),
      delay(3000),
    ])
    if (server.exitCode === null) {
      try { process.kill(-server.pid, 'SIGKILL') } catch { server.kill('SIGKILL') }
    }
  }
  log('cleanup', { serverStopped: server?.exitCode !== null })
}
