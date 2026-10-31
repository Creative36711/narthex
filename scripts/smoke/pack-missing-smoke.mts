import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { resolveProjectPack, type PackCatalogEntry, type PackManifest, type PackRegistryFile, type ProjectKindPack, type ProjectPackInput, type ProjectPackResolution } from '../../src/core/pack/registry'
import { EditorStore } from '../../src/editor/store'
import { PackMissingNotice } from '../../src/editor/PackMissingNotice'
import { assertAshWarningText } from '../playkit/ash-warning-oracle.mts'

const root = resolve(import.meta.dirname, '../..')
const fixtureDir = join(root, 'scripts/smoke/fixtures/project-without-narrative')
const fixtureProjectPath = join(fixtureDir, 'project.json')
const campaignSource = join(root, 'public/campaigns/ash-of-caerden')
const project = JSON.parse(await readFile(fixtureProjectPath, 'utf8')) as ProjectPackInput
const contracts = JSON.parse(await readFile(join(root, 'docs/contracts/caps.json'), 'utf8')) as {
  kinds: ProjectKindPack[]
  packs: PackCatalogEntry[]
}
const registry = JSON.parse(await readFile(join(root, 'packs/registry.json'), 'utf8')) as PackRegistryFile
const installedPacks = await Promise.all(registry.packs.map(async (id) =>
  JSON.parse(await readFile(join(root, 'packs', id, 'pack.json'), 'utf8')) as PackManifest,
))
const missingResolution = resolveProjectPack(project, contracts.kinds, contracts.packs, [])
assert.equal(missingResolution.status, 'missing')
if (missingResolution.status !== 'missing') throw new Error('expected missing-pack diagnostic')
const diagnostic = missingResolution.diagnostic
assert.equal(diagnostic.code, 'PACK_MISSING')
assert.match(diagnostic.message, /narrative/i)
assert.match(diagnostic.message, /packs\/narrative\/.*packs\/registry\.json/)

async function directoryHash(dir: string): Promise<string> {
  const files: string[] = []
  const visit = async (current: string) => {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = join(current, entry.name)
      if (entry.isDirectory()) await visit(path)
      else files.push(path)
    }
  }
  await visit(dir)
  files.sort()
  const hash = createHash('sha256')
  for (const file of files) {
    hash.update(relative(dir, file).replaceAll('\\', '/'))
    hash.update('\0')
    hash.update(await readFile(file))
    hash.update('\0')
  }
  return hash.digest('hex')
}

const workspace = await mkdtemp(join(tmpdir(), 'narthex-pack-missing-'))
const projectDir = join(workspace, 'project')
const emptyRegistryPath = join(workspace, 'registry-without-narrative.json')
const cli = join(root, 'node_modules/tsx/dist/cli.mjs')
const cliEntry = join(root, 'scripts/playkit/cli.mts')
const originalFixtureHash = createHash('sha256').update(await readFile(fixtureProjectPath)).digest('hex')
const originalCampaignHash = createHash('sha256').update(await readFile(join(campaignSource, 'campaign.json'))).digest('hex')

