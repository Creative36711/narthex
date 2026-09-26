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

/** корректный выбор: весь бюджет характеристик и навыков потрачен */
function validChoice(): CharChoice {
  const c0 = newCharChoice(creation, template, demo.meta)
  c0.name = 'Искра'
  // без профессии — считаем чистые покупки (бонусы корректно снимаются)
  const c = withProfession(creation, c0, '')
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
  check('1 происхождение распределяет весь бюджет характеристик', statPointsUsed(creation, { stats: soldier.stats!, skills: {}, profession: '', name: '' } as CharChoice) === creation.total_points)

  const fresh = newCharChoice(creation, template, demo.meta)
  check('1 старт: характеристики из распределения мастера', STAT_KEYS.every((k) => fresh.stats[k] === soldier.stats![k]), STAT_KEYS.map((k) => `${k}=${fresh.stats[k]}`).join(' '))
  check('1 старт: обязательные навыки ≥ 25%', (fresh.skills['dodge'] ?? 0) >= 25 && (fresh.skills['first_aid'] ?? 0) >= 25)
  check('1 старт: навыки на нижнем пороге', skillPointsUsed(creation, fresh) === 0 && (fresh.skills['sword'] ?? 0) === skillMinVal(creation, fresh, 'sword'))
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
  check('4 экран: все шаги', ui.includes('Имя героя') && ui.includes('Характеристики') && ui.includes('Происхождение') && ui.includes('Начать забег'))
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

console.log(failed ? `\n${failed} ПРОВАЛОВ` : '\nВСЕ ПРОВЕРКИ ЗЕЛЁНЫЕ')
process.exit(failed ? 1 : 0)
