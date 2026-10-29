import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { loadCampaign } from '../src/core/loader'
import { normalizeChronicleManifest } from '../src/editor/chronicleManifest'
import type { CampaignManifest } from '../src/shared/types'

console.log('--- Смоук-тест: Загрузка кампаний с таблицами встреч (encounters/ и rules/) ---')

// 1. Тест загрузки кампании «Шёпот Шестерён» из папки _ai-temp/campaing/campaign
const root = path.resolve('_ai-temp/campaing/campaign')
const prevFetch = globalThis.fetch

globalThis.fetch = async (url: string | URL | Request) => {
  const urlStr = String(url)
  const rel = urlStr.replace(/^\/campaigns\/shepot-shesteren\/?/, '').replace(/^\/+/, '')
  const filePath = path.join(root, rel)
  if (!fs.existsSync(filePath)) {
    return {
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({}),
      text: async () => '',
    } as unknown as Response
  }
  const content = fs.readFileSync(filePath, 'utf-8')
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => JSON.parse(content),
    text: async () => content,
  } as unknown as Response
}

try {
  const camp = await loadCampaign('/campaigns/shepot-shesteren')
  assert.equal(camp.meta.title, 'Шёпот Шестерён', 'Кампания должна успешно загрузиться')
  assert.ok(camp.encounters.enc_streets, 'Таблица enc_streets должна быть загружена из encounters/')
  assert.ok(camp.encounters.enc_foundry, 'Таблица enc_foundry должна быть загружена из encounters/')
  assert.ok(camp.encounters.enc_tunnels, 'Таблица enc_tunnels должна быть загружена из encounters/')
  console.log('✓ loadCampaign корректно подхватывает encounters из папки encounters/')
} finally {
  globalThis.fetch = prevFetch
}

// 2. Тест normalizeChronicleManifest с таблицами в encounters/
const fakeManifest: CampaignManifest = {
  campaign: 'campaign.json',
  world: 'world.json',
  scenes: ['scene_1.json'],
  entities: ['hero.json'],
  rules: ['rule_1.json'],
  dialogues: ['talk.ink'],
  encounters: ['enc_test.json'],
}
const jsonFiles = new Map<string, unknown>([
  ['encounters/enc_test.json', { encounter_tables: [{ id: 'enc_test', entries: [] }] }],
  ['scenes/scene_1.json', { id: 'scene_1' }],
  ['entities/hero.json', { id: 'hero' }],
  ['rules/rule_1.json', { id: 'rule_1', conditions: [], effects: [] }],
])
const textFiles = new Map<string, string>([
  ['dialogues/talk.ink', '-> END'],
])

const normalized = normalizeChronicleManifest(fakeManifest, jsonFiles, textFiles)
assert.deepEqual(normalized.manifest.encounters, ['enc_test.json'], 'encounters должны сохраниться в манифесте')
assert.ok(
  jsonFiles.has('rules/enc_test.json') || jsonFiles.has('encounters/enc_test.json'),
  'Файл встреч должен сохраниться в памяти jsonFiles',
)
console.log('✓ normalizeChronicleManifest корректно обрабатывает encounters из encounters/')

console.log('encounters-loader-smoke: ALL GREEN')
