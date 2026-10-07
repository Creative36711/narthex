/**
 * Мастерский сценарий разговора: текстовый формат, который мастер пишет
 * словами, а редактор переводит в структуру конструктора (.dlg.json) и ink.
 *
 * Принципы (фидбек 29, «полный текстовый сценарий»):
 *  • никаких id и никакого ink — только названия из реестров кампании;
 *  • строка = реплика собеседника; действие выделяется маркером `*`;
 *  • всё, что меняет мир, начинается со стрелки `→` и пишется по-русски
 *    («→ запомнить: Сделка с Вольтом»);
 *  • условия — строки `[если …]` / `[иначе]` перед блоком текста или вариантом;
 *  • варианты игрока — строки `? …`;
 *  • непонятное место — ошибка с номером строки и подсказкой, а не тихий сбой.
 *
 * Хранение: текст лежит в самом .dlg.json (поле script) рядом со структурой,
 * которую из него собрали. Формы и ink — равноправные виды того же документа.
 */

import type { DlgCheck, DlgChoice, DlgCond, DlgDoc, DlgEffect, DlgLine, DlgNode, DlgSection, DlgStep, MonolithDoc, SkillDifficulty } from '../shared/types'
import { DEFAULT_EMOTION } from '../shared/types'
import { makeId } from './ids'
import type { EditorStore } from './store'

// ─────────────── реестры кампании (название ⇄ id) ───────────────

export type ScriptRefKind =
  | 'flag' | 'item' | 'quest' | 'skill' | 'status' | 'weather' | 'npc'
  | 'disposition' | 'recipe' | 'codex' | 'cutscene' | 'need' | 'rule' | 'emotion'
  | 'scene' | 'arena'

export interface ScriptRefs {
  /** записи реестра: id + человеческая подпись */
  options(kind: ScriptRefKind): Array<{ id: string; label: string }>
  /** стадии квеста (для условия «квест на стадии») */
  stages(questId: string): Array<{ id: string; label: string }>
  /** подпись собеседника — для «→ торговля» без имени */
  npcDefault?: string
  /** как в кампании называется игровой тик («час», «день») */
  tickLabel: string
}

/** реестры берём из хранилища редактора: единый источник человеческих названий */
export function storeRefs(store: EditorStore, dlgPath: string): ScriptRefs {
  const npc = store.npcForDialogue(dlgPath)
  return {
    options: (kind) => store.options(kind),
    stages: (questId) => {
      const q = store.questPaths().map((p) => store.quest(p)).find((x) => x?.id === questId)
      return (q?.stages ?? []).map((st) => ({ id: st.id, label: st.label || st.id }))
    },
    npcDefault: npc?.id,
    tickLabel: store.meta.tick_label || 'тик',
  }
}

/**
 * Реестры для разбора сценария там, где редактора нет: импорт монолита от ИИ,
 * починка документов в архиве. Названия берём из самой кампании — правила
 * разбора те же, что и в редакторе (`storeRefs`).
 */
export function refsFromMonolith(doc: MonolithDoc, dialogueId?: string): ScriptRefs {
  const meta = doc.campaign
  const ents = Object.values(doc.entities ?? {})
  const byType = (t: string) => ents.filter((e) => e.type === t).map((e) => ({ id: e.id, label: e.label || e.id }))
  const npcs = byType('npc')
  const options = (kind: ScriptRefKind): Array<{ id: string; label: string }> => {
    switch (kind) {
      case 'flag': return (meta.flags ?? []).map((f) => ({ id: f.id, label: f.label || f.id }))
      case 'item': return byType('item')
      case 'npc': return npcs
      case 'quest': return Object.values(doc.quests ?? {}).map((q) => ({ id: q.id, label: q.label || q.id }))
      case 'skill': return (meta.skills ?? []).map((s) => ({ id: s.id, label: s.label || s.id }))
      case 'need': return (meta.needs ?? []).map((n) => ({ id: n.id, label: n.label || n.id }))
      case 'status': return (meta.statuses ?? []).map((s) => ({ id: s.id, label: s.label || s.id }))
      case 'weather': return [{ id: '', label: 'Ясно' }, ...(meta.weathers ?? []).map((w) => ({ id: w.id, label: w.label || w.id }))]
      case 'recipe': return Object.values(doc.recipes ?? {}).map((r) => ({ id: r.id, label: r.label || r.id }))
      case 'codex': return Object.values(doc.codex ?? {}).map((c) => ({ id: c.id, label: c.label || c.id }))
      case 'cutscene': return Object.values(doc.cutscenes ?? {}).map((c) => ({ id: c.id, label: c.label || c.id }))
      case 'rule': return Object.values(doc.rules ?? {}).map((r) => ({ id: r.id, label: r.label || r.id }))
      case 'emotion': return [{ id: DEFAULT_EMOTION.id, label: DEFAULT_EMOTION.label }, ...(meta.emotions ?? []).map((e) => ({ id: e.id, label: e.label || e.id }))]
      case 'scene': return Object.values(doc.scenes ?? {}).map((s) => ({ id: s.id, label: s.label || s.id }))
      case 'arena': return Object.values(doc.arenas ?? {}).map((a) => ({ id: a.id, label: a.label || a.id }))
      case 'disposition': return [
        ...(meta.factions ?? []).map((f) => ({ id: f.id, label: `${f.label || f.id} (фракция)` })),
        ...npcs.map((n) => ({ id: n.id, label: `${n.label} (NPC)` })),
      ]
    }
  }
  const owner = dialogueId
    ? ents.find((e) => e.type === 'npc' && (e as { dialogue?: string }).dialogue === `dialogues/${dialogueId}.ink`)
    : undefined
  return {
    options,
    stages: (questId) => (doc.quests?.[questId]?.stages ?? []).map((st) => ({ id: st.id, label: st.label || st.id })),
    npcDefault: owner?.id,
    tickLabel: meta.tick_label || 'тик',
  }
}

/**
 * Собрать структуру разговора из его текста (мастерский сценарий из документа
 * `.dlg.json`, в том числе пришедшего от ИИ или из архива). Правка идёт на
 * месте: возвращаем тот же объект документа.
 */
export function dlgDocFromScript(doc: DlgDoc, refs: ScriptRefs): { doc: DlgDoc; issues: ScriptIssue[] } {
  const res = scriptToDlg(doc.script ?? '', refs, { ...doc, nodes: doc.nodes ?? [] })
  doc.nodes = res.doc.nodes
  if (res.doc.label !== undefined) doc.label = res.doc.label
  return { doc, issues: res.issues }
}

/** счётчики хроники: ключи движка + человеческие подписи */
export const META_COUNTERS: Array<{ id: string; label: string }> = [
  { id: 'endings_seen', label: 'Увидено концовок' },
  { id: 'runs', label: 'Забегов' },
  { id: 'deaths', label: 'Смертей' },
  { id: 'victories', label: 'Побед' },
  { id: 'kills', label: 'Убийств' },
  { id: 'quests_completed', label: 'Выполнено квестов' },
  { id: 'ticks_survived', label: 'Прожито тиков' },
  { id: 'travels', label: 'Переходов' },
  { id: 'dialogues', label: 'Разговоров' },
]

