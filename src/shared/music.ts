/**
 * Музыкальный плеер-синглтон (итерация 8, блок H2).
 *
 * На каждый `notify()` движка (и при выходе в меню) вычисляется, «что должно
 * звучать», по стеку приоритетов (сверху вниз):
 *
 *   катсцена → бой (arena.music → трек боя кампании) → сцена → локация
 *   (по условиям) → трек кампании по умолчанию → тишина
 *
 * Смена результата — кроссфейд 1.5–2 с; тот же результат — ничего не делаем
 * (переходы между сценами одной локации музыку не дёргают). `tracks` — всегда
 * список: один трек — луп, несколько — плейлист (по порядку или shuffle без
 * повтора подряд) со сменой треков. Музыка катсцены — забота CutscenePlayer.
 * Автоплей — после первого клика (unlockAudio).
 */
import type { GameEngine } from '../core/engine'
import type { LocationDef, MusicCondition, MusicDoc, MusicRule, MusicSource, TimeOfDay } from './types'
import { audioCtx, isMusicDoc, startMusicDoc, unlockAudio, type MusicHandle } from './synth'
import { getSettings, musicVolume } from './settings'
import { migrateMusicRules } from './migrate'
import { timeOfDay } from '../core/time'

/** длительность «куплета» генеративного трека внутри плейлиста, сек */
const DOC_IN_PLAYLIST_SEC = 48
const FADE = 1.75

export interface TrackHandle {
  stop(fadeSec?: number): void
  setVolume(v: number): void
}

/** один трек: MusicDoc → генеративный луп; иначе файл/ссылка (loop или onEnded) */
export function startTrackSource(src: MusicSource, volume: number, loop: boolean, onEnded?: () => void): TrackHandle {
  unlockAudio()
  const c = audioCtx()
  if (isMusicDoc(src)) {
    if (!c) return { stop: () => undefined, setVolume: () => undefined }
    if (c.state === 'suspended') void c.resume()
    const h: MusicHandle = startMusicDoc(c, src as MusicDoc, volume)
    if (!loop && onEnded) {
      // генеративный трек в плейлисте — модульными кусками
      const t = setTimeout(onEnded, DOC_IN_PLAYLIST_SEC * 1000)
      const origStop = h.stop.bind(h)
      return {
        stop: (f = FADE) => {
          clearTimeout(t)
          origStop(f)
        },
        setVolume: (v) => h.setVolume(v),
      }
    }
    return { stop: (f = FADE) => h.stop(f), setVolume: (v) => h.setVolume(v) }
  }
  const url = typeof src === 'string' ? src : ''
  if (!url || typeof Audio === 'undefined') return { stop: () => undefined, setVolume: () => undefined }
  const a = new Audio(url)
  a.loop = loop
  a.volume = 0
  if (!loop && onEnded) a.onended = onEnded
  void a.play().catch(() => undefined)
  const fadeTimer = setInterval(() => {
    a.volume = Math.min(volume, a.volume + Math.max(volume, 0.01) / 24)
    if (a.volume >= volume) clearInterval(fadeTimer)
  }, (FADE * 1000) / 24)
  return {
    stop: (f = FADE) => {
      clearInterval(fadeTimer)
      a.onended = null
      const steps = 14
      let i = 0
      const from = a.volume
      const t = setInterval(() => {
        i++
        a.volume = Math.max(0, from * (1 - i / steps))
        if (i >= steps) {
          clearInterval(t)
          a.pause()
        }
      }, (f * 1000) / steps)
    },
    setVolume: (v) => {
      a.volume = Math.max(0, Math.min(1, v))
    },
  }
}

// ─────────────── состояние плеера ───────────────

interface PlayerState {
  key: string
  tracks: string[]
  shuffle: boolean
  order: number[]
  pos: number
  handle: TrackHandle | null
  advanceTimer: ReturnType<typeof setTimeout> | null
}

