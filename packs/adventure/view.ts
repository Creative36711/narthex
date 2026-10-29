import type { PackViewHook } from '../../src/core/pack/host'
import type { AdventureFrame, AdventureState } from './types'

/** Every observable is a draw command; this hook has no state-writing port. */
export const adventureView: PackViewHook<AdventureState, AdventureFrame> = ({ state, frame, draw }) => {
  draw({
    type: 'adventure.avatar',
    frame: frame.frame,
    scene: state.scene,
    node: state.adventure.avatar.node,
    x: state.adventure.avatar.x,
    y: state.adventure.avatar.y,
    path: state.adventure.avatar.path.map((point) => ({ x: point.x, y: point.y })),
    distance: state.adventure.avatar.distance,
  })
  draw({
    type: 'adventure.cursor',
    frame: frame.frame,
    mode: state.adventure.cursor,
  })
  if (state.adventure.message) {
    draw({
      type: 'adventure.message',
      frame: frame.frame,
      text: state.adventure.message,
    })
  }
  if (state.adventure.activeRiddle) {
    draw({
      type: 'adventure.closeup',
      frame: frame.frame,
      scene: state.scene,
      riddle: state.adventure.activeRiddle,
    })
  }
  if (state.adventure.ending) {
    draw({
      type: 'adventure.ending',
      frame: frame.frame,
      ending: state.adventure.ending,
    })
  }
}
