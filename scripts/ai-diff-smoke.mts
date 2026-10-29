#!/usr/bin/env node
/**
 * Регрессионный смоук «список изменений ИИ-мастера» (фидбек 2026-10:
 * «просто просмотрел диалог — в списке уже изменение»).
 *
 * Проверяет EditorStore.getModifiedFiles():
 *  1. свежая точка отсчёта → список пуст;
 *  2. перестановка ключей / изменение отступов в .json — НЕ изменение
 *     (семантическое сравнение);
 *  3. текстовые файлы (.ink/.md) сравниваются строго;
 *  4. реальное изменение значения → строка «modified» появляется;
 *  5. новый файл и удалённый файл → «added»/«deleted»;
 *  6. acceptChangeAsBaseline убирает конкретный ряд (принятие правки/производной файла,
 *     на нём стоят фиксы автоконвертаций диалогов).
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { EditorStore } from '../src/editor/store'

// Версия движка в фикстуре — из package.json: смоук проверяет дифф, а не номер,
// и не должен краснеть/устаревать при каждом bump.
const ENGINE_VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version as string

const store = new EditorStore('/campaigns/__diff_smoke__')

store.meta = {
  id: 'test_diff',
  title: 'Дифф-smoke',
  author: 'Tester',
  version: '1.0.0',
  engine_version: ENGINE_VERSION,
  tick_label: 'ч',
  default_player: 'hero',
  starting_region: 'reg_1',
  starting_location: 'loc_1',
  starting_scene: 'scene_1',
  needs: [],
  currencies: [],
} as typeof store.meta
store.world = { regions: [] } as unknown as typeof store.world
store.manifest = { scenes: [], entities: [] } as unknown as typeof store.manifest
store.jsonFiles.set('rules/rule_a.json', { id: 'rule_a', once: true, conditions: [], effects: [{ type: 'banner', text: 'хай' }] })
store.textFiles.set('dialogues/talk.ink', '== intro ==\nПривет.\n')

function freshStore(): EditorStore {
  const s = new EditorStore('/campaigns/__diff_smoke__')
  s.meta = store.meta
  s.world = store.world
  s.manifest = store.manifest
  for (const [k, v] of store.jsonFiles) s.jsonFiles.set(k, JSON.parse(JSON.stringify(v)))
  for (const [k, v] of store.textFiles) s.textFiles.set(k, v)
  return s
}

console.log('--- ai-diff-smoke ---')

// 1. Чистая точка отсчёта → пустой список
{
  const s = freshStore()
  s.captureBaseline()
  assert.equal(s.getModifiedFiles().length, 0, 'сразу после captureBaseline список пуст')
}

// 2. Перестановка ключей / отступов в JSON — это НЕ изменение мастера
{
  const s = freshStore()
  s.captureBaseline()
  // как бы «нормализация»: те же данные, ключи переупорядочены, а массив — другой формы списока
  s.jsonFiles.set('rules/rule_a.json', { effects: [{ text: 'хай', type: 'banner' }], id: 'rule_a', conditions: [], once: true })
  const mods = s.getModifiedFiles()
  assert.equal(mods.length, 0, 'перестановка ключей в .json не должна всплывать как изменение')
}

// 3. Строгое сравнение для текстовых файлов
{
  const s = freshStore()
  s.captureBaseline()
  s.textFiles.set('dialogues/talk.ink', '== intro ==\nПривет! \n') // добавился пробел/!
  const mods = s.getModifiedFiles()
  assert.equal(mods.length, 1, 'изменённый ink — одна строка')
  assert.equal(mods[0]!.status, 'modified')
  assert.equal(mods[0]!.path, 'dialogues/talk.ink')
}

// 4. Реальное изменение значения в JSON → строка появляется
{
  const s = freshStore()
  s.captureBaseline()
  const rule = JSON.parse(JSON.stringify(s.jsonFiles.get('rules/rule_a.json')))
  rule.effects[0].text = 'пока'
  s.jsonFiles.set('rules/rule_a.json', rule)
  const mods = s.getModifiedFiles()
  assert.equal(mods.length, 1, 'изменённое значение — изменение')
  assert.equal(mods[0]!.status, 'modified')
}

// 5. Добавленный и удалённый файлы
{
  const s = freshStore()
  s.captureBaseline()
  s.jsonFiles.set('rules/rule_b.json', { id: 'rule_b', conditions: [], effects: [] })
  s.textFiles.delete('dialogues/talk.ink')
  const mods = s.getModifiedFiles()
  const byPath = new Map(mods.map((m) => [m.path, m.status]))
  assert.equal(byPath.get('rules/rule_b.json'), 'added', 'новый файл — added')
  assert.equal(byPath.get('dialogues/talk.ink'), 'deleted', 'удалённый файл — deleted')
}

// 6. acceptChangeAsBaseline снимает конкретный ряд (механика фикса производных:
//    автоконвертация диалогов пиннет созданный ею dlg.json/нормализацию)
{
  const s = freshStore()
  s.captureBaseline()
  // симулируем автоконвертацию зрителя: появился производный dlg.json
  s.jsonFiles.set('dialogues/talk.dlg.json', { id: 'talk', label: 'Разговор', nodes: [] })
  let mods = s.getModifiedFiles()
  assert.equal(mods.some((m) => m.path === 'dialogues/talk.dlg.json' && m.status === 'added'), true, 'до приёма — ряд есть')
  s.acceptChangeAsBaseline('dialogues/talk.dlg.json')
  mods = s.getModifiedFiles()
  assert.equal(mods.length, 0, 'после приёма производного файла список снова пуст — просмотр не оставляет следа')
}

console.log('✓ ai-diff-smoke: все проверки зелёные')
