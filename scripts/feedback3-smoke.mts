/**
 * Смоук третьего раунда фидбека (14 пунктов). Требует dev-сервер на :5173.
 * Запуск: npx tsx scripts/feedback3-smoke.mts
 */
import { loadCampaign } from '../src/core/loader'
import { GameEngine } from '../src/core/engine'

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

const campaign = await loadCampaign('http://localhost:5173/campaigns/ash-of-caerden')
console.log(`Кампания: ${campaign.meta.title}`)

// ── №2: отказ Алдрика запоминается между разговорами ──
{
  const e = new GameEngine(campaign)
  e.start()
  e.state.flags['aldric_ration_refused'] = true
  e.startDialogue('npc_guard_aldric')
  const has = e.dialogue!.choices.some((c) => c.text.includes('Поделишься едой'))
  check('№2 после отказа вопрос о еде не предлагается в новом разговоре', !has)
  e.endDialogue()
}
{
  const e = new GameEngine(campaign)
  e.start()
  e.startDialogue('npc_guard_aldric')
  const has = e.dialogue!.choices.some((c) => c.text.includes('Поделишься едой'))
  check('№2 без отказа вопрос о еде доступен', has)
  e.endDialogue()
}

// ── №3: сообщение о новом квесте доступно во время боя ──
{
  const e = new GameEngine(campaign)
  e.start()
  e.startQuest('quest_rats')
  e.startCombat({
    type: 'start_combat',
    enemies: [{ entity: 'npc_rat_giant', count: 2 }],
    arena: 'arena_cellar',
  } as any)
  check('№3 бой идёт', !!e.combat)
  check('№3 очередь сообщений содержит «Новый квест» во время боя', e.messages.some((m) => m.text.includes('Новый квест')))
}

// ── №4: навык brawl переводится реестром кампании ──
{
  const e = new GameEngine(campaign)
  e.start()
  check('№4 skillLabel(brawl) по-русски', e.skillLabel('brawl') !== 'brawl', e.skillLabel('brawl'))
  const all = Object.keys(e.state.player.skills)
  const untranslated = all.filter((s) => e.skillLabel(s) === s)
  check('№4 все навыки героя переведены', untranslated.length === 0, untranslated.join(','))
}

// ── №8: категории предметов и цены ──
{
  const cats = campaign.meta.item_categories ?? []
  check('№8 реестр категорий предметов непуст', cats.length > 0, `${cats.length} категорий`)
  const catIds = new Set(cats.map((c) => c.id))
  const items = Object.values(campaign.entities).filter((x: any) => x.type === 'item') as any[]
  const missing = items.filter((i) => !catIds.has(i.category)).map((i) => i.id)
  check('№8 все предметы демо в известных категориях', missing.length === 0, missing.join(','))

  const e = new GameEngine(campaign)
  e.start()
  check('№8 основная валюта — silver', e.mainCurrency === 'silver')
  const bran = campaign.entities['npc_bran'] as any
  const price = e.buyPrice(bran, 'item_healing_salve')
  check('№8 цена мази у Брана считается от value.silver=12', price >= 8 && price <= 20, `цена ${price}`)
}

// ── №9: фракция крыс существует; дроп и жетон ──
{
  const factions = campaign.meta.factions ?? []
  const rat = campaign.entities['npc_rat_giant'] as any
  check('№9 фракция крысы есть в реестре', factions.some((f) => f.id === rat.faction), String(rat.faction))
  check('№9 у крысы есть таблица дропа', Array.isArray(rat.loot_table) && rat.loot_table.length > 0)
  const e = new GameEngine(campaign)
  e.start()
  e.startCombat({ type: 'start_combat', enemies: [{ entity: 'npc_rat_giant', count: 2 }], arena: 'arena_cellar' } as any)
  const c = e.combat!
  for (const u of c.combatants) if (u.side === 'enemy') { u.hp = 0; (u as any).dead = true }
  ;(c as any).checkEnd()
  check('№9 бой завершён победой', c.result === 'victory')
  check('№9 rollLoot не падает (лут — массив)', Array.isArray(c.loot), `выпало ${c.loot.length}`)
}

// ── №12: у стадий всех квестов есть русские названия ──
{
  const bad: string[] = []
  for (const q of Object.values(campaign.quests) as any[]) {
    for (const st of q.stages) if (!st.label) bad.push(`${q.id}/${st.id}`)
  }
  check('№12 все стадии квестов имеют название', bad.length === 0, bad.join(','))
}

// ── №14: реестр кампаний доступен ──
{
  const res = await fetch('http://localhost:5173/campaigns/index.json')
  const idx = (await res.json()) as any[]
  check('№14 index.json кампаний читается', Array.isArray(idx) && idx.length > 0, `${idx.length} кампаний`)
}

console.log(failed ? `\nПРОВАЛЕНО ПРОВЕРОК: ${failed}` : '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ')
process.exit(failed ? 1 : 0)
