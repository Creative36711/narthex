/**
 * Смоук раунда фидбека 26 (дыры ИИ-кампании «Ржавая литургия», 8 пунктов).
 * Запуск: npx tsx scripts/feedback26-smoke.mts (нужен dev-сервер :5173)
 *
 *  1. чемодан знает, какие изображения генерировать с фоном, а какие без
 *     (эмблема меню/спрайты/фигурки — прозрачные), и аудит ловит непрозрачные;
 *  2. урон/лечение/формулы бросков вводятся структурно (N×dN+мод), а не текстом;
 *  3. ряд «N × dN + мод» не сжимается до наезда на соседние чекбоксы;
 *  4. флаги: «для чего нужен» обязательно для ИИ (чемодан + аудит + редактор);
 *  5. таблица встреч в manifest.rules больше не роняет редактор и движок:
 *     parseRuleFile разносит файлы, магазин лечит правила без массивов;
 *  6. на экране сбоя есть кнопка копирования текста ошибки;
 *  7. старт забега обёрнут в try/catch: игрок видит модалку «кампания сломана»,
 *     а не молчащую кнопку «Начать забег»;
 *  8. мелочи разметки/типов: числовые поля отката, неиспользуемые переменные.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import * as React from 'react'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { parseRuleFile } from '../src/shared/ruleFiles'
import { loadCampaign } from '../src/core/loader'
import { GameEngine } from '../src/core/engine'
import { EditorStore } from '../src/editor/store'
import { CampaignEditor } from '../src/editor/CampaignEditor'
import { DiceNotationInput } from '../src/editor/Fields'
import { validateCampaign } from '../src/editor/campaignAudit'
import { readFileSync } from 'node:fs'

;(globalThis as any).React = React
let failed = 0
function check(name: string, ok: boolean, extra = '') {
  console.log(`${ok ? '✓' : '✗ FAIL'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!ok) failed++
}
const f = (p: string) => readFileSync(p, 'utf8')

// ── 5а. parseRuleFile: три вердикта ──
{
  const enc = parseRuleFile('enc_road.json', {
    encounter_tables: [{ id: 'enc_road', rolls: 1, entries: [{ weight: 1, type: 'nothing' }] }],
  })
  check('5 файл встреч узнаётся и не становится правилом', enc.kind === 'encounters' && enc.tables[0]?.id === 'enc_road')
  const bare = parseRuleFile('rule_bare.json', { id: 'rule_bare', label: 'б', once: true })
  check('5 правило без conditions/effects лечится пустыми массивами', bare.kind === 'rule' && Array.isArray(bare.rule.conditions) && Array.isArray(bare.rule.effects))
  const junk = parseRuleFile('junk.json', { hello: 'world' })
  check('5 мусор без id отбрасывается с предупреждением', junk.kind === 'invalid' && junk.warnings.length > 0)
  const good = parseRuleFile('r.json', { id: 'r', label: 'r', once: true, conditions: [], effects: [] })
  check('5 валидное правило проходит без предупреждений', good.kind === 'rule' && good.warnings.length === 0)
}

// ── 5б. движок переживает правило без массивов (дефенсива engine.ts) ──
{
  const campaign = await loadCampaign('http://localhost:5173/campaigns/ash-of-caerden')
  const broken = structuredClone(campaign)
  broken.rules.zz_broken = { id: 'zz_broken', label: 'сломанное', once: true } as never
  let threw = ''
  try {
    const e = new GameEngine(broken)
    e.start()
  } catch (err) {
    threw = String(err)
  }
  check('5 движок стартует с правилом без conditions/effects', threw === '', threw)
}

// ── 5в. редактор: sanitizeRules переносит встречи и лечит правила ──
{
  const dir = 'public/campaigns/__smoke26'
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(`${dir}/rules`, { recursive: true })
  writeFileSync(`${dir}/campaign.json`, JSON.stringify({ id: 'smoke26', title: 'Smoke 26', version: '1.0.0' }))
  writeFileSync(`${dir}/world.json`, JSON.stringify({ regions: [] }))
  writeFileSync(
    `${dir}/manifest.json`,
    JSON.stringify({
      scenes: [],
      entities: [],
      rules: ['enc_road.json', 'rule_bare.json', 'rule_ok.json'],
      encounters: ['enc_road.json'],
      dialogues: [],
    }),
  )
  writeFileSync(
    `${dir}/rules/enc_road.json`,
    JSON.stringify({ encounter_tables: [{ id: 'enc_road', rolls: 1, entries: [{ weight: 1, type: 'nothing' }] }] }),
  )
  writeFileSync(`${dir}/rules/rule_bare.json`, JSON.stringify({ id: 'rule_bare', label: 'б', once: true }))
  writeFileSync(`${dir}/rules/rule_ok.json`, JSON.stringify({ id: 'rule_ok', label: 'ок', once: true, conditions: [], effects: [] }))
  const store = new EditorStore('http://localhost:5173/campaigns/__smoke26')
  await store.load()
  check('5 редактор убрал файл встреч из manifest.rules', !store.manifest.rules.includes('enc_road.json'), store.manifest.rules.join(','))
  check('5 файл встреч остался в manifest.encounters', (store.manifest.encounters ?? []).includes('enc_road.json'))
  check('5 редактор предупредил о починке', store.loadWarnings.length > 0, `${store.loadWarnings.length} warn`)
  const bare = store.rule('rules/rule_bare.json')
  check('5 правило без массивов вылечено в редакторе', Array.isArray(bare.conditions) && Array.isArray(bare.effects))
  rmSync(dir, { recursive: true, force: true })
}

// ── 1. чемодан: фоны и прозрачность ──
{
  const guide = f('docs/ai-campaign-guide.md')
  const kit = f('public/ai/campaign-guide.md')
  check('1 гайд требует прозрачную эмблему меню', guide.includes('theme.menu.title_art`)** — ОБЯЗАТЕЛЬНО прозрачный фон'))
  check('1 гайд разделяет роли «без фона» и «с фоном»', guide.includes('Без фона (прозрачный PNG с альфа-каналом):') && guide.includes('С фоном (сплошное полноэкранное изображение):'))
  check('1 чемодан в public/ai синхронизирован с docs', kit === guide)
  const audit = f('src/editor/campaignAudit.ts')
  check('1 аудит проверяет альфа-канал ролей «без фона»', audit.includes('inspectAlphaRoles') && audit.includes('createImageBitmap'))
  const task = f('src/editor/aiTask.ts')
  check('1 TASK.md несёт требование прозрачности', task.includes('генерируй с прозрачным фоном'))
}

// ── 2. структурный ввод кубиков вместо текста ──
{
  const renderDiceField = (label: string, compact = false, optional = false) => renderToStaticMarkup(createElement(DiceNotationInput, {
    label,
    value: '1d6',
    onChange: () => undefined,
    compact,
    optional,
  }))
  const damageField = renderDiceField('Урон (кубики)')
  const healingField = renderDiceField('Лечение (кубики)', false, true)
  const compactField = renderDiceField('Характеристика', true)
  const naturalWeaponField = renderDiceField('Урон')
  check('2 компонент DiceNotationInput существует', typeof DiceNotationInput === 'function')
  check('2 «Урон (кубики)» способности — структурный', typeof CampaignEditor === 'function' && damageField.includes('Урон (кубики)') && damageField.includes('<select') && damageField.includes('type="number"'))
  check('2 «Лечение (кубики)» — структурный', typeof CampaignEditor === 'function' && healingField.includes('Лечение (кубики)') && healingField.includes('<select') && healingField.includes('Сбросить: не задано'))
  check('2 формулы характеристик — структурные (compact)', typeof CampaignEditor === 'function' && compactField.includes('fld-dmg-compact') && !compactField.includes('dmg-summary'))
  check('2 природное оружие — структурное', typeof CampaignEditor === 'function' && naturalWeaponField.includes('aria-label="Урон: сколько кубиков"') && naturalWeaponField.includes('<select'))
  const ee = f('src/editor/EntityEditor.tsx')
  check('2 оружие использует общий компонент', ee.includes('DiceNotationInput label="Урон"') && !ee.includes('function DamageInput'))
  const campaign = await loadCampaign('http://localhost:5173/campaigns/ash-of-caerden')
  const backlashEntries = (campaign.meta.abilities ?? []).flatMap((ability) => ability.backlash_table ?? [])
  check('2 откат: HP/MP ± стали числовыми полями', typeof CampaignEditor === 'function' && backlashEntries.some((entry) => typeof entry.hp_delta === 'number') && backlashEntries.some((entry) => typeof entry.mp_delta === 'number'))
}

// ── 3. CSS: ряд кубиков не наезжает на соседей ──
{
  const css = f('src/index.css')
  check('3 колонка .fld-dmg не сжимается ниже содержимого', /\.fld-row \.fld-dmg \{[^}]*min-width: 300px/.test(css))
  check('3 dmg-row переносится вместо наезда', /\.dmg-row \{[^}]*flex-wrap: wrap/.test(css))
  check('3 чекбоксы в ряду не растягиваются', /\.fld-row > \.fld-check \{[^}]*flex: 0 1 auto/.test(css))
}

// ── 4. флаги: «для чего нужен» ──
{
  const guide = f('docs/ai-campaign-guide.md')
  check('4 чемодан обязывает заполнять description флага', guide.includes('ОБЯЗАТЕЛЬНО заполняй `description`'))
  const audit = f('src/editor/campaignAudit.ts')
  check('4 аудит предупреждает о флаге без пояснения', audit.includes('не заполнено поле «Для чего нужен»'))
  const flagStore = new EditorStore('/campaigns/flag-purpose-api')
  flagStore.meta.flags = [{ id: 'flag_test', label: 'Тестовый флаг' }]
  const flagAudit = await validateCampaign(flagStore)
  check('4 редактор подсвечивает пустое «Для чего нужен»', typeof CampaignEditor === 'function' && flagAudit.structure.some((finding) => finding.message.includes('Тестовый флаг') && finding.message.includes('не заполнено поле «Для чего нужен»')))
  const task = f('src/editor/aiTask.ts')
  check('4 TASK.md несёт требование о флагах', task.includes('обязательно заполняй description'))
}

// ── 6. копирование текста сбоя ──
{
  const eb = f('src/shared/ErrorBoundary.tsx')
  check('6 на экране сбоя есть кнопка копирования', eb.includes('Скопировать текст ошибки') && eb.includes('navigator.clipboard'))
  check('6 есть фолбэк без clipboard API', eb.includes('execCommand'))
}

// ── 7. старт забега под защитой + модалка игроку ──
{
  const app = f('src/App.tsx')
  check('7 reportStartFailure объясняет игроку и даёт копирование', app.includes('Кампания сломана — забег не запущен') && app.includes('Скопировать текст ошибки'))
  check('7 все старты идут через runStart/try-catch', (app.match(/runStart\(/g) ?? []).length >= 5 && app.includes('onRestart={() => {\n          try {'))
  check('7 CharacterCreation не глотает исключение', !app.includes('e.applyCharCreation(choice)\n            e.start()'))
}

// ── 9. дизайн-док §9: закрытые пункты ──
{
  const types = f('src/shared/types.ts')
  const engine = f('src/core/engine.ts')
  const dlg = f('src/core/dialogue.ts')
  const guide = f('docs/ai-campaign-guide.md')
  check('9.2 потребность умеет убывать/восстанавливаться по погоде', types.includes("{ type: 'weather'; weather: string; not?: boolean }") && engine.includes("case 'weather':"))
  const weatherStore = new EditorStore('/campaigns/weather-picker')
  weatherStore.meta = campaign.meta
  const weatherOptions = weatherStore.options('weather')
  check('9.2 редактор потребностей даёт выбрать погоду', typeof CampaignEditor === 'function' && (campaign.meta.weathers ?? []).length > 0 && (campaign.meta.weathers ?? []).every((weather) => weatherOptions.some((option) => option.id === weather.id && option.label === weather.label)))
  check('9.3 диалоги читают счётчики хроники', dlg.includes("bind('get_meta_counter'") && engine.includes('metaCounter(key: string)'))
  check('9.3 гайд документирует get_meta_counter и погоду в needs', guide.includes('get_meta_counter') && guide.includes('weather_snow'))
  // 9.1 (таймер реплики) сознательно не реализован: большая механика, место ей в роадмапе
  check('9.1 таймер диалога не воткнут на скорую руку', !types.includes('reply_timeout'))
}

console.log(failed ? `\nПРОВАЛЕНО: ${failed}` : '\nвсе проверки раунда 26 прошли')
process.exit(failed ? 1 : 0)
