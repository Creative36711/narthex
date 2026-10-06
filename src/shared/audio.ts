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
import type { AmbientRule, CampaignData, EntityDef, SoundDef, SoundDoc, SoundHook, SoundSource } from './types'
import { audioCtx, renderSoundDoc, unlockAudio } from './synth'
import { getSettings, sfxVolume } from './settings'
import { evalCondition } from '../core/conditions'

export { unlockAudio, audioCtx } from './synth'

let campaign: CampaignData | null = null

/**
 * Фоновые звуки движка (тема кампании, эмбиент локации/погоды, звуки
 * нажатий) можно глушить — редактору это нужно, чтобы мастер слушал
 * ПРЕДПРОСЛУШИВАНИЕ звука из раздела «Звук и музыка» и слышал только его.
 * Явные вызовы playSource (кнопка «Прослушать») глушитель не трогает.
 */
let ambientEnabled = true

/** вкл/выкл фоновые звуки движка (редактор — выкл, плейтест — вкл) */
export function setAmbientAudioEnabled(on: boolean): void {
  if (ambientEnabled === on) return
  ambientEnabled = on
  if (!on) stopAllLoops()
}

/** фоновые звуки сейчас разрешены? */
export function ambientAudioEnabled(): boolean {
  return ambientEnabled
}

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

interface ActiveInstance {
  stop: () => void
}
const activeSoundInstances = new Map<string, ActiveInstance[]>()

function trackInstance(id: string, inst: ActiveInstance): void {
  if (!id) return
  const list = activeSoundInstances.get(id) ?? []
  list.push(inst)
  activeSoundInstances.set(id, list)
}

function untrackInstance(id: string, inst: ActiveInstance): void {
  const list = activeSoundInstances.get(id)
  if (!list) return
  const filtered = list.filter((i) => i !== inst)
  if (filtered.length) activeSoundInstances.set(id, filtered)
  else activeSoundInstances.delete(id)
}

/** остановить воспроизведение звука (по id или все, если id не передан) */
export function stopSound(id?: string): void {
  if (id) {
    stopLoop(id)
    const list = activeSoundInstances.get(id)
    if (list) {
      for (const inst of list) {
        try { inst.stop() } catch {}
      }
      activeSoundInstances.delete(id)
    }
  } else {
    stopAllLoops()
    for (const list of activeSoundInstances.values()) {
      for (const inst of list) {
        try { inst.stop() } catch {}
      }
    }
    activeSoundInstances.clear()
  }
}

/** проиграть звук реестра по id */
export function playSoundId(id: string, volume = 1): void {
  if (!id || !campaign || !ambientEnabled) return
  const def = soundDef(id)
  if (!def) return
  playSource(pickSource(def.src), volume, id)
}

/** проиграть источник напрямую (файл/ссылка или SoundDoc) */
export function playSource(src: SoundSource, volume = 1, soundId?: string): void {
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
    if (soundId) {
      const inst: ActiveInstance = {
        stop: () => {
          try { node.stop() } catch {}
          try { g.disconnect() } catch {}
        },
      }
      trackInstance(soundId, inst)
      node.onended = () => untrackInstance(soundId, inst)
    }
    return
  }
  // файл пакета или внешняя ссылка
  if (typeof Audio === 'undefined') return // headless
  const url = campaign && !/^https?:|^data:|^blob:/i.test(src) ? `${campaign.basePath}/${src}` : src
  const a = new Audio(url)
  a.volume = vol
  if (soundId) {
    const inst: ActiveInstance = {
      stop: () => {
        try { a.pause(); a.currentTime = 0 } catch {}
      },
    }
    trackInstance(soundId, inst)
    a.onended = () => untrackInstance(soundId, inst)
  }
  void a.play().catch(() => undefined)
}

/**
 * Звуковая тема кампании: `playUi('click')`, `playUi('panel:inventory')` и т.д.
 * Поддерживает каскадный поиск:
 * 1. Точный ключ в ui_sounds (`panel:inventory`)
 * 2. Алиас с подчеркиванием (`panel_inventory`)
 * 3. Базовый ключ до двоеточия / общий хук (`panel:open` -> `panel_open`)
 * 4. Если сам `hook` — это существующий ID звука из meta.sounds, играет его напрямую.
 */
export function playUi(hook: string, volume = 1): void {
  if (!hook || !campaign || !ambientEnabled) return
  const ui = campaign.meta.ui_sounds ?? {}
  // 1. Точный ключ
  if (ui[hook]) return playSoundId(ui[hook], volume)
  // 2. Алиас с _ вместо :
  const underscored = hook.includes(':') ? hook.replace(/:/g, '_') : null
  if (underscored && ui[underscored]) return playSoundId(ui[underscored], volume)
  // 3. Каскад панелей:
  if (hook.includes('close')) {
    if (ui['panel:close']) return playSoundId(ui['panel:close'], volume)
    if (ui['panel_close']) return playSoundId(ui['panel_close'], volume)
    if (ui['click']) return playSoundId(ui['click'], volume * 0.7)
  } else if (hook.startsWith('panel:') || hook.startsWith('panel_')) {
    if (ui['panel:open']) return playSoundId(ui['panel:open'], volume)
    if (ui['panel_open']) return playSoundId(ui['panel_open'], volume)
  }
  // 4. Если передан прямой id звука из реестра
  if (soundDef(hook)) return playSoundId(hook, volume)
}

