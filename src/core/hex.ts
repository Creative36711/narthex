/**
 * Гекс-логика: offset "odd-r" (pointy-top), кубические координаты,
 * соседи, дистанция, A*, зона досягаемости (ТЗ 4.3 — бой).
 */

export interface Hex {
  col: number
  row: number
}

export const hexKey = (h: Hex) => `${h.col},${h.row}`

interface Cube {
  q: number
  r: number
  s: number
}

export function offsetToCube(h: Hex): Cube {
  const q = h.col - (h.row - (h.row & 1)) / 2
  const r = h.row
  return { q, r, s: -q - r }
}

export function cubeToOffset(c: Cube): Hex {
  return { col: c.q + (c.r - (c.r & 1)) / 2, row: c.r }
}

const CUBE_DIRS: Cube[] = [
  { q: 1, r: 0, s: -1 },
  { q: 1, r: -1, s: 0 },
  { q: 0, r: -1, s: 1 },
  { q: -1, r: 0, s: 1 },
  { q: -1, r: 1, s: 0 },
  { q: 0, r: 1, s: -1 },
]

export function neighbors(h: Hex): Hex[] {
  const c = offsetToCube(h)
  return CUBE_DIRS.map((d) => cubeToOffset({ q: c.q + d.q, r: c.r + d.r, s: c.s + d.s }))
}

export function hexDistance(a: Hex, b: Hex): number {
  const ca = offsetToCube(a)
  const cb = offsetToCube(b)
  return Math.max(Math.abs(ca.q - cb.q), Math.abs(ca.r - cb.r), Math.abs(ca.s - cb.s))
}

const SQRT3 = Math.sqrt(3)

/** Центр гекса в пикселях (pointy-top, odd-r). */
export function hexToPixel(h: Hex, size: number, origin: { x: number; y: number }): { x: number; y: number } {
  return {
    x: origin.x + size * SQRT3 * (h.col + 0.5 * (h.row & 1)),
    y: origin.y + size * 1.5 * h.row,
  }
}

/** Габариты сетки в пикселях. */
export function gridPixelSize(cols: number, rows: number, size: number): { w: number; h: number } {
  return {
    w: size * SQRT3 * (cols + 0.5),
    h: size * (1.5 * (rows - 1) + 2),
  }
}

/** Точки полигона гекса для SVG. */
export function hexCorners(center: { x: number; y: number }, size: number): string {
  const pts: string[] = []
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30)
    pts.push(`${(center.x + size * Math.cos(angle)).toFixed(1)},${(center.y + size * Math.sin(angle)).toFixed(1)}`)
  }
  return pts.join(' ')
}

/** Зона досягаемости с учётом стоимости клеток (Dijkstra). key → стоимость. */
export function reachable(
  start: Hex,
  movePoints: number,
  passable: (h: Hex) => boolean,
  cost: (h: Hex) => number,
): Map<string, number> {
  const dist = new Map<string, number>([[hexKey(start), 0]])
  const frontier: Hex[] = [start]
  while (frontier.length) {
    frontier.sort((a, b) => (dist.get(hexKey(a)) ?? 0) - (dist.get(hexKey(b)) ?? 0))
    const cur = frontier.shift()!
    const curCost = dist.get(hexKey(cur))!
    for (const n of neighbors(cur)) {
      if (!passable(n)) continue
      const nc = curCost + cost(n)
      if (nc > movePoints) continue
      const k = hexKey(n)
      if (nc < (dist.get(k) ?? Infinity)) {
        dist.set(k, nc)
        frontier.push(n)
      }
    }
  }
  dist.delete(hexKey(start))
  return dist
}

/** A*: путь от start до goal (goal может быть занят — путь обрезается перед ним). */
export function astar(
  start: Hex,
  goal: Hex,
  passable: (h: Hex) => boolean,
  cost: (h: Hex) => number,
): Hex[] | null {
  const startK = hexKey(start)
  const goalK = hexKey(goal)
  const open: Hex[] = [start]
  const came = new Map<string, string>()
  const g = new Map<string, number>([[startK, 0]])
  const nodes = new Map<string, Hex>([[startK, start]])

  while (open.length) {
    open.sort(
      (a, b) =>
        (g.get(hexKey(a))! + hexDistance(a, goal)) - (g.get(hexKey(b))! + hexDistance(b, goal)),
    )
    const cur = open.shift()!
    const curK = hexKey(cur)
    if (curK === goalK) {
      const path: Hex[] = []
      let k = goalK
      while (k !== startK) {
        path.unshift(nodes.get(k)!)
        k = came.get(k)!
      }
      return path
    }
    for (const n of neighbors(cur)) {
      const nk = hexKey(n)
      if (nk !== goalK && !passable(n)) continue
      const ng = g.get(curK)! + cost(n)
      if (ng < (g.get(nk) ?? Infinity)) {
        g.set(nk, ng)
        came.set(nk, curK)
        nodes.set(nk, n)
        if (!open.some((o) => hexKey(o) === nk)) open.push(n)
      }
    }
  }
  return null
}
