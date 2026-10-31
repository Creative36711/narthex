#!/usr/bin/env node
/**
 * Воспроизводимая проверка игрой в настоящем браузере.
 *
 *   node scripts/visual/playthrough.mjs [baseUrl] [outDir]
 *   npm run playthrough:exam -- [baseUrl] [outDir]
 *
 * `--exam` — отдельный строгий маршрут ash-of-caerden и ash-of-caerden-adventure;
 * исходный вызов без флага оставлен без изменения.
 *
 * Зачем: `cf-play explore` и `check:contracts` проверяют данные и код, но не
 * открывают игру. Этот скрипт открывает собранное приложение в Chromium,
 * проходит菜单 → создание героя → сцена → диалог → выбор реплики → переход,
 * снимает PNG каждого шага и проверяет, что игрок не увидел экрана ошибки.
 *
 * Браузер в песочнице агента ЕСТЬ: docs/agents/browser.md. Если не поднялся —
 * это дефект установки, а не повод сдавать отчёт без прохождения (код 2).
 *
 * Код возврата: обычный режим — 0 при зелёном legacy-маршруте, 1 при дефекте;
 * --exam — 0 только если оба пака прошли все строгие пороги; 1 при находке;
 * 2 — браузер не поднялся (нет пакетов; см. browser.md).
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs'
import { extname, join, relative, resolve, sep } from 'node:path'
import { declaredAbsences } from './absence-policy.mjs'

const positional = process.argv.slice(2).filter((arg) => !arg.startsWith('--'))
const adventureOnly = process.argv.includes('--adventure')
const examMode = process.argv.includes('--exam')
const fixtureRootArg = process.argv.find((arg) => arg.startsWith('--fixture-root='))
const fixtureRoot = fixtureRootArg ? resolve(fixtureRootArg.slice('--fixture-root='.length)) : null
if (fixtureRoot && !examMode) {
  console.error('--fixture-root доступен только в режиме --exam')
  process.exit(2)
}
const base = positional[0] || 'http://localhost:4173'
const outDir = resolve(positional[1] || (examMode ? 'out/playthrough-exam' : 'out/play'))
const campaignRoot = fixtureRoot ?? resolve('public/campaigns')
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
  const root = campaignRoot
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
let activeOutDir = outDir
let activePackId = null
const examOutputLines = []

function visualLog(line) {
  console.log(line)
  if (examMode) examOutputLines.push(line)
}

async function openPage(context) {
  const page = await context.newPage()
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)) })
  if (fixtureRoot) {
    // Только exam harness: временная fixture-копия кампаний может подменяться
    // для mutation-test. Производственные ресурсы/репозиторий не изменяются.
    await page.route('**/campaigns/**', async (route) => {
      const pathname = new URL(route.request().url()).pathname
      const relativePath = decodeURIComponent(pathname.replace(/^\/campaigns\/?/, ''))
      if (relativePath === 'index.json') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(campaignIndex()) })
      }
      const file = resolve(campaignRoot, relativePath)
      if (file !== campaignRoot && !file.startsWith(`${campaignRoot}${sep}`)) {
        return route.fulfill({ status: 403, contentType: 'text/plain', body: 'Forbidden' })
      }
      if (!existsSync(file) || !statSync(file).isFile()) {
        return route.fulfill({ status: 404, contentType: 'text/plain', body: `Missing fixture: ${relativePath}` })
      }
      const mime = ({
        '.avif': 'image/avif', '.gif': 'image/gif', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg',
        '.json': 'application/json', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.png': 'image/png',
        '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff': 'font/woff', '.woff2': 'font/woff2',
      })[extname(file).toLowerCase()] || 'application/octet-stream'
      return route.fulfill({ status: 200, contentType: mime, body: readFileSync(file) })
    })
  } else {
    // Пустой реестр — штатное состояние поставки. Подменяем ТОЛЬКО сетевой
    // ответ, не файлы репозитория: приложение показывает каталог найденных паков.
    await page.route('**/campaigns/index.json*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(campaignIndex()) }))
  }
  return page
}

