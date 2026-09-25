import { useCallback, useState } from 'react'
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

  return (
    <div className="game-view">
      <HUD
        engine={engine}
        onOpenMap={() => setPanel('map')}
        onOpenInventory={() => setPanel('inventory')}
        onOpenCharacter={() => setPanel('character')}
        onOpenLog={() => setPanel('log')}
        onOpenHelp={() => setPanel('help')}
        onExitToMenu={onExitToMenu}
      />
      <SceneScreen engine={engine} onOpenMap={() => setPanel('map')} />

      {panel === 'map' && <MapScreen engine={engine} onClose={() => setPanel(null)} />}
      {panel === 'inventory' && <InventoryPanel engine={engine} onClose={() => setPanel(null)} />}
      {panel === 'character' && <CharacterPanel engine={engine} onClose={() => setPanel(null)} />}
      {panel === 'log' && <LogPanel engine={engine} onClose={() => setPanel(null)} />}
      {panel === 'help' && <HelpPanel engine={engine} onClose={() => setPanel(null)} />}

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
        />
      )}
    </div>
  )
}
