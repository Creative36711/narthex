/**
 * Синтезатор речи браузера (Web Speech API) — фолбэк озвучки
 * (итерация 8, блок G): если у реплики или слайда нет файла озвучки,
 * а игрок включил «Озвучивать диалоги синтезатором», текст читает
 * системный голос. Работает офлайн, если голос установлен в системе.
 *
 * ОЧЕРЕДЬ ОЗВУЧКИ (фидбек 17). Фразы диалога читаются ПОДРЯД через
 * собственную последовательную очередь, а не через внутреннюю очередь
 * браузера:
 *  - голоса дожидается до первого произнесения (`voiceschanged`) — иначе
 *    самые первые фразы диалога молча теряются и речь «начинается с середины»;
 *  - после `cancel()` выдерживается пауза: в Chrome `speak()`, вызванный
 *    сразу за асинхронным `cancel()`, молча проглатывается;
 *  - периодический `pause()/resume()` — обход хронического замирания
 *    синтезатора в Chrome при долгой речи;
 *  - повторов нарочно нет (фидбек 19): любые сбои просто двигают очередь
 *    дальше; сторожок 8 с защищает только от ПОЛНОГО зависания синтезатора,
 *    чтобы диалог не молчал вечно;
 *  - прогрев первым жестом пользователя будит «спящий» синтезатор заранее;
 *  - ДО первого жеста очередь НЕ трогает синтезатор вовсе (фидбек 20):
 *    браузеры запрещают озвучку без действия пользователя, и фразы,
 *    отправленные «в тишину», молча терялись — диалог начинал звучать
 *    с середины. Теперь фразы ждут первого клика и звучат по порядку.
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
    .replace(/[«»\"]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// ─────────────── прогрев списка голосов ───────────────

let voicesReady = false
const bootTs = Date.now()

function pickVoice(name?: string): SpeechSynthesisVoice | undefined {
  const voices = ttsVoices()
  return voices.find((v) => v.name === name) ?? voices.find((v) => v.lang.toLowerCase().startsWith('ru'))
}

function initVoices(): void {
  if (!ttsSupported() || voicesReady) return
  const synth = window.speechSynthesis
  const check = () => {
    if (synth.getVoices().length > 0) voicesReady = true
  }
  check()
  synth.addEventListener?.('voiceschanged', check)
}
initVoices()

// ─────────────── последовательная очередь фраз ───────────────

interface QueueItem {
  clean: string
  opts: { voice?: string; rate?: number; volume?: number; onEnd?: () => void }
  cancelled?: boolean
  /** синтезатор подтвердил старт произнесения (событие onstart) */
  started: boolean
  /** по фразе уже принято финальное решение (защита от двойных событий) */
  settled: boolean
}

const queue: QueueItem[] = []
let active: QueueItem | null = null
let pumpTimer: ReturnType<typeof setTimeout> | null = null
/** до этого момента не зовём speak(): cancel() в Chrome асинхронный */
let cooldownUntil = 0
let keepalive: ReturnType<typeof setInterval> | null = null
/** таймер полного зависания: нет ни старта, ни финала — идём дальше */
let stallTimer: ReturnType<typeof setTimeout> | null = null

function clearStallTimer(): void {
  if (stallTimer !== null) {
    clearTimeout(stallTimer)
    stallTimer = null
  }
}

// ─────────────── «прогрев» синтезатора первым жестом ───────────────
// Браузеры запрещают озвучку до действия пользователя (фидбек 20): фразы,
// отправленные в синтезатор до первого клика, молча отбрасываются — очередь
// проскакивает их, и речь «начинается с середины». Поэтому до первого жеста
// очередь вообще не трогает синтезатор: фразы копятся и звучат по порядку
// сразу после клика. Плюс короткая служебная фраза будит «спящий» синтезатор.

let primed = false
/** было ли действие пользователя, разрешающее озвучку */
let gestureSeen = false

function onFirstGesture(): void {
  gestureSeen = true
  prime()
  pump() // фразы, накопленные до жеста, начинают звучать по порядку
}

function prime(): void {
  if (primed || !ttsSupported()) return
  primed = true
  try {
    const u = new SpeechSynthesisUtterance(' ')
    u.volume = 0.01
    const v = pickVoice(undefined)
    if (v) {
      u.voice = v
      u.lang = v.lang
    }
    window.speechSynthesis.speak(u)
  } catch {
    /* не критично */
  }
}
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', onFirstGesture, { once: true })
  window.addEventListener('keydown', onFirstGesture, { once: true })
}

function startKeepalive(): void {
  if (keepalive !== null || !ttsSupported()) return
  // Chrome замолкает на длинной речи; пауза/продолжение раз в 10 с «будит» его
  keepalive = setInterval(() => {
    const synth = window.speechSynthesis
    if (synth.speaking && !synth.paused) {
      synth.pause()
      synth.resume()
    }
  }, 10000)
}

