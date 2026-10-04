/**
 * Охранник форм редактора (фидбек 27, пп. 1, 2, 4): мастер не должен вводить id
 * руками и не должен видеть сырые машинные значения — даже в кампании, сделанной ИИ.
 *
 *  1) схемы условий/эффектов: каждое поле либо выбор из реестра по названию, либо
 *     действительно свободный текст из белого списка; select всегда с русскими подписями;
 *  2) каждый вид поля обработан в Field (REF_KINDS ∪ SPECIAL_KINDS);
 *  3) store.options(kind) отдаёт названия, а не id (на фейковых реестрах);
 *  4) сводки правил подставляют названия.
 *
 * Без браузера и dev-сервера: `npm run smoke:editor-fields`.
 * (Живую проверку экранов делал отдельный обход в headless Chromium: см. историю коммитов.)
 */
import type { CampaignMeta, Condition, Effect } from '../src/shared/types'
import {
  CONDITION_SCHEMAS,
  EFFECT_SCHEMAS,
  REF_KINDS,
  SPECIAL_KINDS,
  conditionSummary,
  effectSummary,
  type FieldSpec,
  type TypeSchema,
} from '../src/editor/schemas'
import { EditorStore } from '../src/editor/store'

let failed = 0
const ok = (cond: boolean, label: string, extra = '') => {
  console.log(`${cond ? '✓' : '✗'} ${label}${cond || !extra ? '' : `\n    ${extra}`}`)
  if (!cond) failed++
}

// ───── 1) схемы ─────
/** поля, которые ДЕЙСТВИТЕЛЬНО свободный текст (имя, фраза, число-как-строка), а не ссылка на что-то */
const FREE_TEXT_KEYS = new Set(['text', 'label', 'intro', 'reason', 'seed', 'var'])
/** select, у которого значения — математические операторы (подписи не нужны) */
const SELECT_WITHOUT_LABELS = new Set(['operator'])

const allFields: Array<{ where: string; spec: FieldSpec }> = []
for (const [group, schemas] of [['условие', CONDITION_SCHEMAS], ['эффект', EFFECT_SCHEMAS]] as const) {
  for (const [type, schema] of Object.entries(schemas as Record<string, TypeSchema>)) {
    for (const spec of schema.fields) allFields.push({ where: `${group} ${type}.${spec.key}`, spec })
  }
}
console.log(`— схемы: ${allFields.length} полей`)

const unhandled = allFields.filter(({ spec }) => !(spec.kind in REF_KINDS) && !SPECIAL_KINDS.includes(spec.kind))
ok(unhandled.length === 0, 'каждый вид поля обработан в Field (REF_KINDS или SPECIAL_KINDS)', unhandled.map((f) => `${f.where}: ${f.spec.kind}`).join('\n    '))

const rawText = allFields.filter(({ spec }) => spec.kind === 'string' && !FREE_TEXT_KEYS.has(spec.key) && !['accent'].includes(spec.key))
ok(rawText.length === 0, 'нет текстовых полей, где мастер вводит id/значение руками', rawText.map((f) => `${f.where} («${f.spec.label}»)`).join('\n    '))

const idLabels = allFields.filter(({ spec }) => /(^|\s)id(\s|$)/i.test(spec.label) || spec.label.includes(' | ') || /^[A-Z]{2,4}$/.test(spec.placeholder ?? ''))
ok(idLabels.length === 0, 'подписи полей не просят «id …», не перечисляют значения через « | » и не подсказывают «POW»', idLabels.map((f) => `${f.where}: «${f.spec.label}»`).join('\n    '))

const unlabelled = allFields.flatMap(({ where, spec }) =>
  spec.kind === 'select' && !SELECT_WITHOUT_LABELS.has(spec.key)
    ? (spec.options ?? []).filter((o) => !spec.optionLabels?.[o]).map((o) => `${where}: «${o}»`)
    : [],
)
ok(unlabelled.length === 0, 'у каждого select есть русская подпись для каждой опции', unlabelled.join('\n    '))

// ───── 2) store.options на фейковых реестрах ─────
const store = new EditorStore('/campaigns/fake')
store.meta = {
  id: 'fake',
  title: 'Фейк',
  needs: [],
  item_categories: [{ id: 'food', label: 'Еда' }],
  passions_list: [{ id: 'pas_x', label: 'Азарт' }],
  allegiances: [{ id: 'al_x', label: 'Ложа' }],
  crimes: [{ id: 'crime_x', label: 'Кража' }],
  price_events: [{ id: 'price_x', label: 'Блокада', multiplier: 1.5 }],
  progression: { feats: [{ id: 'feat_x', label: 'Зоркий' }] },
  metaprogress: {
    currencies: [{ id: 'cur_x', label: 'Шлак памяти' }],
    achievements: [{ id: 'ach_x', label: 'Первая кровь' }],
  },
  generators: {
    event_tables: [{ id: 'tbl_x', label: 'События рынка' }],
    npc: [{ id: 'gen_n', label: 'Прохожие' }],
  },
} as unknown as CampaignMeta
store.manifest.scenes = ['s.json']
store.jsonFiles.set('scenes/s.json', {
  id: 'scene_x',
  label: 'Площадь',
  states: [{ id: 'st_a', label: 'Пеплопад' }],
  slots: [{ id: 'slot_a', label: 'Караульный' }],
})

