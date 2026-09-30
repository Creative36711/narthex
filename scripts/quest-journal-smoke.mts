import { readFileSync } from 'node:fs'
import type { QuestDef } from '../src/shared/types'
import {
  journalEntryOptionLabel,
  journalEntryStageLabels,
  nextJournalEntryKey,
} from '../src/editor/questJournal'

let failed = 0
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failed++
}

const quest = JSON.parse(
  readFileSync('public/campaigns/ash-of-caerden/quests/quest_relic.json', 'utf8'),
) as QuestDef

for (const [key, stageId] of [
  ['j_search', 'started'],
  ['j_found', 'found'],
  ['j_completed', 'completed'],
] as const) {
  const stage = quest.stages.find((entry) => entry.id === stageId)!
  const label = journalEntryOptionLabel(quest, key)
  check(
    `${key} resolves to Russian text and its publishing stage`,
    journalEntryStageLabels(quest, key).includes(stage.label ?? stage.id) &&
      label.includes(stage.label ?? stage.id) &&
      label.includes(quest.journal_entries[key].slice(0, 16)) &&
      !label.includes(key),
    label,
  )
}

check(
  'new journal keys use their own namespace, not stage ids',
  nextJournalEntryKey(quest.journal_entries) === 'j_entry_1',
)
check(
  'new journal keys avoid collisions',
  nextJournalEntryKey({ ...quest.journal_entries, j_entry_1: 'occupied' }) === 'j_entry_2',
)
check(
  'unmapped record still gets a human-readable fallback',
  journalEntryOptionLabel(quest, 'orphan_key') === 'Пустая запись журнала',
)

console.log(failed ? `FAILED: ${failed}` : 'ALL GREEN')
if (failed) process.exitCode = 1
