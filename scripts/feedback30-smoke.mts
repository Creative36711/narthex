import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { inkToDlgDoc, regenInk } from '../src/editor/inkImport'
import { Compiler } from 'inkjs/full'
import { GameEngine } from '../src/core/engine'
import { firstInkKnot } from '../src/core/dialogue'
import type { CampaignData, EntityDef, SceneDef } from '../src/shared/types'

const pass = (msg: string) => console.log(`✓ ${msg}`)

// ── 1. Авторазбор всех диалогов кампании «Мёртвый канал: Пепельный хор» ──
const dlgDir = path.join(process.cwd(), '_ai-temp/campaing/dialogues')
const inkFiles = fs.readdirSync(dlgDir).filter((f) => f.endsWith('.ink'))
assert.equal(inkFiles.length, 10, 'в кампании 10 диалогов ink')

for (const f of inkFiles) {
  const content = fs.readFileSync(path.join(dlgDir, f), 'utf8')
  const res = inkToDlgDoc(content, f)
  assert.equal(res.warnings.length, 0, `${f}: авторазбор не должен давать предупреждений (было: ${res.warnings.join(', ')})`)
  assert.ok(res.doc.nodes.length > 0, `${f}: узлы не должны быть пустыми`)
  // Проверяем обратную компиляцию
  const recompiled = regenInk(res.doc)
  const compiled = new Compiler(recompiled).Compile()
  assert.ok(compiled, `${f}: сгенерированный ink компилируется`)
}
pass('1 Все 10 диалогов новой кампании разбираются без предупреждений и компилируются inkjs')

// ── 2. Диалог без узлов === knot === ──
const linearInk = `
EXTERNAL get_flag(f)
EXTERNAL set_flag(f)
VAR x = 10

// Приветствие
Привет, странник.
Здесь холодно и темно.
+ [Кто ты?]
    Я дозорный нижних шлюзов.
    -> END
+ [Как пройти к поддону?]
    Иди вдоль медных труб.
    -> END
`
const parsedLinear = inkToDlgDoc(linearInk)
assert.equal(parsedLinear.warnings.length, 0, 'линейный диалог без узлов не даёт предупреждений')
assert.equal(parsedLinear.doc.nodes.length, 1, 'создан один начальный узел')
assert.equal(parsedLinear.doc.nodes[0]!.id, 'main', 'id узла main')
assert.equal(parsedLinear.doc.nodes[0]!.choices.length, 2, '2 варианта ответа')
assert.equal(parsedLinear.doc.nodes[0]!.choices[0]!.text, 'Кто ты?')
pass('2 Диалог без узлов «=== имя ===» корректно превращается в полноценный диалог в конструкторе')

// Чистый монолог без вариантов
const monoInk = `
Не двигайся.
Слушай, как остывает металл.
`
const parsedMono = inkToDlgDoc(monoInk)
assert.equal(parsedMono.warnings.length, 0)
assert.equal(parsedMono.doc.nodes.length, 1)
assert.equal(parsedMono.doc.nodes[0]!.choices.length, 0)
assert.equal(parsedMono.doc.nodes[0]!.sections[0]!.steps.length, 2)
pass('2 Линейный монолог без узлов и выборов импортируется без ошибок')

// ── 3. Активация Яры Сол и Ивы движком (firstInkKnot и startDialogue) ──
const yaraInk = fs.readFileSync(path.join(dlgDir, 'yara.ink'), 'utf8')
assert.equal(firstInkKnot(yaraInk), 'Начало', 'firstInkKnot распознаёт кириллический узел «Начало»')

const meta = JSON.parse(fs.readFileSync('_ai-temp/campaing/campaign.json', 'utf8'))
const world = JSON.parse(fs.readFileSync('_ai-temp/campaing/world.json', 'utf8'))

const entities: Record<string, EntityDef> = {}
for (const f of fs.readdirSync('_ai-temp/campaing/entities')) {
  const e = JSON.parse(fs.readFileSync(path.join('_ai-temp/campaing/entities', f), 'utf8'))
  entities[e.id] = e
}
const scenes: Record<string, SceneDef> = {}
for (const f of fs.readdirSync('_ai-temp/campaing/scenes')) {
  const s = JSON.parse(fs.readFileSync(path.join('_ai-temp/campaing/scenes', f), 'utf8'))
  scenes[s.id] = s
}
const dialogues: Record<string, string> = {}
for (const f of inkFiles) {
  dialogues[`dialogues/${f}`] = fs.readFileSync(path.join(dlgDir, f), 'utf8')
}

const campaignData: CampaignData = {
  meta,
  world,
  scenes,
  entities,
  rules: {},
  arenas: {},
  quests: {},
  encounters: {},
  cutscenes: {},
  recipes: {},
  codex: {},
  dialogues,
  basePath: '',
}

const engine = new GameEngine(campaignData)
engine.start()

// Разговор с Ярой Сол
engine.startDialogue('npc_yara')
assert.ok(engine.activeStory, 'Яра Сол активируется — story создана')
assert.ok(engine.dialogue, 'Окно диалога с Ярой открыто')
assert.ok(engine.dialogue.lines.length > 0, 'Есть реплика Яры')
assert.ok(engine.dialogue.choices.length > 0, 'Есть варианты ответов Яры')
engine.endDialogue()
pass('3 Персонаж Яра Сол активируется и начинает разговор')

