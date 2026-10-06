import { useEffect, useRef, useState } from 'react'
import type { GameEngine } from '../core/engine'
import { assetUrl, assetUrlOrNull } from '../core/loader'
import { timeOfDay } from '../core/time'
import { ArtView } from '../shared/ArtView'
import { firstFrame, LiveImg } from './frames'
import { AtmosphereLayer, useCameraStyle } from './Atmosphere'
import type { ItemDef, SceneStateDef, SlotDef, SlotUseWith } from '../shared/types'

interface Props {
  engine: GameEngine
  onOpenMap: () => void
}

type UseModal = { slot: SlotDef; options: Array<{ itemId: string; label: string; use: SlotUseWith }> }
type ItemInteractModal = { item: ItemDef }
type SceneBackground = { kind: 'image'; src: string; label: string } | { kind: 'art'; art: NonNullable<SceneStateDef['art']> } | { kind: 'fallback' }

/** Экран сцены: фон (активное состояние) + слоты + зоны навигации (ТЗ 6.1). */
export function SceneScreen({ engine, onOpenMap }: Props) {
  const [useModal, setUseModal] = useState<UseModal | null>(null)
  const [interactModal, setInteractModal] = useState<ItemInteractModal | null>(null)
  /** фон сцены не загрузился — показываем причину прямо на экране */
  const [bgError, setBgError] = useState('')
  const [outgoingBg, setOutgoingBg] = useState<SceneBackground | null>(null)
  const previousBg = useRef<{ key: string; background: SceneBackground } | null>(null)
  const scene = engine.currentScene()
  const sceneId = scene?.id
  const state = scene ? engine.activeSceneState(scene) : null
  const camStyle = useCameraStyle(state?.camera ?? null)
  const stateKey = scene && state ? `${scene.id}:${state.id}` : ''
  const background: SceneBackground = state?.art
    ? { kind: 'art', art: state.art }
    : state?.image
      ? { kind: 'image', src: assetUrl(engine.campaign, firstFrame(state.image)), label: state.label }
      : { kind: 'fallback' }

  useEffect(() => setBgError(''), [sceneId])
  useEffect(() => {
    const previous = previousBg.current
    previousBg.current = { key: stateKey, background }
    if (!previous || previous.key === stateKey || !stateKey) return
    setOutgoingBg(previous.background)
    const timer = window.setTimeout(() => setOutgoingBg(null), 450)
    return () => window.clearTimeout(timer)
  }, [stateKey])

  if (!scene || !state) return <div className="scene-missing">Сцена не найдена</div>

  const canvas = scene.canvas ?? { w: 1280, h: 720 }
  const occupants = engine.slotOccupants(scene)
  const tod = timeOfDay(engine.state.tick, engine.campaign.meta)
  const loc = engine.findLocation(engine.state.location)
  /** текущая погода (блок 9 ТЗ): слой поверх сцены + эмбиент в audio.ts */
  const weather = engine.campaign.meta.weathers?.find((w) => w.id === engine.state.weather)

  const pct = (v: number, total: number) => `${(v / total) * 100}%`
  const sceneLighting = scene.lighting ?? 'outdoor'
  const lightingClass = sceneLighting === 'outdoor' ? `tod-tint-${tod}` : `scene-lighting-${sceneLighting}`

  return (
    <div className="scene-wrap">
      <div className="scene-header">
        <span className="scene-location">{loc?.location.label}</span>
        {/* сцена часто называется по локации («Западные ворота»): не дублируем
            имя локации в подзаголовке (фидбек 27, п.8) */}
        <span className="scene-name">
          {scene.label === loc?.location.label ? state.label : `${scene.label} — ${state.label}`}
        </span>
      </div>
      {/* сцена занимает всё оставшееся место без прокрутки: ширина и высота —
          от контейнера, картинка растягивается (object-fit: fill) */}
      <div className={`scene-stage ${lightingClass}`}>
        <div key={stateKey} className="scene-bg-camera" style={camStyle}>
          {state.art ? (
            <ArtView className="scene-bg scene-bg-enter" art={state.art} />
          ) : state.image && !bgError ? (
            <LiveImg
              className="scene-bg scene-bg-enter"
              value={state.image}
              tickKey={stateKey}
              urlOf={(f) => assetUrl(engine.campaign, f)}
              alt={state.label}
              draggable={false}
              onError={(src) => {
                // диагностика «чёрной сцены»: причина видна сразу, а не в глубине DevTools
                console.error(`[сцена] фон не загрузился: ${src}`)
                setBgError(src)
              }}
            />
          ) : (
            /* сцена без арта (или арт не загрузился) — не «чёрный экран» */
            <div className="scene-bg scene-bg-fallback scene-bg-enter" aria-hidden />
          )}
        </div>
        {outgoingBg?.kind === 'image' && <img className="scene-bg scene-bg-transition-out" src={outgoingBg.src} alt="" draggable={false} />}
        {outgoingBg?.kind === 'art' && <ArtView className="scene-bg scene-bg-transition-out" art={outgoingBg.art} />}
        {outgoingBg?.kind === 'fallback' && <div className="scene-bg scene-bg-fallback scene-bg-transition-out" aria-hidden />}
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
            const item = entity.type === 'item' ? (entity as ItemDef) : null
            // спрайт: НПС — sprite в сцене (с откатом на портрет «Обычный» ниже),
            // предмет — только своя картинка; без неё в слоте не рисуется ничего.
            // Состояние спрайта: сначала правило (set_entity_state), иначе —
            // свойство слота (как «настроение» в диалоге), иначе обычный спрайт.
            const forced = npc ? engine.entityState(npc.id) : undefined
            const stateOfSprite = forced ?? slot.sprite_state
            const sprite = npc
              ? (stateOfSprite && npc.scene_sprite_states?.[stateOfSprite]) || npc.scene_sprite
              : item?.scene_sprite
            const scale = slot.sprite_scale ?? 1
            // предмет под условием блокировки — «декорация»: виден, но не кликается (№8)
            const interactable = !item || engine.itemInteractable(item)
            const hasInteractChoices = !!item && interactable && engine.itemInteractOptions(item).length > 0
            return (
              <button
                key={`${stateKey}-${slot.id}`}
                className={`slot-hotspot slot-${entity.type} scene-slot-enter ${sprite ? 'slot-sprited' : ''}${!interactable ? ' slot-inert' : ''}`}
                style={{
                  left: pct(slot.x, canvas.w),
                  top: pct(slot.y, canvas.h),
                  width: pct(slot.w, canvas.w),
                  height: pct(slot.h, canvas.h),
                }}
                disabled={!interactable}
                onClick={() => {
                  // «ключ к двери» (блок 8 ТЗ): НПС — диалог, иначе при наличии
                  // подходящих предметов — модалка выбора
                  if (entity.type !== 'npc') {
                    const options = engine.slotUseOptions(slot)
                    if (options.length) {
                      setUseModal({ slot, options })
                      return
                    }
                    // варианты действий с предметом — окно выбора (фидбек №8)
                    if (hasInteractChoices && item) {
                      setInteractModal({ item })
                      return
                    }
                  }
                  engine.interactWithSlot({ slot, entity })
                }}
                data-tip={`${entity.label}${engine.descOf(entity.id) ? `\n${engine.descOf(entity.id)}` : ''}`}
              >
                {sprite ? (
                  <>
                    {entity.shadow !== false && <span className="sprite-shadow" />}
                    <span className="slot-sprite-box" style={{ height: `${scale * 100}%` }}>
                      <LiveImg
                        className="slot-sprite"
                        value={sprite}
                        tickKey={stateOfSprite ?? ''}
                        urlOf={(f) => assetUrl(engine.campaign, f)}
                        alt={entity.label}
                      />
                    </span>
                  </>
                ) : (
                  (() => {
                    const portraitSrc = npc
                      ? assetUrlOrNull(engine.campaign, npc.portrait?.neutral)
                      : null
                    if (portraitSrc) {
                      return (
                        <img
                          className="slot-portrait"
                          src={portraitSrc}
                          alt={npc?.label}
                          draggable={false}
                        />
                      )
                    }
                    // нет спрайта и нет портрета — видимый маркер, иначе слот
                    // невидим (прозрачный button поверх ArtDoc), игрок «не видит»
                    // терминал/предмет (ИИ-кампании без ассетов)
                    return (
                      <span className={`slot-marker slot-marker-${entity.type}`} aria-hidden>
                        <span className="slot-marker-glyph">{entity.type === 'npc' ? '◆' : '●'}</span>
                      </span>
                    )
                  })()
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

        {/* слой погоды (блок 9 ТЗ): чистый CSS, полупрозрачный, не ловит клики */}
        {weather?.overlay && weather.overlay !== 'none' && (
          <AtmosphereLayer
            overlay={weather.overlay}
            atmospherics={engine.campaign.meta.atmospherics}
            srcOf={(path) => assetUrl(engine.campaign, path)}
          />
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

      {/* окно действий с предметом (фидбек №8): мини-диалог с портретом предмета */}
      {interactModal && (
        <ItemInteractDialog
          engine={engine}
          item={interactModal.item}
          onClose={() => setInteractModal(null)}
        />
      )}
    </div>
  )
}

/** Мини-диалог с предметом: портрет (если есть), описание и варианты действий. */
function ItemInteractDialog({ engine, item, onClose }: { engine: GameEngine; item: ItemDef; onClose: () => void }) {
  const [emotion, setEmotion] = useState('neutral')
  const options = engine.itemInteractOptions(item)
  const portraitSrc = assetUrlOrNull(
    engine.campaign,
    item.portrait?.[emotion] ?? item.portrait?.['neutral'],
  )
  return (
    <div className="overlay message-overlay itemdlg-overlay" onClick={onClose}>
      <div className="itemdlg-box" onClick={(e) => e.stopPropagation()}>
        {portraitSrc && (
          <div className="itemdlg-portrait">
            <img src={portraitSrc} alt={item.label} draggable={false} />
          </div>
        )}
        <div className="itemdlg-content">
          <h3 className="itemdlg-title">{item.label}</h3>
          <p className="itemdlg-desc">{item.description}</p>
          <div className="usewith-options">
            {options.map((o, i) => (
              <button
                key={i}
                className="btn btn-primary itemdlg-option"
                onMouseEnter={() => o.emotion && setEmotion(o.emotion)}
                onMouseLeave={() => setEmotion('neutral')}
                onClick={() => {
                  const consume = !!o.consume
                  engine.runItemInteract(item, o)
                  // item исчез со сцены — окно давно бессмысленно
                  if (consume) onClose()
                }}
              >
                <span>{o.label}</span>
                {o.hint && <small className="itemdlg-hint">{o.hint}</small>}
              </button>
            ))}
          </div>
          <button className="btn btn-small" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  )
}
