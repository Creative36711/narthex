/**
 * Сторож «гайд ↔ схема» (антидрейф, раунд по итогам прогона ИИ-агента).
 *
 * Проверяет четыре вещи:
 *  а) каждый JSON-литерал эффекта/условия в docs/ai-campaign-guide.md
 *     действителен по docs/campaign.schema.json (типы Effect/Condition/
 *     DlgEffect/DlgCond из src/shared/types.ts);
 *  б) обратное покрытие: каждый тип эффекта и условия из схемы встречается
 *     в гайде хотя бы раз;
 *  в) поля, названные в инлайн-сниппетах вида `тип_эффекта { поле, … }`,
 *     существуют у этого типа;
 *  г) гайд не ссылается на несуществующие механики: каждый идентификатор в
 *     бэктиках — это тип, поле из схемы, слово из лексики полигона или
 *     осознанно внесённый в ENGINE_VOCABULARY служебный термин.
 *
 * Прогон: npx tsx scripts/guide-schema-guard.mts  (npm run smoke:guide)
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import Ajv2020 from 'ajv/dist/2020'
import { ENGINE_VERSION } from '../src/shared/versions'

let failed = 0
const check = (label: string, ok: boolean, extra?: string) => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `\n    ${extra}` : ''}`)
  if (!ok) failed++
}

const GUIDE = 'docs/ai-campaign-guide.md'
const guide = readFileSync(GUIDE, 'utf8')
const schema = JSON.parse(readFileSync('docs/campaign.schema.json', 'utf8')) as {
  $defs: Record<string, { anyOf?: Array<Record<string, any>> }>
}
check(
  'пример версии движка в гайде синхронизирован с ENGINE_VERSION',
  guide.includes(`\"engine_version\": \"${ENGINE_VERSION}\"`) && guide.includes(`\"min_engine\": \"${ENGINE_VERSION}\"`),
  `ожидается ${ENGINE_VERSION}; не путать с version кампании`,
)

// ── индексы схемы ──
const TYPE_DEFS = ['Effect', 'Condition', 'DlgEffect', 'DlgCond'] as const
const typesOf = (def: string): string[] =>
  (schema.$defs[def]?.anyOf ?? [])
    .map((b) => b.properties?.type?.const)
    .filter((t): t is string => typeof t === 'string')

/** type → объединение допустимых полей (тип есть и в Effect, и в DlgEffect) */
function fieldsOf(type: string): Set<string> {
  const out = new Set<string>()
  for (const def of TYPE_DEFS) {
    for (const b of schema.$defs[def]?.anyOf ?? []) {
      if (b.properties?.type?.const !== type) continue
      for (const k of Object.keys(b.properties ?? {})) out.add(k)
    }
  }
  return out
}

const KNOWN_TYPES = new Set<string>()
for (const def of TYPE_DEFS) for (const t of typesOf(def)) KNOWN_TYPES.add(t)

/** все имена свойств схемы — чтобы ловить выдуманные поля */
const SCHEMA_PROPS = new Set<string>()
{
  const walk = (n: unknown): void => {
    if (!n || typeof n !== 'object') return
    const o = n as Record<string, unknown>
    if (o.properties) for (const k of Object.keys(o.properties as object)) SCHEMA_PROPS.add(k)
    if (Array.isArray(o.enum)) for (const v of o.enum) if (typeof v === 'string') SCHEMA_PROPS.add(v)
    for (const k of Object.keys(o)) walk(o[k])
  }
  for (const def of Object.keys(schema.$defs)) walk(schema.$defs[def])
}

/** лексика кампании-полигона: примеры гайда правдивы и для неё */
const CAMPAIGN_VOCAB = (() => {
  const buf: string[] = []
  const walk = (d: string): void => {
    for (const e of readdirSync(d)) {
      const p = join(d, e)
      if (statSync(p).isDirectory()) walk(p)
      else if (e.endsWith('.json')) buf.push(readFileSync(p, 'utf8'))
    }
  }
  walk('public/campaigns/ash-of-caerden')
  return buf.join('\n')
})()

/**
 * Служебные слова движка, которых НЕТ в типах и полях схемы. Перечислены
 * явно, чтобы новое имя нельзя было «запихнуть» в гайд молча: добавлять
 * сюда — только вместе с пояснением, что это за механика.
 */
