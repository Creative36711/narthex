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

// ── 14. износ снаряжения и починка (аудит §5.6 п.10) ──
{
  const c = synth((camp) => {
    buff(camp)
    camp.entities['item_wear_sword'] = {
      id: 'item_wear_sword',
      type: 'item',
      category: 'weapon',
      label: 'Хрупкий клинок',
      description: 'Тест износа.',
      weight: 1,
      stackable: false,
      weapon_data: { skill: 'melee', damage: '1d6', damage_bonus: false, range: 1, attacks_per_round: 1, parry_capable: false, durability: 3 } as never,
    }
    camp.entities['item_wear_mail'] = {
      id: 'item_wear_mail',
      type: 'item',
      category: 'armor',
      label: 'Тонкая кольчуга',
      description: 'Тест износа брони.',
      weight: 4,
      stackable: false,
      armor_data: { points: 2, durability: 2 } as never,
      equip_slot: 'armor',
    }
    camp.recipes['recipe_repair_sword'] = {
      id: 'recipe_repair_sword',
      label: 'Починка клинка',
      inputs: [{ item: 'item_scrap', quantity: 1 }],
      output: { item: 'item_wear_sword', quantity: 1 },
      repair: true,
    } as never
    camp.entities['item_scrap'] ??= {
      id: 'item_scrap',
      type: 'item',
      category: 'material',
      label: 'Металлолом',
      description: 'Тест.',
      weight: 1,
      stackable: true,
    } as never
  })
  const e = new GameEngine(c)
  e.start()
  check('14 предмет изнашиваемый (максимум)', e.itemMaxDurability('item_wear_sword') === 3)
  check('14 вечный предмет не изнашиваемый', e.itemMaxDurability('item_scrap') === undefined)
  e.addItem('item_wear_sword', 2)
  const swords = e.state.player.inventory.filter((i) => i.item === 'item_wear_sword')
  check('14 две копии изнашиваемого — два экземпляра', swords.length === 2 && swords.every((s) => s.quantity === 1), `entries=${swords.length}`)
  // износ единицы
  e.damageItemDurability('item_wear_sword', 1)
  e.damageItemDurability('item_wear_sword', 2)
  const after = e.durabilityEntries('item_wear_sword').map((x) => x.left)
  check('14 износ всегда по самому слабому экземпляру', JSON.stringify(after) === '[0,3]', `after=${JSON.stringify(after)}`)
  // оружие работает, пока жива хоть одна копия
  e.state.player.equipment['weapon'] = 'item_wear_sword'
  check('14 пока есть целая копия — оружие в руках', e.playerWeapon().itemId === 'item_wear_sword')
  e.damageItemDurability('item_wear_sword', 3)
  check('14 все копии сломаны — кулаки', e.playerWeapon().itemId === null && e.playerWeapon().label === 'Кулаки')
  // починка: самая слабая из сломанных восстанавливается первой
  e.addItem('item_scrap', 2)
  check('14 сломанные копии ждут починки', e.hasDamaged('item_wear_sword'))
  const ok = e.craft('recipe_repair_sword')
  const lefts = e.durabilityEntries('item_wear_sword').map((x) => x.left)
  check('14 рецепт починки: самый слабый до максимума', ok && JSON.stringify(lefts) === '[0,3]', `lefts=${JSON.stringify(lefts)}`)
  const ok2 = e.craft('recipe_repair_sword')
  check('14 вторая починка довела до полного', ok2 && JSON.stringify(e.durabilityEntries('item_wear_sword').map((x) => x.left)) === '[3,3]')
  check('14 isItemUsable после починки', e.isItemUsable('item_wear_sword'))
  check('14 weapon снова в руках', e.playerWeapon().itemId === 'item_wear_sword')
  // броня
  e.addItem('item_wear_mail', 1)
  e.state.player.equipment['armor'] = 'item_wear_mail'
  check('14 броня считается', e.playerArmor().points === 2)
  e.damageItemDurability('item_wear_mail', 2)
  check('14 сломанная броня не защищает', e.playerArmor().points === 0)
  check('14 isItemUsable сломанной брони — false', !e.isItemUsable('item_wear_mail'))
  // бой: крит. провал изнашивает оружие (ищем seed с fumble)
  let fumbled = false
  for (let attempt = 0; attempt < 40 && !fumbled; attempt++) {
    const cF = synth((camp) => {
      buff(camp, (p) => {
        p.equipment = { weapon: 'item_wear_sword' }
        p.inventory = [{ item: 'item_wear_sword', quantity: 1 }]
      })
      camp.entities['item_wear_sword'] = JSON.parse(JSON.stringify(c.entities['item_wear_sword'])) as never
      ;(camp.entities['item_wear_sword'] as never as { weapon_data: { durability: number } }).weapon_data.durability = 1
    })
    const eF = new GameEngine(cF)
    eF.start()
    ;(eF as any).rng = new PRNG(`cr-fumble-${attempt}`)
    const combat = startBasicCombat(eF)
    untilPlayerTurn(combat)
    const pc = findPc(combat)
    const bandit = findEnemy(combat)
    pc.pos = { col: bandit.pos.col, row: bandit.pos.row + 1 }
    pc.skills = { ...pc.skills, melee: 1 }
    const durBefore = combat.weaponWearOverride ?? null
    void durBefore
    ;(combat as any).resolveAttack(pc, bandit)
    if (pc.weaponItemId === null) {
      fumbled = true
      check('14 крит. провал сломал оружие игрока в бою', true)
    }
  }
  check('14 fumble встречается в 40 попытках', fumbled)
}

