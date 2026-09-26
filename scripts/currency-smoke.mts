import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { GameEngine } from '../src/core/engine'
import type { CampaignManifest, MonolithDoc } from '../src/shared/types'
import { campaignFromMonolith } from '../src/editor/playtest'

const root = 'public/campaigns/ash-of-caerden/'
const read = <T,>(path: string): T => JSON.parse(readFileSync(root + path, 'utf8')) as T
const manifest = read<CampaignManifest>('manifest.json')
const collect = <T extends { id: string }>(folder: string, files: string[] = []) =>
  Object.fromEntries(files.map((file) => {
    const value = read<T>(`${folder}/${file}`)
    return [value.id, value]
  }))
const encounters: Record<string, any> = {}
for (const file of manifest.encounters ?? []) {
  const data = read<any>(`rules/${file}`)
  for (const entry of data.encounter_tables ?? []) encounters[entry.id] = entry
}
const doc: MonolithDoc = {
  campaign: read('campaign.json'),
  world: read('world.json'),
  scenes: collect('scenes', manifest.scenes),
  entities: collect('entities', manifest.entities),
  rules: Object.fromEntries(manifest.rules.filter((file) => !manifest.encounters?.includes(file)).map((file) => {
    const value = read<any>(`rules/${file}`)
    return [value.id, value]
  })),
  arenas: collect('arenas', manifest.arenas),
  quests: collect('quests', manifest.quests),
  encounters,
  cutscenes: collect('cutscenes', manifest.cutscenes),
  recipes: collect('recipes', manifest.recipes),
  codex: collect('codex', manifest.codex),
  dialogues: Object.fromEntries(manifest.dialogues.map((file) => [
    file.replace(/\.ink$/, ''),
    { ink: readFileSync(`${root}dialogues/${file}`, 'utf8') },
  ])),
}

const campaign = campaignFromMonolith(doc)
const initialEngine = new GameEngine(campaign)
initialEngine.start()
const staleSave = structuredClone(initialEngine.state)
staleSave.player.currencies = { silver: 0 } // имитируем устаревший источник из старого сохранения
const engine = new GameEngine(campaign, staleSave)
assert.equal(engine.state.player.currencies, undefined, 'устаревшее поле currencies должно удаляться при загрузке сейва')
assert.equal(engine.currencyItemId('silver'), 'item_silver', 'явная привязка валюты к предмету-монете не используется')
assert.equal(engine.currencyAmount('silver'), 20, 'баланс должен читаться из 20 монет в инвентаре')
assert.equal(engine.buyItem('item_bread', 2), true, 'покупка при достаточном балансе должна пройти')
assert.equal(engine.currencyAmount('silver'), 18, 'трата в торговле должна уменьшить инвентарный баланс')
assert.equal(engine.sellItem('item_bread', 1), true, 'продажа предмета должна пройти')
assert.equal(engine.currencyAmount('silver'), 19, 'поступление от торговли должно увеличить тот же баланс')
console.log('✓ Валюта: начальный баланс, траты и поступления синхронизированы с предметами в инвентаре')
