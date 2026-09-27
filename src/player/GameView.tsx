import { useCallback, useEffect, useRef, useState } from 'react'
import type { GameEngine } from '../core/engine'
import { HUD } from './HUD'
import { SceneScreen } from './SceneScreen'
import { MapScreen } from './MapScreen'
import { DialogueOverlay } from './DialogueOverlay'
import { InventoryPanel, CharacterPanel, LogPanel, CraftingPanel } from './Panels'
import { SavesPanel } from './SavesPanel'
import { CodexPanel } from './CodexPanel'
import { TradePanel } from './TradePanel'
import { EndScreen } from './EndScreen'
import { HelpPanel } from './HelpPanel'
import { CombatScreen } from './CombatScreen'
import { assetUrl } from '../core/loader'
import { CutscenePlayer } from '../shared/CutscenePlayer'
import { setAudioCampaign, playUi, refreshAmbient, stopAllLoops } from '../shared/audio'
import { refreshMusic, setMenuMode, stopMusic, applyMusicVolume } from '../shared/music'
import { featureOn, type MusicTrackDef } from '../shared/types'

interface Props {
  engine: GameEngine
  onRestart: () => void
  onExitToMenu: () => void
  /** Загрузить забег из слота сохранений (аудит §5.6 п.9) — пересобирает движок */
  onLoadSlot?: (slot: import('../core/savemigrate').SaveSlot) => void
  debugPanelOpen?: boolean
  onGamePanelOpen?: () => void
}

type PanelId = 'map' | 'inventory' | 'character' | 'log' | 'help' | 'craft' | 'codex' | 'saves' | null

export function GameView({ engine, onRestart, onExitToMenu, onLoadSlot, debugPanelOpen = false, onGamePanelOpen }: Props) {
  const [panel, setPanel] = useState<PanelId>(null)
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
  const message = engine.messages[0]
  // катсцена (итерация 8, блок E): пока идёт ролик, экраны остальных эффектов
  // (диалог, бой, торговля, сообщения, финал) ждут его окончания
  const cutscene = engine.cutscene
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
      playUi('panel_open')
      setPanel(id)
    },
    [engine, onGamePanelOpen],
  )
  const closePanel = useCallback(() => {
    playUi('panel_close')
    setPanel(null)
  }, [])

  useEffect(() => {
    return () => {
      stopMusic(0.5)
      stopAllLoops()
    }
  }, [])

  return (
    <div className={`game-view ${damageFlash ? 'player-damage-flash' : ''}`}>
      <HUD
        engine={engine}
        onOpenMap={() => openPanel('map')}
        onOpenInventory={() => openPanel('inventory')}
        onOpenCharacter={() => openPanel('character')}
        onOpenLog={() => openPanel('log')}
        onOpenCraft={() => openPanel('craft')}
        onOpenCodex={() => openPanel('codex')}
        onOpenSaves={() => openPanel('saves')}
        onOpenHelp={() => openPanel('help')}
        onExitToMenu={onExitToMenu}
      />
      <SceneScreen engine={engine} onOpenMap={() => openPanel('map')} />

      {panel === 'map' && featureOn(engine.campaign.meta, 'map') && <MapScreen engine={engine} onClose={closePanel} />}
      {panel === 'inventory' && featureOn(engine.campaign.meta, 'inventory') && (
        <InventoryPanel engine={engine} onClose={closePanel} />
      )}
      {panel === 'character' && <CharacterPanel engine={engine} onClose={closePanel} />}
      {panel === 'craft' && featureOn(engine.campaign.meta, 'inventory') && (
        <CraftingPanel engine={engine} onClose={closePanel} />
      )}
      {panel === 'log' && <LogPanel engine={engine} onClose={closePanel} />}
      {panel === 'codex' && <CodexPanel engine={engine} onClose={closePanel} />}
      {panel === 'help' && <HelpPanel engine={engine} onClose={closePanel} />}
      {panel === 'saves' && onLoadSlot && (
        <SavesPanel engine={engine} onClose={closePanel} onLoadSlot={(slot) => { closePanel(); onLoadSlot(slot) }} />
      )}

      {!cutscene && engine.combat && <CombatScreen engine={engine} />}

      {!cutscene && engine.trade && !engine.combat && <TradePanel engine={engine} />}

      {!cutscene && engine.dialogue && !engine.combat && !engine.trade && <DialogueOverlay engine={engine} />}

      {!cutscene && message && (
        <div className="overlay message-overlay" onClick={() => engine.dismissMessage()}>
          <div className="message-box" onClick={(e) => e.stopPropagation()}>
            {message.portrait && (
              <img className="message-portrait" src={assetUrl(engine.campaign, message.portrait)} alt="" />
            )}
            <p>{message.text}</p>
            <button className="btn btn-small" onClick={() => engine.dismissMessage()}>Ок</button>
          </div>
        </div>
      )}

      {!cutscene && engine.state.game_over && !engine.dialogue && (
        <EndScreen engine={engine} onRestart={onRestart} onExitToMenu={onExitToMenu} />
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
    </div>
  )
}
