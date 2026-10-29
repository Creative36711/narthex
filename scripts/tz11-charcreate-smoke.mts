/**
 * Смоук блока 11 ТЗ «Гибкий движок» — создание персонажа (правка «без хардкода»).
 * Требует dev-сервер на :5173. Запуск: npx tsx scripts/tz11-charcreate-smoke.mts
 *
 *  1. валидация выбора хелпером: бюджеты, пороги, обязательные/запрещённые навыки;
 *     происхождение — шаблон: мастер распределяет стартовые очки целиком;
 *  2. применение к шаблону: производные HP/MP пересчитаны, снаряжение профессии;
 *  3. кампания без char_creation стартует как раньше;
 *  4. миграция старого формата; плеер/редактор; монолит и схема.
 */
import { readFileSync } from 'node:fs'
import { loadCampaign } from '../src/core/loader'
import { GameEngine } from '../src/core/engine'
import {
  charChoiceProblems,
  newCharChoice,
  skillMinVal,
  skillPointsUsed,
  statPointsUsed,
  STAT_KEYS,
  withProfession,
  type CharChoice,
} from '../src/core/charcreate'
import type { CampaignData, NpcDef } from '../src/shared/types'

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
const demo = await loadCampaign(base)
const creation = demo.meta.char_creation!
const template = demo.entities[demo.meta.default_player] as NpcDef
const skills = demo.meta.skills

/** корректный выбор: весь бюджет характеристик и навыков потрачен (ручные покупки, без призвания) */
function validChoice(): CharChoice {
  const c0 = newCharChoice(creation, template, demo.meta)
  c0.name = 'Искра'
  // без профессии — считаем чистые покупки (бонусы корректно снимаются)
  const c = withProfession(creation, c0, '')
  // без призвания: навыки сбрасываем на нижний порог, дальше — только ручные покупки
  c.calling = ''
  for (const id of Object.keys(c.skills)) c.skills[id] = skillMinVal(creation, c, id)
  // +15 +10 +5 +3 +1 +1 +0 = 35 очков сверх минимума
  c.stats = { STR: 18, CON: 13, SIZ: 8, DEX: 6, INT: 4, POW: 4, CHA: 3 }
  // обязательные навыки стартуют с 25: уклонение 25→65 (+40), первая помощь 25→45 (+20) = 60 очков
  c.skills = { ...c.skills, dodge: 65, first_aid: 45 }
  return c
}

// ── 1. валидация выбора ──
{
  check('1 демо: формат создания персонажа', creation.total_points === 35 && creation.skill_points === 60 && creation.choose_name === true)
  check('1 демо: пороги задаёт мастер', creation.skill_cap === 75 && creation.skill_floor === 15 && creation.stat_limits.min === 3 && creation.stat_limits.max === 18)
  check('1 демо: три происхождения', (creation.professions ?? []).length === 3)

  const soldier = creation.professions![0]
  check('1 происхождение распределяет весь бюджет характеристик', statPointsUsed(creation, { stats: soldier.stats!, skills: {}, profession: '', calling: '', name: '' } as CharChoice) === creation.total_points)

  const fresh = newCharChoice(creation, template, demo.meta)
  check('1 старт: характеристики из распределения мастера', STAT_KEYS.every((k) => fresh.stats[k] === soldier.stats![k]), STAT_KEYS.map((k) => `${k}=${fresh.stats[k]}`).join(' '))
  check('1 старт: обязательные навыки ≥ 25%', (fresh.skills['dodge'] ?? 0) >= 25 && (fresh.skills['first_aid'] ?? 0) >= 25)
  // фидбек 19: навыки старта приходят из первого призвания — мастер тратит весь бюджет
  // (считаем от нижнего порога: бонусы профессии — бесплатные и в бюджет не входят)
  const call0 = (creation.callings ?? [])[0]
  const floorOf = (id: string) =>
    Math.max(creation.skill_floor ?? 0, (creation.mandatory_skills ?? []).includes(id) ? 25 : 0)
  const callSpent = Object.entries(call0!.skills).reduce((t, [id, v]) => t + Math.max(0, v - floorOf(id)), 0)
  check('1 старт: призвание распределяет весь бюджет навыков', callSpent === creation.skill_points && fresh.calling === call0!.id)
  check('1 выбор мастера валиден сразу (игрок лишь докручивает)', charChoiceProblems(creation, fresh, skills).length === 0, charChoiceProblems(creation, fresh, skills).join('; '))

  const ok = validChoice()
  check('1 полный выбор валиден', charChoiceProblems(creation, ok, skills).length === 0, charChoiceProblems(creation, ok, skills).join('; '))

  const overCap = validChoice()
  overCap.skills = { ...overCap.skills, dodge: 90 }
  check('1 навык выше предела', charChoiceProblems(creation, overCap, skills).some((p) => p.includes('предела')))

  const banned = validChoice()
  banned.skills = { ...banned.skills, bite: 20 }
  check('1 запрещённый навык', charChoiceProblems(creation, banned, skills).some((p) => p.includes('нельзя')))

  const overStat = validChoice()
  overStat.stats = { ...overStat.stats, STR: 19 }
  check('1 характеристика вне рамок', charChoiceProblems(creation, overStat, skills).some((p) => p.includes('вне рамок')))

  const overBudget = validChoice()
  overBudget.stats = { ...overBudget.stats, CHA: 18 }
  check('1 бюджет характеристик превышен', charChoiceProblems(creation, overBudget, skills).some((p) => p.includes('Бюджет характеристик')))

  const noName = validChoice()
  noName.name = '   '
  check('1 без имени при choose_name', charChoiceProblems(creation, noName, skills).some((p) => p.includes('имя')))

  // смена происхождения: покупки игрока сохраняются, бонусы переезжают
  const swapped = withProfession(creation, ok, 'profession_scout')
  check('1 смена происхождения валидна', charChoiceProblems(creation, swapped, skills).length === 0, charChoiceProblems(creation, swapped, skills).join('; '))
  check('1 покупки навыков сохраняются при смене происхождения', skillPointsUsed(creation, swapped) === skillPointsUsed(creation, ok))
}

