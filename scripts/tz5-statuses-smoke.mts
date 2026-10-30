/**
 * Смоук блока 5 ТЗ «Гибкий движок» — статусы.
 * Требует dev-сервер на :5173. Запуск: npx tsx scripts/tz5-statuses-smoke.mts
 *
 *  1. мир: DoT через тики, истечение + on_expire, статус не убивает (мин. 1);
 *  2. модификатор навыка виден в проверке;
 *  3. условие has_status;
 *  4. бой: статус тикает по раундам, истекает; DoT добивает; мир-статус в бой не идёт;
 *  5. диалоги: кодогенерация и внешние функции;
 *  6. редактор: вкладка «Статусы и способности», схемы, чипы игрока;
 *  7. монолит гоняет реестр статусов.
 */
import { readFileSync } from 'node:fs'
import { loadCampaign } from '../src/core/loader'
import { GameEngine } from '../src/core/engine'
import '../packs/narrative/operations'
import { evalCondition } from '../src/core/conditions'
import { EditorStore } from '../src/editor/store'
import { exportMonolith, importMonolith, parseMonolith } from '../src/editor/monolith'
import { generateInk } from '../src/editor/dialogueDoc'
import type { CampaignData, StatusDef } from '../src/shared/types'

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
const demo = await loadCampaign(base)

const STATUSES: StatusDef[] = [
  {
    id: 'status_poison',
    label: 'Отравление',
    scope: 'world',
    duration: 3,
    dot: { hp: 2 },
    on_expire: [{ type: 'set_flag', flag: 'poison_cured' }],
    apply_message: 'Яд разливается по жилам.',
    expire_message: 'Яд выветрился.',
  },
  {
    id: 'status_weak',
    label: 'Слабость',
    scope: 'world',
    duration: 5,
    skill_mods: [{ skill: 'spot', delta: -50 }],
  },
  {
    id: 'status_bleed',
    label: 'Кровотечение',
    scope: 'combat',
    duration: 10,
    dot: { hp: 5 },
  },
]

function withStatuses(): CampaignData {
  return { ...demo, meta: { ...demo.meta, statuses: JSON.parse(JSON.stringify(STATUSES)) } }
}

// ── 1. мир: DoT, истечение, минимальный порог ──
{
  const e = new GameEngine(withStatuses())
  e.start()
  e.applyEffects([{ type: 'apply_status', target: 'player', status: 'status_poison' }])
  check('1 apply_status: статус наложен', e.hasStatus('status_poison'))
  check('1 повторное наложение не дублирует', (() => {
    e.applyEffects([{ type: 'apply_status', target: 'player', status: 'status_poison' }])
    return (e.state.player.statuses ?? []).length === 1
  })())
  e.state.player.hp = 4 // 3 тика по −2: без пола было бы −2; пол = 1
  const tick0 = e.state.tick
  e.advanceTicks(3)
  check('1 DoT снимает HP, но не ниже 1', e.state.player.hp === 1, `hp=${e.state.player.hp}`)
  check('1 статус истёк через 3 тика', !e.hasStatus('status_poison'))
  check('1 on_expire применился', !!e.state.flags['poison_cured'])
  check('1 боевой статус в мире не накладывается', (() => {
    e.applyEffects([{ type: 'apply_status', target: 'player', status: 'status_bleed' }])
    return !e.hasStatus('status_bleed')
  })())
  // remove_status
  e.applyEffects([{ type: 'apply_status', target: 'player', status: 'status_weak', duration: 9 }])
  check('1 duration из эффекта перекрывает реестр', (e.state.player.statuses ?? [])[0]?.left === 9)
  e.applyEffects([{ type: 'remove_status', target: 'player', status: 'status_weak' }])
  check('1 remove_status снимает статус', !e.hasStatus('status_weak'))
  void tick0
}

// ── 2. модификатор навыка ──
{
  const e = new GameEngine(withStatuses())
  e.start()
  e.state.player.skills['spot'] = 60
  ;(e as any).rng = { int: () => 55, next: () => 0.55 }
  const clean = e.playerSkillCheck('spot', 50) // цель 60, бросок 55 → успех
  check('2 без статуса: проверка успешна', clean.success === true, `цель=${clean.target}`)
  e.applyEffects([{ type: 'apply_status', target: 'player', status: 'status_weak' }])
  const weak = e.playerSkillCheck('spot', 50) // цель 10, бросок 55 → провал
  check('2 со статусом: модификатор −50 виден в цели', weak.target === 10, `цель=${weak.target}`)
  check('2 со статусом: проверка провалена', weak.success === false)
}

// ── 3. условие has_status ──
{
  const e = new GameEngine(withStatuses())
  e.start()
  const cond = { type: 'has_status' as const, status: 'status_weak' }
  check('3 has_status: до наложения ложно', evalCondition(cond, e) === false)
  e.applyEffects([{ type: 'apply_status', target: 'player', status: 'status_weak' }])
  check('3 has_status: после наложения истинно', evalCondition(cond, e) === true)
}

