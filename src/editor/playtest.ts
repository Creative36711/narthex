import type { CampaignData, MonolithDoc } from '../shared/types'
import { migrateCampaign } from '../shared/migrate'
import { generateInk } from './dialogueDoc'

/** Чисто преобразует текущий монолит редактора в формат рантайма. */
export function campaignFromMonolith(doc: MonolithDoc): CampaignData {
  const copy = JSON.parse(JSON.stringify(doc)) as MonolithDoc
  const dialogues: Record<string, string> = {}
  for (const [id, dialogue] of Object.entries(copy.dialogues ?? {})) {
    dialogues[`dialogues/${id}.ink`] = 'ink' in dialogue ? dialogue.ink : generateInk(dialogue)
  }
  const campaign: CampaignData = {
    meta: copy.campaign,
    world: copy.world,
    scenes: copy.scenes ?? {},
    entities: copy.entities ?? {},
    rules: copy.rules ?? {},
    arenas: copy.arenas ?? {},
    quests: copy.quests ?? {},
    encounters: copy.encounters ?? {},
    cutscenes: copy.cutscenes ?? {},
    recipes: copy.recipes ?? {},
    codex: copy.codex ?? {},
    dialogues,
    basePath: '',
  }
  migrateCampaign(campaign.meta, campaign.world, campaign.scenes)
  return campaign
}