async function step(page, name, label) {
  if (examMode) {
    await page.waitForFunction(() => [...document.images].every((image) => image.complete), undefined, { timeout: 3000 }).catch(() => {})
  }
  const info = await page.evaluate((inspectImages) => {
    const fullText = document.body.innerText
    const text = fullText.replace(/\n{2,}/g, '\n').slice(0, 1500)
    const images = [...document.querySelectorAll('img')]
    const broken = images.filter((i) => i.complete && i.naturalWidth === 0)
    const emptySrc = images.filter((i) => !(i.getAttribute('src') || '').trim())
    const result = {
      text,
      buttons: [...document.querySelectorAll('button')].map((b) => (b.innerText || '').trim()).filter(Boolean).slice(0, 40),
      brokenImages: broken.length,
      emptySrcImages: emptySrc.length,
      brokenPortraitImages: [...document.querySelectorAll('.dialogue-portrait img, .message-portrait')].filter((i) => i.complete && i.naturalWidth === 0).length,
      videos: document.querySelectorAll('video').length,
    }
    if (inspectImages) {
      result.brokenImageSources = [...new Set(broken.map((image) => image.currentSrc || image.src))]
      result.emptySrcImageSources = [...new Set(emptySrc.map((image) => image.currentSrc || image.src || '(empty src)'))]
      result.rawNpcIds = (fullText.match(/\bnpc_[a-z0-9_-]+\b/gi) || []).length
    }
    return result
  }, examMode)
  observations.push({ pack: activePackId, name, ...info })
  if (recordSteps) {
    const file = join(activeOutDir, `${name}.png`)
    await page.screenshot({ path: file })
    report.steps.push({ ...(activePackId ? { pack: activePackId } : {}), name, label, file, ...info })
    visualLog(`  ${activePackId ? `${activePackId} / ` : ''}${name}: ${label} — кнопок ${info.buttons.length}, битых img ${info.brokenImages}`)
  } else {
    visualLog(`  ${name}: проверено — кнопок ${info.buttons.length}, битых img ${info.brokenImages}`)
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

const strictExamErrorScreen = /Фон сцены не загрузился|Игра столкнулась с ошибкой|Кампаний пока нет|Ошибка загрузки кампании|Сцена не найдена|пак неизвестен/i
/**
 * Список намеренно отсутствующих медиа берём у самой кампании (D-076):
 * `known_absent_images` в dev-fixture.json. У проекта витрины маркера нет,
 * поэтому список пуст и любое отсутствие остаётся находкой. Здесь нет ни
 * одного захардкоженного пути — иначе проверка знала бы только те файлы,
 * которые проходит маршрут.
 */
function declaredAbsencesFor(campaignId) {
  return declaredAbsences(campaignRoot, campaignId)
}

function campaignRelativePath(url, campaignId) {
  const pathname = new URL(url).pathname
  const prefix = `/campaigns/${campaignId}/`
  const start = pathname.indexOf(prefix)
  if (start < 0) return pathname
  try {
    return decodeURIComponent(pathname.slice(start + prefix.length))
  } catch {
    return pathname.slice(start + prefix.length)
  }
}

function isBlockingCampaignResponseFailure(failure) {
  const pathname = new URL(failure.url).pathname
  // project.json и encounters index могут отсутствовать у legacy-паков;
  // изображения и игровые сцены, напротив, должны реально загружаться.
  return !pathname.endsWith('/project.json') && !pathname.endsWith('/encounters/encounters.json')
}

function visibleEndingId(campaignId, title) {
  try {
    const campaign = JSON.parse(readFileSync(join(campaignRoot, campaignId, 'campaign.json'), 'utf8'))
    return (campaign.endings || campaign.meta?.endings || []).find((ending) => ending.title === title)?.id || null
  } catch {
    return null
  }
}

async function chooseCampaign(page, definition) {
  await page.getByRole('button', { name: 'Кампании', exact: true }).click()
  // Карточка narrative-кампании несёт поставленное название без dev-метки,
  // поэтому выбираем по названию и отсекаем adventure-полигон того же пака.
  let rows = page.locator('.campaign-row').filter({ hasText: definition.card })
  if (definition.cardNot) rows = rows.filter({ hasNotText: definition.cardNot })
  if ((await rows.count()) === 0) {
    // Ожидание карточки без неё самой даёт «Timeout 8000ms exceeded» и прячет
    // причину: в меню другие названия. Называем их сразу — это и есть диагноз.
    const titles = await page.locator('.campaign-card-title').allInnerTexts()
    throw new Error(`карточка кампании ${definition.id} не найдена по тексту ${definition.card}: в меню ${titles.length ? titles.map((title) => `«${title.trim()}»`).join(', ') : 'нет ни одной кампании'}`)
  }
  const row = rows.first()
  await row.waitFor({ state: 'visible', timeout: 8000 })
  await row.locator('.campaign-card').click()
  await page.waitForFunction((pattern) => {
    const title = document.querySelector('.campaign-title')?.textContent ?? ''
    return new RegExp(pattern, 'i').test(title)
  }, definition.title.source, { timeout: 12000 })
  return step(page, `${definition.id}-02-selected`, 'Пак выбран в меню кампаний')
}

async function runAshExamRoute(page, addFinding, setFinal) {
  const definition = { id: 'ash-of-caerden', card: /Пепел Каэрдена/i, cardNot: /adventure/i, title: /Пепел Каэрдена/i, charChoices: [/Посланник/, /Торговец/] }
  await page.waitForTimeout(700)
  const home = await step(page, `${definition.id}-01-home`, 'Стартовое меню')
  if (/Кампаний пока нет/i.test(home.text)) addFinding('старт показывает «Кампаний пока нет»')
  await chooseCampaign(page, definition)

  await page.getByRole('button', { name: 'Новый забег', exact: true }).click()
  await page.waitForTimeout(350)
  const character = await step(page, `${definition.id}-03-character`, 'Создание героя перед новым забегом')
  if (/Кампаний пока нет|Игра столкнулась с ошибкой/i.test(character.text)) addFinding('ошибка до старта нового забега')
  await page.getByRole('button', { name: /Посланник/ }).click()
  await page.getByRole('button', { name: /Торговец/ }).click()
  // Keep this UI route deterministic without campaign edits: minimum CON/SIZ
  // produce 3 HP and minimum DEX lets the real forest-ambush AI act first.
  // The seeded critical blow reaches ending_ashes before CombatScreen mounts,
  // so unrelated, intentionally absent combat art is never requested.
  for (const [stat, index] of [['CON', 1], ['SIZ', 2], ['DEX', 3]]) {
    const row = page.locator('.char-stats .char-stat-row').nth(index)
    const value = Number((await row.locator('.char-stat-val').innerText()).trim())
    for (let point = value; point > 3; point--) await row.getByRole('button').first().click()
  }
  // «Железный человек»: бой в лесу становится воспроизводимо смертельным для
  // слабого (но валидного) героя выше. Сложность объявляет no_autosave, поэтому
  // проверка сохранений идёт через ручной слот — он стиранием автосейва не
  // затрагивается (SavesPanel: «ручные слоты сохраняются»).
  const ironDifficulty = page.getByRole('button', { name: /Железный человек/ })
  if (await ironDifficulty.count()) await ironDifficulty.click()
  await page.getByRole('button', { name: 'Начать забег', exact: true }).click()
  await page.waitForTimeout(600)
  if (!(await dismissCutscene(page))) addFinding('не удалось закрыть вступительную сцену Ash')
  await page.waitForTimeout(300)
  await step(page, `${definition.id}-04-new-run-scene`, 'Сцена после «Нового забега»')

  const dialogue = page.locator('.dialogue-overlay')
  if (await dialogue.count()) {
    await dismissIntro(page)
    const work = dialogue.getByRole('button', { name: /Ищу работу/ })
    const traveler = dialogue.getByRole('button', { name: /Просто путник/ })
    if (await work.count()) await work.first().click()
    else if (await traveler.count()) await traveler.first().click()
    else addFinding('в стартовом диалоге нет доступного ответа')
    await page.waitForTimeout(300)
    await dismissIntro(page)
    const close = page.locator('.dialogue-overlay').getByRole('button', { name: /Закончить разговор/ })
    if (await close.count()) await close.last().click()
    await page.waitForTimeout(250)
    await dismissMessages(page)
  }
  await step(page, `${definition.id}-05-gates-ready`, 'Стартовая сцена и диалог закрыты')

  // Ручной слот до финала: финал стирает автосейв (roguelike gameOver) и запирает
  // запись в слот, поэтому «сохранение после финала» проверяется на этом снимке.
  await saveToSlot(page)
  await step(page, `${definition.id}-05b-save-slot`, 'Забег записан в ручной слот до финала')

  await page.getByRole('button', { name: 'Карта', exact: true }).click()
  await page.locator('.map-screen').waitFor({ state: 'visible', timeout: 5000 })
  const map = await step(page, `${definition.id}-06-map`, 'Карта долины из стартовой сцены')
  if (!/Лесная опушка/.test(map.text)) addFinding('на карте не видна Лесная опушка')
  const forest = page.locator('.map-pin').filter({ hasText: /Лесная опушка/ }).first()
  await forest.waitFor({ state: 'visible', timeout: 5000 })
  await forest.click()
  await page.getByRole('button', { name: /В путь/ }).click()
  const journey = page.locator('.travel-journey-overlay')
  await journey.waitFor({ state: 'visible', timeout: 5000 })
  await journey.waitFor({ state: 'hidden', timeout: 7000 })
  await page.waitForTimeout(300)
  const combatOverlay = page.locator('.combat-overlay')
  if (!(await combatOverlay.count())) {
    await dismissCutscene(page)
    await dismissMessages(page)
  }
  const arrival = await step(page, `${definition.id}-07-forest-encounter`, 'Прибытие в лесную локацию / состояние боя')
  let finalState = null
  let finalVisibleText = ''

  if (await combatOverlay.count()) {
    const briefing = page.getByRole('button', { name: /Понятно, в бой/ })
    if (await briefing.count()) await briefing.click()
    await page.waitForTimeout(400)
    await step(page, `${definition.id}-08-combat`, 'Боевой экран после вступления в бой')
    for (let round = 0; round < 80; round++) {
      if (await page.locator('.end-overlay').count()) break
      if (!(await page.locator('.combat-overlay').count())) break
      const pass = page.getByRole('button', { name: 'Пропустить ход', exact: true })
      if (await pass.count() && await pass.isEnabled()) {
        await pass.click()
        await page.waitForTimeout(550)
      } else {
        await page.waitForTimeout(250)
      }
    }
  }

  if (await page.locator('.end-overlay').count()) {
    const title = (await page.locator('.end-panel h1').innerText()).trim()
    finalState = visibleEndingId(definition.id, title) || `visible-ending:${title}`
    finalVisibleText = (await page.locator('.end-panel').innerText()).slice(0, 700)
    await step(page, `${definition.id}-09-ending`, `Итоговый экран Ash: ${title}`)
  } else {
    addFinding(`после прибытия в лес не достигнут итоговый экран; последнее состояние: ${arrival.text.slice(-220).replace(/\n/g, ' ')}`)
  }
  setFinal(finalState, finalVisibleText)
  await runSaveExam(page, definition, addFinding)
}

async function runAdventureExamRoute(page, addFinding, setFinal) {
  const definition = { id: 'ash-of-caerden-adventure', card: /проект adventure/i, title: /проект adventure/i, charChoices: [/Солдат/, /Наёмник/] }
  await page.waitForTimeout(700)
  const home = await step(page, `${definition.id}-01-home`, 'Стартовое меню')
  if (/Кампаний пока нет/i.test(home.text)) addFinding('старт показывает «Кампаний пока нет»')
  await chooseCampaign(page, definition)

  await page.getByRole('button', { name: 'Новый забег', exact: true }).click()
  await page.waitForTimeout(350)
  const character = await step(page, `${definition.id}-03-character`, 'Создание героя adventure')
  if (/Кампаний пока нет|Игра столкнулась с ошибкой/i.test(character.text)) addFinding('ошибка до старта нового забега')
  await page.getByRole('button', { name: /Солдат/ }).click()
  await page.getByRole('button', { name: /Наёмник/ }).click()
  await page.getByRole('button', { name: 'Начать забег', exact: true }).click()
  await page.waitForSelector('[data-adventure-ready]', { timeout: 20000 })
  await page.waitForTimeout(350)
  if (!(await dismissCutscene(page))) addFinding('не удалось закрыть пролог adventure')
  await dismissIntro(page)
  await dismissMessages(page)
  if (await page.getByText('Просто путник', { exact: false }).count()) {
    await tap(page, 'Просто путник', 4000)
    await dismissIntro(page)
    await dismissMessages(page)
  }
  if (await page.getByText('Закончить разговор', { exact: false }).count()) {
    await tap(page, 'Закончить разговор', 2500)
  }
  const initial = await step(page, `${definition.id}-04-stage`, 'Сцена adventure после нового забега')
  if (!initial.text.includes('Говорить') || !initial.text.includes('Взять')) addFinding('не показаны режимы курсора adventure')
  await dismissMessages(page)

  await page.locator('[data-adventure-cursor="walk"]').click()
  await page.locator('[data-adventure-hotspot]').filter({ hasText: 'Горная трава слева' }).click()
  await step(page, `${definition.id}-05-walk`, 'Ходьба к точке сцены')
  const avatar = await page.locator('[data-adventure-avatar]').evaluate((node) => ({ left: node.style.left, top: node.style.top }))
  if (avatar.left === '25%' && avatar.top === '77.77777777777779%') addFinding('клик не переместил аватар')

  await page.locator('[data-adventure-cursor="look"]').click()
  await page.locator('[data-adventure-hotspot]').filter({ hasText: 'Символы на воротах' }).click()
  const inspected = await step(page, `${definition.id}-06-inspect`, 'Осмотр символов ворот')
  if (!(await page.locator('[data-adventure-message]').count())) addFinding(`осмотр не показал сообщение; экран: ${inspected.text.slice(-160)}`)

  await page.locator('[data-adventure-cursor="take"]').click()
  await page.locator('[data-adventure-hotspot]').filter({ hasText: 'Горная трава слева' }).click()
  await page.locator('[data-adventure-hotspot]').filter({ hasText: 'Горная трава справа' }).click()
  await step(page, `${definition.id}-07-items`, 'Взяты два предмета')
  const herbs = await page.locator('[data-adventure-item="item_herb"]').count()
  if (herbs !== 1) addFinding(`ожидался один объединённый слот двух трав, найдено ${herbs}`)
  await page.locator('[data-adventure-item="item_herb"]').click()
  await page.locator('[data-adventure-item="item_herb"]').click()
  await page.waitForSelector('[data-adventure-crafted]', { timeout: 5000 })
  await step(page, `${definition.id}-08-combination`, 'Два предмета соединены в мазь')

  await page.locator('[data-adventure-cursor="talk"]').click()
  await page.locator('[data-adventure-hotspot]').filter({ hasText: 'Стражник Алдрик' }).click()
  if (!(await waitButton(page, /Ищу работу|Просто путник/, 10000))) throw new Error('диалог со стражником не открыл выбор реплики')
  await step(page, `${definition.id}-09-dialogue`, 'Разговор со стражником')
  await tap(page, 'Ищу работу', 5000)
  await dismissIntro(page)
  if (await page.getByText('Закончить разговор', { exact: false }).count()) await tap(page, 'Закончить разговор', 4000)
  await page.waitForTimeout(350)
  await dismissMessages(page)

  // Ручной слот до финала — тот же шаг проверки сохранений, что и в narrative-маршруте.
  await saveToSlot(page)
  await step(page, `${definition.id}-09b-save-slot`, 'Забег записан в ручной слот до финала')

  await page.locator('[data-adventure-open-riddle]').first().click()
  await page.waitForSelector('[data-adventure-riddle]', { timeout: 5000 })
  await step(page, `${definition.id}-10-riddle`, 'Крупный план загадки ворот')
  for (const sigil of ['Дуб', 'Пепел', 'Солнце']) await page.getByRole('button', { name: sigil, exact: true }).click()
  await page.getByRole('button', { name: 'Проверить порядок' }).click()
  await page.waitForFunction(() => /последовательность не совпала/i.test(document.querySelector('[data-adventure-message]')?.textContent ?? ''), null, { timeout: 5000 })
  await step(page, `${definition.id}-11-rejected-answer`, 'Неверная последовательность отклонена')
  await page.getByRole('button', { name: 'Сбросить' }).click()
  for (const sigil of ['Пепел', 'Дуб', 'Солнце']) await page.getByRole('button', { name: sigil, exact: true }).click()
  await page.getByRole('button', { name: 'Проверить порядок' }).click()
  await page.waitForSelector('[data-adventure-ending="ending_gate_unlocked"]', { timeout: 7000 })
  const ending = await page.locator('[data-adventure-ending="ending_gate_unlocked"]').innerText()
  await step(page, `${definition.id}-12-ending`, 'Финал: ending_gate_unlocked')
  setFinal('ending_gate_unlocked', ending.slice(0, 700))
  await runSaveExam(page, definition, addFinding)
}

/**
 * Сохранения в браузере: движок пишет их в localStorage (src/core/save/keys.ts) —
 * автосейв под ключом `narthex:save:<id>`, ручной слот под `narthex:save:<id>@<n>`.
 * Читаем тот же канал, которым пользуется игра, чтобы сравнивать данные, а не разметку.
 */
const saveKeyOf = (campaignId, slot = 'auto') => (slot === 'auto' ? `narthex:save:${campaignId}` : `narthex:save:${campaignId}@${slot}`)
/** Ручной слот, в который маршрут пишет сохранение до финала. */
const MANUAL_SLOT = 1

/** Прочитать сохранение слота и снять краткую сводку состояния для сравнения. */
async function readSave(page, campaignId, slot = 'auto') {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key)
    const keys = Object.keys(localStorage).filter((item) => item.startsWith('narthex:save:'))
    if (!raw) return { raw: null, key, keys, state: null }
    try {
      const envelope = JSON.parse(raw)
      const state = envelope.state ?? envelope
      return {
        raw,
        key,
        keys,
        bytes: raw.length,
        envelope: {
          envelope_version: envelope.envelope_version ?? null,
          save_version: envelope.save_version ?? null,
          campaign_id: envelope.campaign_id ?? null,
          campaign_version: envelope.campaign_version ?? null,
          engine_version: envelope.engine_version ?? null,
          updated_at: envelope.updated_at ?? null,
        },
        state: {
          seed: state.seed ?? null,
          tick: state.tick ?? null,
          scene: state.scene ?? null,
          location: state.location ?? null,
          region: state.region ?? null,
          hp: state.player?.hp ?? null,
          max_hp: state.player?.max_hp ?? null,
          difficulty: state.player?.difficulty ?? null,
          inventory: (state.inventory ?? []).map((item) => `${item.id}x${item.quantity ?? 1}`).sort(),
          flags: Object.keys(state.flags ?? {}).sort(),
          fired_rules: (state.fired_rules ?? []).length,
          log: (state.log ?? []).length,
          game_over: state.game_over ? String(state.game_over.type ?? state.game_over.kind ?? true) : null,
        },
      }
    } catch (error) {
      return { raw, key, keys, parseError: String(error?.message || error).slice(0, 200), state: null }
    }
  }, saveKeyOf(campaignId, slot))
}

