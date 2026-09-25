/**
 * Синтез аудио из JSON (итерация 8, блок H5):
 *
 * - `SoundDoc { zzfx: [...] }` — параметрический SFX в стиле ZzFX/jsfxr:
 *   числа в порядке параметров zzfx, рендерим в AudioBuffer на лету (кэш).
 *   Ретро-характер приемлем для кликов/ударов/звяканья.
 * - `MusicDoc` — высокоуровневый генеративный трек (НЕ ноты вручную):
 *   настроение/темп/тональность/лад/слои/аккорды/зерно. Все звуки берутся
 *   ступенями гаммы — генератор физически не может сыграть «мимо»,
 *   поэтому результат всегда музыкален; детерминизм от `seed`.
 *
 * Модуль работает только с Web Audio: в headless-смоуках `audioCtx()` даёт
 * null и все проигрыватели превращаются в no-op.
 */
import seedrandom from 'seedrandom'
import type { MusicDoc, MusicLayer, MusicScale, SoundDoc } from './types'

// ─────────────── AudioContext (лениво, после первого жеста) ───────────────

let ctx: AudioContext | null = null
let broken = false

export function audioCtx(): AudioContext | null {
  if (broken) return null
  if (typeof window === 'undefined') return null
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) {
        broken = true
        return null
      }
      ctx = new AC()
    }
    return ctx
  } catch {
    broken = true
    return null
  }
}

/** расблокировать звук по первому клику (политика автоплея) */
export function unlockAudio(): void {
  const c = audioCtx()
  if (c && c.state === 'suspended') void c.resume()
}

/** сгладить промахи планировщика и щелчки старта/остановки */
export function fadeGain(g: GainNode, to: number, sec: number): void {
  const t = g.context.currentTime
  g.gain.cancelScheduledValues(t)
  g.gain.setValueAtTime(g.gain.value, t)
  g.gain.linearRampToValueAtTime(Math.max(0, to), t + Math.max(0.01, sec))
}

// ─────────────── SoundDoc (ZzFX-стиль) ───────────────

/**
 * Порядок параметров `zzfx` (как в zzfx/jsfxr, упрощённо):
 * 0 volume, 1 randomness, 2 frequency (Hz), 3 attack (сек), 4 sustain (сек),
 * 5 decay (сек), 6 shape (0 синус, 1 квадрат, 2 пила, 3 треугольник, 4 шум),
 * 7 shapeCurve (скважность/изгиб), 8 slide (полутона/сек), 9 deltaSlide,
 * 10 pitchJump (полутона), 11 pitchJumpTime (сек), 12 repeatTime (сек),
 * 13 noise (0…1), 14 modulation (FM), 15 bitCrush (0 = нет),
 * 16 delay (сек эха), 17 sustainVolume (0…1), 18 decayCurve, 19 clip (0…1)
 */
const sfxCache = new Map<string, AudioBuffer>()

