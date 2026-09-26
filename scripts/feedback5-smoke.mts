/**
 * Смоук пятого раунда фидбека (5 пунктов). Требует dev-сервер на :5173.
 * Запуск: npx tsx scripts/feedback5-smoke.mts
 */
import { readFileSync } from 'node:fs'
import { loadCampaign } from '../src/core/loader'
import { GameEngine } from '../src/core/engine'
import { effectiveSlotType } from '../src/editor/slotTypes'

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

// ── №1: атака завершает ход автоматически ──
{
  const e = new GameEngine(campaign)
  e.start()
  e.startCombat((campaign.rules['encounter_cellar_rats'].effects[0]) as any)
  const c = e.combat! as any
  // игрока не убить за раунд — тест не про урон
  const pc = c.combatants.find((u: any) => u.id === 'c_player')
  pc.hp = 500
  pc.maxHp = 500
  // подвести врага вплотную и атаковать
  const enemy = c.combatants.find((u: any) => u.side === 'enemy' && !u.dead)
  enemy.pos = { col: pc.pos.col + 1, row: pc.pos.row }
  check('№1 ход игрока в начале боя', c.isPlayerTurn())
  const roundBefore = c.round
  c.playerAttack(enemy.id)
  if (!c.result) {
    // после атаки ход завершился сам: враги отходили, начался новый раунд,
    // и снова ход игрока с несброшенной атакой
    check('№1 после атаки ход перешёл дальше без «Завершить ход»', c.isPlayerTurn())
    check('№1 начался следующий раунд', c.round === roundBefore + 1, `round=${c.round}`)
    check('№1 действие атаки в новом раунде снова доступно', !pc.attacked)
  } else {
    check('№1 бой закончился с первой атаки (крыса убита) — авто-ход не потребовался', true)
  }
}

// ── №2/№3: типы слотов — фильтрация и согласованность контента ──
{
  // встроенных типов НЕТ — реестр задаёт только кампания (мастер)
  const st = campaign.meta.slot_types ?? []
  check('№2 реестр типов слотов берётся из кампании (не встроенный)', st.length >= 4, st.map((t) => t.label).join(', '))
  const stIds = new Set(st.map((t) => t.id))
  check('№2 нужные типы объявлены мастером', ['person', 'item', 'container', 'animal'].every((id) => stIds.has(id)))
  const rat = campaign.entities['npc_rat_giant'] as any
  check('№3 крыса — «животное» в слотах', effectiveSlotType(rat) === 'animal')
  check('№3 НПС по умолчанию — «персонаж»', effectiveSlotType(campaign.entities['npc_bran'] as any) === 'person')
  check('№3 бочка — «контейнер»', effectiveSlotType(campaign.entities['item_water_barrel'] as any) === 'container')
  check('№3 хлеб — «предмет»', effectiveSlotType(campaign.entities['item_bread'] as any) === 'item')
  // каждый заданный default_entity подходит слоту по типу
  const bad: string[] = []
  for (const sc of Object.values(campaign.scenes)) {
    for (const sl of sc.slots) {
      if (!sl.default_entity) continue
      const ent = campaign.entities[sl.default_entity] as any
      if (!ent) { bad.push(`${sc.id}/${sl.id}: нет сущности`); continue }
      if (sl.type.length > 0 && !sl.type.includes(effectiveSlotType(ent)))
        bad.push(`${sc.id}/${sl.id}: ${effectiveSlotType(ent)} ∉ [${sl.type}]`)
    }
  }
  check('№2 все сущности в слотах демо подходят по типу', bad.length === 0, bad.join('; '))
  // у всех слотов демо есть названия (для расписаний)
  const noLabel: string[] = []
  for (const sc of Object.values(campaign.scenes))
    for (const sl of sc.slots) if (!(sl as any).label) noLabel.push(`${sc.id}/${sl.id}`)
  check('№2 у всех слотов демо есть названия', noLabel.length === 0, noLabel.join(', '))
}

// ── №4: присутствие НПС — расписание в данных, не хардкод ──
{
  const e = new GameEngine(campaign)
  e.start()
  const gates = campaign.scenes['scene_gates_front']
  const guardSlot = (occ: ReturnType<typeof e.slotOccupants>) =>
    occ.find((o) => o.slot.id === 'slot_guard_left')?.entity?.id ?? null

  e.state.tick = 10 // утро/день
  check('№4 днём Алдрик на посту у ворот', guardSlot(e.slotOccupants(gates)) === 'npc_guard_aldric')
  e.state.tick = 23 // ночь
  check('№4 ночью пост у ворот пуст', guardSlot(e.slotOccupants(gates)) === null)

  const market = campaign.scenes['scene_market']
  const branSlot = (occ: ReturnType<typeof e.slotOccupants>) =>
    occ.find((o) => o.slot.id === 'slot_stall_bran')?.entity?.id ?? null
  e.state.tick = 12
  check('№4 днём Бран за прилавком', branSlot(e.slotOccupants(market)) === 'npc_bran')
  e.state.tick = 23
  check('№4 ночью прилавок пуст', branSlot(e.slotOccupants(market)) === null)

  const aldric = campaign.entities['npc_guard_aldric'] as any
  check('№4 расписание Алдрика — данные кампании (3 записи)', (aldric.schedule ?? []).length === 3)
}

// ── №5: создание кампании и понятные ошибки загрузки ──
{
  const cfg = readFileSync('vite.config.ts', 'utf8')
  check('№5 vite не перезагружает страницу при записи кампаний', cfg.includes("ignored: ['**/public/campaigns/**']"))

  const { EditorStore } = await import('../src/editor/store')
  // несуществующая кампания → понятная ошибка, а не «unexpected token <»
  const broken = new EditorStore('http://localhost:5173/campaigns/no-such-campaign')
  let msg = ''
  try {
    await broken.load()
  } catch (err) {
    msg = String(err)
  }
  check('№5 ошибка загрузки — понятная, по-русски', /отсутствует|повреждён|Не удалось/i.test(msg), msg.slice(0, 80))

  // полный цикл: создать кампанию → открыть в сторе → удалить артефакты теста
  const { createCampaign } = await import('../src/editor/newCampaign')
  const origFetch = globalThis.fetch
  globalThis.fetch = ((url: any, init?: any) =>
    origFetch(String(url).startsWith('http') ? url : 'http://localhost:5173' + url, init)) as any
  const id = await createCampaign('Дымовая проверка')
  const st = new EditorStore(`http://localhost:5173/campaigns/${id}`)
  await st.load()
  check('№5 созданная кампания открывается в редакторе', st.meta.title === 'Дымовая проверка')
  check('№5 в новой кампании есть стартовая сцена', st.scenePaths().length === 1)
  // уборка: удалить тестовую кампанию с диска и из реестра
  await origFetch('http://localhost:5173/__editor/delete', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: id }),
  })
  const idxRes = await origFetch(`http://localhost:5173/campaigns/index.json?t=${Date.now()}`)
  const idx = ((await idxRes.json()) as Array<{ id: string }>).filter((c) => c.id !== id)
  await origFetch('http://localhost:5173/__editor/save', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: 'campaigns/index.json', text: JSON.stringify(idx, null, 2) }),
  })
  globalThis.fetch = origFetch
}

console.log(failed ? `\nПРОВАЛОВ: ${failed}` : '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ')
process.exit(failed ? 1 : 0)
