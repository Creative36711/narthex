/**
 * Смоук раунда фидбека 27, часть 2: §9 дизайн-документа «Шестерни и пепел».
 * Запуск: npx tsx scripts/feedback28-smoke.mts (нужен dev-сервер :5173)
 *
 *  A. `open_craft` — изготовление открывается по ходу игры, а не только
 *     кнопкой HUD: эффект правила/предмета, внешний вызов из реплики,
 *     панель плеера с подсветкой нужного рецепта, поле в конструкторах.
 *  B. Дедлайн на раздумье в диалоге: мастер задаёт секунды и узел-цель в
 *     конструкторе (или `~ set_dialogue_timer` в сыром ink), игрок видит
 *     полоску обратного отсчёта, по нулю разговор уходит в узел или
 *     заканчивается.
 *  C. Чемодан: гайд, схема и TASK.md знают обе возможности.
 *  D. Новинки в поставляемой демо-кампании: ключ -> насос -> крафт,
 *     молчание на развязке с Йореком -> бой, аудит без замечаний.
 */
import { readFileSync } from 'node:fs'
import { loadCampaign } from '../src/core/loader'
import { GameEngine } from '../src/core/engine'
import '../packs/narrative/operations'
import { generateInk, migrateDlgDoc, newDlgDoc } from '../src/editor/dialogueDoc'
import { inkToDlgDoc, regenInk } from '../src/editor/inkImport'
import { EFFECT_SCHEMAS } from '../src/editor/schemas'
import { validateCampaign } from '../src/editor/campaignAudit'
import { EditorStore } from '../src/editor/store'
import { Compiler } from 'inkjs/full'
import type { DlgDoc, NpcDef } from '../src/shared/types'