let cur: PlayerState | null = null
let menuMode = false

export function setMenuMode(on: boolean): void {
  if (menuMode === on) return
  menuMode = on
  refreshMusic(null)
}

let currentCampaignBase = ''
function absolute(u: string): string {
  return /^(https?:)?\/\//i.test(u) || /^(data:|blob:)/i.test(u) ? u : `${currentCampaignBase}/${u}`
}

/** Привязать путь локального трека к кампании; URL и генеративные треки не меняются. */
export function resolveMusicSource(src: MusicSource): MusicSource {
  return typeof src === 'string' && src ? absolute(src) : src
}

function resolveTrack(id: string): { src: MusicSource; volume: number; loop: boolean } | null {
  // id из реестра music_tracks; иначе — прямая ссылка/файл (легаси)
  const doc = currentCampaign?.meta.music_tracks?.find((t) => t.id === id)
  if (doc) return { src: resolveMusicSource(doc.src), volume: doc.volume ?? 1, loop: doc.loop !== false }
  if (/^https?:|^(https?:)?\/\//i.test(id) || /^data:|^blob:|^assets\//i.test(id)) {
    return { src: resolveMusicSource(id), volume: 1, loop: true }
  }
  return null
}

let currentCampaign: GameEngine['campaign'] | null = null

/** привязать кампанию при загрузке (иначе меню без движка молчит) */
export function setMusicCampaign(c: GameEngine['campaign'] | null): void {
  currentCampaign = c
  currentCampaignBase = c?.basePath ?? ''
}

// ─────────────── выбор «что должно звучать» ───────────────

function condOk(cond: MusicCondition | undefined, engine: GameEngine | null): boolean {
  if (!cond) return true
  if (cond.time_of_day !== undefined) {
    if (!engine) return false
    const tod: TimeOfDay = timeOfDay(engine.state.tick, engine.campaign.meta)
    const list = Array.isArray(cond.time_of_day) ? cond.time_of_day : [cond.time_of_day]
    if (!list.includes(tod)) return false
  }
  if (cond.flag !== undefined && !engine?.state.flags[cond.flag]) return false
  if (cond.not_flag !== undefined && engine?.state.flags[cond.not_flag]) return false
  if (cond.weather !== undefined && (engine?.state.weather ?? '') !== cond.weather) return false
  return true
}

function firstMatching(rules: MusicRule[] | undefined, engine: GameEngine | null): MusicRule | null {
  for (const r of rules ?? []) {
    if ((r.conditions ?? []).every((c) => condOk(c, engine))) return r
  }
  return null
}

/** музыкальный «снимок» стека приоритетов */
function desiredRule(engine: GameEngine | null): { rule: MusicRule | null; stop: boolean } {
  if (!engine) {
    // главное меню звучит темой выбранной кампании
    const menuId = currentCampaign?.meta.ui_sounds?.['menu_music']
    return menuId ? { rule: { tracks: [menuId] }, stop: false } : { rule: null, stop: true }
  }
  if (engine.cutscene) return { rule: null, stop: true } // CutscenePlayer играет свою музыку
  if (engine.combat) {
    const arenaTrack = engine.combat.arena.music
    const tracks = arenaTrack ? [arenaTrack] : (currentCampaign?.meta.combat_music ?? [])
    return tracks.length ? { rule: { tracks }, stop: false } : { rule: null, stop: true }
  }
  const scene = currentCampaign?.scenes[engine.state.scene]
  const sceneRule = firstMatching(scene?.music, engine)
  if (sceneRule) return { rule: sceneRule, stop: false }
  const loc = findLoc(engine.state.location)
  const locRule = firstMatching(migrateMusicRules(loc?.music), engine)
  if (locRule) return { rule: locRule, stop: false }
  const def = currentCampaign?.meta.default_music ?? []
  return def.length ? { rule: { tracks: def }, stop: false } : { rule: null, stop: true }
}

