import { useRef, useState } from 'react'
import type { LocationDef, RegionDef } from '../shared/types'
import type { EditorStore } from './store'
import { ImageUpload, RefSelect } from './Fields'
import { makeId } from './ids'
import { askText, askConfirm } from './prompt'

/**
 * Редактор мира (фидбек №13): дерево регионов (с вложенностью),
 * карта с загрузкой изображения и перетаскиваемыми маркерами локаций.
 */

/** плоский список регионов с уровнем вложенности */
function flatRegions(regions: RegionDef[], depth = 0): Array<{ region: RegionDef; depth: number }> {
  const out: Array<{ region: RegionDef; depth: number }> = []
  for (const r of regions) {
    out.push({ region: r, depth })
    if (r.sub_regions) out.push(...flatRegions(r.sub_regions, depth + 1))
  }
  return out
}

export function WorldEditor({ store }: { store: EditorStore }) {
  const [, force] = useState(0)
  const commit = () => {
    store.touch('world.json')
    force((n) => n + 1)
  }
  const all = flatRegions(store.world.regions)
  const [selId, setSelId] = useState<string>(all[0]?.region.id ?? '')
  const active = all.find((r) => r.region.id === selId)?.region ?? all[0]?.region

  const addRegion = async (parent?: RegionDef) => {
    const label = await askText(parent ? `Вложенный регион внутри «${parent.label}»` : 'Название нового региона')
    if (!label) return
    const ids = flatRegions(store.world.regions).map((x) => x.region.id)
    const region: RegionDef = {
      id: makeId('region_', label, ids),
      label,
      map_image: '',
      map_size: { w: 1280, h: 720 },
      parent_region: parent?.id ?? null,
      locations: [],
    }
    if (parent) {
      if (!parent.sub_regions) parent.sub_regions = []
      parent.sub_regions.push(region)
    } else {
      store.world.regions.push(region)
    }
    setSelId(region.id)
    commit()
  }

  const removeRegion = async (target: RegionDef) => {
    if (!(await askConfirm(`Удалить регион «${target.label}» со всеми его локациями?`, 'Удалить'))) return
    const walk = (list: RegionDef[]): boolean => {
      const i = list.indexOf(target)
      if (i >= 0) {
        list.splice(i, 1)
        return true
      }
      return list.some((r) => r.sub_regions && walk(r.sub_regions))
    }
    walk(store.world.regions)
    commit()
  }

  return (
    <div className="world-editor">
      <aside className="world-tree">
        <div className="fld-caption">Регионы мира</div>
        {all.map(({ region, depth }) => (
          <button
            key={region.id}
            className={`editor-list-item ${active === region ? 'on' : ''}`}
            style={{ paddingLeft: 12 + depth * 18 }}
            onClick={() => setSelId(region.id)}
          >
            {depth > 0 ? '↳ ' : '🗺 '}{region.label}
          </button>
        ))}
        <div className="editor-list-tools">
          <button className="btn btn-small" onClick={() => addRegion()}>+ регион</button>
          {active && (
            <button className="btn btn-small" onClick={() => addRegion(active)} title="Вложенный регион — например страна внутри карты мира">
              + вложенный
            </button>
          )}
        </div>
        <div className="muted small" style={{ marginTop: 8 }}>
          Вложенность необязательна: мир → страна → город. Локации живут внутри региона.
        </div>
      </aside>

      <div className="world-main">
        {active ? (
          <RegionPanel key={active.id} region={active} store={store} commit={commit} onRemove={() => removeRegion(active)} />
        ) : (
          <div className="screen-center muted">Создайте первый регион.</div>
        )}
      </div>
    </div>
  )
}

