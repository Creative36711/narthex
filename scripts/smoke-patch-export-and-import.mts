import assert from 'node:assert'
import JSZip from 'jszip'
import { EditorStore } from '../src/editor/store'
import { exportPatchChronicle, importChronicle } from '../src/editor/chronicle'

console.log('--- Smoke test: Patch Chronicle Export & Import ---')

// 1. Создаем тестовую кампанию в памяти
const store = new EditorStore('/test')
store.meta = {
  id: 'test-patch-campaign',
  title: 'Тестовая кампания',
  version: '1.0.0',
  engine_version: '0.8.0',
  min_engine: '0.8.0',
  package_format: 1,
  tick_label: 'час',
  ticks_per_day: 24,
  time_of_day: { morning: 6, day: 10, evening: 18, night: 22 },
  starting_region: 'reg_1',
  starting_location: 'loc_1',
  starting_scene: 'scene_1',
  starting_tick: 0,
  default_player: 'hero',
  max_companions: 2,
  save_slots: 3,
}
store.world = { regions: [{ id: 'reg_1', label: 'Регион 1', locations: ['loc_1'] }] }
store.manifest = {
  scenes: ['scene_1.json', 'scene_2.json'],
  entities: ['item_sword.json', 'item_shield.json'],
  rules: [],
  dialogues: ['test.ink'],
}
store.jsonFiles.set('scenes/scene_1.json', { id: 'scene_1', label: 'Комната 1', slots: [] })
store.jsonFiles.set('scenes/scene_2.json', { id: 'scene_2', label: 'Комната 2', slots: [] })
store.jsonFiles.set('entities/item_sword.json', { id: 'item_sword', type: 'item', label: 'Меч', value: { silver: 10 } })
store.jsonFiles.set('entities/item_shield.json', { id: 'item_shield', type: 'item', label: 'Щит', value: { silver: 15 } })
store.textFiles.set('dialogues/test.ink', '=== Начало ===\nПривет!\n-> END\n')

// Фиксируем baseline (базовое состояние)
store.captureBaseline()
assert.strictEqual(store.getModifiedFiles().length, 0, 'В базовом состоянии изменений 0')
console.log('✓ Базовый снимок успешно зафиксирован, список изменений пуст')

// 2. Вносим изменения: меняем цену меча и добавляем новое зелье
store.jsonFiles.set('entities/item_sword.json', { id: 'item_sword', type: 'item', label: 'Меч мастера', value: { silver: 50 } })
store.jsonFiles.set('entities/item_potion.json', { id: 'item_potion', type: 'item', label: 'Лечебное зелье', value: { silver: 5 } })
store.manifest.entities.push('item_potion.json')

const mods = store.getModifiedFiles()
assert.strictEqual(mods.length, 3, 'Зафиксировано 3 изменения (item_sword, item_potion, manifest.json)')

const swordMod = mods.find((m) => m.path === 'entities/item_sword.json')
assert.ok(swordMod, 'item_sword в списке изменений')
assert.strictEqual(swordMod?.status, 'modified', 'item_sword имеет статус modified')
assert.strictEqual(swordMod?.title, 'Предмет: Меч мастера')

const potionMod = mods.find((m) => m.path === 'entities/item_potion.json')
assert.ok(potionMod, 'item_potion в списке изменений')
assert.strictEqual(potionMod?.status, 'added', 'item_potion имеет статус added')
assert.strictEqual(potionMod?.title, 'Предмет: Лечебное зелье')
console.log('✓ Изменения и добавления точно отслежены:', mods.map((m) => `${m.status}: ${m.title}`).join(', '))

// 3. Проверяем генерацию сводки для чата
const summary = store.getChangesSummaryText()
assert.ok(summary.includes('Предмет: Меч мастера'), 'Сводка содержит меч')
assert.ok(summary.includes('Предмет: Лечебное зелье'), 'Сводка содержит зелье')
console.log('✓ Текстовая сводка для буфера сгенерирована корректно')

// 4. Проверяем экспорт патча
const { blob, filename, modifiedCount } = await exportPatchChronicle(store)
assert.strictEqual(modifiedCount, 3, 'Экспортировано 3 измененных файла')
assert.ok(filename.includes('patch'), 'Имя файла содержит patch')

