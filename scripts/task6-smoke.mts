/**
 * Смоук «конкретных предложений» (задача 6): слоты магии и откат, преследования,
 * самочувствие прописанных NPC, уровни сложности.
 * Запуск из корня репо: npx tsx scripts/task6-smoke.mts (файлы кампании читаются с диска).
 */
import { loadCampaign } from '../src/core/loader'
import { GameEngine } from '../src/core/engine'
import { PRNG } from '../src/core/prng'
import type { CampaignData, NpcDef, AbilityDef } from '../src/shared/types'
import type { CombatController, Combatant } from '../src/core/combat'

const mem = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => mem.set(k, v),
  removeItem: (k: string) => mem.delete(k),
}

// локальные файлы кампании без http-сервера (fetch → FS), запуск из корня репо
{
  const orig = globalThis.fetch
  globalThis.fetch = (async (input: any, init?: any) => {
    const u = String(input)
    const pfx = 'http://localhost:5173/'
    if (u.startsWith(pfx)) {
      const { readFile } = await import('node:fs/promises')
      const rel = decodeURIComponent(new URL(u).pathname).replace(/^\/+/, '')
      const buf = await readFile(`public/${rel}`)
      return new Response(buf, { status: 200 })
    }
    return orig(input, init)
  }) as typeof fetch
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
function findPc(combat: CombatController): Combatant {
  return combat.combatants.find((x) => x.id === 'c_player')!
}
function startCombat(e: GameEngine): CombatController {
  e.startCombat({ type: 'start_combat', enemies: [{ entity: 'npc_bandit', count: 1 }], arena: 'arena_cellar' } as never)
  return e.combat!
}

// ── 1. слоты магии: подготовка, лимит, причина недоступности ──
{
  const c = synth((camp) => {
    camp.meta.magic = { slots: 1 }
    camp.meta.skills = [...(camp.meta.skills ?? []), { id: 'arcana', label: 'Магия' }]
    const p = camp.entities[camp.meta.default_player] as NpcDef
    p.skills = { ...p.skills, arcana: 80 }
    camp.meta.abilities = [
      ...(camp.meta.abilities ?? []),
      { id: 'ab_bolt', label: 'Молния', kind: 'damage', damage: '1d8', mp_cost: 2, skill: 'arcana', prepare: true } as AbilityDef,
      { id: 'ab_shield', label: 'Щит', kind: 'damage', damage: '1d4', mp_cost: 1, skill: 'arcana', prepare: true } as AbilityDef,
      { id: 'ab_slash', label: 'Взмах', kind: 'damage', damage: '1d6', mp_cost: 0, skill: 'arcana' } as AbilityDef,
    ]
    p.abilities = [...(p.abilities ?? []), 'ab_bolt', 'ab_shield', 'ab_slash']
  })
  const e = new GameEngine(c)
  e.start()
  ;(e as any).rng = new PRNG('magic-slots')
  const combat = startCombat(e)
  // ждём хода игрока — вне него причина «сейчас не ваш ход» идёт первой
  let guard = 0
  while (!combat.isPlayerTurn() && !combat.result && guard++ < 30) combat.playerEndTurn()
  let list = combat.playerAbilities()
  const bolt = list.find((a) => a.def.id === 'ab_bolt')
  check('1 способность с prepare недоступна, пока не подготовлена', !!bolt && !bolt.usable && bolt.reason.includes('не подготовлен'), bolt?.reason)
  const slash = list.find((a) => a.def.id === 'ab_slash')
  check('1 способность без prepare доступна как прежде', slash?.usable === true, slash?.reason)
  check('1 подготовка по кнопке листа персонажа', e.togglePreparedAbility('ab_bolt') === true)
  check('1 второй слот не влезает (лимит 1)', e.togglePreparedAbility('ab_shield') === false)
  check('1 состояние подготовки записано в сейв', (e.state.player.prepared_abilities ?? []).includes('ab_bolt'))
  list = combat.playerAbilities()
  check('1 подготовленная доступна в бою', list.find((a) => a.def.id === 'ab_bolt')?.usable === true, list.find((a) => a.def.id === 'ab_bolt')?.reason)
  check('1 повторный тоггл снимает подготовку', e.togglePreparedAbility('ab_bolt') === true && !(e.state.player.prepared_abilities ?? []).includes('ab_bolt'))
  // без meta.magic.slots системы подготовки нет (обратная совместимость)
  const c2 = synth((camp) => { delete camp.meta.magic })
  const e2 = new GameEngine(c2)
  e2.start()
  check('1 без meta.magic слоты выключены', c2.meta.magic === undefined && e2.togglePreparedAbility('ab_bolt') === false)
}

// ── 2. откат при критическом провале заклинания (backlash_table) ──
{
  const abDef: AbilityDef = {
    id: 'ab_hex', label: 'Порча', kind: 'damage', damage: '1d6', mp_cost: 0, skill: 'arcana',
    backlash_table: [{ weight: 1, text: 'Порча обернулась против колдуна!', hp_delta: -3 }],
  } as AbilityDef
  let sawBacklash = false
  let sawHpLoss = false
  for (let attempt = 0; attempt < 40 && !sawBacklash; attempt++) {
    const c = synth((camp) => {
      camp.meta.skills = [...(camp.meta.skills ?? []), { id: 'arcana', label: 'Магия' }]
      camp.meta.abilities = [abDef]
      const p = camp.entities[camp.meta.default_player] as NpcDef
      p.stats = { ...p.stats, CON: 18 }
      p.skills = { ...p.skills, arcana: 5 }
      p.abilities = ['ab_hex']
    })
    const e = new GameEngine(c)
    e.start()
    ;(e as any).rng = new PRNG(`backlash-${attempt}`)
    const combat = startCombat(e)
    const enemy = combat.combatants.find((x) => x.side === 'enemy')!
    const hpBefore = findPc(combat).hp
    for (let t = 0; t < 60 && !sawBacklash; t++) {
      ;(combat as any).resolveAbility(findPc(combat), abDef, enemy)
      sawBacklash = combat.log.some((l) => l.includes('обернулась против колдуна'))
      if (sawBacklash) sawHpLoss = findPc(combat).hp < hpBefore
    }
    if (sawBacklash) check('2 откат ранит заклинателя', sawHpLoss, `hp ${hpBefore}→${findPc(combat).hp}`)
  }
  check('2 критическая неудача применения вызывает запись таблицы отката', sawBacklash)
  // без таблицы отката критический провал — просто промах (как раньше)
  {
    const e = new GameEngine(synth((camp) => {
      camp.meta.skills = [...(camp.meta.skills ?? []), { id: 'arcana', label: 'Магия' }]
      camp.meta.abilities = [{ id: 'ab_plain', label: 'Обычная', kind: 'damage', damage: '1d6', mp_cost: 0, skill: 'arcana' } as AbilityDef]
      const p = camp.entities[camp.meta.default_player] as NpcDef
      p.skills = { ...p.skills, arcana: 5 }
      p.abilities = ['ab_plain']
    }))
    e.start()
    const combat = startCombat(e)
    const enemy = combat.combatants.find((x) => x.side === 'enemy')!
    for (let t = 0; t < 30; t++) (combat as any).resolveAbility(findPc(combat), { id: 'ab_plain', label: 'Обычная', kind: 'damage', damage: '1d6', mp_cost: 0, skill: 'arcana' }, enemy)
    check('2 без таблицы отката — промахи без последствий', !combat.log.some((l) => l.includes('откат')))
  }
}

// ── 3. преследование: счётчик провалов → облава со следствиями ──
{
  const c = synth((camp) => {
    const p = camp.entities[camp.meta.default_player] as NpcDef
    p.skills = {} // stealth нет — проверки сыплются
    p.stats = { ...p.stats, DEX: 6 }
    camp.meta.skills = [...(camp.meta.skills ?? []), { id: 'stealth', label: 'Скрытность' }]
    ;(camp.entities['npc_bandit'] as NpcDef).abilities = []
  })
  const e = new GameEngine(c)
  e.start()
  ;(e as any).rng = new PRNG('pursuit-fail')
  e.applyEffects([{ type: 'start_pursuit', label: 'Стража', skill: 'stealth', every_ticks: 1, fails_to_catch: 2, on_fail: [{ type: 'set_flag', flag: 'pursuit_caught' }] } as never])
  check('3 состояние погони появилось', !!e.state.pursuit, JSON.stringify(e.state.pursuit))
  e.advanceTicks(1)
  check('3 первый сорванный побег засчитан, погоня продолжается', (e.state.pursuit?.fails ?? 0) === 1, `fails=${e.state.pursuit?.fails}`)
  e.advanceTicks(1)
  check('3 повторная неудача — облава и следствия', !e.state.pursuit && !!e.state.flags['pursuit_caught'], `flags=${JSON.stringify(e.state.flags)}`)
  e.applyEffects([{ type: 'start_pursuit', skill: 'stealth', every_ticks: 1, fails_to_catch: 1, on_fail: [] } as never])
  e.applyEffects([{ type: 'stop_pursuit' } as never])
  check('3 stop_pursuit снимает погоню досрочно', !e.state.pursuit)
  // побег успешный: герой со 100% скрытности — провалы не копятся
  const e3 = new GameEngine(synth((camp) => {
    const p = camp.entities[camp.meta.default_player] as NpcDef
    p.skills = { stealth: 200 }
    camp.meta.skills = [...(camp.meta.skills ?? []), { id: 'stealth', label: 'Скрытность' }]
    ;(camp.entities['npc_bandit'] as NpcDef).abilities = []
  }))
  e3.start()
  ;(e3 as any).rng = new PRNG('pursuit-win')
  e3.applyEffects([{ type: 'start_pursuit', skill: 'stealth', every_ticks: 1, fails_to_catch: 2, on_fail: [{ type: 'set_flag', flag: 'caught' }] } as never])
  e3.advanceTicks(5)
  check('3 успешные броски не дают счётчику расти', e3.state.pursuit?.fails === 0 && !e3.state.flags['caught'])
}

// ── 4. самочувствие NPC: расписание со сном/без; без расписания — как раньше ──
{
  const c = synth((camp) => {
    const tpd = camp.meta.ticks_per_day ?? 24
    const stats = (camp.entities['npc_bran'] as NpcDef).stats
    camp.entities['npc_sleeper'] = {
      id: 'npc_sleeper', type: 'npc', label: 'Выспавшийся', description: '', stats, skills: {},
      schedule: [{ time_range: [22, 6 + tpd], location: 'loc', scene: 'scene_tavern_hall' }],
    } as NpcDef
    camp.entities['npc_tireless'] = {
      id: 'npc_tireless', type: 'npc', label: 'Не спит', description: '', stats, skills: {},
      schedule: [{ time_range: [8, 20], location: 'loc', scene: 'scene_tavern_hall' }],
    } as NpcDef
    camp.entities['npc_nosched'] = {
      id: 'npc_nosched', type: 'npc', label: 'Без расписания', description: '', stats, skills: {},
    } as NpcDef
  })
  const e = new GameEngine(c)
  e.start()
  check('4 по умолчанию самочувствие нейтральное', e.npcMood('npc_sleeper') === 50)
  const tpd = c.meta.ticks_per_day ?? 24
  e.advanceTicks(tpd)
  check('4 прописанный с ночным сном — бодрее', e.npcMood('npc_sleeper') > 50, `mood=${e.npcMood('npc_sleeper')}`)
  check('4 прописанный без ночного сна — измотан', e.npcMood('npc_tireless') < 50, `mood=${e.npcMood('npc_tireless')}`)
  check('4 без расписания не затронут (совместимость)', e.npcMood('npc_nosched') === 50 && !('npc_nosched' in (e.state.npc_mood ?? {})))
  // самочувствие двигает расположение (а значит и цены торговца)
  const base1 = e.getDisposition('npc_sleeper', 0)
  e.changeNpcMood('npc_sleeper', 100)
  const base2 = e.getDisposition('npc_sleeper', 0)
  check('4 самочувствие влияет на расположение', base2 > base1, `${base1}→${base2}`)
}

// ── 5. уровни сложности игрока ──
{
  const c = synth((camp) => {
    camp.meta.difficulties = [
      { id: 'easy', label: 'Путник', enemy_damage: 0.5, prices: 0.5 },
      { id: 'hard', label: 'Железный человек', enemy_damage: 1.5, prices: 2, need_decay: 2, no_autosave: true },
    ]
  })
  const e = new GameEngine(c)
  e.start()
  check('5 без выбора игроком берётся первый уровень', e.difficultyDef()?.id === 'easy')
  // цены: тот же торговец, тот же товар — только сложность меняется
  e.state.player.difficulty = 'easy'
  const merchant = c.entities['npc_bran'] as NpcDef
  const pEasy = e.buyPrice(merchant, 'item_travel_rations')
  e.state.player.difficulty = 'hard'
  const pHard = e.buyPrice(merchant, 'item_travel_rations')
  check('5 множитель цен применяется (hard дороже)', pHard > pEasy, `${pEasy}→${pHard}`)
  // автосейв отключён на «железном человеке»
  mem.clear()
  e.autosave()
  check('5 автосохранение выключено на «железном человеке»', mem.size === 0, `keys=${mem.size}`)
  e.state.player.difficulty = 'easy'
  e.autosave()
  check('5 автосохранение работает на обычной сложности', mem.size > 0)
  // урон врагов: прямой множитель через resolveAttack
  const ce = new GameEngine(synth((camp) => {
    camp.meta.difficulties = [{ id: 'hard', label: 'Тяжело', enemy_damage: 3 }]
    const p = camp.entities[camp.meta.default_player] as NpcDef
    p.equipment = undefined
    ;(camp.entities['npc_bandit'] as NpcDef).equipment = { weapon: 'item_test_club' }
    ;(camp.entities['npc_bandit'] as NpcDef).skills = { melee: 80 }
    camp.entities['item_test_club'] = {
      id: 'item_test_club', type: 'item', category: 'weapon', label: 'Дубина', description: '', weight: 1, stackable: false,
      weapon_data: { skill: 'melee', damage: '1d4', damage_bonus: false, range: 1, parry_capable: false, label: 'Дубина' },
    } as never
  }))
  ce.start()
  ;(ce as any).rng = new PRNG('diff-dmg')
  const combat2 = startCombat(ce)
  const pc = findPc(combat2)
  const bandit = combat2.combatants.find((x) => x.side === 'enemy')!
  pc.skills.melee = 0
  const hits: number[] = []
  for (let t = 0; t < 50 && hits.length < 6; t++) {
    bandit.attacksLeft = 1
    bandit.attacked = false
    const hp0 = pc.hp
    ;(combat2 as any).resolveAttack(bandit, pc)
    if (pc.hp < hp0) hits.push(hp0 - pc.hp)
    pc.hp = pc.maxHp // не умираем, собираем выборку
  }
  check('5 урон врага по герою умножается на 3', hits.length >= 3 && hits.some((d) => d >= 6), `выборка=${hits.join(',')}`)
}

console.log(failed ? `\nПРОВАЛОВ: ${failed}` : '\nвсе проверки зелёные')
process.exit(failed ? 1 : 0)
