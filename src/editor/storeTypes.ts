import type { CampaignManifest } from '../shared/types'

export type ManifestDef = CampaignManifest

export interface ModifiedFileEntry {
  path: string
  status: 'modified' | 'added' | 'deleted'
  category: 'scene' | 'dialogue' | 'entity' | 'quest' | 'rule' | 'recipe' | 'arena' | 'cutscene' | 'codex' | 'meta' | 'world' | 'other'
  title: string
  diffSummary?: string
}

export type EditorSection =
  | 'campaign'
  | 'design'
  | 'world'
  | 'scenes'
  | 'entities'
  | 'rules'
  | 'quests'
  | 'dialogues'
  | 'arenas'
  | 'cutscenes'
  | 'combat'
  | 'recipes'
  | 'codex'
  | 'packs'
  | 'panels'
