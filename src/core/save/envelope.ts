import type { GameState, SaveEnvelope } from '../../shared/types'
import { SAVE_ENVELOPE_VERSION, SAVE_VERSION } from '../../shared/types'
import { ENGINE_VERSION } from '../../shared/versions'
import { OLDEST_SAVE_VERSION } from './migrations'

/** Разбор того, что лежит в хранилище: обёртка или «голое» состояние старой версии. */
export function parseStored(raw: string): SaveEnvelope | null {
  const data = JSON.parse(raw) as Partial<SaveEnvelope> & Partial<GameState>
  if (!data || typeof data !== 'object') return null
  if (typeof data.envelope_version === 'number' && data.state && typeof data.state === 'object') {
    return data as SaveEnvelope
  }
  // старый формат: GameState лежал в хранилище сам по себе
  const state = data as GameState
  if (!state.player || typeof state.player !== 'object') return null
  return {
    envelope_version: SAVE_ENVELOPE_VERSION,
    save_version: state.save_version ?? OLDEST_SAVE_VERSION,
    campaign_id: state.campaign_id ?? '',
    campaign_version: undefined,
    engine_version: undefined,
    state,
  }
}

export function makeEnvelope(state: GameState, campaignId: string, campaignVersion: string | undefined, prev?: SaveEnvelope): SaveEnvelope {
  const now = new Date().toISOString()
  return {
    envelope_version: SAVE_ENVELOPE_VERSION,
    save_version: SAVE_VERSION,
    campaign_id: campaignId,
    campaign_version: campaignVersion,
    engine_version: ENGINE_VERSION,
    created_at: prev?.created_at ?? now,
    updated_at: now,
    tick: state.tick,
    location: state.location,
    state,
  }
}