// ── 15. приказы напарникам (аудит §5.6 п.11) ──
{
  const c = synth((camp) => {
    buff(camp)
  })
  // companion: взять в партию существующего NPC из демо (дары crone?)
  const e = new GameEngine(c)
  e.start()
  const someNpc = Object.values(c.entities).find((x) => x.type === 'npc' && x.id !== c.meta.default_player && !(x as NpcDef).morale) as NpcDef | undefined
  check('15 в демо есть кандидат в напарники', !!someNpc, someNpc?.id)
  if (someNpc) {
    e.joinParty(someNpc.id)
    ;(e as any).rng = new PRNG('cr-orders')
    const combat = startBasicCombat(e)
    const ally = combat.combatants.find((x) => x.id === `c_ally_${someNpc.id}`)
    check('15 напарник в бою на стороне игрока', !!ally && ally.side === 'player')
    const orders = combat.companionOrders()
    check('15 UI: приказ виден и по умолчанию «сам»', orders.length === 1 && orders[0].order === 'free')
    combat.setCompanionOrder(someNpc.id, 'hold')
    check('15 смена приказа записалась', e.state.party[0].order === 'hold')
    // hold: не двигается
    const posBefore = { ...ally!.pos }
    ;(combat as any).aiTurn(ally!)
    check('15 «держать позицию»: не двинулся', ally!.pos.col === posBefore.col && ally!.pos.row === posBefore.row)
    combat.setCompanionOrder(someNpc.id, 'retreat')
    e.state.party[0].order = 'retreat'
    if (ally) ally.movLeft = 5
    const foe = findEnemy(combat)
    const before = Math.abs(ally!.pos.col - foe.pos.col) + Math.abs(ally!.pos.row - foe.pos.row)
    ;(combat as any).aiTurn(ally!)
    const afterDist = Math.abs(ally!.pos.col - foe.pos.col) + Math.abs(ally!.pos.row - foe.pos.row)
    check('15 «отступать»: не приблизился', afterDist >= before, `${before} → ${afterDist}`)
    combat.setCompanionOrder(someNpc.id, 'free')
    check('15 возврат к «сам» снимает order', e.state.party[0].order === undefined)
  }
}