export function renderSoundDoc(c: AudioContext, doc: SoundDoc): AudioBuffer {
  const key = JSON.stringify(doc.zzfx)
  const hit = sfxCache.get(key)
  if (hit) return hit

  const p = doc.zzfx ?? []
  const n = (i: number, d: number) => (typeof p[i] === 'number' && Number.isFinite(p[i]) ? p[i] : d)
  const vol = clamp(n(0, 1), 0, 1)
  const random = n(1, 0.05)
  const freq0 = Math.max(20, n(2, 220))
  const attack = Math.max(0, n(3, 0))
  const sustain = Math.max(0, n(4, 0))
  const decay = Math.max(0.01, n(5, 0.1))
  const shape = Math.max(0, Math.min(4, Math.round(n(6, 0))))
  const curve = n(7, 1)
  const slide = n(8, 0)
  const deltaSlide = n(9, 0)
  const pitchJump = n(10, 0)
  const pitchJumpTime = n(11, 0)
  const repeatTime = n(12, 0)
  const noiseAmt = clamp(n(13, 0), 0, 1)
  const fm = n(14, 0)
  const bitCrush = Math.round(n(15, 0))
  const delaySec = n(16, 0)
  const sustainVol = clamp(n(17, 0.7), 0, 1)
  const decayCurve = n(18, 1)
  const clip = clamp(n(19, 0), 0, 1)

  const sr = c.sampleRate
  const envLen = attack + sustain + decay
  const repeats = repeatTime > 0 ? Math.max(1, Math.min(12, Math.round(envLen / repeatTime))) : 1
  const total = envLen * repeats + (delaySec > 0 ? delaySec * 3 : 0) + 0.02
  const len = Math.max(1, Math.ceil(total * sr))
  const buf = c.createBuffer(1, len, sr)
  const out = buf.getChannelData(0)

  // детерминированная «случайность» — буфер воспроизводим и кэшируем
  const rnd = seedrandom(`zzfx:${key}`)
  const freqJitter = 1 + (rnd() * 2 - 1) * random
  let phase = 0
  let echo: number[] = delaySec > 0 ? new Array(Math.ceil(delaySec * sr)).fill(0) : []
  const echoAt = echo.length

  for (let i = 0; i < len; i++) {
    const tGlobal = i / sr
    const t = repeatTime > 0 ? tGlobal % repeatTime : tGlobal
    const tIn = repeatTime > 0 ? tGlobal / repeatTime : 0 // номер повтора (для фазы)

    // огибающая
    let env: number
    if (t < attack) env = attack > 0 ? t / attack : 1
    else if (t < attack + sustain) env = sustainVol + (1 - sustainVol) * 0.15
    else {
      const dt = (t - attack - sustain) / decay
      env = dt >= 1 ? 0 : sustainVol * Math.pow(1 - dt, 0.5 + decayCurve * 2)
    }
    if (env <= 0 && repeatTime <= 0 && t > attack + sustain + decay) {
      out[i] = 0
      continue
    }

    // частотная огибающая
    let f = freq0 * freqJitter * Math.pow(2, (slide * t + 0.5 * deltaSlide * t * t) / 12)
    if (t >= pitchJumpTime && pitchJumpTime > 0) f *= Math.pow(2, pitchJump / 12)
    if (t >= pitchJumpTime + 0.08 && pitchJumpTime > 0) f /= Math.pow(2, pitchJump / 12)
    if (fm) f *= 1 + fm * Math.sin(2 * Math.PI * f * 2 * t)

    phase += (2 * Math.PI * f) / sr
    if (repeatTime > 0 && tGlobal > 0 && t < tIn * 0) void 0 // фаза течёт непрерывно

    // форма волны
    const ph = phase % (2 * Math.PI)
    const norm = ph / (2 * Math.PI)
    let s: number
    switch (shape) {
      case 1:
        s = norm < clamp(0.1 + curve * 0.4, 0.02, 0.98) ? 1 : -1
        break
      case 2:
        s = 2 * norm - 1
        break
      case 3:
        s = norm < 0.5 ? 4 * norm - 1 : 3 - 4 * norm
        break
      case 4:
        s = rnd() * 2 - 1
        break
      default:
        s = Math.sin(ph)
    }
    if (noiseAmt > 0) s = s * (1 - noiseAmt) + (rnd() * 2 - 1) * noiseAmt

    let v = s * env * vol
    if (bitCrush > 0) {
      const q = Math.pow(2, Math.max(1, 16 - bitCrush)) / 32768
      v = Math.round(v / q) * q
    }
    if (clip > 0) v = Math.max(-clip, Math.min(clip, v)) * (clip > 0 ? 1 / Math.max(clip, 0.2) : 1) * clip

    if (echoAt > 0) {
      const d = i - echoAt
      v += (echo[d % echoAt] ?? 0) * 0.35
      echo[i % echoAt] = v
    }
    out[i] = Math.max(-1, Math.min(1, v))
  }

  sfxCache.set(key, buf)
  return buf
}

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v))
}

/** это MusicDoc (синтез), а не файл/ссылка? */
export function isMusicDoc(v: unknown): v is MusicDoc {
  return !!v && typeof v === 'object' && typeof (v as MusicDoc).mood === 'string' && Array.isArray((v as MusicDoc).layers)
}

// ─────────────── MusicDoc: генеративный бесшовный луп ───────────────

const SCALES: Record<MusicScale, number[]> = {
  'минор': [0, 2, 3, 5, 7, 8, 10],
  'мажор': [0, 2, 4, 5, 7, 9, 11],
  'дорийский': [0, 2, 3, 5, 7, 9, 10],
  'фригийский': [0, 1, 3, 5, 7, 8, 10],
  'пентатоника': [0, 3, 5, 7, 10],
}

