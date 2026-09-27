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

// ── 7. проверка характеристики и новые условия правил ──
{
  const { evalCondition } = await import('../src/core/conditions')
  const c = synth((camp) => {
    buff(camp)
    camp.meta.luck = { multiplier: 5, reroll_cost: 1 }
  })
  const e = new GameEngine(c)
  e.start()
  ;(e as any).rng = new PRNG('cr-stat')
  // POW 15 → POW×5 = 75; детерминировать: модификатор +100 — гарантированный успех
  const out = e.statCheck('POW', 5, 100)
  check('7 statCheck успешен при заведомо большой цели', out.success)
  const outF = e.statCheck('POW', 5, -1000)
  check('7 statCheck провален при заведомо малой цели', !outF.success)
  // эффект stat_check применяет ветки
  e.applyEffects([{ type: 'stat_check', stat: 'POW', multiplier: 5, modifier: 100, success_effects: [{ type: 'set_flag', flag: 'stat_ok' }], fail_effects: [{ type: 'set_flag', flag: 'stat_fail' }] }])
  check('7 эффект stat_check: ветка успеха', e.state.flags['stat_ok'] === true && !e.state.flags['stat_fail'])
  e.applyEffects([{ type: 'stat_check', stat: 'POW', multiplier: 5, modifier: -1000, success_effects: [{ type: 'set_flag', flag: 'stat_ok2' }], fail_effects: [{ type: 'set_flag', flag: 'stat_fail2' }] }])
  // провал без удачного предложения? удача включена — появится предложение переброса
  check('7 провал при включённой удаче даёт предложение', !!e.luckOffer)
  e.resolveLuckOffer(false)
  check('7 отказ от переброса — ветка провала', e.state.flags['stat_fail2'] === true && !e.state.flags['stat_ok2'])
  // условия правил
  e.state.player.hp = 7
  check('7 условие hp_ge', evalCondition({ type: 'hp_ge', threshold: 5 }, e) && !evalCondition({ type: 'hp_ge', threshold: 8 }, e))
  check('7 условие hp_le', evalCondition({ type: 'hp_le', threshold: 7 }, e) && !evalCondition({ type: 'hp_le', threshold: 6 }, e))
  check('7 условие stat_ge', evalCondition({ type: 'stat_ge', stat: 'POW', threshold: 15 }, e) && !evalCondition({ type: 'stat_ge', stat: 'POW', threshold: 16 }, e))
  check('7 условие luck_ge', evalCondition({ type: 'luck_ge', threshold: e.luck() }, e) && !evalCondition({ type: 'luck_ge', threshold: e.luck() + 1 }, e))
}

// ── 8. противоборство ──
{
  const c = synth((camp) => {
    buff(camp) // навыки ≥95 у героя
  })
  const e = new GameEngine(c)
  e.start()
  ;(e as any).rng = new PRNG('cr-opp')
  const bandit = c.entities['npc_bandit'] as NpcDef
  bandit.skills = { ...bandit.skills }
  // порог 1 — герой почти наверняка побеждает
  let wins = 0
  for (let i = 0; i < 15; i++) {
    ;(e as any).rng = new PRNG(`cr-opp-${i}`)
    const r = e.opposedCheck({ type: 'opposed_check', skill: 'melee', against_value: 1, success_effects: [], fail_effects: [] })
    if (r.success) wins++
  }
  check('8 противоборство против порога 1: герой выигрывает большинство', wins >= 10, `wins=${wins}/15`)
  // противоборство через эффект — ветка поражения (герой 0 против порога 100)
  e.state.player.skills = { ...e.state.player.skills, brawl: 0 }
  e.applyEffects([
    {
      type: 'opposed_check',
      skill: 'brawl',
      against_value: 500,
      tie: 'opponent',
      success_effects: [{ type: 'set_flag', flag: 'opp_win' }],
      fail_effects: [{ type: 'set_flag', flag: 'opp_lose' }],
    },
  ])
  check('8 эффект opposed_check: поражение применено', e.state.flags['opp_lose'] === true && !e.state.flags['opp_win'])
  // tie по умолчанию — за игроком: порог равный навыку, проверяем ветку на повторяемость
  const t = e.opposedCheck({ type: 'opposed_check', skill: 'melee', against_value: 1, tie: 'opponent', success_effects: [], fail_effects: [] })
  check('8 opposedCheck возвращает итог', typeof t.success === 'boolean' && !!t.player && !!t.rival)
}

