#!/usr/bin/env node
/**
 * Воспроизводимая проверка игрой в настоящем браузере.
 *
 *   node scripts/visual/playthrough.mjs [baseUrl] [outDir]
 *
 * Зачем: `cf-play explore` и `check:contracts` проверяют данные и код, но не
 * открывают игру. Этот скрипт открывает собранное приложение в Chromium,
 * проходит菜单 → создание героя → сцена → диалог → выбор реплики → переход,
 * снимает PNG каждого шага и проверяет, что игрок не увидел экрана ошибки.
 *
 * Браузер в песочнице агента ЕСТЬ: docs/agents/browser.md. Если не поднялся —
 * это дефект установки, а не повод сдавать отчёт без прохождения (код 2).
 *
 * Код возврата: 0 — маршрут пройден и ошибок страницы нет; 1 — дефект игры;
 * 2 — браузер не поднялся (нет пакетов; см. browser.md).
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const positional = process.argv.slice(2).filter((arg) => !arg.startsWith('--'))
const adventureOnly = process.argv.includes('--adventure')
const base = positional[0] || 'http://localhost:4173'
const outDir = resolve(positional[1] || 'out/play')
mkdirSync(outDir, { recursive: true })

let browser
let engine = 'unknown'
try {
  const { chromium } = await import('playwright')
  browser = await chromium.launch()
  engine = 'playwright (CI)'
} catch {
  try {
    const { launchChromium, chromiumVersion } = await import('./local-browser.mjs')
    browser = await launchChromium()
    engine = chromiumVersion()
  } catch (second) {
    console.error('Браузер не поднялся ни одним из двух способов. Это дефект установки, а не отсутствие браузера.')
    console.error('  песочница: npm i --no-save @sparticuz/chromium@131 playwright-core@1.49.1')
    console.error('  CI:        npm i --no-save playwright@1.49.1 && npx playwright install --with-deps chromium')
    console.error('Причина:', String(second?.message || '').split('\n')[0])
    process.exit(2)
  }
}

/** Реестр кампаний собираем из каталога: в git он намеренно пуст (см. NoCampaignScreen). */
function campaignIndex() {
  const root = resolve('public/campaigns')
  if (!existsSync(root)) return []
  return readdirSync(root)
    .filter((id) => statSync(join(root, id)).isDirectory() && existsSync(join(root, id, 'campaign.json')))
    .map((id) => {
      try {
        const meta = JSON.parse(readFileSync(join(root, id, 'campaign.json'), 'utf8')).meta || {}
        return { id, title: meta.title || id, description: meta.description || '' }
      } catch { return { id, title: id } }
    })
}

const report = { base, engine, startedAt: new Date().toISOString(), steps: [], findings: [], ok: true }
const errors = []
const consoleErrors = []
const observations = []
let recordSteps = true

async function openPage(context) {
  const page = await context.newPage()
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)) })
  // Пустой реестр — штатное состояние поставки. Для прогона подменяем ТОЛЬКО
  // сетевой ответ, не файлы репозитория: игрок видит тот же билд, но со списком.
  await page.route('**/campaigns/index.json*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(campaignIndex()) }))
  return page
}

async function step(page, name, label) {
  const info = await page.evaluate(() => ({
    text: document.body.innerText.replace(/\n{2,}/g, '\n').slice(0, 1500),
    buttons: [...document.querySelectorAll('button')].map((b) => (b.innerText || '').trim()).filter(Boolean).slice(0, 40),
    brokenImages: [...document.querySelectorAll('img')].filter((i) => i.complete && i.naturalWidth === 0).length,
    brokenPortraitImages: [...document.querySelectorAll('.dialogue-portrait img, .message-portrait')].filter((i) => i.complete && i.naturalWidth === 0).length,
    videos: document.querySelectorAll('video').length,
  }))
  observations.push({ name, ...info })
  if (recordSteps) {
    const file = join(outDir, `${name}.png`)
    await page.screenshot({ path: file })
    report.steps.push({ name, label, file, ...info })
    console.log(`  ${name}: ${label} — кнопок ${info.buttons.length}, битых img ${info.brokenImages}`)
  } else {
    console.log(`  ${name}: проверено — кнопок ${info.buttons.length}, битых img ${info.brokenImages}`)
  }
  return info
}

async function tap(page, text, timeout = 5000) {
  try {
    await page.getByText(text, { exact: false }).first().click({ timeout })
    await page.waitForTimeout(700)
    return true
  } catch { return false }
}

