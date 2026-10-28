export function saveKey(campaignId: string): string {
  return `narthex:save:${campaignId}`
}

/** Резервная копия сейва до первой правки (миграция/починка). */
export function backupKey(campaignId: string): string {
  return `narthex:save-backup:${campaignId}`
}

// ───────────────────────── слоты сохранений (аудит §5.6 п.9) ─────────────────────────

/**
 * 'auto' — привычный автосейв (старый ключ, совместимость сохранена);
 * число — ручной слот игрока.
 */
export type SaveSlot = number | 'auto'

/** Верх слотов, который движок вообще умеет показывать (мастер — `meta.save_slots`). */
export const MAX_SAVE_SLOTS = 5

/** Ключ хранилища для слота: автосейв — старый общий ключ кампании. */
export function slotKey(campaignId: string, slot: SaveSlot = 'auto'): string {
  return slot === 'auto' ? saveKey(campaignId) : `narthex:save:${campaignId}@${slot}`
}

/** Резерв слота (до первой правки). */
export function slotBackupKey(campaignId: string, slot: SaveSlot = 'auto'): string {
  return slot === 'auto' ? backupKey(campaignId) : `${slotKey(campaignId, slot)}-backup`
}

