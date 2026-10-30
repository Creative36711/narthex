import { useState } from 'react'
import type { EditorStore } from './store'
import { DEFAULT_DICE_RULES } from '../shared/types'
import { ThemeTab } from './campaignThemeTab'
import { DurationActionsRegistry, VersionsTab } from './campaignRegistries'
import { StatusRegistry } from './campaignStatusesTab'
import { CampaignChronicleTab } from './campaignChronicleTab'
import { CampaignMechanicsTab } from './campaignMechanicsTab'
import { CampaignMainTab } from './campaignMainTab'
import { CampaignCreationTab } from './campaignCreationTab'
import { CampaignPeopleTab } from './campaignPeopleTab'
import { CampaignItemsTab } from './campaignItemsTab'
import { CampaignFlagsTab, CampaignAudioTab, CampaignJsonTab } from './campaignMiscTabs'
import { CampaignGeneratorsTab } from './campaignGeneratorsTab'


/**
 * Модификаторы черты строками «что — насколько»: без парсерного текста
 * «навык=+5, hp=+2» (фидбек 27, п.2: в редакторе всё читается человеком).
 */


export function CampaignEditor({ store }: { store: EditorStore }) {
  const m = store.meta
  // дефолты для необязательных полей (без touch — просто нормализация)
  if (!m.time_of_day) m.time_of_day = { morning: 6, day: 10, evening: 18, night: 22 }
  if (!m.factions) m.factions = []
  if (!m.roguelike) m.roguelike = { permadeath: true, meta_progress: [], randomize_on_restart: [] }
  if (m.starting_tick === undefined) m.starting_tick = 0
  if (m.max_companions === undefined) m.max_companions = 2
  // правила бросков d100 (итерация 8, А7): по умолчанию — «щедрые»
  if (!m.dice_rules) m.dice_rules = { ...DEFAULT_DICE_RULES }
  const [, force] = useState(0)
  const commit = () => {
    store.touch('campaign.json')
    force((n) => n + 1)
  }
  type CeTab = 'main' | 'creation' | 'versions' | 'chronicle' | 'mechanics' | 'look' | 'statuses' | 'people' | 'items' | 'flags' | 'audio' | 'json' | 'generators'

  const [tab, setTab] = useState<CeTab>('main')

  const sceneOpts = store.options('scene')
  const locOpts = store.options('location')
  const regionOpts = store.world.regions.map((r) => ({ id: r.id, label: r.label }))
  const npcOpts = store.options('npc')

  return (
    <div className="rule-editor">
      <div className="ce-tabs" role="tablist" aria-label="Вкладки кампании">
        {([['main', 'Основное'], ['creation', 'Создание героя'], ['versions', 'Версии'], ['mechanics', 'Механики'], ['look', 'Оформление'], ['statuses', 'Статусы и способности'], ['people', 'Персонажи'], ['items', 'Предметы и слоты'], ['flags', 'Флаги'], ['audio', 'Звук и музыка'], ['generators', 'События и генераторы'], ['chronicle', 'Хроника'], ['json', 'JSON']] as const).map(([id, lab]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={`ce-tab ${tab === id ? 'on' : ''}`} onClick={() => setTab(id)}>
            {lab}
          </button>
        ))}
      </div>

      {tab === 'versions' && <VersionsTab store={store} commit={commit} />}

      {tab === 'chronicle' && (
        <CampaignChronicleTab store={store} m={m} commit={commit} />
      )}

      {tab === 'mechanics' && (
        <CampaignMechanicsTab store={store} m={m} commit={commit} />
      )}

      {tab === 'look' && <ThemeTab meta={m} store={store} commit={commit} />}

      {tab === 'statuses' && <StatusRegistry m={m} store={store} commit={commit} />}

      {tab === 'mechanics' && <DurationActionsRegistry m={m} store={store} commit={commit} />}

      {tab === 'main' && (
        <CampaignMainTab store={store} m={m} commit={commit} sceneOpts={sceneOpts} locOpts={locOpts} regionOpts={regionOpts} npcOpts={npcOpts} />
      )}
      {tab === 'creation' && (
        <CampaignCreationTab store={store} m={m} commit={commit} />
      )}

      {tab === 'people' && (
        <CampaignPeopleTab store={store} m={m} commit={commit} />
      )}
      {tab === 'items' && (
        <CampaignItemsTab store={store} m={m} commit={commit} />
      )}
      {tab === 'flags' && (
        <CampaignFlagsTab store={store} m={m} commit={commit} />
      )}
      {tab === 'audio' && (
        <CampaignAudioTab store={store} m={m} commit={commit} />
      )}
      {tab === 'generators' && (
        <CampaignGeneratorsTab store={store} m={m} commit={commit} locOpts={locOpts} />
      )}
      {tab === 'json' && (
        <CampaignJsonTab store={store} m={m} commit={commit} />
      )}
    </div>
  )
}