// ── 2. применение к шаблону ──
{
  const e = new GameEngine(demo)
  const choice = validChoice()
  choice.profession = 'profession_soldier'
  e.applyCharCreation(choice)
  const p = e.state.player
  check('2 имя сохранено', p.name === 'Искра')
  check('2 характеристики применены', p.stats.STR === 18 && p.stats.CON === 13)
  check('2 HP пересчитан', p.max_hp === Math.ceil((13 + 8) / 2) && p.hp === p.max_hp)
  check('2 MP пересчитан', p.max_mp === 4 && p.mp === 4)
  check('2 навыки применены', p.skills['dodge'] === 65 && p.skills['first_aid'] === 45)
  const gambeson = p.inventory.find((i) => i.item === 'item_gambeson')
  check('2 снаряжение профессии выдано', !!gambeson && gambeson.quantity === 1)
  check('2 выбор запомнен в состоянии', e.state.char_choice?.name === 'Искра')
  e.start()
  check('2 старт после выбора работает', e.state.game_over === null)

  const restarted = e.restart()
  check('2 перезапуск сохраняет выбор', restarted.state.player.name === 'Искра' && restarted.state.player.stats.STR === 18)
}

// ── 3. кампания без создания персонажа ──
{
  const c: CampaignData = JSON.parse(JSON.stringify(demo))
  delete c.meta.char_creation
  const e = new GameEngine(c)
  e.applyCharCreation(validChoice())
  check('3 без char_creation — no-op', e.state.player.stats.STR === template.stats.STR && !e.state.player.name)
  e.start()
  check('3 старт как раньше', e.state.player.hp === e.state.player.max_hp && e.state.game_over === null)
}

// ── 4. миграция и интерфейсы ──
{
  const { migrateMeta } = await import('../src/shared/migrate')
  const legacy = JSON.parse(JSON.stringify(demo.meta))
  legacy.char_creation = { total_points: 250, stat_limits: { min: 3, max: 18 }, skill_cap: 75, allowed_professions: ['profession_soldier'] }
  migrateMeta(legacy)
  check('4 миграция убирает allowed_professions', !('allowed_professions' in legacy.char_creation))
  check('4 миграция нормализует списки', Array.isArray(legacy.char_creation.mandatory_skills) && Array.isArray(legacy.char_creation.forbidden_skills))

  const app = readFileSync('src/App.tsx', 'utf8')
  check('4 App открывает экран создания', app.includes('CharacterCreation') && app.includes('applyCharCreation'))
  const ui = readFileSync('src/player/CharacterCreation.tsx', 'utf8')
  // шаги реального экрана (список приведён к CharacterCreation.tsx)
  const steps = ['Герой', 'Внешность героя', 'Происхождение', 'Призвание', 'Характеристики', 'Навыки', 'Сложность', 'Начать забег']
  const missing = steps.filter((s) => !ui.includes(s))
  check('4 экран: все шаги', missing.length === 0, missing.join(', '))
  check('4 экран: кнопка по валидации', ui.includes('charChoiceProblems') && ui.includes('disabled={problems.length > 0}'))
  const ce = readFileSync('src/editor/CampaignEditor.tsx', 'utf8')
  check('4 редактор: блок создания персонажа', ce.includes('Показывать экран создания персонажа') && ce.includes('Происхождения') && ce.includes('Стартовые характеристики'))
}

