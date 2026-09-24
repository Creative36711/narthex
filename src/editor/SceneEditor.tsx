import { useEffect, useRef, useState } from 'react'
import { Stage, Layer, Image as KImage, Rect, Text, Transformer, Group } from 'react-konva'
import type Konva from 'konva'
import type { NavigationZone, SceneCondition, SceneDef, SlotDef, TimeOfDay } from '../shared/types'
import type { EditorStore } from './store'
import { ImageUpload, RefSelect, FlagSelect } from './Fields'
import { makeId } from './ids'

/**
 * Визуальный редактор сцены (ТЗ 5.2.2) на Konva:
 * фон = изображение активного состояния, слоты и навигационные зоны —
 * перетаскиваемые/масштабируемые прямоугольники.
 */

export const BUILTIN_SLOT_TYPES: Array<{ id: string; label: string }> = [
  { id: 'person', label: 'Персонаж' },
  { id: 'item', label: 'Предмет' },
  { id: 'container', label: 'Контейнер' },
  { id: 'furniture', label: 'Мебель' },
  { id: 'animal', label: 'Животное' },
]

/** реестр типов слотов кампании (+ свои типы мастера — «Кампания → Типы слотов») */
function slotTypesFor(store: EditorStore): Array<{ id: string; label: string }> {
  const custom = store.meta.slot_types ?? []
  const out = [...BUILTIN_SLOT_TYPES.filter((b) => !custom.some((c) => c.id === b.id)), ...custom]
  return out
}

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

type Sel = { kind: 'slot'; index: number } | { kind: 'nav'; index: number } | null

