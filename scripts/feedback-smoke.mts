/**
 * Смоук-тест фидбека (11 пунктов): экипировка, hub-диалоги, action-теги,
 * порядок «квест → бой» для крыс. Требует dev-сервер на :5173.
 * Запуск: npx tsx scripts/feedback-smoke.mts
 */
import { loadCampaign } from '../src/core/loader'
import { GameEngine } from '../src/core/engine'
import '../packs/narrative/operations'

// stub localStorage для node
const mem = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => mem.set(k, v),
  removeItem: (k: string) => mem.delete(k),
}

const BASE = 'http://localhost:5173/campaigns/ash-of-caerden'
let failed = 0
function check(name: string, ok: boolean, extra = '') {
  console.log(`${ok ? '✓' : '✗ FAIL'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!ok) failed++
}

const campaign = await loadCampaign(BASE)
console.log(`Кампания загружена: ${campaign.meta.title}`)

// ── №3: экипировка ──────────────────────────────────────────
{
  const e = new GameEngine(campaign)
  e.start()
  const eq = e.state.player.equipment
  check('№3 старт: оружие надето из шаблона', !!eq.weapon, `weapon=${eq.weapon}`)
  const w1 = e.playerWeapon()
  check('№3 playerWeapon отдаёт данные', w1.itemId === eq.weapon && !!w1.weapon.damage, `${w1.label} ${w1.weapon.damage}`)
  e.unequipItem('weapon')
  const w2 = e.playerWeapon()
  check('№3 снятие: fallback кулаки', w2.itemId === null && w2.label === 'Кулаки', `${w2.label} ${w2.weapon.damage}`)
  const swordId = eq.weapon!
  e.equipItem(swordId)
  check('№3 надевание обратно', e.state.player.equipment.weapon === swordId)
  // авторазэкип при потере предмета
  const qty = e.state.player.inventory.find((i) => i.item === swordId)?.quantity ?? 0
  e.removeItem(swordId, qty)
  check('№3 авторазэкип при потере предмета', e.state.player.equipment.weapon === undefined)
}

// ── компиляция всех 6 ink-диалогов (hub-рефакторинг) ────────
{
  const e = new GameEngine(campaign)
  e.start()
  const npcs = ['npc_guard_aldric', 'npc_maeva', 'npc_bran', 'npc_lena', 'npc_corvin', 'npc_yorek']
  for (const id of npcs) {
    try {
      e.startDialogue(id)
      const d = e.dialogue
      check(`ink компилируется и стартует: ${id}`, !!d && d.lines.length > 0, `${d?.lines.length} строк, ${d?.choices.length} выборов`)
      e.endDialogue()
    } catch (err) {
      check(`ink компилируется и стартует: ${id}`, false, String(err))
    }
  }
}

// ── №4: hub — реплики не накапливаются ──────────────────────
{
  const e = new GameEngine(campaign)
  e.start()
  e.startDialogue('npc_maeva')
  const greeting = e.dialogue!.lines[0]!.text
  const idx = e.dialogue!.choices.find((c) => c.text.includes('слухи'))?.index
  check('№4 у Маевы есть выбор про слухи', idx !== undefined)
  if (idx !== undefined) {
    e.chooseDialogueOption(idx)
    const lines = e.dialogue!.lines.map((l) => l.text)
    check('№4 после выбора greeting не перепечатывается', !lines.includes(greeting), `${lines.length} новых строк`)
    check('№4 hub снова предлагает выборы', (e.dialogue?.choices.length ?? 0) > 0)
  }
  e.endDialogue()
}

// ── №6: action-строки помечены ──────────────────────────────
{
  const e = new GameEngine(campaign)
  e.start()
  // первая встреча идёт через knot first_meeting (правило rule_gates_greeting);
  // action-строка у Алдрика — в ветке найма (yorek/corvin/lena стартуют с action)
  e.startDialogue('npc_corvin')
  const hasAction = e.dialogue!.lines.some((l) => l.action)
  check('№6 у Корвина сцена содержит action-строку', hasAction,
    e.dialogue!.lines.map((l) => `${l.action ? '[a]' : '[ ]'}${l.text.slice(0, 30)}`).join(' | '))
  e.endDialogue()
}

// ── №5: квест «Крысы» стартует ДО боя ───────────────────────
{
  const e = new GameEngine(campaign)
  e.start()
  e.addItem('item_silver', 100)
  e.startDialogue('npc_maeva')
  const troubleIdx = e.dialogue!.choices.find((c) => c.text.includes('беда в подвале'))?.index
  check('№5 есть выбор про беду в подвале', troubleIdx !== undefined)
  e.chooseDialogueOption(troubleIdx!)
  const goIdx = e.dialogue!.choices.find((c) => c.text.includes('Веди в подвал'))?.index
  check('№5 есть выбор «Веди в подвал»', goIdx !== undefined)
  e.chooseDialogueOption(goIdx!)
  const questState = e.state.quests['quest_rats']?.stage
  check('№5 бой начался', !!e.combat)
  check('№5 квест стартовал ДО завершения боя', questState === 'started', `state=${questState}`)
  check('№5 квест НЕ выполнен до боя', e.state.quests['quest_rats']?.stage !== 'completed')
  // добиваем крыс и проверяем завершение
  if (e.combat) {
    for (const u of e.combat.combatants) if (u.side === 'enemy') { u.hp = 0; u.dead = true }
    // в игре checkEnd зовётся после смертельного удара; в тесте зовём напрямую
    ;(e.combat as any).checkEnd()
    check('№5 после зачистки — победа', e.combat.result === 'victory')
    e.endCombat()
    check('№5 rats_done после боя', !!e.state.flags['rats_done'])
    // со 2-го раунда фидбека квест завершается после разговора с Маэвой, не сразу после боя
    e.goToScene('scene_tavern_hall')
    if (e.dialogue) e.endDialogue()
    check('№5 квест выполнен после благодарности Маэвы', e.state.quests['quest_rats']?.stage === 'completed', `stage=${e.state.quests['quest_rats']?.stage}`)
  }
}

console.log(failed ? `\n${failed} ПРОВАЛОВ` : '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ')
process.exit(failed ? 1 : 0)
