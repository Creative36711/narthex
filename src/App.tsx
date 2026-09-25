import { lazy, Suspense, useEffect, useState } from 'react'
import type { CampaignData } from './shared/types'
import { loadCampaign } from './core/loader'
import { GameEngine, loadSave, hasSave } from './core/engine'
import { MainMenu } from './player/MainMenu'
import { GameView } from './player/GameView'
import { HelpPanel } from './player/HelpPanel'
import { fetchCampaignIndex, type CampaignIndexEntry } from './editor/newCampaign'
import { setAudioCampaign, playUi, unlockAudio } from './shared/audio'
import { setMusicCampaign, refreshMusic } from './shared/music'

/** встроенная кампания-пример; выбор запоминается между сессиями */
const DEFAULT_CAMPAIGN = 'ash-of-caerden'
const LAST_KEY = 'cf_last_campaign'

// Editor Mode (Фаза 4) — ленивый чанк: Monaco/Konva не грузятся в Player Mode
const EditorApp = lazy(() => import('./editor/EditorApp').then((m) => ({ default: m.EditorApp })))

export default function App() {
  const [campaignId, setCampaignId] = useState(() => localStorage.getItem(LAST_KEY) ?? DEFAULT_CAMPAIGN)
  const [campaigns, setCampaigns] = useState<CampaignIndexEntry[]>([])
  const [campaign, setCampaign] = useState<CampaignData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [engine, setEngine] = useState<GameEngine | null>(null)
  const [editor, setEditor] = useState(() => window.location.hash === '#editor')
  const [help, setHelp] = useState(false)
  const [, setTickState] = useState(0)

  useEffect(() => {
    fetchCampaignIndex().then((idx) => {
      setCampaigns(idx.length ? idx : [{ id: DEFAULT_CAMPAIGN, title: 'Пепел Каэрдена' }])
    })
  }, [])

  useEffect(() => {
    setCampaign(null)
    setError(null)
    loadCampaign(`/campaigns/${campaignId}`)
      .then((c) => {
        setCampaign(c)
        setAudioCampaign(c)
        setMusicCampaign(c) // фоновая музыка меню звучит ещё до старта забега
      })
      .catch((e) => {
        // выбранная кампания могла исчезнуть — откат на встроенную
        if (campaignId !== DEFAULT_CAMPAIGN) {
          localStorage.setItem(LAST_KEY, DEFAULT_CAMPAIGN)
          setCampaignId(DEFAULT_CAMPAIGN)
        } else setError(String(e))
      })
  }, [campaignId])

  // аудио: разблокировка WebAudio по первому жесту + общий «клик» по кнопкам (блок H)
  useEffect(() => {
    const unlock = () => {
      unlockAudio()
      // первый жест разрешает автоплей — запускаем музыку, которая уже должна звучать
      refreshMusic(engine)
    }
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null
      if (t?.closest('button')) playUi('click', 0.55)
    }
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('click', onClick)
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('click', onClick)
    }
  }, [engine])

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
          campaignPath={`/campaigns/${campaignId}`}
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
      <>
        <MainMenu
          campaign={campaign}
          campaigns={campaigns}
          onSelectCampaign={(id) => {
            localStorage.setItem(LAST_KEY, id)
            setCampaignId(id)
          }}
          onImported={(id) => {
            fetchCampaignIndex().then((idx) => {
              setCampaigns(idx.length ? idx : [{ id: DEFAULT_CAMPAIGN, title: 'Пепел Каэрдена' }])
              localStorage.setItem(LAST_KEY, id)
              setCampaignId(id)
              setCampaign(null)
              // если импортировали ту же кампанию, что открыта — перечитать файлы
              loadCampaign(`/campaigns/${id}`).then(setCampaign).catch((e) => setError(String(e)))
            })
          }}
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
          onHelp={() => setHelp(true)}
        />
        {help && <HelpPanel onClose={() => setHelp(false)} />}
      </>
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