export function SceneEditor({ store, path }: { store: EditorStore; path: string }) {
  const scene = store.scene(path)
  const [stateIdx, setStateIdx] = useState(0)
  const [sel, setSel] = useState<Sel>(null)
  const [, force] = useState(0)
  const trRef = useRef<Konva.Transformer>(null)
  const selRef = useRef<Konva.Rect>(null)

  useEffect(() => setSel(null), [path])
  useEffect(() => setStateIdx(0), [path])

  const canvas = scene.canvas ?? { w: 1280, h: 720 }
  const VIEW_W = 840
  const k = VIEW_W / canvas.w
  const VIEW_H = canvas.h * k

  const st = scene.states[Math.min(stateIdx, scene.states.length - 1)]
  const img = useImage(st ? `${store.basePath}/${st.image}` : null)

  useEffect(() => {
    if (trRef.current && selRef.current) {
      trRef.current.nodes([selRef.current])
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
    onClick: () => setSel({ kind, index: i }),
    onTap: () => setSel({ kind, index: i }),
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

  return (
    <div className="scene-editor">
      <div className="scene-canvas-col">
        <div className="scene-toolbar">
          <label className="fld fld-inline">
            <span>Состояние</span>
            <select value={stateIdx} onChange={(e) => setStateIdx(Number(e.target.value))}>
              {scene.states.map((s, i) => (
                <option key={s.id} value={i}>
                  {s.label}
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
              ✕ удалить выбранное
            </button>
          )}
        </div>
        <Stage width={VIEW_W} height={VIEW_H} className="scene-stage" onClick={(e) => {
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
                <Rect
                  {...rectProps('slot', i, s)}
                  ref={sel?.kind === 'slot' && sel.index === i ? selRef : undefined}
                  stroke={sel?.kind === 'slot' && sel.index === i ? '#e8c987' : '#c9a45c'}
                  strokeWidth={sel?.kind === 'slot' && sel.index === i ? 2.5 : 1.5}
                  fill="rgba(201,164,92,0.15)"
                  dash={s.condition ? [6, 4] : undefined}
                />
                <Text
                  x={s.x * k + 4}
                  y={s.y * k + 4}
                  text={s.default_entity ? store.labelFor('entity', s.default_entity) : 'пустой слот'}
                  fontSize={12}
                  fill="#e8c987"
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
        <div className="muted small">
          Клик — выбрать · перетаскивание — двигать · уголки — размер. Пунктир = слот с условием.
        </div>
      </div>

      <div className="scene-props">
        <SceneMeta scene={scene} store={store} commit={commit} />
        {selSlot && <SlotProps slot={selSlot} store={store} commit={commit} />}
        {selNav && <NavProps nav={selNav} store={store} commit={commit} />}
        {!sel && <StatesProps scene={scene} store={store} commit={commit} />}
      </div>
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
      <RefSelect
        label="Локация"
        kind="location"
        store={store}
        value={scene.location}
        onChange={(v) => ((scene.location = v ?? ''), commit())}
      />
    </div>
  )
}

function StatesProps({ scene, store, commit }: { scene: SceneDef; store: EditorStore; commit: () => void }) {
  return (
    <div className="props-group">
      <h4>Состояния сцены</h4>
      {scene.states.map((s, i) => (
        <div key={i} className="ce-item ce-body">
          <label className="fld">
            <span>Название</span>
            <input value={s.label} onChange={(e) => ((s.label = e.target.value), commit())} />
          </label>
          <ImageUpload
            label="Фон сцены"
            value={s.image}
            dir="assets/img/scenes"
            store={store}
            onChange={(p) => ((s.image = p), commit())}
          />
          <SceneConditionEditor value={s.condition} store={store} onChange={(v) => ((s.condition = v), commit())} />
          {scene.states.length > 1 && (
            <button className="btn btn-small ce-del" onClick={() => (scene.states.splice(i, 1), commit())}>
              ✕ удалить состояние
            </button>
          )}
        </div>
      ))}
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
  return (
    <div className="props-group">
      <h4>Слот{slot.default_entity ? `: ${store.labelFor('entity', slot.default_entity)}` : ''}</h4>
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
      <RefSelect
        label="Кто/что стоит в слоте"
        kind="entity"
        store={store}
        value={slot.default_entity ?? ''}
        optional
        onChange={(v) => {
          if (v) slot.default_entity = v
          else delete slot.default_entity
          commit()
        }}
      />
      <SceneConditionEditor value={slot.condition} store={store} onChange={(v) => ((slot.condition = v), commit())} />
      <div className="muted small">
        Положение: x {slot.x} · y {slot.y} · размер {slot.w}×{slot.h}
      </div>
    </div>
  )
}

function NavProps({ nav, store, commit }: { nav: NavigationZone; store: EditorStore; commit: () => void }) {
  const mode = nav.open_map ? 'map' : nav.go_to_location !== undefined ? 'location' : 'scene'
  return (
    <div className="props-group">
      <h4>Переход: {nav.label}</h4>
      <label className="fld">
        <span>Подпись</span>
        <input value={nav.label} onChange={(e) => ((nav.label = e.target.value), commit())} />
      </label>
      <label className="fld">
        <span>Тип перехода</span>
        <select
          value={mode}
          onChange={(e) => {
            delete nav.go_to_scene
            delete nav.go_to_location
            delete nav.open_map
            if (e.target.value === 'map') nav.open_map = true
            else if (e.target.value === 'location') nav.go_to_location = ''
            else nav.go_to_scene = ''
            commit()
          }}
        >
          <option value="scene">В сцену</option>
          <option value="location">В локацию</option>
          <option value="map">Открыть карту</option>
        </select>
      </label>
      {mode === 'scene' && (
        <RefSelect
          label="Сцена"
          kind="scene"
          store={store}
          value={nav.go_to_scene ?? ''}
          onChange={(v) => ((nav.go_to_scene = v ?? ''), commit())}
        />
      )}
      {mode === 'location' && (
        <RefSelect
          label="Локация"
          kind="location"
          store={store}
          value={nav.go_to_location ?? ''}
          onChange={(v) => ((nav.go_to_location = v ?? ''), commit())}
        />
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
    </div>
  )
}
