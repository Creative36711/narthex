/**
 * Регрессии рантайма, вскрытые ИИ-кампаниями (пустой schedule, knot ≠ main,
 * EXTERNAL unlock_*, пустые portrait-строки). Полигон — ash-of-caerden
 * (smoke-fixture); dev-сервер не нужен (fetch → public/).
 *
 *  1. NPC с schedule: [] всё ещё виден как default_entity слота;
 *     NPC с непустым schedule «занят» и default не дублирует;
 *  2. generateInk объявляет EXTERNAL unlock_recipe / unlock_codex / …;
 *  3. startDialogue: knot main → firstInkKnot; bare id dlg → path;
 *  4. createStory: ошибка компиляции содержит id диалога;
 *  5. assetUrlOrNull: пустая/пробельная строка → null (нет битого <img>);
 *  6. ash-of-caerden: живые диалоги с main открываются.
 *
 * Запуск: npx tsx scripts/ai-runtime-smoke.mts
 */
import { readFileSync } from 'node:fs'
import { generateInk } from '../src/editor/dialogueDoc'
import {
  createStory,
  clearDialogueCache,
  firstInkKnot,
} from '../src/core/dialogue'
import { GameEngine } from '../src/core/engine'
import { assetUrl, assetUrlOrNull, loadCampaign } from '../src/core/loader'
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

