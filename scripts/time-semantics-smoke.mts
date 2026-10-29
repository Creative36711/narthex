import assert from 'node:assert/strict'
import { GameEngine } from '../src/core/engine'
import '../packs/narrative/operations'
import { evalCondition } from '../src/core/conditions'
import type { CampaignDef } from '../src/shared/types'

/**
 * Регрессионный стенд аудита кампании «Каркас» (2026-10):
 *  1) семантика времени. Условие tick_elapsed — АБСОЛЮТНЫЙ тик игры
 *     (`state.tick >= min_tick`), кампания «Каркас» когерентна: deadline_flood
 *     79 = starting_tick 7 + 72 часа. Новое условие elapsed_ge — «прошло с
 *     начала забега» и не требует мысленной поправки на starting_tick.
 *  2) лагерь и потребности. meta.camping.restore — восстановление
 *     потребностей за ночлег, управляется мастером (аудит: HUD обещал сон,
 *     а campRest потребности не восполнял). Без restore — классика: сон лечит
 *     раны и растит навыки, потребности продолжают проседать.
 */

const needs = [
  { id: 'need_rest', label: 'Отдых', max: 100, decay_per_tick: 1, critical_threshold: 15, on_zero_effect: 'rule_noop' },
  { id: 'need_hunger', label: 'Голод', max: 100, decay_per_tick: 0, critical_threshold: 15, on_zero_effect: 'rule_noop' },
]

function makeCampaign(camping?: CampaignDef['meta']['camping']): CampaignDef {
  return {
    meta: {
      id: 'test_time_semantics',
      title: 'Тест семантики времени и лагеря',
      author: 'Tester',
      version: '1.0.0',
      engine_version: '0.8.0',
      tick_label: 'ч',
      ticks_per_day: 24,
      starting_tick: 7, // как в «Каркасе»: забег стартует не с нуля
      deadline_ticks: 72,
      default_player: 'hero',
      starting_region: 'reg_1',
      starting_location: 'loc_camp',
      starting_scene: 'scene_camp',
      needs,
      currencies: [],
      max_companions: 2,
      camping,
    },
    player: {
      entity: 'hero',
      name: 'Тест',
      portrait: { neutral: '' },
      stats: { STR: 10, CON: 10, SIZ: 10, DEX: 10, INT: 10, POW: 10, CHA: 10 },
      skills: {},
      hp: 10,
      max_hp: 10,
      mp: 10,
      max_mp: 10,
      inventory: [],
      equipment: {},
      location: 'loc_camp',
      scene: 'scene_camp',
      revealed_locations: ['loc_camp'],
      flags: {},
      variables: {},
      stats_run: { moves: 0, turns: 0, kills: 0, rolls: 0, travels: 0 },
      history: [],
      statuses: [],
      dispositions: {},
      npc_mood: {},
      factions: {},
      quests: {},
      time: { day: 1, hour: 7, minute: 0, ticks: 7 },
      weather: 'clear',
      known_recipes: [],
      achievements: [],
      journal: [],
    },
    entities: {
      hero: {
        id: 'hero',
        type: 'npc',
        label: 'Герой',
        stats: { STR: 10, CON: 10, SIZ: 10, DEX: 10, INT: 10, POW: 10, CHA: 10 },
        skills: {},
      },
      npc_buddy: {
        id: 'npc_buddy',
        type: 'npc',
        label: 'Напарник',
        stats: { STR: 10, CON: 10, SIZ: 10, DEX: 10, INT: 10, POW: 10, CHA: 10 },
        skills: {},
        companion_needs: ['need_rest'],
      },
      item_bread: {
        id: 'item_bread',
        type: 'item',
        label: 'Хлеб',
        weight: 0.2,
        stackable: false,
      },
    },
    world: {
      regions: [
        {
          id: 'reg_1',
          label: 'Регион',
          locations: [
            {
              id: 'loc_camp',
              label: 'Полевой стан',
              position: { x: 100, y: 100 },
              scenes: ['scene_camp'],
              travel_connections: [],
              camp: true,
            },
          ],
        },
      ],
    },
    scenes: {
      scene_camp: { id: 'scene_camp', label: 'Походный костёр', text: '', actions: [] },
    },
    dialogues: {},
    quests: {},
    recipes: {},
    rules: {},
    codex: {},
    cutscenes: {},
    arenas: {},
  } as CampaignDef
}

