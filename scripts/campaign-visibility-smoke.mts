/**
 * Смоук выключателя dev ↔ витрина.
 *
 * Работает на временном каталоге, реальные кампании не трогает:
 *   dev → [DEV] + маркер + пустой реестр + копия;
 *   release → чистое название + маркер удалён + запись в реестре;
 *   release с отсутствующим assets/... → отказ, файлы не изменены.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const script = path.join(root, 'scripts', 'campaign-visibility.mts')
const tsx = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs')

const temp = await mkdtemp(path.join(tmpdir(), 'cf-campaign-visibility-'))
const source = path.join(temp, 'packs', 'narrative', 'data', 'demo')
const target = path.join(temp, 'public', 'campaigns', 'demo')
const indexPath = path.join(temp, 'public', 'campaigns', 'index.json')

const meta = {
  id: 'demo',
  title: 'Демо',
  version: '1.0.0',
  description: 'Кампания для проверки выключателя.',
  author: 'Narthex',
}

const writeJson = async (file: string, value: unknown) => {
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

const run = (...args: string[]) => spawnSync(
  process.execPath,
  [tsx, script, ...args, '--root', temp, '--no-audit', '--no-check'],
  { cwd: root, encoding: 'utf8' },
)

const readJson = async (file: string) => JSON.parse(await readFile(file, 'utf8')) as Record<string, any>

try {
  await writeJson(path.join(temp, 'packs', 'publications.json'), {
    version: 1,
    campaigns: [{ pack: 'narrative', data: 'demo', campaign: 'demo' }],
  })
  await writeJson(path.join(source, 'campaign.json'), meta)
  await writeJson(path.join(source, 'scenes', 'start.json'), { id: 'scene_start', image: 'assets/img/scenes/start.jpg' })
  await writeJson(path.join(source, 'assets', 'img', 'scenes', 'start.jpg'), { stub: true })
  await writeJson(path.join(target, 'campaign.json'), meta)
  await writeJson(path.join(target, 'scenes', 'start.json'), { id: 'scene_start', image: 'assets/img/scenes/start.jpg' })
  await writeJson(path.join(target, 'assets', 'img', 'scenes', 'start.jpg'), { stub: true })
  await writeJson(indexPath, [{ id: 'demo', title: 'Демо' }])

  // ── dev ────────────────────────────────────────────────────────────
  let result = run('dev', 'demo', '--reason', 'Проверка смоука')
  assert.equal(result.status, 0, result.stderr || result.stdout)

  const devMeta = await readJson(path.join(source, 'campaign.json'))
  assert.equal(devMeta.title, '[DEV] Демо')
  assert.deepEqual(await readJson(indexPath), [], 'dev обязан очистить реестр')

  const marker = await readJson(path.join(source, 'dev-fixture.json'))
  assert.equal(marker.visibility, 'internal')
  assert.equal(marker.title, 'Демо')
  assert.equal(marker.reason, 'Проверка смоука')
  assert.match(String(marker.remove_rule), /campaign:release/)

  const devTarget = await readJson(path.join(target, 'campaign.json'))
  assert.equal(devTarget.title, '[DEV] Демо', 'публичная копия должна совпасть с источником')
  assert.equal((await readJson(path.join(target, 'dev-fixture.json'))).visibility, 'internal')

  // ── release ────────────────────────────────────────────────────────
  result = run('release', 'demo', '--title', 'Демо для игрока')
  assert.equal(result.status, 0, result.stderr || result.stdout)

  const releasedMeta = await readJson(path.join(source, 'campaign.json'))
  assert.equal(releasedMeta.title, 'Демо для игрока')
  const index = await readJson(indexPath) as Array<Record<string, any>>
  assert.equal(index.length, 1)
  assert.equal(index[0]!.id, 'demo')
  assert.equal(index[0]!.title, 'Демо для игрока')
  assert.equal((await readJson(path.join(target, 'campaign.json'))).title, 'Демо для игрока')

  // Маркер удалён и в источнике, и в копии.
  for (const file of [
    path.join(source, 'dev-fixture.json'),
    path.join(target, 'dev-fixture.json'),
  ]) {
    assert.equal(existsSync(file), false, `маркер остался: ${file}`)
  }

  // ── повторный dev → release без --title возвращает исходное название ─
  result = run('dev', 'demo')
  assert.equal(result.status, 0, result.stderr || result.stdout)
  result = run('release', 'demo')
  assert.equal(result.status, 0, result.stderr || result.stdout)
  assert.equal((await readJson(path.join(source, 'campaign.json'))).title, 'Демо для игрока')

  // ── release с отсутствующим ассетом обязан отказать ────────────────
  result = run('dev', 'demo')
  assert.equal(result.status, 0, result.stderr || result.stdout)
  await writeJson(path.join(source, 'scenes', 'broken.json'), { id: 'scene_broken', image: 'assets/img/scenes/missing.jpg' })
  result = run('release', 'demo', '--title', 'Сломанная')
  assert.equal(result.status, 1, 'release обязан упасть на отсутствующем ассете')
  assert.match(result.stderr, /отсутствующих assets/)
  assert.equal((await readJson(indexPath)).length, 0, 'реестр не должен измениться при отказе')
  assert.equal((await readJson(path.join(source, 'campaign.json'))).title, '[DEV] Демо для игрока')

  console.log('✓ smoke:campaign-visibility — dev/release/отказ работают')
} finally {
  await rm(temp, { recursive: true, force: true })
}
