import type { CampaignMeta } from '../shared/types'
import type { EditorStore } from './store'

/** Вариант выбора из реестра кампании: id и подпись для списка. */
export interface CampaignOption {
  id: string
  label: string
}

/** Общие свойства вкладок паспорта кампании. */
export interface CampaignTabProps {
  store: EditorStore
  m: CampaignMeta
  commit: () => void
}

/** Свойства вкладки «Генераторы»: ей нужен список локаций для подсказок. */
export interface CampaignGeneratorsTabProps extends CampaignTabProps {
  locOpts: CampaignOption[]
}

/** Свойства вкладки «Основное»: ей нужны подсказки по сценам, локациям, регионам и NPC. */
export interface CampaignMainTabProps extends CampaignTabProps {
  sceneOpts: CampaignOption[]
  locOpts: CampaignOption[]
  regionOpts: CampaignOption[]
  npcOpts: CampaignOption[]
}
