/**
 * Headless-прогон кампании «Тишина Орфея» (монолит из _backlog).
 * Играет «как человек», но без UI: слоты, диалоги, карта, бой, крафт, финал.
 *
 * Запуск: npx tsx scripts/play-tishina.mts [_backlog/campaign.json]
 *
 * Не правит кампанию. Падения/некорректное поведение движка — чинить в src/.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { repairMonolith } from '../src/editor/monolith'
import { campaignFromMonolith } from '../src/editor/playtest'
import { GameEngine } from '../src/core/engine'
import { clearDialogueCache } from '../src/core/dialogue'
import type { ItemDef, ItemInteractOption, NpcDef } from '../src/shared/types'
import { hexDistance, type Hex } from '../src/core/hex'

// ── localStorage stub ──
const mem = new Map<string, string>()
;(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => {
    mem.set(k, v)
  },
  removeItem: (k: string) => {
    mem.delete(k)
  },
  clear: () => mem.clear(),
  key: () => null,
  length: 0,
} as Storage

const campaignPath = resolve(process.argv[2] ?? '_backlog/campaign.json')
const raw = JSON.parse(readFileSync(campaignPath, 'utf8'))
const { doc, warnings: repairWarns } = repairMonolith(raw)
if (repairWarns.length) {
  console.log('── repairMonolith warnings ──')
  for (const w of repairWarns.slice(0, 40)) console.log(' ·', w)
  if (repairWarns.length > 40) console.log(` · …и ещё ${repairWarns.length - 40}`)
}

clearDialogueCache()
const campaign = campaignFromMonolith(doc)

const log: string[] = []
function note(msg: string) {
  log.push(msg)
  console.log(msg)
}

function dumpState(eng: GameEngine, tag: string) {
  const s = eng.state
  const inv = s.player.inventory.map((i) => `${i.item}×${i.quantity}`).join(', ')
  const flags = Object.keys(s.flags)
    .filter((k) => s.flags[k])
    .sort()
    .join(', ')
  const go = s.game_over
  const goStr = go ? `${go.type}/${go.ending ?? '—'} «${go.reason}»` : 'false'
  note(
    `[${tag}] tick=${s.tick} scene=${s.scene} loc=${s.location} hp=${s.player.hp}/${s.player.max_hp}` +
      ` air=${Math.round(s.player.needs.need_air ?? 0)} energy=${Math.round(s.player.needs.need_energy ?? 0)}` +
      ` sanity=${eng.sanity()} game_over=${goStr}` +
      `\n  flags: ${flags || '(нет)'}` +
      `\n  inv: ${inv || '(пусто)'}` +
      `\n  quests: ${Object.entries(s.quests)
        .map(([id, q]) => `${id}:${q.stage}/${q.status}`)
        .join(', ')}`,
  )
}

function drainUI(eng: GameEngine) {
  // катсцены
  let guard = 0
  while (eng.cutscene && guard++ < 20) {
    note(`  «катсцена» ${eng.cutscene.label ?? eng.cutscene.id}`)
    eng.endCutscene()
  }
  // сообщения
  while (eng.messages.length) {
    const m = eng.messages.shift()!
    note(`  msg: ${m.text.slice(0, 160)}`)
  }
  // toasts
  eng.toasts = []
  // banners / postcard — визуал, не блокируют
  eng.banners = []
  eng.postcard = null
  // trade — закрываем без покупок (покупки делаем явно)
  if (eng.trade) {
    note(`  trade open with ${eng.trade.id} — leave`)
    eng.closeTrade?.()
    // fallback
    ;(eng as unknown as { trade: null }).trade = null
  }
}

function closeDialogue(eng: GameEngine) {
  if (!eng.dialogue) return
  note(`  close dialogue with ${eng.dialogue.npc.id}`)
  eng.endDialogue()
}

/** Выбрать реплику по подстроке текста (или первому совпадению regex). */
function pickChoice(eng: GameEngine, prefer: Array<string | RegExp>, fallbackLast = true): boolean {
  const d = eng.dialogue
  if (!d || !d.choices.length) return false
  for (const p of prefer) {
    const i = d.choices.findIndex((c) => (typeof p === 'string' ? c.text.includes(p) : p.test(c.text)))
    if (i >= 0) {
      note(`  → «${d.choices[i].text}»`)
      eng.chooseDialogueOption(d.choices[i].index)
      drainUI(eng)
      return true
    }
  }
  if (fallbackLast) {
    const last = d.choices[d.choices.length - 1]!
    note(`  → (fallback) «${last.text}»`)
    eng.chooseDialogueOption(last.index)
    drainUI(eng)
    return true
  }
  return false
}