/**
 * Звук взаимодействия (H3): сущность → категория предмета → тип слота →
 * тема кампании → прямой звук → тишина.
 * Поддерживает прямое указание звука через `info.sound`.
 */
const HOOK_FALLBACK: Record<string, string[]> = {
  travel: ['travel', 'scene_transition'],
  'item:equip': ['equip', 'item_equip'],
  'item:unequip': ['unequip', 'item_unequip'],
  'item:use': ['use', 'item_use'],
  'item:drop': ['drop', 'item_drop'],
}

export function playInteraction(
  hook: SoundHook,
  info: { entity?: EntityDef; slotType?: string; sound?: string } = {},
  volume = 1,
): void {
  if (!campaign || !ambientEnabled) return
  // Прямой звук имеет наивысший приоритет
  if (info.sound) {
    if (soundDef(info.sound)) return playSoundId(info.sound, volume)
    return playSource(info.sound, volume, info.sound)
  }
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
  // Фоллбэк на каскадный playUi
  playUi(hook, volume)
}

// ─────────────── зацикленные фоны и наложение (фидбек 9.6) ───────────────
/**
 * Фоновые звуки («поют птицы») — отдельные каналы по id: один и тот же звук
 * не наслаивается сам на себя, РАЗНЫЕ звуки играют одновременно слоями,
 * а короткие звуки действий (playSoundId) звучат поверх.
 */
interface LoopChannel {
  stop(): void
}
const loops = new Map<string, LoopChannel>()

/** запустить зацикленный слой (id звука с loop-источником); повторный вызов — no-op */
export function playLoop(id: string, volume = 1): void {
  if (!campaign || !id || loops.has(id) || !ambientEnabled) return
  const def = soundDef(id)
  if (!def) return
  const src = pickSource(def.src)
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
    node.loop = true
    const g = c.createGain()
    g.gain.value = vol
    node.connect(g)
    g.connect(c.destination)
    node.start()
    loops.set(id, {
      stop: () => {
        try {
          node.stop()
        } catch {
          /* уже остановлен */
        }
        try {
          g.disconnect()
        } catch {
          /* нет */
        }
      },
    })
    return
  }
  if (typeof Audio === 'undefined') return
  const url = campaign && !/^https?:|^data:|^blob:/i.test(src) ? `${campaign.basePath}/${src}` : src
  const a = new Audio(url)
  a.loop = true
  a.volume = vol
  void a.play().catch(() => undefined)
  loops.set(id, { stop: () => a.pause() })
}

export function stopLoop(id: string): void {
  loops.get(id)?.stop()
  loops.delete(id)
}

export function stopAllLoops(): void {
  for (const id of [...loops.keys()]) stopLoop(id)
}

/** текущие зацикленные слои (для отладки/смоуков) */
export function activeLoops(): string[] {
  return [...loops.keys()]
}

function extractAmbientSounds(
  items: Array<string | AmbientRule> | undefined,
  engine: any,
): Array<{ id: string; volume: number }> {
  const result: Array<{ id: string; volume: number }> = []
  for (const item of items ?? []) {
    if (typeof item === 'string') {
      if (item) result.push({ id: item, volume: 1 })
    } else if (item && typeof item === 'object') {
      const ok =
        !item.conditions ||
        item.conditions.length === 0 ||
        item.conditions.every((c) => {
          try {
            return evalCondition(c, engine)
          } catch {
            return false
          }
        })
      if (ok) {
        const vol = item.volume ?? 1
        const list = [...(item.sounds ?? []), ...(item.sound ? [item.sound] : [])].filter(Boolean)
        for (const s of list) result.push({ id: s, volume: vol })
      }
    }
  }
  return result
}

/**
 * Пересчитать фон по сцене/локации (вызывать с refreshMusic): слои локации
 * и сцены складываются, лишние гаснут, новые стартуют. Headless — no-op.
 */
export function refreshAmbient(engine: {
  state: { scene: string; location: string; weather?: string }
  campaign: CampaignData
}): void {
  const desired = new Map<string, number>()
  const sc = engine.campaign.scenes[engine.state.scene]
  let locAmbient: Array<string | AmbientRule> = []
  let locLegacy = ''
  for (const r of engine.campaign.world.regions) {
    const l = r.locations.find((x) => x.id === engine.state.location)
    if (l) {
      locAmbient = l.ambient ?? []
      locLegacy = l.ambient_audio ?? ''
      break
    }
  }
  const weather = engine.campaign.meta.weathers?.find((w) => w.id === engine.state.weather)

  const items = [
    ...extractAmbientSounds(locAmbient, engine),
    ...(locLegacy ? [{ id: locLegacy, volume: 1 }] : []),
    ...extractAmbientSounds(sc?.ambient, engine),
    ...extractAmbientSounds(weather?.ambient, engine),
  ]

  for (const item of items) {
    if (item.id) desired.set(item.id, item.volume)
  }

  for (const id of [...loops.keys()]) {
    if (!desired.has(id)) stopLoop(id)
  }
  for (const [id, vol] of desired) playLoop(id, vol)
}