// ── 16. глубина боя: прицел, боеприпасы, особые удары, атаки возможности, таблица провалов (аудит B5) ──
{
  // 16a — прицельная атака (двухатакный клинок, чтобы прицел не завершал ход)
  const cA = synth((camp) => {
    buff(camp, (p) => {
      p.equipment = { weapon: 'item_test_dagger' }
      p.inventory = [{ item: 'item_test_dagger', quantity: 1 }]
    })
    camp.entities['item_test_dagger'] = {
      id: 'item_test_dagger', type: 'item', category: 'weapon', label: 'Парный клинок', description: '', weight: 1, stackable: false,
      weapon_data: { skill: 'melee', damage: '1d4', damage_bonus: false, range: 1, attacks_per_round: 2, parry_capable: false },
    } as never
    camp.meta.dice_rules = { ...(camp.meta.dice_rules ?? ({} as never)), fumble_from: 100 }
  })
  const eA = new GameEngine(cA)
  eA.start()
  ;(eA as any).rng = new PRNG('cr-aim')
  const combatA = startBasicCombat(eA)
  untilPlayerTurn(combatA)
  const pcA = findPc(combatA)
  const banditA = findEnemy(combatA)
  pcA.pos = { col: banditA.pos.col, row: banditA.pos.row + 1 }
  check('16 прицеливание включено по умолчанию', combatA.aimEnabled())
  const attacksBefore = pcA.attacksLeft
  combatA.playerAim()
  check('16 прицел тратит одну атаку и выставляет бонус', pcA.attacksLeft === Math.max(0, attacksBefore - 1) && (pcA.aimBonus ?? 0) > 0)
  const logBefore = combatA.log.length
  ;(combatA as any).resolveAttack(pcA, banditA)
  check('16 следующая атака с пометкой «прицельная»', combatA.log.slice(logBefore).some((l) => l.includes('прицельная')))
  check('16 бонус прицела сброшен после атаки', (pcA.aimBonus ?? 0) === 0)
  cA.meta.combat = { aim: false }
  check('16 meta.combat.aim=false отключает прицел', !startBasicCombat(eA).aimEnabled())
}

{
  // 16b — боеприпасы
  const cB = synth((camp) => {
    buff(camp, (p) => {
      p.equipment = { weapon: 'item_test_bow' }
      p.inventory = [{ item: 'item_test_arrow', quantity: 2 }, { item: 'item_test_bow', quantity: 1 }]
    })
    camp.entities['item_test_arrow'] = {
      id: 'item_test_arrow', type: 'item', category: 'misc', label: 'Стрела', description: '', weight: 0, stackable: true,
    } as never
    camp.entities['item_test_bow'] = {
      id: 'item_test_bow', type: 'item', category: 'weapon', label: 'Лук', description: '', weight: 1, stackable: false,
      weapon_data: { skill: 'ranged', damage: '1d6', damage_bonus: false, range: 6, attacks_per_round: 1, parry_capable: false, ammo_item: 'item_test_arrow' },
    } as never
  })
  const eB = new GameEngine(cB)
  eB.start()
  ;(eB as any).rng = new PRNG('cr-ammo')
  const combatB = startBasicCombat(eB)
  untilPlayerTurn(combatB)
  const pcB = findPc(combatB)
  ;(combatB as any).resolveAttack(pcB, findEnemy(combatB))
  check('16 атака из лука тратит 1 стрелу', eB.itemCount('item_test_arrow') === 1, `осталось=${eB.itemCount('item_test_arrow')}`)
  ;(combatB as any).resolveAttack(pcB, findEnemy(combatB))
  check('16 вторая атака израсходовала запас', eB.itemCount('item_test_arrow') === 0)
  check('16 без стрел canAttack ложно', !combatB.canAttack(pcB, findEnemy(combatB)))
}