const arrayBuffer = await blob.arrayBuffer()
const zip = await JSZip.loadAsync(arrayBuffer)
const zipFiles = Object.keys(zip.files)

assert.ok(zipFiles.includes('entities/item_sword.json'), 'Архив содержит item_sword')
assert.ok(zipFiles.includes('entities/item_potion.json'), 'Архив содержит item_potion')
assert.ok(zipFiles.includes('manifest.json'), 'Архив содержит manifest.json')
assert.ok(zipFiles.includes('CHANGES.md'), 'Архив содержит CHANGES.md')
assert.ok(zipFiles.includes('__chronicle_ai__/TASK.md'), 'Архив содержит TASK.md для агента')

// В патче НЕ ДОЛЖНО быть неизмененных файлов!
assert.ok(!zipFiles.includes('scenes/scene_1.json'), 'Неизмененная сцена 1 НЕ включена в патч')
assert.ok(!zipFiles.includes('scenes/scene_2.json'), 'Неизмененная сцена 2 НЕ включена в патч')
assert.ok(!zipFiles.includes('entities/item_shield.json'), 'Неизмененный щит НЕ включен в патч')
assert.ok(!zipFiles.includes('dialogues/test.ink'), 'Неизмененный диалог НЕ включен в патч')
console.log('✓ Пакет изменений содержит ТОЛЬКО изменённые файлы и исключает неизменённый контент')

// 5. Проверяем импорт патча поверх исходной кампании
const storeTarget = new EditorStore('/test')
storeTarget.meta = { ...store.meta }
storeTarget.world = { ...store.world }
storeTarget.manifest = {
  scenes: ['scene_1.json', 'scene_2.json'],
  entities: ['item_sword.json', 'item_shield.json'],
  rules: [],
  dialogues: ['test.ink'],
}
storeTarget.jsonFiles.set('scenes/scene_1.json', { id: 'scene_1', label: 'Комната 1', slots: [] })
storeTarget.jsonFiles.set('scenes/scene_2.json', { id: 'scene_2', label: 'Комната 2', slots: [] })
storeTarget.jsonFiles.set('entities/item_sword.json', { id: 'item_sword', type: 'item', label: 'Меч', value: { silver: 10 } })
storeTarget.jsonFiles.set('entities/item_shield.json', { id: 'item_shield', type: 'item', label: 'Щит', value: { silver: 15 } })
storeTarget.textFiles.set('dialogues/test.ink', '=== Начало ===\nПривет!\n-> END\n')

const mockFile = new File([blob], filename, { type: 'application/zip' })

const importResult = await importChronicle(storeTarget, mockFile)
assert.ok(importResult.corrections.some((c) => c.includes('Применён пакет изменений')), 'Импорт распознал патч')

// Проверяем, что обновленный меч на месте
const targetSword = storeTarget.jsonFiles.get('entities/item_sword.json') as any
assert.strictEqual(targetSword.label, 'Меч мастера', 'Меч обновлен до версии мастера')
assert.strictEqual(targetSword.value.silver, 50, 'Цена меча обновлена')

// Проверяем, что новое зелье добавилось
const targetPotion = storeTarget.jsonFiles.get('entities/item_potion.json') as any
assert.strictEqual(targetPotion.label, 'Лечебное зелье', 'Новое зелье добавлено в кампанию')

// Проверяем, что нетронутые файлы остались в целости и сохранности
assert.ok(storeTarget.jsonFiles.has('scenes/scene_1.json'), 'Сцена 1 осталась на месте')
assert.ok(storeTarget.jsonFiles.has('scenes/scene_2.json'), 'Сцена 2 осталась на месте')
assert.ok(storeTarget.jsonFiles.has('entities/item_shield.json'), 'Щит остался на месте')
assert.ok(storeTarget.textFiles.has('dialogues/test.ink'), 'Диалог остался на месте')

console.log('✓ Патч успешно применён поверх целевой кампании без потери нетронутых файлов')
console.log('--- Все проверки пакета изменений (Diff Patch) успешно пройдены! ---')
