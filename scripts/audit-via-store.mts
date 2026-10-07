import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'
import { EditorStore } from '../src/editor/store'
import { validateCampaign, auditCounts, formatCampaignAuditReport } from '../src/editor/campaignAudit'

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

console.log('Store jsonFiles count:', store.jsonFiles.size)
console.log('Store textFiles count:', store.textFiles.size)

const issues = store.validateContent()
console.log('\n--- Проверка store.validateContent() ---')
console.log('Найдено замечаний:', issues.length)
for (const iss of issues) {
  console.log(' ·', iss)
}

validateCampaign(store).then((report) => {
  console.log('\n--- Полный отчет validateCampaign ---')
  const counts = auditCounts(report)
  console.log('Errors:', counts.errors)
  console.log('Warnings:', counts.warnings)
  console.log('Info:', counts.info)
  console.log(formatCampaignAuditReport(report))
})