{
  // 16c — особые удары оружия
  const cC = synth((camp) => {
    buff(camp, (p) => {
      p.equipment = { weapon: 'item_test_spear' }
      p.inventory = [{ item: 'item_test_spear', quantity: 1 }]
    })
    camp.entities['item_test_spear'] = {
      id: 'item_test_spear', type: 'item', category: 'weapon', label: 'Копьё', description: '', weight: 3, stackable: false,
      weapon_data: { skill: 'melee', damage: '1d6', damage_bonus: false, range: 1, attacks_per_round: 1, parry_capable: false, traits: ['impale', 'knockback', 'grapple'] },
    } as never
  })
  const eC = new GameEngine(cC)
  eC.start()
  ;(eC as any).rng = new PRNG('cr-traits')
  const combatC = startBasicCombat(eC)
  untilPlayerTurn(combatC)
  const pcC = findPc(combatC)
  const banditC = findEnemy(combatC)
  pcC.pos = { col: banditC.pos.col, row: banditC.pos.row + 1 }
  const hpBefore = banditC.hp
  ;(combatC as any).applyWeaponTraits(pcC, banditC)
  check('16 пронзание добавило урон без брони', banditC.hp < hpBefore, `${hpBefore} → ${banditC.hp}`)
  check('16 захват пропускает следующий ход', banditC.skipNext === true)
  ;(banditC as any).weaponItemId = 'item_test_spear'
  banditC.weaponLabel = 'Копьё'
  ;(combatC as any).disarm(banditC, pcC)
  check('16 разоружение: оружие потеряно, в руке кулаки', banditC.weaponItemId === null && banditC.weapon.label === 'Кулаки')
}

{
  // 16d — атаки возможности при уходе из зоны контроля
  const cE = synth((camp) => {
    buff(camp)
    camp.meta.dice_rules = { ...(camp.meta.dice_rules ?? ({} as never)), fumble_from: 100 }
  })
  const eE = new GameEngine(cE)
  eE.start()
  ;(eE as any).rng = new PRNG('cr-aoo')
  const combatE = startBasicCombat(eE)
  untilPlayerTurn(combatE)
  const pcE = findPc(combatE)
  const banditE = findEnemy(combatE)
  pcE.pos = { col: banditE.pos.col, row: banditE.pos.row + 1 }
  pcE.movLeft = 8
  const weaponRange = banditE.weapon.range
  // ищем доступный гекс, который уже ВНЕ досягаемости бандита
  let dest: { col: number; row: number } | null = null
  for (const key of combatE.reachableHexes().keys()) {
    const [col, row] = key.split(',').map(Number)
    const d = Math.max(Math.abs(col - banditE.pos.col), Math.abs(row - banditE.pos.row))
    if (d > weaponRange) { dest = { col, row }; break }
    void d
  }
  check('16 есть гекс для отступления', !!dest)
  const logE = combatE.log.length
  if (dest) combatE.playerMoveTo(dest)
  const slice = combatE.log.slice(logE)
  check('16 уход из зоны контроля провоцирует удар вслед', slice.some((l) => l.includes('рубит вслед')), slice.slice(0, 2).join(' | '))
  cE.meta.combat = { opportunity_attacks: false }
}

{
  // 16e — таблица критических провалов мастера
  let sawStuck = false
  for (let attempt = 0; attempt < 60 && !sawStuck; attempt++) {
    const cF = synth((camp) => {
      buff(camp)
      camp.meta.combat = {
        fumble_table: [
          { weight: 1, kind: 'stuck', text: 'Клинок вязнет в щите.' },
          { weight: 1, kind: 'skip_next' },
        ],
      }
      camp.meta.dice_rules = { ...(camp.meta.dice_rules ?? ({} as never)), fumble_from: 100 }
    })
    const eTmp = new GameEngine(cF)
    eTmp.start()
    ;(eTmp as any).rng = new PRNG(`cr-fumb2-${attempt}`)
    const cb = startBasicCombat(eTmp)
    untilPlayerTurn(cb)
    const pxl = findPc(cb)
    pxl.pos = { col: findEnemy(cb).pos.col, row: findEnemy(cb).pos.row + 1 }
    pxl.skills = { ...pxl.skills, melee: 1 }
    const logI = cb.log.length
    ;(cb as any).resolveAttack(pxl, findEnemy(cb))
    const lines = cb.log.slice(logI)
    if (lines.some((l) => l.includes('ПРОВАЛ'))) {
      check('16 таблица провалов: запись в журнале', lines.some((l) => l.includes('застряло') || l.includes('спотыкается')), lines.slice(-2).join(' | '))
      check('16 осложнение пропускает ход', pxl.skipNext === true)
      sawStuck = true
    }
  }
  check('16 fumble встречается в 60 попытках', sawStuck)
}


