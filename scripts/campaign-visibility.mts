/**
 * Один выключатель видимости кампании: dev ↔ витрина.
 *
 *   npm run campaign:dev -- <id> [--reason "почему"]
 *   npm run campaign:release -- <id> --title "Название для игрока"
 *
 * Почему так: игрок видит только записи `public/campaigns/index.json`
 * (`fetchCampaignIndex` → `hydrateCampaignIndex`). Значит, «скрыть кампанию в
 * движке» — это убрать её из реестра, а не заводить флаг в `campaign.json`.
 * Здесь этот переключатель и живёт.
 *
 * Источник истины — пак (`packs/<pack>/data/<campaign>`): инструмент правит
 * `campaign.json`, маркер `dev-fixture.json` и реестр, затем публикует копию.
 * `public/campaigns/**` руками не правится — его сверяет `check:campaigns`.
 *
 * Предохранители:
 *   - release отказывается выпускать кампанию с отсутствующими `assets/...`;
 *   - release не пропускает в витрину заголовок со словом «полигон» или
 *     префиксом `[DEV]` — нужно явное `--title`;
 *   - исходное название сохраняется в маркере, поэтому dev → release
 *     возвращает его, а не обрезает префикс механически.
 *
 * Флаги для тестов и отладки: `--root <dir>`, `--dry-run`, `--no-publish`,
 * `--no-audit`, `--no-check`.
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

const DEV_PREFIX = '[DEV] '
const argv = process.argv.slice(2)
const command = argv[0]
const id = argv[1]

const flag = (name: string): string | undefined => {
  const index = argv.indexOf(`--${name}`)
  return index >= 0 ? argv[index + 1] : undefined
}
const has = (name: string): boolean => argv.includes(`--${name}`)

const root = path.resolve(flag('root') ?? process.cwd())
const dryRun = has('dry-run')
const publishEnabled = !has('no-publish')
const auditEnabled = !has('no-audit')
const checkEnabled = !has('no-check')

interface Publication { pack: string; data: string; campaign: string }
interface Publications { campaigns?: Publication[] }
interface CampaignMeta {
  id: string
  title: string
  author?: string
  description?: string
  [key: string]: unknown
}
interface CampaignIndexEntry { id: string; title: string; author?: string; description?: string }
interface Fixture {
  visibility?: string
  audience?: string
  created_by?: string
  used_by?: string[]
  reason?: string
  remove_rule?: string
  title?: string
  updated_at?: string
  [key: string]: unknown
}

function fail(message: string): never {
  console.error(`✗ ${message}`)
  process.exit(1)
}

function stripDev(title: string): string {
  return title.replace(/^\[DEV\]\s*/i, '').trim()
}

function withDev(title: string): string {
  return `${DEV_PREFIX}${stripDev(title)}`
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, 'utf8')) as T
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

