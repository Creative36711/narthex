import type { PackViewHook } from '../../src/core/pack/host'
import type { NarrativeFrame, NarrativeState } from './types'

/** Projection only: every observable leaves through the host draw port. */
export const narrativeView: PackViewHook<NarrativeState, NarrativeFrame> = ({ state, frame, draw }) => {
  draw({
    type: 'narrative.scene',
    frame: frame.frame,
    scene: state.scene,
    location: state.location,
  })
  if (state.dialogue) {
    draw({
      type: 'narrative.dialogue',
      frame: frame.frame,
      dialogue: state.dialogue.dialogue,
      node: state.dialogue.node,
    })
  }
  for (const [quest, questState] of Object.entries(state.quests)) {
    draw({
      type: 'narrative.quest',
      frame: frame.frame,
      quest,
      stage: questState.stage,
      status: questState.status,
    })
  }
}
