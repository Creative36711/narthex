import { useCallback, useEffect, useRef, useState } from 'react'
import type { GameEngine } from '../core/engine'
import { HUD } from './HUD'
import { SceneScreen } from './SceneScreen'
import { MapScreen } from './MapScreen'
import { DialogueOverlay } from './DialogueOverlay'
import { InventoryPanel, CharacterPanel, LogPanel } from './Panels'
import { TradePanel } from './TradePanel'
import { EndScreen } from './EndScreen'
import { HelpPanel } from './HelpPanel'
import { CombatScreen } from './CombatScreen'
import { assetUrl } from '../core/loader'
import { CutscenePlayer } from '../shared/CutscenePlayer'
import { setAudioCampaign, playUi, refreshAmbient, stopAllLoops } from '../shared/audio'
import { refreshMusic, setMenuMode, stopMusic, applyMusicVolume } from '../shared/music'
import type { MusicTrackDef } from '../shared/types'

interface Props {
  engine: GameEngine
  onRestart: () => void
  onExitToMenu: () => void
}

type PanelId = 'map' | 'inventory' | 'character' | 'log' | 'help' | null

export function GameView({ engine, onRestart, onExitToMenu }: Props) {
  const [panel, setPanel] = useState<PanelId>(null)
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

  // звуки панелей (H4)
  const openPanel = useCallback((id: Exclude<PanelId, null>) => {
    playUi('panel_open')
    setPanel(id)
  }, [])
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
    <div className="game-view">
      <HUD
        engine={engine}
        onOpenMap={() => openPanel('map')}
        onOpenInventory={() => openPanel('inventory')}
        onOpenCharacter={() => openPanel('character')}
        onOpenLog={() => openPanel('log')}
        onOpenHelp={() => openPanel('help')}
        onExitToMenu={onExitToMenu}
      />
      <SceneScreen engine={engine} onOpenMap={() => openPanel('map')} />

      {panel === 'map' && <MapScreen engine={engine} onClose={closePanel} />}
      {panel === 'inventory' && <InventoryPanel engine={engine} onClose={closePanel} />}
      {panel === 'character' && <CharacterPanel engine={engine} onClose={closePanel} />}
      {panel === 'log' && <LogPanel engine={engine} onClose={closePanel} />}
      {panel === 'help' && <HelpPanel engine={engine} onClose={closePanel} />}

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