const ENGINE_VOCABULARY = new Map<string, string>([
  ['both', 'связка «и там и там» в описаниях правил'],
  ['chronicles', 'идентификатор записи кодекса (пример из §14з)'],
  ['dead', 'ключ combat_figure_states: погиб'],
  ['down', 'ключ combat_figure_states: без сознания'],
  ['drop', 'хук звука взаимодействия SoundHook'],
  ['pickup', 'хук звука взаимодействия SoundHook'],
  ['use', 'хук звука взаимодействия SoundHook'],
  ['open', 'хук звука взаимодействия SoundHook'],
  ['talk', 'хук звука взаимодействия SoundHook'],
  ['travel', 'хук звука взаимодействия SoundHook'],
  ['equip', 'хук звука взаимодействия: надеть оружие/броню'],
  ['unequip', 'хук звука взаимодействия: снять оружие/броню'],
  ['item_get', 'хук темы ui_sounds: получение предмета'],
  ['item_lose', 'хук темы ui_sounds: потеря предмета'],
  ['static', 'figure_mode: не разворачивать фигурку'],
  ['topdown', 'figure_mode: вид сверху'],
  ['stage_', 'префикс id стадии квеста (пример соглашений §3)'],
  ['tired', 'ключ состояния портрета: устал'],
  ['wounded', 'ключ состояния портрета: ранен'],
  ['happy', 'ключ состояния портрета: радость'],
  ['scared', 'ключ состояния портрета: испуг'],
  ['pass_turn', 'ключ ui_labels: надпись пропуска хода'],
  ['flee', 'ключ ui_labels: надпись бегства из боя'],
  ['craft', 'ключ ui_labels: надпись кнопки ремесла'],
  ['character', 'ключ ui_labels: надпись кнопки досье героя'],
  ['STR', 'главная характеристика: сила (всегда латиницей)'],
  ['CON', 'главная характеристика: телосложение (всегда латиницей)'],
  ['SIZ', 'главная характеристика: размер/комплекция (всегда латиницей)'],
  ['DEX', 'главная характеристика: ловкость (всегда латиницей)'],
  ['INT', 'главная характеристика: интеллект/разум (всегда латиницей)'],
  ['POW', 'главная характеристика: сила воли/мощь (всегда латиницей)'],
  ['CHA', 'главная характеристика: обаяние/харизма (всегда латиницей)'],
  ['EDU', 'главная характеристика: образование (всегда латиницей)'],
  ['neutral', 'ключ состояния портрета: обычный'],
  ['npc_mood', 'самочувствие NPC: 0…100, сдвигает проверки убеждения'],
  ['learn_name', 'эффект диалога: раскрыть настоящее имя персонажа игроку'],
  ['once', 'поле правила: сработать один раз'],
  ['manual', 'поле правила: только по вызову'],
  ['always', 'триггер правила: постоянная проверка'],
  ['enter_scene', 'триггер правила: вход на сцену'],
  ['leave_scene', 'триггер правила: попытка уйти со сцены'],
  ['time_tick', 'триггер правила: тик времени'],
  ['goto', 'переход узла диалога'],
  ['else_goto', 'переход «иначе» в диалоге'],
  ['ink', 'формат диалога в пакете'],
  ['scene_intro_next', 'ключ текста кнопки далее интро сцены в ui_labels'],
  ['scene_intro_done', 'ключ текста кнопки завершения интро сцены в ui_labels'],
  ['seen_narrative_intros', 'массив id сцен с просмотренным нарративным интро в GameState'],
  ['hub', 'узел вариантов ответа в ink (имя из примера гайда)'],
  ['main_hub', 'узел вариантов к узлу main — соглашение импорта ink'],
  ['topics', 'узел вариантов ответа в ink (имя из примера гайда)'],
  ['action', 'тег ремарки в строке ink (# action)'],
  ['emotion', 'тег состояния портрета в строке ink (# emotion: …)'],
  ['outdoor', 'режим освещения сцены: уличный свет с суточным шейдером'],
  ['indoor', 'режим освещения сцены: закрытое помещение'],
  ['voice', 'тег озвучки реплики в строке ink (# voice: …)'],
  // ключи и значения из конвенции cf-feedback (§0)
  ['id', 'стабильный ключ записи обратной связи'],
  ['kind', 'тип записи обратной связи'],
  ['detail', 'поле записи обратной связи'],
  ['workaround', 'поле записи обратной связи'],
  ['severity', 'поле записи обратной связи'],
  ['missing_effect', 'kind: не хватает эффекта'],
  ['missing_condition', 'kind: не хватает условия'],
  ['doc_gap', 'kind: пробел в документации'],
  ['schema_gap', 'kind: пробел в схеме'],
  ['validator_wrong', 'kind: валидатор ошибается'],
  ['other', 'kind: прочее'],
  ['low', 'severity: не срочно'],
  ['mid', 'severity: средне'],
  ['high', 'severity: срочно'],
  // ключи счётчиков хроники (условие meta_counter, §9б)
  ['endings_seen', 'счётчик хроники: сколько разных концовок видел игрок'],
  ['runs', 'счётчик хроники: забегов'],
  ['deaths', 'счётчик хроники: смертей'],
  ['victories', 'счётчик хроники: побед'],
  ['kills', 'счётчик забега: убийств'],
  ['quests_completed', 'счётчик забега: завершённых квестов'],
  ['ticks_survived', 'счётчик забега: прожитых тиков'],
  ['travels', 'счётчик забега: переходов'],
  ['dialogues', 'счётчик забега: разговоров'],
  // состояния облика из примеров §8б
  ['angry', 'ключ состояния облика из примера (реестр meta.emotions)'],
  ['calm', 'ключ состояния облика из примера (реестр meta.emotions)'],
  // поля, которых в движке НЕТ, но которые гайд обязан называть вслух,
  // чтобы агент их не искал (наследие прежней редакции §19)
  // внешние функции сырого Ink (список — в src/core/dialogue.ts, §13.2)
  ['get_flag', 'внешняя функция Ink: значение флага'],
  ['get_stat', 'внешняя функция Ink: характеристика'],
  ['get_skill', 'внешняя функция Ink: навык'],
  ['get_hp', 'внешняя функция Ink: здоровье'],
  ['get_need', 'внешняя функция Ink: потребность'],
  ['get_currency', 'внешняя функция Ink: валюта'],
  ['get_disposition', 'внешняя функция Ink: отношение'],
  ['quest_stage', 'внешняя функция Ink: стадия квеста'],
  ['item_count', 'внешняя функция Ink: количество предмета'],
  ['set_dialogue_timer', 'внешняя функция Ink: дедлайн на раздумье в диалоге (§9)'],
  ['present_item', 'внешняя функция Ink: предъявление предмета или улики из инвентаря (§13.2)'],
  ['play_sound', 'внешняя функция Ink и эффект движка: воспроизведение звука'],
  ['override_music', 'эффект движка: сюжетное переопределение музыки'],
  ['clear_music_override', 'эффект движка: снятие переопределения музыки'],
  ['sfx', 'тег звукового эффекта реплики в строке ink (# sfx: …)'],
  ['has_meta_achievement', 'внешняя функция Ink: есть ли достижение хроники'],
  ['get_meta_counter', 'внешняя функция Ink: счётчик хроники (endings_seen и т.д.)'],
  ['chance_warns', 'устаревшее поле start_pursuit — в формате отсутствует'],
  ['hunters', 'устаревшее поле start_pursuit — в формате отсутствует'],
  // рантайм-фолбэки (пустой schedule, knot ≠ main, EXTERNAL, пустые asset)
  ['n_start', 'id стартового knot диалога (альтернатива main)'],
  ['main', 'канонический id стартового knot диалога'],
  ['EXTERNAL', 'объявление внешней функции в сыром Ink'],
  ['generateInk', 'генератор ink из DlgDoc конструктора'],
  ['default_entity', 'сущность по умолчанию в слоте сцены'],
  ['assetUrlOrNull', 'URL ассета или null при пустой строке'],
  ['firstInkKnot', 'первый knot ink-текста (фолбэк входа)'],
  ['img', 'HTML-тег картинки (не ставить битый src)'],
  ['get_player_name', 'токен {имя} / внешняя функция Ink'],
  ['get_hp_max', 'токен {здоровье_макс}'],
  ['get_currency', 'токен валюты в реплике'],
  ['base_disposition', 'стартовое отношение к NPC'],
  ['stop_sound', 'эффект остановки воспроизведения звука'],
  ['dialogue_present', 'хук звука при предъявлении предмета в диалоге'],
  ['error', 'звуковой хук ошибки/недоступности действия'],
])

