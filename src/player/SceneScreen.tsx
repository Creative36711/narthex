import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { GameEngine } from '../core/engine'
import { assetUrl, assetUrlOrNull } from '../core/loader'
import { timeOfDay } from '../core/time'
import { ArtView } from '../shared/ArtView'
import { firstFrame, LiveImg } from './frames'
import { AtmosphereLayer, useCameraStyle } from './Atmosphere'
import { playInteraction } from '../shared/audio'
import { useSettings, voiceVolume } from '../shared/settings'
import { Ico } from '../shared/icons'
import { getUiLabel, type ItemDef, type NarrativeIntroEntry, type SceneStateDef, type SlotDef, type SlotUseWith } from '../shared/types'

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
  const stageRef = useRef<HTMLDivElement | null>(null)
  const [highlightActive, setHighlightActive] = useState(false)

  // Плавный кинематографичный параллакс фона (lerp в rAF)
  const mouseTarget = useRef({ x: 0, y: 0 })
  const mouseCurrent = useRef({ x: 0, y: 0 })
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const loop = () => {
      const target = mouseTarget.current
      const cur = mouseCurrent.current
      // Мягкий коэффициент сглаживания 0.06 (без резких рывков)
      cur.x += (target.x - cur.x) * 0.06
      cur.y += (target.y - cur.y) * 0.06
      const el = stageRef.current
      if (el) {
        el.style.setProperty('--mouse-x', cur.x.toFixed(4))
        el.style.setProperty('--mouse-y', cur.y.toFixed(4))
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  const scene = engine.currentScene()
  const sceneId = scene?.id
  const state = scene ? engine.activeSceneState(scene) : null
  const camStyle = useCameraStyle(state?.camera ?? null)
  const stateKey = scene && state ? `${scene.id}:${state.id}` : ''
  const hasImage = !!state?.image
  const background: SceneBackground = hasImage
    ? { kind: 'image', src: assetUrl(engine.campaign, firstFrame(state.image)), label: state.label }
    : state?.art
      ? { kind: 'art', art: state.art }
      : { kind: 'fallback' }

  // ── Вводное повествование от третьего лица (стиль Tiny Bunny / новелла) ──
  const [narrativeStep, setNarrativeStep] = useState<number | null>(() => {
    return scene && engine.shouldShowNarrativeIntro(scene) ? 0 : null
  })

  useEffect(() => {
    if (scene && engine.shouldShowNarrativeIntro(scene)) {
      setNarrativeStep(0)
    } else {
      setNarrativeStep(null)
    }
  }, [sceneId, engine])

  const introList = useMemo<NarrativeIntroEntry[]>(() => scene?.narrative_intro ?? [], [scene?.narrative_intro])
  const currentIntro = narrativeStep != null ? introList[narrativeStep] : null
  const currentIntroItem = useMemo(() => {
    if (!currentIntro) return null
    return typeof currentIntro === 'string' ? { text: currentIntro } : currentIntro
  }, [currentIntro])

  const introAudioRef = useRef<HTMLAudioElement | null>(null)
  const settings = useSettings()

  const stopIntroAudio = useCallback(() => {
    if (introAudioRef.current) {
      introAudioRef.current.pause()
      introAudioRef.current.currentTime = 0
      introAudioRef.current = null
    }
  }, [])

  // Звук и озвучка текущей реплики нарратива
  useEffect(() => {
    stopIntroAudio()
    if (!currentIntroItem) return

    if (currentIntroItem.sfx) {
      playInteraction(currentIntroItem.sfx, { sound: currentIntroItem.sfx })
    }

    const vol = voiceVolume(settings)
    if (currentIntroItem.voice && vol > 0) {
      const a = new Audio(assetUrl(engine.campaign, currentIntroItem.voice))
      a.volume = vol
      void a.play().catch(() => {})
      introAudioRef.current = a
    }

    return () => stopIntroAudio()
  }, [currentIntroItem, engine, settings, stopIntroAudio])

  const advanceNarrative = useCallback(() => {
    if (narrativeStep == null || !scene) return
    const next = narrativeStep + 1
    if (next < introList.length) {
      setNarrativeStep(next)
    } else {
      stopIntroAudio()
      engine.markNarrativeIntroSeen(scene.id)
      setNarrativeStep(null)
    }
  }, [narrativeStep, scene, introList.length, stopIntroAudio, engine])

  // Перелистывание нарратива по Space / Enter / Escape
  useEffect(() => {
    if (narrativeStep == null || !scene?.narrative_intro) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        advanceNarrative()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        stopIntroAudio()
        engine.markNarrativeIntroSeen(scene.id)
        setNarrativeStep(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [narrativeStep, scene, advanceNarrative, stopIntroAudio, engine])

  // Подсветка хотспотов по зажатию Tab
  useEffect(() => {
    const handleDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault()
        setHighlightActive(true)
      }
    }
    const handleUp = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault()
        setHighlightActive(false)
      }
    }
    window.addEventListener('keydown', handleDown)
    window.addEventListener('keyup', handleUp)
    return () => {
      window.removeEventListener('keydown', handleDown)
      window.removeEventListener('keyup', handleUp)
    }
  }, [])

  useEffect(() => setBgError(''), [sceneId])
  useEffect(() => {
    const previous = previousBg.current
    previousBg.current = { key: stateKey, background }
    if (!previous || previous.key === stateKey || !stateKey) return
    if (state?.sound) {
      playInteraction(state.sound, { sound: state.sound }, state.sound_volume ?? 1)
    }
    setOutgoingBg(previous.background)
    const timer = window.setTimeout(() => setOutgoingBg(null), 450)
    return () => window.clearTimeout(timer)
  }, [stateKey, state?.sound, state?.sound_volume])

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
        <button
          type="button"
          className={`btn-highlight-hotspots ${highlightActive ? 'active' : ''}`}
          onClick={() => setHighlightActive((v) => !v)}
          data-tip="Подсветить активные точки сцены (Tab)"
        >
          <Ico n="search" /> {highlightActive ? 'Скрыть подсветку' : 'Подсветить точки (Tab)'}
        </button>
      </div>
      {/* сцена занимает всё оставшееся место без прокрутки: ширина и высота —
          от контейнера, картинка растягивается (object-fit: fill) */}
      <div
        ref={stageRef}
        className={`scene-stage ${lightingClass} ${highlightActive ? 'highlight-hotspots' : ''}`}
        onPointerMove={(e) => {
          const el = stageRef.current
          if (!el) return
          const rect = el.getBoundingClientRect()
          if (!rect.width || !rect.height) return
          const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2
          const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2
          mouseTarget.current.x = Math.max(-1, Math.min(1, nx))
          mouseTarget.current.y = Math.max(-1, Math.min(1, ny))
        }}
        onPointerLeave={() => {
          mouseTarget.current.x = 0
          mouseTarget.current.y = 0
        }}
      >
        <div key={stateKey} className="scene-bg-camera" style={camStyle}>
          {state.image && !bgError ? (
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
          ) : state.art ? (
            <ArtView className="scene-bg scene-bg-enter" art={state.art} />
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
        <div className="scene-foreground">
        {[...occupants]
          .filter((o): o is typeof o & { entity: NonNullable<typeof o.entity> } => o.entity != null)
          .sort((a, b) => a.slot.y + a.slot.h - (b.slot.y + b.slot.h))
          .map(({ slot, entity }) => {
            const npc = entity.type === 'npc' ? entity : null
            const item = entity.type === 'item' ? (entity as ItemDef) : null
            const forced = npc ? engine.entityState(npc.id) : undefined
            const stateOfSprite = forced ?? slot.sprite_state
            const sprite = npc
              ? (stateOfSprite && npc.scene_sprite_states?.[stateOfSprite]) || npc.scene_sprite
              : item?.scene_sprite
            const scale = slot.sprite_scale ?? 1
            const interactable = !item || engine.itemInteractable(item)
            const hasInteractChoices = !!item && interactable && engine.itemInteractOptions(item).length > 0
            const isEnvironmental = slot.environmental || (!sprite && entity.type === 'item')
            const isPlainItem = entity.type === 'item' && !sprite
            const displayLabel = npc ? engine.npcLabel(npc) : entity.label
            return (
              <button
                key={`${stateKey}-${slot.id}`}
                className={`slot-hotspot slot-${entity.type} scene-slot-enter ${sprite ? 'slot-sprited' : ''}${isPlainItem ? ' slot-item-plain' : ''}${isEnvironmental ? ' slot-environmental' : ''}${!interactable ? ' slot-inert' : ''}`}
                style={{
                  left: pct(slot.x, canvas.w),
                  top: pct(slot.y, canvas.h),
                  width: pct(slot.w, canvas.w),
                  height: pct(slot.h, canvas.h),
                }}
                disabled={!interactable}
                onClick={() => {
                  engine.fireTrigger('interact', { entityId: entity.id })
                  engine.inspectEntity(entity.id)
                  // «ключ к двери» (блок 8 ТЗ): НПС — диалог, иначе при наличии
                  // подходящих предметов — модалка выбора
                  if (entity.type !== 'npc') {
                    const options = engine.slotUseOptions(slot)
                    if (options.length) {
                      setUseModal({ slot, options })
                      return
                    }
                    if (hasInteractChoices && item) {
                      setInteractModal({ item })
                      return
                    }
                  }
                  engine.interactWithSlot({ slot, entity })
                }}
                data-tip={`${displayLabel}${engine.descOf(entity.id) ? `\n${engine.descOf(entity.id)}` : ''}`}
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
                        alt={displayLabel}
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
                          alt={displayLabel}
                          draggable={false}
                        />
                      )
                    }
                    if (isPlainItem) {
                      // У предметов без спрайта убираем любые маркеры и глифы,
                      // оставляем только надпись ровно как у зон навигации/переходов
                      return null
                    }
                    return (
                      <span className={`slot-marker slot-marker-${entity.type}`} aria-hidden>
                        <span className="slot-marker-glyph">◆</span>
                      </span>
                    )
                  })()
                )}
                <span className="slot-label">{displayLabel}</span>
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
              className="slot-hotspot slot-usewith slot-environmental"
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
        </div>

        {/* Навигационные зоны сцены («В контору», «На площадь»): не параллаксятся со спрайтами */}
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

        {/* слой погоды (блок 9 ТЗ): чистый CSS, полупрозрачный, не ловит клики */}
        {weather?.overlay && weather.overlay !== 'none' && (
          <AtmosphereLayer
            overlay={weather.overlay}
            atmospherics={engine.campaign.meta.atmospherics}
            srcOf={(path) => assetUrl(engine.campaign, path)}
          />
        )}
        {/* слой атмосферных частиц сцены (пыль, пар, искры, угли) */}
        {scene.particles && scene.particles !== 'none' && (
          <AtmosphereLayer
            overlay={scene.particles}
            atmospherics={engine.campaign.meta.atmospherics}
            srcOf={(path) => assetUrl(engine.campaign, path)}
          />
        )}

        {/* Вводное нарративное повествование от автора (стиль Tiny Bunny / новелла) */}
        {narrativeStep != null && currentIntroItem && (
          <div
            className="scene-narrative-overlay"
            onClick={advanceNarrative}
          >
            <div className="scene-narrative-box" onClick={(e) => e.stopPropagation()}>
              <div className="scene-narrative-text">
                {currentIntroItem.text}
              </div>
              <div className="scene-narrative-actions">
                <span className="muted small">
                  {narrativeStep + 1} / {introList.length} · Кликните или нажмите Пробел
                </span>
                <button
                  type="button"
                  className="btn btn-primary btn-small"
                  onClick={advanceNarrative}
                >
                  {narrativeStep + 1 < introList.length
                    ? (scene.narrative_intro_next_label || getUiLabel(engine.campaign.meta, 'scene_intro_next', 'Далее ▶'))
                    : (scene.narrative_intro_done_label || getUiLabel(engine.campaign.meta, 'scene_intro_done', 'Осмотреться ▶'))}
                </button>
              </div>
            </div>
          </div>
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
          <p className="itemdlg-desc">{engine.descOf(item.id) || item.description || ''}</p>
          <div className="usewith-options">
            {options.map((o, i) => {
              const autoHint = (() => {
                if (o.hint) return o.hint
                const hints: string[] = []
                const timeEf = o.effects?.find((ef) => ef.type === 'advance_time') as { ticks: number } | undefined
                if (timeEf?.ticks) {
                  const label = engine.campaign.meta.tick_label || 'ч'
                  hints.push(`⏱ ${timeEf.ticks} ${label}`)
                }
                if (o.consume) {
                  hints.push('предмет будет израсходован')
                }
                return hints.length ? hints.join(' · ') : null
              })()
              return (
                <button
                  key={i}
                  className="btn btn-primary itemdlg-option"
                  onMouseEnter={() => o.emotion && setEmotion(o.emotion)}
                  onMouseLeave={() => setEmotion('neutral')}
                  onClick={() => {
                    const consume = !!o.consume
                    const isOpenCraft = o.effects?.some((ef) => ef.type === 'open_craft')
                    engine.runItemInteract(item, o)
                    // item исчез со сцены, открыт крафт, бой или диалог — немедленно закрываем оверлей предмета!
                    if (consume || isOpenCraft || engine.craftRequest || engine.combat || engine.dialogue) {
                      onClose()
                    }
                  }}
                >
                  <span>{o.label}</span>
                  {autoHint && <small className="itemdlg-hint">{autoHint}</small>}
                </button>
              )
            })}
          </div>
          <button className="btn btn-small" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  )
}