/** Поля сводки, которые обязаны совпасть до и после reload. */
const SAVE_COMPARE_FIELDS = ['seed', 'tick', 'scene', 'location', 'region', 'hp', 'max_hp', 'inventory', 'flags', 'fired_rules', 'log', 'game_over']

/**
 * Строка ручного слота в панели «Сохранения».
 * Ищем по точному заголовку `<b>Слот N</b>`: у занятого слота описание
 * начинается с цифры, и в textContent «Слот 1» склеивается с «31.10…»,
 * поэтому граница слова в регексе не срабатывает.
 */
function slotRow(page, panel, slot) {
  return panel.locator('.save-slot-row').filter({ has: page.getByText(`Слот ${slot}`, { exact: true }) }).first()
}

/** Записать текущий забег в ручной слот через панель «Сохранения» (путь игрока). */
async function saveToSlot(page, slot = MANUAL_SLOT) {
  await page.locator('button[aria-label="Сохранения"]').first().click()
  const panel = page.locator('.side-panel').filter({ hasText: 'Сохранения' })
  await panel.waitFor({ state: 'visible', timeout: 8000 })
  const row = slotRow(page, panel, slot)
  await row.waitFor({ state: 'visible', timeout: 5000 })
  await row.getByRole('button', { name: 'Записать' }).click()
  // первая запись в пустой слот проходит без подтверждения; если слот занят —
  // панель спрашивает overwrite, и согласие тоже игрок даёт сам
  const overwrite = page.locator('.modal-box').getByRole('button', { name: 'Да', exact: true })
  if (await overwrite.waitFor({ state: 'visible', timeout: 2000 }).catch(() => null)) await overwrite.first().click()
  await row.locator('.muted.small').filter({ hasNotText: 'пусто' }).first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
  await panel.locator('.panel-header button').first().click()
  await panel.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {})
}

