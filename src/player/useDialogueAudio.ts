import { useCallback, useEffect, useEffectEvent, useRef } from 'react'
import type { GameEngine } from '../core/engine'
import type { DialogueLine } from '../../packs/narrative/index'
import { assetUrl } from '../core/loader'
import { useSettings, voiceVolume } from '../shared/settings'
import { speak } from '../shared/speech'
import { setMusicDucking } from '../shared/music'
import { playInteraction } from '../shared/audio'

/** Страховка для аудиофайла реплики, если браузер не прислал onended/onerror. */
function fallbackReadMs(text: string): number {
  return Math.min(30000, text.length * 70 + 4000)
}

/** Одна озвучка на реплику; запуск и уборка — только после коммита или по жесту игрока. */
export function useDialogueAudio(
  engine: GameEngine,
  dialogue: GameEngine['dialogue'],
  revealed: number,
  setLineDone: (done: boolean) => void,
) {
  const settings = useSettings()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const stopTtsRef = useRef<(() => void) | null>(null)
  const fallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelLineRef = useRef<(() => void) | null>(null)

  const clearLineAudio = useCallback(() => {
    cancelLineRef.current?.()
    cancelLineRef.current = null
    setMusicDucking(false)
    audioRef.current?.pause()
    audioRef.current = null
    stopTtsRef.current?.()
    stopTtsRef.current = null
    if (fallbackRef.current !== null) {
      clearTimeout(fallbackRef.current)
      fallbackRef.current = null
    }
  }, [])

  // Как и раньше, настройки читаются при старте реплики. Их изменение не
  // должно перезапускать уже звучащую фразу или повторять её звуковой эффект.
  const playLine = useEffectEvent((line: DialogueLine) => {
    clearLineAudio()
    setLineDone(false)
    let isCurrent = true
    cancelLineRef.current = () => { isCurrent = false }
    const done = () => {
      if (!isCurrent) return
      setMusicDucking(false)
      setLineDone(true)
    }
    if (line.sfx) {
      playInteraction(line.sfx, { sound: line.sfx })
    }
    const vol = voiceVolume(settings)
    if (line.voice && vol > 0) {
      setMusicDucking(true, 0.45)
      const audioUrl = assetUrl(engine.campaign, line.voice)
      const a = new Audio(audioUrl)
      a.volume = vol
      audioRef.current = a

      // Ждем завершения воспроизведения
      a.onended = () => {
        if (!isCurrent || audioRef.current !== a) return
        done()
      }

      a.onerror = (e) => {
        console.warn(`[диалог] аудиофайл реплики не загрузился: «${line.voice}»`, e)
        if (!isCurrent || audioRef.current !== a) return
        done()
      }

      // Считываем точную длительность файла
      a.onloadedmetadata = () => {
        if (!isCurrent || audioRef.current !== a) return
        const durationSec = a.duration
        if (Number.isFinite(durationSec) && durationSec > 0) {
          if (fallbackRef.current) clearTimeout(fallbackRef.current)
          fallbackRef.current = setTimeout(() => {
            fallbackRef.current = null
            done()
          }, (durationSec + 0.6) * 1000)
        }
      }

      // Страховочный таймер, если loadedmetadata не пришел
      fallbackRef.current = setTimeout(() => {
        fallbackRef.current = null
        done()
      }, Math.max(8000, fallbackReadMs(line.text)))

      void a.play().catch((err) => {
        // AbortError случается при быстрой смене/паузе — не считаем окончанием фразы!
        if (err?.name === 'AbortError') return
        console.warn(`[диалог] play() не удался для «${line.voice}»:`, err)
        if (!isCurrent || audioRef.current !== a) return
        done()
      })
    } else if (settings.tts_enabled && vol > 0) {
      setMusicDucking(true, 0.45)
      stopTtsRef.current = speak(line.text, {
        voice: settings.tts_voice,
        rate: settings.tts_rate,
        volume: vol,
        onEnd: () => {
          if (isCurrent) done()
        },
      })
    } else {
      done()
    }
  })

  const current = dialogue?.lines[revealed]
  // StrictMode: настройка → уборка → настройка снова запускает первую фразу.
  // Смена строки/диалога и размонтирование сначала останавливают старый звук.
  useEffect(() => {
    if (!dialogue || !current) return
    playLine(current)
    return () => clearLineAudio()
  }, [dialogue, revealed, current, clearLineAudio])

  return clearLineAudio
}
