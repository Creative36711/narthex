import { useCallback, useEffect, useRef, useState } from 'react'
import type { SyntheticEvent } from 'react'
import type { GameEngine } from '../core/engine'
import { HUD } from './HUD'
import { SceneScreen } from './SceneScreen'
import { MapScreen } from './MapScreen'
import { DialogueOverlay } from './DialogueOverlay'
import { InventoryPanel, CharacterPanel, LogPanel, CraftingPanel } from './Panels'
import { SavesPanel } from './SavesPanel'
import { CodexPanel } from './CodexPanel'
import { MetaPanel } from './MetaPanel'
import { TradePanel } from './TradePanel'
import { EndScreen } from './EndScreen'
import { HelpPanel } from './HelpPanel'
import { CombatScreen } from './CombatScreen'
import { PartyPanel } from './PartyPanel'
import { DurationModal } from './DurationModal'
import { assetUrl, assetUrlOrNull } from '../core/loader'
import { CutscenePlayer } from '../shared/CutscenePlayer'
import { BannerLayer, PostcardLayer } from './Atmosphere'
import { setAudioCampaign, playUi, refreshAmbient, stopAllLoops } from '../shared/audio'
import { refreshMusic, setMenuMode, stopMusic, applyMusicVolume } from '../shared/music'
import { featureOn, type MusicTrackDef, type SceneDef } from '../shared/types'
import { Ico } from '../shared/icons'
import { AdventureScreen } from './AdventureScreen'
import { FmvScreen } from './FmvScreen'
import { loadPlayerPackSession, type AdventureSession } from './adventureRuntime'

interface Props {
  engine: GameEngine
  onRestart: () => void
  onNewGamePlus?: (next: GameEngine) => void
  onExitToMenu: () => void
  /** Загрузить забег из слота сохранений (аудит §5.6 п.9) — пересобирает движок */
  onLoadSlot?: (slot: import('../core/savemigrate').SaveSlot) => void
  debugPanelOpen?: boolean
  onGamePanelOpen?: () => void
}

type PanelId = 'map' | 'inventory' | 'character' | 'log' | 'help' | 'craft' | 'codex' | 'saves' | 'meta' | null

function recoverBrokenPortrait(event: SyntheticEvent<HTMLDivElement>) {
  const image = event.target
  if (!(image instanceof HTMLImageElement)) return
  const portrait = image.closest('.dialogue-portrait')
  if (!portrait && !image.matches('.message-portrait, .slot-portrait')) return
  const failedSrc = image.currentSrc || image.src || '(empty src)'
  console.error(`Failed to load resource: portrait fallback ${failedSrc}`)
  if (portrait) {
    image.remove()
    if (!portrait.querySelector('.dialogue-portrait-placeholder')) {
      const fallback = document.createElement('div')
      fallback.className = 'dialogue-portrait-placeholder'
      fallback.setAttribute('aria-hidden', 'true')
      fallback.dataset.assetFallback = failedSrc
      fallback.textContent = '👤'
      portrait.prepend(fallback)
    }
    return
  }
  if (image.matches('.slot-portrait')) {
    const fallback = document.createElement('span')
    fallback.className = 'slot-marker slot-marker-npc slot-portrait-fallback'
    fallback.style.cssText = 'opacity:1;transform:scale(1);background:color-mix(in srgb,var(--gold) 20%,transparent)'
    fallback.setAttribute('aria-hidden', 'true')
    fallback.dataset.assetFallback = failedSrc
    const glyph = document.createElement('span')
    glyph.className = 'slot-marker-glyph'
    glyph.textContent = '◆'
    fallback.append(glyph)
    image.replaceWith(fallback)
    return
  }
  image.parentElement?.setAttribute('data-asset-fallback', failedSrc)
  image.remove()
}

