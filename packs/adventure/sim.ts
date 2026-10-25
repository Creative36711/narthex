import type { DeepReadonly, PackSimHook } from '../../src/core/pack/host'
import { copyAdventureRuntime, copyAdventureState, copyNarrativeState } from './state'
import type {
  AdventureContent,
  AdventureEvent,
  AdventureHotspot,
  AdventureScene,
  AdventureState,
  NarrativeEvent,
  NarrativeState,
  Point,
  WalkNode,
} from './types'

type NarrativeSim = PackSimHook<NarrativeState, NarrativeEvent>

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function nodeById(scene: AdventureScene, id: string): WalkNode {
  const node = scene.walk.nodes.find((candidate) => candidate.id === id)
  if (!node) throw new Error(`Unknown walk node ${id}`)
  return node
}

function nearestNode(scene: AdventureScene, point: Point): WalkNode {
  return [...scene.walk.nodes].sort((a, b) =>
    distance(a, point) - distance(b, point) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  )[0] ?? (() => { throw new Error('Adventure scene has no walk nodes') })()
}

function walkPath(scene: AdventureScene, startId: string, targetId: string): { points: Point[]; length: number } {
  const distances = new Map<string, number>([[startId, 0]])
  const previous = new Map<string, string>()
  const pending = new Set(scene.walk.nodes.map((node) => node.id))
  while (pending.size) {
    const current = [...pending].sort((a, b) =>
      (distances.get(a) ?? Infinity) - (distances.get(b) ?? Infinity) || (a < b ? -1 : a > b ? 1 : 0),
    )[0]!
    const currentDistance = distances.get(current) ?? Infinity
    if (!Number.isFinite(currentDistance)) throw new Error(`No walk path from ${startId} to ${targetId}`)
    pending.delete(current)
    if (current === targetId) break
    for (const [from, to] of scene.walk.edges) {
      const neighbor = from === current ? to : to === current ? from : null
      if (!neighbor || !pending.has(neighbor)) continue
      const candidate = currentDistance + distance(nodeById(scene, current), nodeById(scene, neighbor))
      if (candidate < (distances.get(neighbor) ?? Infinity)) {
        distances.set(neighbor, candidate)
        previous.set(neighbor, current)
      }
    }
  }
  if (!distances.has(targetId)) throw new Error(`No walk path from ${startId} to ${targetId}`)
  const ids = [targetId]
  while (ids[0] !== startId) {
    const parent = previous.get(ids[0]!)
    if (!parent) throw new Error(`Broken walk path from ${startId} to ${targetId}`)
    ids.unshift(parent)
  }
  return {
    points: ids.map((id) => {
      const node = nodeById(scene, id)
      return { x: node.x, y: node.y }
    }),
    length: distances.get(targetId)!,
  }
}

function walkTo(state: AdventureState, content: AdventureContent, point: Point): void {
  const scene = content.scenes[state.scene]
  if (!scene) throw new Error(`Scene ${state.scene} has no adventure walk data`)
  const target = nearestNode(scene, point)
  const route = walkPath(scene, state.adventure.avatar.node, target.id)
  const points = route.points.map((value) => ({ ...value }))
  const last = points[points.length - 1]!
  let extra = 0
  if (last.x !== point.x || last.y !== point.y) {
    extra = distance(last, point)
    points.push({ ...point })
  }
  state.adventure.avatar = {
    node: target.id,
    x: point.x,
    y: point.y,
    path: points,
    distance: route.length + extra,
  }
  state.adventure.message = null
}

function hotspotAt(scene: AdventureScene, point: Point): AdventureHotspot {
  const hotspot = scene.hotspots.find((candidate) =>
    point.x >= candidate.x && point.x <= candidate.x + candidate.w &&
    point.y >= candidate.y && point.y <= candidate.y + candidate.h,
  )
  if (!hotspot) throw new Error(`No adventure hotspot at ${point.x},${point.y}`)
  return hotspot
}

function changeItem(state: AdventureState, item: string, delta: number): void {
  const quantity = (state.inventory[item] ?? 0) + delta
  if (quantity < 0) throw new Error(`Not enough ${item}`)
  if (quantity === 0) delete state.inventory[item]
  else state.inventory[item] = quantity
}

