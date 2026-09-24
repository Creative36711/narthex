import { useEffect, useState } from 'react'
import type { CampaignData } from './shared/types'
import { loadCampaign } from './core/loader'
import { GameEngine, loadSave, hasSave } from './core/engine'
import { MainMenu } from './player/MainMenu'
import { GameView } from './player/GameView'

const CAMPAIGN_PATH = '/campaigns/ash-of-caerden'

export default function App() {
  const [campaign, setCampaign] = useState<CampaignData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [engine, setEngine] = useState<GameEngine | null>(null)
  const [, setTickState] = useState(0)

  useEffect(() => {
    loadCampaign(CAMPAIGN_PATH)
      .then(setCampaign)
      .catch((e) => setError(String(e)))
  }, [])

  useEffect(() => {
    if (!engine) return
    return engine.subscribe(() => setTickState((n) => n + 1))
  }, [engine])

  if (error) {
    return (
      <div className="screen-center">
        <div className="panel error-panel">
          <h2>Ошибка загрузки кампании</h2>
          <p>{error}</p>
        </div>
      </div>
    )
  }

  if (!campaign) {
    return (
      <div className="screen-center">
        <div className="loading">Загрузка кампании…</div>
      </div>
    )
  }

  if (!engine) {
    return (
      <MainMenu
        campaign={campaign}
        canContinue={hasSave(campaign.meta.id)}
        onNewGame={() => {
          const e = new GameEngine(campaign)
          e.start()
          setEngine(e)
        }}
        onContinue={() => {
          const save = loadSave(campaign.meta.id)
          if (!save) return
          const e = new GameEngine(campaign, save)
          e.start()
          setEngine(e)
        }}
      />
    )
  }

  return (
    <GameView
      engine={engine}
      onRestart={() => setEngine(engine.restart())}
      onExitToMenu={() => setEngine(null)}
    />
  )
}
