import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import type { SlotDef } from '../src/shared/types'

console.log('--- Смоук-тест: Хотспоты окружения, превью в редакторе сущностей и спрайты в сценах ---')

// 1. Проверка структуры SlotDef с полем environmental
const testSlot: SlotDef = {
  id: 'slot_box',
  label: 'Ящик с кладью',
  type: ['item'],
  shape: 'rect',
  x: 100,
  y: 100,
  w: 200,
  h: 150,
  default_entity: 'item_box',
  condition: null,
  environmental: true,
}

assert.equal(testSlot.environmental, true, 'Поле environmental доступно в SlotDef')

// 2. Проверка CSS стилей для хотспота окружения
const css = readFileSync('src/index.css', 'utf8')
assert.ok(css.includes('.slot-hotspot.slot-environmental'), 'CSS содержит класс .slot-hotspot.slot-environmental')
assert.ok(css.includes('.slot-env-label'), 'CSS содержит класс .slot-env-label для центрированной подписи')
assert.ok(css.includes('border-color: transparent !important'), 'У .slot-environmental рамка прозрачна')

// 3. Проверка стилей редактора для превью картинок
const edCss = readFileSync('src/editor/editor.css', 'utf8')
assert.ok(edCss.includes('.img-upload-preview-wrap'), 'CSS редактора содержит обёртку .img-upload-preview-wrap')
assert.ok(edCss.includes('object-fit: contain'), 'Превью изображений использует object-fit: contain (целиком без обрезания)')
assert.ok(edCss.includes('.img-lightbox-overlay'), 'CSS редактора содержит стили модального лайтбокса .img-lightbox-overlay')

// 4. Проверка SceneEditor: спрайты слотов и чекбокс environmental
const sceneEd = readFileSync('src/editor/SceneEditor.tsx', 'utf8')
assert.ok(sceneEd.includes('SlotEntitySprite'), 'SceneEditor содержит компонент SlotEntitySprite для отображения спрайта в слоте')
assert.ok(sceneEd.includes('slot.environmental'), 'SceneEditor содержит поддержку slot.environmental')
assert.ok(sceneEd.includes('Хотспот окружения'), 'SceneEditor содержит чекбокс «Хотспот окружения»')

console.log('✓ Все проверки хотспотов окружения, спрайтов и превью редактора пройдены успешно!')
