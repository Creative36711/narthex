import { lazy, Suspense, useEffect, useState } from 'react'
import type { CampaignData } from './shared/types'
import { loadCampaign } from './core/loader'
import { GameEngine, loadSave, hasSave } from './core/engine'
import { MainMenu } from './player/MainMenu'
import { GameView } from './player/GameView'

const CAMPAIGN_PATH = '/campaigns/ash-of-caerden'

// Editor Mode (Фаза 4) — ленивый чанк: Monaco/Konva не грузятся в Player Mode
const EditorApp = lazy(() => import('./editor/EditorApp').then((m) => ({ default: m.EditorApp })))

export default function App() {
  const [campaign, setCampaign] = useState<CampaignData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [engine, setEngine] = useState<GameEngine | null>(null)
  const [editor, setEditor] = useState(() => window.location.hash === '#editor')
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

  useEffect(() => {
    const onHash = () => setEditor(window.location.hash === '#editor')
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  if (editor) {
    return (
      <Suspense fallback={<div className="screen-center"><div className="loading">Загрузка редактора…</div></div>}>
        <EditorApp
          campaignPath={CAMPAIGN_PATH}
          onExit={() => {
            window.location.hash = ''
            // перезагрузка, чтобы Player Mode подхватил изменённые файлы кампании
            window.location.reload()
          }}
        />
      </Suspense>
    )
  }

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
        onEditor={() => {
          window.location.hash = '#editor'
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
