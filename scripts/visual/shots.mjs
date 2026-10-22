/**
 * Пиксельная проверка интерфейса: снимки экранов и машинные утверждения.
 *
 * Запуск (нужен браузер):
 *   node scripts/visual/shots.mjs http://localhost:4173 out/visual
 *
 * В песочнице агента браузер не запускается (нет libnss3/libnspr4, нет root),
 * поэтому этот скрипт рассчитан на CI: .github/workflows/visual.yml поднимает
 * Playwright с зависимостями и складывает снимки в артефакты. Локально он
 * честно падает с кодом 2 и объясняет, чего не хватает, — а не молча врёт.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const base = process.argv[2] || 'http://localhost:4173';
const outDir = process.argv[3] || 'out/visual';

/** Экраны, которые обязаны существовать. Порядок — от пустого состояния к работе. */
const states = [
  { name: 'home', path: '/', waitMs: 1200 },
  { name: 'editor', path: '/#editor', waitMs: 2500 },
];

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('Нет пакета playwright. Установите: npm i --no-save playwright && npx playwright install --with-deps chromium');
  process.exit(2);
}

mkdirSync(outDir, { recursive: true });
const report = { base, startedAt: new Date().toISOString(), states: [], ok: true };

let browser;
try {
  browser = await chromium.launch();
} catch (error) {
  console.error('Браузер не запускается в этом окружении:', error.message.split('\n')[0]);
  console.error('Это ожидаемо в песочнице: снимки делает CI (см. docs/agents/visual.md).');
  process.exit(2);
}

const viewports = [
  { label: 'desktop', width: 1440, height: 900 },
  { label: 'narrow', width: 900, height: 900 },
];

for (const state of states) {
  for (const vp of viewports) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    const failedRequests = [];
    page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text().slice(0, 300)));
    page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 300)));
    page.on('requestfailed', (r) => failedRequests.push(`${r.method()} ${r.url().slice(0, 160)}`));

    const name = `${state.name}-${vp.label}`;
    const entry = { name, url: base + state.path, consoleErrors, pageErrors, failedRequests };

    try {
      await page.goto(base + state.path, { waitUntil: 'networkidle', timeout: 45_000 });
      await page.waitForTimeout(state.waitMs);

      await page.screenshot({ path: join(outDir, `${name}.png`), fullPage: true });

      entry.title = await page.title();
      entry.metrics = await page.evaluate(() => {
        const root = document.documentElement;
        const body = document.body;
        const overflowX = Math.max(root.scrollWidth, body.scrollWidth) - root.clientWidth;
        const text = getComputedStyle(body).color;
        const bg = getComputedStyle(body).backgroundColor;
        const controls = [...document.querySelectorAll('button, a[href], input, select, textarea')];
        const unnamed = controls.filter((el) => {
          const style = getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden') return false;
          const label =
            (el.getAttribute('aria-label') || '') +
            (el.getAttribute('title') || '') +
            (el.textContent || '');
          return label.trim().length === 0;
        }).length;
        const imagesWithoutAlt = [...document.querySelectorAll('img')].filter((i) => !i.getAttribute('alt')).length;
        return {
          overflowX: Math.max(0, overflowX),
          controls: controls.length,
          controlsWithoutName: unnamed,
          imagesWithoutAlt,
          fontFamily: getComputedStyle(body).fontFamily,
          textColor: text,
          backgroundColor: bg,
        };
      });

      // Машинные утверждения: их видно в CI без «посмотреть глазами».
      entry.findings = [];
      if (entry.metrics.overflowX > 1) entry.findings.push(`горизонтальная прокрутка: ${entry.metrics.overflowX}px`);
      if (entry.metrics.controlsWithoutName > 0) entry.findings.push(`элементов без доступного имени: ${entry.metrics.controlsWithoutName}`);
      if (entry.metrics.imagesWithoutAlt > 0) entry.findings.push(`изображений без alt: ${entry.metrics.imagesWithoutAlt}`);
      if (pageErrors.length) entry.findings.push(`ошибок страницы: ${pageErrors.length}`);
      if (consoleErrors.length) entry.findings.push(`ошибок в консоли: ${consoleErrors.length}`);
      entry.ok = entry.findings.length === 0;
      if (!entry.ok) report.ok = false;
    } catch (error) {
      entry.ok = false;
      entry.findings = [`экран не открылся: ${String(error.message).split('\n')[0]}`];
      report.ok = false;
    } finally {
      await context.close();
    }
    report.states.push(entry);
    console.log(`${entry.ok ? '✓' : '✗'} ${name}${entry.findings?.length ? ' — ' + entry.findings.join('; ') : ''}`);
  }
}

await browser.close();
report.finishedAt = new Date().toISOString();
writeFileSync(join(outDir, 'visual-report.json'), JSON.stringify(report, null, 2) + '\n');

const md = [
  '# Пиксельная проверка',
  '',
  `Основа: ${base}`,
  '',
  '| Экран | Итог | Находки |',
  '|---|---|---|',
  ...report.states.map((s) => `| ${s.name} | ${s.ok ? 'ok' : 'fail'} | ${(s.findings || []).join('; ') || '—'} |`),
  '',
].join('\n');
writeFileSync(join(outDir, 'visual-report.md'), md);

process.exit(report.ok ? 0 : 1);