const DIFFICULTY_WORDS: Array<{ words: string[]; value: SkillDifficulty }> = [
  { words: ['легко', 'просто', 'лёгкая', 'easy'], value: 'easy' },
  { words: ['обычно', 'нормально', 'обычная', 'normal'], value: 'normal' },
  { words: ['сложно', 'трудно', 'трудная', 'difficult', 'сложная'], value: 'difficult' },
  { words: ['невозможно', 'нереально', 'impossible'], value: 'impossible' },
]

const DIFFICULTY_TO_WORD: Record<string, string> = {
  easy: 'легко', normal: 'обычно', difficult: 'сложно', impossible: 'невозможно',
}

/** нормализация для сравнения названий: регистр, ё, знаки, подчёркивания */
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[«»"'`]/g, '')
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .trim()
}

interface Resolved {
  id: string
  label: string
}

function matchRef(list: Array<{ id: string; label: string }>, text: string): Resolved | null {
  const want = norm(text)
  if (!want) return null
  for (const o of list) if (norm(o.label) === want) return { id: o.id, label: o.label }
  for (const o of list) if (norm(o.id) === want) return { id: o.id, label: o.label }
  // подпись вида «Вольт (NPC)» — сравниваем и без уточнения в скобках
  for (const o of list) if (norm(o.label.replace(/\(.*?\)/g, '')) === want) return { id: o.id, label: o.label }
  return null
}

/** id → слова: `volt_deal` → «Volt deal» (служебный префикс отбрасываем) */
export function humanize(id: string): string {
  const noPrefix = id.replace(/^(flag|item|npc|rule|quest|codex|recipe|cs|cutscene|status|st|node|need)_/i, '')
  const s = noPrefix.replace(/[_-]+/g, ' ').trim()
  return s ? s[0].toUpperCase() + s.slice(1) : id
}

/** подпись для письма: из реестра, иначе человекочитаемый id */
export function refLabel(list: Array<{ id: string; label: string }>, id: string): string {
  const found = list.find((o) => o.id === id)
  if (found && found.label && found.label !== found.id) return found.label
  return humanize(found?.label ?? id)
}