function stopKeepalive(): void {
  if (keepalive !== null) {
    clearInterval(keepalive)
    keepalive = null
  }
}

function pump(): void {
  if (pumpTimer !== null) return // уже запланирован следующий шаг
  if (active) return
  const item = queue[0]
  if (!item) {
    stopKeepalive()
    return
  }
  // до первого жеста браузер всё равно отбросит озвучку — фразы ждут клика
  // браузер запрещает звук без действия пользователя — фразы ждут клика
  if (!gestureSeen) return
  if (item.cancelled) {
    queue.shift()
    pump()
    return
  }
  // список голосов ещё не пришёл (первые секунды после загрузки страницы) —
  // коротко откладываем, чтобы первая фраза диалога не потерялась
  if (!voicesReady && Date.now() - bootTs < 4000) {
    pumpTimer = setTimeout(() => {
      pumpTimer = null
      pump()
    }, 120)
    return
  }
  const wait = Math.max(0, cooldownUntil - Date.now())
  if (wait > 0) {
    pumpTimer = setTimeout(() => {
      pumpTimer = null
      pump()
    }, wait)
    return
  }
  queue.shift()
  active = item
  item.started = false
  item.settled = false
  startKeepalive()
  speakItem(item)
}

/** фразу дочитали (или решение принято) — двигаем очередь дальше */
function finishItem(item: QueueItem): void {
  if (item.settled) return
  item.settled = true
  clearStallTimer()
  if (active === item) active = null
  if (!item.cancelled) item.opts.onEnd?.()
  pump()
}

/**
 * Произнести одну фразу. Повторов нарочно НЕТ (фидбек 19: повторы хуже,
 * чем пропущенная фраза): любые события окончания просто двигают очередь.
 * Единственная защита — сторожок полного зависания: если за 8 секунд нет
 * ни старта, ни окончания — снимаем синтезатор и идём дальше, чтобы
 * диалог не молчал вечно.
 */
function speakItem(item: QueueItem): void {
  const synth = window.speechSynthesis
  const u = new SpeechSynthesisUtterance(item.clean)
  const chosen = pickVoice(item.opts.voice)
  if (chosen) {
    u.voice = chosen
    u.lang = chosen.lang
  } else {
    u.lang = 'ru-RU'
  }
  u.rate = Math.max(0.5, Math.min(2, item.opts.rate ?? 1))
  u.volume = Math.max(0, Math.min(1, item.opts.volume ?? 1))
  u.onstart = () => {
    item.started = true
    clearStallTimer()
  }
  u.onend = () => finishItem(item)
  u.onerror = () => finishItem(item)
  try {
    synth.speak(u)
    synth.resume() // защита от «застрявшего» пауз-состояния
  } catch {
    finishItem(item)
    return
  }
  clearStallTimer()
  stallTimer = setTimeout(() => {
    stallTimer = null
    if (active === item && !item.started) {
      try {
        synth.cancel()
      } catch {
        /* уже не важно */
      }
      finishItem(item)
    }
  }, 8000)
}

/**
 * Очистить очередь и остановить синтезатор. Возвращает очередь в согласованное
 * состояние; следующий `speak()` выдержит короткую паузу после `cancel()`.
 */
export function stopSpeaking(): void {
  for (const item of queue) item.cancelled = true
  queue.length = 0
  if (active) active.cancelled = true
  active = null
  if (ttsSupported()) window.speechSynthesis.cancel()
  clearStallTimer()
  cooldownUntil = Date.now() + 100
}

/**
 * Прочитать текст. Возвращает функцию отмены. `onEnd` вызывается и при
 * естественном окончании, и при ошибке синтезатора (чтобы ролик не завис);
 * для отменённых фраз `onEnd` не вызывается.
 *
 * `queue: true` — фраза встаёт в очередь за уже звучащими (реплики диалога);
 * иначе очередь очищается и фраза звучит одна (катсцены, повтор не нужен).
 */
export function speak(
  text: string,
  opts: { voice?: string; rate?: number; volume?: number; onEnd?: () => void; queue?: boolean } = {},
): () => void {
  const clean = speakableText(text)
  if (!ttsSupported() || !clean) {
    opts.onEnd?.()
    return () => undefined
  }
  initVoices()
  if (!opts.queue) stopSpeaking()
  const item: QueueItem = { clean, opts, started: false, settled: false }
  queue.push(item)
  pump()
  return () => {
    item.cancelled = true
    if (active === item) stopSpeaking()
    else pump()
  }
}
/** диагностика озвучки прямо из консоли браузера: вставьте `__cf_tts()` */
if (typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__cf_tts = () => ({
    поддерживается: ttsSupported(),
    был_жест_пользователя: gestureSeen,
    голосов_в_системе: ttsVoices().length,
    говорит_сейчас: window.speechSynthesis?.speaking ?? false,
    на_паузе: window.speechSynthesis?.paused ?? false,
    фраз_в_очереди: queue.length,
    активная_фраза: active ? active.clean.slice(0, 60) : null,
  })
}
