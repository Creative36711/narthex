import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { CampaignData } from './shared/types'
import { loadCampaign } from './core/loader'
import { GameEngine, hasSave, openSave, exportSaveText, preserveSave } from './core/engine'
import type { OpenedSave } from './core/engine'
import { checkEngine } from './shared/versions'
import { SaveReportModal } from './player/SaveReportModal'
import { MainMenu } from './player/MainMenu'
import { NoCampaignScreen } from './player/NoCampaignScreen'
import { GameView } from './player/GameView'
import { HelpPanel } from './player/HelpPanel'
import { CharacterCreation } from './player/CharacterCreation'
import { fetchCampaignIndex, type CampaignIndexEntry } from './editor/newCampaign'
import { setAudioCampaign, playUi, unlockAudio } from './shared/audio'
import { setMusicCampaign, refreshMusic } from './shared/music'
import { injectCampaignCustomCss, injectCampaignFonts, themeHasFrame, themeVars } from './shared/theme'
import { profileClass, atmosphereOn } from './shared/profiles'
import { useSettings } from './shared/settings'

/**
 * Выбор кампании запоминается между сессиями, но список кампаний — это
 * public/campaigns/index.json. Захардкоженной «демо-кампании» больше нет:
 * полигон ash-of-caerden живёт на диске, но в реестр не внесён и игроку не
 * виден (нужен только смоукам). Пустой реестр — не ошибка, а штатное
 * состояние свежей сборки: показываем экран «Кампаний пока нет».
 */
const LAST_KEY = 'cf_last_campaign'

/**
 * Какую кампанию открыть: запомненную, если она ещё в реестре, иначе первую.
 * `skip` — id, который только что не загрузился (чтобы не выбрать его снова).
 */
function pickCampaign(index: CampaignIndexEntry[], wanted: string | null, skip?: string): string | null {
  if (wanted && index.some((c) => c.id === wanted)) return wanted
  return index.find((c) => c.id !== skip)?.id ?? null
}

// Editor Mode (Фаза 4) — ленивый чанк: Monaco/Konva не грузятся в Player Mode
const EditorApp = lazy(() => import('./editor/EditorApp').then((m) => ({ default: m.EditorApp })))

