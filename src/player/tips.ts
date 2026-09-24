/**
 * Одноразовые обучающие подсказки (Уровень 2 обучения — «через геймплей»).
 * Отмеченные подсказки хранятся в localStorage и не показываются повторно.
 */

const KEY = 'cf_tips_seen'

function load(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

export function tipSeen(id: string): boolean {
  return load().has(id)
}

export function markTip(id: string): void {
  try {
    const s = load()
    s.add(id)
    localStorage.setItem(KEY, JSON.stringify([...s]))
  } catch {
    /* приватный режим */
  }
}

/** сброс (для отладки/настроек) */
export function resetTips(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
