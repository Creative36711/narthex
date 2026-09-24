import { useState } from 'react'
import type { RegionDef } from '../shared/types'
import type { EditorStore } from './store'
import { JsonField } from './Fields'
import { makeId } from './ids'

/** Редактор world.json формой: регионы, локации, дороги. */
export function WorldEditor({ store }: { store: EditorStore }) {
  const [, force] = useState(0)
  const [gen, setGen] = useState(0)
  const commit = () => {
    store.touch('world.json')
    force((n) => n + 1)
  }
  const allLocIds = store.ids('location')
  const sceneIds = store.ids('scene')

  return (
    <div className="rule-editor">
      {store.world.regions.map((r) => (
        <RegionForm key={r.id} region={r} commit={commit} allLocIds={allLocIds} sceneIds={sceneIds} />
      ))}
      <button
        className="btn btn-small"
        onClick={() => {
          const label = prompt('Название нового региона:')
          if (!label) return
          store.world.regions.push({
            id: makeId('region_', label, store.world.regions.map((x) => x.id)),
            label,
            map_image: '',
            map_size: { w: 1280, h: 720 },
            parent_region: null,
            locations: [],
          })
          commit()
        }}
      >
        + регион
      </button>

      <details className="advanced-json" onToggle={(e) => (e.target as HTMLDetailsElement).open && setGen((n) => n + 1)}>
        <summary>Расширенный JSON (world.json целиком)</summary>
        <JsonField
          key={gen}
          label=""
          rows={16}
          pretty
          value={store.world}
          onChange={(v) => {
            if (v !== undefined) {
              store.world.regions = (v as { regions: RegionDef[] }).regions
              commit()
            }
          }}
        />
      </details>
    </div>
  )
}

function RegionForm({
  region: r,
  commit,
  allLocIds,
  sceneIds,
}: {
  region: RegionDef
  commit: () => void
  allLocIds: string[]
  sceneIds: string[]
}) {
  return (
    <div className="props-group">
      <h4>Регион · <code>{r.id}</code></h4>
      <div className="fld-row">
        <label className="fld">
          <span>Название</span>
          <input value={r.label} onChange={(e) => ((r.label = e.target.value), commit())} />
        </label>
        <label className="fld">
          <span>Карта (изображение)</span>
          <input value={r.map_image} onChange={(e) => ((r.map_image = e.target.value), commit())} />
        </label>
      </div>

      {r.locations.map((loc, i) => (
        <details key={loc.id} className="loc-details">
          <summary>
            📍 {loc.label} <code className="muted">{loc.id}</code>
            {loc.hidden ? ' · скрыта' : ''}
          </summary>
          <div className="fld-row">
            <label className="fld">
              <span>Название</span>
              <input value={loc.label} onChange={(e) => ((loc.label = e.target.value), commit())} />
            </label>
            <label className="fld">
              <span>X на карте</span>
              <input type="number" value={loc.position.x} onChange={(e) => ((loc.position.x = Number(e.target.value)), commit())} />
            </label>
            <label className="fld">
              <span>Y на карте</span>
              <input type="number" value={loc.position.y} onChange={(e) => ((loc.position.y = Number(e.target.value)), commit())} />
            </label>
            <label className="fld fld-check">
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
                  {!sceneIds.includes(sc) && <option value={sc}>{sc}</option>}
                  {sceneIds.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <button className="btn btn-small ce-del" onClick={() => (loc.scenes.splice(si, 1), commit())}>✕</button>
              </div>
            ))}
            <button className="btn btn-small" onClick={() => (loc.scenes.push(sceneIds[0] ?? ''), commit())}>+ сцена</button>
          </div>

          <div className="fld-block">
            <span className="fld-caption">Дороги (куда можно дойти)</span>
            {loc.travel_connections.map((tc, ti) => (
              <div key={ti} className="journal-row">
                <select className="journal-key" value={tc.to} onChange={(e) => ((tc.to = e.target.value), commit())}>
                  {!allLocIds.includes(tc.to) && <option value={tc.to}>{tc.to}</option>}
                  {allLocIds.filter((l) => l !== loc.id).map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
                <label className="fld fld-inline">
                  <span>тиков в пути</span>
                  <input type="number" value={tc.cost_ticks} onChange={(e) => ((tc.cost_ticks = Number(e.target.value)), commit())} />
                </label>
                <button className="btn btn-small ce-del" onClick={() => (loc.travel_connections.splice(ti, 1), commit())}>✕</button>
              </div>
            ))}
            <button
              className="btn btn-small"
              onClick={() => {
                const to = allLocIds.find((l) => l !== loc.id && !loc.travel_connections.some((t) => t.to === l))
                loc.travel_connections.push({ to: to ?? '', cost_ticks: 1 })
                commit()
              }}
            >
              + дорога
            </button>
          </div>

          <button className="btn btn-small ce-del" onClick={() => confirm(`Удалить локацию «${loc.label}»?`) && (r.locations.splice(i, 1), commit())}>
            ✕ удалить локацию
          </button>
        </details>
      ))}

      <button
        className="btn btn-small"
        onClick={() => {
          const label = prompt('Название новой локации:')
          if (!label) return
          r.locations.push({
            id: makeId('loc_', label, allLocIds),
            label,
            position: { x: 200 + r.locations.length * 60, y: 200 },
            travel_connections: [],
            scenes: [],
          })
          commit()
        }}
      >
        + локация
      </button>
    </div>
  )
}