export default function App() {
  // id кампании подставляется из реестра: запомненный открывается, только если
  // он всё ещё в списке, иначе — первая доступная (при пустом реестре null)
  const [campaignId, setCampaignId] = useState<string | null>(null)
  const [campaigns, setCampaigns] = useState<CampaignIndexEntry[]>([])
  const [indexReady, setIndexReady] = useState(false)
  // id, которые уже не загрузились: иначе битые кампании гоняют друг друга
  // по кругу (A не открылась → пробуем B → не открылась → снова A)
  const broken = useRef<Set<string>>(new Set())
  const [campaign, setCampaign] = useState<CampaignData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [engine, setEngine] = useState<GameEngine | null>(null)
  const [editor, setEditor] = useState(() => window.location.hash === '#editor')
  const [help, setHelp] = useState(false)
  // экран создания персонажа перед новым забегом (блок 11 ТЗ)
  const [creating, setCreating] = useState(false)
  /** отчёт о сохранении: показываем, что движок сделал с сейвом (миграция/починка) */
  const [saveReview, setSaveReview] = useState<OpenedSave | null>(null)
  const settings = useSettings()

  useEffect(() => {
    document.documentElement.classList.toggle('no-anim', !settings.animations)
  }, [settings.animations])

  // режим редактора — класс на <body>: модалки (ModalHost) и прочие всплывашки
  // показывает тот же фирменный стиль, что и хром редактора, независимо от DOM-иерархии
  useEffect(() => {
    document.body.classList.toggle('cf-editor', editor)
    return () => document.body.classList.remove('cf-editor')
  }, [editor])

  // профиль на <html>: модалки рендерятся на уровне body (ModalHost),
  // поэтому и им нужны токены профиля. В режиме редактора классы снимаются —
  // оболочка редактора живёт в фирменном стиле Chronicle Forge.
  useEffect(() => {
    const root = document.documentElement
    // снимаем любой профиль, установленный ранее (каталог из 13 профилей —
    // фиксированный список классов перечислять не нужно)
    for (const c of Array.from(root.classList)) {
      if (c === 'cf-atmos-off' || c.startsWith('cf-profile-')) root.classList.remove(c)
    }
    if (!editor && campaign) {
      root.classList.add(profileClass(campaign.meta))
      if (!atmosphereOn(campaign.meta)) root.classList.add('cf-atmos-off')
    }
  }, [editor, campaign])

  useEffect(() => {
    void fetchCampaignIndex().then((idx) => {
      setCampaigns(idx)
      setCampaignId((cur) => pickCampaign(idx, cur))
      setIndexReady(true)
    })
  }, [])

  // Текущая кампания в списке всегда такая, какая она на диске: после импорта
  // чужой версии мастер видит её новое название и описание, а не запись,
  // оставшуюся в index.json с момента создания.
  useEffect(() => {
    if (!campaign) return
    const entry = {
      id: campaign.meta.id,
      title: campaign.meta.title,
      author: campaign.meta.author,
      description: campaign.meta.description,
    }
    setCampaigns((list) => {
      const i = list.findIndex((c) => c.id === entry.id)
      if (i < 0) return [...list, entry]
      const same = list[i].title === entry.title && list[i].author === entry.author && list[i].description === entry.description
      if (same) return list
      const next = list.slice()
      next[i] = entry
      return next
    })
  }, [campaign])

  useEffect(() => {
    setCampaign(null)
    setError(null)
    if (!campaignId) return
    loadCampaign(`/campaigns/${campaignId}`)
      .then((c) => {
        setCampaign(c)
        setAudioCampaign(c)
        setMusicCampaign(c) // фоновая музыка меню звучит ещё до старта забега
        injectCampaignFonts(c) // тема кампании: свои шрифты (блок 2 ТЗ)
        injectCampaignCustomCss(c) // продвинутое оформление мастера (полный CSS)
      })
      .catch((e) => {
        // выбранной кампании больше нет (или она повреждена) — пробуем следующую
        // из реестра ровно один раз, иначе битые кампании гонят друг друга
        broken.current.add(campaignId)
        const other = campaigns.find((c) => !broken.current.has(c.id))?.id ?? null
        if (other) {
          localStorage.setItem(LAST_KEY, other)
          setCampaignId(other)
        } else setError(String(e))
      })
  }, [campaignId, campaigns])

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
    const onHash = () => setEditor(window.location.hash === '#editor')
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  /** продолжить забег из уже открытого (перенесённого и почищенного) сейва */
  const startFromSave = (opened: OpenedSave) => {
    if (!campaign) return
    const e = new GameEngine(campaign, opened.state)
    e.envelope = opened.envelope
    e.start()
    setEngine(e)
  }

  if (editor) {
    return (
      <Suspense fallback={<div className="screen-center"><div className="loading">Загрузка редактора…</div></div>}>
        <EditorApp
          campaignPath={campaignId ? `/campaigns/${campaignId}` : ''}
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
          <div className="fld-row" style={{ marginTop: 12, gap: 8, flexWrap: 'wrap' }}>
            <button
              className="btn"
              onClick={() => {
                // пересканировать реестр: кампанию могли починить или долить
                broken.current.clear()
                setError(null)
                setIndexReady(false)
                void fetchCampaignIndex().then((idx) => {
                  setCampaigns(idx)
                  setCampaignId((cur) => pickCampaign(idx, cur))
                  setIndexReady(true)
                })
              }}
            >
              Пересканировать кампании
            </button>
            <button className="btn" onClick={() => { window.location.hash = '#editor' }}>
              Открыть редактор
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ни одной кампании на диске: не ошибка, а штатное состояние (свежая
  // сборка без демо-кампании или мастер удалил последнюю)
  if (!campaignId && indexReady) {
    return (
      <NoCampaignScreen
        onEditor={() => {
          window.location.hash = '#editor'
        }}
        onImported={(id) => {
          void fetchCampaignIndex().then((idx) => {
            setCampaigns(idx)
            broken.current.delete(id)
            localStorage.setItem(LAST_KEY, id)
            setCampaignId(id)
          })
        }}
      />
    )
  }

  if (!campaign) {
    return (
      <div className="screen-center">
        <div className="loading">Загрузка кампании…</div>
      </div>
    )
  }

  // движок подходит кампании? (min_engine из campaign.json)
  const engineCheck = checkEngine(campaign.meta.min_engine ?? campaign.meta.engine_version)

  // тема кампании (блок 2 ТЗ + редизайн 2026): визуальный профиль (класс) и
  // шрифтовые роли/акцент (инлайн-переменные) — только у Player Mode
  const themeStyle = themeVars(campaign, settings.text_scale)
  const themeClass = `cf-themed ${profileClass(campaign.meta)} ${atmosphereOn(campaign.meta) ? '' : 'cf-atmos-off'} ${themeHasFrame(campaign) ? 'cf-has-frame' : ''}`.trim()

  if (!engine && creating && campaign.meta.char_creation) {
    return (
      <div className={themeClass} style={themeStyle}>
        <CharacterCreation
          campaign={campaign}
          onBack={() => setCreating(false)}
          onStart={(choice) => {
            const e = new GameEngine(campaign)
            e.applyCharCreation(choice)
            e.start()
            setCreating(false)
            setEngine(e)
          }}
        />
      </div>
    )
  }

  if (!engine) {
    return (
      <div className={themeClass} style={themeStyle}>
        <MainMenu
          campaign={campaign}
          campaigns={campaigns}
          onSelectCampaign={(id) => {
            broken.current.delete(id)
            localStorage.setItem(LAST_KEY, id)
            setCampaignId(id)
          }}
          onImported={(id) => {
            fetchCampaignIndex().then((idx) => {
              setCampaigns(idx)
              localStorage.setItem(LAST_KEY, id)
              setCampaignId(id)
              setCampaign(null)
              // если импортировали ту же кампанию, что открыта — перечитать файлы
              loadCampaign(`/campaigns/${id}`).then(setCampaign).catch((e) => setError(String(e)))
            })
          }}
          canContinue={hasSave(campaign.meta.id, campaign)}
          engineWarning={engineCheck.ok ? undefined : engineCheck.message}
          onNewGame={() => {
            if (campaign.meta.char_creation) {
              setCreating(true)
              return
            }
            const e = new GameEngine(campaign)
            e.start()
            setEngine(e)
          }}
          onContinue={() => {
            // полное открытие сейва: перенос формата + вердикт по версиям кампании
            // + починка ссылок; что сделано — показываем игроку (SaveReportModal)
            const opened = openSave(campaign.meta.id, campaign)
            if (!opened) return
            const clean = opened.verdict.kind === 'ok' && opened.report.notes.length === 0
            if (!clean) {
              setSaveReview(opened)
              return
            }
            startFromSave(opened)
          }}
          onEditor={() => {
            window.location.hash = '#editor'
          }}
          onHelp={() => setHelp(true)}
        />
        {saveReview && (
          <SaveReportModal
            report={saveReview.report}
            verdict={saveReview.verdict}
            campaignVersion={campaign.meta.version}
            onContinue={() => {
              startFromSave(saveReview)
              setSaveReview(null)
            }}
            onNewRun={() => {
              setSaveReview(null)
              // старый сейв не поддержался — убираем его в резерв, чтобы новый
              // забег не затёр файл (игрок сможет вернуться к старой версии кампании)
              if (saveReview.verdict.kind !== 'ok') preserveSave(campaign.meta.id)
              if (campaign.meta.char_creation) {
                setCreating(true)
                return
              }
              const e = new GameEngine(campaign)
              e.start()
              setEngine(e)
            }}
            onExport={() => {
              const text = exportSaveText(campaign.meta.id)
              if (!text) return
              const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
              const a = document.createElement('a')
              a.href = url
              a.download = `${campaign.meta.id}-save.cfsave`
              a.click()
              setTimeout(() => URL.revokeObjectURL(url), 5000)
            }}
            onClose={() => setSaveReview(null)}
          />
        )}
        {help && <HelpPanel onClose={() => setHelp(false)} />}
      </div>
    )
  }

  return (
    <div className={themeClass} style={themeStyle}>
      <GameView
        engine={engine}
        onRestart={() => setEngine(engine.restart())}
        onNewGamePlus={(next) => setEngine(next)}
        onExitToMenu={() => setEngine(null)}
        onLoadSlot={(slot) => {
          // загрузка из слота: пересобираем движок из состояния слота
          const opened = openSave(engine.campaign.meta.id, engine.campaign, slot)
          if (!opened || opened.verdict.kind !== 'ok') return
          const fresh = new GameEngine(engine.campaign, opened.state)
          fresh.start()
          setEngine(fresh)
        }}
      />
    </div>
  )
}
