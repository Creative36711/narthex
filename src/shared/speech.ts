/**
 * Синтезатор речи браузера (Web Speech API) — фолбэк озвучки
 * (итерация 8, блок G): если у реплики или слайда нет файла озвучки,
 * а игрок включил «Озвучивать диалоги синтезатором», текст читает
 * системный голос. Работает офлайн, если голос установлен в системе.
 */

import { useEffect, useState } from 'react'

export function ttsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'
}

/** голоса системы: русские — первыми, дальше по алфавиту */
export function ttsVoices(): SpeechSynthesisVoice[] {
  if (!ttsSupported()) return []
  const list = window.speechSynthesis.getVoices()
  const ru = (v: SpeechSynthesisVoice) => (v.lang.toLowerCase().startsWith('ru') ? 0 : 1)
  return [...list].sort((a, b) => ru(a) - ru(b) || a.name.localeCompare(b.name))
}

/** голоса грузятся асинхронно — хук обновляет список, когда браузер его отдаст */
export function useTtsVoices(): SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => ttsVoices())
  useEffect(() => {
    if (!ttsSupported()) return
    const update = () => setVoices(ttsVoices())
    update()
    window.speechSynthesis.addEventListener('voiceschanged', update)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', update)
  }, [])
  return voices
}

/** убрать из реплики то, что не нужно читать вслух (ремарки в *звёздочках*, лишние пробелы) */
export function speakableText(text: string): string {
  return text
    .replace(/\*[^*]*\*/g, ' ')
    .replace(/[«»"]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Прочитать текст. Возвращает функцию отмены. `onEnd` вызывается и при
 * естественном окончании, и при ошибке синтезатора (чтобы ролик не завис).
 */
export function speak(
  text: string,
  opts: { voice?: string; rate?: number; volume?: number; onEnd?: () => void } = {},
): () => void {
  const clean = speakableText(text)
  if (!ttsSupported() || !clean) {
    opts.onEnd?.()
    return () => undefined
  }
  const synth = window.speechSynthesis
  synth.cancel()
  const u = new SpeechSynthesisUtterance(clean)
  const voices = ttsVoices()
  const chosen = voices.find((v) => v.name === opts.voice) ?? voices.find((v) => v.lang.toLowerCase().startsWith('ru'))
  if (chosen) {
    u.voice = chosen
    u.lang = chosen.lang
  } else {
    u.lang = 'ru-RU'
  }
  u.rate = Math.max(0.5, Math.min(2, opts.rate ?? 1))
  u.volume = Math.max(0, Math.min(1, opts.volume ?? 1))
  let done = false
  const finish = () => {
    if (done) return
    done = true
    opts.onEnd?.()
  }
  u.onend = finish
  u.onerror = finish
  synth.speak(u)
  return () => {
    done = true
    synth.cancel()
  }
}

export function stopSpeaking(): void {
  if (ttsSupported()) window.speechSynthesis.cancel()
}
