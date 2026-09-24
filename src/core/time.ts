import type { CampaignMeta, TimeOfDay, TimeOfDayThresholds } from '../shared/types'

/** Система времени (ТЗ 4.1). */

const DEFAULT_THRESHOLDS: TimeOfDayThresholds = { morning: 6, day: 11, evening: 18, night: 22 }

export function hourOfDay(tick: number, meta: CampaignMeta): number {
  return ((tick % meta.ticks_per_day) + meta.ticks_per_day) % meta.ticks_per_day
}

export function dayNumber(tick: number, meta: CampaignMeta): number {
  return Math.floor(tick / meta.ticks_per_day) + 1
}

export function timeOfDay(tick: number, meta: CampaignMeta): TimeOfDay {
  const t = meta.time_of_day ?? DEFAULT_THRESHOLDS
  const h = hourOfDay(tick, meta)
  if (h >= t.night || h < t.morning) return 'night'
  if (h >= t.evening) return 'evening'
  if (h >= t.day) return 'day'
  return 'morning'
}

export const TIME_OF_DAY_LABEL: Record<TimeOfDay, string> = {
  morning: 'Утро',
  day: 'День',
  evening: 'Вечер',
  night: 'Ночь',
}

/** "День 3, 14:00" */
export function formatTime(tick: number, meta: CampaignMeta): string {
  const day = dayNumber(tick, meta)
  const h = hourOfDay(tick, meta)
  // если тик = час и в сутках 24 тика — показываем часы, иначе абстрактно
  if (meta.ticks_per_day === 24) {
    return `День ${day}, ${String(h).padStart(2, '0')}:00`
  }
  return `День ${day}, ${meta.tick_label} ${h + 1}/${meta.ticks_per_day}`
}

/** Попадает ли час в диапазон расписания [from, to) с поддержкой перехода через полночь. */
export function inTimeRange(hour: number, range: [number, number]): boolean {
  const [from, to] = range
  if (from <= to) return hour >= from && hour < to
  return hour >= from || hour < to
}
