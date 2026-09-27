/**
 * Смоук боевых правил кампании (аудит §5.6 пп.1–4).
 * Требует dev-сервер на :5173. Запуск: npx tsx scripts/combat-rules-smoke.mts
 *
 *  1. attacks_per_round: боец с оружием на 2 атаки бьёт дважды за ход,
 *     повторная атака со штрафом multi_attack_penalty (умолчание −20);
 *  2. бегство игрока: результат 'fled', эффекты on_fled, смерти нет;
 *     запрет бегства (no_flee боя и meta.combat.flee=false кампании);
 *  3. режим смерти 'brp': смертельный удар — спасбросок CON; успех —
 *     герой без сознания (1 HP), поражение без гибели, on_defeat мастера;
 *  4. режим 'instant' (умолчание): гибель как прежде;
 *  5. отдых: лечение HP костями meta.rest.hp, MP полностью; отключаемо;
 *  6. мировой спасбросок BRP (change_hp) иногда спасает, иногда нет.
 */
import { loadCampaign } from '../src/core/loader'
import { GameEngine } from '../src/core/engine'
import { PRNG } from '../src/core/prng'
import type { CampaignData, NpcDef } from '../src/shared/types'
import type { CombatController, Combatant } from '../src/core/combat'

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

function synth(mut: (c: CampaignData) => void): CampaignData {
  const c: CampaignData = JSON.parse(JSON.stringify(demo))
  mut(c)
  return c
}

function untilPlayerTurn(combat: CombatController): void {
  let guard = 0
  while (!combat.isPlayerTurn() && !combat.result && guard++ < 30) combat.playerEndTurn()
}

function findPc(combat: CombatController): Combatant {
  return combat.combatants.find((x) => x.id === 'c_player')!
}
function findEnemy(combat: CombatController): Combatant {
  return combat.combatants.find((x) => x.side === 'enemy')!
}

/** усилить шаблон героя (и не умереть быстро, и проверять механику, а не баланс) */
function buff(c: CampaignData, fn?: (player: NpcDef) => void) {
  const p = c.entities[c.meta.default_player] as NpcDef
  p.stats = { ...p.stats, STR: 30, CON: 30, SIZ: 14, DEX: 30, INT: 15, POW: 15, CHA: 15 }
  for (const k of Object.keys(p.skills)) p.skills[k] = Math.max(p.skills[k], 95)
  fn?.(p)
}

function startBasicCombat(e: GameEngine, extra: Record<string, unknown> = {}): CombatController {
  e.startCombat({
    type: 'start_combat',
    enemies: [{ entity: 'npc_bandit', count: 1 }],
    arena: 'arena_cellar',
    ...(extra as object),
  } as never)
  return e.combat!
}

// ── 1. attacks_per_round + штраф повторной атаки ──
{
  const c = synth((camp) => {
    buff(camp, (p) => {
      p.equipment = { weapon: 'item_test_dagger' }
      p.inventory = [{ item: 'item_test_dagger', quantity: 1 }, ...(p.inventory ?? [])]
    })
    camp.entities['item_test_dagger'] = {
      id: 'item_test_dagger',
      type: 'item',
      category: 'weapon',
      label: 'Парный клинок',
      description: 'Тестовое оружие с двумя атаками.',
      weight: 1,
      stackable: false,
      weapon_data: { skill: 'melee', damage: '1d4', damage_bonus: false, range: 1, attacks_per_round: 2, parry_capable: false, label: 'Парный клинок' },
    }
  })
  const e = new GameEngine(c)
  e.start()
  ;(e as any).rng = new PRNG('cr-apr')
  const combat = startBasicCombat(e)
  untilPlayerTurn(combat)
  const pc = findPc(combat)
  const bandit = findEnemy(combat)
  check('1 боец получает attacks_per_round атак за ход', pc.attacksLeft === 2, `attacksLeft=${pc.attacksLeft}`)
  const logBefore = combat.log.length
  ;(combat as any).resolveAttack(pc, bandit)
  check('1 первая атака тратит одну из двух', pc.attacksLeft === 1 && !pc.attacked)
  ;(combat as any).resolveAttack(pc, bandit)
  check('1 вторая атака израсходовала действие', pc.attacksLeft === 0 && pc.attacked)
  const lines = combat.log.slice(logBefore).filter((l) => l.includes('атака «Парный клинок»'))
  check('1 две атаки в логе', lines.length === 2, `${lines.length}`)
  check('1 первая атака без штрафа', !!lines[0] && !lines[0].includes('повторная'), lines[0])
  check('1 вторая атака со штрафом −20%', !!lines[1] && lines[1].includes('повторная, -20%'), lines[1])
  // без мультиоружия всё как прежде: 1 атака, ход завершается сам
  const e2 = new GameEngine(synth((camp) => buff(camp)))
  e2.start()
  const combat2 = startBasicCombat(e2)
  untilPlayerTurn(combat2)
  check('1 обычное оружие — одна атака', findPc(combat2).attacksLeft === 1)
}

