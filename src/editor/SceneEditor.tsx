import { Ico } from '../shared/icons'
import { useEffect, useRef, useState } from 'react'
import { Stage, Layer, Image as KImage, Rect, Text, Transformer, Group } from 'react-konva'
import type Konva from 'konva'
import type { ArtDoc, ItemDef, NavigationZone, NpcDef, SceneCondition, SceneDef, SceneStateDef, SlotDef, TimeOfDay } from '../shared/types'
import { ArtView } from '../shared/ArtView'
import type { EditorStore } from './store'
import { JsonField, RefSelect, FlagSelect, FileAdvancedJson, EffectListEditor, ConditionListEditor, AnimImageEditor, ChapterSelect } from './Fields'
import { slotTypesFor, effectiveSlotType } from './slotTypes'
import { makeId } from './ids'
import { MusicRulesEditor, SoundMultiSelect } from './AudioSection'
import { firstFrame } from '../player/frames'
import { CameraEditor } from './AtmosEditors'

/**
 * Визуальный редактор сцены (ТЗ 5.2.2) на Konva:
 * фон = изображение активного состояния, слоты и навигационные зоны —
 * перетаскиваемые/масштабируемые прямоугольники.
 */



/** Конструктор простого условия сцены/слота (№15): по-русски, без JSON */
export function SceneConditionEditor({
  value,
  store,
  onChange,
}: {
  value: SceneCondition | null
  store: EditorStore
  onChange: (v: SceneCondition | null) => void
}) {
  const TOD: Array<{ id: TimeOfDay; label: string }> = [
    { id: 'morning', label: 'утро' },
    { id: 'day', label: 'день' },
    { id: 'evening', label: 'вечер' },
    { id: 'night', label: 'ночь' },
  ]
  const v = value ?? {}
  const tods = Array.isArray(v.time_of_day) ? v.time_of_day : v.time_of_day ? [v.time_of_day] : []
  const apply = (next: SceneCondition) => {
    const clean: SceneCondition = {}
    if (next.time_of_day && (!Array.isArray(next.time_of_day) || next.time_of_day.length)) clean.time_of_day = next.time_of_day
    if (next.flag) clean.flag = next.flag
    if (next.not_flag) clean.not_flag = next.not_flag
    if (next.weather !== undefined) clean.weather = next.weather
    onChange(Object.keys(clean).length ? clean : null)
  }
  return (
    <div className="fld fld-block scene-cond">
      <span>Показывать только когда…</span>
      <div className="chips">
        {TOD.map((t) => (
          <label key={t.id} className={`chip ${tods.includes(t.id) ? 'chip-on' : ''}`}>
            <input
              type="checkbox"
              checked={tods.includes(t.id)}
              onChange={(e) => {
                const next = e.target.checked ? [...tods, t.id] : tods.filter((x) => x !== t.id)
                apply({ ...v, time_of_day: next.length ? next : undefined })
              }}
            />
            {t.label}
          </label>
        ))}
      </div>
      <div className="fld-row">
        <FlagSelect label="…установлен флаг" store={store} value={v.flag ?? ''} optional onChange={(f) => apply({ ...v, flag: f || undefined })} />
        <FlagSelect label="…НЕ установлен флаг" store={store} value={v.not_flag ?? ''} optional onChange={(f) => apply({ ...v, not_flag: f || undefined })} />
      </div>
      <RefSelect
        label="…погода"
        kind="weather"
        store={store}
        value={v.weather ?? ''}
        optional
        onChange={(w) => apply({ ...v, weather: w === undefined || w === '' ? undefined : w })}
      />
      <div className="muted small">Пусто = показывается всегда.</div>
    </div>
  )
}

function useImage(src: string | null): HTMLImageElement | null {
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  useEffect(() => {
    if (!src) return setImg(null)
    const im = new window.Image()
    im.src = src
    im.onload = () => setImg(im)
    return () => setImg(null)
  }, [src])
  return img
}

function SlotEntitySprite({ slot, store, k }: { slot: SlotDef; store: EditorStore; k: number }) {
  const entityId = slot.default_entity
  if (!entityId) return null
  const allEnts = store.entityPaths().map((p) => store.entity(p))
  const entity = allEnts.find((e) => e?.id === entityId) as (ItemDef | NpcDef | undefined)
  if (!entity) return null

  const isNpc = entity.type === 'npc'
  const npc = isNpc ? (entity as NpcDef) : null
  const item = !isNpc ? (entity as ItemDef) : null

  const stateOfSprite = slot.sprite_state
  const spriteVal = isNpc
    ? (stateOfSprite && npc?.scene_sprite_states?.[stateOfSprite]) || npc?.scene_sprite || (npc as any)?.sprite
    : item?.scene_sprite || (item as any)?.sprite || (item as any)?.image

  const first = spriteVal ? firstFrame(spriteVal) : null
  const src = first ? store.assetSrc(first) : null
  return <SlotSpriteImage src={src} slot={slot} k={k} />
}

function SlotSpriteImage({ src, slot, k }: { src: string | null; slot: SlotDef; k: number }) {
  const img = useImage(src)
  if (!img) return null

  const scale = slot.sprite_scale ?? 1
  const x = slot.x * k
  const y = slot.y * k
  const w = slot.w * k
  const h = slot.h * k

  const natW = img.naturalWidth || 1
  const natH = img.naturalHeight || 1
  const imgRatio = natW / natH

  const targetH = h * scale
  const targetW = targetH * imgRatio
  const drawX = x + (w - targetW) / 2
  const drawY = y + (h - targetH)

  return (
    <KImage
      image={img}
      x={drawX}
      y={drawY}
      width={targetW}
      height={targetH}
      listening={false}
      opacity={0.92}
    />
  )
}

type Sel = { kind: 'slot'; index: number } | { kind: 'nav'; index: number } | null
type SceneTab = 'object' | 'scene' | 'states'

