/**
 * Смоук публикации версии кампании из редактора (`docs/compatibility.md`, фаза B).
 * Требует dev-сервер на :5173. Запуск: npx tsx scripts/compat-publish-smoke.mts
 *
 *  1. инвентаризация пакета: объекты и отпечаток;
 *  2. первая публикация: контракт compat.json без ломающих изменений;
 *  3. applyPublish: версия, мин. движок и формат пакета в campaign.json;
 *  4. контракт попадает в экспорт (.chronicle);
 *  5. сравнение с прежней версией: удаление объекта → ломающее изменение
 *     и save_base_version = новая версия.
 */
import { EditorStore } from '../src/editor/store'
import { applyPublish, planPublish, storeInventory } from '../src/editor/compatPublish'
import { COMPAT_FORMAT, diffInventories, inventoryOf } from '../src/shared/compat'
import { PACKAGE_FORMAT, stableVersion } from '../src/shared/versions'
import type { CampaignCompat } from '../src/shared/types'

const mem = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => mem.set(k, v),
  removeItem: (k: string) => mem.delete(k),
}

let failed = 0
function check(name: string, ok: boolean, extra = '') {
  console.log(`${ok ? '✓' : '✗ FAIL'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!ok) failed++
}

const store = new EditorStore('http://localhost:5173/campaigns/ash-of-caerden')
await store.load()

// ── 1. инвентаризация ──
const inv = storeInventory(store)
{
  const total = Object.values(inv.ids).reduce((n, l) => n + l.length, 0)
  check('1 инвентаризация нашла объекты', total > 50, `${total} объектов, ${Object.keys(inv.ids).length} видов`)
  check('1 отпечаток стабильный', inv.digest === storeInventory(store).digest, inv.digest)
  check('1 сцены учтены', (inv.ids.scene?.length ?? 0) === store.manifest.scenes.length, `${inv.ids.scene?.length}/${store.manifest.scenes.length}`)
  check('1 стадии квестов учтены', (inv.ids.quest_stage?.length ?? 0) > 0, String(inv.ids.quest_stage?.length))
  check('1 косметика не влияет на отпечаток', (() => {
    const a = storeInventory(store)
    const title = store.meta.title
    store.meta.title = 'Другое название'
    const b = storeInventory(store)
    store.meta.title = title
    return a.digest === b.digest
  })())
  check('1 баланс влияет на отпечаток', (() => {
    const a = storeInventory(store)
    const was = store.meta.needs[0].decay_per_tick
    store.meta.needs[0].decay_per_tick = was + 1
    const b = storeInventory(store)
    store.meta.needs[0].decay_per_tick = was
    return a.digest !== b.digest
  })())
}

// ── 2–3. первая публикация ──
{
  const plan = await planPublish(store)
  check('2 без compat.json — первая публикация', plan.previous === null)
  check('2 ломающих изменений нет', plan.diff.breaking === false)
  check('2 контракт формата chronicle-compat/1', plan.compat.format === COMPAT_FORMAT)
  check('2 база сохранений не задана (поддерживаются все)', plan.compat.save_base_version === '')
  check('2 в контракте отпечаток инвентаризации', plan.compat.inventory_digest === inv.digest)

  const paths = applyPublish(store, plan, '1.0.0', 'Первая публикация')
  check('3 записаны compat.json и campaign.json', paths.includes('compat.json') && paths.includes('campaign.json'), paths.join(', '))
  const compat = store.jsonFiles.get('compat.json') as CampaignCompat
  check('3 compat.json в сторе', compat?.format === COMPAT_FORMAT && compat.version === '1.0.0')
  check('3 версия кампании поднята', store.meta.version === '1.0.0', store.meta.version)
  check('3 мин. движок записан', !!store.meta.min_engine, store.meta.min_engine ?? '')
  check('3 формат пакета записан', store.meta.package_format === PACKAGE_FORMAT, String(store.meta.package_format))
  check('3 save_base_version не навязан', store.meta.save_base_version === undefined)
  check('3 заметка автора сохранена', compat.notes === 'Первая публикация')

  // ── 4. экспорт ──
  check('4 compat.json попадает в экспорт', store.allPaths().includes('compat.json'), store.allPaths().filter((p) => p.includes('compat')).join(','))
}

// ── 5. сравнение с прежней версией ──
{
  const prev: CampaignCompat = {
    format: COMPAT_FORMAT,
    version: '1.0.0',
    save_base_version: '',
    inventory_digest: inv.digest,
    breaks: [],
    updated_at: new Date().toISOString(),
  }
  // «мастер удалил НПС» — инвентаризация без него
  const npcId = inv.ids.npc?.[0] ?? ''
  const nextInv = inventoryOf({
    meta: store.meta,
    world: store.world,
    sections: {
      scenes: {},
      entities: Object.fromEntries(
        [...store.jsonFiles].filter(([p]) => p.startsWith('entities/')).map(([p, v]) => [p, v]).filter(([, v]) => (v as { id?: string }).id !== npcId),
      ),
      rules: {},
      quests: {},
    },
  })
  const prevInv = { ...inv, version: '1.0.0' }
  const diff = diffInventories(prevInv, nextInv)
  check('5 удаление НПС найдено', diff.entries.some((e) => e.op === 'removed' && e.kind === 'npc' && e.id === npcId), npcId)
  check('5 изменение ломающее', diff.breaking === true)
  check('5 у поломки есть последствие по-русски', !!diff.breaks[0]?.impact && /[а-яА-Я]/.test(diff.breaks[0].impact), diff.breaks[0]?.impact.slice(0, 40))
  // контракт с прежней публикацией: база сохранений = новая версия
  const broken: CampaignCompat = { ...prev, breaks: diff.breaks }
  const plan2 = await planPublish(store)
  const compat2 = { ...plan2.compat, version: '2.0.0', save_base_version: diff.breaking ? stableVersion('2.0.0') : '' }
  check('5 база сохранений поднята до новой версии', compat2.save_base_version === '2.0.0', compat2.save_base_version)
  check('5 прежний контракт читается как структура', broken.format === COMPAT_FORMAT && broken.breaks.length === diff.breaks.length)
  check('5 косметика не делает обновление ломающим', (() => {
    const cosmetic = { ...inv, version: '1.0.1' }
    return diffInventories(inv, cosmetic).breaking === false
  })())
}

console.log(failed === 0 ? '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ (compat-publish)' : `\nПРОВАЛЕНО ПРОВЕРОК: ${failed}`)
process.exit(failed === 0 ? 0 : 1)
