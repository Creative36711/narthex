import { readFileSync } from 'node:fs'
import { GameEngine } from '../src/core/engine'
import type { CampaignManifest, MonolithDoc } from '../src/shared/types'
import { campaignFromMonolith } from '../src/editor/playtest'

const root = 'public/campaigns/ash-of-caerden/'
const read = <T,>(path: string): T => JSON.parse(readFileSync(root + path, 'utf8')) as T
const manifest = read<CampaignManifest>('manifest.json')
const collect = <T extends { id: string }>(folder: string, files: string[] = []) => Object.fromEntries(files.map((file) => { const value = read<T>(`${folder}/${file}`); return [value.id, value] }))
const encounters: Record<string, any> = {}
for (const file of manifest.encounters ?? []) {
  const data = read<any>(`rules/${file}`)
  for (const entry of data.encounter_tables ?? []) encounters[entry.id] = entry
}
const doc: MonolithDoc = {
  campaign: read('campaign.json'), world: read('world.json'),
  scenes: collect('scenes', manifest.scenes), entities: collect('entities', manifest.entities),
  rules: Object.fromEntries(manifest.rules.filter((f) => !manifest.encounters?.includes(f)).map((f) => { const value = read<any>(`rules/${f}`); return [value.id, value] })),
  arenas: collect('arenas', manifest.arenas), quests: collect('quests', manifest.quests), encounters,
  cutscenes: collect('cutscenes', manifest.cutscenes), recipes: collect('recipes', manifest.recipes), codex: collect('codex', manifest.codex),
  dialogues: Object.fromEntries(manifest.dialogues.map((f) => [f.replace(/\.ink$/, ''), { ink: readFileSync(`${root}dialogues/${f}`, 'utf8') }])),
}
const before = JSON.stringify(doc)
const campaign = campaignFromMonolith(doc)
if (JSON.stringify(doc) !== before) throw new Error('campaignFromMonolith mutated the input document')
if (!campaign.scenes[campaign.meta.starting_scene]) throw new Error('starting scene is missing')
const isolated = { ...campaign, meta: { ...campaign.meta, id: `${campaign.meta.id}__playtest` } }
const engine = new GameEngine(isolated)
engine.start()
if (engine.state.scene !== isolated.meta.starting_scene) throw new Error('engine did not start at the configured scene')
if (engine.state.campaign_id !== `${campaign.meta.id}__playtest`) throw new Error('playtest save id is not isolated')
const immortal = new GameEngine(isolated)
immortal.start()
immortal.debugInvincible = true
const hp = immortal.state.player.hp
immortal.changeHp(-hp)
if (immortal.state.player.hp !== hp) throw new Error('debug immortality did not block damage')
immortal.changeNeed('hunger', -1000)
if (immortal.state.game_over) throw new Error('debug immortality did not block death from starvation')
immortal.gameOver('death', 'forced debug defeat', true)
if (!immortal.state.game_over) throw new Error('forced debug defeat should bypass immortality')
console.log('Плейтест: преобразование и запуск кампании, изоляция сейва и бессмертие от урона/истощения пройдены.')