console.log('— store.options')
const expectLabel: Array<[Parameters<EditorStore['options']>[0], string, string]> = [
  ['passion', 'pas_x', 'Азарт'],
  ['allegiance', 'al_x', 'Ложа'],
  ['crime', 'crime_x', 'Кража'],
  ['feat', 'feat_x', 'Зоркий'],
  ['metaCurrency', 'cur_x', 'Шлак памяти'],
  ['achievement', 'ach_x', 'Первая кровь'],
  ['priceEvent', 'price_x', 'Блокада'],
  ['eventTable', 'tbl_x', 'События рынка'],
  ['generator', 'gen_n', 'Прохожие (NPC)'],
  ['stat', 'POW', 'Воля (ВОЛ)'],
  ['itemCategory', 'container', 'Контейнер (хранилище)'],
]
for (const [kind, id, label] of expectLabel) {
  const got = store.options(kind).find((o) => o.id === id)?.label
  ok(got === label, `options('${kind}') даёт «${label}» для ${id}`, `получено: ${String(got)}`)
}
ok(store.labelFor('stat', 'STR') === 'Сила (СИЛ)', 'характеристики идут по порядку листа, с полными названиями')
const emptyStore = new EditorStore('/campaigns/empty')
ok(
  (Object.values(REF_KINDS) as Array<Parameters<EditorStore['options']>[0]>).every((k) => {
    try { emptyStore.options(k); return true } catch { return false }
  }),
  'options() не падает на пустой кампании ни для одного вида',
)

// ───── 3) сводки ─────
console.log('— сводки правил')
const labels = Object.assign(store, {})
const sumE = (e: Effect) => effectSummary(e, labels)
const sumC = (c: Condition) => conditionSummary(c, labels)
const noRaw = (s: string, ...raw: string[]) => raw.every((r) => !s.includes(r))
let s = sumE({ type: 'commit_crime', id: 'crime_x' } as Effect)
ok(s.includes('Кража') && noRaw(s, 'crime_x'), 'commit_crime → «Кража»', s)
s = sumE({ type: 'set_price_event', id: 'price_x' } as Effect)
ok(s.includes('Блокада') && noRaw(s, 'price_x'), 'set_price_event → «Блокада»', s)
s = sumE({ type: 'change_passion', id: 'pas_x', delta: 5 } as Effect)
ok(s.includes('Азарт') && noRaw(s, 'pas_x'), 'change_passion → «Азарт»', s)
s = sumE({ type: 'grant_feat', id: 'feat_x' } as Effect)
ok(s.includes('Зоркий') && noRaw(s, 'feat_x'), 'grant_feat → «Зоркий»', s)
s = sumE({ type: 'meta_currency', id: 'cur_x', amount: 3 } as Effect)
ok(s.includes('Шлак памяти') && noRaw(s, 'cur_x'), 'meta_currency → «Шлак памяти»', s)
s = sumE({ type: 'train_stat', stat: 'POW', delta: 1 } as Effect)
ok(s.includes('Воля') && noRaw(s, 'POW'), 'train_stat → «Воля»', s)
s = sumE({ type: 'banner', text: 'Глава', preset: 'шёпот' } as Effect)
ok(s.includes('курсив'), 'banner → пояснение наряда', s)
s = sumE({ type: 'change_scene_state', scene: 'scene_x', state: 'st_a' } as Effect)
ok(s.includes('Пеплопад') && noRaw(s, 'st_a'), 'change_scene_state → «Пеплопад»', s)
s = sumE({ type: 'spawn_entity', entity: 'e', scene: 'scene_x', slot: 'slot_a' } as Effect)
ok(s.includes('Караульный') && noRaw(s, 'slot_a'), 'spawn_entity → слот «Караульный»', s)
s = sumC({ type: 'meta_counter', key: 'endings_seen', ge: 2 } as Condition)
ok(s.includes('Увидено разных концовок') && noRaw(s, 'endings_seen'), 'meta_counter → русское название счётчика', s)
s = sumC({ type: 'power_level_ge', level: 'heroic' } as Condition)
ok(s.includes('Героический') && noRaw(s, 'heroic'), 'power_level_ge → «Героический»', s)
s = sumC({ type: 'crime_committed', id: 'crime_x' } as Condition)
ok(s.includes('Кража') && noRaw(s, 'crime_x'), 'crime_committed → «Кража»', s)
s = sumC({ type: 'meta_achievement', id: 'ach_x' } as Condition)
ok(s.includes('Первая кровь') && noRaw(s, 'ach_x'), 'meta_achievement → «Первая кровь»', s)

console.log(failed ? `\n✗ провалено проверок: ${failed}` : '\n✓ все проверки форм редактора пройдены')
process.exit(failed ? 1 : 0)
