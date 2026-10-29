import { PackHost } from '../../src/core/pack/host'
import {
  createNarrativePackBinding,
  loadNarrativeContent,
  narrativeEntryEvent,
  NARRATIVE_PACK_MANIFEST,
} from '../../packs/narrative/runtime'
import type { NarrativeEvent, NarrativeFrame, NarrativeState } from '../../packs/narrative/types'

export interface NarrativePackCheck {
  packId: string
  seam: string
  steps: 1
  event: NarrativeEvent['type']
  from: { scene: string; location: string; fmv: string | null }
  to: { scene: string; location: string; fmv: string | null }
}

/** Run the narrative seam through the same PackHost used by the playkit adapters. */
export async function checkNarrativePack(campaignDir: string, seed: number): Promise<NarrativePackCheck> {
  const content = await loadNarrativeContent(campaignDir)
  const binding = createNarrativePackBinding(content, NARRATIVE_PACK_MANIFEST)
  const simSeam = binding.manifest.provides.seams?.find((seam) => seam.kind === 'sim')
  if (!simSeam) throw new Error('PACK_RUNTIME_MISSING: narrative pack does not declare a sim seam')

  const host = new PackHost<NarrativeState, NarrativeEvent, NarrativeFrame>([binding.manifest])
  if (!host.register(binding.manifest.id, binding.hooks)) {
    throw new Error(`PACK_RUNTIME_MISSING: ${host.paused?.reason ?? 'narrative pack hook registration failed'}`)
  }

  const event = narrativeEntryEvent(content, binding.state)
  const execution = host.runSim({ state: binding.state, event, seed })
  if (execution.paused) {
    throw new Error(
      `PACK_SIM_FAILED: ${execution.paused.packId}/${simSeam.id}: ${execution.paused.reason}`,
    )
  }

  const snapshot = (state: NarrativeState) => ({
    scene: state.scene,
    location: state.location,
    fmv: state.fmv?.phase ?? null,
  })

  return {
    packId: binding.manifest.id,
    seam: String(simSeam.id),
    steps: 1,
    event: event.type,
    from: snapshot(binding.state),
    to: snapshot(execution.state),
  }
}