const MOOD_DEFAULTS: Record<MusicDoc['mood'], { tempo: number; key: string; progression: string[]; cutoff: number }> = {
  'спокойная': { tempo: 66, key: 'G', progression: ['i', 'VI', 'III', 'VII'], cutoff: 1400 },
  'тревожная': { tempo: 96, key: 'D', progression: ['i', 'VII', 'VI', 'VII'], cutoff: 1100 },
  'боевая': { tempo: 138, key: 'E', progression: ['i', 'i', 'VII', 'VI'], cutoff: 2200 },
  'торжественная': { tempo: 72, key: 'C', progression: ['i', 'IV', 'VI', 'V'], cutoff: 1800 },
  'таинственная': { tempo: 58, key: 'A', progression: ['i', 'iv', 'VII', 'i'], cutoff: 900 },
}

const ROMAN: Record<string, number> = { i: 0, ii: 1, iii: 2, iv: 3, v: 4, vi: 5, vii: 6 }

/** "C", "F#", "Bb" → полутон (0…11) */
export function keySemitone(key: string): number {
  const k = key.trim().toUpperCase().replace('Ё', 'Е')
  const letter = k[0] ?? 'C'
  const base: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
  let s = base[letter] ?? 0
  if (k.includes('#') || k.includes('♯') || k.toLowerCase().includes('is')) s += 1
  if (k.includes('B') && k.length > 1 && k[1] === 'B') s -= 1 // Bb
  if (k.includes('♭') || k.toLowerCase().includes('es')) s -= 1
  return ((s % 12) + 12) % 12
}

/** ступень гаммы (0..6+) → midi-нота вокруг базовой октавы */
function degreeMidi(scale: number[], rootSemitone: number, degree: number, octave: number): number {
  const n = scale.length
  const oct = Math.floor(degree / n)
  const idx = ((degree % n) + n) % n
  return 48 + rootSemitone + scale[idx] + 12 * (oct + octave)
}

function midiFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

function parseRoman(list: string[] | undefined, fallback: string[]): number[] {
  const src = list && list.length ? list : fallback
  return src.map((r) => {
    const v = ROMAN[r.toLowerCase()]
    return v === undefined ? 0 : v
  })
}

export interface MusicHandle {
  /** плавно затухнуть и остановить (кроссфейд — снаружи) */
  stop(fadeSec?: number): void
  /** подстроить громкость (настройки игрока) */
  setVolume(v: number): void
}

/**
 * Собрать бесшовный эмбиент-луп из MusicDoc: пад-аккорды, арпеджио, бас,
 * перкуссия — по гамме, аккорды из progression, всё от seed.
 * Старт — с плавным нарастанием громкости (кроссфейд при смене треков).
 */
