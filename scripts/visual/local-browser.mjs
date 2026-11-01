/**
 * Настоящий Chromium в песочнице агента — без root, без системных пакетов
 * и без `npx playwright install`.
 *
 * Почему это работает. Playwright качает браузер с cdn.playwright.dev, а
 * `--with-deps` ставит ~20 системных пакетов через apt (нужен root). Оба пути
 * в песочнице закрыты. Но пакет `@sparticuz/chromium` (сборка Chromium для
 * AWS Lambda) кладёт рядом с бинарником ещё и `al2023.tar.br` — архив с
 * ровно теми библиотеками, которых не хватает на минимальном Debian:
 * libnss3, libnspr4, libnssutil3, libfreebl3, libsoftokn3, libplc4, libplds4,
 * libexpat. Достаточно распаковать оба архива и выставить LD_LIBRARY_PATH.
 *
 * Установка (один раз за ход, ~5 с):
 *   npm i --no-save @sparticuz/chromium@131 playwright-core@1.49.1
 *
 * Использование:
 *   import { launchChromium } from './local-browser.mjs';
 *   const browser = await launchChromium();
 */

import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
import { spawnSync } from 'node:child_process';
import { brotliDecompressSync } from 'node:zlib';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const PKG = '@sparticuz/chromium';
const CACHE = join(tmpdir(), 'cf-browser');

function resolvePackageDir() {
  const require = createRequire(import.meta.url);
  const candidates = [];
  try {
    candidates.push(join(require.resolve(`${PKG}/package.json`), '..'));
  } catch {
    /* exports могут запрещать package.json — идём по путям */
  }
  candidates.push(
    join(process.cwd(), 'node_modules', PKG),
    join(import.meta.dirname, '..', '..', 'node_modules', PKG),
  );
  for (const dir of candidates) if (dir && existsSync(join(dir, 'bin', 'chromium.br'))) return dir;
  throw new Error(
    `Не найден пакет ${PKG}. Установите: npm i --no-save ${PKG}@131 playwright-core@1.49.1`,
  );
}

/** Распаковывает браузер и библиотеки NSS в кэш и возвращает путь к бинарнику. */
export function ensureChromium() {
  const exe = join(CACHE, 'chromium');
  const lib = join(CACHE, 'lib');
  if (existsSync(exe) && existsSync(join(lib, 'libnss3.so'))) return { exe, lib };

  const pkg = resolvePackageDir();
  mkdirSync(CACHE, { recursive: true });

  const chromiumBr = join(pkg, 'bin', 'chromium.br');
  writeFileSync(exe, brotliDecompressSync(readFileSync(chromiumBr)));
  chmodSync(exe, 0o755);

  for (const layer of ['al2023.tar.br', 'al2.tar.br']) {
    const src = join(pkg, 'bin', layer);
    if (!existsSync(src)) continue;
    const tarPath = join(CACHE, layer.replace(/\.br$/, ''));
    writeFileSync(tarPath, brotliDecompressSync(readFileSync(src)));
    // В архиве уже есть префикс lib/ — распаковываем в корень кэша.
    const res = spawnSync('tar', ['-xf', tarPath, '-C', CACHE], { stdio: 'inherit' });
    if (res.status !== 0) throw new Error(`tar не распаковал ${layer}`);
    break; // al2023 достаточно: glibc в песочнице новее
  }
  if (!existsSync(join(lib, 'libnss3.so'))) throw new Error('В слое нет libnss3.so — проверьте версию пакета');
  return { exe, lib };
}

/**
 * Запускает Chromium. Возвращает объект браузера Playwright.
 * @param {{ args?: string[], timezoneId?: string, locale?: string }} [opts]
 */
export async function launchChromium(opts = {}) {
  const preparationStartedAt = performance.now();
  console.log('NAR browser binary/library preparation: start.');
  const { exe, lib } = ensureChromium();
  console.log(`NAR browser binary/library preparation: ${(performance.now() - preparationStartedAt).toFixed(1)} ms.`);

  let chromium;
  try {
    ({ chromium } = await import('playwright-core'));
  } catch {
    throw new Error('Нет playwright-core. Установите: npm i --no-save @sparticuz/chromium@131 playwright-core@1.49.1');
  }

  console.log('NAR Chromium process launch: start.');
  const launchStartedAt = performance.now();
  const browser = await chromium.launch({
    executablePath: exe,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--hide-scrollbars',
      '--font-render-hinting=none',
      ...(opts.args || []),
    ],
    env: { ...process.env, LD_LIBRARY_PATH: [lib, process.env.LD_LIBRARY_PATH].filter(Boolean).join(':') },
    timezoneId: opts.timezoneId,
    locale: opts.locale,
  });
  console.log(`NAR Chromium process launch: ${(performance.now() - launchStartedAt).toFixed(1)} ms.`);
  return browser;
}

/** Версия браузера — для отчёта («снято Chromium X»). */
export function chromiumVersion() {
  const { exe, lib } = ensureChromium();
  const res = spawnSync(exe, ['--version'], {
    encoding: 'utf8',
    env: { ...process.env, LD_LIBRARY_PATH: lib },
  });
  return (res.stdout || '').trim() || 'chromium (версия неизвестна)';
}
