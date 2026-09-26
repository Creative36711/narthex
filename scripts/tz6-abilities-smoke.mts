/**
 * Смоук блока 6 ТЗ «Гибкий движок» — боевые способности и мораль.
 * Требует dev-сервер на :5173. Запуск: npx tsx scripts/tz6-abilities-smoke.mts
 *
 *  1. способность-урон: урон прошёл, MP списаны, кулдаун пошёл;
 *  2. способность-статус: статус на цели тикает и истекает;
 *  3. лечение союзника;
 *  4. мораль: враг при 100% шансе сбегает — победа без лута с него;
 *  5. детерминизм: один seed — один исход;
 *  6. демо-контент и редактор.
 */
import { readFileSync } from 'node:fs'
import { loadCampaign } from '../src/core/loader'
import { GameEngine } from '../src/core/engine'
import { PRNG } from '../src/core/prng'
import type { CampaignData } from '../src/shared/types'
import type { CombatController } from '../src/core/combat'

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

function synthCampaign(playerAbilities: string[], banditMorale?: { below_hp_pct: number; flee_chance: number }): CampaignData {
  const c: CampaignData = JSON.parse(JSON.stringify(demo))
  c.meta.abilities = [
    { id: 'ability_fire', label: 'Огненный шар', mp_cost: 4, cooldown_rounds: 2, range: 99, kind: 'damage', damage: '1d6+2' },
    { id: 'ability_venom', label: 'Ядовитый плевок', mp_cost: 2, range: 99, kind: 'status', status: 'status_test_poison', status_duration: 2 },
    { id: 'ability_heal', label: 'Молитва', mp_cost: 3, range: 99, kind: 'heal', heal: '2d6' },
  ]
  c.meta.statuses = [
    ...(c.meta.statuses ?? []),
    // реестр — 5 раундов; эффект способности даст 2 (проверка приоритета)
    { id: 'status_test_poison', label: 'Тестовый яд', scope: 'combat', duration: 5, dot: { hp: 3 } },
  ]
  const playerDef = c.entities['player_mercenary'] as Record<string, unknown>
  if (playerDef) playerDef.abilities = playerAbilities
  if (banditMorale) {
    const bandit = c.entities['npc_bandit'] as Record<string, unknown>
    if (bandit) bandit.morale = banditMorale
  }
  return c
}

function untilPlayerTurn(combat: CombatController): void {
  let guard = 0
  while (!combat.isPlayerTurn() && !combat.result && guard++ < 20) combat.playerEndTurn()
}

// ── 1. способность-урон ──
{
  const e = new GameEngine(synthCampaign(['ability_fire']))
  e.start()
  ;(e as any).rng = new PRNG('tz6-dmg')
  e.startCombat({ type: 'start_combat', enemies: [{ entity: 'npc_bandit', count: 1 }], arena: 'arena_cellar' })
  const combat = e.combat!
  untilPlayerTurn(combat)
  const pc = combat.combatants.find((c) => c.id === 'c_player')!
  const bandit = combat.combatants.find((c) => c.side === 'enemy')!
  const mp0 = pc.mp
  const hp0 = bandit.hp
  const before = combat.playerAbilities()
  check('1 способность доступна', before.some((a) => a.def.id === 'ability_fire' && a.usable))
  combat.useAbility('ability_fire', bandit.id)
  check('1 урон прошёл (1d6+2, без навыка — гарантированно)', bandit.hp < hp0, `hp ${hp0} → ${bandit.hp}`)
  check('1 MP списаны', pc.mp === mp0 - 4, `mp ${mp0} → ${pc.mp}`)
  check('1 кулдаун пошёл', (pc.cooldowns['ability_fire'] ?? 0) >= 1 && (pc.cooldowns['ability_fire'] ?? 0) <= 2)
  check('1 MP игрока синхронизирован в мир', e.state.player.mp === pc.mp)
}

// ── 2. способность-статус ──
{
  const e = new GameEngine(synthCampaign(['ability_venom']))
  e.start()
  ;(e as any).rng = new PRNG('tz6-status')
  e.startCombat({ type: 'start_combat', enemies: [{ entity: 'npc_bandit', count: 1 }], arena: 'arena_cellar' })
  const combat = e.combat!
  untilPlayerTurn(combat)
  const bandit = combat.combatants.find((c) => c.side === 'enemy')!
  bandit.hp = 50
  combat.useAbility('ability_venom', bandit.id)
  check('2 статус наложен на цель', bandit.statuses.some((s) => s.id === 'status_test_poison'))
  const left0 = bandit.statuses.find((s) => s.id === 'status_test_poison')!.left
  // 2 из эффекта (не 5 из реестра); −1 если в этом же вызове прошла граница раунда
  check('2 длительность из эффекта, а не из реестра', left0 <= 2 && left0 >= 1, `left=${left0}`)
  // тик на границе раунда
  let guard = 0
  while (combat.round < 2 && !combat.result && guard++ < 20) combat.playerEndTurn()
  check('2 DoT статуса снял HP в бою', bandit.hp === 47 || bandit.dead, `hp=${bandit.hp}`)
  guard = 0
  while (bandit.statuses.some((s) => s.id === 'status_test_poison') && !combat.result && guard++ < 20) combat.playerEndTurn()
  check('2 статус истёк по раундам', !bandit.statuses.some((s) => s.id === 'status_test_poison'))
}

