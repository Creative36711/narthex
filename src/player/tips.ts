/**
 * Одноразовые обучающие подсказки (Уровень 2 обучения — «через геймплей»).
 * Отмеченные подсказки хранятся в localStorage и не показываются повторно.
 */

const KEY = 'cf_tips_seen'
const keyFor = (campaignId?: string) => campaignId ? `${KEY}:${campaignId}` : KEY

function load(campaignId?: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(keyFor(campaignId)) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

/** Подсказки запоминаются отдельно для каждой кампании: новый мир получает свое обучение. */
export function tipSeen(id: string, campaignId?: string): boolean {
  return load(campaignId).has(id)
}

export function markTip(id: string, campaignId?: string): void {
  try {
    const s = load(campaignId)
    s.add(id)
    localStorage.setItem(keyFor(campaignId), JSON.stringify([...s]))
  } catch {
    /* приватный режим */
  }
}

/** Сброс подсказок одной кампании; без id — прежний общий API и полный сброс. */
export function resetTips(campaignId?: string): void {
  try {
    if (campaignId) localStorage.removeItem(keyFor(campaignId))
    else {
      localStorage.removeItem(KEY)
      const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i))
      for (const key of keys) if (key?.startsWith(`${KEY}:`)) localStorage.removeItem(key)
    }
  } catch {
    /* ignore */
  }
}
