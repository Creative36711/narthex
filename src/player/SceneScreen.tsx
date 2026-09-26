import { useEffect, useState } from 'react'
import type { GameEngine } from '../core/engine'
import { assetUrl } from '../core/loader'
import { timeOfDay } from '../core/time'
import { ArtView } from '../shared/ArtView'
import type { SlotDef, SlotUseWith } from '../shared/types'

interface Props {
  engine: GameEngine
  onOpenMap: () => void
}

type UseModal = { slot: SlotDef; options: Array<{ itemId: string; label: string; use: SlotUseWith }> }

/** Экран сцены: фон (активное состояние) + слоты + зоны навигации (ТЗ 6.1). */
export function SceneScreen({ engine, onOpenMap }: Props) {
  const [useModal, setUseModal] = useState<UseModal | null>(null)
  /** фон сцены не загрузился — показываем причину прямо на экране */
  const [bgError, setBgError] = useState('')
  const scene = engine.currentScene()
  const sceneId = scene?.id
  useEffect(() => setBgError(''), [sceneId])
  if (!scene) return <div className="scene-missing">Сцена не найдена</div>

  const canvas = scene.canvas ?? { w: 1280, h: 720 }
  const state = engine.activeSceneState(scene)
  const occupants = engine.slotOccupants(scene)
  const tod = timeOfDay(engine.state.tick, engine.campaign.meta)
  const loc = engine.findLocation(engine.state.location)
  /** текущая погода (блок 9 ТЗ): слой поверх сцены + эмбиент в audio.ts */
  const weather = engine.campaign.meta.weathers?.find((w) => w.id === engine.state.weather)

  const pct = (v: number, total: number) => `${(v / total) * 100}%`

  return (
    <div className="scene-wrap">
      <div className="scene-header">
        <span className="scene-location">{loc?.location.label}</span>
        <span className="scene-name">{scene.label} — {state.label}</span>
      </div>
      {/* сцена занимает всё оставшееся место без прокрутки: ширина и высота —
          от контейнера, картинка растягивается (object-fit: fill) */}
      <div className={`scene-stage tod-tint-${tod}`}>
        {state.art ? (
          <ArtView className="scene-bg" art={state.art} />
        ) : state.image && !bgError ? (
          <img
            className="scene-bg"
            src={assetUrl(engine.campaign, state.image)}
            alt={state.label}
            draggable={false}
            onError={(e) => {
              // диагностика «чёрной сцены»: причина видна сразу, а не в глубине DevTools
              const src = (e.target as HTMLImageElement).currentSrc || state.image || '(путь не задан)'
              console.error(`[сцена] фон не загрузился: ${src}`)
              setBgError(src)
            }}
          />
        ) : (
          /* сцена без арта (или арт не загрузился) — не «чёрный экран» */
          <div className="scene-bg scene-bg-fallback" aria-hidden />
        )}
        {bgError && (
          <div className="scene-bg-note">
            Фон сцены не загрузился: {bgError}
            <br />
            Проверьте вкладку Network в DevTools — файл отсутствует или повреждён.
          </div>
        )}

        {/* спрайты рисуются по порядку снизу вверх: нижние — поверх дальних */}
        {[...occupants]
          .filter((o): o is typeof o & { entity: NonNullable<typeof o.entity> } => o.entity != null)
          .sort((a, b) => a.slot.y + a.slot.h - (b.slot.y + b.slot.h))
          .map(({ slot, entity }) => {
            const npc = entity.type === 'npc' ? entity : null
            const sprite = npc?.scene_sprite
            const scale = slot.sprite_scale ?? 1
            return (
              <button
                key={slot.id}
                className={`slot-hotspot slot-${entity.type} ${sprite ? 'slot-sprited' : ''}`}
                style={{
                  left: pct(slot.x, canvas.w),
                  top: pct(slot.y, canvas.h),
                  width: pct(slot.w, canvas.w),
                  height: pct(slot.h, canvas.h),
                }}
                onClick={() => {
                  // «ключ к двери» (блок 8 ТЗ): НПС — диалог, иначе при наличии
                  // подходящих предметов — модалка выбора
                  if (entity.type !== 'npc') {
                    const options = engine.slotUseOptions(slot)
                    if (options.length) {
                      setUseModal({ slot, options })
                      return
                    }
                  }
                  engine.interactWithSlot({ slot, entity })
                }}
                data-tip={`${entity.label}${engine.descOf(entity.id) ? `\n${engine.descOf(entity.id)}` : ''}`}
              >
                {npc && sprite ? (
                  <>
                    {npc.shadow !== false && <span className="sprite-shadow" />}
                    <img
                      className="slot-sprite"
                      src={assetUrl(engine.campaign, sprite)}
                      alt={npc.label}
                      draggable={false}
                      style={{ height: `${((slot.h * scale) / canvas.h) * 100}%` }}
                    />
                  </>
                ) : (
                  npc?.portrait?.neutral && (
                    <img
                      className="slot-portrait"
                      src={assetUrl(engine.campaign, npc.portrait.neutral)}
                      alt={npc.label}
                      draggable={false}
                    />
                  )
                )}
                <span className="slot-label">{entity.label}</span>
              </button>
            )
          })}

        {/* пустые слоты с «ключом к двери» (блок 8 ТЗ): невидимые точки применения */}
        {scene.slots
          .filter((slot) => {
            const taken = occupants.some((o) => o.slot.id === slot.id && o.entity)
            return !taken && engine.slotUseOptions(slot).length > 0
          })
          .map((slot) => (
            <button
              key={slot.id}
              className="slot-hotspot slot-usewith"
              style={{
                left: pct(slot.x, canvas.w),
                top: pct(slot.y, canvas.h),
                width: pct(slot.w, canvas.w),
                height: pct(slot.h, canvas.h),
              }}
              onClick={() => setUseModal({ slot, options: engine.slotUseOptions(slot) })}
              data-tip={slot.label ? `Использовать предмет: ${slot.label}` : 'Использовать предмет'}
            />
          ))}

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

        {/* слой погоды (блок 9 ТЗ): чистый CSS, полупрозрачный, не ловит клики */}
        {weather?.overlay && weather.overlay !== 'none' && (
          <div className={`weather-overlay weather-${weather.overlay}`} aria-hidden="true" />
        )}
      </div>

      {/* модалка выбора предмета для слота (блок 8 ТЗ) */}
      {useModal && (
        <div className="overlay message-overlay" onClick={() => setUseModal(null)}>
          <div className="message-box usewith-box" onClick={(e) => e.stopPropagation()}>
            <p>
              {useModal.options.length > 1
                ? `Что использовать на «${useModal.slot.label ?? 'объекте'}»?`
                : `Использовать на «${useModal.slot.label ?? 'объекте'}»?`}
            </p>
            <div className="usewith-options">
              {useModal.options.map((o) => (
                <button
                  key={o.itemId}
                  className="btn btn-primary"
                  onClick={() => {
                    engine.useItemOnSlot(useModal.slot.id, o.itemId)
                    setUseModal(null)
                  }}
                >
                  {o.label}
                  {o.use.consume ? ' (будет израсходован)' : ''}
                </button>
              ))}
            </div>
            <button className="btn btn-small" onClick={() => setUseModal(null)}>Отмена</button>
          </div>
        </div>
      )}
    </div>
  )
}