// ── 3. лечение союзника ──
{
  const e = new GameEngine(synthCampaign(['ability_heal']))
  e.start()
  ;(e as any).rng = new PRNG('tz6-heal')
  e.startCombat({
    type: 'start_combat',
    enemies: [{ entity: 'npc_bandit', count: 1 }],
    allies: [{ entity: 'npc_guard_aldric', count: 1 }],
    arena: 'arena_cellar',
  })
  const combat = e.combat!
  untilPlayerTurn(combat)
  const ally = combat.combatants.find((c) => c.id.startsWith('c_tally_'))!
  ally.hp = Math.max(1, ally.hp - 5) // раним, чтобы лечение было видно
  const hp0 = ally.hp
  combat.useAbility('ability_heal', ally.id)
  check('3 союзник вылечен', ally.hp > hp0, `hp ${hp0} → ${ally.hp}`)
  check('3 MP списаны на лечение', combat.combatants.find((c) => c.id === 'c_player')!.mp <= 7)
  // лечение врага — недопустимо
  const bandit = combat.combatants.find((c) => c.side === 'enemy')!
  bandit.hp = Math.max(1, bandit.hp - 3)
  const hpB = bandit.hp
  untilPlayerTurn(combat)
  combat.useAbility('ability_heal', bandit.id)
  check('3 лечить врага нельзя', bandit.hp === hpB)
}

// ── 4. мораль и бегство ──
{
  const e = new GameEngine(synthCampaign([], { below_hp_pct: 100, flee_chance: 100 }))
  e.start()
  ;(e as any).rng = new PRNG('tz6-morale')
  e.startCombat({ type: 'start_combat', enemies: [{ entity: 'npc_bandit', count: 1 }], arena: 'arena_cellar' })
  const combat = e.combat!
  const bandit = combat.combatants.find((c) => c.side === 'enemy')!
  bandit.hp = 1
  let guard = 0
  while (!combat.result && guard++ < 20) combat.playerEndTurn()
  check('4 враг сбежал', bandit.fled === true)
  check('4 сбежавший не считается убитым', bandit.dead === false)
  check('4 бой завершился победой', combat.result === 'victory', `результат=${combat.result}`)
  check('4 лута со сбежавшего нет', combat.loot.length === 0, `лут=${combat.loot.length}`)
  check('4 строка лога о бегстве', combat.log.some((l) => l.includes('обращается в бегство')))
}

// ── 5. детерминизм: один seed — один исход ──
{
  const run = (): string => {
    const e = new GameEngine(synthCampaign(['ability_fire']))
    e.start()
    ;(e as any).rng = new PRNG('tz6-determinism')
    e.startCombat({ type: 'start_combat', enemies: [{ entity: 'npc_bandit', count: 2 }], arena: 'arena_cellar' })
    const combat = e.combat!
    let guard = 0
    while (!combat.result && guard++ < 60) combat.playerEndTurn()
    return combat.log.join('\n') + `\n[${combat.result}]`
  }
  check('5 один seed — идентичный лог боя', run() === run())
}

// ── 6. демо-контент и редактор ──
{
  check('6 демо: у крысы есть способность', (demo.entities['npc_rat_giant'] as { abilities?: string[] }).abilities?.includes('ability_rat_bite') === true)
  check('6 демо: реестр способностей и статуса яда', !!demo.meta.abilities?.some((a) => a.id === 'ability_rat_bite') && !!demo.meta.statuses?.some((s) => s.id === 'status_rat_poison'))
  const ce = readFileSync('src/editor/CampaignEditor.tsx', 'utf8')
  check('6 редактор: конструктор способностей', ce.includes('Стоимость, MP') && ce.includes('Кулдаун') && ce.includes('Дальность'))
  const ee = readFileSync('src/editor/EntityEditor.tsx', 'utf8')
  check('6 редактор НПС: способности и мораль', ee.includes('Способности и мораль') && ee.includes('Шанс бегства'))
  const cs = readFileSync('src/player/CombatScreen.tsx', 'utf8')
  check('6 экран боя: панель способностей и подсветка целей', cs.includes('playerAbilities()') && cs.includes('hex-ability'))
}

if (failed > 0) {
  console.error(`\nПРОВАЛЕНО ПРОВЕРОК: ${failed}`)
  process.exit(1)
}
console.log('\nALL GREEN (tz6-abilities)')
