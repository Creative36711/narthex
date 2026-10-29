/**
 * Смоук блока 1 ТЗ «Гибкий движок» — профиль механик (тумблеры).
 * Требует dev-сервер на :5173. Запуск: npx tsx scripts/tz1-features-smoke.mts
 *
 *  1. демо-кампания без `features` работает как раньше;
 *  2. needs:off — потребности не убывают, change_need не действует;
 *  3. skills:off — проверки = успех без броска и без отметок;
 *  4. combat:off — start_combat резолвится победой и применяет on_victory;
 *  5. trade:off — прилавок не открывается;
 *  6. редактор: вкладка «Механики»;
 *  7. монолит гоняет `features` без потерь.
 */
import { readFileSync } from 'node:fs'
import { loadCampaign } from '../src/core/loader'
import { GameEngine } from '../src/core/engine'
import '../packs/narrative/operations'
import { EditorStore } from '../src/editor/store'
import { exportMonolith, importMonolith, parseMonolith } from '../src/editor/monolith'
import { featureOn, type CampaignData, type CampaignMeta } from '../src/shared/types'

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

function withFeatures(meta: Partial<CampaignMeta['features']>): CampaignData {
  return { ...campaign, meta: { ...campaign.meta, features: { ...meta } } }
}

// ── 1. демо без features: всё включено по умолчанию ──
{
  check('1 демо без features: потребности убывают', (() => {
    const e = new GameEngine(campaign)
    e.start()
    const before = e.state.player.needs['hunger'] ?? 0
    e.advanceTicks(2)
    return (e.state.player.needs['hunger'] ?? 0) < before
  })())
  check('1 featureOn: отсутствующее поле = включено', featureOn(campaign.meta, 'map') && featureOn(campaign.meta, 'combat'))
}

// ── 2. needs:off ──
{
  const e = new GameEngine(withFeatures({ needs: false }))
  e.start()
  const h = () => e.state.player.needs['hunger'] ?? -1
  const before = h()
  e.advanceTicks(3)
  check('2 needs:off — потребности не убывают', h() === before, `до=${before} после=${h()}`)
  e.changeNeed('hunger', -50)
  check('2 needs:off — change_need не действует', h() === before)
  // при включённых потребностях (контроль) убывание есть
  const e2 = new GameEngine(withFeatures({ needs: true }))
  e2.start()
  const b2 = e2.state.player.needs['hunger'] ?? 0
  e2.advanceTicks(3)
  check('2 needs:on — убывание осталось', (e2.state.player.needs['hunger'] ?? 0) < b2)
}

// ── 3. skills:off ──
{
  const e = new GameEngine(withFeatures({ skills: false }))
  e.start()
  const out = e.playerSkillCheck('persuade', 999) // запредельная сложность — без броска всё равно успех
  check('3 skills:off — проверка успешна без броска', out.success && out.roll === 0)
  check('3 skills:off — отметка опыта не ставится', !e.state.player.skill_marks['persuade'])
  // врата: успех без броска применяет success_effects
  e.applyEffects([
    {
      type: 'skill_check_gate',
      skill: 'persuade',
      difficulty: 999,
      success_effects: [{ type: 'set_flag', flag: 'tz_gate_ok' }],
      fail_effects: [{ type: 'set_flag', flag: 'tz_gate_fail' }],
    },
  ])
  check('3 skills:off — врата идут по ветке успеха', !!e.state.flags['tz_gate_ok'] && !e.state.flags['tz_gate_fail'])
  // рост отключён
  ;(e.state.player.skill_marks as Record<string, boolean>)['persuade'] = true
  const grown = e.restAndGrow()
  check('3 skills:off — рост во сне отключён', grown.length === 0)
}

// ── 4. combat:off ──
{
  const e = new GameEngine(withFeatures({ combat: false }))
  e.start()
  const breadBefore = e.itemCount('item_bread')
  e.startCombat({
    type: 'start_combat',
    enemies: [{ entity: 'npc_bandit', count: 2 }],
    arena: 'arena_cellar',
    intro: 'Тестовый конфликт',
    on_victory: [
      { type: 'set_flag', flag: 'tz_combat_won' },
      { type: 'add_item', item: 'item_bread', quantity: 2 },
    ],
  })
  check('4 combat:off — бой не создаётся', e.combat === null)
  check('4 combat:off — немедленная победа (флаг)', !!e.state.flags['tz_combat_won'])
  check('4 combat:off — on_victory выдаёт предметы', e.itemCount('item_bread') === breadBefore + 2)
}

// ── 5. trade:off ──
{
  const e = new GameEngine(withFeatures({ trade: false }))
  e.start()
  e.openTrade('npc_bran') // у Брана есть прилавок в демо
  check('5 trade:off — прилавок не открывается', e.trade === null)
  const e2 = new GameEngine(withFeatures({ trade: true }))
  e2.start()
  e2.openTrade('npc_bran')
  check('5 trade:on — прилавок открывается', e2.trade !== null)
}

// ── 6. редактор: вкладка «Механики» ──
{
  const src = readFileSync('src/editor/CampaignEditor.tsx', 'utf8')
  check('6 редактор: вкладка «Механики»', src.includes("'mechanics'") && src.includes('Механики'))
  check('6 редактор: тумблеры профиля', src.includes('FEATURE_TOGGLES') && src.includes('m.features'))
}

// ── 7. монолит: features переживают экспорт/импорт ──
{
  const store = new EditorStore(base)
  await store.load()
  store.meta.features = { map: false, combat: false }
  const { doc } = exportMonolith(store)
  check('7 монолит: features в экспорте', doc.campaign.features?.map === false && doc.campaign.features?.combat === false)
  const parsed = parseMonolith(JSON.stringify(doc))
  const repaired = (await import('../src/editor/monolith')).repairMonolith(parsed)
  check('7 монолит: авторемонт сохраняет features', repaired.doc.campaign.features?.map === false)
  const store2 = new EditorStore(base)
  await store2.load()
  importMonolith(store2, parsed)
  check('7 монолит: импорт раскладывает features', store2.meta.features?.map === false && store2.meta.features?.combat === false)
}

console.log(failed === 0 ? 'ALL GREEN (tz1-features)' : `FAILED: ${failed}`)
process.exit(failed === 0 ? 0 : 1)