// ── 2. бегство игрока ──
{
  let fled = false
  for (let attempt = 0; attempt < 12 && !fled; attempt++) {
    const c = synth((camp) => {
      buff(camp)
      camp.meta.dice_rules = { ...(camp.meta.dice_rules ?? ({} as never)), fumble_from: 100 }
    })
    const e = new GameEngine(c)
    e.start()
    ;(e as any).rng = new PRNG(`cr-flee-${attempt}`)
    e.state.player.skills = { ...e.state.player.skills, dodge: 300 }
    const combat = startBasicCombat(e, { on_fled: [{ type: 'set_flag', flag: 'test_fled' }] })
    untilPlayerTurn(combat)
    check('2 бегство разрешено по умолчанию', combat.canFlee())
    if (!combat.isPlayerTurn()) continue
    // увести героя от врага: без бесплатных атак вслед
    findPc(combat).pos = { col: 0, row: 0 }
    combat.playerFlee()
    if (combat.result !== 'fled') continue
    fled = true
    check('2 результат боя — бегство', combat.result === 'fled')
    check('2 забег не окончен', !e.state.game_over)
    check('2 флаг on_fled выставлен сразу', e.state.flags['test_fled'] === true)
    check('2 враг жив и не занесён в мёртвые', !e.state.dead_entities.includes('npc_bandit'))
    e.endCombat()
    check('2 бой закрыт', e.combat === null)
  }
  check('2 бегство срабатывает (навык 300, до 12 попыток)', fled)
  // запреты
  const cN = synth((camp) => buff(camp))
  const eN = new GameEngine(cN)
  eN.start()
  startBasicCombat(eN, { no_flee: true })
  check('2 no_flee боя запрещает бегство', eN.combat!.canFlee() === false)
  const cAll = synth((camp) => {
    buff(camp)
    camp.meta.combat = { flee: false }
  })
  const eAll = new GameEngine(cAll)
  eAll.start()
  startBasicCombat(eAll)
  check('2 meta.combat.flee=false выключает бегство кампании', eAll.combat!.canFlee() === false)
}

