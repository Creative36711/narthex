/**
 * Смоук восьмого раунда фидбека, блок A (A1–A7). Требует dev-сервер на :5173.
 * Запуск: npx tsx scripts/feedback8-A-smoke.mts
 *
 *   A1 лес: «Первый визит» больше не перебивает засаду
 *   A2 «Обучение заново» убрано из главного меню
 *   A3 множественные значения в условиях потребностей
 *   A4 карта: во весь экран, названия по наведению/галочке
 *   A5 «Сцена по прибытии» у локации
 *   A6 переходы только внутри локации
 *   A7 настройки бросков d100 (dice_rules)
 */
import { readFileSync } from 'node:fs'
import { loadCampaign } from '../src/core/loader'
import { GameEngine } from '../src/core/engine'
import { skillCheck } from '../src/core/brp'
import { PRNG } from '../src/core/prng'
import { migrateNeedCondition } from '../src/shared/migrate'
import type { DiceRules, NeedCondition } from '../src/shared/types'
import { DEFAULT_DICE_RULES } from '../src/shared/types'

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

// ── A1: лес: сначала бой, сообщение — только после победы ──
{
  const rule = campaign.rules['rule_forest_intro']
  check('A1 правило называется «Опушка после засады»', rule.label === 'Опушка после засады', rule.label)
  const types = rule.conditions.map((c) => c.type)
  check(
    'A1 условия: вход в лес + флаг засады',
    types.includes('player_enters_location') && types.includes('flag_set'),
    types.join(','),
  )

  const e = new GameEngine(campaign)
  e.start()
  // идём в лес — должна начаться засада, а не сообщение
  e.travelTo('loc_forest')
  check('A1 первый вход в лес начинает бой', !!e.combat, e.combat ? e.combat.arena.label : 'боя нет')
  check('A1 сообщения «Опушка снова тиха» нет до победы', !e.messages.some((m) => m.text.includes('Опушка снова тиха')))

  // побеждаем: обнуляем врагов и закрываем бой
  for (const c of e.combat!.combatants) if (c.side === 'enemy') c.dead = true
  ;(e.combat as any).checkEnd()
  e.endCombat()
  check('A1 флаг засады выставлен после победы', !!e.state.flags['forest_ambush_cleared'])
  check(
    'A1 после победы показано сообщение про опушку',
    e.messages.some((m) => m.text.includes('Опушка снова тиха')),
    e.messages.map((m) => m.text.slice(0, 20)).join(' | '),
  )

  // повторный вход — тишина (правило одноразовое)
  e.messages.length = 0
  e.goToScene('scene_market')
  e.travelTo('loc_forest')
  check('A1 повторный вход в лес — без сообщения', !e.messages.some((m) => m.text.includes('Опушка снова тиха')))
  if (e.combat) {
    // случайная встреча в пути не в счёт — закрываем её и проверяем снова
    for (const c of e.combat.combatants) if (c.side === 'enemy') c.dead = true
    ;(e.combat as any).checkEnd()
    e.endCombat()
    check('A1 после случайной встречи сообщения про опушку тоже нет', !e.messages.some((m) => m.text.includes('Опушка снова тиха')))
  }
}

// ── A2: «Обучение заново» только в справке ──
{
  const menu = readFileSync('src/player/MainMenu.tsx', 'utf8')
  check('A2 в главном меню нет «Обучение заново»', !menu.includes('Обучение заново'))
  const help = readFileSync('src/player/HelpPanel.tsx', 'utf8')
  check('A2 в справке кнопка осталась', help.includes('Обучение заново') && help.includes('resetTips()'))
}