// ── 4. бой: тики по раундам, истечение, добивание ──
{
  const e = new GameEngine(withStatuses())
  e.start()
  e.startCombat({ type: 'start_combat', enemies: [{ entity: 'npc_bandit', count: 1 }], arena: 'arena_cellar' })
  const combat = e.combat!
  const player = combat.combatants.find((c) => c.id === 'c_player')!
  const bandit = combat.combatants.find((c) => c.side === 'enemy')!
  player.hp = 500
  // броня гасит любой урон бандита: тест меряет ТОЛЬКО урон кровотечения,
  // иначе исход вражеских бросков делал проверку недетерминированной
  player.armor = 99
  combat.applyStatusTo(player.id, 'status_bleed', 2)
  check('4 боевой статус наложен', player.statuses.some((s) => s.id === 'status_bleed'))
  check('4 мир-статус в бою не накладывается', (() => {
    combat.applyStatusTo(player.id, 'status_weak')
    return !player.statuses.some((s) => s.id === 'status_weak')
  })())
  // детерминизм: тест меряет ТОЛЬКО урон кровотечения — враг обязан
  // промахнуться (броня 99 гасит обычный удар, но крит иногда её пробивает,
  // и проверка «−5 HP» падала через раз)
  ;(e as any).rng = { next: () => 0.99, int: () => 100, chance: () => false, pick: (a: unknown[]) => a[0] }
  const hpBefore = player.hp
  let guard = 0
  while (combat.round < 2 && guard++ < 10 && !combat.result) combat.playerEndTurn()
  check('4 раунд прошёл', combat.round >= 2, `раунд=${combat.round}`)
  check('4 DoT в бою снял HP', player.hp === hpBefore - 5, `hp ${hpBefore} → ${player.hp}`)
  check('4 длительность уменьшилась', player.statuses.find((s) => s.id === 'status_bleed')?.left === 1)
  guard = 0
  while (combat.round < 3 && guard++ < 10 && !combat.result) combat.playerEndTurn()
  check('4 статус истёк в бою', !player.statuses.some((s) => s.id === 'status_bleed'))
  // добивание: у врага 1 HP и кровотечение — на границе раунда умирает
  bandit.hp = 1
  combat.applyStatusTo(bandit.id, 'status_bleed', 2)
  guard = 0
  while (!combat.result && guard++ < 10) combat.playerEndTurn()
  check('4 DoT в бою добивает', combat.result === 'victory', `результат=${combat.result}`)
}

// ── 5. диалоги: кодогенерация и внешние функции ──
{
  const ink = generateInk({
    version: 2,
    label: 'тест',
    start: 'n1',
    nodes: [
      {
        id: 'n1',
        sections: [{
          conds: [{ type: 'has_status', status: 'status_poison' }],
          steps: [{ kind: 'line', line: { text: 'Вы отравлены.' } }, { kind: 'effect', effect: { type: 'remove_status', status: 'status_poison' } }],
        }],
        choices: [],
      },
      {
        id: 'n2',
        sections: [{ steps: [{ kind: 'effect', effect: { type: 'apply_status', status: 'status_poison', duration: 4 } }] }],
        choices: [],
      },
    ],
  })
  check('5 ink: условие has_status', ink.includes('has_status("status_poison")'))
  check('5 ink: эффект remove_status', ink.includes('~ remove_status("status_poison")'))
  check('5 ink: эффект apply_status с длительностью', ink.includes('~ apply_status("status_poison", 4)'))
  const dlg = readFileSync('packs/narrative/dialogue.ts', 'utf8')
  check('5 externals привязаны', dlg.includes("bind('has_status'") && dlg.includes("bind('apply_status'"))
}

// ── 6. редактор и UI игрока ──
{
  const ce = readFileSync('src/editor/CampaignEditor.tsx', 'utf8')
  check('6 вкладка «Статусы и способности»', ce.includes('Статусы и способности') && ce.includes('StatusRegistry'))
  check('6 форма статуса: DoT, навыки, движение', ce.includes('Урон HP за тик') && ce.includes('Модификаторы навыков') && ce.includes('Движение'))
  const schemas = readFileSync('src/editor/schemas.ts', 'utf8')
  check('6 схемы эффектов/условия', schemas.includes('apply_status:') && schemas.includes('remove_status:') && schemas.includes('has_status:'))
  const hud = readFileSync('src/player/HUD.tsx', 'utf8')
  check('6 чипы статусов в HUD', hud.includes('hud-status-chip'))
  const roster = readFileSync('src/player/CombatScreen.tsx', 'utf8')
  check('6 статусы в ростере и тултипе боя', roster.includes('roster-status') && roster.includes('statusLabel'))
}

// ── 7. монолит ──
{
  const store = new EditorStore(base)
  await store.load()
  store.meta = { ...store.meta, statuses: JSON.parse(JSON.stringify(STATUSES)) }
  store.touch('campaign.json')
  const { doc } = exportMonolith(store)
  check('7 экспорт: статусы в кампании', doc.campaign.statuses?.length === 3)
  const store2 = new EditorStore(base)
  await store2.load()
  importMonolith(store2, parseMonolith(JSON.stringify(doc)))
  check('7 импорт: статусы на месте', store2.meta.statuses?.some((s) => s.id === 'status_bleed'))
}

if (failed > 0) {
  console.error(`\nПРОВАЛЕНО ПРОВЕРОК: ${failed}`)
  process.exit(1)
}
console.log('\nALL GREEN (tz5-statuses)')
