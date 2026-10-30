import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { GameEngine } from '../core/engine'
import { assetUrl } from '../core/loader'
import { timeOfDay } from '../core/time'
import { ArtView } from '../shared/ArtView'
import { firstFrame, LiveImg } from './frames'
import { AtmosphereLayer, useCameraStyle } from './Atmosphere'
import { playInteraction } from '../shared/audio'
import { playVoiceAudio, stopVoiceAudio } from '../shared/voiceAudio'
import { useSettings, voiceVolume } from '../shared/settings'
import { Ico } from '../shared/icons'
import type { ItemDef, NarrativeIntroEntry, SceneStateDef, SlotDef, SlotUseWith } from '../shared/types'
import { ItemInteractDialog } from './ItemInteractDialog'
import { SceneForeground } from './SceneForeground'
import { SceneIntroOverlay } from './SceneIntroOverlay'
import { SceneNavigation } from './SceneNavigation'

interface Props {
  engine: GameEngine
  onOpenMap: () => void
}

type UseModal = { slot: SlotDef; options: Array<{ itemId: string; label: string; use: SlotUseWith }> }
type ItemInteractModal = { item: ItemDef }
type SceneBackground = { kind: 'image'; src: string; label: string } | { kind: 'art'; art: NonNullable<SceneStateDef['art']> } | { kind: 'fallback' }

/**
 * Очистка и форматирование подзаголовка сцены:
 * Убирает технические и тривиальные надписи («Всегда», «Днём», «Основное»),
 * из-за которых игроку выводились нелепые конструкции вроде «Контора дознавателя — Всегда».
 */
function formatSceneSubtitle(sceneLabel: string, locLabel: string | undefined, stateLabel: string | undefined): string | null {
  const trivialLabels = new Set([
    'всегда', 'обычное', 'основное', 'по умолчанию', 'базовое', 'стандартное', 'исходное',
    'днём', 'день', 'ночью', 'ночь', 'утро', 'утром', 'вечер', 'вечером',
    'default', 'main', 'base', 'normal', 'day', 'night', 'morning', 'evening',
  ])

  const sLabel = (sceneLabel ?? '').trim()
  const lLabel = (locLabel ?? '').trim()
  const rawState = (stateLabel ?? '').trim()
  const isTrivialState = !rawState || trivialLabels.has(rawState.toLowerCase())

  // Сцена имеет собственное отличимое название (например, локация «Шлюз седьмого яруса», сцена «Шлюзовая камера»)
  if (sLabel && sLabel.toLowerCase() !== lLabel.toLowerCase()) {
    if (!isTrivialState && rawState.toLowerCase() !== sLabel.toLowerCase()) {
      return `${sLabel} (${rawState})`
    }
    return sLabel
  }

  // Название сцены совпадает с локацией (например «Западные ворота» и «Западные ворота»)
  if (!isTrivialState && rawState.toLowerCase() !== lLabel.toLowerCase()) {
    return rawState
  }

  return null
}

