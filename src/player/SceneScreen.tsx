import type { GameEngine } from '../core/engine'
import { assetUrl } from '../core/loader'
import { timeOfDay } from '../core/time'
import { ArtView } from '../shared/ArtView'

interface Props {
  engine: GameEngine
  onOpenMap: () => void
}

/** Экран сцены: фон (активное состояние) + слоты + зоны навигации (ТЗ 6.1). */
export function SceneScreen({ engine, onOpenMap }: Props) {
  const scene = engine.currentScene()
  if (!scene) return <div className="scene-missing">Сцена не найдена</div>

  const canvas = scene.canvas ?? { w: 1280, h: 720 }
  const state = engine.activeSceneState(scene)
  const occupants = engine.slotOccupants(scene)
  const tod = timeOfDay(engine.state.tick, engine.campaign.meta)
  const loc = engine.findLocation(engine.state.location)

  const pct = (v: number, total: number) => `${(v / total) * 100}%`

  return (
    <div className="scene-wrap">
      <div className="scene-header">
        <span className="scene-location">{loc?.location.label}</span>
        <span className="scene-name">{scene.label} — {state.label}</span>
      </div>
      <div className={`scene-stage tod-tint-${tod}`} style={{ aspectRatio: `${canvas.w} / ${canvas.h}` }}>
        {state.art ? (
          <ArtView className="scene-bg" art={state.art} />
        ) : (
          state.image && (
            <img className="scene-bg" src={assetUrl(engine.campaign, state.image)} alt={state.label} draggable={false} />
          )
        )}

        {occupants.map(({ slot, entity }) =>
          entity ? (
            <button
              key={slot.id}
              className={`slot-hotspot slot-${entity.type}`}
              style={{
                left: pct(slot.x, canvas.w),
                top: pct(slot.y, canvas.h),
                width: pct(slot.w, canvas.w),
                height: pct(slot.h, canvas.h),
              }}
              onClick={() => engine.interactWithSlot({ slot, entity })}
              data-tip={entity.label}
            >
              {entity.type === 'npc' && entity.portrait?.neutral && (
                <img
                  className="slot-portrait"
                  src={assetUrl(engine.campaign, entity.portrait.neutral)}
                  alt={entity.label}
                  draggable={false}
                />
              )}
              <span className="slot-label">{entity.label}</span>
            </button>
          ) : null,
        )}

        {scene.navigation.map((nav, i) => {
          const handle = () => {
            if (nav.open_map) return onOpenMap()
            if (nav.go_to_scene) return engine.goToScene(nav.go_to_scene, nav.cost_ticks ?? 0)
          }
          return (
            <button
              key={i}
              className="nav-zone"
              style={{
                left: pct(nav.area.x, canvas.w),
                top: pct(nav.area.y, canvas.h),
                width: pct(nav.area.w, canvas.w),
                height: pct(nav.area.h, canvas.h),
              }}
              onClick={handle}
            >
              <span className="nav-label">{nav.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
