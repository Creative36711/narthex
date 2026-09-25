import { Ico } from '../shared/icons'
import { useEffect, useRef, useState } from 'react'
import { Stage, Layer, Image as KImage, Rect, Text, Transformer, Group } from 'react-konva'
import type Konva from 'konva'
import type { ArtDoc, NavigationZone, SceneCondition, SceneDef, SceneStateDef, SlotDef, TimeOfDay } from '../shared/types'
import { ArtView, artToDataUrl } from '../shared/ArtView'
import type { EditorStore } from './store'
import { ImageUpload, JsonField, RefSelect, FlagSelect } from './Fields'
import { slotTypesFor, effectiveSlotType } from './slotTypes'
import { makeId } from './ids'
import { MusicRulesEditor } from './AudioSection'

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
  // фон: ArtDoc рисуем как SVG-подложку под прозрачным Konva-холстом,
  // обычное изображение — внутри Konva (итерация 8, блок D)
  const artUrl = st?.art ? artToDataUrl(st.art) : ''
  const img = useImage(!st?.art && st?.image ? store.assetSrc(st.image) : null)

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
              <Ico n="close" />  удалить выбранное
            </button>
          )}
        </div>
        <div className="scene-stage-wrap" style={{ width: VIEW_W, height: VIEW_H }}>
          {artUrl && <img className="scene-stage-art" src={artUrl} alt="" draggable={false} />}
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
        </div>
        <div className="muted small">
          Клик — выбрать · перетаскивание — двигать · уголки — размер. Пунктир = слот с условием.
        </div>
      </div>

      <div className="scene-props">
        <SceneMeta scene={scene} store={store} commit={commit} />
        {selSlot && <SlotProps slot={selSlot} store={store} commit={commit} />}
        {selNav && <NavProps nav={selNav} scene={scene} store={store} commit={commit} />}
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
      <MusicRulesEditor
        store={store}
        value={scene.music ?? (scene.music = [])}
        onChange={commit}
        title="Музыка сцены (перекрывает музыку локации)"
      />
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
  if (state.art) {
    return (
      <div className="fld fld-block">
        <span>Фон сцены — векторная картинка (ArtDoc)</span>
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
            label="ArtDoc (слои примитивов)"
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
      <ImageUpload
        label="Фон сцены"
        value={state.image ?? ''}
        dir="assets/img/scenes"
        store={store}
        onChange={(p) => ((state.image = p), commit())}
      />
      <div className="art-preview-tools">
        <button
          className="btn btn-small"
          data-tip="Нарисовать фон примитивами (формат ArtDoc) — удобно для генерации"
          onClick={() => {
            state.art = { canvas: { w: 1280, h: 720 }, background: '#20242c', layers: [] }
            delete state.image
            commit()
          }}
        >
          <Ico n="palette" />  Сделать векторным (ArtDoc)
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
  return (
    <div className="props-group">
      <h4>Состояния сцены</h4>
      {scene.states.map((s, i) => (
        <div key={i} className="ce-item ce-body">
          <label className="fld">
            <span>Название</span>
            <input value={s.label} onChange={(e) => ((s.label = e.target.value), commit())} />
          </label>
          <StateBackground state={s} store={store} commit={commit} />
          <SceneConditionEditor value={s.condition} store={store} onChange={(v) => ((s.condition = v), commit())} />
          {scene.states.length > 1 && (
            <button className="btn btn-small ce-del" onClick={() => (scene.states.splice(i, 1), commit())}>
              <Ico n="close" />  удалить состояние
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
      <SceneConditionEditor value={slot.condition} store={store} onChange={(v) => ((slot.condition = v), commit())} />
      <div className="muted small">
        Положение: x {slot.x} · y {slot.y} · размер {slot.w}×{slot.h}
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
    </div>
  )
}
