import { useMemo, useState } from 'react'
import type { ArenaDef, HexCoord } from '../shared/types'
import type { Hex } from '../core/hex'
import { hexCorners, hexToPixel, gridPixelSize } from '../core/hex'
import type { EditorStore } from './store'
import { ImageUpload, RefSelect, FileAdvancedJson } from './Fields'
import { MusicTrackSelect } from './AudioSection'

/**
 * Редактор арены (ТЗ 5.2.6): фон + гекс-сетка, раскраска кистью —
 * блокированные гексы, сложная местность, зоны спавна игрока/врагов.
 */

type Brush = 'blocked' | 'difficult' | 'spawn_player' | 'spawn_enemy' | 'erase'

const BRUSHES: Array<{ id: Brush; label: string; color: string }> = [
  { id: 'blocked', label: 'Блок', color: '#b03a2e' },
  { id: 'difficult', label: 'Сложная местность', color: '#8c7a4a' },
  { id: 'spawn_player', label: 'Спавн игрока', color: '#5a7d43' },
  { id: 'spawn_enemy', label: 'Спавн врагов', color: '#7d435a' },
  { id: 'erase', label: 'Ластик', color: '#666' },
]

const inList = (list: HexCoord[], h: Hex) => list.some(([c, r]) => c === h.col && r === h.row)
const without = (list: HexCoord[], h: Hex) => list.filter(([c, r]) => !(c === h.col && r === h.row))

export function ArenaEditor({ store, path }: { store: EditorStore; path: string }) {
  const arena = store.arena(path)
  const [brush, setBrush] = useState<Brush>('blocked')
  const [painting, setPainting] = useState(false)
  const [, force] = useState(0)

  const canvas = arena.canvas ?? { w: 1280, h: 720 }
  const size = arena.hex_grid.hex_size
  const origin = useMemo(() => {
    if (arena.hex_grid.origin) return arena.hex_grid.origin
    const g = gridPixelSize(arena.hex_grid.cols, arena.hex_grid.rows, size)
    return {
      x: (canvas.w - g.w) / 2 + (size * Math.sqrt(3)) / 2,
      y: (canvas.h - g.h) / 2 + size,
    }
  }, [arena.hex_grid.origin, arena.hex_grid.cols, arena.hex_grid.rows, size, canvas.w, canvas.h])

  const commit = () => {
    store.touch(path)
    force((n) => n + 1)
  }

  const paint = (h: Hex) => {
    const g = arena.hex_grid
    const sp = arena.spawn_zones
    // убрать из всех
    g.blocked_hexes = without(g.blocked_hexes, h)
    g.difficult_terrain = without(g.difficult_terrain, h)
    sp.player.hexes = without(sp.player.hexes, h)
    sp.enemy.hexes = without(sp.enemy.hexes, h)
    if (brush === 'blocked') g.blocked_hexes.push([h.col, h.row])
    else if (brush === 'difficult') g.difficult_terrain.push([h.col, h.row])
    else if (brush === 'spawn_player') sp.player.hexes.push([h.col, h.row])
    else if (brush === 'spawn_enemy') sp.enemy.hexes.push([h.col, h.row])
    commit()
  }

  const hexes: Hex[] = []
  for (let row = 0; row < arena.hex_grid.rows; row++)
    for (let col = 0; col < arena.hex_grid.cols; col++) hexes.push({ col, row })

  const setGrid = (key: 'cols' | 'rows' | 'hex_size', v: number) => {
    if (!Number.isFinite(v) || v < 1) return
    if (key === 'hex_size') arena.hex_grid.hex_size = v
    else arena.hex_grid[key] = v
    commit()
  }

  return (
    <div className="arena-editor">
      <div className="scene-canvas-col">
        <div className="scene-toolbar">
          {BRUSHES.map((b) => (
            <button
              key={b.id}
              className={`btn btn-small brush ${brush === b.id ? 'brush-on' : ''}`}
              style={{ borderColor: brush === b.id ? b.color : undefined }}
              onClick={() => setBrush(b.id)}
            >
              <i className="brush-dot" style={{ background: b.color }} /> {b.label}
            </button>
          ))}
        </div>
        <div
          className="arena-stage"
          style={{ aspectRatio: `${canvas.w} / ${canvas.h}` }}
          onMouseDown={() => setPainting(true)}
          onMouseUp={() => setPainting(false)}
          onMouseLeave={() => setPainting(false)}
        >
          {arena.image && <img className="combat-bg" src={store.assetSrc(arena.image)} alt="" draggable={false} />}
          <svg className="combat-grid" viewBox={`0 0 ${canvas.w} ${canvas.h}`} preserveAspectRatio="none">
            {hexes.map((h) => {
              const c = hexToPixel(h, size, origin)
              const g = arena.hex_grid
              let fill = 'rgba(255,255,255,0.04)'
              let stroke = 'rgba(232,221,201,0.35)'
              if (inList(g.blocked_hexes, h)) fill = 'rgba(176,58,46,0.5)'
              else if (inList(g.difficult_terrain, h)) fill = 'rgba(140,122,74,0.45)'
              else if (inList(arena.spawn_zones.player.hexes, h)) fill = 'rgba(90,125,67,0.55)'
              else if (inList(arena.spawn_zones.enemy.hexes, h)) fill = 'rgba(125,67,90,0.55)'
              return (
                <polygon
                  key={`${h.col},${h.row}`}
                  points={hexCorners(c, size - 1)}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={1}
                  onMouseDown={() => paint(h)}
                  onMouseEnter={() => painting && paint(h)}
                />
              )
            })}
          </svg>
        </div>
        <div className="muted small">Клик/протяжка — красить выбранной кистью. Ластик очищает гекс.</div>
      </div>

      <div className="scene-props">
        <div className="props-group">
          <h4>Арена</h4>
          <label className="fld">
            <span>Название</span>
            <input value={arena.label} onChange={(e) => ((arena.label = e.target.value), commit())} />
          </label>
          <ImageUpload
            label="Фон арены (вид сверху)"
            value={arena.image}
            dir="assets/img/arenas"
            store={store}
            onChange={(p) => ((arena.image = p), commit())}
          />
          <ArenaLocationBinding arena={arena} store={store} commit={commit} />
          <div className="fld-row">
            <label className="fld">
              <span>Колонок</span>
              <input type="number" value={arena.hex_grid.cols} onChange={(e) => setGrid('cols', Number(e.target.value))} />
            </label>
            <label className="fld">
              <span>Строк</span>
              <input type="number" value={arena.hex_grid.rows} onChange={(e) => setGrid('rows', Number(e.target.value))} />
            </label>
            <label className="fld">
              <span>Гекс, px</span>
              <input type="number" value={arena.hex_grid.hex_size} onChange={(e) => setGrid('hex_size', Number(e.target.value))} />
            </label>
          </div>
          <div className="muted small">
            Спавн игрока: {arena.spawn_zones.player.hexes.length} · врагов: {arena.spawn_zones.enemy.hexes.length}
            <br />
            Блоков: {arena.hex_grid.blocked_hexes.length} · сложных: {arena.hex_grid.difficult_terrain.length}
          </div>
        </div>
      </div>
    
      <div className="fld fld-block">
        <span>Музыка боя (перекрывает «Музыка боя» кампании)</span>
        <MusicTrackSelect
          store={store}
          value={arena.music}
          onChange={(id) => {
            if (id) arena.music = id
            else delete arena.music
            store.touch(path)
          }}
        />
      </div>
      <FileAdvancedJson store={store} path={path} commit={() => store.touch(path)} label="Расширенный JSON арены (все поля)" />
</div>
  )
}

