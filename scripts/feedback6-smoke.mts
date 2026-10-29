/**
 * Смоук шестого раунда фидбека (5 пунктов). Требует dev-сервер на :5173.
 * Запуск: npx tsx scripts/feedback6-smoke.mts
 */
import { existsSync, readFileSync } from 'node:fs'
import { loadCampaign } from '../src/core/loader'
import { GameEngine } from '../src/core/engine'
import '../packs/narrative/operations'

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

const base = 'http://localhost:5173/campaigns/ash-of-caerden'
const campaign = await loadCampaign(base)
console.log(`Кампания: ${campaign.meta.title}`)

// ── №1: без «авто» и без неиспользуемых типов слотов ──
{
  const src = readFileSync('src/editor/EntityEditor.tsx', 'utf8')
  check('№1 в карточках сущностей нет «авто»', !src.includes('авто'))
  // встроенных типов слотов больше нет вообще — реестр целиком от кампании
  const slotTypesSrc = readFileSync('src/editor/slotTypes.ts', 'utf8')
  check('№1 в коде нет встроенного списка типов слотов', !slotTypesSrc.includes('BUILTIN_SLOT_TYPES'))
  const st = campaign.meta.slot_types ?? []
  check('№1 неиспользуемый тип «Мебель» не объявлен мастером', !st.some((t) => t.id === 'furniture'))
  check('№1 реестр типов слотов — из кампании', st.length >= 4, st.map((t) => t.label).join(', '))
}

// ── №2: особые места по событиям важнее расписания ──
{
  const lena = campaign.entities['npc_lena'] as any
  check('№2 у Лены есть «особое место» по событию', (lena.presence_overrides ?? []).length === 1)
  const meta = campaign.meta as any
  check('№2 флаг raid_rumors в реестре', (meta.flags ?? []).some((f: any) => f.id === 'raid_rumors'))
  check(
    '№2 правило слухов ставит флаг',
    campaign.rules['rule_raid_warning'].effects.some((e: any) => e.type === 'set_flag' && e.flag === 'raid_rumors'),
  )

  const e = new GameEngine(campaign)
  e.start()
  const tavern = campaign.scenes['scene_tavern_hall']
  const corner = () => e.slotOccupants(tavern).find((o) => o.slot.id === 'slot_corner')?.entity?.id ?? null

  e.state.tick = 12 // день: по расписанию Лена спит, в углу пусто
  check('№2 днём без события угол пуст', corner() === null)
  e.state.flags['raid_rumors'] = true
  check('№2 событие активно — Лена в углу даже днём', corner() === 'npc_lena')
  const gates = campaign.scenes['scene_gates_front']
  const guard = e.slotOccupants(gates).find((o) => o.slot.id === 'slot_guard_left')?.entity?.id
  check('№2 остальные по расписанию (Алдрик на посту)', guard === 'npc_guard_aldric')
  e.state.flags['camp_cleared'] = true
  check('№2 контр-флаг снимает событие — Лена снова по расписанию', corner() === null)
}

// ── №3: удаление кампании (dev-эндпоинт) ──
{
  const { createCampaign } = await import('../src/editor/newCampaign')
  const origFetch = globalThis.fetch
  globalThis.fetch = ((url: any, init?: any) =>
    origFetch(String(url).startsWith('http') ? url : 'http://localhost:5173' + url, init)) as any
  const id = await createCampaign('Кампания на удаление')
  check('№3 кампания создана', existsSync(`public/campaigns/${id}/campaign.json`))
  const del = await origFetch('http://localhost:5173/__editor/delete', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: id }),
  })
  check('№3 эндпоинт удаления отвечает ok', del.ok)
  check('№3 файлы кампании стёрты с диска', !existsSync(`public/campaigns/${id}`))
  // реестр: убрать запись
  const idx = ((await (await origFetch(`http://localhost:5173/campaigns/index.json?t=${Date.now()}`)).json()) as Array<{ id: string }>).filter(
    (c) => c.id !== id,
  )
  await origFetch('http://localhost:5173/__editor/save', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: 'campaigns/index.json', text: JSON.stringify(idx, null, 2) }),
  })
  globalThis.fetch = origFetch
}

// ── №4/№5: рендер между сменой кампании и загрузкой не падает ──
{
  const { EditorStore } = await import('../src/editor/store')
  const st = new EditorStore('http://localhost:5173/campaigns/ash-of-caerden')
  // ДО load(): именно это состояние раньше роняло редактор чёрным экраном
  check('№4 scenePaths() до загрузки — пустой список, не краш', Array.isArray(st.scenePaths()) && st.scenePaths().length === 0)
  check('№5 meta.title до загрузки — пустая строка, не краш', st.meta.title === '')
  check('№4 entityPaths/rulePaths до загрузки не падают', st.entityPaths().length === 0 && st.rulePaths().length === 0)
  await st.load()
  check('№4 после загрузки данные на месте', st.scenePaths().length > 0 && st.meta.title === 'Пепел Каэрдена')
}

console.log(failed ? `\nПРОВАЛОВ: ${failed}` : '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ')
process.exit(failed ? 1 : 0)
