import type { QuestDef } from '../shared/types'

/**
 * Журнальные text_key — самостоятельные внутренние ключи, не id стадий.
 * Для редактора пытаемся найти стадию, которая публикует запись, но сама
 * запись не переименовывается и не привязывается к стадии автоматически.
 */
export function journalEntryStageLabels(quest: QuestDef, key: string): string[] {
  const labels: string[] = []
  for (const [index, stage] of (quest.stages ?? []).entries()) {
    const publishes = (stage.on_enter_effects ?? []).some((effect) =>
      containsJournalUpdate(effect, quest.id, key),
    )
    if (publishes) labels.push(stage.label?.trim() || `Стадия ${index + 1}`)
  }
  return [...new Set(labels)]
}

/** Human-readable option label; never exposes the machine key in normal UI. */
export function journalEntryOptionLabel(quest: QuestDef, key: string): string {
  const text = (quest.journal_entries?.[key] ?? '').replace(/\s+/g, ' ').trim()
  const excerpt = text.length > 92 ? `${text.slice(0, 89).trimEnd()}…` : text
  const stages = journalEntryStageLabels(quest, key)
  if (stages.length && excerpt) return `${stages.join(' / ')} — ${excerpt}`
  if (stages.length) return stages.join(' / ')
  return excerpt || 'Пустая запись журнала'
}

/** Stable new internal key, intentionally independent of stage ids. */
export function nextJournalEntryKey(entries: Record<string, string>): string {
  let index = 1
  while (Object.prototype.hasOwnProperty.call(entries, `j_entry_${index}`)) index++
  return `j_entry_${index}`
}

function containsJournalUpdate(value: unknown, questId: string, key: string): boolean {
  if (Array.isArray(value)) return value.some((entry) => containsJournalUpdate(entry, questId, key))
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  if (record.type === 'journal_update' && record.quest === questId && record.text_key === key) {
    return true
  }
  return Object.values(record).some((child) => containsJournalUpdate(child, questId, key))
}