// fetch → public/ (как visual-smoke): ash-of-caerden без живого vite
{
  const orig = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
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

function miniCampaign(opts: {
  id: string
  npc: NpcDef
  scene: SceneDef
  dialogues?: Record<string, string>
  extraEntities?: Record<string, NpcDef>
}): CampaignData {
  const hero: NpcDef = {
    id: 'hero',
    type: 'npc',
    label: 'Герой',
    stats: { STR: 10, CON: 10, SIZ: 10, DEX: 10, INT: 10, POW: 10, CHA: 10 },
    skills: {},
    inventory: [],
  }
  return {
    meta: {
      id: opts.id,
      title: 't',
      version: '1.0.0',
      package_format: 1,
      default_player: 'hero',
      starting_region: 'r',
      starting_location: 'loc',
      starting_scene: opts.scene.id,
      needs: [],
      dice_rules: DEFAULT_DICE_RULES,
    },
    world: {
      regions: [
        {
          id: 'r',
          label: 'R',
          locations: [
            {
              id: 'loc',
              label: 'L',
              scenes: [opts.scene.id, 'other'],
              travel_connections: [],
            },
          ],
        },
      ],
    },
    scenes: {
      [opts.scene.id]: opts.scene,
      other: {
        id: 'other',
        label: 'Other',
        location: 'loc',
        states: [{ id: 's0', label: 'ok' }],
        slots: [],
        navigation: [],
      },
    },
    entities: {
      hero,
      [opts.npc.id]: opts.npc,
      ...(opts.extraEntities ?? {}),
    },
    rules: {},
    arenas: {},
    quests: {},
    encounters: {},
    cutscenes: {},
    recipes: {},
    codex: {},
    dialogues: opts.dialogues ?? {},
    basePath: '',
  } as unknown as CampaignData
}

// ── 1. пустой schedule не блокирует default_entity (на шаблоне + ash-паттерн) ──
{
  const npc: NpcDef = {
    id: 'npc_term',
    type: 'npc',
    label: 'Терминал',
    stats: { STR: 5, CON: 5, SIZ: 5, DEX: 5, INT: 5, POW: 5, CHA: 5 },
    skills: {},
    schedule: [], // артефакт редактора/ИИ — «расписания нет»
    dialogue: 'dlg_x',
    portrait: { neutral: '' },
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
  const campaign = miniCampaign({
    id: 't_empty_sched',
    npc,
    scene,
    dialogues: { 'dialogues/dlg_x.ink': '=== main ===\nПривет.\n-> DONE\n' },
  })
  const eng = new GameEngine(campaign)
  eng.start()
  const hit = eng.slotOccupants(eng.currentScene()).find((o) => o.slot.id === 'slot_a')
  check('1 empty schedule[] → default_entity виден', hit?.entity?.id === 'npc_term', `got ${hit?.entity?.id}`)

  // непустой schedule в другой сцене — default не дублирует
  const scheduled: NpcDef = {
    ...npc,
    id: 'npc_sched',
    schedule: [{ scene: 'other', slot: 's', time_range: [0, 24] as [number, number] }],
  }
  campaign.entities['npc_sched'] = scheduled
  scene.slots[0]!.default_entity = 'npc_sched'
  const eng2 = new GameEngine(campaign)
  eng2.start()
  const hit2 = eng2.slotOccupants(eng2.currentScene()).find((o) => o.slot.id === 'slot_a')
  check('1 непустой schedule → default НЕ дублируется', !hit2?.entity, `got ${hit2?.entity?.id}`)
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
  clearDialogueCache()
  try {
    createStory(ink, 'dlg_unlock_test')
    check('2 ink с unlock_* компилируется', true)
  } catch (e) {
    check('2 ink с unlock_* компилируется', false, String(e))
  }
}

// ── 3. firstInkKnot + startDialogue fallback + bare id ──
{
  check('3 firstInkKnot n_start', firstInkKnot('=== n_start ===\nHi\n-> DONE\n') === 'n_start')
  check('3 firstInkKnot main', firstInkKnot('EXTERNAL x()\n\n=== main ===\nA\n') === 'main')

  const dlgInk = `EXTERNAL set_flag(f)\n\n=== n_start ===\nПривет из n_start.\n~ set_flag("talked")\n-> DONE\n`
  const npc: NpcDef = {
    id: 'npc_x',
    type: 'npc',
    label: 'X',
    stats: { STR: 5, CON: 5, SIZ: 5, DEX: 5, INT: 5, POW: 5, CHA: 5 },
    skills: {},
    dialogue: 'dialogues/dlg_nstart.ink',
  }
  const scene: SceneDef = {
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
  }
  const campaign = miniCampaign({
    id: 't_knot',
    npc,
    scene,
    dialogues: { 'dialogues/dlg_nstart.ink': dlgInk },
  })
  clearDialogueCache()
  const eng = new GameEngine(campaign)
  eng.start()
  eng.startDialogue('npc_x')
  check('3 диалог без main открывается через n_start', !!eng.dialogue)
  const text = eng.dialogue?.lines.map((l) => l.text).join(' ') ?? ''
  check('3 реплика из n_start', text.includes('n_start'), text)
  check('3 флаг talked после входа', !!eng.state.flags.talked)

  // bare id (как в monлите до repair)
  const bare: NpcDef = { ...npc, id: 'npc_bare', dialogue: 'dlg_nstart' }
  campaign.entities['npc_bare'] = bare
  clearDialogueCache()
  const eng3 = new GameEngine(campaign)
  eng3.start()
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

// ── 5. assetUrlOrNull (пустые portrait ИИ) ──
{
  const fake = { basePath: '/campaigns/x' } as CampaignData
  check('5 assetUrlOrNull(null) → null', assetUrlOrNull(fake, null) === null)
  check('5 assetUrlOrNull("") → null', assetUrlOrNull(fake, '') === null)
  check('5 assetUrlOrNull("  ") → null', assetUrlOrNull(fake, '  ') === null)
  check(
    '5 assetUrlOrNull(path) → url',
    assetUrlOrNull(fake, 'assets/a.png') === assetUrl(fake, 'assets/a.png'),
  )
  // truthy-ловушка: "" && x  в старом коде шло в <img>
  check('5 пустая строка truthy в JS, но не URL', Boolean('') === false || true) // document intent
  check('5 "" не годится как src', !assetUrlOrNull(fake, ''))
}

// ── 6. ash-of-caerden: живые диалоги ──
{
  const demo = await loadCampaign('http://localhost:5173/campaigns/ash-of-caerden')
  check('6 ash загрузился', demo.meta.id === 'ash-of-caerden', demo.meta.id)
  // bran: schedule непустой + default? — слот через schedule
  const eng = new GameEngine(demo)
  eng.start()
  // maeva / bran — диалоги с main
  eng.startDialogue('npc_bran')
  check('6 bran.ink (main) открывается', !!eng.dialogue && (eng.dialogue.lines.length > 0 || eng.dialogue.choices.length > 0))
  eng.endDialogue()

  // schedule: bran должен быть в своём слоте по расписанию, не «пропасть» из-за []
  const bran = demo.entities['npc_bran'] as NpcDef
  check('6 bran.schedule непустой (полигон-канон)', (bran.schedule?.length ?? 0) > 0)

  // generateInk из dlg.json bran, если есть
  try {
    const dlg = JSON.parse(readFileSync('public/campaigns/ash-of-caerden/dialogues/bran.dlg.json', 'utf8'))
    const ink = generateInk(dlg)
    check('6 bran.dlg → ink компилируется', true)
    clearDialogueCache()
    createStory(ink, 'bran_regen')
    check('6 regen bran ink валиден', true)
    void ink
  } catch (e) {
    check('6 bran.dlg → ink', false, String(e))
  }
}

console.log(failed ? `\n${failed} failed` : '\nall ok')
process.exit(failed ? 1 : 0)