let failed = 0
function check(name: string, ok: boolean, extra = '') {
  console.log(`${ok ? '✓' : '✗ FAIL'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!ok) failed++
}
const f = (p: string) => readFileSync(p, 'utf8')

const TIMER_INK = `EXTERNAL set_dialogue_timer(s, t)
EXTERNAL get_flag(a0)
EXTERNAL set_flag(a0)

=== main ===
Смотри в оба, инспектор.
-> hub

=== hub ===
~ set_dialogue_timer(12, "silence")
+ [Да, понял.]
    ~ set_flag("timer_yes")
    -> DONE
+ [Нет, спешу.]
    -> DONE

=== silence ===
Молчишь? Ну и ступай, мне некогда.
-> DONE
`

const NO_KNOT_INK = `EXTERNAL set_dialogue_timer(s, t)

=== main ===
Ну?
-> hub

=== hub ===
~ set_dialogue_timer(9, "")
+ [Всё, ухожу.]
    -> DONE
`

/** Прогнать аудит диалогов кампании (только текст ink, без файловой системы). */
async function auditDialogue(camp: Awaited<ReturnType<typeof loadCampaign>>, path: string): Promise<string[]> {
  const store = {
    meta: camp.meta,
    textFiles: new Map([[path, camp.dialogues[path] ?? '']]),
    jsonFiles: new Map(),
    manifest: { scenes: [], entities: [], rules: [], dialogues: [] },
    entityPaths: () => [],
    scenePaths: () => [],
    rulePaths: () => [],
    questPaths: () => [],
    json: () => undefined,
    entity: () => undefined,
    scene: () => undefined,
    rule: () => undefined,
    quest: () => undefined,
    text: (p: string) => camp.dialogues[p] ?? '',
    knownFlags: () => [],
  }
  const report = await validateCampaign(store as never)
  return report.structure.filter((x) => x.message.startsWith(path)).map((x) => x.message)
}

async function campaignWithDialogue(ink: string, key: string) {
  const base = await loadCampaign('http://localhost:5173/campaigns/ash-of-caerden')
  const camp = structuredClone(base)
  camp.dialogues[`dialogues/${key}.ink`] = ink
  const npcId = Object.keys(camp.entities).find((id) => camp.entities[id].type === 'npc')
  if (!npcId) throw new Error('в демо-кампании нет NPC')
  ;(camp.entities[npcId] as NpcDef).dialogue = `dialogues/${key}.ink`
  return { camp, npcId }
}

// ── A. open_craft ──
{
  const recipeId = Object.keys((await loadCampaign('http://localhost:5173/campaigns/ash-of-caerden')).recipes)[0]
  const { camp } = await campaignWithDialogue(TIMER_INK, '__craft_probe')
  const e = new GameEngine(camp)
  e.start()
  e.applyEffects([{ type: 'open_craft', recipe: recipeId }])
  check('A эффект open_craft открывает окно изготовления', !!e.craftRequest, JSON.stringify(e.craftRequest))
  check('A рецепт передан в окно', e.craftRequest?.recipe === recipeId, `${e.craftRequest?.recipe}`)
  e.closeCraft()
  check('A закрытие снимает запрос', e.craftRequest === null)

  // без рецепта — весь список
  e.applyEffects([{ type: 'open_craft' }])
  check('A open_craft без рецепта открывает общий список', !!e.craftRequest && !e.craftRequest.recipe)
  e.closeCraft()

  // во время окна крафта герой не «отдыхает» — окно модальное (как торговля)
  e.campaign.meta.camping = { ticks: 8 }
  const campLoc = e.findLocation(e.state.location)?.location
  if (campLoc) campLoc.camp = true
  const beforeOpen = e.campAvailable()
  e.applyEffects([{ type: 'open_craft' }])
  const withCraft = e.campAvailable()
  check('A лагерь доступен до открытия окна', beforeOpen.ok === true, JSON.stringify(beforeOpen))
  check('A окно крафта блокирует лагерь', withCraft.ok === false && withCraft.reason.includes('не до отдыха'), JSON.stringify(withCraft))
  e.closeCraft()

  // реплика закрывает диалог так же, как open_trade
  const { camp: camp2, npcId } = await campaignWithDialogue(
    `EXTERNAL open_craft(id)\n\n=== main ===\nДержи верстак.\n~ open_craft("${recipeId}")\n-> DONE\n`,
    '__craft_line',
  )
  const e2 = new GameEngine(camp2)
  e2.start()
  e2.startDialogue(npcId)
  check('A реплика ~ open_craft открывает изготовление', !!e2.craftRequest && !e2.dialogue)
  e2.closeCraft()
}

// ── B. дедлайн на раздумье ──
{
  const { camp, npcId } = await campaignWithDialogue(TIMER_INK, '__timer_probe')
  const e = new GameEngine(camp)
  e.start()
  e.startDialogue(npcId)
  check('B таймер из ink доехал до окна диалога', e.dialogue?.timer?.seconds === 12 && e.dialogue?.timer?.knot === 'silence',
    JSON.stringify(e.dialogue?.timer))
  check('B варианты ответа на месте', (e.dialogue?.choices.length ?? 0) === 2)
  e.dialogueTimeout()
  const lines = (e.dialogue?.lines ?? []).map((l) => l.text).join(' | ')
  check('B по таймауту разговор ушёл в узел молчания', lines.includes('Молчишь'), lines.slice(0, 80))
  check('B после ухода таймера нет', !e.dialogue?.timer)

  // выбор игрока снимает таймер
  const e3 = new GameEngine((await campaignWithDialogue(TIMER_INK, '__timer_probe')).camp)
  e3.start()
  e3.startDialogue(npcId)
  e3.chooseDialogueOption(0)
  check('B выбор игрока снимает таймер', !e3.dialogue?.timer)

  // без узла — разговор заканчивается сам
  const { camp: camp2, npcId: npc2 } = await campaignWithDialogue(NO_KNOT_INK, '__timer_end')
  const e4 = new GameEngine(camp2)
  e4.start()
  e4.startDialogue(npc2)
  check('B таймер без узла тоже виден игроку', e4.dialogue?.timer?.seconds === 9 && !e4.dialogue?.timer?.knot)
  e4.dialogueTimeout()
  check('B без узла по таймауту диалог закрывается', e4.dialogue === null)

  // генератор ink из конструктора
  const doc: DlgDoc = structuredClone(newDlgDoc('Таймер')) as DlgDoc
  doc.nodes[0].sections = [{ steps: [{ kind: 'line', line: { text: 'Тихо!' } }] }]
  doc.nodes[0].choices = [{ text: 'Молчать.', sections: [], goto: 'end' }]
  doc.nodes[0].timer = { seconds: 7, node: undefined }
  const ink = generateInk(doc)
  check('B generateInk пишет set_dialogue_timer', ink.includes('~ set_dialogue_timer(7, "")'), ink.split('\n').find((l) => l.includes('set_dialogue_timer')) ?? '')
  check('B EXTERNAL для таймера объявлен', ink.includes('EXTERNAL set_dialogue_timer(s, t)'))
  const compiled = new Compiler(ink).Compile()
  check('B сгенерированный ink компилируется', !!compiled)

  doc.nodes[0].timer = { seconds: 15, node: doc.nodes[0].id }
  const ink2 = generateInk(doc)
  check('B узел-цель попадает в вызов', ink2.includes(`~ set_dialogue_timer(15, "${doc.nodes[0].id}")`), ink2.split('\n').find((l) => l.includes('set_dialogue_timer')) ?? '')

  // миграция документа не теряет таймер
  const migrated = migrateDlgDoc(JSON.parse(JSON.stringify({ ...doc, version: 2 })))
  check('B миграция сохраняет таймер узла', migrated.nodes[0].timer?.seconds === 15)
}

// ── B2. аудит: таймер с битой целью и слишком короткий дедлайн ──
{
  const base = await loadCampaign('http://localhost:5173/campaigns/ash-of-caerden')
  const camp = structuredClone(base)
  camp.dialogues['dialogues/__audit_timer.ink'] = [
    'EXTERNAL set_dialogue_timer(s, t)',
    '',
    '=== main ===',
    '~ set_dialogue_timer(3, "нет_такого_узла")',
    '+ [Да.]',
    '    -> DONE',
    '',
  ].join('\n')
  const report = await auditDialogue(camp, 'dialogues/__audit_timer.ink')
  check('B аудит ругает слишком короткий дедлайн', report.some((m) => m.includes('меньше 5 секунд')), report.join(' | ').slice(0, 120))
  check('B аудит ругает несуществующий узел таймера', report.some((m) => m.includes('нет_такого_узла')), report.join(' | ').slice(0, 120))
  camp.dialogues['dialogues/__audit_timer.ink'] = camp.dialogues['dialogues/__audit_timer.ink']
    .replace('set_dialogue_timer(3, "нет_такого_узла")', 'set_dialogue_timer(12, "silence")')
    .replace('\n=== main ===', '\n=== silence ===\nМолчишь?\n-> DONE\n\n=== main ===')
  const ok = await auditDialogue(camp, 'dialogues/__audit_timer.ink')
  check('B корректный таймер аудит не тревожит', ok.length === 0, ok.join(' | ').slice(0, 120))

  // вызов внешней функции без EXTERNAL — диалог молча не открывается
  camp.dialogues['dialogues/__audit_ext.ink'] = [
    '=== main ===',
    'Привет.',
    '~ open_craft("recipe_x")',
    '-> DONE',
    '',
  ].join('\n')
  const bad = await auditDialogue(camp, 'dialogues/__audit_ext.ink')
  check('B аудит ловит вызов без EXTERNAL', bad.some((m) => m.includes('EXTERNAL') && m.includes('open_craft')), bad.join(' | ').slice(0, 140))
  camp.dialogues['dialogues/__audit_ext.ink'] = 'EXTERNAL open_craft(id)\n\n' + camp.dialogues['dialogues/__audit_ext.ink']
  const good = await auditDialogue(camp, 'dialogues/__audit_ext.ink')
  check('B с EXTERNAL аудит молчит', good.length === 0, good.join(' | ').slice(0, 140))
}

// ── C. редактор и чемодан ──
{
  const builder = f('src/editor/DialogueBuilder.tsx')
  check('C в конструкторе есть блок «Таймер на раздумье»', builder.includes('Таймер на раздумье') && builder.includes('Секунд на раздумье'))
  check('C в конструкторе есть эффект открытия изготовления', builder.includes("id: 'open_craft'"))
  check('C схема эффектов знает open_craft', !!EFFECT_SCHEMAS.open_craft && EFFECT_SCHEMAS.open_craft.fields[0]?.optional === true)
  const overlay = f('src/player/DialogueOverlay.tsx')
  check('C в диалоговом окне есть полоска отсчёта', overlay.includes('dialogue-timer-fill') && overlay.includes('engine.dialogueTimeout()'))
  const css = f('src/index.css')
  check('C стили отсчёта и подсветки рецепта на месте', css.includes('.dialogue-timer-fill') && css.includes('.craft-focused'))
  const view = f('src/player/GameView.tsx')
  check('C панель крафта открывается запросом движка', view.includes('engine.craftRequest') && view.includes('focusRecipe={engine.craftRequest?.recipe}'))

  const guide = f('docs/ai-campaign-guide.md')
  const kit = f('public/ai/campaign-guide.md')
  check('C чемодан синхронизирован', kit === guide)
  check('C гайд описывает open_craft', guide.includes('open_craft("recipe_valve")') && guide.includes('| `open_craft`'))
  check('C гайд описывает таймер раздумья', guide.includes('set_dialogue_timer(15, "узел_молчания")') && guide.includes('Таймер на раздумье'))
  const schema = f('docs/campaign.schema.json')
  check('C схема кампании знает open_craft и timer', schema.includes('"open_craft"') && schema.includes('"timer"'))
  const task = f('src/editor/aiTask.ts')
  check('C TASK.md несёт оба инструмента', task.includes('open_craft') && task.includes('set_dialogue_timer'))
}

// ── B3. круг «выгрузка -> импорт -> выгрузка»: таймер не теряется ──
{
  const doc: DlgDoc = {
    version: 2,
    label: 'Стражник у ворот',
    nodes: [
      {
        id: 'main',
        label: 'Разговор',
        sections: [{ steps: [{ kind: 'line', line: { text: 'Ты что-то сказал?' } }] }],
        choices: [
          { text: 'Да, слушаю.', sections: [], goto: 'end' },
          { text: 'Нет, молчу.', sections: [], goto: 'end' },
        ],
        timer: { seconds: 12, node: 'silence' },
      },
      {
        id: 'silence',
        label: 'Молчание',
        sections: [{ steps: [{ kind: 'line', line: { text: 'Тогда ступай. Мне некогда.' } }] }],
        choices: [],
        goto: 'end',
      },
    ],
  }
  const back = inkToDlgDoc(generateInk(doc))
  const main = back.doc.nodes.find((n) => n.id === 'main')
  check('B импорт ink возвращает таймер в поле узла', main?.timer?.seconds === 12 && main?.timer?.node === 'silence', JSON.stringify(main?.timer))
  check('B импорт таймера проходит без замечаний', back.warnings.length === 0, back.warnings.slice(0, 2).join(' | '))
  check('B повторная выгрузка сохраняет таймер', regenInk(back.doc).includes('~ set_dialogue_timer(12, "silence")'))
}

// ── D. новинки работают в поставляемой демо-кампании (сквозной прогон) ──
{
  const demo = await loadCampaign('http://localhost:5173/campaigns/ash-of-caerden')

  // §9.3: ключ из штольни -> насос в забое -> окно крафта с нужным рецептом
  const run = new GameEngine(demo)
  run.start()
  run.goToScene('scene_mine_entrance')
  const wrenchSlot = demo.scenes['scene_mine_entrance'].slots.find((s) => s.default_entity === 'item_wrench')
  check('D в штольне лежит гаечный ключ', !!wrenchSlot)
  if (wrenchSlot) run.interactWithSlot({ slot: wrenchSlot, entity: demo.entities['item_wrench'] } as never)
  check('D ключ поднят и отмечен флагом', run.hasItem('item_wrench') && !!run.state.flags['wrench_taken'])

  run.goToScene('scene_mine_deep')
  const pump = demo.scenes['scene_mine_deep'].slots.find((s) => s.id === 'slot_pump')
  check('D в забое стоит насос', !!pump)
  check('D ключ предлагается применить', run.slotUseOptions(pump!).some((o) => o.itemId === 'item_wrench'))
  run.useItemOnSlot('slot_pump', 'item_wrench')
  check('D применение ключа открыло крафт с рецептом', run.craftRequest?.recipe === 'recipe_pump_water')
  run.closeCraft()
  const before = run.itemCount('item_waterskin')
  check('D рецепт варится, инструмент остаётся', run.craft('recipe_pump_water') && run.itemCount('item_waterskin') > before && run.hasItem('item_wrench'))

  const noKey = new GameEngine(demo)
  noKey.start()
  noKey.goToScene('scene_mine_deep')
  const pump2 = demo.scenes['scene_mine_deep'].slots.find((s) => s.id === 'slot_pump')!
  check('D без ключа применять нечего', noKey.slotUseOptions(pump2).length === 0)
  noKey.interactWithSlot({ slot: pump2, entity: demo.entities['item_pump'] } as never)
  check('D без ключа игрок получает подсказку', (noKey.messages.at(-1)?.text ?? '').includes('ключ'))

  // §9.4: молчание на развязке с Йореком заканчивается боем
  const talk = new GameEngine(demo)
  talk.start()
  talk.goToScene('scene_ravine_camp')
  talk.startDialogue('npc_yorek')
  check('D в диалоге Йорека есть таймер', talk.dialogue?.timer?.seconds === 20 && talk.dialogue?.timer?.knot === 'silence')
  talk.dialogueTimeout()
  check('D молчание уводит в бой и закрывает диалог', !!talk.combat && !talk.dialogue)

  // мастер редактирует демо-кампанию без замечаний
  const store = new EditorStore('http://localhost:5173/campaigns/ash-of-caerden')
  await store.load()
  const report = await validateCampaign(store)
  const issues = Array.isArray(report) ? report : []
  check('D демо-кампания проходит аудит без замечаний', issues.length === 0, JSON.stringify(issues.slice(0, 3)).slice(0, 200))
}

console.log(failed === 0 ? '\nвсе проверки 28-го раунда (§9) пройдены' : `\nпровалено проверок: ${failed}`)
process.exit(failed === 0 ? 0 : 1)