export function newArena(id: string): ArenaDef {
  return {
    id,
    label: 'Новая арена',
    image: '',
    canvas: { w: 1280, h: 720 },
    hex_grid: {
      cols: 10,
      rows: 6,
      hex_size: 52,
      offset: 'odd-r',
      blocked_hexes: [],
      difficult_terrain: [],
    },
    spawn_zones: { player: { hexes: [] }, enemy: { hexes: [] } },
  }
}


/** Привязка арены к локации (фидбек №21): выбирается локация, у которой эта арена — «домашняя». */
function ArenaLocationBinding({
  arena,
  store,
  commit,
}: {
  arena: { id: string }
  store: EditorStore
  commit: () => void
}) {
  // локация, у которой loc.arena === arena.id
  const findBound = (): string => {
    let bound = ''
    const walk = (regions: typeof store.world.regions) => {
      for (const r of regions) {
        for (const l of r.locations) if (l.arena === arena.id) bound = l.id
        if (r.sub_regions) walk(r.sub_regions)
      }
    }
    walk(store.world.regions)
    return bound
  }
  const setBound = (locId: string | undefined) => {
    const walk = (regions: typeof store.world.regions) => {
      for (const r of regions) {
        for (const l of r.locations) {
          if (l.arena === arena.id && l.id !== locId) delete l.arena
          if (locId && l.id === locId) l.arena = arena.id
        }
        if (r.sub_regions) walk(r.sub_regions)
      }
    }
    walk(store.world.regions)
    store.touch('world.json')
    commit()
  }
  return (
    <RefSelect
      label="Локация этой арены"
      kind="location"
      store={store}
      value={findBound()}
      optional
      onChange={(v) => setBound(v)}
    />
  )
}
