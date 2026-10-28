/**
 * Перенос и починка сохранений (`docs/compatibility.md`, фаза A).
 *
 * Два независимых механизма:
 *
 * 1. **Миграции формата** (`SAVE_MIGRATIONS`) — движок обновился, форма
 *    `GameState` изменилась. Цепочка шагов «vN → vN+1», только вверх; шаги
 *    никогда не удаляются, поэтому сейв любой поддерживаемой версии
 *    доезжает до текущей.
 * 2. **Починка ссылок** (`repairState`) — кампания обновилась, а сейв
 *    ссылается на то, чего в ней больше нет (предмет, НПС, стадия квеста,
 *    сцена). Сейв не отбрасывается: битые ссылки убираются, игрок получает
 *    отчёт по-русски.
 *
 * Правило проекта: **чужое сохранение не удаляется молча**. Перед первой
 * правкой сейва его исходник копируется в резервный ключ, а «Продолжить»
 * никогда не исчезает без объяснения причины.
 */

import type {
  CampaignData,
  CampaignMeta,
  GameState,
  SaveEnvelope,
  SaveNote,
  SaveReport,
} from '../shared/types'
export type { SaveEnvelope, SaveNote, SaveReport }
import { SAVE_ENVELOPE_VERSION, SAVE_VERSION } from '../shared/types'
import { ENGINE_VERSION } from '../shared/versions'
import { allLocations } from '../shared/migrate'
import { compareVersions } from '../shared/versions'
import { OLDEST_SAVE_VERSION, SAVE_MIGRATIONS, migrateState, repairState } from './save'
import type { ReportCtx } from './save'

export { OLDEST_SAVE_VERSION, SAVE_MIGRATIONS, migrateState, repairState }
export type { ReportCtx, SaveMigration } from './save'

export function saveKey(campaignId: string): string {
  return `narthex:save:${campaignId}`
}

/** Резервная копия сейва до первой правки (миграция/починка). */
export function backupKey(campaignId: string): string {
  return `narthex:save-backup:${campaignId}`
}

// ───────────────────────── слоты сохранений (аудит §5.6 п.9) ─────────────────────────

/**
 * 'auto' — привычный автосейв (старый ключ, совместимость сохранена);
 * число — ручной слот игрока.
 */
export type SaveSlot = number | 'auto'

/** Верх слотов, который движок вообще умеет показывать (мастер — `meta.save_slots`). */
export const MAX_SAVE_SLOTS = 5

/** Ключ хранилища для слота: автосейв — старый общий ключ кампании. */
export function slotKey(campaignId: string, slot: SaveSlot = 'auto'): string {
  return slot === 'auto' ? saveKey(campaignId) : `narthex:save:${campaignId}@${slot}`
}

/** Резерв слота (до первой правки). */
export function slotBackupKey(campaignId: string, slot: SaveSlot = 'auto'): string {
  return slot === 'auto' ? backupKey(campaignId) : `${slotKey(campaignId, slot)}-backup`
}

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

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeRaw(key: string, text: string): boolean {
  try {
    localStorage.setItem(key, text)
    return true
  } catch {
    return false
  }
}

// ─────────────────────────── отчёт ───────────────────────────

function makeCtx(): ReportCtx {
  const notes: SaveNote[] = []
  return {
    notes,
    note(kind, text) {
      // одна и та же строка дважды не показывается
      if (!notes.some((n) => n.kind === kind && n.text === text)) notes.push({ kind, text })
    },
  }
}

// ─────────────────────────── обёртка сохранения ───────────────────────────

/** Разбор того, что лежит в хранилище: обёртка или «голое» состояние старой версии. */
export function parseStored(raw: string): SaveEnvelope | null {
  const data = JSON.parse(raw) as Partial<SaveEnvelope> & Partial<GameState>
  if (!data || typeof data !== 'object') return null
  if (typeof data.envelope_version === 'number' && data.state && typeof data.state === 'object') {
    return data as SaveEnvelope
  }
  // старый формат: GameState лежал в хранилище сам по себе
  const state = data as GameState
  if (!state.player || typeof state.player !== 'object') return null
  return {
    envelope_version: SAVE_ENVELOPE_VERSION,
    save_version: state.save_version ?? OLDEST_SAVE_VERSION,
    campaign_id: state.campaign_id ?? '',
    campaign_version: undefined,
    engine_version: undefined,
    state,
  }
}