function combine(state: AdventureState, content: AdventureContent, first: string, second: string): void {
  const wanted = [first, second].sort()
  const recipe = content.combinations.find((candidate) =>
    [...candidate.inputs].sort().every((item, index) => item === wanted[index]),
  )
  if (!recipe) throw new Error(`No combination for ${first} + ${second}`)
  const required = new Map<string, number>()
  for (const item of recipe.inputs) required.set(item, (required.get(item) ?? 0) + 1)
  for (const [item, count] of required) {
    if ((state.inventory[item] ?? 0) < count) throw new Error(`Combination ${recipe.id} needs ${item} ×${count}`)
  }
  for (const item of recipe.inputs) changeItem(state, item, -1)
  changeItem(state, recipe.output, 1)
  state.adventure.message = recipe.message
}

function delegate(
  state: DeepReadonly<AdventureState>,
  event: DeepReadonly<NarrativeEvent>,
  narrative: NarrativeSim,
  seed: number,
): AdventureState {
  const narrativeState = copyNarrativeState(state)
  const result = narrative({ state: narrativeState, event, seed })
  return {
    ...(result ?? narrativeState),
    adventure: copyAdventureRuntime(state.adventure),
  }
}

function click(
  state: AdventureState,
  content: AdventureContent,
  narrative: NarrativeSim,
  point: Point,
  seed: number,
): AdventureState {
  if (state.adventure.cursor === 'walk') {
    walkTo(state, content, point)
    return state
  }
  const scene = content.scenes[state.scene]
  if (!scene) throw new Error(`Scene ${state.scene} has no adventure hotspots`)
  const hotspot = hotspotAt(scene, point)
  if (state.adventure.cursor === 'look') {
    state.adventure.message = `${hotspot.label}: ${hotspot.message}`
    return state
  }
  if (state.adventure.cursor === 'take') {
    if (!hotspot.item) throw new Error(`${hotspot.id} cannot be taken`)
    if (state.adventure.takenHotspots.includes(hotspot.id)) throw new Error(`${hotspot.id} was already taken`)
    changeItem(state, hotspot.item, 1)
    state.adventure.takenHotspots.push(hotspot.id)
    state.adventure.message = `${hotspot.label}: получено ${hotspot.item}`
    return state
  }
  if (!hotspot.dialogue) throw new Error(`${hotspot.id} has no dialogue`)
  state.adventure.message = `${hotspot.label}: ${hotspot.dialogue}`
  return delegate(state, {
    type: 'start_dialogue',
    dialogue: hotspot.dialogue,
    node: hotspot.node,
  }, narrative, seed)
}

function reduceAdventure(
  content: AdventureContent,
  narrative: NarrativeSim,
  state: DeepReadonly<AdventureState>,
  event: DeepReadonly<AdventureEvent>,
  seed: number,
): AdventureState {
  switch (event.type) {
    case 'adventure_cursor': {
      const next = copyAdventureState(state)
      next.adventure.cursor = event.mode
      next.adventure.message = null
      return next
    }
    case 'adventure_click':
      return click(copyAdventureState(state), content, narrative, { x: event.x, y: event.y }, seed)
    case 'adventure_combine': {
      const next = copyAdventureState(state)
      combine(next, content, event.first, event.second)
      return next
    }
    case 'adventure_open_riddle': {
      const riddle = content.riddles.find((candidate) => candidate.id === event.riddle)
      if (!riddle) throw new Error(`Unknown adventure riddle ${event.riddle}`)
      const moved = state.scene === riddle.scene
        ? copyAdventureState(state)
        : delegate(state, { type: 'goto', scene: riddle.scene }, narrative, seed)
      moved.adventure.activeRiddle = riddle.id
      moved.adventure.message = riddle.message
      return moved
    }
    case 'adventure_solve_riddle': {
      const next = copyAdventureState(state)
      const riddle = content.riddles.find((candidate) => candidate.id === event.riddle)
      if (!riddle || next.adventure.activeRiddle !== riddle.id) throw new Error(`Riddle ${event.riddle} is not active`)
      if (riddle.solution.length !== event.solution.length || riddle.solution.some((value, index) => value !== event.solution[index])) {
        next.adventure.message = `${riddle.id}: последовательность не совпала`
        return next
      }
      if (!next.adventure.solvedRiddles.includes(riddle.id)) next.adventure.solvedRiddles.push(riddle.id)
      next.adventure.activeRiddle = null
      next.adventure.ending = riddle.ending
      next.adventure.message = `${riddle.id}: ${riddle.ending}`
      return next
    }
    default:
      return delegate(state, event, narrative, seed)
  }
}

/** Bind data and the required narrative capability once; the hook stays pure. */
export function createAdventureSim(
  content: AdventureContent,
  narrative: NarrativeSim,
): PackSimHook<AdventureState, AdventureEvent> {
  return (context) => reduceAdventure(content, narrative, context.state, context.event, context.seed)
}