/** список близких названий — подсказка при опечатке */
function suggest(list: Array<{ id: string; label: string }>, text: string, limit = 3): string {
  const want = norm(text)
  const scored = list
    .map((o) => {
      const l = norm(o.label)
      let score = 0
      if (l.startsWith(want) || want.startsWith(l)) score = 2
      else if (l.includes(want) || want.includes(l)) score = 1
      return { o, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => `«${x.o.label}»`)
  return scored.length ? ` Похожие: ${scored.join(', ')}.` : ''
}

const strip = (s: string) => s.replace(/^[«"']+|[»"']+$/g, '').trim()

// ─────────────── числа и сложность ───────────────

const OPERATORS: Array<{ re: RegExp; op: 'ge' | 'gt' | 'le' | 'lt' | 'eq' }> = [
  { re: /^(.+?)\s*(?:≥|>=|не меньше|не ниже)\s*(-?\d+)$/i, op: 'ge' },
  { re: /^(.+?)\s*(?:≤|<=|не больше|не выше)\s*(-?\d+)$/i, op: 'le' },
  { re: /^(.+?)\s*(?:>|больше|выше)\s*(-?\d+)$/i, op: 'gt' },
  { re: /^(.+?)\s*(?:<|меньше|ниже)\s*(-?\d+)$/i, op: 'lt' },
  { re: /^(.+?)\s*(?:=|==)\s*(-?\d+)$/i, op: 'eq' },
]

function splitOp(text: string): { head: string; op: 'ge' | 'gt' | 'le' | 'lt' | 'eq'; num: number } | null {
  for (const o of OPERATORS) {
    const m = text.match(o.re)
    if (m) return { head: m[1].trim(), op: o.op, num: Number(m[2]) }
  }
  return null
}

/** «+20», «−20», «20» → число со знаком */
export function parseSigned(value: string): number | null {
  const m = value.replace(/[−–—]/g, '-').match(/-?\d+(?:[.,]\d+)?/)
  if (!m) return null
  const n = Number(m[0].replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/** сложность проверки: число-порог или книжный уровень словом */
export function parseDifficulty(text: string): SkillDifficulty | null {
  const t = text.trim()
  if (!t) return null
  if (/^\d+$/.test(t)) return Number(t)
  const low = norm(t)
  for (const d of DIFFICULTY_WORDS) if (d.words.some((w) => norm(w) === low)) return d.value
  return null
}

export function difficultyText(d: SkillDifficulty): string {
  return typeof d === 'number' ? `≥ ${d}` : `— ${DIFFICULTY_TO_WORD[d] ?? d}`
}

// ─────────────── разбор: строки-помощники ───────────────

interface CondOut {
  cond: DlgCond | null
  error?: string
}

/** «выдать: Жетон бригады ×2» → предмет и количество */
function itemAndQty(value: string): { name: string; qty: number } {
  const m = value.match(/^(.*?)\s*(?:[×x*]\s*(\d+)|(\d+)\s*(?:шт\.?)?)$/i)
  if (m && m[1].trim()) return { name: m[1].trim(), qty: Number(m[2] ?? m[3]) || 1 }
  return { name: value.trim(), qty: 1 }
}

interface ParseCtx {
  refs: ScriptRefs
  newFlags: Array<{ id: string; label: string }>
  usedFlagIds: string[]
}

function ensureFlag(ctx: ParseCtx, label: string): { id: string; label: string } {
  const id = makeId('flag_', label, ctx.usedFlagIds)
  ctx.usedFlagIds.push(id)
  const rec = { id, label }
  ctx.newFlags.push(rec)
  return rec
}

/** одно условие из человеческой фразы */
function parseCondPhrase(raw: string, ctx: ParseCtx): CondOut {
  let text = raw.trim().replace(/^если\s*:?\s*/i, '').trim()
  if (!text) return { cond: null, error: 'пустое условие — напишите, что проверить, например «[если Сделка с Вольтом]»' }

  // отрицание в начале фразы: «нет: …», «не …»
  let not = false
  const notMatch = text.match(/^(?:нет|не)(?=[\s:]|$)[\s:]*(.*)$/i)
  if (notMatch) {
    not = true
    text = notMatch[1].trim()
  }

  const refs = ctx.refs
  const colon = text.match(/^([^:]{2,40}):\s*(.+)$/)
  if (colon) {
    const kind = norm(colon[1]).replace(/^(нет|не)\s+/, '')
    const value = colon[2].trim()
    switch (true) {
      case /^флаг/.test(kind): {
        const found = matchRef(refs.options('flag'), value)
        if (!found) return { cond: { type: 'flag', flag: ensureFlag(ctx, value).id, not: not || undefined } }
        return { cond: { type: 'flag', flag: found.id, not: not || undefined } }
      }
      case /^предметов/.test(kind): {
        const op = splitOp(value)
        const found = matchRef(refs.options('item'), op ? op.head : value)
        if (!found) return { cond: null, error: `не нашли предмет «${op ? op.head : value}».${suggest(refs.options('item'), op ? op.head : value)}` }
        const n = op?.num ?? 1
        const below = !!op && (op.op === 'lt' || op.op === 'le')
        return { cond: { type: 'item_ge', item: found.id, count: below ? n + 1 : n, not: not !== below || undefined } }
      }
      case /^предмет/.test(kind): {
        const found = matchRef(refs.options('item'), value)
        if (!found) return { cond: null, error: `не нашли предмет «${value}».${suggest(refs.options('item'), value)}` }
        return { cond: { type: 'has_item', item: found.id, not: not || undefined } }
      }
      case /^навык/.test(kind): {
        const op = splitOp(value)
        if (!op) return { cond: null, error: 'у навыка нужен порог: «навык: Убеждение ≥ 45»' }
        const sk = matchRef(refs.options('skill'), op.head)
        if (!sk) return { cond: null, error: `не нашли навык «${op.head}».${suggest(refs.options('skill'), op.head)}` }
        const below = op.op === 'lt' || op.op === 'le'
        return { cond: { type: 'skill_ge', skill: sk.id, threshold: below ? op.num + 1 : op.num, not: not !== below || undefined } }
      }
      case /^отношение/.test(kind): {
        const op = splitOp(value)
        if (!op) return { cond: null, error: 'у отношения нужен порог: «отношение: Вольт ≥ 20»' }
        const who = matchRef(refs.options('disposition'), op.head)
        if (!who) return { cond: null, error: `не нашли, к кому отношение «${op.head}».${suggest(refs.options('disposition'), op.head)}` }
        const below = op.op === 'lt' || op.op === 'le'
        return { cond: { type: 'disp_ge', target: who.id, value: below ? op.num + 1 : op.num, not: not !== below || undefined } }
      }
      case /^(в отряде|отряд)/.test(kind): {
        const npc = matchRef(refs.options('npc'), value)
        if (!npc) return { cond: null, error: `не нашли персонажа «${value}».${suggest(refs.options('npc'), value)}` }
        return { cond: { type: 'in_party', npc: npc.id, not: not || undefined } }
      }
      case /^имя раскрыто/.test(kind): {
        const npc = matchRef(refs.options('npc'), value)
        if (!npc) return { cond: null, error: `не нашли персонажа «${value}».${suggest(refs.options('npc'), value)}` }
        return { cond: { type: 'npc_known', entity: npc.id, not: not || undefined } }
      }
      case /^здоровье/.test(kind): {
        const op = splitOp(value)
        const num = op ? op.num : parseSigned(value)
        if (num === null) return { cond: null, error: 'у здоровья нужен порог: «здоровье ≥ 10»' }
        const below = !!op && (op.op === 'lt' || op.op === 'le')
        return { cond: { type: 'hp_ge', value: below ? num + 1 : num, not: not !== below || undefined } }
      }
      case /^статус/.test(kind): {
        const st = matchRef(refs.options('status'), value)
        if (!st) return { cond: null, error: `не нашли статус «${value}».${suggest(refs.options('status'), value)}` }
        return { cond: { type: 'has_status', status: st.id, not: not || undefined } }
      }
      case /^погод/.test(kind): {
        const w = matchRef(refs.options('weather'), value)
        if (!w) return { cond: null, error: `не нашли погоду «${value}».${suggest(refs.options('weather'), value)}` }
        return { cond: { type: 'weather_is', weather: w.id, not: not || undefined } }
      }
      case /^квест/.test(kind): {
        const [qPart, stagePart] = value.split(/\s+[—–-]\s+/)
        const q = matchRef(refs.options('quest'), qPart.trim())
        if (!q) return { cond: null, error: `не нашли квест «${qPart.trim()}».${suggest(refs.options('quest'), qPart.trim())}` }
        let stageId = ''
        if (stagePart?.trim()) {
          const st = matchRef(refs.stages(q.id), stagePart.trim())
          if (!st) return { cond: null, error: `у квеста «${q.label}» нет стадии «${stagePart.trim()}».${suggest(refs.stages(q.id), stagePart.trim())}` }
          stageId = st.id
        }
        return { cond: { type: 'quest', quest: q.id, stage: stageId, not: not || undefined } }
      }
      case /^счетчик/.test(kind): {
        const op = splitOp(value)
        if (!op) return { cond: null, error: 'у счётчика хроники нужен порог: «счётчик: Увидено концовок ≥ 2»' }
        const key = META_COUNTERS.find((k) => norm(k.label) === norm(op.head))
        if (!key) return { cond: null, error: `не нашли счётчик «${op.head}». Есть: ${META_COUNTERS.map((k) => `«${k.label}»`).join(', ')}.` }
        const below = op.op === 'lt' || op.op === 'le'
        return { cond: { type: 'meta_counter', key: key.id, ge: below ? op.num + 1 : op.num, not: not !== below || undefined } }
      }
      default:
        return { cond: null, error: `не понимаю условие «${raw.trim()}». Виды: флаг, предмет, предметов, навык, отношение, в отряде, здоровье, статус, погода, квест, счётчик.` }
    }
  }

  // без двоеточия: флаг (в том числе «не X» — флага нет)
  const found = matchRef(refs.options('flag'), text)
  if (found) return { cond: { type: 'flag', flag: found.id, not: not || undefined } }
  return { cond: { type: 'flag', flag: ensureFlag(ctx, text).id, not: not || undefined } }
}

/** условие целиком: «A и B» — список, «или» — предупреждение */
function parseConds(
  raw: string,
  ctx: ParseCtx,
): { conds: DlgCond[]; error?: string; warning?: string } {
  const text = raw.trim().replace(/^если\s*:?\s*/i, '').trim()
  if (/\s+или\s+/i.test(text)) {
    const head = text.split(/\s+или\s+/i)[0]
    const one = parseCondPhrase(head, ctx)
    return one.cond
      ? { conds: [one.cond], warning: 'Условия в разговоре соединяются только через «и»: «или» оставлен первой частью — вторую проверку сделайте отдельным вариантом.' }
      : { conds: [], error: one.error }
  }
  const parts = text.split(/\s+и\s+/i)
  if (parts.length > 1) {
    const conds: DlgCond[] = []
    for (const p of parts) {
      const one = parseCondPhrase(p, ctx)
      if (!one.cond) {
        // фраза целиком могла быть одним флагом с союзом «и» в названии
        const whole = parseCondPhrase(text, ctx)
        if (whole.cond) return { conds: [whole.cond] }
        return { conds: [], error: one.error ?? whole.error }
      }
      conds.push(one.cond)
    }
    return { conds }
  }
  const one = parseCondPhrase(text, ctx)
  return one.cond ? { conds: [one.cond] } : { conds: [], error: one.error }
}

// ─────────────── разбор: эффекты ───────────────

interface EffectOut {
  effect?: DlgEffect
  goto?: string
  error?: string
}

function byName(list: Array<{ id: string; label: string }>, text: string, what: string): { id: string } | { error: string } {
  const m = matchRef(list, text)
  if (m) return { id: m.id }
  return { error: `не нашли ${what} «${text}».${suggest(list, text)}` }
}

const EFFECT_HINT = 'Команды: запомнить, выдать, забрать, сцена, бой, состояние сцены, гибель, победа, правило, отряд, торговля, изготовление, квест, время, потребность, здоровье, сон, отношение, катсцена, описание, статус, снять статус, погода, кодекс, рецепт, облик, перейти, конец, остаться.'

export function parseEffectLine(raw: string, ctx: ParseCtx): EffectOut {
  const refs = ctx.refs
  const text = raw.replace(/^[-–—>\s]+/, '').replace(/^→\s*/, '').trim()
  if (!text) return { error: 'после стрелки пусто: напишите, что происходит' }

  if (/^(конец|закончить( разговор)?)$/i.test(text)) return { goto: 'end' }
  if (/^(остаться|те же варианты)$/i.test(text)) return { goto: 'stay' }

  const colon = text.match(/^([^:]{2,50}):\s*(.*)$/)
  const kind = norm(colon ? colon[1] : text)
  const value = colon ? colon[2].trim() : ''
  switch (true) {
    case /^(запомнить|флаг|поставить флаг|установить флаг)/.test(kind): {
      if (!value) return { error: 'напишите название флага: «→ запомнить: Сделка с Вольтом»' }
      const found = matchRef(refs.options('flag'), value)
      return { effect: { type: 'set_flag', flag: found?.id ?? ensureFlag(ctx, strip(value)).id } }
    }
    case /^(выдать|дать|предмет|получить)/.test(kind): {
      if (!value) return { error: 'напишите, что выдать: «→ выдать: Жетон бригады»' }
      const { name, qty } = itemAndQty(value)
      const item = byName(refs.options('item'), name, 'предмет')
      if ('error' in item) return item
      return { effect: { type: 'add_item', item: item.id, qty } }
    }
    case /^(забрать|отобрать|убрать|изъять)/.test(kind): {
      if (!value) return { error: 'напишите, что забрать: «→ забрать: Жетон бригады»' }
      const { name, qty } = itemAndQty(value)
      const item = byName(refs.options('item'), name, 'предмет')
      if ('error' in item) return item
      return { effect: { type: 'remove_item', item: item.id, qty } }
    }
    case /^правило/.test(kind): {
      const rule = byName(refs.options('rule'), value, 'правило')
      if ('error' in rule) return rule
      return { effect: { type: 'fire_rule', rule: rule.id } }
    }
    case /^(отряд|в отряд|взять в отряд)/.test(kind): {
      const npc = byName(refs.options('npc'), value, 'персонажа')
      if ('error' in npc) return npc
      return { effect: { type: 'join_party', npc: npc.id } }
    }
    case /^торговля/.test(kind): {
      if (!value && !refs.npcDefault) return { error: 'торговля открывается с собеседником: «→ торговля: Вольт»' }
      const who = value ? byName(refs.options('npc'), value, 'персонажа') : { id: refs.npcDefault! }
      if ('error' in who) return who
      return { effect: { type: 'open_trade', npc: who.id } }
    }
    case /^(изготовление|крафт|мастерская)/.test(kind): {
      if (!value) return { effect: { type: 'open_craft', recipe: '' } }
      const r = byName(refs.options('recipe'), value, 'рецепт')
      if ('error' in r) return r
      return { effect: { type: 'open_craft', recipe: r.id } }
    }
    case /^(квест|начать квест)/.test(kind): {
      const q = byName(refs.options('quest'), value, 'квест')
      if ('error' in q) return q
      return { effect: { type: 'start_quest', quest: q.id } }
    }
    case /^(время|промотать время)/.test(kind): {
      const n = parseSigned(value)
      if (n === null || n <= 0) return { error: `напишите, сколько ${refs.tickLabel} проходит: «→ время: 2»` }
      return { effect: { type: 'advance_time', ticks: Math.round(n) } }
    }
    case /^потребность/.test(kind): {
      const n = parseSigned(value)
      const needText = value.split(/\s+[+\-−–—]/)[0].trim()
      const need = matchRef(refs.options('need'), needText)
      if (!need) return { error: `не нашли потребность «${needText}».${suggest(refs.options('need'), needText)} Пишите так: «→ потребность: ${refs.options('need')[0]?.label ?? 'Еда'} +35»` }
      if (n === null) return { error: `добавьте, на сколько меняется: «→ потребность: ${need.label} +35»` }
      return { effect: { type: 'change_need', need: need.id, delta: n } }
    }
    case /^здоровье/.test(kind): {
      const n = parseSigned(value)
      if (n === null) return { error: 'напишите, на сколько меняется здоровье: «→ здоровье: +5»' }
      return { effect: { type: 'change_hp', delta: n } }
    }
    case /^сон/.test(kind): {
      const n = parseSigned(value)
      return { effect: { type: 'sleep', ticks: n && n > 0 ? Math.round(n) : 8 } }
    }
    case /^отношение/.test(kind): {
      const n = parseSigned(value)
      if (n === null) return { error: 'напишите, на сколько меняется отношение: «→ отношение: Вольт +20»' }
      const whoText = value.replace(/[+\-−–—]?\s*\d+(?:[.,]\d+)?\s*$/, '').trim()
      const who = byName(refs.options('disposition'), whoText || value, 'персонажа или фракцию')
      if ('error' in who) return who
      return { effect: { type: 'change_disposition', target: who.id, delta: n } }
    }
    case /^(катсцена|кат-сцена)/.test(kind): {
      const c = byName(refs.options('cutscene'), value, 'катсцену')
      if ('error' in c) return c
      return { effect: { type: 'play_cutscene', cutscene: c.id } }
    }
    case /^описание/.test(kind): {
      const m = value.match(/^(.*?)\s+[—–-]\s+(.+)$/)
      if (!m) return { error: 'пишите так: «→ описание: Тело Эрдала Вета — новая подпись при наведении»' }
      const ent = byName([...refs.options('npc'), ...refs.options('item'), ...refs.options('codex')], m[1].trim(), 'сущность')
      if ('error' in ent) return ent
      return { effect: { type: 'set_description', entity: ent.id, text: m[2].trim() } }
    }
    case /^(снять статус|убрать статус|вылечить)/.test(kind): {
      const st = byName(refs.options('status'), value, 'статус')
      if ('error' in st) return st
      return { effect: { type: 'remove_status', status: st.id } }
    }
    case /^(статус|наложить статус)/.test(kind): {
      const { name, qty } = itemAndQty(value)
      const st = byName(refs.options('status'), name, 'статус')
      if ('error' in st) return st
      return { effect: { type: 'apply_status', status: st.id, ...(qty > 1 ? { duration: qty } : {}) } }
    }
    case /^погод/.test(kind): {
      const w = byName(refs.options('weather'), value, 'погоду')
      if ('error' in w) return w
      return { effect: { type: 'set_weather', weather: w.id } }
    }
    case /^(кодекс|запись кодекса)/.test(kind): {
      const c = byName(refs.options('codex'), value, 'запись кодекса')
      if ('error' in c) return c
      return { effect: { type: 'unlock_codex', entry: c.id } }
    }
    case /^рецепт/.test(kind): {
      const r = byName(refs.options('recipe'), value, 'рецепт')
      if ('error' in r) return r
      return { effect: { type: 'unlock_recipe', recipe: r.id } }
    }
    case /^(раскрыть имя|узнать имя|познакомиться)/.test(kind): {
      const who = value
        ? byName(refs.options('npc'), value, 'персонажа')
        : refs.npcDefault
          ? { id: refs.npcDefault }
          : { error: 'пишите так: «→ раскрыть имя: Вольт»' }
      if ('error' in who) return who
      return { effect: { type: 'learn_name', entity: who.id } }
    }
    case /^(сцена|перейти в сцену|в сцену)/.test(kind): {
      const sc = byName(refs.options('scene'), value, 'сцену')
      if ('error' in sc) return sc
      return { effect: { type: 'go_to_scene', scene: sc.id } }
    }
    case /^(бой|начать бой|арена)/.test(kind): {
      const a = byName(refs.options('arena'), value, 'арену')
      if ('error' in a) return a
      return { effect: { type: 'start_combat', arena: a.id } }
    }
    case /^(состояние сцены|декорация|обстановка)/.test(kind): {
      if (!value) return { error: 'укажите состояние сцены: «→ состояние сцены: ночь»' }
      return { effect: { type: 'change_scene_state', state: value } }
    }
    case /^(гибель|поражение|смерть)/.test(kind): {
      return { effect: { type: 'game_over_death', message: value || undefined } }
    }
    case /^(победа|триумф|финал)/.test(kind): {
      return { effect: { type: 'game_over_victory', message: value || undefined } }
    }
    case /^облик/.test(kind): {
      const m = value.match(/^(.*?)\s+[—–-]\s+(.+)$/)
      const who = m
        ? byName(refs.options('npc'), m[1].trim(), 'персонажа')
        : refs.npcDefault
          ? { id: refs.npcDefault }
          : { error: 'пишите так: «→ облик: Вольт — злой»' }
      if ('error' in who) return who
      const stateText = (m ? m[2] : value).trim()
      const emotions = refs.options('emotion')
      const em = emotions.find((e) => norm(e.label) === norm(stateText) || norm(e.id) === norm(stateText))
      if (!em) return { error: `не нашли облик «${stateText}».${suggest(emotions, stateText)}` }
      return { effect: { type: 'set_entity_state', entity: who.id, state: em.id === DEFAULT_EMOTION.id ? '' : em.id } }
    }
    case /^(перейти|узел|в узел)/.test(kind): {
      if (!value) return { error: 'напишите название узла: «→ перейти: Допрос»' }
      return { goto: strip(value) }
    }
    default:
      return { error: `не понимаю команду «${text}». ${EFFECT_HINT}` }
  }
}

// ─────────────── сборка документа из сценария ───────────────

export interface ScriptIssue {
  line: number
  text: string
  message: string
  severity: 'error' | 'warning'
}

export interface ScriptParseResult {
  doc: DlgDoc
  issues: ScriptIssue[]
  /** флаги, которых не было в реестре: редактор дописывает их в реестр сам */
  newFlags: Array<{ id: string; label: string }>
}

export function scriptToDlg(text: string, refs: ScriptRefs, prev?: DlgDoc): ScriptParseResult {
  const issues: ScriptIssue[] = []
  const ctx: ParseCtx = {
    refs,
    newFlags: [],
    usedFlagIds: refs.options('flag').map((f) => f.id),
  }
  const lines = text.replace(/\r\n?/g, '\n').split('\n')

  const nodes: DlgNode[] = []
  const usedIds: string[] = []
  const prevByLabel = new Map<string, DlgNode>()
  for (const n of prev?.nodes ?? []) prevByLabel.set(norm(n.label), n)

  const nodeIdFor = (nodeLabel: string, first: boolean): string => {
    const old = prevByLabel.get(norm(nodeLabel))
    if (old && !usedIds.includes(old.id)) return old.id
    if (first && !usedIds.includes('main')) return 'main'
    return makeId('node_', nodeLabel, usedIds)
  }

  let label = prev?.label
  let node: DlgNode | null = null
  let nodeDeclared = false
  let curSection: DlgSection | null = null
  /** список, в который закроется текущая секция (меняется при [при успехе]) */
  let curList: DlgSection[] | null = null
  let inElse = false
  let pendingConds: DlgCond[] | null = null
  let pendingOnce = false
  let pendingCheck: DlgCheck | null = null
  let curChoice: DlgChoice | null = null
  let target: 'node' | 'choice' | 'success' | 'fail' = 'node'

  const fail = (line: number, raw: string, message: string) =>
    issues.push({ line, text: raw.trim(), message, severity: 'error' })
  const warn = (line: number, raw: string, message: string) =>
    issues.push({ line, text: raw.trim(), message, severity: 'warning' })

  const sectionList = (): DlgSection[] | null => {
    if (!curChoice) return node?.sections ?? null
    if (target === 'success') return curChoice.check?.success.sections ?? null
    if (target === 'fail') return curChoice.check?.fail.sections ?? null
    return curChoice.sections
  }

  function finishSection() {
    if (!curSection) return
    if (curList && (curSection.steps.length || curSection.else_steps?.length)) curList.push(curSection)
    curSection = null
    curList = null
    inElse = false
  }

  function ensureSection(): DlgSection | null {
    if (curSection) return curSection
    const list = sectionList()
    if (!list) return null
    curSection = { steps: [] }
    curList = list
    return curSection
  }

  function pushStep(st: DlgStep) {
    const sec = ensureSection()
    if (!sec) return
    if (inElse) (sec.else_steps ??= []).push(st)
    else sec.steps.push(st)
  }

  function openBlock(conds: DlgCond[]) {
    finishSection()
    const list = sectionList()
    if (!list) return
    curSection = { conds, steps: [] }
    curList = list
    inElse = false
  }

  function setGoto(to: string) {
    if (curChoice) {
      if (target === 'success') curChoice.check!.success.goto = to
      else if (target === 'fail') curChoice.check!.fail.goto = to
      else curChoice.goto = to
      return
    }
    if (!node) return
    if (!node.choices.length) {
      if (inElse) {
        if (curSection) curSection.else_goto = to
        else node.goto = to
      } else if (curSection) curSection.goto = to
      else node.goto = to
      return
    }
    const sec = ensureSection()
    if (!sec) return
    if (inElse) sec.else_goto = to
    else sec.goto = to
  }

  /** текущий узел (присваивания в замыканиях TS не отслеживает) */
  function nodeNow(): DlgNode {
    if (!node) throw new Error('сценарий без узла')
    return node
  }

  function resolveGoto(name: string): string {
    const m = nodes.find((n) => norm(n.label) === norm(name))
    return m ? m.id : name
  }

  function startNode(nodeLabel: string, line: number, declared = true) {
    finishSection()
    if (node && !node.sections.length && !node.choices.length) {
      // неявное начало без содержимого — просто заменяем заголовком
      if (nodeDeclared) fail(line, nodeLabel, `узел «${node.label}» пустой: добавьте реплику или вариант`)
      nodes.pop()
      const at = usedIds.indexOf(node.id)
      if (at >= 0) usedIds.splice(at, 1)
    }
    const id = nodeIdFor(nodeLabel, nodes.length === 0)
    usedIds.push(id)
    node = { id, label: nodeLabel, sections: [], choices: [] }
    nodeDeclared = declared
    nodes.push(node)
    curChoice = null
    target = 'node'
  }

  function pushText(bodyRaw: string, action: boolean, lineNo: number, rawLine: string) {
    let body = bodyRaw.trim()
    if (!body || !node) return
    let emotion: string | undefined
    let voice: string | undefined
    for (;;) {
      const m = body.match(/\s*#\s*([^#]+?)\s*$/)
      if (!m) break
      const tag = m[1].trim()
      const voiceTag = tag.match(/^озвучка\s*:\s*(.+)$/i)
      if (voiceTag) {
        voice = voiceTag[1].trim()
        body = body.slice(0, m.index).trimEnd()
        continue
      }
      const emotions = refs.options('emotion')
      const em = emotions.find((e) => norm(e.label) === norm(tag) || norm(e.id) === norm(tag))
      if (em) {
        emotion = em.id
        body = body.slice(0, m.index).trimEnd()
        continue
      }
      if (/^[а-яё]/i.test(tag) && tag.length < 24 && !/[.!?…:;]/.test(tag)) {
        warn(lineNo, rawLine, `не нашли облик «${tag}» — добавьте его в реестр состояний кампании или уберите пометку.${suggest(emotions, tag)}`)
        body = body.slice(0, m.index).trimEnd()
        continue
      }
      break
    }
    if (!body) return
    if (target !== 'node' && target !== 'choice' && !curChoice?.check) {
      fail(lineNo, rawLine, 'ветка проверки без самой проверки — добавьте «[проверка: Навык ≥ N]» перед вариантом')
      return
    }
    const line: DlgLine = {
      text: body,
      ...(action ? { action: true } : {}),
      ...(emotion && emotion !== DEFAULT_EMOTION.id ? { emotion } : {}),
      ...(voice ? { voice } : {}),
    }
    pushStep({ kind: 'line', line })
  }

  startNode(prev?.nodes[0]?.label ?? 'Начало разговора', 1, false)

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1
    const rawLine = lines[i]
    const trimmed = rawLine.trim()
    if (!trimmed) continue
    if (trimmed.startsWith('#') || trimmed.startsWith('//')) continue

    const titleMatch = trimmed.match(/^(?:название|диалог)\s*:\s*(.+)$/i)
    if (titleMatch) {
      label = strip(titleMatch[1])
      continue
    }

    const nodeMatch = trimmed.match(/^===\s*(.+?)\s*===?$/)
    if (nodeMatch) {
      startNode(strip(nodeMatch[1]), lineNo, true)
      continue
    }

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      const body = trimmed.slice(1, -1).trim()
      if (/^иначе$/i.test(body)) {
        if (!curSection) fail(lineNo, rawLine, '«[иначе]» без условия: сначала напишите «[если …]»')
        else inElse = true
        continue
      }
      if (/^(при успехе|успех)$/i.test(body)) {
        if (!curChoice?.check) fail(lineNo, rawLine, '«[при успехе]» — только внутри варианта с проверкой «[проверка: …]»')
        else {
          finishSection()
          target = 'success'
        }
        continue
      }
      if (/^(при провале|провал)$/i.test(body)) {
        if (!curChoice?.check) fail(lineNo, rawLine, '«[при провале]» — только внутри варианта с проверкой «[проверка: …]»')
        else {
          finishSection()
          target = 'fail'
        }
        continue
      }
      if (/^(одноразовый|один раз|однократный)/i.test(body)) {
        pendingOnce = true
        continue
      }
      const timerMatch = body.match(/^таймер\s*:?\s*(.+)$/i)
      if (timerMatch) {
        const m = timerMatch[1].match(/^(\d+)\s*(?:(?:→|->|в)\s*(.+))?$/)
        if (!m) {
          fail(lineNo, rawLine, 'таймер пишется так: «[таймер: 18]» или «[таймер: 18 → Узел молчания]»')
          continue
        }
        if (!node) continue
        if (!nodeNow().choices.length) warn(lineNo, rawLine, 'таймер работает только у узла с вариантами ответа — вариантов пока нет')
        nodeNow().timer = { seconds: Math.max(1, Number(m[1])), ...(m[2] ? { node: strip(m[2]) } : {}) }
        continue
      }
      const checkMatch = body.match(/^проверка\s*:?\s*(.+)$/i)
      if (checkMatch) {
        const op = splitOp(checkMatch[1])
        const sk = matchRef(refs.options('skill'), op ? op.head : checkMatch[1].split(/\s+[—–-]\s+/)[0].trim())
        if (!sk) {
          const head = op ? op.head : checkMatch[1]
          fail(lineNo, rawLine, `не нашли навык «${head}».${suggest(refs.options('skill'), head)} Проверка пишется так: «[проверка: Убеждение ≥ 45]».`)
          continue
        }
        let difficulty: SkillDifficulty | null = op ? op.num : null
        if (difficulty === null) difficulty = parseDifficulty(checkMatch[1].split(/\s+[—–-]\s+/)[1] ?? '')
        if (difficulty === null) {
          fail(lineNo, rawLine, 'у проверки нужна сложность: порог числом («Убеждение ≥ 45») или словом (легко, обычно, сложно, невозможно)')
          continue
        }
        pendingCheck = { skill: sk.id, difficulty, success: { sections: [], goto: 'stay' }, fail: { sections: [], goto: 'stay' } }
        continue
      }
      const conds = parseConds(body, ctx)
      if (conds.warning) warn(lineNo, rawLine, conds.warning)
      if (conds.error) {
        fail(lineNo, rawLine, conds.error)
        continue
      }
      if (pendingConds?.length) warn(lineNo, rawLine, 'два условия подряд: второе заменит первое (закрывайте блок словом «[иначе]» или новым «[если]»)')
      pendingConds = conds.conds
      continue
    }

    if (trimmed.startsWith('?')) {
      const choiceText = trimmed.replace(/^\?\s*/, '').trim()
      if (!choiceText) {
        fail(lineNo, rawLine, 'у варианта нет текста: «? Что за жетон?»')
        continue
      }
      if (!node) continue
      finishSection()
      curChoice = {
        text: strip(choiceText),
        sections: [],
        goto: 'stay',
        ...(pendingConds?.length ? { conds: pendingConds } : {}),
        ...(pendingOnce ? { once: true } : {}),
        ...(pendingCheck ? { check: pendingCheck } : {}),
      }
      pendingConds = null
      pendingOnce = false
      pendingCheck = null
      target = 'choice'
      nodeNow().choices.push(curChoice)
      continue
    }

    if (trimmed.startsWith('→') || trimmed.startsWith('->')) {
      if (pendingConds?.length) {
        openBlock(pendingConds)
        pendingConds = null
      }
      const out = parseEffectLine(trimmed, ctx)
      if (out.error) {
        fail(lineNo, rawLine, out.error)
        continue
      }
      if (out.goto !== undefined) {
        setGoto(out.goto === 'end' || out.goto === 'stay' ? out.goto : resolveGoto(out.goto))
        continue
      }
      if (out.effect) pushStep({ kind: 'effect', effect: out.effect })
      continue
    }

    // текст: ремарка «* …» или реплика (возможно, с длинным тире)
    const remark = /^\*/.test(trimmed)
    const body = remark ? trimmed.replace(/^\*\s*/, '') : trimmed.replace(/^[—–]\s*/, '')
    if (!remark && /^\(.*\)$/.test(body) && body.length > 2) {
      if (pendingConds?.length) {
        openBlock(pendingConds)
        pendingConds = null
      }
      pushText(body.slice(1, -1), true, lineNo, rawLine)
      continue
    }
    if (pendingConds?.length) {
      openBlock(pendingConds)
      pendingConds = null
    }
    pushText(body, remark, lineNo, rawLine)
  }

  finishSection()
  if (pendingConds?.length) fail(lines.length, '', 'условие «[если …]» ничего не открывает: под ним нет ни текста, ни варианта')

  // переходы: «→ перейти: Название» → id узла
  const fix = (g?: string) => (g && g !== 'end' && g !== 'stay' ? resolveGoto(g) : g)
  for (const n of nodes) {
    n.goto = fix(n.goto)
    for (const sec of n.sections) {
      sec.goto = fix(sec.goto)
      sec.else_goto = fix(sec.else_goto)
    }
    for (const c of n.choices) {
      c.goto = fix(c.goto) ?? 'stay'
      if (c.check) {
        c.check.success.goto = fix(c.check.success.goto) ?? 'stay'
        c.check.fail.goto = fix(c.check.fail.goto) ?? 'stay'
      }
    }
    if (n.timer?.node) n.timer.node = fix(n.timer.node)
  }

  const known = new Set(nodes.map((n) => n.id))
  const checkGoto = (g: string | undefined) => {
    if (g && g !== 'end' && g !== 'stay' && !known.has(g)) {
      issues.push({ line: 1, text: '', message: `переход в неизвестный узел «${g}»: назовите узел так же, как в «=== … ===».`, severity: 'warning' })
    }
  }
  for (const n of nodes) {
    checkGoto(n.goto)
    for (const sec of n.sections) { checkGoto(sec.goto); checkGoto(sec.else_goto) }
    for (const c of n.choices) { checkGoto(c.goto); if (c.check) { checkGoto(c.check.success.goto); checkGoto(c.check.fail.goto) } }
    if (n.timer?.node) checkGoto(n.timer.node)
  }

  const doc: DlgDoc = {
    version: 2,
    ...(label ? { label } : {}),
    nodes: nodes.length && nodes.some((n) => n.sections.length || n.choices.length)
      ? nodes.filter((n) => n.sections.length || n.choices.length)
      : prev?.nodes?.length
        ? prev.nodes
        : [{ id: 'main', label: 'Начало разговора', sections: [{ steps: [{ kind: 'line', line: { text: 'Привет.' } }] }], choices: [{ text: 'До встречи.', sections: [], goto: 'end' }] }],
  }
  return { doc, issues, newFlags: ctx.newFlags }
}

// ─────────────── письмо: документ → сценарий ───────────────

const INDENT = '    '

function lineToScript(l: DlgLine, refs: ScriptRefs): string {
  const tail: string[] = []
  if (l.voice) tail.push(`#озвучка: ${l.voice}`)
  if (l.emotion && l.emotion !== DEFAULT_EMOTION.id) tail.push(`#${refLabel(refs.options('emotion'), l.emotion)}`)
  const body = `${l.action ? '* ' : '— '}${l.text}`
  return tail.length ? `${body} ${tail.join(' ')}` : body
}

function entityLabel(refs: ScriptRefs, id: string): string {
  for (const kind of ['npc', 'item', 'codex'] as ScriptRefKind[]) {
    const list = refs.options(kind)
    if (list.some((o) => o.id === id)) return refLabel(list, id)
  }
  return humanize(id)
}

function effectToScript(e: DlgEffect, refs: ScriptRefs): string {
  const label = (kind: ScriptRefKind, id: string) => refLabel(refs.options(kind), id)
  switch (e.type) {
    case 'set_flag': return `→ запомнить: ${refLabel(refs.options('flag'), e.flag)}`
    case 'add_item': return `→ выдать: ${label('item', e.item)}${e.qty > 1 ? ` ×${e.qty}` : ''}`
    case 'remove_item': return `→ забрать: ${label('item', e.item)}${e.qty > 1 ? ` ×${e.qty}` : ''}`
    case 'fire_rule': return `→ правило: ${label('rule', e.rule)}`
    case 'join_party': return `→ отряд: ${label('npc', e.npc)}`
    case 'open_trade': return `→ торговля: ${label('npc', e.npc)}`
    case 'open_craft': return e.recipe ? `→ изготовление: ${label('recipe', e.recipe)}` : '→ изготовление'
    case 'start_quest': return `→ квест: ${label('quest', e.quest)}`
    case 'advance_time': return `→ время: ${e.ticks}`
    case 'change_need': return `→ потребность: ${label('need', e.need)} ${e.delta >= 0 ? '+' : ''}${e.delta}`
    case 'change_hp': return `→ здоровье: ${e.delta >= 0 ? '+' : ''}${e.delta}`
    case 'sleep': return `→ сон: ${e.ticks}`
    case 'change_disposition': return `→ отношение: ${label('disposition', e.target)} ${e.delta >= 0 ? '+' : ''}${e.delta}`
    case 'play_cutscene': return `→ катсцена: ${label('cutscene', e.cutscene)}`
    case 'set_description': return `→ описание: ${entityLabel(refs, e.entity)} — ${e.text}`
    case 'apply_status': return `→ статус: ${label('status', e.status)}${e.duration ? ` ${e.duration}` : ''}`
    case 'remove_status': return `→ снять статус: ${label('status', e.status)}`
    case 'set_weather': return `→ погода: ${label('weather', e.weather)}`
    case 'unlock_codex': return `→ кодекс: ${label('codex', e.entry)}`
    case 'unlock_recipe': return `→ рецепт: ${label('recipe', e.recipe)}`
    case 'set_entity_state': return `→ облик: ${label('npc', e.entity)} — ${e.state ? label('emotion', e.state) : 'обычный'}`
    case 'learn_name': return `→ раскрыть имя: ${label('npc', e.entity)}`
    case 'go_to_scene': return `→ сцена: ${label('scene', e.scene)}`
    case 'start_combat': return `→ бой: ${label('arena', e.arena)}`
    case 'change_scene_state': return `→ состояние сцены: ${e.state}`
    case 'game_over_death': return e.message ? `→ гибель: ${e.message}` : '→ гибель'
    case 'game_over_victory': return e.message ? `→ победа: ${e.message}` : '→ победа'
    case 'present_item': return `→ предъявить улику: ${e.required ? label('item', e.required) : 'любой предмет'} (успех: ${e.ok}, иначе: ${e.fail})`
  }
}

function condToScript(c: DlgCond, refs: ScriptRefs): string {
  const not = c.not ? 'нет ' : ''
  switch (c.type) {
    case 'flag': return `[если ${not}${refLabel(refs.options('flag'), c.flag)}]`
    case 'npc_known': return `[если ${not}имя раскрыто: ${refLabel(refs.options('npc'), c.entity)}]`
    case 'item_ge': return `[если предметов: ${refLabel(refs.options('item'), c.item)} ${c.not ? '<' : '≥'} ${c.count}]`
    case 'has_item': return `[если ${not}предмет: ${refLabel(refs.options('item'), c.item)}]`
    case 'disp_ge': return `[если отношение: ${refLabel(refs.options('disposition'), c.target)} ${c.not ? '<' : '≥'} ${c.value}]`
    case 'quest': return c.stage
      ? `[если квест: ${refLabel(refs.options('quest'), c.quest)} — ${refLabel(refs.stages(c.quest), c.stage)}]`
      : `[если ${not}квест: ${refLabel(refs.options('quest'), c.quest)}]`
    case 'in_party': return `[если ${not}в отряде: ${refLabel(refs.options('npc'), c.npc)}]`
    case 'hp_ge': return `[если здоровье ${c.not ? '<' : '≥'} ${c.value}]`
    case 'has_status': return `[если ${not}статус: ${refLabel(refs.options('status'), c.status)}]`
    case 'weather_is': return `[если ${not}погода: ${refLabel(refs.options('weather'), c.weather)}]`
    case 'skill_ge': return `[если навык: ${refLabel(refs.options('skill'), c.skill)} ${c.not ? '<' : '≥'} ${c.threshold}]`
    case 'meta_counter': return `[если счётчик: ${refLabel(META_COUNTERS, c.key)} ${c.not ? '<' : '≥'} ${c.ge}]`
  }
}

function gotoToScript(doc: DlgDoc, nodeId: string, goto: string | undefined): string | null {
  if (!goto) return null
  if (goto === 'end') return '→ конец'
  if (goto === 'stay' || goto === nodeId) return '→ остаться'
  const n = doc.nodes.find((x) => x.id === goto)
  return `→ перейти: ${n?.label ?? humanize(goto)}`
}

function stepsToScript(steps: DlgStep[], refs: ScriptRefs, depth: number): string[] {
  const pad = INDENT.repeat(depth)
  return steps.map((st) =>
    st.kind === 'line' ? `${pad}${lineToScript(st.line, refs)}` : `${pad}${effectToScript(st.effect, refs)}`)
}

function sectionsToScript(doc: DlgDoc, nodeId: string, sections: DlgSection[], refs: ScriptRefs, depth: number): string[] {
  const pad = INDENT.repeat(depth)
  const out: string[] = []
  for (const sec of sections) {
    const inner = depth + 1
    if (sec.conds?.length) {
      for (const c of sec.conds) out.push(`${pad}${condToScript(c, refs)}`)
      out.push(...stepsToScript(sec.steps, refs, inner))
      const g = gotoToScript(doc, nodeId, sec.goto)
      if (g) out.push(`${INDENT.repeat(inner)}${g}`)
      if (sec.else_steps?.length || sec.else_goto) {
        out.push(`${pad}[иначе]`)
        out.push(...stepsToScript(sec.else_steps ?? [], refs, inner))
        const eg = gotoToScript(doc, nodeId, sec.else_goto)
        if (eg) out.push(`${INDENT.repeat(inner)}${eg}`)
      }
    } else {
      out.push(...stepsToScript(sec.steps, refs, depth))
      const g = gotoToScript(doc, nodeId, sec.goto)
      if (g) out.push(`${pad}${g}`)
    }
  }
  return out
}

/** документ → мастерский сценарий (текст без id и без ink) */
export function dlgToScript(rawDoc: DlgDoc, refs: ScriptRefs): string {
  const doc = rawDoc
  const out: string[] = []
  if (doc.label) out.push(`название: ${doc.label}`, '')
  doc.nodes.forEach((node, idx) => {
    if (idx > 0) out.push('')
    out.push(`=== ${node.label} ===`)
    out.push(...sectionsToScript(doc, node.id, node.sections, refs, 0))
    if (node.timer) {
      const to = node.timer.node ? doc.nodes.find((n) => n.id === node.timer!.node)?.label : undefined
      out.push(`[таймер: ${node.timer.seconds}${to ? ` → ${to}` : ''}]`)
    }
    for (const c of node.choices) {
      if (c.conds?.length) for (const cond of c.conds) out.push(condToScript(cond, refs))
      if (c.once) out.push('[одноразовый]')
      if (c.check) out.push(`[проверка: ${refLabel(refs.options('skill'), c.check.skill)} ${difficultyText(c.check.difficulty)}]`)
      out.push(`? ${c.text}`)
      out.push(...sectionsToScript(doc, node.id, c.sections, refs, 1))
      if (c.check) {
        const s = c.check.success
        if (s.sections.length || s.goto !== 'stay') {
          out.push(`${INDENT}[при успехе]`)
          out.push(...sectionsToScript(doc, node.id, s.sections, refs, 1))
          if (s.goto !== 'stay') {
            const g = gotoToScript(doc, node.id, s.goto)
            if (g) out.push(`${INDENT}${g}`)
          }
        }
        const f = c.check.fail
        if (f.sections.length || f.goto !== 'stay') {
          out.push(`${INDENT}[при провале]`)
          out.push(...sectionsToScript(doc, node.id, f.sections, refs, 1))
          if (f.goto !== 'stay') {
            const g = gotoToScript(doc, node.id, f.goto)
            if (g) out.push(`${INDENT}${g}`)
          }
        }
      }
      if (c.goto !== 'stay') {
        const g = gotoToScript(doc, node.id, c.goto)
        if (g) out.push(`${INDENT}${g}`)
      }
    }
    if (!node.choices.length && node.goto && node.goto !== 'end') {
      const g = gotoToScript(doc, node.id, node.goto)
      if (g) out.push(g)
    }
  })
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'
}

// ─────────────── шпаргалка и пример ───────────────

export const SCRIPT_HELP: Array<{ code: string; hint: string }> = [
  { code: '=== Название узла ===', hint: 'новый узел разговора; первый узел — начало' },
  { code: '— реплика', hint: 'говорит собеседник (можно и без тире)' },
  { code: '* действие', hint: 'ремарка: показывается курсивом' },
  { code: '? Ваш ответ.', hint: 'вариант игрока; следующие строки — ответ собеседника' },
  { code: '[если Сделка с Вольтом]', hint: 'условие для блока ниже или для следующего варианта' },
  { code: '[иначе]', hint: 'что показать, если условие не выполнено' },
  { code: '→ запомнить: Сделка с Вольтом', hint: 'поставить флаг' },
  { code: '→ выдать: Жетон бригады ×2', hint: 'выдать или забрать предмет' },
  { code: '→ отношение: Вольт +20', hint: 'отношение к герою' },
  { code: '→ облик: Вольт — злой', hint: 'смена картинки собеседника' },
  { code: '→ перейти: Допрос', hint: 'переход («→ конец», «→ остаться»)' },
  { code: '[таймер: 18 → Молчание]', hint: 'сколько секунд игрок думает над ответом' },
  { code: '[проверка: Убеждение ≥ 45]', hint: 'проверка навыка перед вариантом' },
  { code: '— Ты придёшь? #злой', hint: 'облик на одну реплику («#озвучка: файл»)' },
]

/** пример для кнопки «Показать пример» в пустом диалоге */
export function exampleScript(): string {
  return [
    'название: Встреча у переправы',
    '',
    '=== Начало разговора ===',
    '* Вольт улыбается так, будто вы старые приятели, которые делили комнату.',
    '— Кто идёт?',
    '[если Сделка с Вольтом]',
    '— А, это ты. Держи, я не забыл.',
    '→ выдать: Жетон бригады',
    '[иначе]',
    '— Не знаю тебя. И, честно говоря, не горю желанием.',
    '? Что за жетон?',
    '— Память. Семь имён, и одно из них — моё.',
    '→ кодекс: Список бригады',
    '→ остаться',
    '? Мне пора.',
    '→ конец',
    '',
  ].join('\n')
}
