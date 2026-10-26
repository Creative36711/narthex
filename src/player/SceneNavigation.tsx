import type { GameEngine } from '../core/engine'
import type { SceneDef } from '../shared/types'

interface Props {
  engine: GameEngine
  scene: SceneDef
  canvas: { w: number; h: number }
  onOpenMap: () => void
}

/** Навигационные зоны сцены («В контору», «На площадь») — не параллаксятся. */
export function SceneNavigation({ engine, scene, canvas, onOpenMap }: Props) {
  const pct = (v: number, total: number) => `${(v / total) * 100}%`
  return (
    <>
        {scene.navigation.map((nav, i) => {
          const handle = () => {
            if (nav.open_map) return onOpenMap()
            engine.navigate(nav)
          }
          return (
            <button
              key={i}
              className={`nav-zone${nav.hide_label ? ' nav-nolabel' : ''}`}
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
    </>
  )
}
