import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { inkToDlgDoc } from '../src/editor/inkImport'
import { createStory, clearDialogueCache, sanitizeInkSource } from '../src/core/dialogue'
import { loadCampaign } from '../src/core/loader'
import { GameEngine } from '../src/core/engine'
import { skipIfMissingFixture } from './fixture-guard.mts'

skipIfMissingFixture(
  '_ai-temp/campaing/campaign/dialogues',
  'импорт шести ink-диалогов кампании сценариста без предупреждений',
)

console.log('--- Смоук-тест: Диалоги новой кампании в конструкторе и игре ---')

clearDialogueCache()

// 1. Все 6 диалогов импортируются через inkToDlgDoc без единого warning
const dir = '_ai-temp/campaing/campaign/dialogues'
const files = ['brin.ink', 'caleb.ink', 'maeva.ink', 'peddler.ink', 'rud.ink', 'torg.ink']

for (const file of files) {
  const content = fs.readFileSync(path.join(dir, file), 'utf-8')
  const { doc, warnings } = inkToDlgDoc(content, file)
  assert.equal(warnings.length, 0, `Диалог ${file} должен импортироваться без предупреждений, но получил: ${warnings.join('; ')}`)
  assert.ok(doc.nodes.length > 0, `Диалог ${file} должен содержать узлы`)
  console.log(`✓ inkToDlgDoc ${file}: узлов = ${doc.nodes.length}, warnings = 0`)
}

// 2. Все 6 диалогов компилируются createStory без ошибок
for (const file of files) {
  const content = fs.readFileSync(path.join(dir, file), 'utf-8')
  const story = createStory(content, `dialogues/${file}`)
  assert.ok(story, `createStory для ${file} должен вернуть объект Story`)
  console.log(`✓ createStory ${file}: компиляция успешна`)
}

// 3. Запуск диалогов в GameEngine: ни у кого нет «Диалог недоступен»
const root = path.resolve('_ai-temp/campaing/campaign')
const prevFetch = globalThis.fetch
globalThis.fetch = async (url: string | URL | Request) => {
  const rel = String(url).replace(/^\/campaigns\/shepot-shesteren\/?/, '').replace(/^\/+/, '')
  const filePath = path.join(root, rel)
  if (!fs.existsSync(filePath)) {
    return { ok: false, status: 404, statusText: 'Not Found', json: async () => ({}), text: async () => '' } as unknown as Response
  }
  const txt = fs.readFileSync(filePath, 'utf-8')
  return { ok: true, status: 200, json: async () => JSON.parse(txt), text: async () => txt } as unknown as Response
}

try {
  const camp = await loadCampaign('/campaigns/shepot-shesteren')
  const engine = new GameEngine(camp)

  const npcs = [
    { id: 'npc_brin', name: 'Брин-посыльный' },
    { id: 'npc_maeva', name: 'Мавра' },
    { id: 'npc_rud', name: 'Стражник Руд' },
    { id: 'npc_torg', name: 'Торг' },
    { id: 'npc_caleb', name: 'Калеб' },
    { id: 'npc_peddler', name: 'Разносчик Нилс' },
  ]

  for (const { id, name } of npcs) {
    engine.dialogue = null
    engine.messages = []
    engine.startDialogue(id)

    assert.ok(engine.dialogue, `Диалог с ${name} (${id}) должен открыться`)
    assert.ok(engine.dialogue.lines.length > 0, `Диалог с ${name} должен содержать реплики`)
    assert.ok(engine.dialogue.choices.length > 0, `Диалог с ${name} должен содержать варианты ответов`)
    const unavailableMsg = engine.messages.find((m) => m.text.includes('недоступен'))
    assert.equal(unavailableMsg, undefined, `Не должно быть сообщения «Диалог недоступен» для ${name}`)
    console.log(`✓ GameEngine startDialogue(${id}): ${name} успешно начал разговор (${engine.dialogue.choices.length} выборов)`)
  }
} finally {
  globalThis.fetch = prevFetch
}

// 4. Тест устойчивости sanitizeInkSource на неидеальном коде
const messyInk = `
=== main ===
* * *
Привет, {имя}!
* { has_item("item_potion") >= 2:
    Пей на здоровье!
    ~ change_hp(10)
    -> main_choice
}
- -> main
`
const cleaned = sanitizeInkSource(messyInk)
const story = createStory(cleaned, 'test_messy')
assert.ok(story, 'Story должна компилироваться даже для неидеального рукописного Ink')
console.log('✓ sanitizeInkSource корректно нивелирует разделители, пропущенные переменные и опечатки маркеров')

console.log('dialogues-round31-smoke: ALL GREEN')
