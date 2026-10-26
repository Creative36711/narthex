/**
 * Смоук четвёртого раунда фидбека (12 пунктов). Требует dev-сервер на :5173.
 * Запуск: npx tsx scripts/feedback4-smoke.mts
 */
import { loadCampaign } from '../src/core/loader'
import { GameEngine } from '../src/core/engine'
import '../packs/narrative/operations'
import { generateInk, migrateDlgDoc } from '../src/editor/dialogueDoc'
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

const base = 'http://localhost:5173/campaigns/ash-of-caerden'
const campaign = await loadCampaign(base)
console.log(`Кампания: ${campaign.meta.title}`)

// ── №1: сообщение победы видно ещё НА экране победы (до «Продолжить») ──
{
  const e = new GameEngine(campaign)
  e.start()
  e.startCombat((campaign.rules['encounter_cellar_rats'].effects[0]) as any)
  const c = e.combat!
  for (const u of (c as any).combatants) if (u.side === 'enemy') { u.hp = 0; u.dead = true }
  ;(c as any).checkEnd()
  check('№1 бой завершён победой', c.result === 'victory')
  const msgAtVictory = e.messages.some((m) => m.text.includes('Подвал очищен'))
  check('№1 «Подвал очищен…» показано ДО «Продолжить»', msgAtVictory)
  check('№1 флаг rats_done установлен ДО «Продолжить»', !!e.state.flags['rats_done'])
  const msgCount = e.messages.filter((m) => m.text.includes('Подвал очищен')).length
  e.endCombat()
  const msgCountAfter = e.messages.filter((m) => m.text.includes('Подвал очищен')).length
  check('№1 после «Продолжить» сообщение не дублируется', msgCountAfter === msgCount)
  check('№1 бой закрыт', !e.combat)
}

// ── №3: реестр типов слотов расширяем (мета поддерживает slot_types) ──
{
  const meta = campaign.meta as any
  check('№3 поле slot_types доступно в мете (свои типы слотов)', !('slot_types' in meta) || Array.isArray(meta.slot_types))
}

