/**
 * Смоук мастерского сценария диалога (раунд 29): текст ↔ структура ↔ ink.
 *
 * Прогон: npx tsx scripts/dlg-script-smoke.mts
 */
import { dlgToScript, exampleScript, scriptToDlg, type ScriptRefs } from '../src/editor/dlgScript'
import { generateInk, newDlgDoc } from '../src/editor/dialogueDoc'
import { inkToDlgDoc } from '../src/editor/inkImport'
import type { DlgDoc } from '../src/shared/types'

let failures = 0
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) console.log(`✓ ${name}`)
  else {
    failures++
    console.log(`✗ FAIL ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

// ── реестры вымышленной кампании ──
const items = [
  { id: 'item_token_crew', label: 'Жетон бригады' },
  { id: 'item_tea', label: 'Кружка чая' },
]
// реестр флагов изменяемый: редактор дописывает туда флаги, придуманные в сценарии
const flags = [{ id: 'volt_deal', label: 'Сделка с Вольтом' }]
/** разбор сценария «как в редакторе»: новые флаги сразу попадают в реестр */
const parse = (text: string, prev?: DlgDoc) => {
  const result = scriptToDlg(text, refs, prev)
  for (const f of result.newFlags) if (!flags.some((x) => x.id === f.id || x.label === f.label)) flags.push(f)
  return result
}
const refs: ScriptRefs = {
  options: (kind) => {
    switch (kind) {
      case 'item': return items
      case 'flag': return flags
      case 'npc': return [{ id: 'npc_volt', label: 'Вольт' }, { id: 'npc_ilaria', label: 'Илария' }]
      case 'disposition': return [{ id: 'npc_volt', label: 'Вольт (NPC)' }, { id: 'faction_guild', label: 'Гильдия (фракция)' }]
      case 'skill': return [{ id: 'persuade', label: 'Убеждение' }, { id: 'pressure', label: 'Напор' }]
      case 'status': return [{ id: 'st_wounded', label: 'Ранен' }]
      case 'weather': return [{ id: '', label: 'Ясно' }, { id: 'w_ash', label: 'Пепел' }]
      case 'quest': return [{ id: 'q_heart', label: 'Дело о медном сердце' }]
      case 'codex': return [{ id: 'codex_descent', label: 'Список бригады' }]
      case 'recipe': return [{ id: 'rec_bolt', label: 'Кованые болты' }]
      case 'cutscene': return [{ id: 'cs_descent', label: 'Спуск в шахту' }]
      case 'rule': return [{ id: 'rule_chase', label: 'Погоня в дымовом ярусе' }]
      case 'need': return [{ id: 'food', label: 'Еда' }]
      case 'emotion': return [{ id: 'neutral', label: 'Обычный' }, { id: 'angry', label: 'Злой' }, { id: 'sad', label: 'Печален' }]
      default: return []
    }
  },
  stages: (questId) => (questId === 'q_heart' ? [{ id: 'st_clues', label: 'Улики' }] : []),
  npcDefault: 'npc_volt',
  tickLabel: 'час',
}

// ── 1. разбор примера сценария ──
const parsed = parse(exampleScript(), newDlgDoc())
const errors = parsed.issues.filter((i) => i.severity === 'error')
check('1 пример разбирается без ошибок', errors.length === 0, errors.map((e) => `строка ${e.line}: ${e.message}`).join(' | '))
const node = parsed.doc.nodes[0]
check('1 узлы и название прочитаны', parsed.doc.nodes.length === 1 && parsed.doc.label === 'Встреча у переправы' && node.label === 'Начало разговора')
check('1 ремарка отделена от речи', node.sections[0]?.steps[0]?.kind === 'line' && node.sections[0]?.steps[0]?.line?.action === true)
check('1 условие с веткой «иначе» собрано', !!node.sections.find((s) => s.conds?.length && (s.else_steps?.length ?? 0) > 0))
check('1 эффект «выдать» понят названием предмета', JSON.stringify(node.sections).includes('item_token_crew'))
check('1 варианты и переходы на месте', node.choices.length === 2 && node.choices[1]?.goto === 'end' && node.choices[0]?.goto === 'stay')
check('1 флаг из реестра не пересоздан', parsed.newFlags.length === 0)

// ── 2. круг «сценарий → структура → сценарий → структура» ──
const text2 = dlgToScript(parsed.doc, refs)
const parsed2 = parse(text2, parsed.doc)
const text3 = dlgToScript(parsed2.doc, refs)
check('2 повторная запись не теряет структуру', JSON.stringify(parsed2.doc) === JSON.stringify(parsed.doc))
check('2 текст сценария стабилен', text2 === text3, `${text2.length} vs ${text3.length}`)
check('2 в тексте нет id и служебных слов ink', !/item_token_crew|get_flag\(|-> hub|set_flag/.test(text2))

// ── 3. условия: навык, отношение, предметы, счётчик, «и» ──
const conds = parse([
  '=== Начало ===',
  '[если навык: Убеждение ≥ 45]',
  '— Уговорю.',
  '[если предметов: Жетон бригады ≥ 2]',
  '— У меня два.',
  '[если отношение: Вольт ≥ 20]',
  '— Мы друзья.',
  '[если счётчик: Увидено концовок ≥ 2]',
  '— Я это уже видел.',
  '[если Сделка с Вольтом и Ранен]',
  '— И знакомы, и ранен.',
  '[если нет: Сделка с Вольтом]',
  '— Мы не знакомы.',
  '? Уйти.',
  '→ конец',
].join('\n'))
check('3 условия разобраны без ошибок', conds.issues.filter((i) => i.severity === 'error').length === 0, conds.issues.map((i) => i.message).join(' | '))
const secs = conds.doc.nodes[0].sections
check('3 навык с порогом', secs.some((s) => s.conds?.[0]?.type === 'skill_ge' && s.conds[0].threshold === 45))
check('3 отношение к NPC', secs.some((s) => s.conds?.[0]?.type === 'disp_ge' && s.conds[0].target === 'npc_volt'))
check('3 предметов не меньше двух', secs.some((s) => s.conds?.[0]?.type === 'item_ge' && s.conds[0].count === 2))
check('3 счётчик хроники', secs.some((s) => s.conds?.[0]?.type === 'meta_counter' && s.conds[0].key === 'endings_seen'))
check('3 два условия через «и»', secs.some((s) => s.conds?.length === 2))
check('3 «нет» — отрицание флага', secs.some((s) => s.conds?.[0]?.type === 'flag' && s.conds[0].not === true))

// ── 4. проверка навыка с ветками ──
const chk = parse([
  '=== Допрос ===',
  '[проверка: Убеждение ≥ 45]',
  '? Я не за тобой пришёл.',
  '[при успехе]',
  '— Хорошо, слушаю.',
  '→ запомнить: Грист заговорил',
  '[при провале]',
  '— Не хочу!',
  '→ конец',
].join('\n'), newDlgDoc())
check('4 проверка навыка собрана', chk.issues.filter((i) => i.severity === 'error').length === 0 && chk.doc.nodes[0].choices[0]?.check?.skill === 'persuade')
check('4 ветки успеха и провала раздельны', chk.doc.nodes[0].choices[0]?.check?.success.sections.length === 1 && chk.doc.nodes[0].choices[0]?.check?.fail.sections.length === 1)
check('4 новый флаг зарегистрирован сам', chk.newFlags.length === 1 && chk.newFlags[0].label === 'Грист заговорил')
check('4 ветки переживают круг', (() => {
  const again = parse(dlgToScript(chk.doc, refs), chk.doc)
  return JSON.stringify(again.doc.nodes[0].choices[0].check) === JSON.stringify(chk.doc.nodes[0].choices[0].check)
})())

// ── 5. ошибки мастера объясняются по-русски ──
const badItem = parse(['=== Начало ===', '— Держи.', '→ выдать: Жетон бригад'].join('\n'))
check('5 опечатка в предмете — ошибка с подсказкой', badItem.issues.some((i) => i.severity === 'error' && i.message.includes('не нашли предмет') && i.message.includes('Жетон бригады')), badItem.issues.map((i) => i.message).join(' | '))
const badElse = parse(['=== Начало ===', '[иначе]', '— Привет.'].join('\n'))
check('5 «[иначе]» без условия — ошибка', badElse.issues.some((i) => i.severity === 'error' && i.message.includes('[иначе]')))
const badChoice = parse(['=== Начало ===', '? '].join('\n'))
check('5 вариант без текста — ошибка', badChoice.issues.some((i) => i.severity === 'error' && i.message.includes('нет текста')))
const badGoto = parse(['=== Начало ===', '— Иди.', '→ перейти: Куда-то'].join('\n'))
check('5 переход в неизвестный узел — предупреждение', badGoto.issues.some((i) => i.severity === 'warning' && i.message.includes('неизвестный узел')))
const badEffect = parse(['=== Начало ===', '→ полетать: высоко'].join('\n'))
check('5 неизвестная команда — ошибка со списком команд', badEffect.issues.some((i) => i.severity === 'error' && i.message.includes('Команды:')))

// ── 6. ремарка, облик реплики, озвучка ──
const styling = parse([
  '=== Начало ===',
  '* Она долго смотрит на жетон.',
  '— Ты придёшь? #злой',
  '— Держи. #озвучка: assets/voice/volt_02.mp3',
  '? Ладно.',
  '→ конец',
].join('\n'), newDlgDoc())
const lines = styling.doc.nodes[0].sections.flatMap((s) => s.steps.filter((st) => st.kind === 'line').map((st) => st.line!))
check('6 ремарка помечена', lines[0]?.action === true && !lines[0]?.text.includes('*'))
check('6 облик одной реплики', lines[1]?.emotion === 'angry' && !lines[1]?.text.includes('#злой'))
check('6 озвучка', lines[2]?.voice === 'assets/voice/volt_02.mp3' && !lines[2]?.text.includes('#озвучка'))
check('6 пометки переживают круг', (() => {
  const again = parse(dlgToScript(styling.doc, refs), styling.doc)
  const l2 = again.doc.nodes[0].sections.flatMap((s) => s.steps.filter((st) => st.kind === 'line').map((st) => st.line!))
  return l2[0]?.action === true && l2[1]?.emotion === 'angry' && l2[2]?.voice === 'assets/voice/volt_02.mp3'
})())

// ── 7. структура от форм (без script) тоже пишется человеку ──
const doc: DlgDoc = {
  version: 2,
  label: 'Сторож у ворот',
  nodes: [
    {
      id: 'main',
      label: 'Начало разговора',
      sections: [
        { steps: [{ kind: 'line', line: { text: 'Стой. Кто идёт?' } }] },
        { conds: [{ type: 'flag', flag: 'volt_deal' }], steps: [{ kind: 'line', line: { text: 'А, это ты.' } }], else_steps: [{ kind: 'line', line: { text: 'Не знаю тебя.' } }] },
      ],
      choices: [{ text: 'Пройти.', conds: [{ type: 'has_item', item: 'item_token_crew' }], sections: [], goto: 'end' }],
      timer: { seconds: 12 },
    },
  ],
}
const written = dlgToScript(doc, refs)
check('7 документ конструктора пишется словами', written.includes('Сделка с Вольтом') && written.includes('Жетон бригады') && written.includes('[таймер: 12]'))
const back = parse(written, doc)
check('7 круг «формы → сценарий → формы» не теряет условия и таймер', JSON.stringify(back.doc.nodes[0].timer) === JSON.stringify({ seconds: 12 })
  && back.doc.nodes[0].choices[0]?.conds?.[0]?.type === 'has_item'
  && back.doc.nodes[0].sections[1]?.else_steps?.length === 1)

// ── 8. совместимость с движком: ink собирается и читается обратно ──
const ink = generateInk(parsed.doc)
check('8 ink собирается из сценария', ink.includes('set_flag') || ink.includes('add_item'))
const imported = inkToDlgDoc(ink)
check('8 ink читается обратно без замечаний', imported.warnings.length === 0, imported.warnings.slice(0, 2).join(' | '))
check('8 узлы после круга через ink те же', imported.doc.nodes.length === parsed.doc.nodes.length && imported.doc.nodes[0].choices.length === parsed.doc.nodes[0].choices.length)

console.log(failures ? `\nпровалено проверок: ${failures}` : '\nмастерский сценарий: все проверки зелёные')
process.exit(failures ? 1 : 0)
