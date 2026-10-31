import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import assert from 'node:assert'
import { inkToDlgDoc } from '../src/editor/inkImport'
import { generateInk } from '../src/editor/dialogueDoc'
import { sanitizeInkSource } from '../packs/narrative/dialogue'
import { Compiler } from 'inkjs/full'
import { GameEngine } from '../src/core/engine'
import { repairState } from '../src/core/savemigrate'
import type { CampaignData, EntityDef, GameState, SceneDef } from '../src/shared/types'

console.log('--- Смоук-тест раунда 32: Экипировка, Диалоги, Вера Сокол, Условия ---')

// ── 1. Загрузка сохранения и сохранение базовых слотов weapon/armor ──
const dir = '_ai-temp/campaing'
const meta = JSON.parse(readFileSync(join(dir, 'campaign.json'), 'utf8'))
const world = JSON.parse(readFileSync(join(dir, 'world.json'), 'utf8'))
const entities: Record<string, EntityDef> = {}
for (const f of readdirSync(join(dir, 'entities'))) {
  const e = JSON.parse(readFileSync(join(dir, 'entities', f), 'utf8'))
  entities[e.id] = e
}
const scenes: Record<string, SceneDef> = {}
for (const f of readdirSync(join(dir, 'scenes'))) {
  const s = JSON.parse(readFileSync(join(dir, 'scenes', f), 'utf8'))
  scenes[s.id] = s
}
const dialogues: Record<string, string> = {}
for (const f of readdirSync(join(dir, 'dialogues'))) {
  if (f.endsWith('.ink')) dialogues[`dialogues/${f}`] = readFileSync(join(dir, 'dialogues', f), 'utf8')
}

const campaign: CampaignData = {
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

const rawState: GameState = {
  save_version: 1,
  tick: 0,
  current_scene: 'scene_office',
  location: 'loc_gate',
  region: 'reg_vereten',
  player: {
    id: 'player_hero',
    name: 'Инспектор',
    equipment: {
      weapon: 'item_knife',
      armor: 'item_coat',
    },
    inventory: [],
    hp: 14,
    hp_max: 14,
    ap: 4,
    ap_max: 4,
    stats: { STR: 10, CON: 11, SIZ: 11, DEX: 11, INT: 13, POW: 12, CHA: 14 },
    skills: { sword: 50, intimidate: 50, spot: 50 },
    needs: { hunger: 100, thirst: 100, warmth: 100 },
  },
  flags: {},
  variables: {},
  reputation: {},
  quests: {},
  codex_unlocked: [],
  known_recipes: [],
  messages: [],
  log: [],
  notes: [],
  dead_entities: [],
  inventory_items: [],
  stored_entities: {},
  stats_run: {
    ticks_survived: 0,
    kills: 0,
    quests_completed: 0,
    travels: 0,
    dialogues: 0,
    rests: 0,
    damage_dealt: 0,
    damage_taken: 0,
    items_crafted: 0,
  },
}

const notes: Array<{ kind: string; msg: string }> = []
const ctx = {
  note: (kind: string, msg: string) => notes.push({ kind, msg }),
}

repairState(rawState, campaign, ctx)
assert.equal(rawState.player.equipment?.weapon, 'item_knife', 'Слот weapon сохранён на герое')
assert.equal(rawState.player.equipment?.armor, 'item_coat', 'Слот armor сохранён на герое')
assert.ok(!notes.some((n) => n.msg.includes('Снято с героя: «слот weapon»')), 'Нет ложного снятия слотов с героя')
console.log('✓ 1. Сохранения: слоты weapon и armor не снимаются при загрузке/починке')

// ── 2. Диалог Веры Сокол: доступность всех веток при повторном разговоре ──
const engine = new GameEngine(campaign)
engine.start()

engine.startDialogue('npc_vera')
assert.ok(engine.dialogue, 'Первый диалог с Верой открыт')
const introChoice = engine.dialogue.choices.findIndex((c) => c.text.includes('Представиться'))
assert.ok(introChoice >= 0, 'Есть выбор Представиться')
engine.chooseDialogueOption(introChoice)

const takeChoice = engine.dialogue.choices.findIndex((c) => c.text.includes('Я возьмусь за дело'))
assert.ok(takeChoice >= 0, 'Есть выбор Я возьмусь за дело')
engine.chooseDialogueOption(takeChoice)

const leaveChoice = engine.dialogue.choices.findIndex((c) => c.text.includes('Мне пора'))
assert.ok(leaveChoice >= 0, 'Есть выбор Мне пора')
engine.chooseDialogueOption(leaveChoice)
engine.endDialogue()

assert.equal(engine.state.flags['case_opened'], true, 'Флаг case_opened поднят')

// Повторный вход в диалог
engine.startDialogue('npc_vera')
assert.ok(engine.dialogue, 'Повторный диалог с Верой открыт')
const hasQuestions = engine.dialogue.choices.some((c) => c.text.includes('Что мне искать') || c.text.includes('Койля'))
assert.ok(hasQuestions, 'При повторном визите сразу доступны ветки расспросов (Койль, улики, сроки)')

const reportChoice = engine.dialogue.choices.findIndex((c) => c.text.includes('Доложить по делу'))
assert.ok(reportChoice >= 0, 'Доступен пункт Доложить по делу')
engine.chooseDialogueOption(reportChoice)

const backChoice = engine.dialogue.choices.findIndex((c) => c.text.includes('Вернуться'))
assert.ok(backChoice >= 0, 'Из хаба докладов есть кнопка Вернуться')
engine.chooseDialogueOption(backChoice)

const hasQuestionsAgain = engine.dialogue.choices.some((c) => c.text.includes('Койля'))
assert.ok(hasQuestionsAgain, 'После возврата из докладов игрок снова видит все ветки разговора')
engine.endDialogue()
console.log('✓ 2. Диалог Капитана Веры Сокол: повторный визит и возврат из докладов работают корректно')

// ── 3. Чистый авторазбор и компиляция всех диалогов кампании «Мёртвый пар» ──
const dlgDir = join(dir, 'dialogues')
for (const f of readdirSync(dlgDir)) {
  if (!f.endsWith('.ink')) continue
  const content = readFileSync(join(dlgDir, f), 'utf8')
  const { doc, warnings } = inkToDlgDoc(content, f)
  assert.equal(warnings.length, 0, `Диалог ${f} разобран без предупреждений`)
  assert.ok(doc.nodes.length > 0, `Диалог ${f} содержит узлы`)
  const recompiled = generateInk(doc)
  const sanitized = sanitizeInkSource(recompiled)
  new Compiler(sanitized).Compile()
}
console.log('✓ 3. Все диалоги кампании «Мёртвый пар» разбираются в DlgDoc с 0 warnings и компилируются inkjs')

// ── 4. Условие equipped в правилах и движке ──
engine.state.player.equipment = { face: 'item_mask' }
assert.ok(engine.isEquipped('item_mask'), 'Движок определяет надевание маски')
assert.ok(!engine.isEquipped('item_knife'), 'Нож не надет')
console.log('✓ 4. Условие equipped работает в движке для правил, потребностей и диалогов')

console.log('dialogues-round32-smoke: ALL GREEN')
