import type { EditorStore } from './store'
import type { EntityDef } from '../shared/types'

/**
 * Типы слотов сцены (фидбек №2–3 пятого раунда): встроенные + свои из
 * реестра кампании. У каждой сущности есть «тип в слотах» — по нему
 * фильтруется, кого можно поставить в слот.
 */

export const BUILTIN_SLOT_TYPES: Array<{ id: string; label: string }> = [
  { id: 'person', label: 'Персонаж' },
  { id: 'item', label: 'Предмет' },
  { id: 'container', label: 'Контейнер' },
  { id: 'furniture', label: 'Мебель' },
  { id: 'animal', label: 'Животное' },
]

/** полный реестр типов слотов кампании: встроенные + свои */
export function slotTypesFor(store: EditorStore): Array<{ id: string; label: string }> {
  const custom = store.meta.slot_types ?? []
  return [...BUILTIN_SLOT_TYPES.filter((b) => !custom.some((c) => c.id === b.id)), ...custom]
}

/** русское название типа слота */
export function slotTypeLabel(store: EditorStore, id: string): string {
  return slotTypesFor(store).find((t) => t.id === id)?.label ?? id
}

/** тип сущности в слотах: явный slot_type или разумное умолчание */
export function effectiveSlotType(e: EntityDef): string {
  if (e.slot_type) return e.slot_type
  if (e.type === 'npc') return 'person'
  return e.category === 'container' ? 'container' : 'item'
}

/** умолчание без явного slot_type (для подписи «авто: …» в форме) */
export function defaultSlotType(e: EntityDef): string {
  if (e.type === 'npc') return 'person'
  return e.category === 'container' ? 'container' : 'item'
}