function findLoc(id: string): LocationDef | undefined {
  const walk = (regions: GameEngine['campaign']['world']['regions']): LocationDef | undefined => {
    for (const r of regions) {
      const l = r.locations.find((x) => x.id === id)
      if (l) return l
      const sub = r.sub_regions ? walk(r.sub_regions) : undefined
      if (sub) return sub
    }
    return undefined
  }
  return currentCampaign ? walk(currentCampaign.world.regions) : undefined
}

function stopCurrent(fade = FADE): void {
  if (!cur) return
  if (cur.advanceTimer) clearTimeout(cur.advanceTimer)
  cur.handle?.stop(fade)
  cur = null
}

let duckFactor = 1.0

/**
 * Приглушение музыки при репликах с озвучкой / синтезатором речи (Audio Ducking).
 * @param active true — приглушить, false — вернуть обычную громкость
 * @param factor коэффициент громкости (по умолчанию 0.5 — приглушение на 50%)
 */
export function setMusicDucking(active: boolean, factor = 0.5): void {
  const nextFactor = active ? Math.max(0.05, Math.min(1, factor)) : 1.0
  if (duckFactor === nextFactor) return
  duckFactor = nextFactor
  applyMusicVolume()
}

function startTrackAt(state: PlayerState): void {
  const id = state.tracks[state.order[state.pos]]
  const t = id ? resolveTrack(id) : null
  state.handle?.stop(FADE)
  state.handle = null
  if (state.advanceTimer) clearTimeout(state.advanceTimer)
  state.advanceTimer = null
  if (!t) return
  const vol = musicVolume(getSettings()) * t.volume * duckFactor
  const multi = state.tracks.length > 1
  const adv = multi
    ? () => {
        if (cur !== state) return
        // shuffle: без повтора подряд
        if (state.shuffle && state.order.length > 1) {
          let j = Math.floor(Math.random() * state.order.length)
          while (state.order[j] === state.order[state.pos]) j = Math.floor(Math.random() * state.order.length)
          const tmp = state.order[(state.pos + 1) % state.order.length]
          state.order[(state.pos + 1) % state.order.length] = state.order[j]
          state.order[j] = tmp
        }
        state.pos = (state.pos + 1) % state.order.length
        startTrackAt(state)
      }
    : undefined
  state.handle = startTrackSource(t.src, vol, multi ? false : t.loop, adv)
}

/**
 * Пересчитать музыку по текущему состоянию. Вызывать на каждый notify
 * движка и при смене экрана (меню ↔ игра). Тот же результат — no-op.
 */
export function refreshMusic(engine: GameEngine | null): void {
  const campaign = engine?.campaign ?? currentCampaign
  if (campaign) {
    currentCampaign = campaign
    currentCampaignBase = campaign.basePath
  }
  const { rule, stop } = desiredRule(engine && !menuMode ? engine : null)
  if (stop || !rule || !rule.tracks.length) {
    stopCurrent()
    return
  }
  const key = JSON.stringify({ t: rule.tracks, s: !!rule.shuffle, m: menuMode, e: !!engine?.combat })
  if (cur && cur.key === key) return
  stopCurrent()

  const order = rule.tracks.map((_, i) => i)
  if (rule.shuffle) {
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[order[i], order[j]] = [order[j], order[i]]
    }
  }
  const state: PlayerState = { key, tracks: rule.tracks, shuffle: !!rule.shuffle, order, pos: 0, handle: null, advanceTimer: null }
  cur = state
  startTrackAt(state)
}

/** смена громкости в настройках — подстроить текущий трек */
export function applyMusicVolume(): void {
  if (!cur?.handle) return
  const id = cur.tracks[cur.order[cur.pos]]
  const t = id ? resolveTrack(id) : null
  cur.handle.setVolume(musicVolume(getSettings()) * (t?.volume ?? 1) * duckFactor)
}

export function stopMusic(fade = 0.5): void {
  stopCurrent(fade)
}