// ── 3. режим смерти 'brp': герой выживает без сознания ──
{
  let survived = false
  for (let attempt = 0; attempt < 12 && !survived; attempt++) {
    const c = synth((camp) => {
      buff(camp) // CON 30 → спасбросок CON×5 = 150
      camp.meta.combat = { death: { mode: 'brp' } }
      camp.meta.dice_rules = { ...(camp.meta.dice_rules ?? ({} as never)), fumble_from: 100 }
    })
    const e = new GameEngine(c)
    e.start()
    ;(e as any).rng = new PRNG(`cr-brp-${attempt}`)
    const combat = startBasicCombat(e, { on_defeat: [{ type: 'set_flag', flag: 'test_survived' }] })
    const pc = findPc(combat)
    ;(combat as any).finishDamage(pc, 999) // смертельный удар
    if (!(pc.down && !pc.dead)) continue
    survived = true
    check('3 герой выжил без сознания (1 HP)', pc.hp === 1)
    check('3 бой — поражение, но забег жив', combat.result === 'defeat' && !e.state.game_over)
    check('3 флаг on_defeat применён сразу', e.state.flags['test_survived'] === true)
    e.endCombat()
    check('3 бой закрыт, герой в мире с 1 HP', e.combat === null && e.state.player.hp === 1)
  }
  check('3 спасбросок BRP спасает (CON×5=150)', survived)
  // тяжёлая рана ≠ смерть: удар ≥ половины max HP, герой остаётся жив и без сознания
  const cM = synth((camp) => {
    buff(camp)
    camp.meta.combat = { death: { mode: 'brp' } }
    camp.meta.dice_rules = { ...(camp.meta.dice_rules ?? ({} as never)), fumble_from: 100 }
  })
  const eM = new GameEngine(cM)
  eM.start()
  ;(eM as any).rng = new PRNG('cr-wound')
  const combatM = startBasicCombat(eM)
  const pcM = findPc(combatM)
  const heavy = Math.ceil(pcM.maxHp / 2)
  // провал спасброска: CON 2 → CON×5=10, почти наверняка провал
  pcM.stats = { ...pcM.stats, CON: 2 }
  let wounded = false
  for (let attempt = 0; attempt < 12 && !wounded; attempt++) {
    ;(eM as any).rng = new PRNG(`cr-wound-${attempt}`)
    pcM.down = false
    pcM.hp = pcM.maxHp
    ;(combatM as any).finishDamage(pcM, heavy)
    wounded = pcM.down === true && !pcM.dead && pcM.hp > 0
  }
  check('3 тяжёлая рана роняет без сознания при провале CON', wounded)
}

// ── 4. режим 'instant': смерть как прежде ──
{
  const c = synth((camp) => buff(camp))
  const e = new GameEngine(c)
  e.start()
  const combat = startBasicCombat(e)
  const pc = findPc(combat)
  ;(combat as any).finishDamage(pc, 999)
  check('4 мгновенная смерть сохранена', combat.result === 'defeat' && pc.dead && !!e.state.game_over)
}

// ── 5. отдых лечит HP и MP (мастер настраивает) ──
{
  const c = synth((camp) => {
    buff(camp)
    camp.meta.rest = { hp: '2d6', mp_full: true }
  })
  const e = new GameEngine(c)
  e.start()
  e.state.player.hp = 5
  e.state.player.mp = 0
  const out = e.restHeal()
  check('5 отдых вернул HP по костям мастера', out.hp >= 2 && out.hp <= 12, `healed=${out.hp}`)
  check('5 HP прибавились в мире', e.state.player.hp === 5 + out.hp, `hp=${e.state.player.hp}`)
  check('5 MP восстановлены полностью', e.state.player.mp === e.state.player.max_mp && out.mpFull)
  const c2 = synth((camp) => {
    camp.meta.rest = { hp: '0', mp_full: false }
  })
  const e2 = new GameEngine(c2)
  e2.start()
  e2.state.player.hp = 5
  e2.state.player.mp = 1
  const out2 = e2.restHeal()
  check('5 лечение отдыхом отключается мастером', out2.hp === 0 && !out2.mpFull && e2.state.player.mp === 1)
}

// ── 6. мировой спасбросок BRP (change_hp) ──
{
  let savedOnce = false
  let diedOnce = false
  for (let attempt = 0; attempt < 40 && (!savedOnce || !diedOnce); attempt++) {
    const c = synth((camp) => {
      camp.meta.combat = { death: { mode: 'brp' } }
    })
    const e = new GameEngine(c)
    e.start()
    ;(e as any).rng = new PRNG(`cr-world-${attempt}`)
    e.changeHp(-9999)
    if (e.state.game_over) diedOnce = true
    else if (e.state.player.hp === 1) savedOnce = true
  }
  check('6 мировой спасбросок иногда спасает', savedOnce)
  check('6 мировой спасбросок иногда даёт умереть', diedOnce)
  const e2 = new GameEngine(demo)
  e2.start()
  e2.changeHp(-9999)
  check('6 без brp-режима смерть мгновенна', !!e2.state.game_over)
}

console.log(failed ? `\nПРОВАЛОВ: ${failed}` : '\nВСЁ ЗЕЛЁНОЕ')
process.exit(failed ? 1 : 0)