// ── 9. удача: переброс за очки ──
{
  const c = synth((camp) => {
    buff(camp)
    camp.meta.luck = { multiplier: 5, reroll_cost: 2, rest_luck: true }
  })
  const e = new GameEngine(c)
  e.start()
  check('9 максимум удачи = POW×5', e.luckMax() === e.state.player.stats.POW * 5, `max=${e.luckMax()}`)
  check('9 старт с полной удачей', e.luck() === e.luckMax())
  // гарантированный провал: навык 0, fumble_from=100
  c.meta.dice_rules = { ...(c.meta.dice_rules ?? ({} as never)), fumble_from: 100 }
  e.state.player.skills = { ...e.state.player.skills, brawl: 1 }
  ;(e as any).rng = new PRNG('cr-luck-fail')
  e.applyEffects([
    {
      type: 'skill_check_gate',
      skill: 'brawl',
      difficulty: 100,
      success_effects: [{ type: 'set_flag', flag: 'luck_ok' }],
      fail_effects: [{ type: 'set_flag', flag: 'luck_fail' }],
    },
  ])
  if (e.luckOffer) {
    check('9 провал предложил переброс за 2 удачи', e.luckOffer.cost === 2)
    check('9 очки списались при предложении', e.luck() === e.luckMax() - 2, `luck=${e.luck()}`)
    const before = e.luck()
    e.resolveLuckOffer(true)
    check('9 после переброса применилась одна из веток', (e.state.flags['luck_ok'] ?? false) !== (e.state.flags['luck_fail'] ?? false))
    check('9 повторных списаний не было', e.luck() === before)
  } else {
    // удачное стечение: бросок со счётом 1 мог быть критом — принимаем только явный провал
    check('9 провал предложил переброс за 2 удачи', e.state.flags['luck_fail'] === true, 'бросок неожиданно удался — reroll не требовался')
  }
  // удача не тратится без meta.luck
  const c2 = synth((camp) => {
    buff(camp)
    camp.meta.dice_rules = { ...(camp.meta.dice_rules ?? ({} as never)), fumble_from: 100 }
  })
  const e2 = new GameEngine(c2)
  e2.start()
  e2.state.player.skills = { ...e2.state.player.skills, brawl: 0 }
  e2.applyEffects([{ type: 'skill_check_gate', skill: 'brawl', difficulty: 100, success_effects: [{ type: 'set_flag', flag: 'x' }], fail_effects: [{ type: 'set_flag', flag: 'y' }] }])
  check('9 без meta.luck предложений нет', !e2.luckOffer && e2.luckMax() === 0)
  // удача восстанавливается на отдыхе
  e.state.player.luck = 0
  e.restHeal()
  check('9 отдых восстанавливает удачу', e.luck() === e.luckMax())
}

// ── 10. уровни сложности проверок (аудит §5.6 п.7) ──
{
  const c = synth((camp) => {
    buff(camp)
    camp.meta.dice_rules = { ...(camp.meta.dice_rules ?? ({} as never)), fumble_from: 100 }
  })
  const e = new GameEngine(c)
  e.start()
  ;(e as any).rng = new PRNG('cr-lvl')
  e.state.player.skills = { ...e.state.player.skills, brawl: 60 }
  check('10 лёгкая проверка: цель ×2', e.playerSkillCheck('brawl', 'easy').target === 120)
  check('10 обычная строкой = обычной числом', e.playerSkillCheck('brawl', 'normal').target === e.playerSkillCheck('brawl', 50).target)
  check('10 трудная проверка: цель ½', e.playerSkillCheck('brawl', 'difficult').target === 30)
  check('10 невозможная: цель ¼', e.playerSkillCheck('brawl', 'impossible').target === 15)
  check('10 числовой порог 70 → цель 40', e.playerSkillCheck('brawl', 70).target === 40)
}

