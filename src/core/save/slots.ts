import type { CampaignData, SaveEnvelope } from '../../shared/types'
import { SAVE_VERSION } from '../../shared/types'
import { allLocations } from '../../shared/migrate'
import { OLDEST_SAVE_VERSION } from './migrations'
import { slotKey, MAX_SAVE_SLOTS } from './keys'
import type { SaveSlot } from './keys'
import { readRaw } from './storage'
import { parseStored } from './envelope'

/** карточка слота для панели «Сохранения» */
export interface SaveSlotInfo {
  slot: SaveSlot
  envelope: SaveEnvelope
  /** подписи места из сохранённого состояния (гарантированно строки) */
  scene: string
  location: string
  /** ticк забега в момент сохранения */
  tick: number
}

/** Все занятые слоты кампании: автосейв первым, затем ручные по номеру. */
export function listSaveSlots(campaignId: string, campaign?: CampaignData): SaveSlotInfo[] {
  const out: SaveSlotInfo[] = []
  const collect = (slot: SaveSlot) => {
    const raw = readRaw(slotKey(campaignId, slot))
    if (!raw) return
    try {
      const env = parseStored(raw)
      if (!env) return
      const v = env.save_version ?? env.state.save_version ?? OLDEST_SAVE_VERSION
      if (v < OLDEST_SAVE_VERSION || v > SAVE_VERSION) return
      const st = env.state
      out.push({
        slot,
        envelope: env,
        scene: (campaign?.scenes?.[st.scene]?.label ?? st.scene) || '',
        location:
          (campaign ? (allLocations(campaign.world).find((l) => l.id === st.location)?.label ?? st.location) : st.location) || '',
        tick: st.tick ?? 0,
      })
    } catch {
      /* битая запись — пропускаем */
    }
  }
  collect('auto')
  for (let n = 1; n <= MAX_SAVE_SLOTS; n++) collect(n)
  return out
}

