import type { PackViewHook } from '../../src/core/pack/host'
import { drawFmv } from './fmv'
import type { NarrativeContent, NarrativeFrame, NarrativeState } from './types'

/** Projection only: every observable leaves through the host draw port. */
export function createNarrativeView(
  content: NarrativeContent,
): PackViewHook<NarrativeState, NarrativeFrame> {
  return ({ state, frame, draw }) => {
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
    drawFmv(state, content, frame, draw)
  }
}