/** Ждём, пока на экране появится кнопка с нужным текстом. */
async function waitButton(page, re, timeout = 8000) {
  try {
    await page.waitForFunction((src) => {
      const rx = new RegExp(src, 'i')
      return [...document.querySelectorAll('button')].some((b) => rx.test(b.innerText || ''))
    }, re.source, { timeout })
    return true
  } catch { return false }
}

/** Интро и ответ собеседника показываются по репликам: промотать до конца. */
async function dismissIntro(page) {
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  for (let i = 0; i < 12; i++) {
    if (await page.getByText('Пропустить ⏭', { exact: false }).count()) {
      await tap(page, 'Пропустить ⏭', 1500)
    } else if (await page.getByText('Далее ▶', { exact: false }).count()) {
      await tap(page, 'Далее ▶', 1500)
    } else {
      return true
    }
  }
  return true
}

async function dismissCutscene(page) {
  for (let i = 0; i < 30; i++) {
    const overlay = page.locator('.cutscene-overlay')
    if (!(await overlay.count())) return true
    const skip = overlay.getByRole('button', { name: /^(Пропустить|Закрыть)$/ })
    if (await skip.count()) await skip.last().click({ timeout: 2500 })
    else {
      const next = overlay.getByRole('button', { name: /Далее/ })
      if (await next.count()) await next.last().click({ timeout: 2500 })
      else await page.keyboard.press('Escape')
    }
    await page.waitForTimeout(250)
  }
  return !(await page.locator('.cutscene-overlay').count())
}

async function dismissMessages(page) {
  for (let i = 0; i < 8; i++) {
    const overlay = page.locator('.message-overlay')
    if (!(await overlay.count())) return true
    const ok = overlay.getByRole('button', { name: 'Ок', exact: true })
    if (!(await ok.count())) return false
    await ok.first().click({ timeout: 2500 })
    await page.waitForTimeout(200)
  }
  return !(await page.locator('.message-overlay').count())
}

if (!adventureOnly) {
recordSteps = false
// ── Маршрут 1: нарративная кампания ────────────────────────────────────
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await openPage(context)
  await page.goto(base, { waitUntil: 'networkidle', timeout: 45_000 })
  await page.waitForTimeout(1200)
  await step(page, '01-menu', 'Главное меню')

  const checks = []
  checks.push(['кнопка «Новый забег»', await tap(page, 'Новый забег')])
  await step(page, '02-character', 'Создание персонажа')
  checks.push(['выбор происхождения', await tap(page, 'Солдат')])
  checks.push(['выбор призвания', await tap(page, 'Наёмник')])
  checks.push(['старт забега', await tap(page, 'Начать забег')])
  await page.waitForTimeout(1500)
  checks.push(['интро-диалог закрывается', await dismissIntro(page)])
  checks.push(['сцена отрисовалась', await waitButton(page, /Страж Алдрик|В караулку/)])
  const scene = await step(page, '03-scene', 'Игровая сцена')
  checks.push(['сцена с NPC', scene.buttons.some((b) => /Алдрик|Страж/i.test(b))])
  // Клик по NPC может не сработать, пока висит «Пропустить»: пробуем дважды
  // и проверяем по факту — появились ли реплики на экране.
  await tap(page, 'Страж Алдрик')
  if (!(await waitButton(page, /^▸/, 3000))) {
    await dismissIntro(page)
    await tap(page, 'Страж Алдрик')
  }
  checks.push(['NPC открывает диалог', await waitButton(page, /^▸/)])
  const dialogue = await step(page, '04-dialogue', 'Диалог')
  checks.push(['есть выбор реплики', dialogue.buttons.some((b) => b.startsWith('▸'))])
  checks.push(['реплика выбрана', await tap(page, 'Ищу работу')])
  await dismissIntro(page)   // ответ собеседника тоже идёт репликами
  await step(page, '05-choice', 'Ответ собеседника')
  checks.push(['разговор закрывается', (await waitButton(page, /Закончить разговор/, 5000)) && await tap(page, 'Закончить разговор')])
  await tap(page, 'Идти в город')
  // Переход может открыть модальное окно («Ок») или сразу новую сцену — важно,
  // что диалог закрылся и игрок получил реакцию на действие.
  const afterTravel = await page.evaluate(() => ({
    hasOk: [...document.querySelectorAll('button')].some((b) => /^Ок$/i.test((b.innerText || '').trim())),
    text: document.body.innerText.slice(0, 600),
  }))
  checks.push(['переход в город', afterTravel.hasOk || /рын|город|ворот|площад/i.test(afterTravel.text)])
  await step(page, '06-travel', 'Переход / карта')

  for (const [label, ok] of checks) if (!ok) report.findings.push(`шаг не найден: ${label}`)
  if (/Игра столкнулась с ошибкой/.test(afterTravel.text)) report.findings.push('экран «Игра столкнулась с ошибкой»')
  await context.close()
}

