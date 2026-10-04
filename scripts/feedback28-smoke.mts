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
 */
import { readFileSync } from 'node:fs'
import { loadCampaign } from '../src/core/loader'
import { GameEngine } from '../src/core/engine'
import { generateInk, migrateDlgDoc, newDlgDoc } from '../src/editor/dialogueDoc'
import { EFFECT_SCHEMAS } from '../src/editor/schemas'
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

console.log(failed === 0 ? '\nвсе проверки 28-го раунда (§9) пройдены' : `\nпровалено проверок: ${failed}`)
process.exit(failed === 0 ? 0 : 1)