/** Экран сцены: фон (активное состояние) + слоты + зоны навигации (ТЗ 6.1). */
export function SceneScreen({ engine, onOpenMap }: Props) {
  const [useModal, setUseModal] = useState<UseModal | null>(null)
  const [interactModal, setInteractModal] = useState<ItemInteractModal | null>(null)
  /** фон сцены не загрузился — уходим на нейтральный фон, причина в console.error (D-076) */
  const [bgError, setBgError] = useState('')
  const [outgoingBg, setOutgoingBg] = useState<SceneBackground | null>(null)
  const previousBg = useRef<{ key: string; background: SceneBackground } | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const [highlightActive, setHighlightActive] = useState(false)

  // Если активировалась открытка, сообщение или катсцена — немедленно закрываем оверлеи взаимодействия с объектами
  useEffect(() => {
    if (engine.postcard || engine.messages.length > 0 || engine.cutscene) {
      setInteractModal(null)
      setUseModal(null)
    }
  }, [engine.postcard, engine.messages.length, engine.cutscene])

  // Плавный кинематографичный параллакс фона (lerp в rAF)
  const mouseTarget = useRef({ x: 0, y: 0 })
  const mouseCurrent = useRef({ x: 0, y: 0 })
  const rafRef = useRef<number>(0)
  const settings = useSettings()

  useEffect(() => {
    if (settings.camera_parallax === false || settings.animations === false) {
      const el = stageRef.current
      if (el) {
        el.style.setProperty('--mouse-x', '0')
        el.style.setProperty('--mouse-y', '0')
      }
      return
    }
    const loop = () => {
      const target = mouseTarget.current
      const cur = mouseCurrent.current
      // Мягкий коэффициент сглаживания 0.05: синхронная кинематографичная камера
      cur.x += (target.x - cur.x) * 0.05
      cur.y += (target.y - cur.y) * 0.05
      const el = stageRef.current
      if (el) {
        el.style.setProperty('--mouse-x', cur.x.toFixed(4))
        el.style.setProperty('--mouse-y', cur.y.toFixed(4))
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [settings.camera_parallax, settings.animations])

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
  // Если идёт катсцена, диалог или бой — нарративное интро сцены ждёт их завершения
  const [narrativeStep, setNarrativeStep] = useState<number | null>(() => {
    return scene && engine.shouldShowNarrativeIntro(scene) && !engine.cutscene && !engine.dialogue && !engine.combat
      ? 0
      : null
  })

  useEffect(() => {
    if (engine.cutscene || engine.dialogue || engine.combat) {
      setNarrativeStep(null)
      stopVoiceAudio()
      return
    }
    if (scene && engine.shouldShowNarrativeIntro(scene)) {
      setNarrativeStep(0)
    } else {
      setNarrativeStep(null)
    }
  }, [sceneId, engine, engine.cutscene, engine.dialogue, engine.combat])

  const introList = useMemo<NarrativeIntroEntry[]>(() => scene?.narrative_intro ?? [], [scene?.narrative_intro])
  const currentIntro = narrativeStep != null ? introList[narrativeStep] : null
  const currentIntroItem = useMemo(() => {
    if (!currentIntro) return null
    return typeof currentIntro === 'string' ? { text: currentIntro } : currentIntro
  }, [currentIntro])

  // Звук и озвучка текущей реплики нарратива через глобальный Voice Coordinator
  useEffect(() => {
    stopVoiceAudio()
    if (!currentIntroItem || engine.cutscene || engine.dialogue || engine.combat) return

    if (currentIntroItem.sfx) {
      playInteraction(currentIntroItem.sfx, { sound: currentIntroItem.sfx })
    }

    const vol = voiceVolume(settings)
    if (currentIntroItem.voice && vol > 0) {
      playVoiceAudio(assetUrl(engine.campaign, currentIntroItem.voice), {
        volume: vol,
      })
    }

    return () => {
      stopVoiceAudio()
    }
  }, [currentIntroItem, engine, settings, engine.cutscene, engine.dialogue, engine.combat])

  // глушим голос при уходе со сцены
  useEffect(() => {
    return () => {
      stopVoiceAudio()
    }
  }, [])

  const advanceNarrative = useCallback(() => {
    if (narrativeStep == null || !scene) return
    const next = narrativeStep + 1
    if (next < introList.length) {
      setNarrativeStep(next)
    } else {
      stopVoiceAudio()
      engine.markNarrativeIntroSeen(scene.id)
      setNarrativeStep(null)
    }
  }, [narrativeStep, scene, introList.length, engine])

  // Перелистывание нарратива по Space / Enter / Escape
  useEffect(() => {
    if (narrativeStep == null || !scene?.narrative_intro) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.code === 'Space' || e.key === 'Enter') {
        e.preventDefault()
        advanceNarrative()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        stopVoiceAudio()
        engine.markNarrativeIntroSeen(scene.id)
        setNarrativeStep(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [narrativeStep, scene, advanceNarrative, engine])

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

  const sceneLighting = scene.lighting ?? 'outdoor'
  const lightingClass = sceneLighting === 'outdoor' ? `tod-tint-${tod}` : `scene-lighting-${sceneLighting}`
  const subTitle = formatSceneSubtitle(scene.label, loc?.location.label, state.label)

  return (
    <div className="scene-wrap">
      <div className="scene-header">
        <span className="scene-location">{loc?.location.label}</span>
        {/* сцена часто называется по локации («Западные ворота»): не дублируем
            имя локации в подзаголовке (фидбек 27, п.8) */}
        {subTitle && (
          <span className="scene-name">
            {subTitle}
          </span>
        )}
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
        <div className="scene-camera-stage">
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
        {/* Техническую плашку игрок не видит (D-076): вместо неё нейтральный
            scene-bg-fallback выше, а причина остаётся в console.error и в
            отчётах audit:campaign / playthrough:exam. */}


        <SceneForeground
          engine={engine}
          scene={scene}
          stateKey={stateKey}
          occupants={occupants}
          canvas={canvas}
          onUseRequest={(slot, options) => setUseModal({ slot, options })}
          onInteractRequest={(item) => setInteractModal({ item })}
        />
        <SceneNavigation engine={engine} scene={scene} canvas={canvas} onOpenMap={onOpenMap} />
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
          <SceneIntroOverlay
            engine={engine}
            scene={scene}
            step={narrativeStep}
            item={currentIntroItem}
            intro={introList}
            onAdvance={advanceNarrative}
            onSkip={() => {
              stopVoiceAudio()
              engine.markNarrativeIntroSeen(scene.id)
              setNarrativeStep(null)
            }}
          />
        )}
        </div>
      </div>

      {/* модалка выбора предмета для слота (блок 8 ТЗ) */}
      {useModal && !engine.postcard && !engine.messages.length && !engine.cutscene && (
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
      {interactModal && !engine.postcard && !engine.messages.length && !engine.cutscene && (
        <ItemInteractDialog
          engine={engine}
          item={interactModal.item}
          onClose={() => setInteractModal(null)}
        />
      )}
    </div>
  )
}
