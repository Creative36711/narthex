/**
 * Гейт внутренних кампаний-полигонов.
 *
 * 26.10 в public/campaigns/ лежали три каталога, которых нет в реестре игрока.
 * Два были помечены smoke-fixture.json, третий (fmv-crossing) — нет, поэтому
 * audit:campaign-formats падал, но никто этого не видел: проверка не входила
 * в check:contracts. А adventure-копия внутри campaign.json имела id от
 * narrative, из-за чего выбор adventure в браузере грузил narrative-сцену.
 *
 * Здесь зафиксированы правила из docs/agents/dev-campaigns.md:
 *   - каталог вне реестра обязан иметь маркер и [DEV] в заголовке;
 *   - id уникален и совпадает с именем каталога;
 *   - временные каталоги __dev_* / __smoke* не попадают в git;
 *   - реестр не содержит внутренних кампаний.
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = process.cwd()
const campaignsDir = join(root, 'public/campaigns')
const index = JSON.parse(readFileSync(join(campaignsDir, 'index.json'), 'utf8')) as Array<{ id?: string }>
const registered = index.map((e) => e.id as string)
const dirs = readdirSync(campaignsDir, { withFileTypes: true })
  .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
  .map((e) => e.name)
  .sort()

const problems: string[] = []

for (const id of registered) {
  if (!dirs.includes(id)) problems.push(`реестр содержит «${id}», но каталога нет`)
  if (id.startsWith('__')) problems.push(`в реестр игрока попал служебный каталог «${id}»`)
  const metaPath = join(campaignsDir, id, 'campaign.json')
  if (existsSync(metaPath)) {
    const meta = JSON.parse(readFileSync(metaPath, 'utf8')) as { title?: string }
    if (meta.title?.startsWith('[DEV]')) problems.push(`кампания «${id}» помечена [DEV], но внесена в реестр игрока`)
  }
}

const ids = new Set<string>()
for (const dir of dirs) {
  if (dir.startsWith('__')) {
    problems.push(`в git лежит временный каталог «${dir}» — удали его в finally пробы`)
    continue
  }
  const base = join(campaignsDir, dir)
  const metaPath = join(base, 'campaign.json')
  if (!existsSync(metaPath)) { problems.push(`campaigns/${dir}: нет campaign.json`); continue }
  const meta = JSON.parse(readFileSync(metaPath, 'utf8')) as { id?: string; title?: string }

  if (meta.id !== dir) problems.push(`campaigns/${dir}: id «${meta.id}» не совпадает с каталогом`)
  if (ids.has(meta.id ?? '')) problems.push(`campaigns/${dir}: дубль id «${meta.id}»`)
  ids.add(meta.id ?? '')

  const isFixture = !registered.includes(dir)
  const modern = join(base, 'dev-fixture.json')
  const legacy = join(base, 'smoke-fixture.json')
  const marker = existsSync(modern) ? modern : legacy

  if (isFixture) {
    if (!existsSync(marker)) { problems.push(`campaigns/${dir}: нет dev-fixture.json (каталог не в реестре)`); continue }
    const fixture = JSON.parse(readFileSync(marker, 'utf8')) as Record<string, unknown>
    if (fixture.visibility !== 'internal') problems.push(`campaigns/${dir}: маркер без visibility: internal`)
    if (typeof fixture.reason !== 'string' || !fixture.reason) problems.push(`campaigns/${dir}: маркер без reason`)
    if (!Array.isArray(fixture.used_by) || !fixture.used_by.length) problems.push(`campaigns/${dir}: маркер без used_by`)
    if (!meta.title?.startsWith('[DEV]')) problems.push(`campaigns/${dir}: заголовок без префикса [DEV]`)
  } else if (existsSync(marker)) {
    problems.push(`campaigns/${dir}: помечен как внутренний, но внесён в реестр игрока`)
  }
}

// Временные каталоги, оставленные смоуками, не должны попадать в репозиторий.
const stray: string[] = []
function walk(dir: string, rel = ''): void {
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === 'node_modules' || entry.name === '.git') continue
    if (/^__(dev|smoke|diff|tmp)/.test(entry.name)) stray.push(join(rel, entry.name))
    else if (rel.split('/').length < 4) walk(join(dir, entry.name), join(rel, entry.name))
  }
}
for (const top of ['public', 'packs', 'scripts']) walk(join(root, top), top)
for (const s of stray) {
  // Исключение: каталоги-фикстуры, которые сами смоуки держат в git намеренно.
  const inGit = existsSync(resolve(root, s, '.gitkeep'))
  if (!inGit) problems.push(`временный каталог оставлен в репозитории: ${s}`)
}

if (problems.length) {
  console.error('Гейт внутренних кампаний:')
  problems.forEach((p) => console.error('  ✗ ' + p))
  console.error('\nПравила: docs/agents/dev-campaigns.md')
  process.exit(1)
}
console.log(`Гейт внутренних кампаний: ok — ${dirs.length} полигона, ${registered.length} записей в реестре, сирот нет.`)