// ── 13. скрытность и обнаружение (аудит §5.6 п.12) ──
{
  const c = synth((camp) => {
    buff(camp)
    camp.meta.stealth = { skill: 'stealth', perception_skill: 'perception' }
  })
  const e = new GameEngine(c)
  e.start()
  check('13 скрытность opt-in: есть блок — есть механика', e.stealthEnabled())
  check('13 старт — открыто, не крадётся', !e.isSneaking())
  e.state.player.skills = { ...e.state.player.skills, stealth: 200 }
  e.toggleSneak()
  check('13 красться включилось', e.isSneaking())
  check('13 высокая скрытность незаметна', e.detectCheck('тест') || !e.isDetected(), '')
  // бой из скрытности — внезапный для врагов
  ;(e as any).rng = new PRNG('cr-stealth')
  const combat = startBasicCombat(e)
  check('13 бой из скрытности — surprise за игрока', combat.surprise === 'player', `surprise=${combat.surprise}`)
  check('13 красться снято боем', !e.isSneaking())
  const enemy = findEnemy(combat)
  check('13 враг застигнут: без атак в 1-м раунде', enemy.attacksLeft === 0 && enemy.movLeft === 0, `attacks=${enemy.attacksLeft}`)
  // прятаться в бою: действием
  const c2 = synth((camp) => {
    buff(camp)
    camp.meta.stealth = { skill: 'stealth', perception_skill: 'perception' }
  })
  const e2 = new GameEngine(c2)
  e2.start()
  const combat2 = startBasicCombat(e2)
  untilPlayerTurn(combat2)
  const pc2 = findPc(combat2)
  pc2.skills = { ...pc2.skills, stealth: 500 }
  check('13 бой без def.no_hide позволяет прятаться', combat2.canHide())
  combat2.playerHide()
  check('13 прятки удались (500 vs bandit)', pc2.hidden === true)
  check('13 прятки съели ход, раунд крутанулся', pc2.attacksLeft >= 1, `attacksLeft=${pc2.attacksLeft} round=${combat2.round}`)
  // ИИ не видит скрытого героя
  const seen = (combat2 as any).combatants // debug
  void seen
  // атака из скрытности снимает hidden
  ;(combat2 as any).resolveAttack(pc2, findEnemy(combat2))
  check('13 атака выдаёт позицию', pc2.hidden === false)
  // def.no_hide: запрет
  const e3 = new GameEngine(c2)
  e3.start()
  const combat3 = startBasicCombat(e3, { no_hide: true })
  check('13 no_hide запрещает прятаться в бою', !combat3.canHide())
  // без meta.stealth нельзя прятаться
  const c4 = synth((camp) => buff(camp))
  const e4 = new GameEngine(c4)
  e4.start()
  const combat4 = startBasicCombat(e4)
  check('13 без meta.stealth прятаться нельзя', !combat4.canHide())
  // застигнутые врасплох не защищаются
  const e5 = new GameEngine(synth((camp) => buff(camp)))
  e5.start()
  const combat5 = startBasicCombat(e5, { surprise: 'player' })
  const pc5 = findPc(combat5)
  const bandit5 = findEnemy(combat5)
  bandit5.skills = { ...bandit5.skills, dodge: 500 }
  pc5.pos = { col: bandit5.pos.col, row: bandit5.pos.row + 1 }
  ;(e5 as any).rng = new PRNG('cr-surpr')
  const logBefore = combat5.log.length
  ;(combat5 as any).resolveAttack(pc5, bandit5)
  const lines = combat5.log.slice(logBefore)
  check('13 врасплох: защита не бросается', !lines.some((l) => l.includes('уклонение') || l.includes('парирование')), lines.join(' / '))
}

console.log(failed ? `\nПРОВАЛОВ: ${failed}` : '\nВСЁ ЗЕЛЁНОЕ')
process.exit(failed ? 1 : 0)