export function GameView({ engine, onRestart, onNewGamePlus, onExitToMenu, onLoadSlot, debugPanelOpen = false, onGamePanelOpen }: Props) {
  const [panel, setPanel] = useState<PanelId>(null)
  const [packSession, setPackSession] = useState<AdventureSession | null>(null)
  const gameViewRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const root = gameViewRef.current
    if (!root) return
    const hideFailedImageNotice = () => root.querySelectorAll<HTMLElement>('.scene-bg-note').forEach((note) => { note.hidden = true })
    const observer = new MutationObserver(hideFailedImageNotice)
    observer.observe(root, { childList: true, subtree: true })
    hideFailedImageNotice()
    return () => observer.disconnect()
  }, [engine])
  useEffect(() => {
    let active = true
    setPackSession(null)
    void loadPlayerPackSession(engine)
      .then((session) => { if (active) setPackSession(session) })
      .catch((error) => console.error('[narthex] pack screen could not open:', error))
    return () => { active = false }
  }, [engine])
  // GameView owns the subscription so embedded playtests update just like the normal player.
  const [, invalidate] = useState(0)
  useEffect(() => engine.subscribe(() => invalidate((n) => n + 1)), [engine])
  // Отладочная панель и игровые боковые меню взаимоисключающие.
  useEffect(() => { if (debugPanelOpen) setPanel(null) }, [debugPanelOpen])
  const [damageFlash, setDamageFlash] = useState(false)
  const previousHp = useRef(engine.state.player.hp)
  useEffect(() => {
    const current = engine.state.player.hp
    const wasHit = current < previousHp.current
    previousHp.current = current
    if (!wasHit) return
    setDamageFlash(true)
    const timer = window.setTimeout(() => setDamageFlash(false), 220)
    return () => window.clearTimeout(timer)
  }, [engine, engine.state.player.hp])
  // транзитные подсказки (получено/потеряно): каждая гаснет по таймеру
  const cutscene = engine.cutscene
  const fmvScene = engine.currentScene() as (SceneDef & { fmv?: string }) | undefined
  const isIntroActive = engine.isSceneIntroActive()
  const isPostcardActive = !cutscene && !isIntroActive && !!engine.postcard
  const isMessageActive = !cutscene && !engine.dialogue && !engine.combat && !isIntroActive && !isPostcardActive && !!engine.messages[0]
  const isStoryActive = !!cutscene || isIntroActive || isPostcardActive || isMessageActive

  const toasts = engine.toasts
  useEffect(() => {
    if (!toasts.length || isStoryActive) return
    const timers = toasts.map((t) => window.setTimeout(() => engine.dismissToast(t.id), 4200))
    return () => { for (const t of timers) window.clearTimeout(t) }
  }, [engine, toasts, isStoryActive])
  const message = isMessageActive ? engine.messages[0] : null
  const resolveAsset = useCallback((p: string) => assetUrl(engine.campaign, p), [engine])
  const endCutscene = useCallback(() => engine.endCutscene(), [engine])
  const resolveTrack = useCallback(
    (id: string): MusicTrackDef | null => engine.campaign.meta.music_tracks?.find((t) => t.id === id) ?? null,
    [engine],
  )

  // аудио-контекст кампании + музыка сцены (блок H)
  useEffect(() => {
    setAudioCampaign(engine.campaign)
    setMenuMode(false)
    applyMusicVolume()
  }, [engine])
  useEffect(() => {
    refreshMusic(engine)
    refreshAmbient(engine)
  })
  const prevMessage = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (message && message.text !== prevMessage.current) playUi('message')
    prevMessage.current = message?.text
  }, [message])

  // звуки панелей (H4); панели выключенных механик профиля не открываются
  const openPanel = useCallback(
    (id: Exclude<PanelId, null>) => {
      const meta = engine.campaign.meta
      if (id === 'map' && !featureOn(meta, 'map')) return
      if (id === 'inventory' && !featureOn(meta, 'inventory')) return
      onGamePanelOpen?.()
      playUi(`panel:${id}`)
      setPanel(id)
    },
    [engine, onGamePanelOpen],
  )
  const closePanel = useCallback(() => {
    if (panel) playUi(`panel:${panel}:close`)
    else playUi('panel_close')
    // окно крафта могло быть открыто эффектом `open_craft` — снимаем запрос,
    // иначе панель тут же откроется снова
    engine.closeCraft()
    setPanel(null)
  }, [engine, panel])

  // `open_craft` (правило, реплика, предмет в сцене) открывает панель крафта
  // без кнопки HUD: подписка уже перерисовывает GameView, остаётся
  // синхронизировать локальную панель.
  useEffect(() => {
    if (engine.craftRequest) setPanel('craft')
  }, [engine, engine.craftRequest])

  useEffect(() => {
    return () => {
      stopMusic(0.5)
      stopAllLoops()
    }
  }, [])

  return (
    <div ref={gameViewRef} className={`game-view ${damageFlash ? 'player-damage-flash' : ''}`} onErrorCapture={recoverBrokenPortrait}>
      <HUD
        engine={engine}
        onOpenMap={() => openPanel('map')}
        onOpenInventory={() => openPanel('inventory')}
        onOpenCharacter={() => openPanel('character')}
        onOpenLog={() => openPanel('log')}
        onOpenMeta={() => openPanel('meta')}
        onOpenCraft={() => openPanel('craft')}
        onOpenCodex={() => openPanel('codex')}
        onOpenSaves={() => openPanel('saves')}
        onOpenHelp={() => openPanel('help')}
        onExitToMenu={onExitToMenu}
      />
      {fmvScene?.fmv
        ? <FmvScreen engine={engine} scene={fmvScene} onContinue={() => openPanel('map')} />
        : packSession
          ? <AdventureScreen engine={engine} session={packSession} />
          : <SceneScreen engine={engine} onOpenMap={() => openPanel('map')} />}

      {!cutscene && !engine.combat && !engine.dialogue && !engine.trade && <PartyPanel engine={engine} />}

      <DurationModal engine={engine} />

      {panel === 'map' && featureOn(engine.campaign.meta, 'map') && <MapScreen engine={engine} onClose={closePanel} />}
      {panel === 'inventory' && featureOn(engine.campaign.meta, 'inventory') && (
        <InventoryPanel engine={engine} onClose={closePanel} />
      )}
      {panel === 'character' && <CharacterPanel engine={engine} onClose={closePanel} />}
      {panel === 'craft' && featureOn(engine.campaign.meta, 'inventory') && (
        <CraftingPanel engine={engine} onClose={closePanel} focusRecipe={engine.craftRequest?.recipe} />
      )}
      {panel === 'log' && <LogPanel engine={engine} onClose={closePanel} />}
      {panel === 'codex' && <CodexPanel engine={engine} onClose={closePanel} />}
      {panel === 'meta' && engine.metaProgressEnabled() && <MetaPanel engine={engine} onClose={closePanel} />}
      {panel === 'help' && <HelpPanel engine={engine} onClose={closePanel} />}
      {panel === 'saves' && onLoadSlot && (
        <SavesPanel engine={engine} onClose={closePanel} onLoadSlot={(slot) => { closePanel(); onLoadSlot(slot) }} />
      )}

      {/* после смерти героя бой не рисуем: экран исхода (EndScreen) не должен
          конкурировать с живым HUD/летописью боя под полупрозрачным фоном */}
      {!cutscene && engine.combat && !engine.state.game_over && <CombatScreen engine={engine} />}

      {!cutscene && engine.trade && !engine.combat && <TradePanel engine={engine} />}

      {!cutscene && engine.dialogue && !engine.combat && !engine.trade && <DialogueOverlay engine={engine} />}

      {!isStoryActive && toasts.length > 0 && (
        <div className="toast-stack" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`toast toast-${t.kind}`} onClick={() => engine.dismissToast(t.id)}>
              <Ico n={t.kind === 'get' ? 'bag' : t.kind === 'lose' ? 'trash' : 'info'} />
              <span>{t.text}</span>
            </div>
          ))}
        </div>
      )}

      {message && (
        <div className="overlay message-overlay" onClick={() => engine.dismissMessage()}>
          <div className="message-box" onClick={(e) => e.stopPropagation()}>
            {(() => {
              const src = assetUrlOrNull(engine.campaign, message.portrait)
              return src ? <img className="message-portrait" src={src} alt="" /> : null
            })()}
            <p>{message.text}</p>
            <button className="btn btn-small" onClick={() => engine.dismissMessage()}>Ок</button>
          </div>
        </div>
      )}

      {!cutscene && engine.state.game_over && !engine.dialogue && (
        <EndScreen engine={engine} onRestart={onRestart} onExitToMenu={onExitToMenu} onNewGamePlus={onNewGamePlus} />
      )}

      {!cutscene && engine.luckOffer && !engine.combat && (
        <div className="overlay message-overlay">
          <div className="message-box">
            <p>{engine.luckOffer.text}</p>
            <p className="muted small">
              Потратить удачу ({engine.luckOffer.cost} очк., осталось {engine.luck()}) и бросить заново?
            </p>
            <div className="modal-buttons">
              <button className="btn" onClick={() => engine.resolveLuckOffer(false)}>
                Оставить как есть
              </button>
              <button className="btn btn-primary" onClick={() => engine.resolveLuckOffer(true)}>
                Перебросить за удачу
              </button>
            </div>
          </div>
        </div>
      )}

      {cutscene && (
        <CutscenePlayer
          key={engine.cutsceneKey}
          cutscene={cutscene}
          resolve={resolveAsset}
          onEnd={endCutscene}
          resolveTrack={resolveTrack}
        />
      )}

      {/* Последовательная подача нарратива: открытка, затем сообщения, затем баннеры и тосты */}
      {isPostcardActive && engine.postcard && (
        <PostcardLayer
          postcard={engine.postcard}
          srcOf={resolveAsset}
          onTap={() => engine.hidePostcard()}
        />
      )}
      {!isStoryActive && <BannerLayer banners={engine.banners} />}
    </div>
  )
}
