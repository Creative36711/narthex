import { useState } from 'react'
import type { GameEngine } from '../core/engine'
import { HUD } from './HUD'
import { SceneScreen } from './SceneScreen'
import { MapScreen } from './MapScreen'
import { DialogueOverlay } from './DialogueOverlay'
import { InventoryPanel, CharacterPanel, LogPanel } from './Panels'
import { EndScreen } from './EndScreen'
import { CombatScreen } from './CombatScreen'
import { assetUrl } from '../core/loader'

interface Props {
  engine: GameEngine
  onRestart: () => void
  onExitToMenu: () => void
}

type PanelId = 'map' | 'inventory' | 'character' | 'log' | null

export function GameView({ engine, onRestart, onExitToMenu }: Props) {
  const [panel, setPanel] = useState<PanelId>(null)
  const message = engine.messages[0]

  return (
    <div className="game-view">
      <HUD
        engine={engine}
        onOpenMap={() => setPanel('map')}
        onOpenInventory={() => setPanel('inventory')}
        onOpenCharacter={() => setPanel('character')}
        onOpenLog={() => setPanel('log')}
      />
      <SceneScreen engine={engine} onOpenMap={() => setPanel('map')} />

      {panel === 'map' && <MapScreen engine={engine} onClose={() => setPanel(null)} />}
      {panel === 'inventory' && <InventoryPanel engine={engine} onClose={() => setPanel(null)} />}
      {panel === 'character' && <CharacterPanel engine={engine} onClose={() => setPanel(null)} />}
      {panel === 'log' && <LogPanel engine={engine} onClose={() => setPanel(null)} />}

      {engine.combat && <CombatScreen engine={engine} />}

      {engine.dialogue && !engine.combat && <DialogueOverlay engine={engine} />}

      {message && !engine.dialogue && !engine.combat && (
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

      {engine.state.game_over && (
        <EndScreen engine={engine} onRestart={onRestart} onExitToMenu={onExitToMenu} />
      )}
    </div>
  )
}
