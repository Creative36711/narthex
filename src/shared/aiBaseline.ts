/**
 * Ключи хранилища для снимка «точки отсчёта ручных правок мастера».
 *
 * Снимок для диффа чемодана ИИ живёт в localStorage, привязан к пути кампании
 * (например «/campaigns/ash-of-caerden»). Модуль вынесен отдельно от
 * EditorStore: сбрасывать ключ приходится и из игрового меню (импорт
 * кампании), а тянуть весь редакторский стор в бандл игрока не хочется.
 */

/** Ключ localStorage с сохранённым снимком базы правок мастера по кампании */
export function aiDiffSnapshotKey(basePath: string): string {
  return `cf_editor_ai_baseline:${basePath}`
}

/**
 * Стереть сохранённый снимок базы правок кампании — при её удалении или
 * повторном импорте: после импорта содержимое заменено, старые остаточные
 * правки не должны всплывать; фиксация начинается заново.
 */
export function clearAiDiffSnapshot(basePath: string): void {
  try {
    localStorage.removeItem(aiDiffSnapshotKey(basePath))
  } catch {
    // localStorage недоступен (приватный режим) — не мешаем импорту
  }
}
