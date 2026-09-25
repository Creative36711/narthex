/**
 * Настройки игрока (итерация 8, блоки E и G): громкость музыки и озвучки,
 * синтезатор речи браузера. Хранятся в localStorage и общие для всех
 * кампаний. Подписка — чтобы открытые экраны сразу слышали изменения.
 */

import { useEffect, useState } from 'react'

export interface PlayerSettings {
  /** общая громкость 0…1 */
  volume: number
  /** громкость музыки (катсцены) 0…1 */
  music_volume: number
  /** громкость озвучки реплик и слайдов 0…1 */
  voice_volume: number
  /** озвучка выключена целиком (файлы и синтезатор) */
  voice_muted: boolean
  /** читать реплики без файла озвучки синтезатором браузера (Web Speech API) */
  tts_enabled: boolean
  /** имя голоса синтезатора (SpeechSynthesisVoice.name); пусто — русский по умолчанию */
  tts_voice: string
  /** скорость речи синтезатора 0.5…2 */
  tts_rate: number
}

export const DEFAULT_SETTINGS: PlayerSettings = {
  volume: 0.9,
  music_volume: 0.6,
  voice_volume: 1,
  voice_muted: false,
  tts_enabled: false,
  tts_voice: '',
  tts_rate: 1,
}

const KEY = 'chronicle-forge:settings'
const listeners = new Set<(s: PlayerSettings) => void>()
let cache: PlayerSettings | null = null

export function getSettings(): PlayerSettings {
  if (cache) return cache
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null
    cache = { ...DEFAULT_SETTINGS, ...(raw ? (JSON.parse(raw) as Partial<PlayerSettings>) : {}) }
  } catch {
    cache = { ...DEFAULT_SETTINGS }
  }
  return cache
}

export function setSettings(patch: Partial<PlayerSettings>): PlayerSettings {
  cache = { ...getSettings(), ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(cache))
  } catch {
    /* приватный режим */
  }
  for (const fn of listeners) fn(cache)
  return cache
}

export function subscribeSettings(fn: (s: PlayerSettings) => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** React-хук: актуальные настройки с автообновлением */
export function useSettings(): PlayerSettings {
  const [s, set] = useState(getSettings)
  useEffect(() => subscribeSettings(set), [])
  return s
}

/** итоговая громкость музыки/озвучки с учётом общей */
export function musicVolume(s: PlayerSettings): number {
  return clamp01(s.volume * s.music_volume)
}

export function voiceVolume(s: PlayerSettings): number {
  return s.voice_muted ? 0 : clamp01(s.volume * s.voice_volume)
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(v) ? v : 1))
}