try {
  await cp(campaignSource, projectDir, { recursive: true })
  await writeFile(join(projectDir, 'project.json'), await readFile(fixtureProjectPath))
  await writeFile(emptyRegistryPath, JSON.stringify({ version: 1, packs: [] }, null, 2))

  const beforeMissingCheck = await directoryHash(projectDir)
  const missingCheck = spawnSync(process.execPath, [
    cli, cliEntry, 'check', projectDir,
    '--pack-registry', emptyRegistryPath,
    '--out', join(workspace, 'missing-check-output'),
  ], { cwd: root, encoding: 'utf8', timeout: 120_000 })
  const missingOutput = `${missingCheck.stdout ?? ''}${missingCheck.stderr ?? ''}`
  assert.equal(missingCheck.status, 1, missingOutput)
  assert.ok(missingOutput.includes('PACK_MISSING'))
  assert.ok(missingOutput.includes(diagnostic.message), 'check must use the exact Studio diagnostic')
  assert.equal(await directoryHash(projectDir), beforeMissingCheck, 'missing-pack check must not modify project or save files')
  console.log(`✓ cf-play check отказал кодом ${diagnostic.code}, без исключения; диагностический текст совпал со Studio`)
  console.log(`  ${diagnostic.code}: ${diagnostic.message}`)

  const installedStoreResolution = resolveProjectPack(project, contracts.kinds, contracts.packs, installedPacks)
  assert.equal(installedStoreResolution.status, 'ready')
  const beforeInstalledCheck = await directoryHash(projectDir)
  const installedCheck = spawnSync(process.execPath, [
    cli, cliEntry, 'check', projectDir,
    '--seeds', '1-5', '--steps', '300',
    '--out', join(workspace, 'installed-check-output'),
  ], { cwd: root, encoding: 'utf8', timeout: 180_000 })
  const installedOutput = `${installedCheck.stdout ?? ''}${installedCheck.stderr ?? ''}`
  assert.equal(installedCheck.status, 1, installedOutput)
  assertAshWarningText(installedOutput, 'installed-pack Ash check')
  assert.equal(await directoryHash(projectDir), beforeInstalledCheck, 'expected warning rejection also leaves project files untouched')
  console.log('✓ тот же проект с установленным паком: cf-play check rc=1 только из-за точных трёх Ash warnings; метрики §3 совпали')

  const originalFetch = globalThis.fetch
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const saveMemory = new Map<string, string>([['save:project-without-narrative', 'sentinel-save-v1']])
  const saveHash = () => createHash('sha256').update(JSON.stringify([...saveMemory])).digest('hex')
  const saveHashBefore = saveHash()
  const storage = {
    getItem: (key: string) => saveMemory.get(key) ?? null,
    setItem: (key: string, value: string) => { saveMemory.set(key, String(value)) },
    removeItem: (key: string) => { saveMemory.delete(key) },
    clear: () => saveMemory.clear(),
    key: (index: number) => [...saveMemory.keys()][index] ?? null,
    get length() { return saveMemory.size },
  } as Storage
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
  globalThis.fetch = async (input: RequestInfo | URL) => {
    const path = new URL(String(input), 'http://pack-probe.local').pathname
    const rel = path.replace(/^\/pack-probe\/?/, '')
    const file = rel === 'project.json' ? fixtureProjectPath : join(campaignSource, rel)
    try {
      return new Response(await readFile(file), { status: 200 })
    } catch {
      return new Response('', { status: 404 })
    }
  }
  try {
    const missingResolver = (value: ProjectPackInput): ProjectPackResolution =>
      resolveProjectPack(value, contracts.kinds, contracts.packs, [])
    const missingStore = new EditorStore('/pack-probe', missingResolver)
    await assert.doesNotReject(missingStore.load())
    assert.equal(missingStore.packResolution?.status, 'missing')
    assert.equal(missingStore.packResolution?.status === 'missing' ? missingStore.packResolution.diagnostic.message : '', diagnostic.message)
    assert.equal(missingStore.jsonFiles.size, 0)
    assert.deepEqual([...saveMemory], [['save:project-without-narrative', 'sentinel-save-v1']])
    assert.equal(saveHash(), saveHashBefore, 'save sha256 must be identical before and after PACK_MISSING')
    const markup = renderToStaticMarkup(React.createElement(PackMissingNotice, { diagnostic, onExit: () => undefined }))
    assert.ok(markup.includes('Этот жанр не поддерживается'))
    assert.ok(markup.includes('PACK_MISSING'))
    assert.ok(markup.includes('packs/narrative/'))
    assert.ok(markup.includes('packs/registry.json'))
    console.log('✓ Studio открыла проект в отказном экране с названием пака и инструкцией; сейв SHA-256 не изменился')

    const readyResolver = (value: ProjectPackInput): ProjectPackResolution =>
      resolveProjectPack(value, contracts.kinds, contracts.packs, installedPacks)
    const readyStore = new EditorStore('/pack-probe', readyResolver)
    await readyStore.load()
    assert.equal(readyStore.packResolution?.status, 'ready')
    assert.equal(readyStore.meta.id, 'ash-of-caerden')
    console.log('✓ Studio открыла тот же проект обычным путём при установленном паке')
  } finally {
    globalThis.fetch = originalFetch
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage)
    else Reflect.deleteProperty(globalThis, 'localStorage')
  }

  assert.equal(createHash('sha256').update(await readFile(fixtureProjectPath)).digest('hex'), originalFixtureHash)
  assert.equal(createHash('sha256').update(await readFile(join(campaignSource, 'campaign.json'))).digest('hex'), originalCampaignHash)
  console.log(`PACK_MISSING_SMOKE passed · ${diagnostic.code} · save sha256=${saveHashBefore}`)
} finally {
  await rm(workspace, { recursive: true, force: true })
}