function talkUntil(eng: GameEngine, prefer: Array<string | RegExp>, maxSteps = 20) {
  let steps = 0
  // once-выборы исчезают; идём по prefer по порядку, каждый — не больше одного раза
  const queue = [...prefer]
  while (eng.dialogue && !eng.dialogue.finished && steps++ < maxSteps) {
    if (eng.combat) break
    const lines = eng.dialogue.lines.map((l) => l.text).join(' | ')
    if (lines) note(`  «${eng.dialogue.npc.label}»: ${lines.slice(0, 200)}`)
    if (!eng.dialogue.choices.length) break

    const isExit = (t: string) => /Выход|Прощание|До связи|Замолчи|Закончить/i.test(t)
    const nonExit = eng.dialogue.choices.filter((c) => !isExit(c.text))

    let picked: { index: number; text: string } | undefined
    // 1) следующий prefer, который реально есть среди текущих choices
    while (queue.length && !picked) {
      const p = queue.shift()!
      const hit = eng.dialogue.choices.find((c) =>
        typeof p === 'string' ? c.text.includes(p) : p.test(c.text),
      )
      if (hit) picked = hit
    }
    // 2) любой не-выход
    if (!picked && nonExit.length) picked = nonExit[0]
    // 3) выход
    if (!picked) picked = eng.dialogue.choices.find((c) => isExit(c.text)) ?? eng.dialogue.choices[0]

    if (!picked) break
    note(`  → «${picked.text}»`)
    eng.chooseDialogueOption(picked.index)
    drainUI(eng)
    if (eng.dialogue?.finished) break
  }
  if (eng.dialogue) {
    let g = 0
    while (eng.dialogue && eng.dialogue.choices.length && g++ < 8) {
      const exit = eng.dialogue.choices.find((c) =>
        /Выход|Прощание|До связи|Замолчи|Закончить|Дальше/i.test(c.text),
      )
      if (exit) {
        note(`  → «${exit.text}»`)
        eng.chooseDialogueOption(exit.index)
      } else {
        pickChoice(eng, [], true)
      }
      drainUI(eng)
      if (eng.dialogue?.finished) break
    }
    if (eng.dialogue) closeDialogue(eng)
  }
}

function findOcc(eng: GameEngine, entityId: string) {
  const scene = eng.currentScene()
  return eng.slotOccupants(scene).find((o) => o.entity?.id === entityId)
}

function findSlot(eng: GameEngine, slotId: string) {
  const scene = eng.currentScene()
  return eng.slotOccupants(scene).find((o) => o.slot.id === slotId)
}

function interactEntity(eng: GameEngine, entityId: string, optionPrefer?: Array<string | RegExp>) {
  const occ = findOcc(eng, entityId)
  if (!occ?.entity) {
    note(`  !! нет сущности ${entityId} в сцене ${eng.state.scene}`)
    return false
  }
  if (occ.entity.type === 'npc') {
    note(`  talk ${entityId}`)
    eng.interactWithSlot(occ)
    drainUI(eng)
    return true
  }
  const item = occ.entity as ItemDef
  const opts = eng.itemInteractOptions(item)
  if (opts.length) {
    let pick: ItemInteractOption | undefined
    if (optionPrefer) {
      for (const p of optionPrefer) {
        pick = opts.find((o) => (typeof p === 'string' ? o.label.includes(p) : p.test(o.label)))
        if (pick) break
      }
    }
    pick ??= opts[0]
    note(`  interact ${entityId}: «${pick!.label}»`)
    eng.runItemInteract(item, pick!)
    drainUI(eng)
    return true
  }
  note(`  interact ${entityId} (default)`)
  eng.interactWithSlot(occ)
  drainUI(eng)
  return true
}