// Разговор с Ивой
engine.startDialogue('npc_iva')
assert.ok(engine.activeStory, 'Ива активируется — story создана')
assert.ok(engine.dialogue, 'Окно диалога с Ивой открыто')
assert.ok(engine.dialogue.lines.length > 0, 'Есть реплика Ивы')
assert.ok(engine.dialogue.choices.length > 0, 'Есть варианты ответов Ивы')
engine.endDialogue()
pass('3 Персонаж Ива активируется и начинает разговор')

// ── 4. Исследование «Станционная панель» (item_fuse_panel) ──
const fuse = entities['item_fuse_panel'] as { interact_options?: Array<{ label: string; once?: boolean }> }
assert.ok(fuse && fuse.interact_options?.length, 'У станционной панели есть interact_options')
assert.equal(fuse.interact_options[0]!.label, 'Заглушить контур')
assert.equal(fuse.interact_options[0]!.once, true, 'Действие панели однократное (once: true)')

// Переходим на сцену с панелью (scene_lift)
engine.applyEffects([{ type: 'teleport_player', location: 'loc_underworks', scene: 'scene_lift' }])
const occupants = engine.slotOccupants(engine.currentScene())
const fuseOcc = occupants.find((o) => o.entity?.id === 'item_fuse_panel')
assert.ok(fuseOcc, 'Панель резонатора размещена в слоте scene_lift')

// До взаимодействия вариант доступен
const optsBefore = engine.itemInteractOptions(fuseOcc.entity as never)
assert.equal(optsBefore.length, 1, 'Действие доступно до применения')

// Выполняем действие
engine.runItemInteract(fuseOcc.entity as never, optsBefore[0]!)
assert.equal(engine.state.flags['flag_fuse_examined'], true, 'Флаг flag_fuse_examined установлен')

// После выполнения вариант заблокирован
const optsAfter = engine.itemInteractOptions(fuseOcc.entity as never)
assert.equal(optsAfter.length, 0, 'Действие скрыто после однократного применения (замысел сценариста)')
pass('4 Станционная панель (item_fuse_panel): подтверждён замысел сценариста (однократная проверка и отключение контура)')

// ── 5. Настраиваемые надписи системных меню и кнопок (meta.ui_labels) ──
meta.ui_labels = {
  inventory: 'Сумка дознавателя',
  map: 'Схема ярусов',
  journal: 'Дело № 137',
  pass_turn: 'Выждать',
}
assert.equal(engine.uiLabel('inventory', 'Вещи'), 'Сумка дознавателя', 'ui_labels: инвентарь переопределён')
assert.equal(engine.uiLabel('map', 'Карта'), 'Схема ярусов', 'ui_labels: карта переопределена')
assert.equal(engine.uiLabel('journal', 'Журнал'), 'Дело № 137', 'ui_labels: журнал переопределён')
assert.equal(engine.uiLabel('pass_turn', 'Завершить ход'), 'Выждать', 'ui_labels: кнопка боя переопределена')
assert.equal(engine.uiLabel('camp', 'Лагерь'), 'Лагерь', 'ui_labels: фоллбэк работает при отсутствии ключа')
pass('5 meta.ui_labels: системные меню и кнопки интерфейса настраиваются мастером')

// ── 6. Автотаймер на реплику (# timer: 3) и дедлайн на раздумье ──
const timedLineInk = `
Внимание! Шлюз закроется через три секунды! # timer: 3 # action
`
const parsedTimed = inkToDlgDoc(timedLineInk)
assert.equal(parsedTimed.doc.nodes[0]!.sections[0]!.steps[0]!.kind, 'line')
const parsedLine = (parsedTimed.doc.nodes[0]!.sections[0]!.steps[0] as { line: { timer?: number } }).line
assert.equal(parsedLine.timer, 3, 'тег # timer: 3 прочитан в поле timer реплики')
const recompiledTimed = regenInk(parsedTimed.doc)
assert.ok(recompiledTimed.includes('# timer: 3'), 'генерация ink сохраняет тег # timer: 3')

// Проверка реального дедлайна в диалоге captain.ink
engine.startDialogue('npc_captain')
assert.ok(engine.dialogue?.timer, 'Диалог капитана объявляет таймер на раздумье')
assert.equal(engine.dialogue.timer?.seconds, 18, 'Таймер равен 18 секундам')
assert.equal(engine.dialogue.timer?.knot, 'Молчание', 'Таймер ведёт в узел Молчание')
// Срабатывание таймаута: переводит в узел «Молчание»
engine.dialogueTimeout()
assert.ok(engine.dialogue?.lines.some((l) => l.text.includes('принимает молчание за ответ')), 'По таймауту сработал узел «Молчание»')
assert.equal(engine.state.flags['flag_captain_alarm'], true, 'Эффект узла «Молчание» применился')
engine.endDialogue()
pass('6 Таймер на раздумье и автотаймер реплики работают в реальном времени')

console.log('\nвсе проверки feedback30 пройдены')
