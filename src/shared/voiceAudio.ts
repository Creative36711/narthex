/**
 * Единый канал озвучки движка (Voice Coordinator):
 * Гарантирует монопольное воспроизведение голоса в игре.
 * В любой момент времени может звучать ТОЛЬКО ОДИН голос — будь то
 * аудиофайл реплики диалога, слайда катсцены, нарративного интро сцены
 * или синтезатор речи (TTS). Запуск любой новой фразы немедленно
 * глушит предыдущую.
 */

import { stopSpeaking } from './speech'

let currentVoiceAudio: HTMLAudioElement | null = null

export interface PlayVoiceOptions {
  volume?: number
  onEnd?: () => void
  onError?: () => void
  onLoadedMetadata?: (duration: number) => void
}

/**
 * Остановить только воспроизведение аудиофайла (без сброса очереди TTS).
 */
export function stopVoiceFileOnly(): void {
  if (currentVoiceAudio) {
    const a = currentVoiceAudio
    currentVoiceAudio = null
    a.onended = null
    a.onerror = null
    a.onloadedmetadata = null
    try {
      a.pause()
      a.currentTime = 0
    } catch {}
  }
}

/**
 * Остановить любую текущую голосовую озвучку (и файл, и синтезатор речи).
 */
export function stopVoiceAudio(): void {
  stopVoiceFileOnly()
  stopSpeaking()
}

/**
 * Воспроизвести аудиофайл голоса.
 * Автоматически глушит любую звучащую озвучку или речь.
 * Возвращает функцию отмены.
 */
export function playVoiceAudio(src: string, opts?: PlayVoiceOptions): () => void {
  // Немедленно глушим любую активную озвучку (файл или TTS)
  stopVoiceAudio()

  if (!src) {
    opts?.onEnd?.()
    return () => undefined
  }

  let cancelled = false
  const audio = new Audio(src)
  currentVoiceAudio = audio

  const vol = opts?.volume != null ? Math.max(0, Math.min(1, opts.volume)) : 1
  audio.volume = vol

  if (opts?.onLoadedMetadata) {
    audio.onloadedmetadata = () => {
      if (!cancelled) {
        opts.onLoadedMetadata?.(audio.duration || 0)
      }
    }
  }

  audio.onended = () => {
    if (currentVoiceAudio === audio) {
      currentVoiceAudio = null
    }
    if (!cancelled) {
      opts?.onEnd?.()
    }
  }

  audio.onerror = () => {
    if (currentVoiceAudio === audio) {
      currentVoiceAudio = null
    }
    if (!cancelled) {
      opts?.onError?.() ?? opts?.onEnd?.()
    }
  }

  audio.play().catch(() => {
    if (currentVoiceAudio === audio) {
      currentVoiceAudio = null
    }
    if (!cancelled) {
      opts?.onError?.() ?? opts?.onEnd?.()
    }
  })

  return () => {
    cancelled = true
    if (currentVoiceAudio === audio) {
      stopVoiceAudio()
    }
  }
}

/** звучит ли сейчас голос через аудиофайл */
export function isVoiceAudioPlaying(): boolean {
  return !!currentVoiceAudio && !currentVoiceAudio.paused
}