export function SceneEditor({
  store,
  path,
  onPlaytestScene,
}: {
  store: EditorStore
  path: string
  onPlaytestScene?: (sceneId: string) => void
}) {
  const loadedScene = store.scene(path)
  const scene = loadedScene ?? ({
    id: path,
    label: path,
    canvas: { w: 1280, h: 720 },
    states: [],
    slots: [],
    navigation: [],
  } as unknown as SceneDef)
  const [stateIdx, setStateIdx] = useState(0)
  const [sel, setSel] = useState<Sel>(null)
  const [tab, setTab] = useState<SceneTab>('object')
  const [, force] = useState(0)
  const trRef = useRef<Konva.Transformer>(null)
  const selRef = useRef<Konva.Rect>(null)

  useEffect(() => setSel(null), [path])
  useEffect(() => {
    // По умолчанию открываем базовое состояние (без условий), если оно есть, иначе 0
    const baseIdx = scene.states.findIndex((s) => !s.condition)
    setStateIdx(baseIdx >= 0 ? baseIdx : 0)
  }, [path, scene])

  const canvas = scene.canvas ?? { w: 1280, h: 720 }
  const VIEW_W = 840
  const k = VIEW_W / canvas.w
  const VIEW_H = canvas.h * k

  const st = scene.states[Math.min(stateIdx, scene.states.length - 1)]
  // Фон состояния: синтезированный рисунок (ArtDoc) рисуем тем же компонентом
  // ArtView, что и игрок, — иначе превью и забег расходятся (и data-URL-SVG
  // внутри <img> ведёт себя иначе, чем инлайновый SVG). ArtDoc кладём под
  // прозрачный Konva-холст, обычное изображение — внутри Konva.
  const hasImage = !!st?.image
  const hasArt = !hasImage && !!st?.art?.layers?.length
  const img = useImage(hasImage ? store.assetSrc(firstFrame(st!.image!)) : null)

  useEffect(() => {
    // после отката (или удаления) выбранный объект мог исчезнуть — не
    // оставляем трансформер на несуществующем узле
    const valid =
      sel &&
      (sel.kind === 'slot' ? !!scene.slots[sel.index] : !!scene.navigation[sel.index])
    if (trRef.current) {
      trRef.current.nodes(valid && selRef.current ? [selRef.current] : [])
      trRef.current.getLayer()?.batchDraw()
    }
  }, [sel, scene, stateIdx])

  const commit = () => {
    store.touch(path)
    force((n) => n + 1)
  }

  const updateRect = (
    kind: 'slot' | 'nav',
    i: number,
    r: { x: number; y: number; w: number; h: number },
  ) => {
    const round = (v: number) => Math.round(v)
    if (kind === 'slot') {
      const s = scene.slots[i]
      s.x = round(r.x)
      s.y = round(r.y)
      s.w = round(r.w)
      s.h = round(r.h)
    } else {
      scene.navigation[i].area = { x: round(r.x), y: round(r.y), w: round(r.w), h: round(r.h) }
    }
    commit()
  }

  const rectProps = (kind: 'slot' | 'nav', i: number, r: { x: number; y: number; w: number; h: number }) => ({
    x: r.x * k,
    y: r.y * k,
    width: r.w * k,
    height: r.h * k,
    draggable: true,
    onClick: () => {
      setSel({ kind, index: i })
      setTab('object')
    },
    onTap: () => {
      setSel({ kind, index: i })
      setTab('object')
    },
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
      updateRect(kind, i, { x: e.target.x() / k, y: e.target.y() / k, w: r.w, h: r.h })
    },
    onTransformEnd: (e: Konva.KonvaEventObject<Event>) => {
      const node = e.target as Konva.Rect
      const w = (node.width() * node.scaleX()) / k
      const h = (node.height() * node.scaleY()) / k
      node.scaleX(1)
      node.scaleY(1)
      updateRect(kind, i, { x: node.x() / k, y: node.y() / k, w, h })
    },
  })

  const selSlot = sel?.kind === 'slot' ? scene.slots[sel.index] : null
  const selNav = sel?.kind === 'nav' ? scene.navigation[sel.index] : null

  if (!loadedScene) {
    return (
      <div className="editor-empty-main">
        <h3 className="editor-empty-title">Сцена не найдена</h3>
        <p className="muted">Модуль «{path}» отсутствует в загруженной кампании или не указан корректно в manifest.json.</p>
      </div>
    )
  }

  return (
    <div className="scene-editor-container">
      <div className="scene-editor">
        <div className="scene-canvas-col">
        <div className="scene-toolbar">
          <label className="fld fld-inline">
            <span>Состояние</span>
            <select value={stateIdx} onChange={(e) => setStateIdx(Number(e.target.value))}>
              {scene.states.map((s, i) => (
                <option key={s.id} value={i}>
                  {s.label}{!s.condition ? ' (основное)' : ''}
                </option>
              ))}
            </select>
          </label>
          <button
            className="btn btn-small"
            onClick={() => {
              scene.slots.push({
                id: makeId('slot_', `${scene.id}_${scene.slots.length + 1}`, scene.slots.map((x) => x.id)),
                type: ['item'],
                shape: 'rect',
                x: Math.round(canvas.w / 2 - 60),
                y: Math.round(canvas.h / 2 - 60),
                w: 120,
                h: 120,
                condition: null,
              })
              setSel({ kind: 'slot', index: scene.slots.length - 1 })
              setTab('object')
              commit()
            }}
          >
            + слот
          </button>
          <button
            className="btn btn-small"
            onClick={() => {
              scene.navigation.push({
                area: { x: 40, y: Math.round(canvas.h / 2), w: 150, h: 200 },
                label: 'Переход',
                go_to_scene: '',
              })
              setSel({ kind: 'nav', index: scene.navigation.length - 1 })
              setTab('object')
              commit()
            }}
          >
            + переход
          </button>
          {sel && (
            <button
              className="btn btn-small ce-del"
              onClick={() => {
                if (sel.kind === 'slot') scene.slots.splice(sel.index, 1)
                else scene.navigation.splice(sel.index, 1)
                setSel(null)
                commit()
              }}
            >
              <Ico n="close" />  удалить выбранное
            </button>
          )}
          {onPlaytestScene && (
            <button
              className="btn btn-small btn-primary"
              style={{ marginLeft: 'auto' }}
              onClick={() => onPlaytestScene(scene.id)}
              data-tip="Запустить игру сразу в этой комнате для проверки слотов и переходов"
            >
              <Ico n="play" /> Тест сцены
            </button>
          )}
        </div>
        <div className="scene-stage-wrap" style={{ width: VIEW_W, height: VIEW_H }}>
          {hasArt && <ArtView className="scene-stage-art" art={st!.art} />}
          <Stage width={VIEW_W} height={VIEW_H} className={`scene-stage${hasArt ? ' scene-stage-with-art' : ''}`} onClick={(e) => {
            if (e.target === e.target.getStage() || e.target.className === 'Image') setSel(null)
          }}>
          <Layer>
            {img && <KImage image={img} width={VIEW_W} height={VIEW_H} />}
            {scene.navigation.map((n, i) => (
              <Group key={`nav${i}`}>
                <Rect
                  {...rectProps('nav', i, n.area)}
                  ref={sel?.kind === 'nav' && sel.index === i ? selRef : undefined}
                  stroke={sel?.kind === 'nav' && sel.index === i ? '#7fb3e0' : '#4a6d8c'}
                  strokeWidth={sel?.kind === 'nav' && sel.index === i ? 2.5 : 1.5}
                  fill="rgba(74,109,140,0.18)"
                />
                <Text
                  x={n.area.x * k + 4}
                  y={n.area.y * k + 4}
                  text={`⇨ ${n.label}`}
                  fontSize={12}
                  fill="#a8c8e0"
                  listening={false}
                />
              </Group>
            ))}
            {scene.slots.map((s, i) => (
              <Group key={`slot${i}`}>
                <SlotEntitySprite slot={s} store={store} k={k} />
                <Rect
                  {...rectProps('slot', i, s)}
                  ref={sel?.kind === 'slot' && sel.index === i ? selRef : undefined}
                  stroke={sel?.kind === 'slot' && sel.index === i ? '#e8c987' : s.environmental ? '#88b594' : '#c9a45c'}
                  strokeWidth={sel?.kind === 'slot' && sel.index === i ? 2.5 : 1.5}
                  fill={s.environmental ? 'rgba(136,181,148,0.12)' : 'rgba(201,164,92,0.15)'}
                  dash={s.environmental ? [4, 4] : s.condition ? [6, 4] : undefined}
                />
                <Text
                  x={s.x * k + 4}
                  y={s.y * k + 4}
                  text={`${s.default_entity ? store.labelFor('entity', s.default_entity) : 'пустой слот'}${s.environmental ? ' 👁' : ''}`}
                  fontSize={12}
                  fill={s.environmental ? '#a8d5b4' : '#e8c987'}
                  listening={false}
                />
              </Group>
            ))}
            {sel && (
              <Transformer
                ref={trRef}
                rotateEnabled={false}
                flipEnabled={false}
                anchorSize={7}
                borderStroke="#e8c987"
                anchorStroke="#e8c987"
                anchorFill="#2a2119"
              />
            )}
          </Layer>
          </Stage>
        </div>
        <div className="muted small">
          Клик — выбрать · перетаскивание — двигать · уголки — размер. Пунктир = слот с условием.
        </div>
      </div>

      <div className="scene-props">
        <div className="ce-tabs scene-inspector-tabs">
          <button
            type="button"
            className={`ce-tab ${tab === 'object' ? 'on' : ''}`}
            onClick={() => setTab('object')}
          >
            {selSlot
              ? `Слот: ${selSlot.label || (selSlot.default_entity ? store.labelFor('entity', selSlot.default_entity) : `#${sel!.index + 1}`)}`
              : selNav
              ? `Переход: ${selNav.label || `#${sel!.index + 1}`}`
              : `Объекты (${scene.slots.length + scene.navigation.length})`}
          </button>
          <button
            type="button"
            className={`ce-tab ${tab === 'scene' ? 'on' : ''}`}
            onClick={() => setTab('scene')}
          >
            Параметры сцены
          </button>
          <button
            type="button"
            className={`ce-tab ${tab === 'states' ? 'on' : ''}`}
            onClick={() => setTab('states')}
          >
            Фон и состояния ({scene.states.length})
          </button>
        </div>

        <div className="scene-tab-content">
          {tab === 'object' && (
            selSlot ? (
              <>
                <div className="scene-selected-bar">
                  <span className="scene-selected-badge scene-badge-slot">
                    Слот {sel!.index + 1} из {scene.slots.length}
                  </span>
                  <div className="scene-selected-actions">
                    <button
                      type="button"
                      className="btn btn-small"
                      onClick={() => setSel(null)}
                      data-tip="Снять выбор и показать список всех объектов сцены"
                    >
                      Все объекты
                    </button>
                    <button
                      type="button"
                      className="btn btn-small ce-del"
                      onClick={() => {
                        scene.slots.splice(sel!.index, 1)
                        setSel(null)
                        commit()
                      }}
                      data-tip="Удалить этот слот"
                    >
                      <Ico n="close" /> Удалить
                    </button>
                  </div>
                </div>
                <SlotProps slot={selSlot} store={store} commit={commit} />
              </>
            ) : selNav ? (
              <>
                <div className="scene-selected-bar">
                  <span className="scene-selected-badge scene-badge-nav">
                    Переход {sel!.index + 1} из {scene.navigation.length}
                  </span>
                  <div className="scene-selected-actions">
                    <button
                      type="button"
                      className="btn btn-small"
                      onClick={() => setSel(null)}
                      data-tip="Снять выбор и показать список всех объектов сцены"
                    >
                      Все объекты
                    </button>
                    <button
                      type="button"
                      className="btn btn-small ce-del"
                      onClick={() => {
                        scene.navigation.splice(sel!.index, 1)
                        setSel(null)
                        commit()
                      }}
                      data-tip="Удалить этот переход"
                    >
                      <Ico n="close" /> Удалить
                    </button>
                  </div>
                </div>
                <NavProps nav={selNav} scene={scene} store={store} commit={commit} />
              </>
            ) : (
              <SceneObjectsCatalog
                scene={scene}
                store={store}
                onSelectSlot={(idx) => {
                  setSel({ kind: 'slot', index: idx })
                  setTab('object')
                }}
                onSelectNav={(idx) => {
                  setSel({ kind: 'nav', index: idx })
                  setTab('object')
                }}
                onAddSlot={() => {
                  scene.slots.push({
                    id: makeId('slot_', `${scene.id}_${scene.slots.length + 1}`, scene.slots.map((x) => x.id)),
                    type: ['item'],
                    shape: 'rect',
                    x: Math.round(canvas.w / 2 - 60),
                    y: Math.round(canvas.h / 2 - 60),
                    w: 120,
                    h: 120,
                    condition: null,
                  })
                  setSel({ kind: 'slot', index: scene.slots.length - 1 })
                  setTab('object')
                  commit()
                }}
                onAddNav={() => {
                  scene.navigation.push({
                    area: { x: 40, y: Math.round(canvas.h / 2), w: 150, h: 200 },
                    label: 'Переход',
                    go_to_scene: '',
                  })
                  setSel({ kind: 'nav', index: scene.navigation.length - 1 })
                  setTab('object')
                  commit()
                }}
              />
            )
          )}

          {tab === 'scene' && (
            <SceneMeta scene={scene} store={store} commit={commit} />
          )}

          {tab === 'states' && (
            <StatesProps scene={scene} store={store} commit={commit} />
          )}
        </div>
      </div>
    </div>
    <FileAdvancedJson store={store} path={path} commit={() => store.touch(path)} label="Расширенный JSON сцены (все поля)" />
  </div>
  )
}