// ── (а) JSON-литералы эффектов и условий ──
/** все сбалансированные {...} в тексте, даже если блок не целиком JSON */
function jsonObjects(text: string): string[] {
  const out: string[] = []
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '{') continue
    let depth = 0
    let inStr = false
    let esc = false
    for (let j = i; j < text.length; j++) {
      const ch = text[j]
      if (inStr) {
        if (esc) esc = false
        else if (ch === '\\') esc = true
        else if (ch === '"') inStr = false
        continue
      }
      if (ch === '"') inStr = true
      else if (ch === '{') depth++
      else if (ch === '}') {
        depth--
        if (depth === 0) {
          out.push(text.slice(i, j + 1))
          i = j
          break
        }
      }
    }
  }
  return out
}

const ajv = new Ajv2020({ strict: false, allErrors: false })
ajv.addSchema(schema, 'campaign')
const DEF_NAMES = Object.keys(schema.$defs)
const defValidator = (def: string) => ajv.getSchema(`campaign#/$defs/${def}`)!
const defOfType = (type: string): string | undefined => TYPE_DEFS.find((d) => typesOf(d).includes(type))

const seen = new Set<string>()
const badLiterals: string[] = []
for (const raw of jsonObjects(guide)) {
  let v: any
  try {
    v = JSON.parse(raw)
  } catch {
    continue // не JSON-литерал (псевдокод в тексте) — не наша забота
  }
  if (!v || typeof v !== 'object' || Array.isArray(v) || typeof v.type !== 'string') continue
  const type = v.type as string
  const def = defOfType(type)
  if (def && defValidator(def)(v)) {
    seen.add(type) // корректный эффект/условие
    continue
  }
  // не эффект/условие (или одноимённый тип другого назначения — например
  // NeedCondition против Condition): литерал обязан совпасть с каким-нибудь
  // типом формата, иначе это опечатка агента или наш дрейф
  if (!DEF_NAMES.some((d) => defValidator(d)(v))) {
    badLiterals.push(`«${type}» — не соответствует ни одному типу формата: ${raw.slice(0, 120)}`)
  }
}
check(
  'а) все JSON-литералы эффектов/условий в гайде валидны по схеме',
  badLiterals.length === 0,
  badLiterals.join('\n    '),
)

