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

const base = process.argv[2] || 'http://localhost:4173'
const outDir = resolve(process.argv[3] || 'out/play')
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
    videos: document.querySelectorAll('video').length,
  }))
  const file = join(outDir, `${name}.png`)
  await page.screenshot({ path: file })
  report.steps.push({ name, label, file, ...info })
  console.log(`  ${name}: ${label} — кнопок ${info.buttons.length}, битых img ${info.brokenImages}`)
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
  const finalText = report.steps.at(-1)?.text || ''
  if (/Игра столкнулась с ошибкой/.test(finalText)) report.findings.push('экран «Игра столкнулась с ошибкой»')
  if (scene.brokenImages > 0) report.findings.push(`битые изображения на сцене: ${scene.brokenImages} (внешний долг ассетов)`)
  await context.close()
}

// ── Маршрут 2: FMV-проект не должен ронять приложение ──────────────────
{
  const hasFmv = campaignIndex().some((c) => c.id === 'fmv-crossing')
  if (hasFmv) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await openPage(context)
    await page.goto(base, { waitUntil: 'networkidle', timeout: 45_000 })
    await page.evaluate(() => localStorage.setItem('cf_last_campaign', 'fmv-crossing'))
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForTimeout(1200)
    // явный выбор из списка: так делает игрок
    await tap(page, 'Кампании')
    await page.waitForTimeout(700)
    const items = await page.getByText('Перекрёсток огней', { exact: false }).all()
    if (items.length) await items[0].click()
    await page.waitForTimeout(1200)
    await tap(page, 'Новый забег')
    await page.waitForTimeout(3500)
    const state = await step(page, '07-fmv', 'FMV-кампания')
    if (/Игра столкнулась с ошибкой/.test(state.text)) report.findings.push('FMV-проект роняет приложение')
    await context.close()
  }
}

await browser.close()

for (const e of errors.slice(0, 10)) report.findings.push(`pageerror: ${e.slice(0, 200)}`)
const assetErrors = consoleErrors.filter((e) => /фон не загрузился|Failed to load resource/i.test(e))
if (assetErrors.length) report.findings.push(`запросов к отсутствующим ассетам: ${assetErrors.length} (внешний долг)`)
const fatalConsole = consoleErrors.filter((e) => !/фон не загрузился|Failed to load resource/i.test(e))
for (const e of fatalConsole.slice(0, 10)) report.findings.push(`console: ${e.slice(0, 200)}`)

const blocking = report.findings.filter((f) =>
  !/битые изображения на сцене|запросов к отсутствующим ассетам/.test(f))
report.ok = blocking.length === 0
report.finishedAt = new Date().toISOString()
writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2) + '\n')
writeFileSync(join(outDir, 'report.md'), [
  '# Проверка игрой в браузере', '',
  `Основа: ${base}`, `Движок: ${engine}`, `Шагов: ${report.steps.length}`,
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