/**
 * Проверка сохранений — отдельный шаг после финала.
 *
 * Финал в Narthex стирает автосейв (`packs/narrative/roguelike.ts`, gameOver) и
 * запрещает запись в слот (`SavesPanel`: кнопка «Записать» заперта при game_over),
 * поэтому «сохранение после финала» — это ручной слот, записанный маршрутом до
 * финала: он обязан пережить финал и reload, а загрузка из него — вернуть те же
 * данные. Проверяется путь игрока, а не внутренние функции движка.
 */
async function runSaveExam(page, definition, addFinding) {
  const slot = await readSave(page, definition.id, MANUAL_SLOT)
  if (!slot.raw) {
    addFinding(`слот ${MANUAL_SLOT} не записан до финала: ключей narthex:save:* — ${slot.keys.length ? slot.keys.join(', ') : 'нет'}`)
    return { ok: false }
  }
  const auto = await readSave(page, definition.id)
  const finale = await step(page, `${definition.id}-13-save-after-final`, 'Сохранение слота пережило финал')
  if (/Игра столкнулась с ошибкой/i.test(finale.text)) addFinding('экран ошибки на шаге сохранения после финала')

  await page.reload({ waitUntil: 'networkidle', timeout: 45000 })
  const reloaded = await readSave(page, definition.id, MANUAL_SLOT)
  if (!reloaded.raw) {
    addFinding(`после reload слот ${MANUAL_SLOT} пропал`)
    return { ok: false }
  }
  if (reloaded.raw !== slot.raw) addFinding(`после reload сохранение слота изменилось: было ${slot.bytes} байт, стало ${reloaded.bytes}`)
  await step(page, `${definition.id}-14-reload-save`, `После reload слот ${MANUAL_SLOT} на месте`)

  // Возврат в ту же кампанию: App помнит выбор только в пределах страницы
  // (cf_last_campaign пишется, но при загрузке не читается — дефект вне зоны),
  // поэтому после reload кампанию открывает «Кампании», как это делает игрок.
  await page.getByRole('button', { name: 'Кампании', exact: true }).click()
  let rows = page.locator('.campaign-row').filter({ hasText: definition.card })
  if (definition.cardNot) rows = rows.filter({ hasNotText: definition.cardNot })
  await rows.first().locator('.campaign-card').click()
  await page.getByRole('button', { name: 'Новый забег', exact: true }).click()
  await page.waitForTimeout(350)
  for (const choice of definition.charChoices ?? []) {
    const button = page.getByRole('button', { name: choice })
    if (await button.count()) await button.first().click()
  }
  await page.getByRole('button', { name: 'Начать забег', exact: true }).click()
  await page.locator('.hud').first().waitFor({ state: 'visible', timeout: 20000 })
  // Новый забег начинается со вступления и диалога: они перекрывают HUD, и
  // «Сохранения» недоступны, пока игрок их не закроет. Это те же шаги, что в
  // начале маршрута, а не обход интерфейса.
  if (!(await dismissCutscene(page))) addFinding('не удалось закрыть вступление перед загрузкой слота')
  await dismissIntro(page)
  // Стартовый диалог нового забега закрывается ответом реплики и «Закончить
  // разговор» — ровно как в начале маршрута; пока он открыт, HUD перекрыт.
  const dialogueChoices = page.locator('.dialogue-overlay').getByRole('button', { name: /Ищу работу|Просто путник/ })
  if (await dialogueChoices.count()) {
    await dialogueChoices.first().click()
    await dismissIntro(page)
  }
  const endTalk = page.locator('.dialogue-overlay').getByRole('button', { name: /Закончить разговор/ })
  if (await endTalk.count()) await endTalk.last().click()
  await dismissMessages(page)
  await page.waitForTimeout(300)

  await page.locator('button[aria-label="Сохранения"]').first().click()
  const panel = page.locator('.side-panel').filter({ hasText: 'Сохранения' })
  await panel.waitFor({ state: 'visible', timeout: 8000 })
  const row = slotRow(page, panel, MANUAL_SLOT)
  await row.getByRole('button', { name: 'Загрузить' }).click()
  await panel.waitFor({ state: 'hidden', timeout: 8000 }).catch(() => {})
  await page.locator('.hud').first().waitFor({ state: 'visible', timeout: 15000 })
  await page.waitForTimeout(500)

  const restored = await step(page, `${definition.id}-15-save-restored`, 'Забег восстановлен из сохранения')
  if (/Игра столкнулась с ошибкой/i.test(restored.text)) addFinding('восстановленный забег показывает экран ошибки')

  // Что именно вернулось из слота — проверяем данными, а не разметкой: игрок
  // записывает восстановленный забег в соседний пустой слот, и его состояние
  // обязано совпасть со слотом 1. Автосейв для сравнения не годится: при
  // «Железном человеке» движок его не пишет (difficulty.no_autosave), а у
  // обычного забега автосейв мог остаться от забега, открытого до загрузки.
  await saveToSlot(page, MANUAL_SLOT + 1)
  const after = await readSave(page, definition.id, MANUAL_SLOT + 1)
  if (!after?.state) {
    addFinding('восстановленный забег не записался в контрольный слот: сравнивать нечего')
    return { ok: false }
  }
  const changed = SAVE_COMPARE_FIELDS.filter((field) => JSON.stringify(slot.state[field]) !== JSON.stringify(after.state[field]))
  if (changed.length) {
    const detail = changed.map((field) => `${field}: ${JSON.stringify(slot.state[field])} → ${JSON.stringify(after.state[field])}`).join('; ')
    addFinding(`данные восстановленного забега не совпали со слотом 1: ${detail}`)
  }
  // Итог проверки — одной строкой в лог экзамена: ключ, байты, состояние
  // до reload и после загрузки, чтобы отчёт цитировал факты, а не «ок».
  visualLog(
    `  [save] ${definition.id}: ${saveKeyOf(definition.id, MANUAL_SLOT)} ${slot.bytes} Б · tick ${slot.state.tick} · scene ${slot.state.scene} · hp ${slot.state.hp}/${slot.state.max_hp} · ` +
      `после reload ${reloaded.bytes} Б (байт в байт) · контрольный слот ${after.bytes} Б · расхождений ${changed.length}`,
  )
  return {
    ok: changed.length === 0,
    slotKey: saveKeyOf(definition.id, MANUAL_SLOT),
    slotBytes: slot.bytes,
    savedAt: slot.envelope?.updated_at ?? null,
    autosaveAfterFinale: auto.raw ? { key: auto.key, bytes: auto.bytes } : null,
    slotStateBeforeReload: slot.state,
    restoredState: after.state,
    controlSlotKey: saveKeyOf(definition.id, MANUAL_SLOT + 1),
    changedFields: changed,
  }
}

