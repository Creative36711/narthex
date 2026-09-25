/**
 * Звуки кампании (итерация 8, блоки H1/H3/H4): реестры sounds/ui_sounds,
 * разрешение звуков взаимодействий от частного к общему:
 *
 *   сущность.sounds → категория предмета.sounds → тип слота.sounds →
 *   тема кампании (ui_sounds) → тишина
 *
 * Источник звука — файл/ссылка ИЛИ SoundDoc (синтез из JSON); у звука может
 * быть массив источников — при каждом воспроизведении выбирается случайный
 * вариант (три скрипа двери под одним id).
 */
import type { CampaignData, EntityDef, SoundDef, SoundDoc, SoundHook, SoundSource } from './types'
import { audioCtx, renderSoundDoc, unlockAudio } from './synth'
import { getSettings, sfxVolume } from './settings'

export { unlockAudio, audioCtx } from './synth'

let campaign: CampaignData | null = null

/** вызывается при выборе/загрузке кампании (и при выходе в меню) */
export function setAudioCampaign(c: CampaignData | null): void {
  campaign = c
}

export function isSoundDoc(v: unknown): v is SoundDoc {
  return !!v && typeof v === 'object' && Array.isArray((v as SoundDoc).zzfx)
}

function soundDef(id: string): SoundDef | undefined {
  return campaign?.meta.sounds?.find((s) => s.id === id)
}

/** случайный вариант источника (массив src) */
function pickSource(src: SoundSource | SoundSource[]): SoundSource {
  if (Array.isArray(src)) {
    if (!src.length) return ''
    return src[Math.floor(Math.random() * src.length)]
  }
  return src
}

/** проиграть звук реестра по id */
export function playSoundId(id: string, volume = 1): void {
  if (!id || !campaign) return
  const def = soundDef(id)
  if (!def) return
  playSource(pickSource(def.src), volume)
}

/** проиграть источник напрямую (файл/ссылка или SoundDoc) */
export function playSource(src: SoundSource, volume = 1): void {
  if (!src) return
  const vol = sfxVolume(getSettings()) * volume
  if (vol <= 0) return
  unlockAudio()
  if (isSoundDoc(src)) {
    const c = audioCtx()
    if (!c) return
    if (c.state === 'suspended') void c.resume()
    const buf = renderSoundDoc(c, src)
    const node = c.createBufferSource()
    node.buffer = buf
    const g = c.createGain()
    g.gain.value = vol
    node.connect(g)
    g.connect(c.destination)
    node.start()
    return
  }
  // файл пакета или внешняя ссылка
  if (typeof Audio === 'undefined') return // headless
  const url = campaign && !/^https?:|^data:|^blob:/i.test(src) ? `${campaign.basePath}/${src}` : src
  const a = new Audio(url)
  a.volume = vol
  void a.play().catch(() => undefined)
}

/**
 * Звуковая тема кампании: `playUi('hit')` и т.д. Пустой хук — тишина,
 * движок своих звуков не навязывает.
 */
export function playUi(hook: string, volume = 1): void {
  const id = campaign?.meta.ui_sounds?.[hook]
  if (id) playSoundId(id, volume)
}

/**
 * Звук взаимодействия (H3): сущность → категория предмета → тип слота →
 * тема кампании → тишина. У хуков есть тематические алиасы в теме
 * (`travel` → `scene_transition`): звучит максимум один раз.
 */
const HOOK_FALLBACK: Record<string, string[]> = {
  travel: ['travel', 'scene_transition'],
}

export function playInteraction(
  hook: SoundHook,
  info: { entity?: EntityDef; slotType?: string } = {},
  volume = 1,
): void {
  if (!campaign) return
  const meta = campaign.meta
  const fromEntity = info.entity?.sounds?.[hook]
  if (fromEntity) return playSoundId(fromEntity, volume)
  const ent = info.entity
  if (ent && ent.type === 'item') {
    const cat = meta.item_categories?.find((c) => c.id === ent.category)
    const fromCat = cat?.sounds?.[hook]
    if (fromCat) return playSoundId(fromCat, volume)
  }
  if (info.slotType) {
    const st = meta.slot_types?.find((t) => t.id === info.slotType)
    const fromSlot = st?.sounds?.[hook]
    if (fromSlot) return playSoundId(fromSlot, volume)
  }
  for (const name of HOOK_FALLBACK[hook] ?? [hook]) {
    const id = meta.ui_sounds?.[name]
    if (id) return playSoundId(id, volume)
  }
}