export function startMusicDoc(c: AudioContext, doc: MusicDoc, volume: number): MusicHandle {
  const moodDef = MOOD_DEFAULTS[doc.mood] ?? MOOD_DEFAULTS['спокойная']
  const tempo = Math.max(30, Math.min(220, doc.tempo ?? moodDef.tempo))
  const scale = SCALES[doc.scale] ?? SCALES['минор']
  const root = keySemitone(doc.key ?? moodDef.key)
  const degrees = parseRoman(doc.progression, moodDef.progression)
  const layers = new Set<MusicLayer>(doc.layers?.length ? doc.layers : ['пад-аккорды', 'бас'])
  const rnd = seedrandom(`music:${doc.seed ?? 0}:${doc.mood}`)
  const barSec = (60 / tempo) * 4
  const cutoff = moodDef.cutoff

  const master = c.createGain()
  master.gain.value = 0
  master.gain.linearRampToValueAtTime(Math.max(0, volume), c.currentTime + 1.2)
  const filter = c.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = cutoff
  filter.Q.value = 0.6
  filter.connect(master)
  master.connect(c.destination)

  const noiseBuf = c.createBuffer(1, Math.ceil(c.sampleRate * 0.4), c.sampleRate)
  const nd = noiseBuf.getChannelData(0)
  for (let i = 0; i < nd.length; i++) nd[i] = rnd() * 2 - 1

  // паттерн арпеджио/перкуссии от seed — стабилен внутри трека
  const arpPattern = Array.from({ length: 8 }, () => Math.floor(rnd() * 5)) // 0…4 ступени аккорда
  const hatPattern = Array.from({ length: 8 }, () => rnd())

  let bar = 0
  let stopped = false
  const sources: Array<OscillatorNode | AudioBufferSourceNode> = []

  const scheduleBar = (when: number): void => {
    const deg = degrees[bar % degrees.length]
    const chord = [degreeMidi(scale, root, deg, 0), degreeMidi(scale, root, deg + 2, 0), degreeMidi(scale, root, deg + 4, 0)]
    const rootMidi = degreeMidi(scale, root, deg, -1)

    if (layers.has('пад-аккорды')) {
      for (const m of chord) {
        for (const detune of [-4, 3]) {
          const o = c.createOscillator()
          o.type = 'triangle'
          o.frequency.value = midiFreq(m)
          o.detune.value = detune
          const g = c.createGain()
          g.gain.setValueAtTime(0.0001, when)
          g.gain.linearRampToValueAtTime(0.05, when + barSec * 0.25)
          g.gain.setValueAtTime(0.05, when + barSec * 0.7)
          g.gain.linearRampToValueAtTime(0.0001, when + barSec * 1.05)
          o.connect(g)
          g.connect(filter)
          o.start(when)
          o.stop(when + barSec * 1.1)
          sources.push(o)
        }
      }
    }

    if (layers.has('бас')) {
      for (const beat of [0, 2]) {
        const o = c.createOscillator()
        o.type = 'sine'
        o.frequency.value = midiFreq(rootMidi)
        const g = c.createGain()
        const t0 = when + (beat * barSec) / 4
        g.gain.setValueAtTime(0.0001, t0)
        g.gain.linearRampToValueAtTime(0.11, t0 + 0.03)
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + barSec * 0.45)
        o.connect(g)
        g.connect(filter)
        o.start(t0)
        o.stop(t0 + barSec * 0.5)
        sources.push(o)
      }
    }

    if (layers.has('арпеджио')) {
      for (let i = 0; i < 8; i++) {
        const tone = chord[arpPattern[i] % 3] + 12 * (arpPattern[i] >= 3 ? 1 : 0)
        const o = c.createOscillator()
        o.type = 'square'
        o.frequency.value = midiFreq(tone)
        const g = c.createGain()
        const t0 = when + (i * barSec) / 8
        g.gain.setValueAtTime(0.0001, t0)
        g.gain.linearRampToValueAtTime(0.028, t0 + 0.01)
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + barSec / 8 + 0.05)
        o.connect(g)
        g.connect(filter)
        o.start(t0)
        o.stop(t0 + barSec / 8 + 0.08)
        sources.push(o)
      }
    }

    if (layers.has('перкуссия')) {
      for (let i = 0; i < 8; i++) {
        const t0 = when + (i * barSec) / 8
        if (i % 4 === 0) {
          // кик
          const o = c.createOscillator()
          o.type = 'sine'
          o.frequency.setValueAtTime(140, t0)
          o.frequency.exponentialRampToValueAtTime(45, t0 + 0.1)
          const g = c.createGain()
          g.gain.setValueAtTime(0.12, t0)
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12)
          o.connect(g)
          g.connect(master)
          o.start(t0)
          o.stop(t0 + 0.14)
          sources.push(o)
        } else if (hatPattern[i] > 0.55) {
          // хэт
          const src = c.createBufferSource()
          src.buffer = noiseBuf
          const g = c.createGain()
          g.gain.setValueAtTime(0.03, t0)
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.04)
          const hp = c.createBiquadFilter()
          hp.type = 'highpass'
          hp.frequency.value = 5000
          src.connect(hp)
          hp.connect(g)
          g.connect(master)
          src.start(t0)
          src.stop(t0 + 0.05)
          sources.push(src)
        }
      }
    }
    bar++
  }

  // планировщик с забегом: луп никогда не «замирает» между тактами
  let nextBarAt = c.currentTime + 0.08
  scheduleBar(nextBarAt)
  nextBarAt += barSec
  const timer = setInterval(() => {
    if (stopped) return
    while (nextBarAt < c.currentTime + 0.6) {
      scheduleBar(nextBarAt)
      nextBarAt += barSec
    }
  }, 120)

  return {
    stop(fadeSec = 1.75) {
      if (stopped) return
      stopped = true
      clearInterval(timer)
      fadeGain(master, 0, fadeSec)
      const stopAt = c.currentTime + fadeSec + 0.1
      for (const s of sources) {
        try {
          s.stop(stopAt)
        } catch {
          /* уже остановлен */
        }
      }
      setTimeout(() => {
        try {
          master.disconnect()
        } catch {
          /* нет */
        }
      }, (fadeSec + 0.3) * 1000)
    },
    setVolume(v: number) {
      fadeGain(master, Math.max(0, v), 0.15)
    },
  }
}