async function runExamPack(definition) {
  activePackId = definition.id
  activeOutDir = join(outDir, definition.id)
  mkdirSync(activeOutDir, { recursive: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  if (definition.id === 'ash-of-caerden') {
    // Seed the actual game engine through its normal Math.random-based seed
    // path. This makes the existing forest ambush reproducibly lethal for the
    // weak, valid character configured in the UI route above.
    await context.addInitScript(() => { Math.random = () => 0.5 })
  }
  const errorsBefore = errors.length
  const consoleErrorsBefore = consoleErrors.length
  const observationStart = observations.length
  const resourceFailures = []
  const knownAbsenceChecks = []
  const routeFindings = []
  let page = null
  let routeError = null
  let finalState = null
  let finalVisibleText = ''
  const addFinding = (message) => routeFindings.push(message)
  const setFinal = (state, text) => { finalState = state; finalVisibleText = text }

  try {
    page = await openPage(context)
    page.on('response', (response) => {
      const url = response.url()
      if (!url.includes(`/campaigns/${definition.id}/`)) return
      const pathname = new URL(url).pathname
      const status = response.status()
      const contentType = response.headers()['content-type']?.split(';')[0]?.trim().toLowerCase() || ''
      const expectsImage = /\.(?:avif|gif|jpe?g|png|svg|webp)$/i.test(pathname)
      const invalidImageResponse = expectsImage && !contentType.startsWith('image/')
      if (status >= 400 || invalidImageResponse) {
        resourceFailures.push({
          path: campaignRelativePath(url, definition.id),
          status,
          url,
          contentType,
          reason: status >= 400 ? `HTTP ${status}` : `expected image/*, received ${contentType || 'no content-type'}`,
        })
      }
    })
    page.on('requestfailed', (request) => {
      const url = request.url()
      const pathname = new URL(url).pathname
      if (!url.includes(`/campaigns/${definition.id}/`) || !/\.(?:avif|gif|jpe?g|png|svg|webp)$/i.test(pathname)) return
      resourceFailures.push({
        path: campaignRelativePath(url, definition.id),
        status: 'requestfailed',
        url,
        contentType: '',
        reason: `request failed: ${request.failure()?.errorText || 'unknown network error'}`,
      })
    })
    await page.goto(base, { waitUntil: 'networkidle', timeout: 45000 })
    const knownPaths = declaredAbsencesFor(definition.id)
    const probeResults = await page.evaluate(async ({ campaignId, paths }) => Promise.all(paths.map(async (path) => {
      try {
        const url = `/campaigns/${campaignId}/${path}`
        const response = await fetch(url, { cache: 'no-store', credentials: 'same-origin' })
        const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() || ''
        const reason = response.status >= 400
          ? `HTTP ${response.status}`
          : contentType.startsWith('image/') ? 'image response' : `expected image/*, received ${contentType || 'no content-type'}`
        return { path, status: response.status, contentType, reason }
      } catch (error) {
        return { path, status: 'fetch-error', contentType: '', reason: String(error?.message || error).split('\n')[0] }
      }
    })), { campaignId: definition.id, paths: knownPaths })
    knownAbsenceChecks.push(...probeResults)
    if (definition.id === 'ash-of-caerden') await runAshExamRoute(page, addFinding, setFinal)
    else await runAdventureExamRoute(page, addFinding, setFinal)
  } catch (error) {
    // Первая строка сообщения Playwright («Timeout 30000ms exceeded») не называет
    // селектор — берём и строки ожидания, иначе причина снова прячется.
    routeError = String(error?.message || error).split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 4).join(' | ').slice(0, 400)
    const relevantFailure = resourceFailures.find((failure) => /nar37-missing|scene_gates_front/i.test(failure.url)) || resourceFailures[0]
    addFinding(`ошибка маршрута: ${routeError}${relevantFailure ? `; URL ${relevantFailure.url} (${relevantFailure.reason})` : `; URL ${page?.url() || base}`}`)
  } finally {
    await context.close().catch(() => {})
  }

  const packObservations = observations.slice(observationStart)
  const packSteps = report.steps.filter((entry) => entry.pack === definition.id)
  const packErrors = errors.slice(errorsBefore)
  const packConsoleErrors = consoleErrors.slice(consoleErrorsBefore)
  const brokenImageCount = packObservations.reduce((sum, entry) => sum + (entry.brokenImages || 0), 0)
  const brokenImageSources = [...new Set(packObservations.flatMap((entry) => entry.brokenImageSources || []))]
  const emptySrcImageCount = packObservations.reduce((sum, entry) => sum + (entry.emptySrcImages || 0), 0)
  const emptySrcImageSources = [...new Set(packObservations.flatMap((entry) => entry.emptySrcImageSources || []))]
  const rawNpcIds = packObservations.reduce((sum, entry) => sum + (entry.rawNpcIds || 0), 0)
  const errorScreens = packObservations.filter((entry) => strictExamErrorScreen.test(entry.text)).length
  const startsWithEmptyCatalog = !packObservations.length || /Кампаний пока нет/i.test(packObservations[0].text)
  const knownAbsencePaths = new Set(declaredAbsencesFor(definition.id))
  const knownAbsences = knownAbsenceChecks.map((check) => ({
    ...check,
    knownAbsence: check.status === 'fetch-error' || check.status >= 400 || !check.contentType.startsWith('image/'),
    servedAsImage: String(check.contentType || '').toLowerCase().startsWith('image/'),
  }))
  const blockingResourceFailures = [...new Map(
    resourceFailures
      .filter((failure) => isBlockingCampaignResponseFailure(failure) && !knownAbsencePaths.has(failure.path))
      .map((failure) => [failure.url, failure]),
  ).values()]

  // Объявленный путь, который внезапно начал отдаваться картинкой, — устаревшая
  // декларация, а не успех: фикстура перестала соответствовать данным.
  for (const stale of knownAbsences.filter((absence) => absence.servedAsImage)) {
    addFinding(`объявленный отсутствующим путь отдаётся как изображение: ${stale.path} (${stale.contentType})`)
  }
  if (knownAbsences.some((absence) => absence.status === 'fetch-error')) {
    addFinding(`не удалось получить статус известного image path: ${knownAbsences.filter((absence) => absence.status === 'fetch-error').map((absence) => absence.path).join(', ')}`)
  }
  if (packSteps.length < 8) addFinding(`снято ${packSteps.length} шагов, требуется не менее 8`)
  if (packErrors.length) addFinding(`pageerror: ${packErrors.length} (${packErrors[0].slice(0, 180)})`)
  if (errorScreens) addFinding(`экранов ошибки: ${errorScreens}`)
  if (brokenImageCount) addFinding(`битых <img>: ${brokenImageCount}; URL: ${brokenImageSources.slice(0, 5).join(', ') || 'источник не определён'}`)
  if (emptySrcImageCount) addFinding(`пустых src у <img>: ${emptySrcImageCount}; URL: ${emptySrcImageSources.slice(0, 5).join(', ') || '(empty src)'}`)
  if (rawNpcIds) addFinding(`сырых NPC id: ${rawNpcIds}`)
  if (startsWithEmptyCatalog) addFinding('стартовый экран показывает «Кампаний пока нет»')
  if (blockingResourceFailures.length) {
    const urls = blockingResourceFailures.map((failure) => `${failure.status} ${failure.url} (${failure.reason})`)
    addFinding(`ошибки обязательных ресурсов кампании: ${blockingResourceFailures.length}; ${urls.slice(0, 5).join(' | ')}`)
  }
  if (!finalState) addFinding('финальный экран не достигнут')
  if (definition.id === 'ash-of-caerden-adventure' && finalState && finalState !== 'ending_gate_unlocked') {
    addFinding(`ожидался ending_gate_unlocked, получено ${finalState}`)
  }
  for (const finding of routeFindings) report.findings.push(`${definition.id}: ${finding}`)

  const result = {
    id: definition.id,
    steps: packSteps.length,
    pageErrors: packErrors.length,
    errorScreens,
    brokenImgOccurrences: brokenImageCount,
    brokenImageSources,
    emptySrcImgOccurrences: emptySrcImageCount,
    emptySrcImageSources,
    rawNpcIds,
    startsWithEmptyCatalog,
    knownAbsences,
    consoleErrors: packConsoleErrors,
    failedCampaignResponses: blockingResourceFailures,
    nonBlockingCampaignResponses: resourceFailures.filter((failure) => !knownAbsencePaths.has(failure.path) && !isBlockingCampaignResponseFailure(failure)),
    finalState: finalState || 'not-reached',
    finalVisibleText,
    finalFrame: packSteps.findLast((entry) => /ending/.test(entry.name))?.file || null,
    routeError,
    findings: routeFindings,
    ok: routeFindings.length === 0,
  }
  return result
}

async function runBrowserExam() {
  recordSteps = true
  report.mode = adventureOnly ? 'strict-single-pack-real-browser-exam' : 'strict-two-pack-real-browser-exam'
  report.fixtureRoot = fixtureRoot || 'public/campaigns'
  report.thresholds = {
    packs: adventureOnly ? ['ash-of-caerden-adventure'] : ['ash-of-caerden', 'ash-of-caerden-adventure'],
    minimumStepsPerPack: 8,
    pageErrors: 0,
    errorScreens: 0,
    brokenImages: 0,
    emptySrcImages: 0,
    rawNpcIds: 0,
    emptyCatalogAtStart: false,
    declaredAbsences: 'dev-fixture.json → known_absent_images (D-076)',
    adventureFinal: 'ending_gate_unlocked',
    ashFinal: 'visible end screen with campaign ending id when identifiable',
  }
  visualLog('NAR-3.7 strict real-browser exam')
  visualLog(`Base URL: ${base}`)
  visualLog(`Browser: ${engine}`)
  visualLog(`Fixture root: ${report.fixtureRoot}`)
  const allDefinitions = [
    { id: 'ash-of-caerden', card: /Пепел Каэрдена/i, cardNot: /adventure/i, title: /Пепел Каэрдена/i, charChoices: [/Посланник/, /Торговец/] },
    { id: 'ash-of-caerden-adventure', card: /проект adventure/i, title: /проект adventure/i, charChoices: [/Солдат/, /Наёмник/] },
  ]
  const definitions = adventureOnly ? allDefinitions.filter((definition) => definition.id === 'ash-of-caerden-adventure') : allDefinitions
  report.packs = []
  for (const definition of definitions) {
    visualLog(`\n--- ${definition.id} ---`)
    const result = await runExamPack(definition)
    report.packs.push(result)
    visualLog(`${result.ok ? 'PASS' : 'FAIL'} ${result.id}: steps=${result.steps}; pageerror=${result.pageErrors}; errorScreens=${result.errorScreens}; brokenImg=${result.brokenImgOccurrences}; emptySrcImg=${result.emptySrcImgOccurrences}; rawNpcIds=${result.rawNpcIds}; emptyStart=${result.startsWithEmptyCatalog}`)
    visualLog(`  finalState=${result.finalState}`)
    visualLog(`  finalFrame=${result.finalFrame || 'not captured'}`)
    for (const absence of result.knownAbsences) {
      visualLog(`  known-absence=${absence.path}; status=${absence.status}; content-type=${absence.contentType || 'none'}; ${absence.reason}`)
    }
    for (const finding of result.findings) visualLog(`  finding=${finding}`)
    for (const failure of result.failedCampaignResponses.slice(0, 5)) visualLog(`  resource=${failure.path} status=${failure.status} ${failure.url} (${failure.reason})`)
    for (const consoleError of result.consoleErrors) visualLog(`  console-error=${consoleError}`)
  }
  report.ok = report.packs.length === definitions.length && report.packs.every((pack) => pack.ok)
  report.pageErrors = report.packs.reduce((sum, pack) => sum + pack.pageErrors, 0)
  report.errorScreens = report.packs.reduce((sum, pack) => sum + pack.errorScreens, 0)
  report.brokenImgOccurrences = report.packs.reduce((sum, pack) => sum + pack.brokenImgOccurrences, 0)
  report.emptySrcImgOccurrences = report.packs.reduce((sum, pack) => sum + pack.emptySrcImgOccurrences, 0)
  report.rawNpcIds = report.packs.reduce((sum, pack) => sum + pack.rawNpcIds, 0)
  report.finishedAt = new Date().toISOString()
  visualLog(`\nRESULT: ${report.ok ? 'PASS' : 'FAIL'}; packs=${report.packs.length}; steps=${report.steps.length}; findings=${report.findings.length}`)
  report.findings.forEach((finding) => visualLog(`  finding=${finding}`))
  writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2) + '\n')
  writeFileSync(join(outDir, 'exam.stdout.txt'), examOutputLines.join('\n') + '\n')
  const table = [
    '| Pack | Steps | pageerror | Error screens | Broken img | Empty-src img | Raw NPC ids | Empty catalog | Final state | Known absences (path/status) | Findings | Result |',
    '|---|---:|---:|---:|---:|---:|---:|---|---|---|---|---|',
    ...report.packs.map((pack) => {
      const known = pack.knownAbsences.map((absence) => `${absence.path} — ${absence.status} (${absence.contentType || 'no content-type'})`).join('<br>') || 'none'
      const findings = pack.findings.map((finding) => finding.replaceAll('|', '&#124;')).join('<br>') || 'none'
      return `| ${pack.id} | ${pack.steps} | ${pack.pageErrors} | ${pack.errorScreens} | ${pack.brokenImgOccurrences} | ${pack.emptySrcImgOccurrences} | ${pack.rawNpcIds} | ${pack.startsWithEmptyCatalog ? 'yes' : 'no'} | ${pack.finalState} | ${known} | ${findings} | ${pack.ok ? 'PASS' : 'FAIL'} |`
    }),
  ]
  const markdown = [
    '# NAR-3.7 — строгий экзамен кампаний в браузере', '',
    `- Дата: ${new Date().toISOString()}`,
    `- URL: ${base}`,
    `- Браузер: ${engine}`,
    `- Каталог fixture: ${report.fixtureRoot}`,
    `- Итог: **${report.ok ? 'PASS' : 'FAIL'}**`, '',
    ...table, '',
    '## Финалы', '',
    ...report.packs.map((pack) => `- **${pack.id}:** \`${pack.finalState}\`; кадр: \`${pack.finalFrame || 'не снят'}\`. ${pack.finalVisibleText.replace(/\s+/g, ' ').slice(0, 500)}`), '',
    '## Известные намеренные отсутствия изображений', '',
    ...report.packs.flatMap((pack) => pack.knownAbsences.map((absence) => `- ${pack.id}: \`${absence.path}\` — status=\`${absence.status}\`, content-type=\`${absence.contentType || 'none'}\`; ${absence.reason}`)), '',
    '## Неожиданные ошибки ресурсов кампаний', '',
    ...report.packs.flatMap((pack) => pack.failedCampaignResponses.length
      ? pack.failedCampaignResponses.map((failure) => `- ${pack.id}: \`${failure.path}\` — ${failure.status} ${failure.url} — ${failure.reason}`)
      : [`- ${pack.id}: нет`]), '',
    '## console.error (не подавлялись)', '',
    ...report.packs.flatMap((pack) => pack.consoleErrors.length
      ? pack.consoleErrors.map((message) => `- ${pack.id}: ${message.replaceAll('|', '&#124;')}`)
      : [`- ${pack.id}: нет`]), '',
    '## Находки', '',
    ...(report.findings.length ? report.findings.map((finding) => `- ${finding}`) : ['- нет']), '',
    '## Снятые шаги', '',
    '| Pack | Шаг | Кадр |', '|---|---|---|',
    ...report.steps.map((entry) => `| ${entry.pack} | ${entry.label} | ${relative(outDir, entry.file)} |`), '',
  ].join('\n')
  writeFileSync(join(outDir, 'report.md'), markdown)
  await browser.close()
  process.exit(report.ok ? 0 : 1)
}

if (examMode) {
  await runBrowserExam()
}

if (!examMode && !adventureOnly) {
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