function SceneMeta({ scene, store, commit }: { scene: SceneDef; store: EditorStore; commit: () => void }) {
  return (
    <div className="props-group">
      <h4>Сцена</h4>
      <label className="fld">
        <span>Название</span>
        <input value={scene.label} onChange={(e) => ((scene.label = e.target.value), commit())} />
      </label>
      <ChapterSelect store={store} value={scene.chapter} onChange={(v) => ((scene.chapter = v), commit())} />
      <RefSelect
        label="Локация"
        kind="location"
        store={store}
        value={scene.location}
        onChange={(v) => ((scene.location = v ?? ''), commit())}
      />
      <label className="fld">
        <span>Освещение сцены</span>
        <select
          value={scene.lighting ?? 'outdoor'}
          onChange={(e) => {
            scene.lighting = e.target.value as 'outdoor' | 'indoor' | 'none'
            commit()
          }}
        >
          <option value="outdoor">Уличное (суточный шейдер: утро, день, закат, ночь)</option>
          <option value="indoor">Помещение (стабильный свет ламп)</option>
          <option value="none">Без фильтров освещения</option>
        </select>
      </label>
      <div className="scene-particles-group" style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
        <label className="fld">
          <span>Атмосферные частицы</span>
          <select
            value={typeof scene.particles === 'object' ? scene.particles.type : (scene.particles ?? 'none')}
            onChange={(e) => {
              const val = e.target.value
              if (val === 'none') {
                delete scene.particles
              } else if (typeof scene.particles === 'object') {
                scene.particles.type = val as any
              } else {
                scene.particles = val as any
              }
              commit()
            }}
          >
            <option value="none">Без частиц</option>
            <option value="dust">Пылинки</option>
            <option value="steam">Пар и дым</option>
            <option value="sparks">Искры</option>
            <option value="embers">Тлеющие угли</option>
            <option value="rain">Дождь</option>
            <option value="snow">Снег</option>
            <option value="fog">Туман</option>
            <option value="ash">Пепел</option>
          </select>
        </label>
        {scene.particles && scene.particles !== 'none' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginTop: 4 }}>
            <label className="fld" style={{ margin: 0 }}>
              <span className="small muted">Плотность</span>
              <select
                value={typeof scene.particles === 'object' ? (scene.particles.density ?? 'medium') : 'medium'}
                onChange={(e) => {
                  const density = e.target.value as any
                  if (typeof scene.particles !== 'object') {
                    scene.particles = { type: scene.particles as any, density }
                  } else {
                    scene.particles.density = density
                  }
                  commit()
                }}
              >
                <option value="low">Мало</option>
                <option value="medium">Средне</option>
                <option value="high">Много</option>
              </select>
            </label>
            <label className="fld" style={{ margin: 0 }}>
              <span className="small muted">Скорость</span>
              <select
                value={typeof scene.particles === 'object' ? (scene.particles.speed ?? 'normal') : 'normal'}
                onChange={(e) => {
                  const speed = e.target.value as any
                  if (typeof scene.particles !== 'object') {
                    scene.particles = { type: scene.particles as any, speed }
                  } else {
                    scene.particles.speed = speed
                  }
                  commit()
                }}
              >
                <option value="slow">Медленно</option>
                <option value="normal">Обычно</option>
                <option value="fast">Шторм</option>
              </select>
            </label>
            <label className="fld" style={{ margin: 0 }}>
              <span className="small muted">Ветер</span>
              <select
                value={typeof scene.particles === 'object' ? (scene.particles.wind ?? 'none') : 'none'}
                onChange={(e) => {
                  const wind = e.target.value as any
                  if (typeof scene.particles !== 'object') {
                    scene.particles = { type: scene.particles as any, wind }
                  } else {
                    scene.particles.wind = wind
                  }
                  commit()
                }}
              >
                <option value="none">Штиль</option>
                <option value="left">Влево ◀</option>
                <option value="right">Вправо ▶</option>
              </select>
            </label>
          </div>
        )}
      </div>
      <details className="spoiler-block" open={Boolean(scene.narrative_intro?.length)}>
        <summary>Вводное повествование (мысли при входе){(scene.narrative_intro?.length ?? 0) ? ` — ${scene.narrative_intro!.length}` : ''}</summary>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
          <label className="checkbox-row" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
            <input
              type="checkbox"
              checked={scene.narrative_intro_once !== false}
              onChange={(e) => {
                scene.narrative_intro_once = e.target.checked ? undefined : false
                commit()
              }}
            />
            <span>Показывать только один раз (при первом входе)</span>
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <label className="fld" style={{ margin: 0 }}>
              <span style={{ fontSize: '0.8rem' }}>Текст кнопки «Далее»</span>
              <input
                placeholder="По умолчанию: Далее ▶"
                value={scene.narrative_intro_next_label ?? ''}
                onChange={(e) => {
                  scene.narrative_intro_next_label = e.target.value.trim() || undefined
                  commit()
                }}
              />
            </label>
            <label className="fld" style={{ margin: 0 }}>
              <span style={{ fontSize: '0.8rem' }}>Текст «Осмотреться»</span>
              <input
                placeholder="По умолчанию: Осмотреться ▶"
                value={scene.narrative_intro_done_label ?? ''}
                onChange={(e) => {
                  scene.narrative_intro_done_label = e.target.value.trim() || undefined
                  commit()
                }}
              />
            </label>
          </div>
          <label className="fld" data-tip="Закадровый текст или мысли героя при входе (каждая строка — отдельный слайд)">
            <span style={{ fontSize: '0.8rem' }}>Текст повествования (по строкам)</span>
            <textarea
              rows={3}
              placeholder="Холодный ветер обжёг лицо...&#10;В глубине шахты послышался металлический скрежет..."
              value={(scene.narrative_intro ?? []).map((e) => (typeof e === 'string' ? e : e.text)).join('\n')}
              onChange={(e) => {
                const lines = e.target.value.split('\n').map((s) => s.trim()).filter(Boolean)
                if (lines.length) scene.narrative_intro = lines
                else delete scene.narrative_intro
                commit()
              }}
            />
          </label>
        </div>
      </details>
      <MusicRulesEditor
        store={store}
        value={scene.music ?? (scene.music = [])}
        onChange={commit}
        heading="Музыка сцены (перекрывает музыку локации)"
      />
      <details className="spoiler-block">
        <summary>Фоновые звуки сцены (слоями, зацикленно){(scene.ambient?.length ?? 0) ? ` — ${scene.ambient!.length}` : ''}</summary>
        <SoundMultiSelect
          store={store}
          value={scene.ambient ?? (scene.ambient = [])}
          onChange={(ids) => {
            scene.ambient = ids
            commit()
          }}
        />
      </details>
    </div>
  )
}