// ── Маршрут 2: FMV-проект от постера до финала ─────────────────────────
{
  const hasFmv = campaignIndex().some((c) => c.id === 'fmv-crossing')
  if (!hasFmv) report.findings.push('в реестре браузерной сборки нет кампании fmv-crossing')
  if (hasFmv) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await openPage(context)
    recordSteps = true
    await page.goto(base, { waitUntil: 'networkidle', timeout: 45_000 })
    await page.getByRole('button', { name: 'Кампании' }).click()
    const fmvCard = page.locator('.campaign-row').filter({ hasText: /Перекрёсток огней/ }).locator('.campaign-card')
    await fmvCard.waitFor({ state: 'visible', timeout: 8000 })
    await fmvCard.click()
    await page.waitForFunction(() => /Перекрёсток огней/i.test(document.querySelector('.campaign-title')?.textContent ?? ''), null, { timeout: 12000 })
    const project = await step(page, '01-fmv-project-open', 'Открыт проект «Перекрёсток огней»')
    if (/Игра столкнулась с ошибкой|Кампаний пока нет/.test(project.text)) report.findings.push('ошибка при открытии FMV-проекта')

    if (!(await tap(page, 'Новый забег'))) report.findings.push('не найдена кнопка запуска fmv-crossing')
    await page.waitForSelector('[data-fmv-mode]', { timeout: 20000 })
    await page.waitForFunction(() => document.querySelector('[data-fmv-mode]')?.getAttribute('data-fmv-phase') === 'playing', null, { timeout: 12000 })
    await page.waitForSelector('[data-fmv-poster]', { state: 'visible', timeout: 5000 })
    const poster = await step(page, '02-fmv-poster', 'Постер первого видеофрагмента')
    const posterState = await page.locator('[data-fmv-poster]').evaluate((img) => ({ loaded: img.complete && img.naturalWidth > 0, box: img.getBoundingClientRect().toJSON() }))
    if (!posterState.loaded || posterState.box.width < 1 || posterState.box.height < 1) report.findings.push('постер первого фрагмента не загружен или невидим')
    if (/Фон сцены не загрузился|Игра столкнулась с ошибкой/.test(poster.text)) report.findings.push('ошибка на постере первого фрагмента')

    await page.locator('[data-fmv-play]').click()
    await page.waitForFunction(() => document.querySelector('[data-fmv-video]')?.getAttribute('class')?.includes('is-visible'), null, { timeout: 5000 })
    await page.waitForSelector('[data-fmv-subtitle]', { state: 'visible', timeout: 5000 })
    const subtitleIsOverlay = await page.locator('[data-fmv-subtitle]').evaluate((node) => {
      const rect = node.getBoundingClientRect()
      const style = getComputedStyle(node)
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && !node.closest('.journal, [data-journal]')
    })
    if (!subtitleIsOverlay) report.findings.push('субтитр не виден поверх видео вне журнала')
    const firstVideo = await step(page, '03-fmv-video-fragment-a', 'Идёт первый видефрагмент, субтитры поверх видео')
    if (!firstVideo.text.includes('У развилки гаснут огни')) report.findings.push('текст субтитра первого видеофрагмента отсутствует на экране')

    await page.waitForSelector('[data-fmv-choices]', { timeout: 15000 })
    const choices = await step(page, '04-fmv-post-fragment-choice', 'Выбор после фрагмента без пустого кадра')
    const choiceFrame = await page.evaluate(() => {
      const stage = document.querySelector('.fmv-stage')
      const poster = document.querySelector('[data-fmv-poster]')
      const video = document.querySelector('[data-fmv-video]')
      const choice = document.querySelector('[data-fmv-choices]')
      return {
        choiceVisible: !!choice && choice.getBoundingClientRect().width > 0,
        posterLoaded: !!poster && poster.complete && poster.naturalWidth > 0,
        mediaPresent: !!stage && !!(poster?.getBoundingClientRect().width || video?.getBoundingClientRect().width),
      }
    })
    if (!choiceFrame.choiceVisible || !choiceFrame.posterLoaded || !choiceFrame.mediaPresent) report.findings.push('после первого фрагмента выбор показан на пустом кадре или без постера')
    if (!choices.buttons.some((button) => /свет фонаря/i.test(button))) report.findings.push('на первом выборе отсутствует ветка фонаря')

    await page.getByRole('button', { name: /Идти на свет фонаря/ }).click()
    await page.waitForFunction(() => document.querySelector('[data-fmv-presentation="2"]'), null, { timeout: 8000 })
    await page.waitForFunction(() => document.querySelector('[data-fmv-mode]')?.getAttribute('data-fmv-phase') === 'playing', null, { timeout: 8000 })
    await page.waitForSelector('[data-fmv-poster]', { state: 'visible', timeout: 5000 })
    const nextPoster = await step(page, '05-fmv-poster-fragment-b', 'Постер выбранного второго фрагмента')
    if (/Игра столкнулась с ошибкой/.test(nextPoster.text)) report.findings.push('ошибка при переходе ко второму фрагменту')
    await page.locator('[data-fmv-play]').click()
    await page.waitForFunction(() => document.querySelector('[data-fmv-video]')?.getAttribute('class')?.includes('is-visible'), null, { timeout: 5000 })
    await page.waitForSelector('[data-fmv-subtitle]', { state: 'visible', timeout: 5000 })
    const secondVideo = await step(page, '06-fmv-video-fragment-b', 'Идёт второй видеофрагмент')
    if (!secondVideo.text.includes('Фонарь освещает безопасную дорогу')) report.findings.push('субтитр второго видеофрагмента отсутствует на экране')

    await page.waitForSelector('[data-fmv-ending]', { timeout: 15000 })
    const ending = await step(page, '07-fmv-ending', 'Достигнут финал выбранной ветки')
    if (/Игра столкнулась с ошибкой|Фон сцены не загрузился/.test(ending.text)) report.findings.push('ошибка на финальном экране FMV')
    await context.close()
  }
  recordSteps = false
}