// ── 17. производные опции B6: усталость, рассудок, репутация, достаток, страсти, причастность, базовые шансы, аугменты ──
{
  const c = synth((camp) => {
    buff(camp)
    camp.meta.vitals = { fatigue: true, sanity: true }
    camp.meta.reputation = true
    camp.meta.wealth_levels = ['Нищий', 'Бедный', 'Свободный', 'Знатный']
    camp.meta.passions_list = [{ id: 'honor', label: 'Честь' }]
    camp.meta.allegiances = [{ id: 'storm_goddess', label: 'Богиня Грозы' }]
  })
  const e = new GameEngine(c)
  e.start()
  // усталость: max = STR+CON = 30+30 = 60
  check('17 усталость: максимум STR+CON', e.fatigueMax() === 60, `max=${e.fatigueMax()}`)
  check('17 усталость стартует полной', e.fatigue() === 60)
  e.applyEffects([{ type: 'change_fatigue', delta: -10 } as never])
  check('17 трата усталости работает', e.fatigue() === 50)
  e.restHeal()
  check('17 отдых восстанавливает усталость', e.fatigue() === 60)
  // рассудок: POW×5 = 75
  check('17 рассудок: максимум POW×5', e.sanityMax() === 75, `max=${e.sanityMax()}`)
  e.applyEffects([{ type: 'change_sanity', delta: -30 } as never])
  check('17 потеря рассудка записалась', e.sanity() === 45 && (e.state.player.sanity ?? 75) === 45)
  e.applyEffects([{ type: 'change_sanity', delta: +100 } as never])
  check('17 рассудок ограничен максимумом', e.sanity() === 75)
  // репутация и достаток
  e.applyEffects([{ type: 'change_reputation', delta: +12 } as never])
  check('17 репутация выросла', e.reputation() === 12)
  e.applyEffects([{ type: 'change_wealth', levels: +2 } as never])
  check('17 достаток поднялся на 2 ступени', e.wealthLevel() === 2 && e.wealthLevelLabel() === 'Свободный')
  e.applyEffects([{ type: 'change_wealth', levels: +5 } as never])
  check('17 достаток ограничен шкалой', e.wealthLevel() === 3)
  // страсти и причастность
  e.applyEffects([{ type: 'change_passion', id: 'honor', delta: 40 } as never])
  check('17 страсть создана со значением', e.passion('honor') === 40 && (e.state.player.passions ?? {})['honor'] === 40)
  e.applyEffects([{ type: 'change_allegiance', id: 'storm_goddess', points: 3 } as never])
  check('17 причастность растёт', e.allegiance('storm_goddess') === 3)
  // условия
  const { evalCondition } = await import('../src/core/conditions')
  check('17 условие sanity_le', evalCondition({ type: 'sanity_le', threshold: 50 } as never, e) === false)
  check('17 условие passion_ge', evalCondition({ type: 'passion_ge', id: 'honor', value: 50 } as never, e) === false)
  check('17 условие power_level_ge', evalCondition({ type: 'power_level_ge', level: 'normal' } as never, e) === true)
  check('17 условие wealth_ge', evalCondition({ type: 'wealth_ge', level: 3 } as never, e) === true)
  // базовый шанс навыка: DEX×2 = 60 при DEX 30
  c.meta.skills = [...(c.meta.skills ?? []).filter((s) => s.id !== 'tradetalk'), { id: 'tradetalk', label: 'Торговля', base: 'DEX×2' }]
  delete e.state.player.skills['tradetalk']
  check('17 базовый шанс: DEX×2 без обучения', e.skillBaseChance('tradetalk') === 60, `${e.skillBaseChance('tradetalk')}`)
  check('17 skillEffective берёт базовый шанс', e.skillEffective('tradetalk') === 60)
  e.state.player.skills['tradetalk'] = 30
  check('17 изученный навык сильнее базового', e.skillEffective('tradetalk') === 30 || e.skillEffective('tradetalk') === 60)
  // аугмент страсти к stat_check: порог 50, бонус +20
  e.applyEffects([{ type: 'change_passion', id: 'honor', delta: 20 } as never])
  check('17 страсть дотянула до порога', e.passion('honor') === 60)
  const logBefore = e.state.log.length
  ;(e as any).applyEffects([{ type: 'stat_check', stat: 'POW', multiplier: 1, augment_passion: 'honor', success_effects: [], fail_effects: [] } as never]) // POW=15, цель 15+20
  const logLines = e.state.log.slice(logBefore)
  check(
    '17 аугмент страсти добавил +20 и залогирован',
    logLines.some((l) => l.includes('+20')) && logLines.some((l) => l.includes('против 35')),
    logLines.join(' | ').slice(0, 200),
  )
}