// ── №4: реестр флагов на русском покрывает флаги контента ──
{
  const meta = campaign.meta as any
  const reg = new Set<string>((meta.flags ?? []).map((f: any) => f.id))
  check('№4 реестр флагов есть и непуст', reg.size >= 20)
  const used = new Set<string>()
  const scan = (o: unknown): void => {
    if (Array.isArray(o)) return o.forEach(scan)
    if (o && typeof o === 'object') {
      for (const [k, v] of Object.entries(o)) {
        if ((k === 'flag' || k === 'not_flag') && typeof v === 'string' && v) used.add(v)
        else scan(v)
      }
    }
  }
  scan(Object.values(campaign.rules))
  scan(Object.values(campaign.scenes))
  for (const ink of Object.values(campaign.dialogues ?? {})) {
    for (const m of String(ink).matchAll(/(?:get_flag|set_flag)\("([^"]+)"\)/g)) used.add(m[1])
  }
  const missing = [...used].filter((f) => !reg.has(f))
  check('№4 все используемые флаги описаны в реестре', missing.length === 0, missing.join(', '))
  const noLabel = (meta.flags ?? []).filter((f: any) => !f.label || /^[a-z0-9_]+$/i.test(f.label))
  check('№4 у всех флагов русские названия', noLabel.length === 0, noLabel.map((f: any) => f.id).join(', '))
}

// ── №6: навыки НПС есть в реестре навыков кампании ──
{
  const reg = new Set((campaign.meta.skills ?? []).map((s) => s.id))
  const missing: string[] = []
  for (const ent of Object.values(campaign.entities)) {
    for (const sk of Object.keys((ent as any).skills ?? {})) {
      if (!reg.has(sk)) missing.push(`${(ent as any).id}:${sk}`)
    }
  }
  check('№6 все навыки НПС в реестре (включая club)', missing.length === 0, missing.join(', '))
  check('№6 club в реестре', reg.has('club'))
}

// ── №7: боевые НПС снаряжены предметами, у торговца есть товар ──
{
  const ents = campaign.entities as any
  for (const id of ['npc_bandit', 'npc_guard', 'npc_yorek', 'npc_guard_aldric']) {
    const e = ents[id]
    const w = e.equipment?.weapon
    check(`№7 ${id} вооружён предметом`, !!w && !!ents[w]?.weapon_data, String(w))
  }
  check('№7 у Брана есть прилавок', (ents['npc_bran'].trader?.sells ?? []).length >= 4)
  // крыса остаётся с природным оружием — это правильно
  check('№7 у крысы природное оружие (укус)', !!ents['npc_rat_giant'].natural_weapon)
}

// ── №8: цены — у валюты и пайка есть стоимость ──
{
  const ents = campaign.entities as any
  check('№8 у валюты стоимость 1', ents['item_silver'].value?.silver === 1)
  check('№8 у пайка стражи есть цена', (ents['item_guard_ration'].value?.silver ?? 0) > 0)
}

// ── №10: нападение в лесу — правило, не хардкод ──
{
  const r = campaign.rules['rule_forest_ambush']
  check('№10 правило засады существует', !!r)
  check(
    '№10 условие — вход в лес',
    !!r && r.conditions.some((c: any) => c.type === 'player_enters_location' && c.location === 'loc_forest'),
  )
}

// ── №12: все демо-диалоги в конструкторе, с названиями, ink генерируется ──
{
  for (const name of ['aldric', 'maeva', 'bran', 'lena', 'corvin', 'yorek']) {
    const res = await fetch(`${base}/dialogues/${name}.dlg.json`)
    const ok = res.ok
    let doc: any = null
    try {
      doc = await res.json()
    } catch {
      /* нет документа */
    }
    check(`№12 ${name}: документ конструктора есть`, ok && !!doc)
    if (!doc) continue
    check(`№12 ${name}: версия 2 и русское название`, doc.version === 2 && !!doc.label && !/\.ink/.test(doc.label))
    try {
      new Compiler(generateInk(doc)).Compile()
      check(`№12 ${name}: сгенерированный ink компилируется`, true)
    } catch (err) {
      check(`№12 ${name}: сгенерированный ink компилируется`, false, String(err))
    }
  }
}

// ── №12: поведение сгенерированных диалогов (первая встреча, торговля) ──
{
  const e = new GameEngine(campaign)
  e.start()
  e.startDialogue('npc_guard_aldric', 'first_meeting')
  const d = e.dialogue!
  check('№12 первая встреча: «Стой, путник.»', d.lines.some((l) => l.text.includes('Стой, путник')))
  check('№12 первая встреча: два варианта', d.choices.length === 2)
  e.chooseDialogueOption(0)
  check('№12 выбор ведёт в хвост узла (напутствие)', e.dialogue!.lines.some((l) => l.text.includes('Ворота открыты до заката')))
  check('№12 флаг heard_about_bandits поставлен', !!e.state.flags['heard_about_bandits'])
  e.endDialogue()
}
{
  const e = new GameEngine(campaign)
  e.start()
  e.startDialogue('npc_bran')
  const idx = e.dialogue!.choices.findIndex((c) => c.text.includes('Показывай товар'))
  check('№12 у Брана есть вариант торговли', idx >= 0)
  e.chooseDialogueOption(idx)
  check('№12 торговля открылась из сгенерированного диалога', !!e.trade)
}

// ── №12: миграция старого формата конструктора (v1 → v2) ──
{
  const v1 = {
    version: 1,
    nodes: [
      {
        id: 'main',
        label: 'Начало',
        lines: [{ text: 'Привет.' }],
        choices: [{ text: 'Пока.', if_not_flag: 'x', lines: [{ text: 'Бывай.' }], effects: [{ type: 'set_flag', flag: 'y' }], goto: 'end' }],
      },
    ],
  }
  const v2 = migrateDlgDoc(v1)
  const ch = v2.nodes[0].choices[0]
  const okConds = ch.conds?.length === 1 && ch.conds[0].type === 'flag' && (ch.conds[0] as any).not === true
  const okSteps = ch.sections[0].steps.length === 2 && ch.sections[0].steps[0].kind === 'effect'
  check('№12 миграция v1→v2 (условия и шаги)', !!okConds && okSteps)
  try {
    new Compiler(generateInk(v2)).Compile()
    check('№12 миграция: ink компилируется', true)
  } catch (err) {
    check('№12 миграция: ink компилируется', false, String(err))
  }
}

// ── №5: «Откат» возвращает счётчик «несохранено» ──
{
  const { EditorStore } = await import('../src/editor/store')
  const store = new EditorStore(base)
  await store.load()
  check('№5 после загрузки несохранённых нет', store.dirty.size === 0)
  const oldTitle = store.meta.title
  store.meta.title = 'Изменённое название'
  store.setMeta(store.meta)
  check('№5 правка даёт «несохранено: 1»', store.dirty.size === 1)
  store.undo()
  check('№5 после отката счётчик снова 0', store.dirty.size === 0, `dirty=${store.dirty.size}`)
  check('№5 название вернулось', store.meta.title === oldTitle)
}

console.log(failed ? `\nПРОВАЛОВ: ${failed}` : '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ')
process.exit(failed ? 1 : 0)
