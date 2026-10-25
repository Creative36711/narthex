import type { PackHooks, PackSimHook } from '../../src/core/pack/host'
import { createAdventureSim } from './sim'
import { adventureView } from './view'
import type {
  AdventureContent,
  AdventureEvent,
  AdventureFrame,
  AdventureState,
  NarrativeEvent,
  NarrativeState,
} from './types'

/** The host injects the required narrative capability; no pack import is needed. */
export function createAdventureHooks(
  content: AdventureContent,
  narrative: PackSimHook<NarrativeState, NarrativeEvent>,
): PackHooks<AdventureState, AdventureEvent, AdventureFrame> {
  return {
    sim: createAdventureSim(content, narrative),
    view: adventureView,
  }
}
