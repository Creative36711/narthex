import type { EditorStore } from './store'
import type { EntityDef } from '../shared/types'

/**
 * Типы слотов сцены. Встроенных типов НЕТ (правка «без хардкода»):
 * реестр целиком задаёт кампания — мастер создаёт типы сам. У каждой
 * сущности есть «тип в слотах» — по нему фильтруется, кого можно
 * поставить в слот.
 */

/** реестр типов слотов кампании */
export function slotTypesFor(store: EditorStore): Array<{ id: string; label: string }> {
  return store.meta.slot_types ?? []
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