// ── (б) обратное покрытие ──
const missing: string[] = []
for (const type of KNOWN_TYPES) {
  const inText =
    guide.includes('`' + type + '`') || new RegExp(`"type"\\s*:\\s*"${type}"`).test(guide)
  if (!seen.has(type) && !inText) missing.push(type)
}
check(
  `б) каждый тип из схемы (${KNOWN_TYPES.size}) упомянут в гайде`,
  missing.length === 0,
  `не упомянуты: ${missing.join(', ')}`,
)

// ── (в) поля в инлайн-сниппетах вида `тип { … }` ──
const badFields: string[] = []
const SNIPPET = new RegExp('`([a-z][a-z0-9_]*)\\s*\\{([^`\\n]*)\\}`', 'g')
for (const m of guide.matchAll(SNIPPET)) {
  const type = m[1]
  if (!KNOWN_TYPES.has(type)) continue
  const allowed = fieldsOf(type)
  for (const part of m[2].split(',')) {
    const name = part.trim().replace(/[:=].*$/, '').trim()
    if (!name || !/^[a-z][a-z0-9_]*$/.test(name)) continue
    if (!allowed.has(name)) {
      badFields.push(
        `«${type} { ${name} }» — поля «${name}» у типа нет (есть: ${[...allowed].join(', ')})`,
      )
    }
  }
}
check('в) поля в сниппетах «тип { … }» существуют у этого типа', badFields.length === 0, badFields.join('\n    '))

// ── (г) гайд ссылается только на существующие механики ──
const unknownWords = new Set<string>()
for (const m of guide.matchAll(/`([a-z][a-z0-9_]*)`/g)) {
  const w = m[1]
  if (KNOWN_TYPES.has(w) || SCHEMA_PROPS.has(w) || ENGINE_VOCABULARY.has(w) || CAMPAIGN_VOCAB.includes(w)) continue
  unknownWords.add(w)
}
check(
  'г) в бэктиках гайда нет несуществующих механик',
  unknownWords.size === 0,
  `не нашли в схеме, в лексике полигона и в ENGINE_VOCABULARY: ${[...unknownWords].sort().join(', ')}`,
)

console.log(failed ? `\nПРОВАЛЕНО: ${failed}` : '\nгайд и схема согласованы')
process.exit(failed ? 1 : 0)
