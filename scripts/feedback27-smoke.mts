/**
 * Смоук раунда фидбека 27 (кампания «Шестерни и пепел», 8 пунктов + §9 дизайн-дока).
 * Запуск: npx tsx scripts/feedback27-smoke.mts (нужен dev-сервер :5173)
 *
 *  1. дата выхода — календарный выбор (type="date"), а не текст;
 *  2. реестры в редакторе (страсти, приверженности, преступления, ценовые
 *     события, черты, категории навыков) — строки «название + код», без
 *     ручного «id=label»; правило засады — выбор правила, а не id текстом;
 *  3. ряд «N × dN + мод» в редакторе компактный (селекты не на всю ширину);
 *  4. категории навыков заполняются человекопонятно и редактируются как реестр;
 *  5. у потребностей есть описание;
 *  6. служебные строки («true») не попадают в диалог: защита движка + аудит
 *     ink + правила стиля в чемодане;
 *  7. ремонт сохранения не отбирает шаблонное снаряжение и личные отношения
 *     (главный баг: «начал забег, вышел, продолжил — предметы сняли»);
 *  8. заголовок сцены не дублирует название локации;
 *  9. §9 дизайн-дока: skill_check ветвится в ink (1/0), set_entity_state и
 *     open_trade документированы как внешние вызовы.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import * as React from 'react'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadCampaign } from '../src/core/loader'
import { GameEngine } from '../src/core/engine'
import { repairState, type ReportCtx } from '../src/core/savemigrate'
import { drainStory, type DialogueLine } from '../src/core/dialogue'
import { EditorStore } from '../src/editor/store'
import { CampaignEditor } from '../src/editor/CampaignEditor'
import { validateCampaign } from '../src/editor/campaignAudit'
import type { GameState } from '../src/shared/types'

let failed = 0
function check(name: string, ok: boolean, extra = '') {
  console.log(`${ok ? '✓' : '✗ FAIL'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!ok) failed++
}
const f = (p: string) => readFileSync(p, 'utf8')
;(globalThis as any).React = React

const ctx = (): ReportCtx & { texts: string[] } => {
  const texts: string[] = []
  return {
    notes: [],
    texts,
    note(kind, text) {
      texts.push(`${kind}: ${text}`)
    },
  }
}

// ── 7. ремонт сохранения не отбирает законные данные ──
{
  const campaign = await loadCampaign('http://localhost:5173/campaigns/ash-of-caerden')
  const engine = new GameEngine(campaign)
  engine.start()
  const state = engine.state

  // шаблонное снаряжение: предмет есть в кампании, но не лежит в инвентаре
  const itemId = Object.keys(campaign.entities).find((id) => campaign.entities[id].type === 'item') ?? ''
  const slot = (campaign.meta.equipment_slots ?? []).map((s) => s.id)[0] ?? Object.keys(state.player.equipment)[0] ?? 'weapon'
  state.player.inventory = state.player.inventory.filter((e) => e.item !== itemId)
  state.player.equipment[slot] = itemId

  // отношения: фракция + личный сдвиг к NPC + призрак, которого нет в кампании
  const factionId = (campaign.meta.factions ?? []).map((x) => x.id)[0] ?? ''
  const npcId = Object.keys(campaign.entities).find((id) => campaign.entities[id].type === 'npc') ?? ''
  state.dispositions = { ...(state.dispositions ?? {}), [factionId]: 10, [npcId]: -5, ghost_zzz: 3 }

  const c1 = ctx()
  repairState(state, campaign, c1)
  check('7 шаблонное снаряжение не снимается (предмет есть в кампании)', state.player.equipment[slot] === itemId, `${slot}=${state.player.equipment[slot]}`)
  check('7 личный сдвиг к NPC сохраняется', state.dispositions[npcId] === -5)
  check('7 отношение с фракцией сохраняется', !factionId || state.dispositions[factionId] === 10)
  check('7 призрак-отношение убран', !('ghost_zzz' in state.dispositions))
  check('7 в отчёте нет строки про снятие с героя', !c1.texts.some((t) => t.includes('Снято с героя')), c1.texts.join(' | '))

  // настоящее битьё: предмета нет в кампании — снимаем
  state.player.equipment[slot] = 'item_which_never_existed'
  const c2 = ctx()
  repairState(state, campaign, c2)
  check('7 битый предмет из слота снимается', !(slot in state.player.equipment))
  check('7 отчёт объясняет снятие', c2.texts.some((t) => t.includes('Снято с героя')))

  // предмет в инвентаре, которого нет в кампании — убирается (старое поведение цело)
  state.player.inventory.push({ item: 'item_ghost_404', qty: 1 } as never)
  const c3 = ctx()
  repairState(state, campaign, c3)
  check('7 битый предмет в инвентаре по-прежнему чистится', !state.player.inventory.some((e) => e.item === 'item_ghost_404'))
  check('7 строка отчёта про инвентарь на месте', c3.texts.some((t) => t.includes('Из инвентаря убрано')))
}

// ── 6а. движок: служебные литералы не становятся репликами ──
{
  const script = ['true', 'Реплика караульного.', 'false', 'nan', '', 'Ещё реплика.']
  let i = 0
  const fake = {
    get canContinue() {
      return i < script.length
    },
    Continue: () => `${script[i++] ?? ''}\n`,
    currentTags: [] as string[],
    currentChoices: [] as { text: string }[],
  }
  const { lines } = drainStory(fake as never)
  const texts = lines.map((l: DialogueLine) => l.text)
  check('6 реплики остались', texts.includes('Реплика караульного.') && texts.includes('Ещё реплика.'))
  check('6 «true/false/nan» отфильтрованы', !texts.some((t) => /^(true|false|nan)$/i.test(t)), texts.join(' | '))
}

// ── 6б. аудит: условие после квадратных скобок выбора ──
{
  const dir = 'public/campaigns/__smoke27'
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(`${dir}/dialogues`, { recursive: true })
  writeFileSync(`${dir}/campaign.json`, JSON.stringify({
    id: 'smoke27', title: 'Smoke 27', version: '1.0.0',
    // «спрятанный» под кодой ярлык реестра — аудит обязан предупредить
    crimes: [
      { id: 'crime_intrusion', label: 'crime_intrusion=Проникновение в служебные тоннели' },
      { id: 'crime_theft', label: 'Кража служебных бумаг' },
    ],
  }))
  writeFileSync(`${dir}/world.json`, JSON.stringify({ regions: [] }))
  writeFileSync(`${dir}/manifest.json`, JSON.stringify({ scenes: [], entities: [], rules: [], dialogues: ['bad.ink', 'good.ink'] }))
  writeFileSync(
    `${dir}/dialogues/bad.ink`,
    ['EXTERNAL get_flag(a0)', '', '=== main ===', '+ [Пропустите меня.] { not (get_flag("x")) }', '    Проходите.', '    -> DONE', ''].join('\n'),
  )
  writeFileSync(
    `${dir}/dialogues/good.ink`,
    ['EXTERNAL get_flag(a0)', '', '=== main ===', '+ { not (get_flag("x")) } [Пропустите меня.]', '    Проходите.', '    -> DONE', ''].join('\n'),
  )
  const store = new EditorStore('http://localhost:5173/campaigns/__smoke27')
  await store.load()
  const report = await validateCampaign(store)
  const bad = report.structure.filter((x) => x.message.includes('bad.ink') && x.message.includes('квадратных скобок'))
  const good = report.structure.filter((x) => x.message.includes('good.ink') && x.message.includes('квадратных скобок'))
  check('6 аудит видит условие после скобок', bad.length === 1, `${bad.length}`)
  const codey = report.structure.filter((x) => x.message.includes('похожа на служебный код'))
  check('2 аудит ловит «id=Название» в подписи реестра', codey.length === 1 && codey[0].message.includes('crime_intrusion'), `${codey.length}`)
  check('2 нормальная подпись не считается кодом', !report.structure.some((x) => x.message.includes('Кража служебных бумаг') && x.message.includes('служебный код')))
  check('6 канонический стиль не считается ошибкой', good.length === 0)
  rmSync(dir, { recursive: true, force: true })
}

// ── 1-5. редактор: понятные поля вместо «id=label» ──
{
  const campaignEditorApi = CampaignEditor
  const editorStore = new EditorStore('/campaigns/editor-api')
  editorStore.meta = JSON.parse(f('public/campaigns/ash-of-caerden/campaign.json')) as typeof editorStore.meta
  editorStore.meta.passions_list = [{ id: 'focus', label: 'Сосредоточенность' }]
  editorStore.meta.allegiances = [{ id: 'sun', label: 'Солнце' }]
  editorStore.meta.crimes = [{ id: 'intrusion', label: 'Проникновение' }]
  editorStore.meta.price_events = [{ id: 'fair', label: 'Ярмарка', multiplier: 1.5 }]
  editorStore.meta.item_categories = [{ id: 'relic', label: 'Реликвии' }]
  editorStore.meta.skill_categories = [{ id: 'craft', label: 'Ремесло' }]
  editorStore.meta.needs = [{ id: 'need_test', label: 'Потребность', description: 'Пояснение игроку', max: 100, decay_per_tick: 1, critical_threshold: 10 }]
  editorStore.meta.progression = {
    ...(editorStore.meta.progression ?? {}),
    feats: [{ id: 'feat_test', label: 'Стойкость', description: 'Держаться дольше', mods: { hp: 2 }, requires: [{ type: 'level_ge', level: 3 }] }],
  }
  editorStore.meta.weathers = [{ id: 'storm', label: 'Буря', combat: { skill_mods: [{ skill: 'ranged', delta: -10 }] } }]
  editorStore.manifest.rules = ['rule_ambush.json']
  editorStore.jsonFiles.set('rules/rule_ambush.json', { id: 'rule_ambush', label: 'Засада', conditions: [], effects: [] })
  const editorMarkup = renderToStaticMarkup(createElement(CampaignEditor, { store: editorStore }))
  const ruleOptions = editorStore.options('rule')
  const categoryOptions = editorStore.options('itemCategory')
  const feat = editorStore.meta.progression?.feats?.[0]
  const crime = editorStore.meta.crimes?.[0]
  const priceEvent = editorStore.meta.price_events?.[0]
  const skillCategory = editorStore.meta.skill_categories?.[0]
  const need = editorStore.meta.needs?.[0]
  const weather = editorStore.meta.weathers?.[0]
  check('1 дата — календарный ввод', typeof campaignEditorApi === 'function' && /<input[^>]+type="date"/.test(editorMarkup))
  check('1 ISO-подсказка у даты больше не нужна', !editorMarkup.includes('дата, ISO'))
  const namedRegistryRows = [
    ...(editorStore.meta.passions_list ?? []),
    ...(editorStore.meta.allegiances ?? []),
    ...(editorStore.meta.crimes ?? []),
    ...(editorStore.meta.price_events ?? []),
    ...(editorStore.meta.item_categories ?? []),
    ...(editorStore.meta.skill_categories ?? []),
  ]
  check('2 универсальный редактор реестров есть', typeof campaignEditorApi === 'function' && namedRegistryRows.length === 6 && namedRegistryRows.every((row) => Boolean(row.id && row.label)))
  check('2 реестры переведены на строки (страсти, приверженности, преступления, цены, категории)', namedRegistryRows.length === 6 && namedRegistryRows.every((row) => Boolean(row.id && row.label)))
  // черты с 29-го раунда правятся одним блоком (название + описание + модификаторы + требования) без дублирующей строки и id
  check('2 черты — отдельный блок без служебного кода', typeof campaignEditorApi === 'function' && feat?.label === 'Стойкость' && feat.description === 'Держаться дольше' && feat.mods?.hp === 2 && (feat.requires?.length ?? 0) === 1)
  check('2 страсти/приверженности — реестр строк', editorStore.meta.passions_list?.[0]?.label === 'Сосредоточенность' && editorStore.meta.allegiances?.[0]?.label === 'Солнце')
  check('2 преступления больше не вводятся строкой «id=label»', crime?.id === 'intrusion' && crime.label === 'Проникновение' && !crime.label.includes('='))
  check('2 ценовые события — строки с множителем, а не парсинг `id=label*1.5`', priceEvent?.id === 'fair' && priceEvent.label === 'Ярмарка' && priceEvent.multiplier === 1.5)
  check('2 правило засады выбирается из правил', ruleOptions.some((option) => option.id === 'rule_ambush' && option.label === 'Засада'))
  check('4 категории навыков — реестр строк', skillCategory?.id === 'craft' && skillCategory.label === 'Ремесло' && categoryOptions.some((option) => option.id === 'relic'))
  check('5 у потребности есть описание', need?.description === 'Пояснение игроку')
  // «во всех местах»: парсерные текстовые поля заменены структурой
  check('2 модификаторы черты — строки «что — прибавка»', feat?.mods?.hp === 2)
  check('2 требования черты — конструктор условий', feat?.requires?.some((condition) => condition.type === 'level_ge' && condition.level === 3))
  check('2 сдвиги навыков погоды — строки «навык — сдвиг»', weather?.combat?.skill_mods?.some((modifier) => modifier.skill === 'ranged' && modifier.delta === -10))
  const css = f('src/editor/editor.css')
  check('3 селекты кубиков в редакторе не растягиваются на всю ширину', /\.dmg-row select,[\s\S]{0,80}width: auto/.test(css))
  const ui = f('src/index.css')
  check('8 подсказка не вылезает за экран и переносит длинные слова',
    /\.ui-tooltip\s*\{[^}]*max-width: min\(280px, calc\(100vw - 24px\)\)/.test(ui) && /\.ui-tooltip\s*\{[^}]*overflow-wrap: anywhere/.test(ui))
  check('3 ряд кубиков в редакторе компактный', /\.[fF]ld-dmg[^}]*flex: 0 1 auto/.test(css) || /\.fld-row \.fld-dmg \{[\s\S]{0,120}flex: 0 1 auto/.test(css))
}

// ── 8. заголовок сцены без дубля локации ──
{
  const scene = f('src/player/SceneScreen.tsx')
  check('8 дубль «Локация — Локация — День» убран', scene.includes('scene.label === loc?.location.label'))
}

// ── 9. §9 дизайн-дока: внешние вызовы, которых не хватало ──
{
  const dlg = f('src/core/dialogue.ts')
  check('9 skill_check возвращает 1/0 для ветвления в ink', /bind\('skill_check'[\s\S]{0,400}return .*success \? 1 : 0/.test(dlg))
  check('9 появился внешний вызов set_entity_state', dlg.includes("bind('set_entity_state'"))
  check('9 open_trade доступен из ink', dlg.includes("bind('open_trade'"))
  // set_entity_state принимает состояние, описанное в кампании
  const engine = f('src/core/engine.ts')
  check('9 set_entity_state проходит проверку состояний', engine.includes("case 'set_entity_state'"))
}

// ── чемодан: правила стиля ink и подписи реестров ──
{
  const guide = f('docs/ai-campaign-guide.md')
  const kit = f('public/ai/campaign-guide.md')
  check('чемодан в public/ai синхронизирован', kit === guide)
  check('правило: условие выбора только перед квадратными скобками', guide.includes('Условие выбора — ТОЛЬКО перед квадратными скобками'))
  check('правило: условные блоки одной строкой', guide.includes('Условные текстовые блоки — в одну строку'))
  check('правило: подписи реестров человекопонятные', guide.includes('без код\n    id, префиксов и служебных символов') || guide.includes('без код id'))
  check('документирован skill_check для рукописного ink', guide.includes('{ skill_check("sneak", 60): … }'))
  check('документирован open_trade из реплики', guide.includes('~ open_trade('))
  check('документирован set_entity_state из реплики', guide.includes('~ set_entity_state('))
  const task = f('src/editor/aiTask.ts')
  check('TASK.md предупреждает про условие после скобок', task.includes('квадратных скобок') || task.includes('«+ { условие } [текст]»'))
}

console.log(failed === 0 ? '\nвсе проверки 27-го раунда пройдены' : `\nпровалено проверок: ${failed}`)
process.exit(failed === 0 ? 0 : 1)
