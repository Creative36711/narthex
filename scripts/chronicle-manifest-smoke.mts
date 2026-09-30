import assert from 'node:assert/strict'
import JSZip from 'jszip'
import { normalizeChronicleManifest, normalizeChronicleZip } from '../src/editor/chronicleManifest'
import { newDlgDoc } from '../src/editor/dialogueDoc'
import type { CampaignManifest } from '../src/shared/types'

const manifest: CampaignManifest = {
  scenes: ['scenes/scene_start.json'],
  entities: ['entities/entities/item_caramel_latte.json'],
  rules: [],
  quests: ['quests/quest_intro.json'],
  dialogues: ['dialogues/dialogues/mark.dlg.json'],
}
const scene = { id: 'scene_start', label: 'Начало', states: [], slots: [], navigation: [] }
const entity = { id: 'item_caramel_latte', type: 'item', label: 'Карамельный латте' }
const quest = { id: 'quest_intro', label: 'Знакомство' }
const jsonFiles = new Map<string, unknown>([
  ['scenes/scene_start.json', scene],
  ['entities/entities/item_caramel_latte.json', entity],
  ['quests/quest_intro.json', quest],
  ['dialogues/dialogues/mark.dlg.json', newDlgDoc('Марк')],
])
const textFiles = new Map<string, string>()

const result = normalizeChronicleManifest(manifest, jsonFiles, textFiles)
assert.equal(result.changed, true)
assert.deepEqual(result.manifest.scenes, ['scene_start.json'])
assert.deepEqual(result.manifest.entities, ['item_caramel_latte.json'])
assert.deepEqual(result.manifest.quests, ['quest_intro.json'])
assert.deepEqual(result.manifest.dialogues, ['mark.ink'])
assert.equal(jsonFiles.get('scenes/scene_start.json'), scene)
assert.equal(jsonFiles.get('entities/item_caramel_latte.json'), entity)
assert.equal(jsonFiles.get('entities/entities/item_caramel_latte.json'), undefined)
assert.equal(jsonFiles.get('quests/quest_intro.json'), quest)
assert.ok(jsonFiles.has('dialogues/mark.dlg.json'), 'dialogue sidecar stays JSON')
assert.equal(typeof textFiles.get('dialogues/mark.ink'), 'string', 'missing Ink source is generated from its DlgDoc')
assert.ok(result.notes.some((note) => note.includes('entities/entities/item_caramel_latte.json')))

const zip = new JSZip()
zip.file('manifest.json', JSON.stringify({
  scenes: [], entities: ['entities/item.json'], rules: [], dialogues: [],
}))
zip.file('entities/entities/item.json', JSON.stringify(entity))
const zipNotes = await normalizeChronicleZip(zip)
assert.ok(zipNotes.length > 0)
assert.equal(zip.file('entities/entities/item.json'), null)
assert.ok(zip.file('entities/item.json'), 'standalone install relocates nested module files')
assert.deepEqual(JSON.parse(await zip.file('manifest.json')!.async('text')).entities, ['item.json'])
console.log('chronicle-manifest-smoke: ALL GREEN')
