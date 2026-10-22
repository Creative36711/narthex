/**
 * Страж ребрендинга: старое имя не возвращается.
 *
 * Проверяет не «есть ли слово Narthex», а отсутствие брендовых следов
 * Chronicle Forge. Игровые понятия («Хроника», `panel:chronicle`, категория
 * кодекса `chronicles`, id профиля `forge`) — законны и здесь не запрещены:
 * их смешение с брендом как раз и было главным риском слепой замены.
 *
 *   npm run check:brand
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'out', 'target', '.vite', 'coverage',
  '_ai-temp', // сторонняя кампания: её содержимое не наше дело
]);
const SKIP_FILES = new Set(['package-lock.json', 'Cargo.lock']);

/** Брендовые следы: любое появление означает, что переименование откатили. */
const BRAND_PATTERNS = [
  { re: /chronicle-forge:(?![\w-]*world)/i, what: 'ключ localStorage старого бренда' },
  { re: /chronicle-compat|chronicle-inventory/i, what: 'формат обмена старого бренда' },
  { re: /app\.chronicleforge/i, what: 'идентификатор приложения старого бренда' },
  { re: /Chronicle Forge/, what: 'старое имя продукта' },
  { re: /(?<![\w-])chronicle-forge(?![\w-])/, what: 'старое имя пакета/репозитория' },
  { re: /\.chronicle(?![\w/])/, what: 'старое расширение пакета' },
  { re: /\.cfsave/, what: 'старое расширение сохранения' },
];

/**
 * Исключения — места, где старое имя законно:
 *  - accept="…" — фильтр выбора файла: старое расширение рядом с новым;
 *  - ADR 0001 — исторический документ, описывает решённое;
 *  - этот страж и его собственные образцы.
 */
const ALLOW = [
  { file: 'docs/contracts/adr/0001-platform-name.md' },
  { file: 'scripts/brand-guard.mts' },
];
const ALLOW_LINE = [/accept="/, /\.nxsave,\.cfsave/];

const files = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (!SKIP_FILES.has(name)) files.push(full);
  }
}
walk(ROOT);

const hits = [];
for (const file of files) {
  const rel = relative(ROOT, file).split('\\').join('/');
  if (ALLOW.some((a) => rel === a.file)) continue;
  if (!/\.(ts|tsx|mts|js|mjs|gs|json|md|css|toml|yml|yaml|html)$/.test(rel)) continue;
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');
  lines.forEach((line, index) => {
    if (ALLOW_LINE.some((re) => re.test(line))) return;
    for (const { re, what } of BRAND_PATTERNS) {
      if (re.test(line)) hits.push(`${rel}:${index + 1} — ${what}: ${line.trim().slice(0, 110)}`);
    }
  });
}

if (hits.length) {
  console.error(`✗ найдены следы старого бренда: ${hits.length}`);
  for (const hit of hits.slice(0, 40)) console.error('  ' + hit);
  if (hits.length > 40) console.error(`  … ещё ${hits.length - 40}`);
  console.error('\nЕсли появление законно — добавьте исключение в scripts/brand-guard.mts.');
  process.exit(1);
}

console.log(`✓ старое имя не встречается (проверено файлов: ${files.length})`);