function useOnSlot(eng: GameEngine, slotId: string, itemId: string) {
  note(`  use ${itemId} on slot ${slotId}`)
  const ok = eng.useItemOnSlot(slotId, itemId)
  drainUI(eng)
  return ok
}

function goScene(eng: GameEngine, sceneId: string) {
  note(`  goToScene ${sceneId}`)
  eng.goToScene(sceneId)
  drainUI(eng)
}

function travel(eng: GameEngine, locId: string) {
  note(`  travelTo ${locId}`)
  eng.travelTo(locId)
  drainUI(eng)
}

/** Автобой: бежать к ближайшему врагу и бить, пока бой не кончится. */
function autoCombat(eng: GameEngine, maxRounds = 80) {
  const c = eng.combat
  if (!c) return
  note(`  ⚔ BOJ start arena=${c.arena?.id ?? c.arena?.label} intro?`)
  let guard = 0
  while (eng.combat && !eng.combat.result && guard++ < maxRounds * 8) {
    const combat = eng.combat
    if (!combat.isPlayerTurn()) {
      // AI должен уже отработать; если застряли — end turn safety
      combat.playerEndTurn()
      continue
    }
    const me = combat.active
    const foes = combat.combatants.filter((x) => x.side === 'enemy' && !x.dead && !x.fled && !x.down)
    if (!foes.length) break
    // атакуемый в радиусе?
    const inRange = foes.find((f) => combat.canAttack(me, f))
    if (inRange) {
      note(`    attack ${inRange.label} (hp ${inRange.hp})`)
      combat.playerAttack(inRange.id)
      continue
    }
    // подойти к ближайшему
    const target = foes
      .slice()
      .sort((a, b) => hexDistance(me.pos, a.pos) - hexDistance(me.pos, b.pos))[0]!
    const reach = combat.reachableHexes()
    let best: Hex | null = null
    let bestDist = Infinity
    for (const [k] of reach) {
      const [col, row] = k.split(',').map(Number)
      const h = { col, row }
      // не вставать на занятый
      if (combat.combatants.some((x) => !x.dead && !x.fled && x.pos.col === col && x.pos.row === row && x.id !== me.id))
        continue
      const d = hexDistance(h, target.pos)
      if (d < bestDist) {
        bestDist = d
        best = h
      }
    }
    if (best && (best.col !== me.pos.col || best.row !== me.pos.row) && me.movLeft > 0) {
      note(`    move → ${best.col},${best.row} (dist to foe ${bestDist})`)
      combat.playerMoveTo(best)
      // если после хода можно бить — бить
      continue
    }
    // нечем ходить — конец хода
    note(`    end turn (movLeft=${me.movLeft}, attacksLeft=${me.attacksLeft})`)
    combat.playerEndTurn()
  }
  if (eng.combat?.result) {
    note(`  ⚔ result=${eng.combat.result} round=${eng.combat.round}`)
    eng.endCombat()
    drainUI(eng)
  } else if (eng.combat) {
    note(`  ⚔ STUCK combat after ${guard} steps; force end`)
    // аварийно
    try {
      ;(eng.combat as { result: string }).result = 'victory'
      eng.endCombat()
    } catch (e) {
      note(`  combat force fail: ${e}`)
    }
    drainUI(eng)
  }
}

function buyFromVendor(eng: GameEngine, itemId: string, times = 1) {
  const npc = eng.campaign.entities['npc_vendor'] as NpcDef
  if (!npc) return
  eng.openTrade('npc_vendor')
  drainUI(eng)
  for (let i = 0; i < times; i++) {
    const offer = npc.trader?.sells?.find((s) => s.item === itemId)
    const price = offer?.price ?? 10
    const ok = eng.buyItem(itemId, price)
    note(`  buy ${itemId} @${price}cr → ${ok}`)
  }
  eng.closeTrade()
  drainUI(eng)
}