// ── A3: множественные значения в условиях потребностей ──
{
  const warmth = campaign.meta.needs.find((n) => n.id === 'warmth')!
  const inLoc = warmth.decay_when!.find((c) => c.type === 'in_location') as Extract<NeedCondition, { type: 'in_location' }>
  check('A3 «герой в локации» — список', Array.isArray(inLoc.locations), JSON.stringify(inLoc))
  check('A3 список мест с теплом: таверна, казарма, храм', inLoc.locations.length === 3 && inLoc.not === true, inLoc.locations.join(','))
  const hasItem = warmth.decay_when!.find((c) => c.type === 'has_item') as Extract<NeedCondition, { type: 'has_item' }>
  check('A3 тёплая одежда — плащ ИЛИ шуба', hasItem.items.length === 2 && hasItem.not === true, hasItem.items.join(','))

  const e = new GameEngine(campaign)
  e.start()
  const w = () => e.state.player.needs['warmth'] ?? -1
  const nightOut = () => {
    e.state.tick = 22
    e.advanceTicks(1)
  }
  // ночь на улице без одежды — мёрзнем
  ;(e.state as any).location = 'loc_forest'
  nightOut()
  check('A3 ночью на улице тепло убывает', w() === 100 - warmth.decay_per_tick, `тепло=${w()}`)
  // в храме (второй в списке) — не мёрзнем
  e.state.player.needs['warmth'] = 60
  ;(e.state as any).location = 'loc_temple'
  nightOut()
  check('A3 в храме тепло не убывает (а восстанавливается)', w() === 60 + (warmth.restore_per_tick ?? 0), `тепло=${w()}`)
  // шуба (второй предмет в списке) тоже греет
  e.state.player.needs['warmth'] = 50
  ;(e.state as any).location = 'loc_forest'
  e.addItem('item_fur_coat', 1)
  nightOut()
  check('A3 волчья шуба греет так же, как плащ', w() === 50, `тепло=${w()}`)

  // мягкая миграция старого формата
  const legacy = migrateNeedCondition({ type: 'in_location', location: 'loc_x' } as unknown as NeedCondition)
  check(
    'A3 старый формат (одна локация) мигрируется',
    legacy.type === 'in_location' && (legacy as any).locations.join() === 'loc_x',
    JSON.stringify(legacy),
  )
  const legacyItem = migrateNeedCondition({ type: 'has_item', item: 'item_x' } as unknown as NeedCondition)
  check(
    'A3 старый формат (один предмет) мигрируется',
    legacyItem.type === 'has_item' && (legacyItem as any).items.join() === 'item_x',
    JSON.stringify(legacyItem),
  )
  const ed = readFileSync('src/editor/CampaignEditor.tsx', 'utf8')
  check('A3 в редакторе мультивыбор чипами', ed.includes('ChipMultiSelect') && ed.includes('Герой в любой из локаций'))
}

// ── A4: карта ──
{
  const map = readFileSync('src/player/MapScreen.tsx', 'utf8')
  const cssMap = readFileSync('src/index.css', 'utf8')
  check('A4 карта во весь экран', /\.map-screen\s*\{[^}]*100vh/.test(cssMap) && map.includes('map-viewport'))
  check('A4 есть зум и пан', map.includes('onWheel') && map.includes('onPointerMove') && map.includes('clampPan'))
  check('A4 названия скрыты по умолчанию', map.includes('show-labels') && map.includes('readLabels'))
  check('A4 состояние галочки в localStorage', map.includes('chronicle-forge:map-labels') && map.includes('writeLabels'))
  const css = readFileSync('src/index.css', 'utf8')
  check('A4 подпись видна при наведении', css.includes('.map-pin:hover .pin-label'))
}

// ── A5: сцена по прибытии ──
{
  const gates = campaign.world.regions[0].locations.find((l) => l.id === 'loc_gates')!
  check('A5 у локации задана сцена по прибытии', gates.arrival_scene === 'scene_gates_front', String(gates.arrival_scene))
  const e = new GameEngine(campaign)
  e.start()
  e.travelTo('loc_market')
  check('A5 прибыли на рынок', e.state.location === 'loc_market' && e.state.scene === 'scene_market', e.state.scene)
  e.travelTo('loc_gates')
  check('A5 пришли к воротам — в arrival_scene', e.state.scene === 'scene_gates_front', e.state.scene)
  // без arrival_scene — первая сцена локации
  const tavern = campaign.world.regions[0].locations.find((l) => l.id === 'loc_tavern')!
  check('A5 если arrival_scene нет — берётся первая сцена', e.arrivalSceneOf(tavern) === 'scene_tavern_hall')
  const ed = readFileSync('src/editor/WorldEditor.tsx', 'utf8')
  check('A5 в редакторе есть поле «Сцена по прибытии»', ed.includes('Сцена по прибытии') && ed.includes('arrival_scene'))
}

