import { existsSync } from 'fs'
import { join } from 'path'
import { EditorStore } from '../src/editor/store'
import { collectCampaignMedia } from '../src/editor/campaignAudit'
import { readFileSync, readdirSync } from 'fs'

const root = '_ai-temp/campaing'
const store = new EditorStore()

store.meta = JSON.parse(readFileSync(join(root, 'campaign.json'), 'utf-8'))
store.world = JSON.parse(readFileSync(join(root, 'world.json'), 'utf-8'))
store.manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf-8'))

function walk(dir: string, prefix = '') {
  const full = join(root, dir)
  if (!existsSync(full)) return
  for (const name of readdirSync(full)) {
    const rel = prefix ? `${prefix}/${name}` : name
    const sub = join(full, name)
    if (name.endsWith('.json')) {
      store.jsonFiles.set(rel, JSON.parse(readFileSync(sub, 'utf-8')))
    } else if (name.endsWith('.ink') || name.endsWith('.md')) {
      store.textFiles.set(rel, readFileSync(sub, 'utf-8'))
    }
  }
}

for (const sub of ['scenes', 'entities', 'rules', 'quests', 'arenas', 'cutscenes', 'recipes', 'codex', 'dialogues']) {
  walk(sub, sub)
}

const media = collectCampaignMedia(store)
console.log('Total local media references:', media.local.length)

let missing = 0
for (const p of media.local) {
  const full = join(root, p)
  if (!existsSync(full)) {
    console.warn('MISSING on disk:', p)
    missing++
  }
}

console.log('Total missing files on disk:', missing)
