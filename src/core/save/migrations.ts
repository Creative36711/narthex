/**
 * Цепочка переносов формата `GameState` (`docs/compatibility.md`, фаза A).
 * Шаги идут только вверх и сохраняются для поддержки старых сохранений.
 */

import type { GameState, SaveNote } from '../../shared/types'
import { SAVE_VERSION } from '../../shared/types'

/** Самый старый формат сохранения, который движок умеет перенести. */
export const OLDEST_SAVE_VERSION = 1

export interface ReportCtx {
  notes: SaveNote[]
  note(kind: SaveNote['kind'], text: string): void
}

export interface SaveMigration {
  from: number
  to: number
  /** короткое название шага — попадает в отчёт */
  title: string
  apply(state: GameState, ctx: ReportCtx): void
}

/**
 * Цепочка переноса. Шаг обязан быть идемпотентным и не требовать кампании
 * (кампания нужна только починке ссылок). Новые шаги добавляются в конец.
 */
export const SAVE_MIGRATIONS: SaveMigration[] = [
  {
    from: 1,
    to: 2,
    title: 'базовые поля состояния',
    apply(state, ctx) {
      const p = state.player
      if (!p) return
      let touched = false
      if (!p.skills || typeof p.skills !== 'object') {
        p.skills = {}
        touched = true
      }
      if (!p.skill_marks || typeof p.skill_marks !== 'object') {
        p.skill_marks = {}
        touched = true
      }
      if (!p.needs || typeof p.needs !== 'object') {
        p.needs = {}
        touched = true
      }
      if (!Array.isArray(state.fired_rules)) {
        state.fired_rules = []
        touched = true
      }
      if (!Array.isArray(state.log)) {
        state.log = []
        touched = true
      }
      if (touched) ctx.note('migrated', 'Восстановлены базовые поля сохранения (навыки, потребности, журнал).')
    },
  },
  {
    from: 2,
    to: 3,
    title: 'экипировка и валюты',
    apply(state, ctx) {
      const p = state.player
      if (!p) return
      // баланс валют живёт в инвентаре (предметы-монеты); старое поле мешает
      if (p.currencies) {
        delete p.currencies
        ctx.note('migrated', 'Баланс валют перенесён в инвентарь (монеты — обычные предметы).')
      }
      if (!Array.isArray(p.inventory)) {
        p.inventory = []
        ctx.note('migrated', 'Инвентарь пересоздан: в сохранении не было списка предметов.')
      }
    },
  },
  {
    from: 3,
    to: 4,
    title: 'слоты экипировки',
    apply(state, ctx) {
      const p = state.player
      if (!p) return
      // в3: equipment уже выглядит как «слот → предмет» (weapon/armor) —
      // модель блока 7 ТЗ совпадает, меняется только номер версии
      if (!p.equipment || typeof p.equipment !== 'object') {
        p.equipment = {}
        ctx.note('migrated', 'Список надетых вещей пересоздан (в сохранении не было экипировки).')
      }
    },
  },
]

/**
 * Перенос состояния до текущей версии формата.
 * Возвращает `false`, если сейв слишком древний или повреждён.
 */
export function migrateState(state: GameState, ctx: ReportCtx): boolean {
  const from = state.save_version ?? OLDEST_SAVE_VERSION
  if (from > SAVE_VERSION) return false // сейв из более нового движка
  let v = from
  let guard = 0
  while (v < SAVE_VERSION) {
    const step = SAVE_MIGRATIONS.find((m) => m.from === v)
    if (!step) return false
    step.apply(state, ctx)
    v = step.to
    state.save_version = v
    if (++guard > 64) return false // защита от петли в цепочке
  }
  state.save_version = SAVE_VERSION
  if (from !== SAVE_VERSION) {
    ctx.note('migrated', `Формат сохранения перенесён: в${from} → в${SAVE_VERSION}.`)
  }
  return true
}
