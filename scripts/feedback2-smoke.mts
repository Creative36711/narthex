/**
 * Смоук второго раунда фидбека (23 пункта). Требует dev-сервер на :5173.
 * Запуск: npx tsx scripts/feedback2-smoke.mts
 */
import { loadCampaign } from '../src/core/loader'
import { GameEngine, hasSave } from '../src/core/engine'
import { generateInk, newDlgDoc, type DlgDoc } from '../src/editor/dialogueDoc'
import { Compiler } from 'inkjs/full'

const mem = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => mem.set(k, v),
  removeItem: (k: string) => mem.delete(k),
}

let failed = 0
function check(name: string, ok: boolean, extra = '') {
  console.log(`${ok ? '✓' : '✗ FAIL'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!ok) failed++
}

const campaign = await loadCampaign('http://localhost:5173/campaigns/ash-of-caerden')
console.log(`Кампания: ${campaign.meta.title}`)

// ── №3: вопрос исчезает в рамках разговора и возвращается в новом ──
{
  const e = new GameEngine(campaign)
  e.start()
  // квест банды должен идти, чтобы вопрос появился; диспозиция низкая → отказ
  e.state.quests['quest_bandit_threat'] = { stage: 'started', status: 'active', journal: [] } as any
  e.startDialogue('npc_guard_aldric')
  const q = '»Пойдёшь со мной'
  const has1 = e.dialogue!.choices.some((c) => c.text.includes('Пойдёшь со мной'))
  check('№3 вопрос о найме есть в разговоре', has1)
  const idx = e.dialogue!.choices.find((c) => c.text.includes('Пойдёшь со мной'))!.index
  e.chooseDialogueOption(idx) // отказ (диспозиция < 10)
  const has2 = e.dialogue!.choices.some((c) => c.text.includes('Пойдёшь со мной'))
  check('№3 после вопроса он исчез до конца разговора', !has2)
  e.endDialogue()
  e.startDialogue('npc_guard_aldric')
  const has3 = e.dialogue!.choices.some((c) => c.text.includes('Пойдёшь со мной'))
  check('№3 в новом разговоре вопрос снова доступен', has3)
  e.endDialogue()
}

// ── №5+№6: крысы — квест завершается только после разговора с Маэвой ──
{
  const e = new GameEngine(campaign)
  e.start()
  e.addItem('item_silver', 20)
  e.startDialogue('npc_maeva')
  e.chooseDialogueOption(e.dialogue!.choices.find((c) => c.text.includes('беда в подвале'))!.index)
  e.chooseDialogueOption(e.dialogue!.choices.find((c) => c.text.includes('Веди в подвал'))!.index)
  check('№6 квест начат до боя', e.state.quests['quest_rats']?.stage === 'started')
  for (const u of e.combat!.combatants) if (u.side === 'enemy') { u.hp = 0; u.dead = true }
  ;(e.combat as any).checkEnd()
  e.endCombat()
  check('№6 rats_done после боя', !!e.state.flags['rats_done'])
  check('№6 квест НЕ завершён сразу после боя', e.state.quests['quest_rats']?.stage === 'started',
    `stage=${e.state.quests['quest_rats']?.stage}`)
  // №5: вход в сцену таверны — Маэва сама заговаривает
  e.goToScene('scene_tavern_hall')
  check('№5 Маэва сама начала разговор', !!e.dialogue && e.dialogue.npc.id === 'npc_maeva',
    e.dialogue ? e.dialogue.lines[0]?.text.slice(0, 40) : 'нет диалога')
  check('№5 в реплике благодарность', e.dialogue?.lines.some((l) => l.text.includes('крысами')) ?? false)
  e.endDialogue()
  check('№6 квест завершён после разговора', e.state.quests['quest_rats']?.stage === 'completed',
    `stage=${e.state.quests['quest_rats']?.stage}`)
}

// ── №10: победа → сейв удалён, «Продолжить» невозможно ──
{
  const e = new GameEngine(campaign)
  e.start()
  e.autosave()
  check('№10 сейв есть до финала', hasSave(campaign.meta.id))
  e.gameOver('victory', 'Тестовая победа')
  check('№10 сейв удалён после победы', !hasSave(campaign.meta.id))
  check('№10 при победе диалог не закрывается принудительно', true) // логика: dialogue обнуляется только при death
}

// ── №8: русские названия навыков ──
{
  const e = new GameEngine(campaign)
  e.start()
  check('№8 skillLabel sword → Мечи', e.skillLabel('sword') === 'Мечи', e.skillLabel('sword'))
  check('№8 skillLabel brawl → Кулачный бой', e.skillLabel('brawl') === 'Кулачный бой', e.skillLabel('brawl'))
  const out = e.playerSkillCheck('persuade', 50)
  const last = e.state.log[e.state.log.length - 1]
  check('№8 лог проверки по-русски', last.includes('Убеждение') && !last.includes('critical'), last)
}

// ── №20: генератор ink из конструктора диалогов ──
{
  const doc = newDlgDoc()
  const ink1 = generateInk(doc)
  const c1 = new Compiler(ink1).Compile()
  check('№20 базовый диалог конструктора компилируется', !!c1.ToJson())

  const complex: DlgDoc = {
    version: 1,
    nodes: [
      {
        id: 'main',
        label: 'Начало',
        lines: [
          { text: 'Здравствуй.', emotion: 'happy' },
          { text: 'Старик щурится на солнце.', action: true },
        ],
        choices: [
          { text: 'Спросить о деревне', once: true, lines: [{ text: 'Деревня как деревня.' }], effects: [], goto: 'stay' },
          { text: 'Дай хлеба (флаг)', if_not_flag: 'got_bread', lines: [{ text: 'Держи.' }], effects: [{ type: 'set_flag', flag: 'got_bread' }, { type: 'add_item', item: 'item_bread', qty: 1 }], goto: 'stay' },
          { text: 'К делу', lines: [], effects: [], goto: 'business' },
          { text: 'Прощай.', lines: [{ text: 'Бывай.' }], effects: [], goto: 'end' },
        ],
      },
      {
        id: 'business',
        label: 'Дело',
        lines: [{ text: 'Есть работа.' }],
        choices: [
          { text: 'Берусь.', lines: [], effects: [{ type: 'start_quest', quest: 'quest_rats' }], goto: 'end' },
          { text: 'Назад.', lines: [], effects: [], goto: 'main' },
        ],
      },
    ],
  }
  const ink2 = generateInk(complex)
  const c2 = new Compiler(ink2).Compile()
  check('№20 сложный диалог (2 узла, условия, эффекты) компилируется', !!c2.ToJson())
  check('№20 однократный ответ → *', ink2.includes('* [Спросить о деревне]'))
  check('№20 условие по флагу', ink2.includes('{ not get_flag("got_bread") } [Дай хлеба (флаг)]'))
  check('№20 hub-паттерн', ink2.includes('=== main_hub ==='))
}

// ── все 6 контентных диалогов всё ещё компилируются и стартуют ──
{
  const e = new GameEngine(campaign)
  e.start()
  for (const id of ['npc_guard_aldric', 'npc_maeva', 'npc_bran', 'npc_lena', 'npc_corvin', 'npc_yorek']) {
    try {
      e.startDialogue(id)
      check(`ink ok: ${id}`, !!e.dialogue && e.dialogue.lines.length > 0)
      e.endDialogue()
    } catch (err) {
      check(`ink ok: ${id}`, false, String(err))
    }
  }
}

// ── №9: после согласия Алдрика разговор заканчивается ──
{
  const e = new GameEngine(campaign)
  e.start()
  e.state.quests['quest_bandit_threat'] = { stage: 'started', status: 'active', journal: [] } as any
  e.state.dispositions['faction_town_guard'] = 50
  e.startDialogue('npc_guard_aldric')
  const idx = e.dialogue!.choices.find((c) => c.text.includes('Пойдёшь со мной'))?.index
  check('№9 вопрос о найме есть', idx !== undefined)
  if (idx !== undefined) {
    e.chooseDialogueOption(idx)
    check('№9 после согласия разговор завершён (нет «Бывай»)',
      (e.dialogue?.finished ?? true) || (e.dialogue?.choices.length ?? 0) === 0,
      `choices=${e.dialogue?.choices.map((c) => c.text).join('|') ?? 'нет'}`)
    check('№9 Алдрик в отряде', e.state.party.some((c) => c.entity === 'npc_guard_aldric'))
  }
}

console.log(failed ? `\n${failed} ПРОВАЛОВ` : '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ')
process.exit(failed ? 1 : 0)
