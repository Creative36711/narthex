// Every narrative composition root receives the real operation set as well as sim/view.
import './operations'
import type { PackHooks } from '../../src/core/pack/host'
import { createNarrativeSim } from './sim'
import { createNarrativeView } from './view'
import type { NarrativeContent, NarrativeEvent, NarrativeFrame, NarrativeState } from './types'

export function createNarrativeHooks(
  content: NarrativeContent,
): PackHooks<NarrativeState, NarrativeEvent, NarrativeFrame> {
  return {
    sim: createNarrativeSim(content),
    view: createNarrativeView(content),
  }
}
