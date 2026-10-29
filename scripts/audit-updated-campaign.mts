import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'
import { auditCampaign } from '../src/editor/campaignAudit'
import type { CampaignData } from '../src/shared/types'

const root = '_ai-temp/campaing'

function loadJsonDir(dir: string) {
  const full = join(root, dir)
  if (!existsSync(full)) return {}
  const res: Record<string, any> = {}
  for (const f of readdirSync(full)) {
    if (f.endsWith('.json') && !f.endsWith('.dlg.json')) {
      const id = f.replace(/\.json$/, '')
      try {
        res[id] = JSON.parse(readFileSync(join(full, f), 'utf-8'))
      } catch (e) {
        console.error(`Error parsing ${f}:`, e)
      }
    }
  }
  return res
}

const meta = JSON.parse(readFileSync(join(root, 'campaign.json'), 'utf-8'))
const world = JSON.parse(readFileSync(join(root, 'world.json'), 'utf-8'))
const scenes = loadJsonDir('scenes')
const entities = loadJsonDir('entities')
const rules = loadJsonDir('rules')
const quests = loadJsonDir('quests')
const arenas = loadJsonDir('arenas')
const cutscenes = loadJsonDir('cutscenes')
const recipes = loadJsonDir('recipes')
const codex = loadJsonDir('codex')

// Загрузим диалоги из .ink
const dialogues: Record<string, string> = {}
const dlgDir = join(root, 'dialogues')
if (existsSync(dlgDir)) {
  for (const f of readdirSync(dlgDir)) {
    if (f.endsWith('.ink')) {
      const id = f.replace(/\.ink$/, '')
      dialogues[id] = readFileSync(join(dlgDir, f), 'utf-8')
    }
  }
}

const campaign: CampaignData = {
  meta,
  world,
  scenes,
  entities,
  rules,
  quests,
  arenas,
  cutscenes,
  recipes,
  codex,
  dialogues,
}

console.log('--- Запуск движкового аудита кампании (campaignAudit) ---')
const auditResult = auditCampaign(campaign)

console.log('Счётчик проблем:')
console.log('  Критических ошибок:', auditResult.errors.length)
console.log('  Предупреждений:', auditResult.warnings.length)
console.log('  Замечаний/инфо:', auditResult.info.length)

if (auditResult.errors.length > 0) {
  console.log('\nОшибки:')
  for (const err of auditResult.errors) {
    console.log(`  [ERROR] ${err.title}: ${err.description} (${err.path || ''})`)
  }
}

if (auditResult.warnings.length > 0) {
  console.log('\nПредупреждения (первые 20):')
  for (const warn of auditResult.warnings.slice(0, 20)) {
    console.log(`  [WARN] ${warn.title}: ${warn.description} (${warn.path || ''})`)
  }
}

console.log('\n--- Проверка завершена ---')