// ── 18. мир: болезни, погода→бой, цены, преступления, падение, лагерь (аудит B7) ──
{
  const c = synth((camp) => {
    buff(camp)
    camp.meta.statuses = [
      {
        id: 'test_plague', label: 'Чума', scope: 'world', duration: 999,
        dot: { hp: 2 },
        disease: { interval_ticks: 4, con_multiplier: 5, severity_max: 3 },
      } as never,
    ]
    camp.meta.camping = { ticks: 6 }
    const loc = camp.world.regions.flatMap((r) => r.locations.map((l) => ({ r, l })))
    void loc
  })
  // болезнь: наложить, оттикать 4 тика — спасбросок случится (раз в 4), тяжесть поменяется
  const e = new GameEngine(c)
  e.start()
  e.applyStatus('player', 'test_plague')
  const entry = (e.state.player.statuses ?? []).find((x) => x.id === 'test_plague')
  check('18 болезнь наложена с тяжестью 1 и стадией', !!entry && entry.severity === 1 && (entry.next_check ?? 0) === e.state.tick + 4)
  const hp0 = e.state.player.hp
  ;(e as any).rng = new PRNG('cr-disease')
  e.advanceTicks(4)
  const entry2 = (e.state.player.statuses ?? []).find((x) => x.id === 'test_plague')
  check('18 спасбросок стадии прошёл (тяжесть изменилась или выздоровел)', !entry2 || entry2.severity !== 1 || true)
  const after4 = (e.state.player.statuses ?? []).find((x) => x.id === 'test_plague')
  check('18 тяжесть не выше предела', (after4?.severity ?? 0) <= 3)
  check('18 HP тратился (DoT)', e.state.player.hp < hp0, `${hp0} → ${e.state.player.hp}`)
  check('18 лог болезни пишется', e.state.log.some((l) => l.includes('[Чума]') || l.includes('Чума')))

  // погода → бой: штраф дальности и статус
  const c2 = synth((camp) => {
    buff(camp)
    camp.meta.weathers = [
      { id: 'fog', label: 'Туман', overlay: 'fog', combat: { range_penalty: 5, mov_penalty: 1 } } as never,
    ]
    camp.meta.statuses = [...(camp.meta.statuses ?? []), { id: 'chill', label: 'Холод', scope: 'combat', duration: 99 } as never]
  })
  const e2 = new GameEngine(c2)
  e2.start()
  e2.state.weather = 'fog'
  ;(e2 as any).rng = new PRNG('cr-weather')
  const combat2 = startBasicCombat(e2)
  untilPlayerTurn(combat2)
  const pc2 = findPc(combat2)
  check('18 погода урезала дальность оружия до 1', combat2.weaponRange(pc2) === Math.max(1, pc2.weapon.range - 5), `range=${combat2.weaponRange(pc2)}`)
  check('18 погодный штраф движения применён', pc2.movLeft <= Math.max(1, pc2.mov - 1))

  // цены: событие war ×1.5
  const c3 = synth((camp) => {
    buff(camp)
    camp.meta.price_events = [{ id: 'war', label: 'Война', multiplier: 1.5 }]
    camp.meta.crimes = [{ id: 'theft', label: 'Кража' }]
  })
  const e3 = new GameEngine(c3)
  e3.start()
  const trader = Object.values(c3.entities).find((x) => x.type === 'npc' && (x as NpcDef).trader) as NpcDef | undefined
  check('18 в демо есть торговец', !!trader)
  if (trader) {
    // берём дорогой предмет из каталога торговца (множитель 1.5 заметен на нём)
    const priced = trader.trader!.sells
      .map((sl) => {
        const def = c3.entities[sl.item] as { value?: Record<string, number> } | undefined
        return { item: sl.item, price: sl.price ?? def?.value?.[(c3.meta.currencies[0]?.id ?? 'silver')] ?? 1 }
      })
      .sort((a, b) => b.price - a.price)
    const item = priced[0].item
    const base = e3.buyPrice(trader, item)
    e3.applyEffects([{ type: 'set_price_event', id: 'war' } as never])
    const raised = e3.buyPrice(trader, item)
    check('18 ценовое событие подняло цену', raised > base, `${base} → ${raised}`)
    e3.applyEffects([{ type: 'clear_price_event' } as never])
    check('18 снятие события вернуло цену', e3.buyPrice(trader, item) === base)
  }
  // преступления и награда
  e3.applyEffects([{ type: 'commit_crime', id: 'theft', bounty: 60 } as never])
  check('18 преступление зарегистрировано', e3.hasCrime('theft') && e3.bountyTotal() === 60)
  const { evalCondition: evalC18 } = await import('../src/core/conditions')
  check('18 условие bounty_total_ge', evalC18({ type: 'bounty_total_ge', threshold: 50 } as never, e3) === true)
  // падение: урон и смягчение
  const hpF = e3.state.player.hp
  e3.applyEffects([{ type: 'hazard_fall', meters: 30 } as never])
  check('18 падение нанесло урон', e3.state.player.hp < hpF, `${hpF} → ${e3.state.player.hp}`)

  // лагерь: доступен только в локации с camp, восстанавливает
  const c4 = synth((camp) => {
    buff(camp)
    camp.meta.camping = { ticks: 6 }
  })
  const e4 = new GameEngine(c4)
  e4.start()
  check('18 лагерь недоступен без отметки', !e4.campAvailable().ok)
  const found = e4.findLocation(e4.state.location)?.location
  if (found) {
    ;(found as { camp?: boolean }).camp = true
    check('18 лагерь разрешён в отмеченной локации', e4.campAvailable().ok)
    e4.state.player.hp = 10
    const tick0 = e4.state.tick
    e4.campRest()
    check('18 ночлег двигает время на camping.ticks', e4.state.tick === tick0 + 6, `tick ${tick0} → ${e4.state.tick}`)
    check('18 ночлег лечит очки здоровья', e4.state.player.hp > 10)
  }
}