function RegionPanel({
  region: r,
  store,
  commit,
  onRemove,
}: {
  region: RegionDef
  store: EditorStore
  commit: () => void
  onRemove: () => void
}) {
  const [placing, setPlacing] = useState(false)
  const [selLoc, setSelLoc] = useState<string | null>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  const dragging = useRef<LocationDef | null>(null)
  const size = r.map_size ?? { w: 1280, h: 720 }

  /** координаты события в системе карты */
  const mapCoords = (e: React.PointerEvent): { x: number; y: number } | null => {
    const el = mapRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * size.w
    const y = ((e.clientY - rect.top) / rect.height) * size.h
    return { x: Math.round(Math.max(0, Math.min(size.w, x))), y: Math.round(Math.max(0, Math.min(size.h, y))) }
  }

  const addLocation = async (x: number, y: number) => {
    const label = await askText('Название локации', 'например «Старая мельница»')
    if (!label) return
    const loc: LocationDef = {
      id: makeId('loc_', label, store.options('location').map((o) => o.id)),
      label,
      position: { x, y },
      travel_connections: [],
      scenes: [],
    }
    r.locations.push(loc)
    setSelLoc(loc.id)
    commit()
  }

  const sel = r.locations.find((l) => l.id === selLoc) ?? null

  return (
    <div className="region-panel">
      <div className="props-group">
        <div className="fld-row">
          <label className="fld">
            <span>Название региона</span>
            <input value={r.label} onChange={(e) => ((r.label = e.target.value), commit())} />
          </label>
          <button className="btn btn-small ce-del" style={{ alignSelf: 'flex-end', marginBottom: 8 }} onClick={onRemove}>
            ✕ удалить регион
          </button>
        </div>
        <ImageUpload
          label="Карта региона (изображение)"
          value={r.map_image}
          dir="assets/img/maps"
          store={store}
          onChange={(p) => {
            r.map_image = p
            if (p) {
              // подгоняем систему координат под реальный размер изображения
              const img = new Image()
              img.onload = () => {
                r.map_size = { w: img.naturalWidth, h: img.naturalHeight }
                commit()
              }
              img.src = `${store.basePath}/${p}`
            }
            commit()
          }}
        />
      </div>

      <div className="props-group">
        <div className="world-map-toolbar">
          <b>Локации на карте</b>
          <button
            className={`btn btn-small ${placing ? 'btn-primary' : ''}`}
            onClick={() => setPlacing((v) => !v)}
          >
            {placing ? 'Кликните по карте…' : '+ локация'}
          </button>
          <span className="muted small">Маркеры можно перетаскивать мышью.</span>
        </div>
        <div
          ref={mapRef}
          className={`world-map ${placing ? 'placing' : ''}`}
          style={{ aspectRatio: `${size.w} / ${size.h}` }}
          onPointerDown={(e) => {
            if (!placing) return
            const c = mapCoords(e)
            if (c) addLocation(c.x, c.y)
            setPlacing(false)
          }}
          onPointerMove={(e) => {
            if (!dragging.current) return
            const c = mapCoords(e)
            if (c) {
              dragging.current.position = c
              commit()
            }
          }}
          onPointerUp={() => (dragging.current = null)}
          onPointerLeave={() => (dragging.current = null)}
        >
          {r.map_image ? (
            <img src={`${store.basePath}/${r.map_image}`} alt="" draggable={false} />
          ) : (
            <div className="world-map-empty muted">Загрузите изображение карты выше — маркеры расставляются прямо на ней.</div>
          )}
          {r.locations.map((loc) => (
            <div
              key={loc.id}
              className={`map-marker ${sel === loc ? 'on' : ''} ${loc.hidden ? 'hidden-loc' : ''}`}
              style={{ left: `${(loc.position.x / size.w) * 100}%`, top: `${(loc.position.y / size.h) * 100}%` }}
              onPointerDown={(e) => {
                e.stopPropagation()
                e.preventDefault()
                dragging.current = loc
                setSelLoc(loc.id)
              }}
            >
              <span className="map-marker-dot">📍</span>
              <span className="map-marker-label">{loc.label}</span>
            </div>
          ))}
        </div>
      </div>

      {sel && <LocationProps key={sel.id} loc={sel} region={r} store={store} commit={commit} onRemove={async () => {
        if (!(await askConfirm(`Удалить локацию «${sel.label}»?`, 'Удалить'))) return
        r.locations.splice(r.locations.indexOf(sel), 1)
        setSelLoc(null)
        commit()
      }} />}
      {!sel && r.locations.length > 0 && (
        <div className="muted small">Кликните по маркеру, чтобы настроить локацию (сцены, дороги, арену).</div>
      )}
    </div>
  )
}

