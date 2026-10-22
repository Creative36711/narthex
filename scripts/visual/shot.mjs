#!/usr/bin/env node
/**
 * Универсальный «посмотреть страницу» — для любой роли, не только визуальной.
 *
 *   node scripts/visual/shot.mjs <url> [out.png] [опции]
 *
 * Опции:
 *   --size 1440x900     размер окна (по умолчанию 1440x900)
 *   --full              снимок всей страницы, а не первого экрана
 *   --wait 1500         пауза после загрузки, мс
 *   --text              напечатать видимый текст страницы (без скриншота)
 *   --console           печатать ошибки консоли и страницы
 *   --click "<селектор>"  кликнуть перед снимком
 *   --eval "<js>"       выполнить выражение и напечатать результат
 *
 * Код возврата: 0 — страница открылась, 1 — ошибки в консоли/на странице,
 * 2 — браузер не поднялся (нет пакетов; см. docs/agents/browser.md).
 *
 * Примеры:
 *   node scripts/visual/shot.mjs http://localhost:4173 out/home.png --full
 *   node scripts/visual/shot.mjs http://localhost:4173/#editor out/editor.png --click "text=Создать кампанию"
 *   node scripts/visual/shot.mjs http://localhost:4173 --text --console
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const argv = process.argv.slice(2);
const flag = (name, fallback = undefined) => {
  const i = argv.indexOf(name);
  if (i === -1) return fallback;
  const next = argv[i + 1];
  const value = next && !next.startsWith('--') ? next : true;
  if (value !== true) argv.splice(i, 2);
  else argv.splice(i, 1);
  return value;
};

const size = String(flag('--size', '1440x900')).split('x').map(Number);
const fullPage = Boolean(flag('--full', false));
const waitMs = Number(flag('--wait', 1200));
const wantText = Boolean(flag('--text', false));
const wantConsole = Boolean(flag('--console', false));
const clickSelector = flag('--click');
const evalJs = flag('--eval');

const positional = argv.filter((a) => !a.startsWith('--'));
const url = positional[0];
const outPath = positional[1] || 'out/shot.png';

if (!url) {
  console.error('Нужен адрес: node scripts/visual/shot.mjs <url> [out.png]');
  process.exit(2);
}

let browser;
let engine = 'unknown';
try {
  const { launchChromium, chromiumVersion } = await import('./local-browser.mjs');
  browser = await launchChromium();
  engine = chromiumVersion();
} catch (error) {
  console.error('Браузер не поднялся:', String(error.message).split('\n')[0]);
  console.error('Установка: npm i --no-save @sparticuz/chromium@131 playwright-core@1.49.1');
  console.error('Полная инструкция: docs/agents/browser.md');
  process.exit(2);
}

const context = await browser.newContext({
  viewport: { width: size[0] || 1440, height: size[1] || 900 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();

const problems = [];
page.on('pageerror', (e) => problems.push(`pageerror: ${String(e).slice(0, 300)}`));
page.on('console', (m) => {
  if (m.type() === 'error') problems.push(`console: ${m.text().slice(0, 300)}`);
});
page.on('requestfailed', (r) => problems.push(`requestfailed: ${r.method()} ${r.url().slice(0, 160)}`));

let status = 0;
try {
  const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 45_000 });
  await page.waitForTimeout(waitMs);

  if (clickSelector) {
    await page.locator(clickSelector).first().click({ timeout: 15_000 });
    await page.waitForTimeout(800);
  }

  if (evalJs) {
    const value = await page.evaluate(String(evalJs));
    console.log('eval:', JSON.stringify(value, null, 1));
  }

  if (wantText) {
    const text = await page.evaluate(() => document.body.innerText.replace(/\n{3,}/g, '\n\n').trim());
    console.log(text.slice(0, 4000));
  } else {
    mkdirSync(dirname(outPath), { recursive: true });
    await page.screenshot({ path: outPath, fullPage });
    writeFileSync(`${outPath}.txt`, await page.title());
    console.log(`Снимок: ${outPath} (${engine})`);
  }

  console.log(`HTTP ${response?.status() ?? '—'} · ${await page.title()} · ${size[0]}×${size[1]}`);
} catch (error) {
  console.error('Не удалось открыть страницу:', String(error.message).split('\n')[0]);
  status = 1;
}

if (problems.length) {
  status = 1;
  if (wantConsole || !wantText) {
    console.error(`Проблем на странице: ${problems.length}`);
    for (const p of problems.slice(0, 20)) console.error('  •', p);
  }
} else if (wantConsole) {
  console.log('Ошибок в консоли нет.');
}

await context.close();
await browser.close();
process.exit(status);
