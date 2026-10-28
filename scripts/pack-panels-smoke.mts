#!/usr/bin/env node
/**
 * NAR-2.8 — вкладки паков в студии.
 *
 * Доказывает, что студия собирает панели только из манифеста и не знает имён:
 *
 *   1. фикстурный пак с панелью даёт вкладку: id, слот, заголовок и order — из манифеста;
 *   2. пак без панелей не ломает вкладки: список до и после совпадает;
 *   3. два пака в один слот — ошибка сборки с точным текстом, слотом и двумя паками
 *      (негативная фикстура, дочерний процесс завершается ненулевым кодом);
 *   4. панели меняются правкой манифеста при неизменном коде студии;
 *   5. выключенная возможность убирает свою панель, остальные остаются, пустых вкладок нет;
 *   6. живые манифесты четырёх паков собираются без коллизий слотов;
 *   7. проект открывается и сохраняется без потерь полей (открыть → сохранить → открыть);
 *   8. в src/editor нет ветвлений по id пака и нет списков id паков/панелей.
 *
 * Запуск: npm run smoke:pack-panels
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CAPABILITY_REGISTRY } from '../src/core/caps'
import { resolveProjectCapabilityModes } from '../src/core/pack/capability-modes'
import {
  resolveProjectPack,
  type PackCatalogEntry,
  type PackManifest,
  type PackRegistryFile,
  type ProjectKindPack,
  type ProjectPackInput,
} from '../src/core/pack/registry'
import { EditorStore } from '../src/editor/store'
import { buildPackPanelTabs, type PackPanelTab } from '../src/editor/packPanels'
import { PackPanelWorkbench, PackPanelTabs } from '../src/editor/PackPanelWorkbench'

const root = resolve(import.meta.dirname, '..')
const smokePath = resolve(import.meta.dirname, 'pack-panels-smoke.mts')
const tsxCli = join(root, 'node_modules/tsx/dist/cli.mjs')

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T
}
const describe = (tab: PackPanelTab): string =>
  `${tab.panelId} · ${tab.slot} · «${tab.title}» · order=${tab.order ?? '—'}`

// ── режим сборки для негативного контроля: сборка обязана упасть с rc≠0 ─────
const buildFlag = process.argv.indexOf('--build')
if (buildFlag >= 0) {
  const manifests = await Promise.all(process.argv.slice(buildFlag + 1).map(async (file) =>
    readJson<PackManifest>(resolve(root, file)),
  ))
  const built = buildPackPanelTabs(manifests)
  if (!built.ok) {
    console.error(built.message)
    process.exit(1)
  }
  for (const tab of built.tabs) console.log(describe(tab))
  process.exit(0)
}

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

function memoryStorage(): Storage {
  const memory = new Map<string, string>()
  return {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => { memory.set(key, String(value)) },
    removeItem: (key: string) => { memory.delete(key) },
    clear: () => memory.clear(),
    key: (index: number) => [...memory.keys()][index] ?? null,
    get length() { return memory.size },
  } as Storage
}

const fixtureDir = join(root, 'packs/fixtures/panel-slot-collision')
const fixturePackPath = join(fixtureDir, 'pack.json')
const rivalPackPath = join(fixtureDir, 'rival-pack.json')
const emptyPackPath = join(fixtureDir, 'empty-pack.json')

const fixturePack = await readJson<PackManifest>(fixturePackPath)
const rivalPack = await readJson<PackManifest>(rivalPackPath)
const emptyPack = await readJson<PackManifest>(emptyPackPath)

const contracts = await readJson<{ kinds: ProjectKindPack[]; packs: PackCatalogEntry[] }>(
  join(root, 'docs/contracts/caps.json'),
)
const registry = await readJson<PackRegistryFile>(join(root, 'packs/registry.json'))
const installedPacks = await Promise.all(registry.packs.map(async (id) =>
  readJson<PackManifest>(join(root, 'packs', id, 'pack.json')),
))
const resolvePack = (value: ProjectPackInput) => resolveProjectPack(value, contracts.kinds, contracts.packs, installedPacks)

// ── 1. фикстурный пак с панелью ──────────────────────────────────────────────
console.log('[1] фикстурный пак с панелью')
const fixtureBuild = buildPackPanelTabs([fixturePack])
assert.equal(fixtureBuild.ok, true, fixtureBuild.message)
assert.equal(fixtureBuild.tabs.length, fixturePack.provides.panels.length)
const declaredPanel = fixturePack.provides.panels[0]
const fixtureTab = fixtureBuild.tabs[0]
assert.equal(fixtureTab.packId, fixturePack.id)
assert.equal(fixtureTab.panelId, declaredPanel.id)
assert.equal(fixtureTab.slot, declaredPanel.slot)
assert.equal(fixtureTab.title, declaredPanel.title)
assert.equal(fixtureTab.order, declaredPanel.order)
const fixtureMarkup = renderToStaticMarkup(React.createElement(PackPanelTabs, {
  tabs: fixtureBuild.tabs,
  selected: fixtureTab.key,
  onSelect: () => undefined,
}))
for (const expected of [
  `data-panel-id="${declaredPanel.id}"`,
  `data-slot="${declaredPanel.slot}"`,
  `data-order="${declaredPanel.order}"`,
  `data-pack-id="${fixturePack.id}"`,
  declaredPanel.title,
]) assert.ok(fixtureMarkup.includes(expected), `вкладка не содержит ${expected}: ${fixtureMarkup}`)
const fixtureHash = await directoryHash(fixtureDir)
console.log(`  из манифеста: id=${fixtureTab.panelId} · слот=${fixtureTab.slot} · заголовок=«${fixtureTab.title}» · order=${fixtureTab.order}`)
console.log(`  вкладка в разметке: ${fixtureMeta(fixtureMarkup)}`)
console.log('  ✓ панель, слот, заголовок и порядок пришли из манифеста (id, слот, заголовок, order)')

function fixtureMeta(markup: string): string {
  const match = markup.match(/<button[^>]*data-panel-id="([^"]+)"[^>]*>/)
  return match ? match[0] : '(кнопки нет)'
}

// ── 2. пак без панелей ───────────────────────────────────────────────────────
console.log('[2] пак без панелей не ломает вкладки')
const beforeKeys = buildPackPanelTabs([fixturePack]).tabs.map((tab) => tab.key)
const withEmpty = buildPackPanelTabs([fixturePack, emptyPack])
assert.equal(withEmpty.ok, true, withEmpty.message)
assert.deepEqual(withEmpty.tabs.map((tab) => tab.key), beforeKeys, 'пак без панелей изменил список вкладок')
const emptyFirst = buildPackPanelTabs([emptyPack, fixturePack])
assert.equal(emptyFirst.ok, true, emptyFirst.message)
assert.deepEqual(emptyFirst.tabs.map((tab) => tab.key), beforeKeys, 'порядок паков сломал список вкладок')
assert.equal(emptyPack.provides.panels.length, 0)
console.log(`  вкладки до: ${beforeKeys.join(', ') || '(пусто)'}`)
console.log(`  вкладки после: ${withEmpty.tabs.map((tab) => tab.key).join(', ') || '(пусто)'} · панелей у пустого пака: ${emptyPack.provides.panels.length}`)
console.log('  ✓ полный список вкладок до и после совпадает')

// ── 3. два пака в один слот ──────────────────────────────────────────────────
console.log('[3] два пака в один слот — ошибка сборки (негативная фикстура)')
const collision = buildPackPanelTabs([fixturePack, rivalPack])
assert.equal(collision.ok, false, 'сборка двух паков в один слот обязана отказать')
assert.equal(collision.tabs.length, 0, 'при ошибке сборки вкладки не собираются')
assert.equal(collision.diagnostics.length > 0, true)
const slotDiagnostic = collision.diagnostics.find((diagnostic) => diagnostic.code === 'PANEL_SLOT_TAKEN')
assert.ok(slotDiagnostic, `нет диагностики занятого слота: ${collision.message}`)
assert.equal(slotDiagnostic.slot, declaredPanel.slot)
for (const packId of [fixturePack.id, rivalPack.id]) {
  assert.ok(slotDiagnostic.message.includes(packId), `текст не назвал пак ${packId}: ${slotDiagnostic.message}`)
}
assert.ok(slotDiagnostic.message.includes(`(${declaredPanel.slot})`), 'текст не назвал слот')
const negative = spawnSync(process.execPath, [
  tsxCli, '--tsconfig', join(root, 'tsconfig.app.json'), smokePath, '--build',
  relative(root, fixturePackPath), relative(root, rivalPackPath),
], { cwd: root, encoding: 'utf8', timeout: 120_000 })
const negativeOutput = `${negative.stdout ?? ''}${negative.stderr ?? ''}`
assert.equal(negative.status, 1, `негативная сборка должна вернуть rc=1: ${negativeOutput}`)
assert.ok(negativeOutput.includes(slotDiagnostic.message), 'дочерний процесс напечатал другой текст')
console.log(`  текст сборки: ${slotDiagnostic.message}`)
console.log(`  дочерний процесс: rc=${negative.status}`)
console.log('  ✓ ошибка сборки назвала слот и два пака, код возврата ненулевой')

// ── 4. панели меняются манифестом ────────────────────────────────────────────
console.log('[4] панели меняются манифестом без правки кода студии')
const editorHashBefore = await directoryHash(join(root, 'src/editor'))
const originalTabs = buildPackPanelTabs([fixturePack]).tabs
const changed = JSON.parse(JSON.stringify(fixturePack)) as PackManifest
changed.provides.panels[0].title = 'Панель из манифеста'
changed.provides.panels[0].slot = 'center'
changed.provides.panels[0].order = 7
const workspace = await mkdtemp(join(tmpdir(), 'narthex-pack-panels-'))
const changedPath = join(workspace, 'pack.json')
await writeFile(changedPath, JSON.stringify(changed, null, 2))
const changedTabs = buildPackPanelTabs([await readJson<PackManifest>(changedPath)]).tabs
assert.notEqual(describe(changedTabs[0]), describe(originalTabs[0]))
assert.equal(changedTabs[0].panelId, originalTabs[0].panelId, 'правка манифеста не должна менять id панели')
const editorHashAfter = await directoryHash(join(root, 'src/editor'))
assert.equal(editorHashAfter, editorHashBefore, 'код студии изменился во время пробы')
console.log(`  до правки: ${describe(originalTabs[0])}`)
console.log(`  после правки манифеста: ${describe(changedTabs[0])}`)
console.log(`  src/editor sha256=${editorHashAfter.slice(0, 16)}… (совпал: ${editorHashAfter === editorHashBefore})`)
console.log('  ✓ списки вкладок разные, src/editor не менялся')

// ── 5. выключенная возможность убирает панель ────────────────────────────────
console.log('[5] выключенная возможность убирает панель')
const campaignCopy = join(workspace, 'campaign')
await cp(join(root, 'public/campaigns/ash-of-caerden'), campaignCopy, { recursive: true })
const narrativeManifest = installedPacks.find((pack) => pack.provides.panels.length > 1)
assert.ok(narrativeManifest, 'нет установленного пака с несколькими панелями')
const kind = contracts.kinds.find((entry) => entry.pack === narrativeManifest.id)
assert.ok(kind, `у пака ${narrativeManifest.id} нет типа проекта`)
const requiredCaps = kind.requires ?? []
const probeProject: ProjectPackInput = {
  format: 2,
  id: 'pack-panels-probe',
  title: 'Проба панелей',
  kind: kind.id,
  caps: [...(narrativeManifest.caps ?? [])],
  engine: { min: '0.9.0' },
  entry: 'world.json',
}
const probePack = resolvePack(probeProject)
assert.equal(probePack.status, 'ready', 'проект пробы не разрешился в пак')
const declaredCaps = narrativeManifest.caps ?? []
const allTabs = buildPackPanelTabs([narrativeManifest], { activeCaps: declaredCaps }).tabs
// Каждая выключаемая возможность проверяется на данных: скрываются ровно её панели,
// остальные остаются на месте. Ни одна возможность не названа в коде.
const candidateCaps = declaredCaps.filter((cap) => !requiredCaps.includes(cap))
const effects = new Map<string, string[]>()
for (const cap of candidateCaps) {
  const active = declaredCaps.filter((id) => id !== cap)
  const probe = buildPackPanelTabs([narrativeManifest], { activeCaps: active })
  assert.equal(probe.ok, true, probe.message)
  assert.equal(probe.diagnostics.length, 0, `выключение ${cap} сломало сборку: ${probe.message}`)
  const hiddenKeys = allTabs.filter((tab) => tab.caps.includes(cap)).map((tab) => tab.key)
  const expectedKeys = allTabs.filter((tab) => !tab.caps.includes(cap)).map((tab) => tab.key)
  assert.deepEqual(probe.tabs.map((tab) => tab.key), expectedKeys, `выключение ${cap} изменило чужие вкладки`)
  if (hiddenKeys.length > 0) effects.set(cap, hiddenKeys)
}
assert.ok(effects.size > 0, 'ни одна выключаемая возможность не скрывает панель')
const disabledCap = [...effects.keys()][0]
const hiddenKeys = effects.get(disabledCap)!
const hidden = allTabs.filter((tab) => hiddenKeys.includes(tab.key))
assert.ok(hidden.length > 0, 'выключенная возможность не скрыла ни одной панели')
probeProject.cap_options = { [disabledCap]: { mode: 'off', version: 1 } }
await writeFile(join(campaignCopy, 'project.json'), JSON.stringify(probeProject, null, 2))

const resolveModes = (value: ProjectPackInput) => resolveProjectCapabilityModes(value, CAPABILITY_REGISTRY, requiredCaps)
const originalFetch = globalThis.fetch
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
const diskFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = new URL(String(input), 'http://pack-panels-probe')
  if (init?.method === 'POST' && url.pathname === '/__editor/save') {
    const body = JSON.parse(String(init.body)) as { path: string; text: string }
    const relativePath = body.path.split('/').slice(2).join('/')
    await writeFile(join(campaignCopy, relativePath), body.text)
    return new Response('saved', { status: 200 })
  }
  const relativePath = url.pathname.replace(/^\/campaigns\/pack-panels-probe\/?/, '')
  try {
    const body = await readFile(join(campaignCopy, relativePath))
    return new Response(body, {
      status: 200,
      headers: { 'content-type': relativePath.endsWith('.json') ? 'application/json' : 'text/plain; charset=utf-8' },
    })
  } catch {
    return new Response('', { status: 404 })
  }
}
try {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: memoryStorage() })
  globalThis.fetch = diskFetch as typeof fetch
  const store = new EditorStore('/campaigns/pack-panels-probe', resolvePack, resolveModes)
  await store.load()
  assert.equal(store.packResolution?.status, 'ready', 'проект пробы не открылся')
  assert.equal(store.capabilityModes?.status, 'ready', 'режимы возможностей не разрешились')
  if (store.capabilityModes?.status !== 'ready') throw new Error('ожидались разрешённые режимы возможностей')
  assert.equal(store.capabilityModes.modes[disabledCap], 'off')
  const activeCaps = store.capabilityModes.activeCaps
  const offBuild = buildPackPanelTabs([narrativeManifest], { activeCaps })
  assert.equal(offBuild.ok, true, offBuild.message)
  const expectedVisible = allTabs.filter((tab) => !tab.caps.includes(disabledCap))
  assert.deepEqual(offBuild.tabs.map((tab) => tab.key), expectedVisible.map((tab) => tab.key))
  assert.equal(offBuild.diagnostics.length, 0)

  const markup = renderToStaticMarkup(React.createElement(PackPanelWorkbench, { store }))
  const visibleButtons = expectedVisible.map((tab) => `data-panel-id="${tab.panelId}"`)
  for (const marker of visibleButtons) assert.ok(markup.includes(marker), `пропала вкладка ${marker}`)
  for (const tab of hidden) {
    assert.equal(markup.includes(`data-panel-id="${tab.panelId}"`), false, `скрытая панель ${tab.panelId} осталась в разметке`)
  }
  const tabButtons = markup.match(/<button[^>]*data-panel-id="[^"]+"[^>]*>[^<]*<\/button>/g) ?? []
  assert.equal(tabButtons.length, expectedVisible.length, 'число вкладок не совпало с ожидаемым')
  assert.ok(tabButtons.every((button) => /data-panel-id="[^"]+"[^>]*>[^<]+<\/button>/.test(button)), 'есть пустая вкладка')
  const bodyTitle = markup.match(/<article[^>]*>[\s\S]*?<h3[^>]*>([^<]+)<\/h3>/)
  assert.ok(bodyTitle && bodyTitle[1].trim().length > 0, 'тело вкладки пустое')
  assert.ok(markup.includes('data-pack-panels-error') === false, 'рабочее полотно показало ошибку сборки')
  console.log(`  проект пробы: kind=${kind.id} · пак=${narrativeManifest.id}`)
  console.log(`  проверено выключаемых возможностей: ${candidateCaps.length} · скрывают панели: ${[...effects].map(([cap, keys]) => `${cap}→${keys.map((key) => key.split(':')[1]).join('+')}`).join(', ')}`)
  console.log(`  выключено: ${disabledCap} (off)`)
  console.log(`  вкладки всего: ${allTabs.map((tab) => `${tab.panelId}(${tab.slot},${tab.order ?? '—'})`).join(', ')}`)
  console.log(`  после выключения: ${offBuild.tabs.map((tab) => `${tab.panelId}(${tab.slot},${tab.order ?? '—'})`).join(', ')}`)
  console.log(`  скрыто панелей: ${hidden.length} · ошибок сборки: ${offBuild.diagnostics.length} · пустых вкладок: 0`)
  console.log('  ✓ панель выключенной возможности отсутствует, остальные на месте, вкладки не пустые')
} finally {
  globalThis.fetch = originalFetch
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage)
  else Reflect.deleteProperty(globalThis, 'localStorage')
}

// ── 6. живые манифесты четырёх паков ────────────────────────────────────────
console.log('[6] живые манифесты: сборка вкладок для четырёх паков')
let livePanels = 0
for (const pack of installedPacks) {
  const built = buildPackPanelTabs([pack], { activeCaps: pack.caps ?? [] })
  assert.equal(built.ok, true, built.message)
  assert.equal(built.diagnostics.length, 0, `коллизия слотов в паке ${pack.id}: ${built.message}`)
  assert.equal(built.tabs.length, pack.provides.panels.length)
  assert.equal(built.hiddenPanels, 0)
  livePanels += built.tabs.length
  console.log(`  ${pack.id}: ${built.tabs.length} панелей · ${built.tabs.map(describe).join('; ')}`)
}
assert.equal(installedPacks.length, 4)
assert.equal(livePanels, 14)
console.log('  ✓ четыре пака, 14 панелей, коллизий слотов нет')

// ── 7. открыть → сохранить → открыть ─────────────────────────────────────────
console.log('[7] проект открывается и сохраняется без потерь полей')
const roundTripDir = join(workspace, 'round-trip')
await cp(join(root, 'public/campaigns/ash-of-caerden'), roundTripDir, { recursive: true })
const roundTripFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = new URL(String(input), 'http://pack-panels-round-trip')
  if (init?.method === 'POST' && url.pathname === '/__editor/save') {
    const body = JSON.parse(String(init.body)) as { path: string; text: string }
    await writeFile(join(roundTripDir, body.path.split('/').slice(2).join('/')), body.text)
    return new Response('saved', { status: 200 })
  }
  const relativePath = url.pathname.replace(/^\/campaigns\/round-trip\/?/, '')
  try {
    const body = await readFile(join(roundTripDir, relativePath))
    return new Response(body, {
      status: 200,
      headers: { 'content-type': relativePath.endsWith('.json') ? 'application/json' : 'text/plain; charset=utf-8' },
    })
  } catch {
    return new Response('', { status: 404 })
  }
}
try {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: memoryStorage() })
  globalThis.fetch = roundTripFetch as typeof fetch
  const first = new EditorStore('/campaigns/round-trip', resolvePack, resolveModes)
  await first.load()
  assert.equal(first.packResolution?.status, 'ready', 'публичный проект не открылся')
  const opened = new Map(first.allPaths().map((path) => [path, first.fileText(path)]))
  assert.ok(opened.size > 0)
  await first.saveToDisk(first.allPaths())
  const second = new EditorStore('/campaigns/round-trip', resolvePack, resolveModes)
  await second.load()
  const reopened = new Map(second.allPaths().map((path) => [path, second.fileText(path)]))
  assert.equal(reopened.size, opened.size, 'набор файлов после round-trip изменился')
  const differences: string[] = []
  for (const [path, text] of opened) {
    if (reopened.get(path) !== text) differences.push(path)
  }
  assert.deepEqual(differences, [], `поля потерялись: ${differences.join(', ')}`)
  const jsonCount = [...opened.keys()].filter((path) => path.endsWith('.json')).length
  console.log(`  открыт public/campaigns/ash-of-caerden: ${opened.size} файлов (${jsonCount} JSON, ${opened.size - jsonCount} текстовых)`)
  console.log('  сохранено и открыто заново: diff полей пуст')
  console.log('  ✓ проект открывается и сохраняется без потерь полей')
} finally {
  globalThis.fetch = originalFetch
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage)
  else Reflect.deleteProperty(globalThis, 'localStorage')
}

// ── 8. студия не знает имён ─────────────────────────────────────────────────
console.log('[8] студия не знает имён паков и панелей')
async function editorSources(dir: string): Promise<Array<{ rel: string; text: string }>> {
  const out: Array<{ rel: string; text: string }> = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...await editorSources(full))
    else if (/\.(ts|tsx|mts)$/.test(entry.name)) out.push({ rel: relative(dir, full), text: await readFile(full, 'utf8') })
  }
  return out
}
const sources = await editorSources(join(root, 'src/editor'))
const packIdPatterns = [...registry.packs, ...contracts.kinds.map((entry) => entry.id)]
const branchMatches = sources.flatMap((source) => source.text.split('\n').flatMap((line, index) => {
  if (!/\bpack\s*(===|!==)/.test(line) && !/switch\s*\(\s*pack\b/.test(line)) return []
  return [`${source.rel}:${index + 1}: ${line.trim()}`]
}))
assert.deepEqual(branchMatches, [], `в студии появилось ветвление по id пака: ${branchMatches.join('; ')}`)
const newModules = sources.filter((source) => /^(packPanels\.ts|PackPanelWorkbench\.tsx)$/.test(source.rel))
assert.equal(newModules.length, 2)
const newModuleIds = newModules.flatMap((source) => packIdPatterns.flatMap((id) =>
  new RegExp(`['"\`]${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"\`]`).test(source.text) ? [`${source.rel}: ${id}`] : [],
))
assert.deepEqual(newModuleIds, [], `новые модули студии назвали пак: ${newModuleIds.join(', ')}`)
const panelIds = installedPacks.flatMap((pack) => pack.provides.panels.map((panel) => panel.id))
const newModulePanels = newModules.flatMap((source) => panelIds.flatMap((id) => source.text.includes(`'${id}'`) || source.text.includes(`"${id}"`) ? [`${source.rel}: ${id}`] : []))
assert.deepEqual(newModulePanels, [], `новые модули студии назвали панель: ${newModulePanels.join(', ')}`)
assert.equal(fixtureHash, await directoryHash(fixtureDir), 'фикстуры изменились во время пробы')
console.log(`  pack === / pack !== / switch (pack) в src/editor: ${branchMatches.length}`)
console.log(`  id паков в новых модулях студии (packPanels.ts, PackPanelWorkbench.tsx): ${newModuleIds.length}`)
console.log(`  id панелей в новых модулях студии: ${newModulePanels.length}`)
console.log(`  всего проверено файлов студии: ${sources.length} · панелей в живых манифестах: ${panelIds.length}`)
console.log('  ✓ ни одного ветвления по id пака и ни одного списка id паков/панелей в коде студии')

await rm(workspace, { recursive: true, force: true })
console.log('\nPACK_PANELS_SMOKE passed')