function LocationProps({
  loc,
  region,
  store,
  commit,
  onRemove,
}: {
  loc: LocationDef
  region: RegionDef
  store: EditorStore
  commit: () => void
  onRemove: () => void
}) {
  const allLocs = store.options('location').filter((o) => o.id !== loc.id)
  return (
    <div className="props-group">
      <h4>📍 {loc.label}</h4>
      <div className="fld-row">
        <label className="fld">
          <span>Название</span>
          <input value={loc.label} onChange={(e) => ((loc.label = e.target.value), commit())} />
        </label>
        <label className="fld fld-check" title="Скрытая локация не видна на карте, пока её не откроет правило (reveal_location)">
          <input type="checkbox" checked={!!loc.hidden} onChange={(e) => {
            if (e.target.checked) loc.hidden = true
            else delete loc.hidden
            commit()
          }} />
          <span>Скрыта до открытия</span>
        </label>
      </div>

      <div className="fld-block">
        <span className="fld-caption">Сцены локации</span>
        {loc.scenes.map((sc, si) => (
          <div key={si} className="journal-row">
            <select className="journal-key" value={sc} onChange={(e) => ((loc.scenes[si] = e.target.value), commit())}>
              {!store.options('scene').some((o) => o.id === sc) && <option value={sc}>{sc}</option>}
              {store.options('scene').map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
            <button className="btn btn-small ce-del" onClick={() => (loc.scenes.splice(si, 1), commit())}>✕</button>
          </div>
        ))}
        <button className="btn btn-small" onClick={() => (loc.scenes.push(store.options('scene')[0]?.id ?? ''), commit())}>
          + сцена
        </button>
      </div>

      <div className="fld-block">
        <span className="fld-caption">Дороги (куда можно дойти отсюда)</span>
        {loc.travel_connections.map((tc, ti) => (
          <div key={ti} className="journal-row">
            <select className="journal-key" value={tc.to} onChange={(e) => ((tc.to = e.target.value), commit())}>
              {!allLocs.some((o) => o.id === tc.to) && <option value={tc.to}>{tc.to || '—'}</option>}
              {allLocs.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
            <label className="fld fld-inline">
              <span>в пути</span>
              <input type="number" value={tc.cost_ticks} onChange={(e) => ((tc.cost_ticks = Number(e.target.value)), commit())} />
            </label>
            <button className="btn btn-small ce-del" onClick={() => (loc.travel_connections.splice(ti, 1), commit())}>✕</button>
          </div>
        ))}
        <button
          className="btn btn-small"
          onClick={() => {
            const to = allLocs.find((o) => !loc.travel_connections.some((t) => t.to === o.id))
            loc.travel_connections.push({ to: to?.id ?? '', cost_ticks: 1 })
            commit()
          }}
        >
          + дорога
        </button>
      </div>

      <RefSelect
        label="Арена боя в этой локации"
        kind="arena"
        store={store}
        value={loc.arena ?? ''}
        optional
        onChange={(v) => {
          if (v) loc.arena = v
          else delete loc.arena
          commit()
        }}
      />
      <div className="muted small" style={{ marginBottom: 8 }}>
        Если в локации начнётся бой без явно указанной арены — будет использована эта. Регион: {region.label}.
      </div>

      <button className="btn btn-small ce-del" onClick={onRemove}>✕ удалить локацию</button>
    </div>
  )
}