export function makeEnvelope(state: GameState, campaignId: string, campaignVersion: string | undefined, prev?: SaveEnvelope): SaveEnvelope {
  const now = new Date().toISOString()
  return {
    envelope_version: SAVE_ENVELOPE_VERSION,
    save_version: SAVE_VERSION,
    campaign_id: campaignId,
    campaign_version: campaignVersion,
    engine_version: ENGINE_VERSION,
    created_at: prev?.created_at ?? now,
    updated_at: now,
    tick: state.tick,
    location: state.location,
    state,
  }
}

export type SaveVerdict =
  | { kind: 'ok'; repaired: boolean }
  | {
      kind: 'unsupported'
      reason: string
      /** версия кампании, на которой сделано сохранение */
      save_version?: string
      /** с какой версии кампании сохранения поддерживаются */
      base_version?: string
    }
  | { kind: 'too_old'; reason: string }

export interface OpenedSave {
  state: GameState
  envelope: SaveEnvelope
  report: SaveReport
  verdict: SaveVerdict
}

/**
 * Вердикт по версиям кампании: поддерживает ли текущая кампания сейв.
 * `save_base_version` не объявлен — поддерживаем всё (сейв будет починен).
 */
export function checkSaveVersion(saveCampaignVersion: string | undefined, meta: CampaignMeta): SaveVerdict {
  const base = meta.save_base_version
  if (!base) return { kind: 'ok', repaired: false }
  // Сейв без версии кампании — это сохранение, сделанное до введения обёртки.
  // Отбрасывать его нельзя (политика «чиним, а не выбрасываем»): считаем
  // совместимым, починка ссылок разберётся с расхождениями, а версия
  // запишется при первом же автосейве.
  if (!saveCampaignVersion) return { kind: 'ok', repaired: false }
  if (compareVersions(saveCampaignVersion, base) >= 0) return { kind: 'ok', repaired: false }
  return {
    kind: 'unsupported',
    save_version: saveCampaignVersion,
    base_version: base,
    reason: `Сохранение сделано в версии кампании ${saveCampaignVersion}, а поддерживаются сохранения начиная с ${base}.`,
  }
}

/**
 * Разбор + перенос + вердикт + починка — БЕЗ записи в хранилище.
 * Нужно, чтобы UI мог спросить «можно ли продолжить?» без побочных эффектов.
 */
export function inspectSave(campaignId: string, campaign: CampaignData, slot: SaveSlot = 'auto'): OpenedSave | null {
  const raw = readRaw(slotKey(campaignId, slot))
  if (!raw) return null
  const ctx = makeCtx()
  const report: SaveReport = { from_version: 0, to_version: SAVE_VERSION, notes: ctx.notes, repaired: false }

  let envelope: SaveEnvelope | null = null
  try {
    envelope = parseStored(raw)
  } catch {
    envelope = null
  }
  if (!envelope) {
    return {
      state: null as unknown as GameState,
      envelope: null as unknown as SaveEnvelope,
      report: { ...report, notes: [{ kind: 'warning', text: 'Сохранение повреждено и не читается.' }] },
      verdict: { kind: 'too_old', reason: 'Файл сохранения повреждён.' },
    }
  }

  const state = envelope.state
  // обёртка — источник правды: сейв из более нового движка обязан быть
  // распознан как «новее», даже если само состояние помечено старой версией
  if (typeof envelope.save_version === 'number') state.save_version = envelope.save_version
  report.from_version = state.save_version ?? OLDEST_SAVE_VERSION
  report.campaign_version = envelope.campaign_version

  const verdictVersion = checkSaveVersion(envelope.campaign_version, campaign.meta)
  if (verdictVersion.kind === 'unsupported') {
    // не чиним и не перезаписываем: сейв остаётся как есть (для отката версии кампании)
    return {
      state,
      envelope,
      report: { ...report, notes: [{ kind: 'warning', text: verdictVersion.reason }] },
      verdict: verdictVersion,
    }
  }

  if (!migrateState(state, ctx)) {
    const reason =
      (state.save_version ?? 0) > SAVE_VERSION
        ? `Сохранение сделано более новым движком (формат в${state.save_version}, этот движок понимает до в${SAVE_VERSION}).`
        : `Сохранение слишком старое (формат в${report.from_version}, поддерживается с в${OLDEST_SAVE_VERSION}).`
    return { state, envelope, report: { ...report, notes: [...ctx.notes, { kind: 'warning', text: reason }] }, verdict: { kind: 'too_old', reason } }
  }

  repairState(state, campaign, ctx)
  report.repaired = ctx.notes.some((n) => n.kind === 'repaired')

  return { state, envelope, report, verdict: { kind: 'ok', repaired: report.repaired } }
}