// ── A6: переходы только внутри локации ──
{
  let cross = 0
  let legacy = 0
  for (const sc of Object.values(campaign.scenes)) {
    for (const nav of sc.navigation) {
      if ((nav as any).go_to_location) legacy++
      if (nav.go_to_scene && campaign.scenes[nav.go_to_scene]?.location !== sc.location) cross++
    }
  }
  check('A6 в демо не осталось переходов «в локацию»', legacy === 0, `найдено ${legacy}`)
  check('A6 нет переходов в чужие сцены', cross === 0, `найдено ${cross}`)
  const hasExit = Object.values(campaign.scenes).every((sc) =>
    sc.navigation.some((n) => n.open_map || n.go_to_scene),
  )
  check('A6 из каждой сцены есть выход (карта или внутренняя сцена)', hasExit)

  const types = readFileSync('src/shared/types.ts', 'utf8')
  check('A6 из формата убрано поле go_to_location', !/go_to_location\??:/.test(types))
  const sceneEd = readFileSync('src/editor/SceneEditor.tsx', 'utf8')
  check('A6 в редакторе осталось два типа перехода', sceneEd.includes('В сцену этой локации') && sceneEd.includes('Открыть карту'))
  const store = readFileSync('src/editor/store.ts', 'utf8')
  check('A6 валидатор ругается на чужие сцены', store.includes('между локациями — только через карту'))
}

// ── A7: настройки бросков d100 ──
{
  const rules: DiceRules = campaign.meta.dice_rules ?? DEFAULT_DICE_RULES
  check('A7 в демо заданы правила бросков', rules.critical_divisor === 5 && rules.special_divisor === 2 && rules.fumble_from === 96, JSON.stringify(rules))

  // детерминированные проверки порогов
  const mid = new PRNG('test-seed')
  const crit = skillCheck(100, mid) // навык 100: крит ≤ 20 при /5
  check('A7 крит при навыке 100 — бросок ≤ 20', crit.result === 'critical' ? crit.roll <= 20 : true, `${crit.roll} → ${crit.result}`)
  const rules2: DiceRules = { critical_divisor: 20, special_divisor: 5, fumble_from: 96, fumble_low_skill: 30 }
  // навык 20, классический BRP: 96–99 при навыке < 30 — тоже крит-провал
  const rng = new PRNG('fumble')
  let found = false
  for (let i = 0; i < 200 && !found; i++) {
    const r = skillCheck(20, rng, 0, rules2)
    if (r.roll >= 96 && r.roll <= 99) {
      found = true
      check('A7 классический BRP: 96–99 при навыке < 30 — крит-провал', r.result === 'fumble', `${r.roll} → ${r.result}`)
    }
  }
  check('A7 в выборке встретился бросок 96–99', found)
  const hard = skillCheck(100, new PRNG('x'), 0, { critical_divisor: 20, special_divisor: 5, fumble_from: 96 })
  check('A7 при /20 крит — бросок ≤ 5', hard.roll <= 5 ? hard.result === 'critical' : true, `${hard.roll} → ${hard.result}`)

  const ed = readFileSync('src/editor/CampaignEditor.tsx', 'utf8')
  check('A7 в редакторе секция правил бросков с пресетами', ed.includes('Правила бросков (d100)') && ed.includes('Классический BRP') && (ed.includes('Хроника (по умолчанию)') || ed.includes('Щедрые')))
  const help = readFileSync('src/player/HelpPanel.tsx', 'utf8')
  check('A7 справка показывает пороги кампании', help.includes('engine.diceRules') && help.includes('rules.critical_divisor'))
  check('A7 в справке нет захардкоженного «навыка ÷ 5»', !help.includes('навыка ÷ 5'))
}

console.log(failed ? `\nПРОВАЛОВ: ${failed}` : '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ')
process.exit(failed ? 1 : 0)