recordSteps = true
}

// ── Маршрут 3: проект adventure от старта до развязки ───────────────────
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await openPage(context)
  await page.goto(base, { waitUntil: 'networkidle', timeout: 45_000 })
  await page.waitForTimeout(700)
  await step(page, '01-adventure-campaign-menu', 'Меню выбора проекта adventure')
  await page.getByRole('button', { name: 'Кампании' }).click()
  const adventureCard = page.locator('.campaign-row').filter({ hasText: /проект adventure/i }).locator('.campaign-card')
  await adventureCard.waitFor({ state: 'visible', timeout: 8000 })
  await adventureCard.click()
  await page.waitForFunction(() => /проект adventure/i.test(document.querySelector('.campaign-title')?.textContent ?? ''), null, { timeout: 12000 })
  const menu = await step(page, '02-adventure-menu', 'Меню кампании adventure')
  if (/Кампаний пока нет/.test(menu.text)) report.findings.push('показан экран пустого каталога вместо кампании adventure')

  if (!(await tap(page, 'Новый забег'))) report.findings.push('не найден запуск adventure')
  await page.waitForTimeout(500)
  const character = await step(page, '03-adventure-character', 'Создание героя для adventure')
  if (/Игра столкнулась с ошибкой/.test(character.text)) report.findings.push('ошибка при создании героя adventure')
  await tap(page, 'Солдат')
  await tap(page, 'Наёмник')
  if (!(await tap(page, 'Начать забег'))) report.findings.push('не найден старт adventure')
  await page.waitForSelector('[data-adventure-ready]', { timeout: 20000 })
  await page.waitForTimeout(500)
  if (!(await dismissCutscene(page))) report.findings.push('не удалось закрыть пролог adventure')
  await dismissIntro(page)
  if (!(await dismissMessages(page))) {
    const blocking = await page.locator('.message-overlay').evaluateAll((nodes) => nodes.map((node) => ({ text: node.innerText, buttons: [...node.querySelectorAll('button')].map((button) => button.innerText) })))
    console.log('  adventure modal:', JSON.stringify(blocking))
    report.findings.push('не удалось закрыть сообщение adventure')
  }
  if (await page.getByText('Просто путник', { exact: false }).count()) {
    await tap(page, 'Просто путник', 4000)
    await dismissIntro(page)
    await dismissMessages(page)
  }
  if (await page.getByText('Закончить разговор', { exact: false }).count()) {
    await tap(page, 'Закончить разговор', 2500)
  }
  const initial = await step(page, '04-adventure-stage', 'Сцена adventure, pack view подключён')
  if (!initial.text.includes('Говорить') || !initial.text.includes('Взять')) report.findings.push('не показаны режимы курсора adventure')
  await page.waitForTimeout(500)
  await dismissMessages(page)

  await page.locator('[data-adventure-cursor="walk"]').click()
  await page.locator('[data-adventure-hotspot]').filter({ hasText: 'Горная трава слева' }).click()
  await step(page, '05-adventure-walk', 'Ходьба к точке сцены')
  const avatar = await page.locator('[data-adventure-avatar]').evaluate((node) => ({ left: node.style.left, top: node.style.top }))
  if (avatar.left === '25%' && avatar.top === '77.77777777777779%') report.findings.push('клик не переместил аватар')

  await page.locator('[data-adventure-cursor="look"]').click()
  await page.locator('[data-adventure-hotspot]').filter({ hasText: 'Символы на воротах' }).click()
  await step(page, '06-adventure-inspect', 'Осмотр символов ворот')
  if (!(await page.locator('[data-adventure-message]').count())) report.findings.push('осмотр не показал сообщение adventure')

  await page.locator('[data-adventure-cursor="take"]').click()
  await page.locator('[data-adventure-hotspot]').filter({ hasText: 'Горная трава слева' }).click()
  await page.locator('[data-adventure-hotspot]').filter({ hasText: 'Горная трава справа' }).click()
  await step(page, '07-adventure-items', 'Взяты два предмета')
  const herbs = await page.locator('[data-adventure-item="item_herb"]').count()
  if (herbs !== 1) report.findings.push(`ожидался один объединённый слот двух трав, найдено ${herbs}`)
  await page.locator('[data-adventure-item="item_herb"]').click()
  await page.locator('[data-adventure-item="item_herb"]').click()
  await page.waitForSelector('[data-adventure-crafted]', { timeout: 5000 })
  await step(page, '08-adventure-combination', 'Два предмета соединены в мазь')

  await page.locator('[data-adventure-cursor="talk"]').click()
  await page.locator('[data-adventure-hotspot]').filter({ hasText: 'Стражник Алдрик' }).click()
  await waitButton(page, /Ищу работу|Просто путник/, 10000)
  await step(page, '09-adventure-conversation', 'Разговор со стражником')
  await tap(page, 'Ищу работу', 5000)
  await dismissIntro(page)
  if (await page.getByText('Закончить разговор', { exact: false }).count()) await tap(page, 'Закончить разговор', 4000)
  await page.waitForTimeout(500)
  if (!(await dismissMessages(page))) {
    const blocking = await page.locator('.message-overlay').evaluateAll((nodes) => nodes.map((node) => ({ text: node.innerText, buttons: [...node.querySelectorAll('button')].map((button) => button.innerText) })))
    console.log('  adventure modal after dialogue:', JSON.stringify(blocking))
    report.findings.push('не удалось закрыть сообщение после диалога adventure')
  }

  const openRiddle = page.locator('[data-adventure-open-riddle]').first()
  await openRiddle.click()
  await page.waitForSelector('[data-adventure-riddle]', { timeout: 5000 })
  await step(page, '10-adventure-riddle', 'Крупный план загадки gate sigils')
  for (const sigil of ['Дуб', 'Пепел', 'Солнце']) await page.getByRole('button', { name: sigil, exact: true }).click()
  await page.getByRole('button', { name: 'Проверить порядок' }).click()
  await page.waitForFunction(() => /последовательность не совпала/i.test(document.querySelector('[data-adventure-message]')?.textContent ?? ''), null, { timeout: 5000 })
  await step(page, '11-adventure-riddle-rejected', 'Неверная последовательность отклонена')
  await page.getByRole('button', { name: 'Сбросить' }).click()
  for (const sigil of ['Пепел', 'Дуб', 'Солнце']) await page.getByRole('button', { name: sigil, exact: true }).click()
  await page.getByRole('button', { name: 'Проверить порядок' }).click()
  await page.waitForSelector('[data-adventure-ending="ending_gate_unlocked"]', { timeout: 7000 })
  const ending = await step(page, '12-adventure-ending', 'Финал: ворота открыты')
  const visualProblems = /Фон сцены не загрузился|Игра столкнулась с ошибкой|пак неизвестен|Кампаний пока нет|npc_[a-z0-9_]+|item_[a-z0-9_]+/.test(ending.text)
  if (visualProblems) report.findings.push('на финальном экране adventure есть ошибка, сырой id или пустой каталог')
  const endingId = await page.locator('[data-adventure-ending]').getAttribute('data-adventure-ending')
  if (endingId !== 'ending_gate_unlocked') report.findings.push(`не достигнут ending_gate_unlocked: ${endingId}`)

  // Открой Studio на проекте, чтобы доказать, что его объявленные панели доступны.
  await page.evaluate(() => { window.location.hash = '#editor' })
  await page.waitForSelector('.editor-nav', { timeout: 20000 })
  await page.getByRole('button', { name: /^Проект/ }).click()
  await page.getByRole('button', { name: 'Панели пака' }).click()
  await page.waitForSelector('[data-pack-panels]', { timeout: 10000 })
  const panelBody = await step(page, '13-adventure-pack-panel', 'Панель пака adventure в Studio')
  if (!/Сцена приключения/.test(panelBody.text) || /пак неизвестен/i.test(panelBody.text)) {
    report.findings.push('не открылась панель adventure из манифеста')
  }
  await context.close()
}