/**
 * Фон состояния: изображение ИЛИ векторный ArtDoc (итерация 8, блок D).
 * ArtDoc — генераторский формат: его рисует ИИ или вставляется JSON'ом,
 * а мастер в любой момент может заменить его настоящей картинкой.
 */
function StateBackground({
  state,
  store,
  commit,
}: {
  state: SceneStateDef
  store: EditorStore
  commit: () => void
}) {
  const [editJson, setEditJson] = useState(false)
  if (state.image) {
    return (
      <div className="fld fld-block">
        <AnimImageEditor
          label="Фон сцены (изображение)"
          value={state.image}
          dir="assets/img/scenes"
          store={store}
          onChange={(v) => {
            if (v) state.image = v
            else delete state.image
            commit()
          }}
        />
        {state.art && (
          <div className="muted small" style={{ marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
            <span>Есть скрытый векторный рисунок (изображение в приоритете).</span>
            <button
              className="btn btn-small ce-del"
              onClick={() => {
                delete state.art
                commit()
              }}
              data-tip="Удалить неиспользуемый векторный рисунок из файла сцены"
            >
              Удалить векторный рисунок
            </button>
          </div>
        )}
      </div>
    )
  }
  if (state.art) {
    return (
      <div className="fld fld-block">
        <span>Фон сцены — векторный рисунок</span>
        <ArtView className="art-preview" art={state.art} />
        <div className="art-preview-tools">
          <button
            className="btn btn-small"
            data-tip="Убрать векторный фон и загрузить обычное изображение"
            onClick={() => {
              delete state.art
              commit()
            }}
          >
            <Ico n="image" />  Заменить изображением
          </button>
          <button className="btn btn-small" onClick={() => setEditJson((v) => !v)}>
            {editJson ? 'Скрыть JSON' : 'Расширенный JSON'}
          </button>
        </div>
        {editJson && (
          <JsonField
            label="Слои векторного рисунка"
            rows={14}
            pretty
            value={state.art}
            onChange={(v) => {
              if (v) state.art = v as ArtDoc
              commit()
            }}
          />
        )}
      </div>
    )
  }
  return (
    <div className="fld fld-block">
      <AnimImageEditor
        label="Фон сцены"
        value={state.image}
        dir="assets/img/scenes"
        store={store}
        onChange={(v) => {
          if (v) state.image = v
          else delete state.image
          commit()
        }}
      />
      <div className="art-preview-tools">
        <button
          className="btn btn-small"
          data-tip="Нарисовать фон векторными примитивами — удобно для прототипирования"
          onClick={() => {
            state.art = { canvas: { w: 1280, h: 720 }, background: '#20242c', layers: [] }
            delete state.image
            commit()
          }}
        >
          <Ico n="palette" />  Сделать векторным рисунком
        </button>
      </div>
      <div className="muted small">
        Векторный фон описывается JSON'ом: прямоугольники, эллипсы, многоугольники, линии и подписи
        в координатах сцены (1280×720). Слоты потом ставятся точно по этим координатам.
      </div>
    </div>
  )
}

function StatesProps({ scene, store, commit }: { scene: SceneDef; store: EditorStore; commit: () => void }) {
  const card = (s: SceneStateDef, i: number) => (
    <div key={i} className="ce-item ce-body">
      <label className="fld">
        <span>Название</span>
        <input value={s.label} onChange={(e) => ((s.label = e.target.value), commit())} />
      </label>
      <StateBackground state={s} store={store} commit={commit} />
      <CameraEditor value={s.camera} onChange={(v) => ((s.camera = v), commit())} />
      <SceneConditionEditor value={s.condition} store={store} onChange={(v) => ((s.condition = v), commit())} />
      {scene.states.length > 1 && (
        <button className="btn btn-small ce-del" onClick={() => (scene.states.splice(i, 1), commit())}>
          <Ico n="close" />  удалить состояние
        </button>
      )}
    </div>
  )
  const [first, ...rest] = scene.states
  return (
    <div className="props-group">
      <h4>Состояния сцены</h4>
      {/* первое состояние всегда видно, остальные — под спойлером: их может быть много */}
      {first && card(first, 0)}
      {rest.length > 0 && (
        <details className="spoiler-block">
          <summary>Остальные состояния — {rest.length}</summary>
          {rest.map((s, k) => card(s, k + 1))}
        </details>
      )}
      <button
        className="btn btn-small"
        onClick={() => {
          scene.states.push({
            id: makeId('state_', `${scene.id}_${scene.states.length + 1}`, scene.states.map((x) => x.id)),
            label: 'Новое состояние',
            image: '',
            condition: null,
          })
          commit()
        }}
      >
        + состояние
      </button>
    </div>
  )
}

function SlotProps({ slot, store, commit }: { slot: SlotDef; store: EditorStore; commit: () => void }) {
  // кандидаты в слот: тип сущности должен входить в допустимые типы слота
  const candidates = store
    .entityPaths()
    .map((p) => store.entity(p))
    .filter((e): e is NonNullable<typeof e> => !!e)
    .filter((e) => slot.type.length === 0 || slot.type.includes(effectiveSlotType(e)))
    .map((e) => ({ id: e.id, label: e.label || e.id }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ru'))
  return (
    <div className="props-group">
      <h4>Слот{slot.label ? `: ${slot.label}` : slot.default_entity ? `: ${store.labelFor('entity', slot.default_entity)}` : ''}</h4>
      <label className="fld">
        <span>Название слота (видно мастеру: в расписаниях НПС)</span>
        <input
          value={slot.label ?? ''}
          placeholder="например «Пост у ворот»"
          onChange={(e) => {
            if (e.target.value) slot.label = e.target.value
            else delete slot.label
            commit()
          }}
        />
      </label>
      <div className="fld fld-block">
        <span>Что можно ставить в слот</span>
        <div className="chips">
          {slotTypesFor(store).map((t) => (
            <label key={t.id} className={`chip ${slot.type.includes(t.id) ? 'chip-on' : ''}`}>
              <input
                type="checkbox"
                checked={slot.type.includes(t.id)}
                onChange={(e) => {
                  slot.type = e.target.checked ? [...slot.type, t.id] : slot.type.filter((x) => x !== t.id)
                  commit()
                }}
              />
              {t.label}
            </label>
          ))}
        </div>
      </div>
      <label className="fld">
        <span>Кто/что стоит в слоте</span>
        <select
          value={slot.default_entity ?? ''}
          onChange={(e) => {
            if (e.target.value) slot.default_entity = e.target.value
            else delete slot.default_entity
            commit()
          }}
        >
          <option value="">— пусто —</option>
          {slot.default_entity && !candidates.some((c) => c.id === slot.default_entity) && (
            <option value={slot.default_entity}>
              {store.labelFor('entity', slot.default_entity)} (не подходит по типу)
            </option>
          )}
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
      </label>
      <div className="muted small" style={{ marginBottom: 8 }}>
        Список отфильтрован по типам слота. Тип сущности задаётся в её карточке
        («Тип в слотах сцены»).
      </div>
      <label className="fld-check" data-tip="Объект уже нарисован на фоне сцены. В покое рамка скрыта; подсвечивается только при наведении или по Tab.">
        <input
          type="checkbox"
          checked={!!slot.environmental}
          onChange={(e) => {
            if (e.target.checked) slot.environmental = true
            else delete slot.environmental
            commit()
          }}
        />
        <span>Хотспот окружения (нарисован на фоне сцены, скрыт в покое)</span>
      </label>
      <label className="fld" data-tip="Множитель размера спрайта сцены в этом слоте: один и тот же персонаж в толпе — меньше, на авансцене — больше. Пусто = 1.">
        <span>Масштаб спрайта (1 — по высоте слота)</span>
        <input
          type="number"
          min={0.1}
          step={0.1}
          value={slot.sprite_scale ?? ''}
          placeholder="1"
          onChange={(e) => {
            const v = Number(e.target.value)
            if (v > 0) slot.sprite_scale = v
            else delete slot.sprite_scale
            commit()
          }}
        />
      </label>
      <label className="fld" data-tip="Какой вариант спрайта показывать у персонажа в этом слоте — из «Спрайта в сцене» в карточке персонажа. «Обычный» — основной спрайт.">
        <span>Состояние спрайта</span>
        <select
          value={slot.sprite_state ?? ''}
          onChange={(e) => {
            if (e.target.value) slot.sprite_state = e.target.value
            else delete slot.sprite_state
            commit()
          }}
        >
          <option value="">Обычный</option>
          {(store.meta.emotions ?? []).map((e) => (
            <option key={e.id} value={e.id}>{e.label}</option>
          ))}
        </select>
      </label>
      <div className="fld-block" style={{ marginTop: 8 }}>
        <span className="fld-caption">Использование предметов на слоте («ключ к двери»)</span>
        {(slot.use_with ?? []).map((u, i) => (
          <div key={i} className="ce-item" style={{ marginBottom: 8 }}>
            <div className="fld-row">
              <RefSelect
                label="Предмет из инвентаря"
                kind="item"
                store={store}
                value={u.item}
                onChange={(v) => ((slot.use_with![i].item = v ?? ''), commit())}
              />
              <label className="fld fld-check">
                <input
                  type="checkbox"
                  checked={!!u.consume}
                  onChange={(e) => ((slot.use_with![i].consume = e.target.checked || undefined), commit())}
                />
                <span>Израсходовать</span>
              </label>
              <button
                className="btn btn-small ce-del"
                onClick={() => {
                  slot.use_with = slot.use_with!.filter((_, j) => j !== i)
                  if (!slot.use_with.length) delete slot.use_with
                  commit()
                }}
              >
                <Ico n="close" />
              </button>
            </div>
            <label className="fld">
              <span>Сообщение при применении (необязательно)</span>
              <input value={u.message ?? ''} onChange={(e) => ((slot.use_with![i].message = e.target.value || undefined), commit())} />
            </label>
            <EffectListEditor
              store={store}
              effects={u.effects}
              onChange={(ef) => ((slot.use_with![i].effects = ef), commit())}
            />
          </div>
        ))}
        <button className="btn btn-small" onClick={() => (((slot.use_with ??= []).push({ item: '', effects: [] })), commit())}>
          <Ico n="plus" />  Использование предмета
        </button>
      </div>
      <SceneConditionEditor value={slot.condition} store={store} onChange={(v) => ((slot.condition = v), commit())} />
      <RectCoordsEditor rect={slot} onChange={commit} label="Положение и размер слота" />
    </div>
  )
}

function RectCoordsEditor({
  rect,
  onChange,
  label = 'Положение и размер на сцене',
}: {
  rect: { x: number; y: number; w: number; h: number }
  onChange: () => void
  label?: string
}) {
  return (
    <div className="fld fld-block" style={{ marginTop: 8 }}>
      <span style={{ fontWeight: 600, fontSize: 12 }}>{label}</span>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px', marginTop: 4 }}>
        <label className="fld fld-inline" style={{ margin: 0 }}>
          <span style={{ minWidth: 20 }}>X</span>
          <input
            type="number"
            value={Math.round(rect.x)}
            onChange={(e) => {
              const v = Number(e.target.value)
              if (Number.isFinite(v)) {
                rect.x = Math.round(v)
                onChange()
              }
            }}
          />
        </label>
        <label className="fld fld-inline" style={{ margin: 0 }}>
          <span style={{ minWidth: 20 }}>Y</span>
          <input
            type="number"
            value={Math.round(rect.y)}
            onChange={(e) => {
              const v = Number(e.target.value)
              if (Number.isFinite(v)) {
                rect.y = Math.round(v)
                onChange()
              }
            }}
          />
        </label>
        <label className="fld fld-inline" style={{ margin: 0 }}>
          <span style={{ minWidth: 20 }}>Ширина</span>
          <input
            type="number"
            min={1}
            value={Math.round(rect.w)}
            onChange={(e) => {
              const v = Number(e.target.value)
              if (Number.isFinite(v) && v > 0) {
                rect.w = Math.round(v)
                onChange()
              }
            }}
          />
        </label>
        <label className="fld fld-inline" style={{ margin: 0 }}>
          <span style={{ minWidth: 20 }}>Высота</span>
          <input
            type="number"
            min={1}
            value={Math.round(rect.h)}
            onChange={(e) => {
              const v = Number(e.target.value)
              if (Number.isFinite(v) && v > 0) {
                rect.h = Math.round(v)
                onChange()
              }
            }}
          />
        </label>
      </div>
      <div className="muted small" style={{ marginTop: 4 }}>
        Положение: x {Math.round(rect.x)} · y {Math.round(rect.y)} · размер {Math.round(rect.w)}×{Math.round(rect.h)}
      </div>
    </div>
  )
}

/**
 * Итерация 8, А6: из зон навигации убран переход «в локацию» — между
 * локациями ходим только через карту. «В сцену» — только сцены этой локации.
 */
function NavProps({
  nav,
  scene,
  store,
  commit,
}: {
  nav: NavigationZone
  scene: SceneDef
  store: EditorStore
  commit: () => void
}) {
  // старый формат (go_to_location) мигрируется хранилищем при загрузке
  const legacy = (nav as NavigationZone & { go_to_location?: string }).go_to_location
  if (legacy) {
    delete (nav as NavigationZone & { go_to_location?: string }).go_to_location
    nav.open_map = true
  }
  const mode = nav.open_map ? 'map' : 'scene'
  const sameLocation: Array<{ id: string; label: string }> = []
  for (const p of store.scenePaths()) {
    const sc = store.scene(p)
    if (!sc || sc.id === scene.id) continue
    if (sc.location !== scene.location) continue
    sameLocation.push({ id: sc.id, label: sc.label || sc.id })
  }
  sameLocation.sort((a, b) => a.label.localeCompare(b.label, 'ru'))
  const foreign = !!nav.go_to_scene && !sameLocation.some((o) => o.id === nav.go_to_scene)
  return (
    <div className="props-group">
      <h4>Переход: {nav.label}</h4>
      <label className="fld">
        <span>Подпись</span>
        <input value={nav.label} onChange={(e) => ((nav.label = e.target.value), commit())} />
      </label>
      <label className="fld feature-toggle">
        <input
          type="checkbox"
          checked={!!nav.hide_label}
          onChange={(e) => {
            if (e.target.checked) nav.hide_label = true
            else delete nav.hide_label
            commit()
          }}
        />
        <span>
          <b>Не показывать подпись</b>
          <small>как «живая картинка»: обозначение перехода появляется только под курсором игрока</small>
        </span>
      </label>
      <label className="fld">
        <span>Тип перехода</span>
        <select
          value={mode}
          onChange={(e) => {
            delete nav.go_to_scene
            delete nav.open_map
            if (e.target.value === 'map') nav.open_map = true
            else nav.go_to_scene = sameLocation[0]?.id ?? ''
            commit()
          }}
        >
          <option value="scene">В сцену этой локации</option>
          <option value="map">Открыть карту (выход из локации)</option>
        </select>
      </label>
      {mode === 'scene' && (
        <label className="fld">
          <span>Сцена</span>
          <select
            value={nav.go_to_scene ?? ''}
            onChange={(e) => ((nav.go_to_scene = e.target.value), commit())}
          >
            {!nav.go_to_scene && <option value="">— выбрать сцену —</option>}
            {foreign && nav.go_to_scene && (
              <option value={nav.go_to_scene}>
                {store.labelFor('scene', nav.go_to_scene)} (чужая локация!)
              </option>
            )}
            {sameLocation.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {mode === 'scene' && foreign && (
        <div className="warn-note">
          <Ico n="warn" />  Переход ведёт в сцену другой локации. Так больше нельзя: между локациями —
          только через карту. Выберите сцену этой локации или тип «Открыть карту».
        </div>
      )}
      {mode === 'scene' && sameLocation.length === 0 && (
        <div className="muted small">
          У локации пока одна сцена. Создайте вторую (раздел «Сцены») или используйте «Открыть карту».
        </div>
      )}
      <label className="fld">
        <span>Стоимость (тиков)</span>
        <input
          type="number"
          value={nav.cost_ticks ?? ''}
          onChange={(e) => {
            if (e.target.value === '') delete nav.cost_ticks
            else nav.cost_ticks = Number(e.target.value)
            commit()
          }}
        />
      </label>
      <div className="props-group" style={{ marginTop: 8 }}>
        <h5>Перехват и реакции (событийные триггеры)</h5>
        <label className="fld" data-tip="Запустить диалог с персонажем при попытке пройти (например, караульный окликает героя перед выходом)">
          <span>Оклик перед уходом (персонаж / диалог)</span>
          <select
            value={nav.intercept_dialogue ?? ''}
            onChange={(e) => {
              if (!e.target.value) delete nav.intercept_dialogue
              else nav.intercept_dialogue = e.target.value
              commit()
            }}
          >
            <option value="">— без оклика —</option>
            {store.options('npc').map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </label>
        <label className="fld" data-tip="Запустить правило кампании при попытке совершить переход (напр. засада или проверка бдительности)">
          <span>Правило-перехватчик</span>
          <select
            value={nav.intercept_rule ?? ''}
            onChange={(e) => {
              if (!e.target.value) delete nav.intercept_rule
              else nav.intercept_rule = e.target.value
              commit()
            }}
          >
            <option value="">— без правила —</option>
            {store.options('rule').map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </label>
        <label className="fld" data-tip="Сообщение игроку, если переход заблокирован условиями ниже (напр. «Дверь заперта на засов»)">
          <span>Сообщение при блокировке перехода</span>
          <input
            value={nav.blocked_message ?? ''}
            placeholder="например «Дверь заперта на засов изнутри»"
            onChange={(e) => {
              if (!e.target.value.trim()) delete nav.blocked_message
              else nav.blocked_message = e.target.value
              commit()
            }}
          />
        </label>
        <div style={{ marginTop: 8 }}>
          <span className="small muted" style={{ display: 'block', marginBottom: 4 }}>
            Условия доступности перехода (если не выполнены — проход заблокирован):
          </span>
          <ConditionListEditor
            store={store}
            conditions={nav.conditions ?? (nav.conditions = [])}
            onChange={(c) => {
              if (c.length === 0) delete nav.conditions
              else nav.conditions = c
              commit()
            }}
          />
        </div>
      </div>
      <RectCoordsEditor rect={nav.area} onChange={commit} label="Положение и размер зоны перехода" />
    </div>
  )
}

function SceneObjectsCatalog({
  scene,
  store,
  onSelectSlot,
  onSelectNav,
  onAddSlot,
  onAddNav,
}: {
  scene: SceneDef
  store: EditorStore
  onSelectSlot: (idx: number) => void
  onSelectNav: (idx: number) => void
  onAddSlot: () => void
  onAddNav: () => void
}) {
  return (
    <div className="props-group scene-objects-catalog">
      <div className="scene-catalog-head">
        <h4>Интерактивные объекты</h4>
        <div className="muted small">
          Выберите объект на холсте или в списке ниже, чтобы настроить его параметры.
        </div>
      </div>

      <div className="scene-catalog-section">
        <div className="scene-catalog-section-bar">
          <span className="scene-catalog-title">
            Слоты сцены <span className="scene-catalog-count">({scene.slots.length})</span>
          </span>
          <button type="button" className="btn btn-small" onClick={onAddSlot}>
            <Ico n="plus" /> слот
          </button>
        </div>

        {scene.slots.length === 0 ? (
          <div className="scene-catalog-empty">
            Слоты пока не созданы. Нажмите «+ слот», чтобы разместить предмет или персонажа.
          </div>
        ) : (
          <div className="scene-catalog-items">
            {scene.slots.map((s, idx) => {
              const entityName = s.default_entity ? store.labelFor('entity', s.default_entity) : 'Пустой слот'
              const label = s.label || entityName
              return (
                <div
                  key={s.id || idx}
                  className="scene-catalog-item"
                  onClick={() => onSelectSlot(idx)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="scene-catalog-item-info">
                    <span className="scene-catalog-item-idx">#{idx + 1}</span>
                    <span className="scene-catalog-item-name">{label}</span>
                  </div>
                  <div className="scene-catalog-item-meta muted small">
                    {Math.round(s.w)}×{Math.round(s.h)} px
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="scene-catalog-section" style={{ marginTop: 14 }}>
        <div className="scene-catalog-section-bar">
          <span className="scene-catalog-title">
            Переходы <span className="scene-catalog-count">({scene.navigation.length})</span>
          </span>
          <button type="button" className="btn btn-small" onClick={onAddNav}>
            <Ico n="plus" /> переход
          </button>
        </div>

        {scene.navigation.length === 0 ? (
          <div className="scene-catalog-empty">
            Переходы не созданы. Нажмите «+ переход», чтобы добавить переход в другую сцену или на карту.
          </div>
        ) : (
          <div className="scene-catalog-items">
            {scene.navigation.map((n, idx) => {
              const target = n.open_map ? 'Открыть карту' : n.go_to_scene ? store.labelFor('scene', n.go_to_scene) : 'Не выбрана'
              return (
                <div
                  key={idx}
                  className="scene-catalog-item scene-catalog-item-nav"
                  onClick={() => onSelectNav(idx)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="scene-catalog-item-info">
                    <span className="scene-catalog-item-idx">⇨ {idx + 1}</span>
                    <span className="scene-catalog-item-name">{n.label || 'Без подписи'}</span>
                  </div>
                  <div className="scene-catalog-item-meta muted small">
                    {target}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