/**
 * Открытие сохранения для игры: `inspectSave` + запись результата.
 * Ничего не удаляет; перед первой правкой исходник копируется в резервный ключ.
 */
export function openSave(campaignId: string, campaign: CampaignData, slot: SaveSlot = 'auto'): OpenedSave | null {
  const opened = inspectSave(campaignId, campaign, slot)
  if (!opened || opened.verdict.kind !== 'ok') return opened
  const raw = readRaw(slotKey(campaignId, slot))
  const changed = opened.report.notes.length > 0 || opened.report.from_version !== SAVE_VERSION || !opened.envelope.campaign_version
  if (!changed || !raw) return opened
  // резервная копия — только если её ещё нет (первая правка этого сейва)
  if (!readRaw(slotBackupKey(campaignId, slot))) writeRaw(slotBackupKey(campaignId, slot), raw)
  const next = makeEnvelope(opened.state, campaignId, campaign.meta.version, opened.envelope)
  if (writeRaw(slotKey(campaignId, slot), JSON.stringify(next))) opened.envelope = next
  return opened
}

/** Запись сохранения (обёртка + состояние). */
export function writeSave(campaignId: string, state: GameState, campaignVersion: string | undefined, prev?: SaveEnvelope, slot: SaveSlot = 'auto'): SaveEnvelope | null {
  const envelope = makeEnvelope(state, campaignId, campaignVersion, prev)
  return writeRaw(slotKey(campaignId, slot), JSON.stringify(envelope)) ? envelope : null
}

/**
 * Есть ли сохранение, которое этот движок в принципе может открыть
 * (без кампании: только формат). Для полного вердикта — `openSave`.
 */
export function peekSave(campaignId: string, slot: SaveSlot = 'auto'): SaveEnvelope | null {
  const raw = readRaw(slotKey(campaignId, slot))
  if (!raw) return null
  try {
    const env = parseStored(raw)
    if (!env) return null
    const v = env.save_version ?? env.state.save_version ?? OLDEST_SAVE_VERSION
    if (v < OLDEST_SAVE_VERSION || v > SAVE_VERSION) return null
    return env
  } catch {
    return null
  }
}

/**
 * Убрать сейв с активного ключа в резервный перед новым забегом.
 *
 * Нужно, когда сохранение не поддержалось (вердикт `unsupported`/`too_old`):
 * новый забег пишет в тот же ключ, а обещание игроку — «старое сохранение не
 * удалено, оно откроется после возврата к прежней версии кампании».
 * Возвращает true, если сейв был и его удалось сохранить.
 */
export function preserveSave(campaignId: string, slot: SaveSlot = 'auto'): boolean {
  const raw = readRaw(slotKey(campaignId, slot))
  if (!raw) return false
  const kept = readRaw(slotBackupKey(campaignId, slot)) ? true : writeRaw(slotBackupKey(campaignId, slot), raw)
  if (!kept) return false
  try {
    localStorage.removeItem(slotKey(campaignId, slot))
  } catch {
    return false
  }
  return true
}

export function removeSave(campaignId: string, slot: SaveSlot = 'auto'): void {
  try {
    localStorage.removeItem(slotKey(campaignId, slot))
    localStorage.removeItem(slotBackupKey(campaignId, slot))
  } catch {
    /* приватный режим и т.п. */
  }
}

/**
 * Состояние из хранилища с переносом формата, но без кампании и без записи.
 * Для проверок вида «есть ли сейв» и для headless-смоуков.
 */
export function loadState(campaignId: string, slot: SaveSlot = 'auto'): GameState | null {
  const raw = readRaw(slotKey(campaignId, slot))
  if (!raw) return null
  try {
    const env = parseStored(raw)
    if (!env) return null
    const ctx = makeCtx()
    if (!migrateState(env.state, ctx)) return null
    return env.state
  } catch {
    return null
  }
}

/** Текст для экспорта сохранения игроком («шлюпка спасения»). */
export function exportSaveText(campaignId: string, slot: SaveSlot = 'auto'): string | null {
  return readRaw(slotKey(campaignId, slot))
}

/** Импорт сохранения: принимается и обёртка, и «голое» состояние. */
export function importSaveText(campaignId: string, text: string, slot: SaveSlot = 'auto'): boolean {
  try {
    const env = parseStored(text)
    if (!env) return false
    return writeRaw(slotKey(campaignId, slot), JSON.stringify(env))
  } catch {
    return false
  }
}