await browser.close()

for (const e of errors.slice(0, 10)) report.findings.push(`pageerror: ${e.slice(0, 200)}`)
const pageErrors = errors.length
const errorScreenPattern = /Фон сцены не загрузился|Игра столкнулась с ошибкой|Кампаний пока нет|Ошибка загрузки кампании/i
const errorScreens = report.steps.filter((entry) => errorScreenPattern.test(entry.text)).length
const brokenPortraitImages = observations.reduce((sum, entry) => sum + (entry.brokenPortraitImages || 0), 0)
const rawNpcIds = observations.reduce((sum, entry) => sum + (entry.text.match(/\bnpc_[a-z0-9_]+\b/gi) || []).length, 0)
report.pageErrors = pageErrors
report.errorScreens = errorScreens
report.brokenPortraitImages = brokenPortraitImages
report.rawNpcIds = rawNpcIds
if (brokenPortraitImages > 0) report.findings.push(`битых портретов: ${brokenPortraitImages}`)
if (rawNpcIds > 0) report.findings.push(`экранов с необработанными id персонажа: ${rawNpcIds}`)
if (pageErrors > 0) report.findings.push(`pageerror: ${pageErrors}`)
if (errorScreens > 0) report.findings.push(`экранов ошибки: ${errorScreens}`)
if (report.steps.length < 6) report.findings.push(`недостаточно экранов: ${report.steps.length} (нужно не меньше 6)`)
const fatalConsole = consoleErrors.filter((e) => !/фон не загрузился|Failed to load resource/i.test(e))
for (const e of fatalConsole.slice(0, 10)) report.findings.push(`console: ${e.slice(0, 200)}`)

report.ok = report.findings.length === 0
report.finishedAt = new Date().toISOString()
writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2) + '\n')
writeFileSync(join(outDir, 'report.md'), [
  '# Проверка игрой в браузере', '',
  `Основа: ${base}`, `Движок: ${engine}`, `Шагов: ${report.steps.length}`,
  `PNG снимков: ${report.steps.length}`,
  `pageerror: ${pageErrors}`, `Экранов ошибки: ${errorScreens}`,
  `Битых портретов: ${brokenPortraitImages}`, `Сырых id персонажей: ${rawNpcIds}`,
  `Итог: ${report.ok ? 'ok' : 'fail'}`, '',
  '| Шаг | Что | PNG |',
  '|---|---|---|',
  ...report.steps.map((s) => `| ${s.name} | ${s.label} | ${s.file} |`),
  '', '## Находки', '',
  ...(report.findings.length ? report.findings.map((f) => `- ${f}`) : ['- нет']),
  '',
].join('\n'))

console.log(`\n${report.ok ? '✓' : '✗'} маршрут: ${report.steps.length} шагов, ${report.findings.length} находок`)
report.findings.forEach((f) => console.log('  · ' + f))
process.exit(report.ok ? 0 : 1)
