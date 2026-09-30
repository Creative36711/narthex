/**
 * Headless-прогон накигэ «Станция „Тихая“».
 * fetch → public/, dev-сервер не обязателен.
 *
 * Запуск: npx tsx scripts/station-tikhaya-smoke.mts
 */
import { GameEngine } from '../src/core/engine'
import { loadCampaign } from '../src/core/loader'
import { clearDialogueCache } from '../src/core/dialogue'
import type { NpcDef } from '../src/shared/types'

const mem = new Map<string, string>()
;(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k) => mem.get(k) ?? null,
  setItem: (k, v) => {
    mem.set(k, String(v))
  },
  removeItem: (k) => {
    mem.delete(k)
  },
  clear: () => mem.clear(),
  key: () => null,
  length: 0,
} as Storage

{
  const orig = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const u = String(input)
    const pfx = 'http://localhost:5173/'
    if (u.startsWith(pfx)) {
      const { readFile } = await import('node:fs/promises')
      const rel = decodeURIComponent(new URL(u).pathname).replace(/^\/+/, '')
      const buf = await readFile(`public/${rel}`)
      return new Response(buf, { status: 200 })
    }
    return orig(input)
  }) as typeof fetch
}

let failed = 0
function check(name: string, ok: boolean, extra = '') {
  console.log(`${ok ? '✓' : '✗ FAIL'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!ok) failed++
}

function boot(): GameEngine {
  clearDialogueCache()
  const eng = new GameEngine(camp)
  eng.start()
  while (eng.cutscene) eng.endCutscene()
  return eng
}

const camp = await loadCampaign('http://localhost:5173/campaigns/station_tikhaya')
check('load id', camp.meta.id === 'station_tikhaya', camp.meta.id)
check('6 сцен', Object.keys(camp.scenes).length >= 6, String(Object.keys(camp.scenes).length))
check('endings ≥4', (camp.meta.endings?.length ?? 0) >= 4)
check('design_doc', !!camp.meta.design_doc && /накигэ|Накигэ/i.test(camp.meta.design_doc))
check('theme historical', camp.meta.theme?.profile === 'historical')

{
  const e = boot()
  check('quest homecoming', !!e.state.quests['quest_homecoming'], JSON.stringify(e.state.quests))
  check('grief after intro < 50', (e.state.player.needs['need_grief'] ?? 100) < 50, String(e.state.player.needs['need_grief']))
  check('scene platform', e.state.scene === 'scene_platform', e.state.scene)

  const occ = e.slotOccupants(e.currentScene())
  check(
    'letter visible (schedule [])',
    occ.some((o) => o.entity?.id === 'npc_letter'),
    occ.map((o) => o.entity?.id).join(','),
  )

  e.startDialogue('npc_letter')
  check('letter dialogue', !!e.dialogue)
  if (e.dialogue?.choices[0]) e.chooseDialogueOption(0)
  if (e.dialogue) e.endDialogue()
  check('read_letter', !!e.state.flags.read_letter)
}

{
  const e = boot()
  ;(e as unknown as { applyEffects: (x: unknown[]) => void }).applyEffects([
    { type: 'teleport_player', location: 'loc_station', scene: 'scene_cafe' },
  ])
  e.startDialogue('npc_lena')
  check('lena opens', !!e.dialogue)
  const apology = e.dialogue?.choices.findIndex((c) => /жаль/i.test(c.text)) ?? -1
  check('apology choice', apology >= 0, e.dialogue?.choices.map((c) => c.text).join(' | '))
  if (apology >= 0) e.chooseDialogueOption(apology)
  if (e.dialogue) e.endDialogue()
  check('lena_apology', !!e.state.flags.lena_apology)
  // personal + base_disposition (15) + meet(5) + apology(15) → getDisposition ≥ 35
  check(
    'lena disposition up',
    e.getDisposition('npc_lena') >= 30 && (e.state.dispositions.npc_lena ?? 0) >= 15,
    `get=${e.getDisposition('npc_lena')} personal=${e.state.dispositions.npc_lena}`,
  )

  // force trust for together branch
  e.state.dispositions.npc_lena = 50
  e.startDialogue('npc_lena')
  const go = e.dialogue?.choices.findIndex((c) => /Поедем/i.test(c.text)) ?? -1
  check('together invite', go >= 0, e.dialogue?.choices.map((c) => c.text).join(' | '))
  if (go >= 0) e.chooseDialogueOption(go)
  if (e.dialogue) e.endDialogue()
  check('lena_will_go', !!e.state.flags.lena_will_go)
}

{
  const e = boot()
  e.state.flags.lena_will_go = true
  e.state.flags.lena_apology = true
  ;(e as unknown as { applyEffects: (x: unknown[]) => void }).applyEffects([
    { type: 'teleport_player', location: 'loc_station', scene: 'scene_platform_night' },
  ])
  e.startDialogue('npc_conductor')
  check('conductor opens', !!e.dialogue)
  const together = e.dialogue?.choices.findIndex((c) => /вдвоём|Вдвоём/i.test(c.text)) ?? -1
  check('board together choice', together >= 0, e.dialogue?.choices.map((c) => c.text).join(' | '))
  if (together >= 0) e.chooseDialogueOption(together)
  check('victory', e.state.game_over?.type === 'victory', JSON.stringify(e.state.game_over))
  check('ending_together', e.state.game_over?.ending === 'ending_together', String(e.state.game_over?.ending))
}

{
  const e = boot()
  ;(e as unknown as { applyEffects: (x: unknown[]) => void }).applyEffects([
    { type: 'teleport_player', location: 'loc_station', scene: 'scene_platform_night' },
  ])
  e.startDialogue('npc_conductor')
  const stay = e.dialogue?.choices.findIndex((c) => /Остаюсь|передумал/i.test(c.text)) ?? -1
  check('stay choice', stay >= 0)
  if (stay >= 0) e.chooseDialogueOption(stay)
  check('ending_stay', e.state.game_over?.ending === 'ending_stay', String(e.state.game_over?.ending))
}

{
  const e = boot()
  // starting_tick 17 → need tick >= 23
  e.advanceTicks(6)
  check('missed flag or ending', !!e.state.flags.missed_train || e.state.game_over?.ending === 'ending_missed', JSON.stringify({ go: e.state.game_over, f: e.state.flags, tick: e.state.tick }))
  check('ending_missed', e.state.game_over?.ending === 'ending_missed', String(e.state.game_over?.ending))
}

{
  const letter = camp.entities['npc_letter'] as NpcDef
  check('letter schedule []', Array.isArray(letter.schedule) && letter.schedule!.length === 0)
  const lena = camp.entities['npc_lena'] as NpcDef
  check('lena dialogue path', lena.dialogue === 'dialogues/lena.ink')
}

console.log(failed ? `\n${failed} failed` : '\nall ok')
process.exit(failed ? 1 : 0)