function tryCraft(eng: GameEngine, recipeId: string) {
  note(`  craft ${recipeId}`)
  const ok = eng.craft(recipeId)
  note(`  craft → ${ok}`)
  drainUI(eng)
  return ok
}

function useItem(eng: GameEngine, itemId: string) {
  if (!eng.hasItem(itemId)) return
  note(`  useItem ${itemId}`)
  eng.useItem(itemId)
  drainUI(eng)
}

function topUpNeeds(eng: GameEngine) {
  // воздух критичен
  while ((eng.state.player.needs.need_air ?? 100) < 50 && eng.hasItem('item_air_canister')) {
    useItem(eng, 'item_air_canister')
  }
  while ((eng.state.player.needs.need_energy ?? 100) < 40 && eng.hasItem('item_ration')) {
    useItem(eng, 'item_ration')
  }
  while ((eng.state.player.needs.need_energy ?? 100) < 40 && eng.hasItem('item_water')) {
    useItem(eng, 'item_water')
  }
  if (eng.state.player.hp < eng.state.player.max_hp - 3 && eng.hasItem('item_stim')) {
    useItem(eng, 'item_stim')
  }
}

// ═══════════════════════════════════════════════════════════
// RUN
// ═══════════════════════════════════════════════════════════

note(`=== LOAD ${campaignPath} ===`)
note(`campaign id=${campaign.meta.id} title=${campaign.meta.title} v=${campaign.meta.version}`)
note(`scenes=${Object.keys(campaign.scenes).length} entities=${Object.keys(campaign.entities).length}`)
note(`dialogues=${Object.keys(campaign.dialogues).length}`)

// boost skills slightly for reliable checks (still «human» path, not godmode)
const eng = new GameEngine(campaign)
// raise key skills so skill_check_gate rarely bricks the run
eng.state.player.skills.engineering = Math.max(eng.state.player.skills.engineering ?? 0, 70)
eng.state.player.skills.computers = Math.max(eng.state.player.skills.computers ?? 0, 65)
eng.state.player.skills.spot = Math.max(eng.state.player.skills.spot ?? 0, 60)
eng.state.player.skills.stealth = Math.max(eng.state.player.skills.stealth ?? 0, 55)
eng.state.player.skills.brawl = Math.max(eng.state.player.skills.brawl ?? 0, 55)
eng.state.player.skills.dodge = Math.max(eng.state.player.skills.dodge ?? 0, 50)
eng.state.player.skills.first_aid = Math.max(eng.state.player.skills.first_aid ?? 0, 50)
eng.state.player.name = 'Оператор'

// seed-friendly: fix rng if possible
note(`seed=${eng.state.seed}`)