/** Файлы кампании по тем же правилам, что и `campaign-copies.mts`. */
async function listFiles(dir: string, rel = ''): Promise<string[]> {
  if (!existsSync(dir)) return []
  const files: string[] = []
  for (const entry of await readdir(path.join(dir, rel), { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'project.json') continue
    const next = rel ? `${rel}/${entry.name}` : entry.name
    if (entry.isDirectory()) files.push(...(await listFiles(dir, next)))
    else if (entry.isFile()) files.push(next)
  }
  return files.sort()
}

/** Ссылки вида `"assets/img/scene.jpg"` на файлы, которых нет. */
async function missingAssets(dir: string): Promise<string[]> {
  const refs = new Set<string>()
  for (const file of await listFiles(dir)) {
    if (!file.endsWith('.json')) continue
    const text = await readFile(path.join(dir, file), 'utf8')
    for (const match of text.matchAll(/"assets\/[^"]+"/g)) refs.add(match[0].slice(1, -1))
  }
  return [...refs].filter((ref) => !existsSync(path.join(dir, ref))).sort()
}

/** Скопировать источник пака в публичную копию и убрать лишнее. */
async function publish(source: string, target: string): Promise<{ copied: number; removed: number }> {
  const files = await listFiles(source)
  await mkdir(target, { recursive: true })
  for (const file of files) {
    await mkdir(path.dirname(path.join(target, file)), { recursive: true })
    await cp(path.join(source, file), path.join(target, file))
  }
  const extras = (await listFiles(target)).filter((file) => !files.includes(file))
  for (const file of extras) await rm(path.join(target, file))
  return { copied: files.length, removed: extras.length }
}

function runNpm(script: string, extra: string[] = []): number {
  const args = extra.length ? ['run', script, '--', ...extra] : ['run', script]
  const result = spawnSync('npm', args, { cwd: root, stdio: 'inherit' })
  return result.error ? 127 : result.status ?? 1
}

if (command !== 'dev' && command !== 'release') {
  fail('Использование: campaign-visibility.mts dev|release <id> [--title "..."] [--reason "..."]')
}
if (!id || !/^[a-z0-9][a-z0-9._-]*$/i.test(id)) fail(`Некорректный id кампании: ${JSON.stringify(id ?? '')}`)

const publicationsPath = path.join(root, 'packs', 'publications.json')
if (!existsSync(publicationsPath)) fail(`Нет карты публикаций: ${publicationsPath}`)
const publications = await readJson<Publications>(publicationsPath)
const row = (publications.campaigns ?? []).find((entry) => entry.campaign === id)
if (!row) fail(`Кампания «${id}» не публикуется из пака: нет записи в packs/publications.json`)

const source = path.join(root, 'packs', row.pack, 'data', row.data)
const target = path.join(root, 'public', 'campaigns', row.campaign)
const sourceMetaPath = path.join(source, 'campaign.json')
if (!existsSync(sourceMetaPath)) fail(`Нет источника кампании: ${sourceMetaPath}`)
const meta = await readJson<CampaignMeta>(sourceMetaPath)
if (meta.id !== id) fail(`id в campaign.json («${meta.id}») не совпадает с запрошенным «${id}»`)

const index = await readJson<CampaignIndexEntry[]>(path.join(root, 'public', 'campaigns', 'index.json'))
if (!Array.isArray(index)) fail('public/campaigns/index.json должен быть массивом')

const markerPath = path.join(source, 'dev-fixture.json')
const legacyMarkerPath = path.join(source, 'smoke-fixture.json')
const existingMarker = existsSync(markerPath) ? await readJson<Fixture>(markerPath) : undefined

const originalTitle = existingMarker?.title?.trim() || stripDev(meta.title)
const requestedTitle = flag('title')?.trim()
const nextTitle = command === 'dev'
  ? withDev(originalTitle)
  : (requestedTitle || existingMarker?.title?.trim() || stripDev(meta.title))

if (command === 'release') {
  if (!nextTitle) fail('Пустое название: укажи --title')
  if (/\[DEV\]|полигон/i.test(nextTitle)) {
    fail(`Название «${nextTitle}» выглядит как полигон. Для витрины укажи --title "…"`)
  }
}

const missing = await missingAssets(source)
if (command === 'release' && missing.length > 0) {
  console.error(`✗ release остановлен: ${missing.length} отсутствующих assets/...`)
  for (const ref of missing.slice(0, 20)) console.error(`    − ${ref}`)
  if (missing.length > 20) console.error(`    … ещё ${missing.length - 20}`)
  console.error('  Восстанови файлы или оставь кампанию в dev. Генерация — docs/agents/generation-quotas.md')
  process.exit(1)
}

if (command === 'release' && auditEnabled && !dryRun) {
  const rc = runNpm('audit:campaign', [source])
  if (rc !== 0) fail(`audit:campaign на источнике вернул rc=${rc}; release отменён, файлы не изменены`)
}

const indexBefore = index.length
const nextIndex = command === 'dev'
  ? index.filter((entry) => entry.id !== id)
  : [
      ...index.filter((entry) => entry.id !== id),
      {
        id,
        title: nextTitle,
        ...(meta.author ? { author: meta.author } : {}),
        ...(meta.description ? { description: meta.description } : {}),
      },
    ]

const marker: Fixture = command === 'dev'
  ? {
      ...existingMarker,
      visibility: 'internal',
      audience: existingMarker?.audience ?? 'agents-and-smokes-only',
      created_by: existingMarker?.created_by ?? 'команда campaign:dev',
      used_by: existingMarker?.used_by?.length ? existingMarker.used_by : ['npm run campaign:dev'],
      reason: flag('reason') ?? existingMarker?.reason ?? 'Переведена в dev командой campaign:dev.',
      remove_rule: `npm run campaign:release -- ${id} --title "<название для игрока>"`,
      title: originalTitle,
      updated_at: new Date().toISOString(),
    }
  : undefined

console.log(`campaign:${command} ${id}${dryRun ? ' (dry-run)' : ''}`)
console.log(`  источник: packs/${row.pack}/data/${row.data}`)
console.log(`  заголовок: «${nextTitle}»`)
console.log(`  реестр: ${indexBefore} → ${nextIndex.length}`)
console.log(`  изображения: ${missing.length === 0 ? 'все на месте' : `${missing.length} отсутствуют`}${command === 'dev' && missing.length ? ' (для dev допустимо)' : ''}`)

if (dryRun) {
  console.log('  dry-run: файлы не изменены')
  process.exit(0)
}

await writeJson(sourceMetaPath, { ...meta, title: nextTitle })
if (marker) {
  await writeJson(markerPath, marker)
} else {
  for (const file of [markerPath, legacyMarkerPath]) if (existsSync(file)) await rm(file)
}
await writeJson(path.join(root, 'public', 'campaigns', 'index.json'), nextIndex)

let copy = { copied: 0, removed: 0 }
if (publishEnabled) {
  copy = await publish(source, target)
  console.log(`  копия: ${copy.copied} файлов, удалено ${copy.removed}`)
}

if (checkEnabled) {
  for (const script of ['check:dev-campaigns', 'check:campaigns']) {
    const rc = runNpm(script)
    if (rc !== 0) fail(`${script} вернул rc=${rc}; изменения уже на диске, проверь git diff`)
  }
}

console.log(`✓ campaign:${command} ${id}: готово. Дальше: git diff, npm run check:contracts, PR.`)
