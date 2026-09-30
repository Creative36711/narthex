/**
 * Регрессии движка, найденные на плейтесте «Тишина Орфея».
 * Не зависит от dev-сервера — чистый headless.
 *
 *  1. NPC с schedule: [] всё ещё появляется как default_entity слота;
 *  2. generateInk объявляет EXTERNAL unlock_recipe / unlock_codex / …;
 *  3. startDialogue фолбэчит на первый knot, если нет main;
 *  4. createStory даёт сообщение с id диалога при ошибке компиляции.
 *
 * Запуск: npx tsx scripts/tishina-engine-smoke.mts
 */
import { generateInk } from '../src/editor/dialogueDoc'
import { createStory, clearDialogueCache, firstInkKnot } from '../src/core/dialogue'
import { GameEngine } from '../src/core/engine'
import type { CampaignData, DlgDoc, NpcDef, SceneDef } from '../src/shared/types'
import { DEFAULT_DICE_RULES } from '../src/shared/types'

const mem = new Map<string, string>()
;(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k) => mem.get(k) ?? null,
  setItem: (k, v) => {
    mem.set(k, v)
  },
  removeItem: (k) => {
    mem.delete(k)
  },
  clear: () => mem.clear(),
  key: () => null,
  length: 0,
} as Storage

let failed = 0
function check(name: string, ok: boolean, extra = '') {
  console.log(`${ok ? '✓' : '✗ FAIL'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!ok) failed++
}

// ── 1. пустой schedule не блокирует default_entity ──
{
  const npc: NpcDef = {
    id: 'npc_term',
    type: 'npc',
    label: 'Терминал',
    stats: { STR: 5, CON: 5, SIZ: 5, DEX: 5, INT: 5, POW: 5, CHA: 5 },
    skills: {},
    schedule: [], // артефакт редактора/ИИ
    dialogue: 'dlg_x',
  }
  const scene: SceneDef = {
    id: 'sc',
    label: 'Сцена',
    location: 'loc',
    states: [{ id: 's0', label: 'ок' }],
    slots: [
      {
        id: 'slot_a',
        label: 'Слот',
        type: ['terminal'],
        shape: 'rect',
        x: 0,
        y: 0,
        w: 10,
        h: 10,
        default_entity: 'npc_term',
      },
    ],
    navigation: [],
  }
  const campaign = {
    meta: {
      id: 't_empty_sched',
      title: 't',
      version: '1.0.0',
      package_format: 1,
      default_player: 'hero',
      starting_region: 'r',
      starting_location: 'loc',
      starting_scene: 'sc',
      needs: [],
      dice_rules: DEFAULT_DICE_RULES,
    },
    world: { regions: [{ id: 'r', label: 'R', locations: [{ id: 'loc', label: 'L', scenes: ['sc'], travel_connections: [] }] }] },
    scenes: { sc: scene },
    entities: {
      hero: {
        id: 'hero',
        type: 'npc',
        label: 'Герой',
        stats: { STR: 10, CON: 10, SIZ: 10, DEX: 10, INT: 10, POW: 10, CHA: 10 },
        skills: {},
        inventory: [],
      } as NpcDef,
      npc_term: npc,
    },
    rules: {},
    arenas: {},
    quests: {},
    encounters: {},
    cutscenes: {},
    recipes: {},
    codex: {},
    dialogues: { 'dialogues/dlg_x.ink': '=== main ===\nПривет.\n-> DONE\n' },
    basePath: '',
  } as unknown as CampaignData

  const eng = new GameEngine(campaign)
  eng.start()
  const occ = eng.slotOccupants(eng.currentScene())
  const hit = occ.find((o) => o.slot.id === 'slot_a')
  check('1 empty schedule[] → default_entity виден в слоте', hit?.entity?.id === 'npc_term', `got ${hit?.entity?.id}`)

  // NPC с настоящим расписанием в другой сцене — default не дублирует
  const scheduled = {
    ...npc,
    id: 'npc_sched',
    schedule: [{ scene: 'other', slot: 's', time_range: [0, 24] as [number, number] }],
  } as NpcDef
  campaign.entities['npc_sched'] = scheduled
  scene.slots[0]!.default_entity = 'npc_sched'
  const eng2 = new GameEngine(campaign)
  eng2.start()
  const hit2 = eng2.slotOccupants(eng2.currentScene()).find((o) => o.slot.id === 'slot_a')
  check('1 непустой schedule → default_entity НЕ дублируется', !hit2?.entity, `got ${hit2?.entity?.id}`)
}

// ── 2. generateInk EXTERNAL unlock_* ──
{
  const doc: DlgDoc = {
    version: 2,
    label: 't',
    nodes: [
      {
        id: 'n_start',
        label: 'S',
        sections: [],
        choices: [
          {
            text: 'Открыть',
            sections: [
              {
                steps: [
                  { kind: 'effect', effect: { type: 'unlock_recipe', recipe: 'r1' } },
                  { kind: 'effect', effect: { type: 'unlock_codex', entry: 'c1' } },
                  { kind: 'effect', effect: { type: 'apply_status', status: 's1', duration: 2 } },
                  { kind: 'effect', effect: { type: 'set_weather', weather: 'w1' } },
                ],
              },
            ],
            goto: 'end',
          },
          { text: 'Выход', sections: [], goto: 'end' },
        ],
        goto: 'end',
      },
    ],
  }
  const ink = generateInk(doc)
  check('2 EXTERNAL unlock_recipe', /EXTERNAL unlock_recipe\(id\)/.test(ink))
  check('2 EXTERNAL unlock_codex', /EXTERNAL unlock_codex\(id\)/.test(ink))
  check('2 EXTERNAL apply_status', /EXTERNAL apply_status\(id, d\)/.test(ink))
  check('2 EXTERNAL set_weather', /EXTERNAL set_weather\(id\)/.test(ink))
  // и компилируется
  clearDialogueCache()
  try {
    createStory(ink, 'dlg_unlock_test')
    check('2 ink с unlock_* компилируется', true)
  } catch (e) {
    check('2 ink с unlock_* компилируется', false, String(e))
  }
}

// ── 3. firstInkKnot + startDialogue fallback ──
{
  check('3 firstInkKnot находит n_start', firstInkKnot('=== n_start ===\nHi\n-> DONE\n') === 'n_start')
  check('3 firstInkKnot main', firstInkKnot('EXTERNAL x()\n\n=== main ===\nA\n') === 'main')

  const dlgInk = `EXTERNAL set_flag(f)\n\n=== n_start ===\nПривет из n_start.\n~ set_flag("talked")\n-> DONE\n`
  const campaign = {
    meta: {
      id: 't_knot',
      title: 't',
      version: '1.0.0',
      package_format: 1,
      default_player: 'hero',
      starting_region: 'r',
      starting_location: 'loc',
      starting_scene: 'sc',
      needs: [],
      dice_rules: DEFAULT_DICE_RULES,
    },
    world: { regions: [{ id: 'r', label: 'R', locations: [{ id: 'loc', label: 'L', scenes: ['sc'], travel_connections: [] }] }] },
    scenes: {
      sc: {
        id: 'sc',
        label: 'S',
        location: 'loc',
        states: [{ id: 's0', label: 'ok' }],
        slots: [
          {
            id: 'slot_n',
            label: 'N',
            type: ['person'],
            shape: 'rect',
            x: 0,
            y: 0,
            w: 10,
            h: 10,
            default_entity: 'npc_x',
          },
        ],
        navigation: [],
      },
    },
    entities: {
      hero: {
        id: 'hero',
        type: 'npc',
        label: 'Герой',
        stats: { STR: 10, CON: 10, SIZ: 10, DEX: 10, INT: 10, POW: 10, CHA: 10 },
        skills: {},
        inventory: [],
      } as NpcDef,
      npc_x: {
        id: 'npc_x',
        type: 'npc',
        label: 'X',
        stats: { STR: 5, CON: 5, SIZ: 5, DEX: 5, INT: 5, POW: 5, CHA: 5 },
        skills: {},
        dialogue: 'dlg_nstart',
      } as NpcDef,
    },
    rules: {},
    arenas: {},
    quests: {},
    encounters: {},
    cutscenes: {},
    recipes: {},
    codex: {},
    dialogues: { 'dialogues/dlg_nstart.ink': dlgInk },
    basePath: '',
  } as unknown as CampaignData

  clearDialogueCache()
  const eng = new GameEngine(campaign)
  eng.start()
  eng.startDialogue('npc_x')
  check('3 диалог без main открывается через n_start', !!eng.dialogue, `dialogue=${!!eng.dialogue}`)
  const text = eng.dialogue?.lines.map((l) => l.text).join(' ') ?? ''
  check('3 реплика из n_start', text.includes('n_start'), text)
  // эффект set_flag должен был примениться при drain
  check('3 флаг talked после входа', !!eng.state.flags.talked)

  // resolveDialogueSource: голый id
  const eng3 = new GameEngine({
    ...campaign,
    entities: {
      ...campaign.entities,
      npc_bare: {
        ...(campaign.entities['npc_x'] as NpcDef),
        id: 'npc_bare',
        dialogue: 'dlg_nstart', // без пути
      },
    },
  })
  eng3.start()
  clearDialogueCache()
  eng3.startDialogue('npc_bare')
  check('3 resolveDialogueSource по голому id', !!eng3.dialogue)
}

// ── 4. createStory error message ──
{
  clearDialogueCache()
  let msg = ''
  try {
    createStory('=== broken ===\n{ not_a_fn(\n', 'dlg_broken')
  } catch (e) {
    msg = e instanceof Error ? e.message : String(e)
  }
  check('4 ошибка компиляции содержит id', msg.includes('dlg_broken'), msg.slice(0, 80))
}

console.log(failed ? `\n${failed} failed` : '\nall ok')
process.exit(failed ? 1 : 0)