try {
  eng.start()
  drainUI(eng)
  dumpState(eng, 'START')

  // ── Chapter 1: Airlock ──
  note('\n═══ ГЛАВА 1 · ШЛЮЗ ═══')
  interactEntity(eng, 'item_notice', ['Прочитать'])
  interactEntity(eng, 'item_air_canister') // may just show desc; canister is default_entity — pickup?
  // air canister on slot — check if pickup via interact or on_use only in inv
  // It's a scene item with no interact_options — interact shows description.
  // Actually looking at entity - only on_use. So it's decoration unless we "take"?
  // Check if there's take logic... item without interact_options and with on_interact?
  // No on_interact - just description. Campaign bug? Human would... maybe it's meant to be taken via something.
  // Looking again - starting inventory already has 2 canisters. Scene one is flavor.
  dumpState(eng, 'after airlock look')

  // travel to habitation via map
  travel(eng, 'loc_habitation')
  if (eng.combat) autoCombat(eng)
  dumpState(eng, 'hab arrive')

  // ── Chapter 2: Hab corridor ──
  note('\n═══ ГЛАВА 2 · ЖИЛОЙ КОРИДОР ═══')
  // power first
  interactEntity(eng, 'item_breaker', ['Поднять питание', 'Осмотреть'])
  // retry power if failed
  if (!eng.state.flags.power_hab_restored) {
    note('  retry power...')
    for (let i = 0; i < 5 && !eng.state.flags.power_hab_restored; i++) {
      interactEntity(eng, 'item_breaker', ['Поднять питание'])
    }
  }
  topUpNeeds(eng)

  // ORION
  interactEntity(eng, 'npc_orion')
  talkUntil(eng, [
    'Кто вы',
    'Где экипаж',
    'ключ шифра',
    'Нужен ключ',
    'Выход',
  ])
  // cipher key should be in inventory now
  if (!eng.hasItem('item_cipher_key')) {
    note('  !! нет ключа шифра после ОРИОНа — повтор')
    interactEntity(eng, 'npc_orion')
    talkUntil(eng, ['ключ', 'Нужен ключ', 'Выход'])
  }

  // tablet
  interactEntity(eng, 'item_trace', ['Поднять', 'Осмотреть'])

  // vendor - buy multitool + supplies
  interactEntity(eng, 'npc_vendor')
  talkUntil(eng, ['Купить', 'торгов', 'Что на корабле', 'До связи'])
  // after open_trade from dialogue
  if (eng.trade || true) {
    buyFromVendor(eng, 'item_multitool', 1)
    buyFromVendor(eng, 'item_tape', 2)
    buyFromVendor(eng, 'item_air_canister', 1)
    buyFromVendor(eng, 'item_ration', 1)
  }
  topUpNeeds(eng)
  dumpState(eng, 'after hab corridor')

  // ── Quarters ──
  note('\n═══ КАЮТЫ ═══')
  goScene(eng, 'scene_hab_quarters')
  // жетон — через «Осмотреть тело» (spot); карманы дают журнал/ленту
  interactEntity(eng, 'item_body_lin', ['Осмотреть тело'])
  if (!eng.hasItem('item_keycard')) {
    for (let i = 0; i < 4 && !eng.hasItem('item_keycard'); i++) {
      interactEntity(eng, 'item_body_lin', ['Осмотреть тело'])
    }
  }
  if (!eng.state.flags.lin_looted) {
    interactEntity(eng, 'item_body_lin', ['Обыскать карманы'])
  }
  interactEntity(eng, 'item_locker', ['Открыть мультитулом', 'Сломать', 'Осмотреть'])
  // echo
  interactEntity(eng, 'npc_echo')
  talkUntil(eng, ['Ты кто', 'Что считать', 'Замолчи'])
  dumpState(eng, 'after quarters')
  goScene(eng, 'scene_hab_corridor')

  // ── Med ──
  note('\n═══ МЕДОТСЕК ═══')
  goScene(eng, 'scene_hab_med')
  interactEntity(eng, 'item_medcabinet', ['Обыскать', 'Осмотреть'])
  interactEntity(eng, 'item_note_doctor', ['Прочитать'])
  // skip sleep - burns ticks
  topUpNeeds(eng)
  dumpState(eng, 'after med')
  goScene(eng, 'scene_hab_corridor')

  // start quest core? check rules - quest_core might need to be started
  // Looking at rules - quest_core stages start how?
  // Not auto-started. Check design - maybe from travel or rule.
  // quests only started: quest_comms (intro), quest_blackbox (enter bridge_gate)
  // quest_core - who starts it?
  const coreStart = Object.values(campaign.rules).find((r) =>
    JSON.stringify(r.effects).includes('quest_core'),
  )
  note(`  quest_core starter rule: ${coreStart?.id ?? 'NONE — campaign may rely on manual/start elsewhere'}`)

  // ── Bridge ──
  note('\n═══ ГЛАВА 3 · РУБКА ═══')
  travel(eng, 'loc_bridge')
  if (eng.combat) autoCombat(eng)
  dumpState(eng, 'bridge gate')

  // open gate with keycard (preferred — no skill check)
  if (eng.hasItem('item_keycard')) {
    interactEntity(eng, 'item_gate_panel', ['Приложить жетон', 'Вскрыть', 'Перерезать', 'Осмотреть'])
  } else {
    interactEntity(eng, 'item_gate_panel', ['Перерезать', 'Вскрыть', 'Осмотреть'])
  }
  if (!eng.state.flags.bridge_gate_open && !eng.state.flags.bridge_power_on) {
    for (let i = 0; i < 6 && !eng.state.flags.bridge_power_on; i++) {
      interactEntity(eng, 'item_gate_panel', ['Перерезать', 'Вскрыть', 'Приложить'])
    }
  }
  // also try use_with
  if (!eng.state.flags.bridge_gate_open && eng.hasItem('item_keycard')) {
    useOnSlot(eng, 'slot_gate_panel', 'item_keycard')
  }
  if (!eng.state.flags.bridge_gate_open && eng.hasItem('item_cutter')) {
    useOnSlot(eng, 'slot_gate_panel', 'item_cutter')
  }

  goScene(eng, 'scene_bridge')
  dumpState(eng, 'on bridge')

  // blackbox
  interactEntity(eng, 'item_blackbox', ['Отпереть гнездо', 'Вскрыть', 'Перерезать', 'Осмотреть'])
  if (!eng.state.flags.blackbox_taken) {
    for (let i = 0; i < 5 && !eng.state.flags.blackbox_taken; i++) {
      interactEntity(eng, 'item_blackbox', ['Отпереть', 'Вскрыть', 'Перерезать'])
    }
  }

  // bridge terminal - logs
  interactEntity(eng, 'item_bridge_terminal', [
    'Вставить ключ',
    'Подать питание',
    'Вызвать ОРИОНа',
    'Осмотреть',
  ])
  if (eng.dialogue) talkUntil(eng, ['Почему', 'Выход'])

  // decode logs if key
  if (eng.hasItem('item_cipher_key') && !eng.state.flags.logs_decoded) {
    interactEntity(eng, 'item_bridge_terminal', ['Вставить ключ', 'ключ'])
  }
  interactEntity(eng, 'item_viewport', ['Смотреть', 'Осмотреть'])
  topUpNeeds(eng)
  dumpState(eng, 'after bridge')

  // ── Engineering ──
  note('\n═══ ГЛАВА 4 · МАШИННОЕ ═══')
  // start quest_core if not started - engine may need start_quest
  if (!eng.state.quests['quest_core']) {
    note('  start_quest quest_core (manual — no rule found)')
    try {
      eng.startQuest('quest_core')
      drainUI(eng)
    } catch (e) {
      note(`  startQuest failed: ${e}`)
    }
  }

  travel(eng, 'loc_engineering')
  if (eng.combat) autoCombat(eng)
  dumpState(eng, 'eng corridor')

  // pursuit may trigger combat on tick - seal leak, loot cache
  interactEntity(eng, 'item_cache', ['Вскрыть', 'Осмотреть'])
  if (eng.hasItem('item_tape')) {
    interactEntity(eng, 'item_leak', ['Заделать', 'Осмотреть'])
  }
  interactEntity(eng, 'item_hatch', ['Открыть', 'Осмотреть', 'Спрятаться'])
  topUpNeeds(eng)

  // if pursuit still active, advancing ticks may trigger catch
  // go to reactor quickly
  goScene(eng, 'scene_eng_reactor')
  if (eng.combat) autoCombat(eng)
  dumpState(eng, 'reactor')

  // Kastor should be spawned
  const kastorOcc = findOcc(eng, 'npc_kastor')
  if (!kastorOcc) {
    note('  !! Кастор не заспавнен — пробуем слот')
    const slot = findSlot(eng, 'slot_kastor')
    note(`  slot_kastor entity=${slot?.entity?.id ?? 'null'}`)
  }
  interactEntity(eng, 'npc_kastor')
  talkUntil(eng, [
    'Что здесь произошло',
    'Что с сигналом',
    'Где ледяное ядро',
    'Как закрыть сигнал',
    'Что шумит',
    'Где остальные',
    'Дальше',
    'Прощание',
  ])
  // second talk for plan if truth known / recipes
  if (eng.state.flags.truth_known) {
    interactEntity(eng, 'npc_kastor')
    talkUntil(eng, ['Как закрыть', 'Где ледяное', 'Дальше', 'Прощание'])
  }
  dumpState(eng, 'after kastor')

  // take core (requires kastor_talked)
  if (!eng.state.flags.kastor_talked) {
    note('  !! kastor_talked not set — force via talk')
    interactEntity(eng, 'npc_kastor')
    talkUntil(eng, ['Прощание'])
  }
  interactEntity(eng, 'item_ice_core', ['Извлечь ядро', 'Извлечь'])
  if (!eng.state.flags.has_core) {
    // maybe option order — list options
    const occ = findOcc(eng, 'item_ice_core')
    if (occ?.entity?.type === 'item') {
      const opts = eng.itemInteractOptions(occ.entity as ItemDef)
      note(`  ice_core opts: ${opts.map((o) => o.label).join(' | ')}`)
      const extract = opts.find((o) => /Извлечь/i.test(o.label))
      if (extract) eng.runItemInteract(occ.entity as ItemDef, extract)
      drainUI(eng)
    }
  }
  if (eng.combat) autoCombat(eng)
  topUpNeeds(eng)
  dumpState(eng, 'after core')

  // craft seal if possible
  if (eng.state.recipes_unlocked?.includes('recipe_seal_drive') || campaign.recipes['recipe_seal_drive']) {
    // unlock may be needed
    if (!eng.hasItem('item_drive_seal')) {
      // ensure mats
      if (!eng.hasItem('item_multitool')) {
        // try buy again or skip
        note('  no multitool for craft')
      }
      tryCraft(eng, 'recipe_seal_drive')
    }
  }

  // craft seal (computers 40) — retry
  if (eng.state.recipes_unlocked?.includes('recipe_seal_drive')) {
    eng.state.player.skills.computers = Math.max(eng.state.player.skills.computers ?? 0, 80)
    for (let i = 0; i < 3 && !eng.hasItem('item_drive_seal'); i++) {
      tryCraft(eng, 'recipe_seal_drive')
    }
  }

  // finale via console — burn if core taken, else network
  note('\n═══ ФИНАЛ ═══')
  const finalePrefer = eng.hasItem('item_drive_seal')
    ? ['Запереть сигнал', 'Сбросить ледяное', 'Открыть внешний']
    : eng.hasItem('item_ice_core')
      ? ['Сбросить ледяное', 'Открыть внешний']
      : ['Открыть внешний', 'Отдать себя']

  interactEntity(eng, 'item_reactor_console', finalePrefer)
  drainUI(eng)
  if (eng.combat) autoCombat(eng)
  dumpState(eng, 'after finale action')

  // if not over, try other options
  if (!eng.state.game_over) {
    for (const pref of [
      ['Сбросить ледяное'],
      ['Открыть внешний'],
      ['Запереть сигнал'],
      ['Отдать себя'],
    ] as string[][]) {
      if (eng.state.game_over) break
      interactEntity(eng, 'item_reactor_console', pref)
      drainUI(eng)
      if (eng.combat) autoCombat(eng)
    }
  }

  dumpState(eng, 'END')
} catch (e) {
  note(`\n✖ EXCEPTION: ${e instanceof Error ? e.stack ?? e.message : String(e)}`)
  dumpState(eng, 'CRASH')
}

// write report
mkdirSync('docs/playtest', { recursive: true })
const reportPath = 'docs/playtest/tishina-orfeya-run-log.txt'
writeFileSync(reportPath, log.join('\n'), 'utf8')
note(`\nlog → ${reportPath}`)
const go = eng.state.game_over
note(
  `RESULT: game_over=${go ? `${go.type} ending=${go.ending} «${go.reason}»` : 'no'}` +
    ` flags=` +
    (['finale_burn', 'finale_network', 'finale_silence', 'finale_remember', 'merged']
      .filter((f) => eng.state.flags[f])
      .join(',') || '(none)'),
)

// exit code
process.exitCode = eng.state.game_over ? 0 : 2