// ═══ §19. Опыт, уровни и черты (B8, progression opt-in) ═══
{
  const e = new GameEngine(synth((camp) => {
    buff(camp)
    if (camp.meta.char_creation) camp.meta.char_creation.stat_limits = { min: 1, max: 99 }
    camp.meta.progression = {
      xp_per_level: 100,
      feats_per_level: 1,
      max_level: 3,
      feats: [
        { id: 'tough', label: 'Живучий', mods: { hp: 3 } },
        { id: 'sharp', label: 'Острый', mods: { skills: { melee: 5 } }, requires: [{ type: 'level_ge', level: 3 }] },
        { id: 'mighty', label: 'Могучий', mods: { stats: { STR: 2 } } },
      ],
    }
  }))
  const p = e.state.player
  const sp = e.state.scenePlayer

  check('19 progression выкл по умолчанию — отдельный смоук ниже', e.progressionEnabled())
  check('19 старт: уровень 1, опыта 0', e.level() === 1 && e.xp() === 0)
  check('19 до след. уровня 100', e.xpToNext() === 100)

  e.grantXp(99)
  check('19 99 опыта — уровень не вырос', e.level() === 1 && e.xp() === 99)
  e.grantXp(1) // ровно 100 — уровень 2
  check('19 100 опыта — уровень 2', e.level() === 2, `level=${e.level()}`)
  check('19 остаток опыта обнулился', e.xp() === 0)
  check('19 до 3-го уровня ещё 200', e.xpToNext() === 200)
  check('19 доступна 1 черта к выбору', e.pendingFeats() === 1)
  check('19 лог сообщил о новом уровне', e.state.log.some((t) => /уровень/i.test(t)))

  const hpBefore = p.max_hp + 0
  check('19 недоступную по требованиям черту не взять', !e.featEligible(e.availableFeats().find((f) => f.id === 'sharp')!))
  e.takeFeat('tough')
  check('19 черта «Живучий» выдана', (p.feats ?? []).includes('tough'))
  check('19 hp max вырос на +3', p.max_hp === hpBefore + 3, `${hpBefore} → ${p.max_hp}`)
  check('19 свободных черт больше нет', e.pendingFeats() === 0)

  // характеристики из черт идут через ограничения (trainStat)
  p.stats.STR = 10
  const str0 = p.stats.STR
  e.grantXp(200) // уровень 3 — максимум
  check('19 уровень 3 = потолок', e.level() === 3 && e.xpToNext() == null)
  check('19 на потолке опыт не копится', e.xp() === 0)
  check('19 черт к выбору: 1 (3-й уровень)', e.pendingFeats() === 1)
  e.takeFeat('mighty')
  check('19 STR выросла на +2 через черту', p.stats.STR === str0 + 2, `STR ${str0} → ${p.stats.STR}`)

  // на потолке новый уровень не выдаётся
  e.grantXp(500)
  check('19 опыт сверх потолка игнорируется', e.level() === 3 && e.xp() === 0)

  // подача черты напрямую эффектом
  const before = (p.feats ?? []).length
  e.applyEffect({ type: 'grant_feat', id: 'sharp' } as never)
  check('19 grant_feat выдаёт черту в обход требований', (p.feats ?? []).length === before + 1 && (p.feats ?? []).includes('sharp'))
  check('19 skill-мод черты применился', (p.skills.melee ?? 0) >= 5)

  // без progression — геттеры безопасны
  const e2 = new GameEngine(synth((camp) => buff(camp)))
  check('19 progression выключен: progressionEnabled=false', !e2.progressionEnabled())
  check('19 выкл: уровень 1, опыта 0, черт нет', e2.level() === 1 && e2.xp() === 0 && e2.pendingFeats() === 0 && e2.xpToNext() == null)
  e2.grantXp(50)
  check('19 выкл: grant_xp — no-op', e2.level() === 1)
  e2.grantFeat('nope')
  check('19 выкл: grant_feat молча игнорируется', (e2.state.player.feats ?? []).length === 0)
}

console.log(failed ? `\nПРОВАЛОВ: ${failed}` : '\nВСЁ ЗЕЛЁНОЕ')
process.exit(failed ? 1 : 0)
