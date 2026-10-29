/**
 * Версия движка: один источник, механическая проверка, явное поднятие.
 *
 *   npm run check:version          — согласованы ли все номера
 *   npm run version:bump minor     — поднять версию во всех местах сразу
 *
 * Зачем отдельный скрипт, а не «помнить»: версия живёт в четырёх файлах
 * (package.json, package-lock.json, Cargo.toml, tauri.conf.json) и ещё в
 * гайде для ИИ. Рассинхронизация не падает — она просто врёт, а врущая
 * версия хуже отсутствующей: по ней кампании объявляют `min_engine`.
 *
 * Политика — `docs/contracts/adr/0005-versioning.md`.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

type Level = 'major' | 'minor' | 'patch';

const PATHS = {
  pkg: 'package.json',
  lock: 'package-lock.json',
  cargo: 'src-tauri/Cargo.toml',
  tauri: 'src-tauri/tauri.conf.json',
  guide: 'docs/ai-campaign-guide.md',
  playkit: 'docs/playkit.md',
  changelog: 'CHANGELOG.md',
};

const read = (p: string) => readFileSync(p, 'utf8');
const readJson = (p: string) => JSON.parse(read(p)) as Record<string, unknown>;

const pkgVersion = (): string => String(readJson(PATHS.pkg).version ?? '');

/** Версия из `[package]` в Cargo.toml: первая строка `version = "…"`. */
function cargoVersion(): string {
  const match = read(PATHS.cargo).match(/^version\s*=\s*"([^"]+)"/m);
  return match ? match[1] : '';
}

/**
 * Версия Tauri: либо строка semver, либо путь к package.json — Tauri 2
 * официально поддерживает оба варианта, и путь предпочтителен, потому что
 * убирает одно место ручной правки.
 */
function tauriVersion(): { value: string; resolved: string } {
  const raw = String(readJson(PATHS.tauri).version ?? '');
  if (!/^\d+\.\d+\.\d+/.test(raw)) {
    const target = resolve(dirname(PATHS.tauri), raw);
    const resolved = existsSync(target)
      ? String((JSON.parse(read(target)) as { version?: string }).version ?? '')
      : `не найден: ${target}`;
    return { value: raw, resolved };
  }
  return { value: raw, resolved: raw };
}

function lockVersion(): string {
  const lock = readJson(PATHS.lock) as { packages?: Record<string, { version?: string }> };
  return String(lock.packages?.['']?.version ?? '');
}

/** Строка гайда, которую обязан видеть ИИ: «Сейчас движок этой версии гайда — `x.y.z`». */
function guideVersion(): string {
  const match = read(PATHS.guide).match(/Сейчас движок этой версии гайда — `([^`]+)`/);
  return match ? match[1] : '';
}

function changelogHas(version: string): boolean {
  if (!existsSync(PATHS.changelog)) return false;
  return new RegExp(`^##\\s*\\[?${version.replace(/\./g, '\\.')}\\]?`, 'm').test(read(PATHS.changelog));
}

function check(): number {
  const version = pkgVersion();
  const tauri = tauriVersion();
  const problems: string[] = [];

  if (!/^\d+\.\d+\.\d+$/.test(version)) problems.push(`package.json: версия «${version}» не semver`);
  if (cargoVersion() !== version) problems.push(`Cargo.toml: ${cargoVersion() || 'нет'} ≠ package.json ${version}`);
  if (!/^\d+\.\d+\.\d+/.test(tauri.value) && !tauri.value.endsWith('package.json'))
    problems.push(`tauri.conf.json: version «${tauri.value}» — ни semver, ни путь к package.json`);
  if (tauri.resolved !== version) problems.push(`tauri.conf.json: ${tauri.resolved} ≠ ${version}`);
  if (lockVersion() !== version) problems.push(`package-lock.json: ${lockVersion()} ≠ ${version}`);
  if (guideVersion() !== version) problems.push(`docs/ai-campaign-guide.md: «${guideVersion() || 'нет строки'}» ≠ ${version}`);
  if (!changelogHas(version)) problems.push(`CHANGELOG.md: нет записи ## ${version}`);

  if (problems.length) {
    console.error(`✗ версия ${version} согласована не везде:`);
    for (const p of problems) console.error(`  - ${p}`);
    console.error('\nИсправить: npm run version:bump patch|minor|major');
    return 1;
  }
  console.log(`✓ версия ${version} согласована: package.json, lock, Cargo.toml, Tauri (${tauri.value}), гайд, CHANGELOG`);
  return 0;
}

function bump(level: Level): number {
  const current = pkgVersion();
  const [major, minor, patch] = current.split('.').map(Number);
  const next =
    level === 'major' ? `${major + 1}.0.0`
    : level === 'minor' ? `${major}.${minor + 1}.0`
    : `${major}.${minor}.${patch + 1}`;

  // npm правит package.json и package-lock.json сам; коммит и тег делает агент,
  // а не npm — иначе в истории появится коммит с чужим автором и без проверок.
  execFileSync('npm', ['version', next, '--no-git-tag-version', '--allow-same-version'], {
    stdio: 'inherit',
  });

  const cargo = read(PATHS.cargo);
  const updated = cargo.replace(/^version\s*=\s*"[^"]+"/m, `version = "${next}"`);
  if (updated === cargo) throw new Error('в Cargo.toml не нашлась строка version');
  writeFileSync(PATHS.cargo, updated);

  // Заявление о версии и все примеры с прежним номером — иначе в гайде
  // останутся копипастные `"engine_version": "старая"`, и ИИ будет их повторять.
  const guide = read(PATHS.guide);
  if (!guide.includes(`Сейчас движок этой версии гайда — \`${current}\``))
    throw new Error('в гайде не нашлась строка «Сейчас движок этой версии гайда» с прежней версией');
  writeFileSync(
    PATHS.guide,
    guide.replace(/(Сейчас движок этой версии гайда — `)[^`]+(`)/, `$1${next}$2`).split(current).join(next),
  );

  const playkit = read(PATHS.playkit);
  const playkitUpdated = playkit.split(current).join(next);
  if (playkitUpdated !== playkit) writeFileSync(PATHS.playkit, playkitUpdated);

  console.log(`\n${current} → ${next}`);
  console.log('Осталось вручную (скрипт не выдумывает содержание):');
  console.log(`  1. Добавить в CHANGELOG.md запись «## ${next} — <дата>» со списком изменений.`);
  console.log('  2. Пересобрать бандлы: npm run build:playkit-bundle && npm run build:ai-bundle && npm run generate:campaign-schema');
  console.log('  3. npm run check:version');
  return 0;
}

const [, , command, arg] = process.argv;
if (command === 'check') process.exit(check());
if (command === 'bump') {
  const level = (arg ?? '') as Level;
  if (!['major', 'minor', 'patch'].includes(level)) {
    console.error('Использование: tsx scripts/version.mts bump major|minor|patch');
    process.exit(2);
  }
  process.exit(bump(level));
}
console.error('Использование: tsx scripts/version.mts check | bump major|minor|patch');
process.exit(2);
