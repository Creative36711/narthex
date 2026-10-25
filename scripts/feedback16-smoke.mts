import '../packs/narrative/operations'
/**
 * Смоук-ревизия фидбека 16 (описания сущностей):
 * 1. у NPC появилось описание (типы, редактор, заготовки);
 * 2. при наведении — имя и описание (без двойного имени);
 * 3. описание динамически меняется действием set_description (правила/диалоги);
 * 4. все JSON демо-кампании и шаблон промпта ИИ обновлены.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const rd = (p: string) => readFileSync(join(root, p), 'utf-8')
const checks: Array<[string, boolean]> = []

const types = rd('src/shared/types.ts')
const engine = rd('src/core/engine.ts')
const dialogue = rd('src/core/dialogue.ts')
const schemas = rd('src/editor/schemas.ts')
const entEditor = rd('src/editor/EntityEditor.tsx')
const dlgBuilder = rd('src/editor/DialogueBuilder.tsx')
const dlgDoc = rd('src/editor/dialogueDoc.ts')
const scene = rd('src/player/SceneScreen.tsx')
const combat = rd('src/player/CombatScreen.tsx')
const css = rd('src/index.css')
const migrate = rd('src/shared/migrate.ts')
const store = rd('src/editor/store.ts')
const guide = rd('docs/ai-campaign-guide.md')

// 1) типы: описание NPC + действие + состояние
checks.push([
  'NpcDef.description объявлен (как у предметов)',
  /export interface NpcDef \{[\s\S]*?description: string/.test(types),
])
checks.push([
  'set_description есть в Effect и DlgEffect',
  /export type Effect =[\s\S]*?'set_description'; entity: string; text: string/.test(types) &&
    /export type DlgEffect =[\s\S]*?'set_description'/.test(types),
])
checks.push(['GameState.desc_overrides для динамических описаний', types.includes('desc_overrides?: Record<string, string>')])

// 2) наведение: имя + описание, без двойного имени
checks.push([
  'Сцена: тултип показывает имя и описание',
  scene.includes('data-tip={`${entity.label}') && scene.includes('engine.descOf(entity.id)'),
])
checks.push([
  'Бой: тултип жетона показывает имя и описание',
  combat.includes('engine.descOf(c.entityId)'),
])
checks.push([
  'Имя под сущностью не дублирует тултип; переносы строк работают',
  css.includes('white-space: pre-line') && !css.includes('.slot-hotspot:hover .slot-label { opacity: 1; }'),
])

// 3) описание NPC в редакторе и заготовках
checks.push([
  'Поле «Описание» в форме NPC',
  entEditor.includes('<span>Описание</span>') && entEditor.includes('npc.description'),
])
checks.push([
  'Заготовки NPC с описанием (newCampaign, EditorApp, monolith)',
  rd('src/editor/newCampaign.ts').includes("description: ''") &&
    rd('src/editor/EditorApp.tsx').includes("description: ''") &&
    rd('src/editor/monolith.ts').includes("description: ''"),
])

// 4) динамика: действие в реестрах, движке и Ink
checks.push([
  'set_description в конструкторе эффектов (правила/квесты)',
  schemas.includes('set_description:') && schemas.includes("label: 'Изменить описание'"),
])
checks.push([
  'Движок: применение действия и чтение актуального описания',
  engine.includes("case 'set_description'") && engine.includes('descOf(') && engine.includes('setEntityDescription('),
])
checks.push([
  'Диалоги: эффект реплики + внешняя функция Ink',
  dlgBuilder.includes("id: 'set_description'") && dlgBuilder.includes("case 'set_description'") &&
    dlgDoc.includes('set_description(') && dialogue.includes("bind('set_description'"),
])
checks.push([
  'Миграция старых данных: description подставляется',
  migrate.includes('migrateEntity') && store.includes(".description = ''"),
])

// 5) JSON и шаблон ИИ
const npcFiles = readdirSync(join(root, 'public/campaigns/ash-of-caerden/entities')).filter((f) => f.startsWith('npc_'))
const allNpcHaveDesc = npcFiles.every((f) => {
  const d = JSON.parse(rd(`public/campaigns/ash-of-caerden/entities/${f}`)) as { description?: unknown }
  return typeof d.description === 'string' && d.description.length > 0
})
checks.push([`Все NPC демо-кампании с описанием (${npcFiles.length} файлов)`, npcFiles.length > 0 && allNpcHaveDesc])
checks.push([
  'Демо динамического описания в правилах (Мэва)',
  rd('public/campaigns/ash-of-caerden/rules/rule_maeva_thanks.json').includes('set_description'),
])
checks.push([
  'Шаблон промпта ИИ: description у NPC + set_description задокументирован',
  guide.includes('"description": "Хозяйка таверны') && guide.includes('set_description'),
])

let failed = 0
for (const [name, ok] of checks) {
  if (!ok) failed++
  console.log(`${ok ? 'ok ' : 'FAIL'} ${name}`)
}
console.log(failed === 0 ? 'ALL GREEN (feedback16)' : `FAILED: ${failed}`)
process.exit(failed === 0 ? 0 : 1)
