#!/usr/bin/env node
/**
 * Launch the shipped FMV campaign from the real registry through the player UI.
 * Usage: npm run smoke:campaign-start -- http://127.0.0.1:4173
 * Exit: 0 when the registry, menu, launch path and browser console are clean;
 *      1 for a smoke failure; 2 when Chromium could not be started.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve, relative } from 'node:path'

const args = process.argv.slice(2).filter((arg) => !arg.startsWith('--'))
const base = args[0] || 'http://127.0.0.1:4173'
const outDir = resolve(args[1] || 'out/visual/campaign-start')
const title = 'Перекрёсток огней'
const campaignId = 'fmv-crossing'
const startedAt = new Date().toISOString()
const failures = []
const consoleErrors = []
const pageErrors = []
const campaignRequestErrors = []
const logLines = []
let browser
let page
let engine = 'unknown'

function log(message) {
  logLines.push(message)
  console.log(message)
}

function fail(message) {
  failures.push(message)
  log(`✗ ${message}`)
}

async function screenshot(name) {
  if (!page) return null
  const path = resolve(outDir, name)
  try {
    await page.screenshot({ path, fullPage: false, timeout: 10000 })
    log(`PNG: ${relative(process.cwd(), path)}`)
    return path
  } catch (error) {
    fail(`не удалось сохранить ${name}: ${String(error?.message || error)}`)
    return null
  }
}

try {
  const target = new URL(base)
  if (target.search || target.hash) throw new Error('адрес smoke должен быть без query-параметров и hash')
  mkdirSync(outDir, { recursive: true })

  try {
    const { chromium } = await import('playwright')
    browser = await chromium.launch()
    engine = 'playwright'
  } catch {
    try {
      const { launchChromium, chromiumVersion } = await import('./visual/local-browser.mjs')
      browser = await launchChromium()
      engine = chromiumVersion()
    } catch (error) {
      const details = String(error?.message || error).split('\n')[0]
      console.error('Chromium не запустился. См. docs/agents/browser.md для установки локального браузера.')
      console.error(details)
      fail(`Chromium не запустился: ${details}`)
      process.exitCode = 2
      throw error
    }
  }

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  page = await context.newPage()
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 500))
  })
  page.on('pageerror', (error) => pageErrors.push(String(error?.stack || error).slice(0, 1000)))
  page.on('response', (response) => {
    try {
      const url = new URL(response.url())
      if (response.status() >= 400 && url.pathname.startsWith(`/campaigns/${campaignId}/`)) {
        campaignRequestErrors.push(`${response.status()} ${url.pathname}`)
      }
    } catch { /* Ignore non-URL response data. */ }
  })

  const indexResponsePromise = page.waitForResponse((response) => {
    try { return new URL(response.url()).pathname === '/campaigns/index.json' }
    catch { return false }
  }, { timeout: 20000 }).then((response) => ({ response }), (error) => ({ error }))
  const navigation = await page.goto(target.toString(), { waitUntil: 'networkidle', timeout: 45000 })
  if (!navigation || !navigation.ok()) fail(`приложение не загрузилось: HTTP ${navigation?.status() ?? 'нет ответа'}`)
  if (new URL(page.url()).search || new URL(page.url()).hash) fail('после открытия у страницы появились query-параметры или hash')
  else log('✓ Страница открыта без query-параметров и hash')

  let indexResponse
  let index
  const indexResult = await indexResponsePromise
  if ('error' in indexResult) {
    fail(`реальный campaigns/index.json не загрузился: ${String(indexResult.error?.message || indexResult.error)}`)
    index = null
  } else {
    indexResponse = indexResult.response
    if (!indexResponse.ok()) fail(`реальный campaigns/index.json вернул HTTP ${indexResponse.status()}`)
    try { index = await indexResponse.json() }
    catch (error) {
      fail(`не удалось разобрать campaigns/index.json: ${String(error?.message || error)}`)
      index = null
    }
  }

  const indexIsExpected = Array.isArray(index)
    && index.length === 1
    && index[0]?.id === campaignId
    && index[0]?.title === title
  if (!indexIsExpected) fail(`реальный index должен содержать только ${campaignId} / «${title}»; получено ${JSON.stringify(index)}`)
  else log(`✓ Реальный index: HTTP ${indexResponse.status()}, один проект ${campaignId} / «${title}»`)

  await page.locator('.campaign-title').waitFor({ state: 'visible', timeout: 20000 })
  const menuTitle = (await page.locator('.campaign-title').innerText()).trim()
  if (menuTitle !== title) fail(`в главном меню показано «${menuTitle}», ожидалось «${title}»`)
  else log(`✓ Главное меню показывает «${menuTitle}»`)
  await screenshot('01-main-menu.png')

  await page.getByRole('button', { name: /Кампании/ }).click()
  const card = page.locator('.campaign-card').filter({ hasText: title })
  await card.waitFor({ state: 'visible', timeout: 10000 })
  const cardCount = await page.locator('.campaign-card').count()
  const cardTitle = (await card.locator('.campaign-card-title').innerText()).trim()
  if (cardCount !== 1 || cardTitle !== title) fail(`в меню кампаний ожидалась одна карточка «${title}», найдено ${cardCount}: «${cardTitle}»`)
  else log(`✓ Проект виден в обычном списке кампаний: «${cardTitle}»`)
  await screenshot('02-campaign-list.png')

  await card.click()
  await page.locator('.campaigns-overlay').waitFor({ state: 'hidden', timeout: 10000 })
  if (new URL(page.url()).search || new URL(page.url()).hash) fail('после выбора проекта у страницы появились query-параметры или hash')
  else log('✓ Выбор проекта не добавил query-параметры или hash')

  const startButton = page.getByRole('button', { name: 'Новый забег', exact: true })
  await startButton.waitFor({ state: 'visible', timeout: 10000 })
  await startButton.click()
  log('✓ Нажата штатная кнопка «Новый забег»')

  await page.waitForFunction(() => {
    const scene = document.querySelector('[data-fmv-mode]')
    const error = document.querySelector('[data-fmv-screen][data-fmv-phase="error"]')
    return !!error || (!!scene && scene.getAttribute('data-fmv-phase') !== 'loading')
  }, null, { timeout: 30000 })
  const errorScreen = page.locator('[data-fmv-screen][data-fmv-phase="error"]')
  if (await errorScreen.count()) {
    const details = (await errorScreen.innerText()).trim().replace(/\s+/g, ' ').slice(0, 500)
    fail(`вместо игровой сцены показана ошибка FMV: ${details}`)
  } else {
    const scene = page.locator('[data-fmv-mode]')
    const sceneId = await scene.getAttribute('data-fmv-scene')
    const phase = await scene.getAttribute('data-fmv-phase')
    if (sceneId !== 'fmv_crossing') fail(`открыт FMV-документ «${sceneId}», ожидался fmv_crossing`)
    if (phase !== 'playing') fail(`FMV-сцена не готова к игре: phase=${phase}`)
    await page.locator('[data-fmv-play]').waitFor({ state: 'visible', timeout: 10000 })
    await page.waitForFunction(() => {
      const image = document.querySelector('[data-fmv-poster]')
      return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0
    }, null, { timeout: 15000 })
    if (!new URL(page.url()).search && !new URL(page.url()).hash) {
      log(`✓ Игровая сцена открыта: ${sceneId}, FMV ${phase}, постер загружен`)
    } else fail('после запуска сцены у страницы появились query-параметры или hash')
  }
  await screenshot('03-game-scene.png')

  await page.waitForTimeout(500)
  if (consoleErrors.length) fail(`ошибки консоли браузера: ${consoleErrors.join(' | ')}`)
  else log('✓ Ошибок console нет')
  if (pageErrors.length) fail(`ошибки страницы: ${pageErrors.join(' | ')}`)
  else log('✓ Ошибок pageerror нет')
  if (campaignRequestErrors.length) fail(`ошибки загрузки файлов кампании: ${campaignRequestErrors.join(' | ')}`)
  else log('✓ Ошибок HTTP для файлов кампании нет')

  await context.close()
} catch (error) {
  if (process.exitCode !== 2) fail(`smoke завершился исключением: ${String(error?.stack || error).split('\n').slice(0, 4).join(' | ')}`)
  if (page) await screenshot('99-failure.png')
} finally {
  if (browser) await browser.close().catch(() => undefined)
}

if (failures.length === 0) log('RESULT: PASS')
else log(`RESULT: FAIL (${failures.length})`)

const report = [
  'NAR-3.5 smoke:campaign-start',
  `Base URL: ${base}`,
  `Browser: ${engine}`,
  `Started: ${startedAt}`,
  ...logLines,
  `Console errors: ${consoleErrors.length ? consoleErrors.join(' | ') : 'none'}`,
  `Page errors: ${pageErrors.length ? pageErrors.join(' | ') : 'none'}`,
  `Campaign HTTP errors: ${campaignRequestErrors.length ? campaignRequestErrors.join(' | ') : 'none'}`,
  `Result: ${failures.length === 0 ? 'PASS' : 'FAIL'}`,
  '',
].join('\n')
try {
  mkdirSync(dirname(resolve(outDir, 'run.log')), { recursive: true })
  writeFileSync(resolve(outDir, 'run.log'), report, 'utf8')
  console.log(`LOG: ${relative(process.cwd(), resolve(outDir, 'run.log'))}`)
} catch (error) {
  console.error(`Не удалось сохранить лог smoke: ${String(error?.message || error)}`)
  failures.push('не удалось сохранить лог')
}

if (process.exitCode !== 2 && failures.length) process.exitCode = 1
