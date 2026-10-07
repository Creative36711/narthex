import fs from 'node:fs'
import path from 'node:path'
import { createStory, drainStory, bindExternals, firstInkKnot } from '../src/core/dialogue'
import { inkToDlgDoc } from '../src/editor/inkImport'

const manifestPath = '_ai-temp/campaing/manifest.json'
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
const dialogueFiles: string[] = manifest.dialogues || []

console.log('Manifest dialogues count:', dialogueFiles.length)

// Фиктивный engine для проверки вызовов ink EXTERNAL
const dummyEngine: any = {
  state: {
    flags: {},
    counters: {},
    factions: {},
    npc_relations: {},
    player: {
      hp: 30,
      max_hp: 30,
      inventory: [{ item: 'item_guard_token', quantity: 1 }],
      statuses: [],
      skills: {},
    },
  },
  getFlag: () => 0,
  setFlag: () => {},
  hasItem: () => 1,
  itemCount: () => 1,
  addItem: () => {},
  removeItem: () => {},
  hasStatus: () => 0,
  applyStatus: () => {},
  removeStatus: () => {},
  changeHp: () => {},
  changeDisposition: () => {},
  getDisposition: () => 50,
  skillCheck: () => 1,
  setDescription: () => {},
  setEntityState: () => {},
  openTrade: () => {},
  openCraft: () => {},
  unlockRecipe: () => {},
  unlockCodex: () => {},
  fireRule: () => {},
  setDialogueTimer: () => {},
  advanceTime: () => {},
  joinParty: () => {},
  learnNpcName: () => {},
  isNpcNameKnown: () => true,
}

let totalErrors = 0
let totalWarnings = 0

for (const dlgFile of dialogueFiles) {
  const inkPath = path.join('_ai-temp/campaing/dialogues', dlgFile)
  const dlgJsonPath = inkPath.replace(/\.ink$/, '.dlg.json')
  console.log(`\n==================================================`)
  console.log(`Checking dialogue: ${dlgFile}`)
  
  if (!fs.existsSync(inkPath)) {
    console.error(`❌ File not found: ${inkPath}`)
    totalErrors++
    continue
  }
  
  const inkContent = fs.readFileSync(inkPath, 'utf-8')
  
  // 1. Проверка синтаксиса Ink и компиляции
  let story: any = null
  try {
    story = createStory(inkContent, dlgFile)
    console.log(`✓ inkjs createStory: OK`)
  } catch (err: any) {
    console.error(`❌ createStory FAILED:`, err.message)
    totalErrors++
  }

  // 2. Исполнение диалога (проверка первого шага)
  if (story) {
    try {
      bindExternals(story, dummyEngine)
      const knot = firstInkKnot(inkContent)
      if (knot) story.ChoosePathString(knot)
      const initial = drainStory(story)
      console.log(`✓ drainStory: knot="${knot}", lines=${initial.lines.length}, choices=${initial.choices.length}, finished=${initial.finished}`)
      if (initial.lines.length > 0) {
        console.log(`  Первая реплика: "${initial.lines[0].text}"`)
      }
      if (initial.choices.length > 0) {
        console.log(`  Варианты ответа (${initial.choices.length}):`, initial.choices.map((c: any) => c.text))
      }
      if (initial.lines.length === 0 && initial.choices.length === 0 && !initial.finished) {
        console.warn(`⚠️ Warning: initial step has no lines, no choices and not finished!`)
        totalWarnings++
      }
    } catch (err: any) {
      console.error(`❌ drainStory FAILED:`, err.message)
      totalErrors++
    }
  }

  // 3. Импорт в визуальный DlgDoc (проверка конструктора)
  try {
    const res = inkToDlgDoc(inkContent)
    console.log(`✓ inkToDlgDoc: nodes=${res.doc.nodes.length}, warnings=${res.warnings.length}`)
    if (res.warnings.length > 0) {
      console.log(`  Warnings from importer:`, res.warnings)
      totalWarnings += res.warnings.length
    }
  } catch (err: any) {
    console.error(`❌ inkToDlgDoc FAILED:`, err.message)
    totalErrors++
  }

  // 4. Проверка .dlg.json (если есть)
  if (fs.existsSync(dlgJsonPath)) {
    try {
      const jsonContent = JSON.parse(fs.readFileSync(dlgJsonPath, 'utf-8'))
      console.log(`✓ .dlg.json: label="${jsonContent.label}", nodes=${jsonContent.nodes?.length ?? 0}`)
    } catch (err: any) {
      console.error(`❌ .dlg.json parse FAILED:`, err.message)
      totalErrors++
    }
  } else {
    console.warn(`⚠️ Missing .dlg.json for ${dlgFile}`)
    totalWarnings++
  }

  // 5. Проверка префиксов говорящего
  const lines = inkContent.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line || line.startsWith('===') || line.startsWith('->') || line.startsWith('//') || line.startsWith('~') || line.startsWith('+') || line.startsWith('*')) {
      continue
    }
    const match = line.match(/^([\p{Lu}\p{Lt}][\p{L}\s.-]{1,30}):\s*[«"“]([\s\S]+?)[»"”]$/u)
    if (match) {
      console.warn(`⚠️ Speaker prefix found at line ${i + 1}: ${line}`)
      totalWarnings++
    }
  }
}

console.log(`\n==================================================`)
console.log(`Total checked: ${dialogueFiles.length}, Errors: ${totalErrors}, Warnings: ${totalWarnings}`)
