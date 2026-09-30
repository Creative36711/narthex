import { loadCampaign } from '../src/core/loader'
import { GameEngine } from '../src/core/engine'

const memory = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => memory.set(key, value),
  removeItem: (key: string) => memory.delete(key),
}

const campaign = await loadCampaign('http://localhost:5173/campaigns/ash-of-caerden')
const engine = new GameEngine(campaign)
engine.start()
engine.startQuest('quest_relic')
const quest = engine.state.quests.quest_relic
const expected = [
  campaign.quests.quest_relic.journal_entries.j_search,
  campaign.quests.quest_relic.journal_entries.j_found,
  campaign.quests.quest_relic.journal_entries.j_completed,
]

let failed = 0
function check(name: string, ok: boolean) {
  console.log(`${ok ? '✓' : '✗'} ${name}`)
  if (!ok) failed++
}

check('starting stage publishes its independent j_search key', quest.journal.includes(expected[0]))
engine.advanceQuestTo('quest_relic', 'found')
check('found stage publishes its independent j_found key', quest.journal.includes(expected[1]))
engine.advanceQuestTo('quest_relic', 'completed')
check('final stage publishes its independent j_completed key', quest.journal.includes(expected[2]))
check('player journal contains prose, not internal keys', quest.journal.every((entry) => !/^j_/.test(entry)))

console.log(failed ? `FAILED: ${failed}` : 'ALL GREEN')
if (failed) process.exitCode = 1
