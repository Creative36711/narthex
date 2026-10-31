import type { GameState } from './runtime'


/**
 * Версия формата `GameState` (внутренности сохранения). Растёт, когда меняется
 * форма состояния забега; переносом занимается цепочка миграций
 * `core/savemigrate.ts` (только вверх, старые шаги не удаляются).
 */
export const SAVE_VERSION = 4

/** Версия обёртки сохранения (`SaveEnvelope`) — метаданные вокруг `GameState`. */
export const SAVE_ENVELOPE_VERSION = 1

/**
 * Сохранение на диске = обёртка + состояние. Обёртка отвечает на вопросы
 * «от какой кампании и движка этот сейв» без разбора состояния — без неё
 * нельзя ни показать причину несовместимости, ни починить сейв после
 * обновления кампании.
 */
export interface SaveEnvelope {
  envelope_version: number
  /** формат `state` (см. SAVE_VERSION) */
  save_version: number
  campaign_id: string
  /** версия кампании, на которой сделано сохранение */
  campaign_version?: string
  /** версия движка, записавшего сохранение */
  engine_version?: string
  /** ISO-дата создания и последней записи */
  created_at?: string
  updated_at?: string
  /** сколько тиков прожито и где герой — для списков сохранений без разбора state */
  tick?: number
  location?: string
  state: GameState
}

/** Одна строка отчёта о переносе/починке сохранения (показывается игроку). */
export interface SaveNote {
  /** migrated — перенос формата; repaired — починка ссылок; warning — на заметку */
  kind: 'migrated' | 'repaired' | 'warning'
  text: string
}

/** Итог чтения сохранения: что сделали с сейвом и что об этом сказать игроку. */
export interface SaveReport {
  from_version: number
  to_version: number
  /** версия кампании в сейве (если известна) */
  campaign_version?: string
  notes: SaveNote[]
  /** сейв пришлось чинить (ссылки на удалённый контент кампании) */
  repaired: boolean
}

// ─────────── контракт совместимости кампании (compat.json) ───────────

/**
 * Одно ломающее изменение между версиями кампании. `kind` — из словаря
 * `CHANGE_KINDS` (`shared/compat.ts`); `impact` — человекочитаемое последствие
 * для сохранений.
 */
export interface CompatBreak {
  kind: string
  id: string
  label?: string
  impact?: string
}

/** Сводка изменений между двумя версиями кампании (по классам S/A/B/C/D). */
export interface CompatChanges {
  added: number
  removed: number
  changed: number
  /** детали по видам объектов, чтобы отчёт был читаемым */
  details?: Array<{ kind: string; op: 'added' | 'removed' | 'changed'; id: string; label?: string }>
}

/**
 * `compat.json` — контракт совместимости пакета. Пишет редактор при
 * публикации обновления; игрок читает его, чтобы узнать, поддержится ли его
 * сохранение. Поля формата: `format` из `COMPAT_FORMAT`.
 */
export interface CampaignCompat {
  format: 'chronicle-compat/1'
  /** версия кампании, к которой относится контракт */
  version: string
  /** сохранения от какой версии ещё поддерживаются */
  save_base_version: string
  min_engine?: string
  package_format?: number
  updated_at?: string
  /** свёртка всех id пакета: по ней следующий релиз находит изменения */
  inventory_digest: string
  breaks: CompatBreak[]
  changes?: CompatChanges
  /** текст от автора («переписана глава 3») */
  notes?: string
}