console.log('--- time-semantics-smoke ---')

// ── 1. tick_elapsed (абсолютный) против elapsed_ge (от начала забега) ──
{
  const engine = new GameEngine(makeCampaign())
  const g = () => engine.state.tick

  assert.equal(g(), 7, 'забег стартует на starting_tick=7')
  // абсолютное условие: «часы мира не ниже N»
  assert.equal(evalCondition({ type: 'tick_elapsed', min_tick: 7 }, engine), true, 'tick_elapsed 7 на старте')
  assert.equal(evalCondition({ type: 'tick_elapsed', min_tick: 79 }, engine), false, 'tick_elapsed 79 на старте — ещё не случилось')
  // относительное условие: на старте прошло ровно 0
  assert.equal(evalCondition({ type: 'elapsed_ge', min: 0 }, engine), true, 'elapsed_ge 0 — старт есть старт')
  assert.equal(evalCondition({ type: 'elapsed_ge', min: 1 }, engine), false, 'elapsed_ge 1 на старте — ложно')

  // каркасная раскладка: deadline_flood на 79-м тике = 7 + 72 часа от старта
  engine.advanceTicks(71) // tick = 78
  assert.equal(evalCondition({ type: 'elapsed_ge', min: 72 }, engine), false, '78-й тик: прошло 71/72 — наводнение ещё не наступило')
  engine.advanceTicks(1) // tick = 79
  assert.equal(evalCondition({ type: 'elapsed_ge', min: 72 }, engine), true, '79-й тик: прошло 72 — deadline_flood')
  assert.equal(evalCondition({ type: 'tick_elapsed', min_tick: 79 }, engine), true, '…и он же — абсолютный 79; семантики сходятся на поправке')
}

// ── 2. лагерь БЕЗ restore: сон не чит-код, потребности проседают ──
{
  const engine = new GameEngine(makeCampaign({ ticks: 8 }))
  engine.state.player.needs = { need_rest: 40, need_hunger: 60 }
  engine.campRest()
  assert.equal(engine.state.tick, 15, 'ночлег длится 8 тиков (7 + 8)')
  assert.equal(engine.state.player.needs.need_rest, 32, 'без restore за 8 часов сна потребность только просела: 40 − 8')
  assert.equal(engine.state.player.needs.need_hunger, 60, 'потребность без decay не изменилась')
}

// ── 3. лагерь С restore: сон восстанавливает, «общий стол» для напарника ──
{
  const engine = new GameEngine(makeCampaign({ ticks: 8, restore: { need_rest: 100 }, ambush_chance: 0 }))
  engine.state.player.needs = { need_rest: 40, need_hunger: 60 }
  engine.addItem('item_bread', 1) // чтобы лагерь не выглядел голодным приколом — не влияет на проверки
  engine.joinParty('npc_buddy')
  const comp = engine.state.party[0]
  assert.ok(comp.needs?.need_rest === 100, 'напарник стартует с полным отдыхом')

  engine.campRest()

  assert.equal(engine.state.player.needs.need_rest, 100, 'сон 8 ч (просадка 40→32) + restore 100, клапнуто в max')
  assert.equal(comp.needs!.need_rest, 100, 'общий стол: напарник тоже прикрыл свои 8 просевших')
  assert.equal(engine.state.tick, 15, 'время шло (7 + 8)')
}

// ── 4. restore не трогает потребности, которых нет в списке, и не придумывает нужды ──
{
  const engine = new GameEngine(makeCampaign({ ticks: 8, restore: { need_rest: 100 } }))
  engine.state.player.needs = { need_rest: 0, need_hunger: 50 }
  engine.campRest()
  assert.equal(engine.state.player.needs.need_rest, 100, 'ноль отдыха → полный бак после ночи')
  assert.equal(engine.state.player.needs.need_hunger, 50, 'голод не в restore — не тронут')
}

console.log('✓ time-semantics-smoke: все группы проверок зелёные')
