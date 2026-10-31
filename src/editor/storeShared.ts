import type { Effect } from '../shared/types'

/** Глубина вложенных вызовов правил совпадает с ограничением движка. */
export const FIRE_RULE_MAX_DEPTH = 2

/** обойти эффекты (в том числе вложенные списки внутри ветвлений) */
export function walkEffects(effects: Effect[], fn: (e: Effect) => void): void {
  for (const e of effects ?? []) {
    fn(e)
    if (e.type === 'skill_check_gate') {
      walkEffects(e.success_effects ?? [], fn)
      walkEffects(e.fail_effects ?? [], fn)
    } else if (e.type === 'stat_check') {
      walkEffects(e.success_effects ?? [], fn)
      walkEffects(e.fail_effects ?? [], fn)
    } else if (e.type === 'opposed_check') {
      walkEffects(e.success_effects ?? [], fn)
      walkEffects(e.fail_effects ?? [], fn)
    } else if (e.type === 'group_stat_check') {
      walkEffects(e.success_effects ?? [], fn)
      walkEffects(e.fail_effects ?? [], fn)
    } else if (e.type === 'start_pursuit') {
      walkEffects(e.on_fail ?? [], fn)
    }
  }
}