// ── 5. монолит и схема ──
{
  const { EditorStore } = await import('../src/editor/store')
  const { exportMonolith, parseMonolith } = await import('../src/editor/monolith')
  const store = new EditorStore(base)
  await store.load()
  const { doc } = exportMonolith(store)
  check('5 монолит: профессии в кампании', (doc.campaign.char_creation?.professions ?? []).length === 3)
  void parseMonolith
  const schema = readFileSync('docs/campaign.schema.json', 'utf8')
  check('5 схема знает создание персонажа', schema.includes('CharCreationDef') && schema.includes('ProfessionDef') && schema.includes('skill_bonus'))
}

// ── 6. генерация характеристик кубиками (аудит §5.6 п.5) ──
{
  const { rollStat, rollStatSet, charChoiceProblems: problems6, newCharChoice: nc6, withProfession: wp6 } = await import('../src/core/charcreate')
  const rollCreation = {
    total_points: 0,
    stat_limits: { min: 6, max: 18 },
    roll: { notation: '3d6', per_stat: { INT: '2d6+6', SIZ: '2d6+6' }, arrays: 3, rerolls: 2, redistribute: 3 },
    professions: (demo.meta.char_creation?.professions ?? []) as never,
  }
  // формулы: базовая 3d6 в рамках 6..18, per_stat 2d6+6 в рамках 8..18
  let okBase = true
  let okPer = true
  for (let i = 0; i < 200; i++) {
    const b = rollStat(rollCreation as never, 'STR')
    const p = rollStat(rollCreation as never, 'INT')
    if (b < 6 || b > 18) okBase = false
    if (p < 8 || p > 18) okPer = false
  }
  check('6 кубики: базовая формула в рамках мастера', okBase)
  check('6 кубики: per_stat-переопределение (2d6+6 ≥ 8)', okPer)
  const set = rollStatSet(rollCreation as never)
  check('6 набор содержит все 7 характеристик', Object.keys(set).length === 7)
  // валидация: режим кубиков не требует бюджета очков
  const template = demo.entities[demo.meta.default_player] as NpcDef
  const choice6 = nc6(rollCreation as never, template, demo.meta)
  const probs = problems6(rollCreation as never, choice6, demo.meta.skills)
  check('6 режим кубиков: бюджет очков не валидируется', !probs.some((p) => p.includes('Бюджет характеристик')))
  // происхождение в режиме кубиков не трогает характеристики
  const profId = demo.meta.char_creation?.professions?.[1]?.id
  if (profId) {
    const before = { ...choice6.stats }
    const after = wp6(rollCreation as never, choice6, profId)
    check('6 происхождение не затирает броски', JSON.stringify(before) === JSON.stringify(after.stats))
  } else {
    check('6 происхождение не затирает броски', false, 'нет второй профессии в демо')
  }
  const ui6 = readFileSync('src/player/CharacterCreation.tsx', 'utf8')
  check('6 экран: панель бросков', ui6.includes('Бросить заново') && ui6.includes('pickedSet'))
  // applyCharCreation пересчитывает производные от выброшенных характеристик
  const eng = new GameEngine(JSON.parse(JSON.stringify(demo)))
  eng.start()
  eng.applyCharCreation({ name: 'Кубик', stats: { STR: 18, CON: 18, SIZ: 18, DEX: 18, INT: 18, POW: 18, CHA: 18 }, profession: '', calling: '', skills: {} })
  check('6 производные от бросков: HP=(18+18)/2=18', eng.state.player.max_hp === 18, `max_hp=${eng.state.player.max_hp}`)
}

console.log(failed ? `\n${failed} ПРОВАЛОВ` : '\nВСЕ ПРОВЕРКИ ЗЕЛЁНЫЕ')
process.exit(failed ? 1 : 0)
