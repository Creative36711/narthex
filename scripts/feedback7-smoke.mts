/**
 * Смоук седьмого раунда фидбека (4 пункта). Требует dev-сервер на :5173.
 * Запуск: npx tsx scripts/feedback7-smoke.mts
 */
import { readFileSync } from 'node:fs'
import { CampaignEditor } from '../src/editor/CampaignEditor'
import { loadCampaign } from '../src/core/loader'
import { GameEngine } from '../src/core/engine'

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

const warmth = campaign.meta.needs.find((n) => n.id === 'warmth')

// ── №1: потребность с условной убылью («Тепло») ──
{
  check('№1 в демо есть потребность «Тепло» с условиями', !!warmth && (warmth.decay_when?.length ?? 0) === 3)
  const e = new GameEngine(campaign)
  e.start()
  const w = () => e.state.player.needs['warmth'] ?? -1

  check('№1 на старте тепло полное', w() === 100)
  // день (старт в 8:00): условия убыли не выполнены — тепло не падает
  e.advanceTicks(2)
  check('№1 днём тепло не убывает', w() === 100)
  check('№1 обычные потребности при этом убывают', (e.state.player.needs['hunger'] ?? 100) < 100)

  // ночь на улице без плаща — мёрзнем
  e.state.tick = 22
  e.advanceTicks(1)
  check('№1 ночью на улице тепло убывает', w() === 100 - (warmth?.decay_per_tick ?? 0), `тепло=${w()}`)
}

// ── №3: потребность закрывают одежда И помещение ──
{
  const e = new GameEngine(campaign)
  e.start()
  const w = () => e.state.player.needs['warmth'] ?? -1

  // с плащом ночь не страшна
  e.addItem('item_wool_cloak', 1)
  e.state.tick = 22
  e.advanceTicks(2)
  check('№3 с тёплой одеждой ночью не мёрзнем', w() === 100)

  // без плаща, но у очага таверны — тепло восстанавливается
  e.removeItem('item_wool_cloak', 1)
  e.state.player.needs['warmth'] = 50
  ;(e.state as any).location = 'loc_tavern'
  e.advanceTicks(1)
  check('№3 в таверне тепло восстанавливается', w() === 50 + (warmth?.restore_per_tick ?? 0), `тепло=${w()}`)
  // и не выше максимума
  e.state.player.needs['warmth'] = 98
  e.advanceTicks(1)
  check('№3 восстановление не превышает максимум', w() === 100)

  check('№3 плащ продаётся у Брана', ((campaign.entities['npc_bran'] as any).trader.sells as Array<{ item: string }>).some((s) => s.item === 'item_wool_cloak'))
}

// ── №2: скрытые фракции не показываются игроку ──
{
  const vermin = (campaign.meta.factions ?? []).find((f) => f.id === 'faction_vermin')
  check('№2 «Дикие твари» помечены скрытой', !!vermin?.hidden)
  const src = readFileSync('src/player/Panels.tsx', 'utf8')
  check('№2 панель отношений фильтрует скрытые', src.includes('.filter((f) => !f.hidden)'))
  check('№2 в редакторе есть галочка «Скрытая»', typeof CampaignEditor === 'function' && !!vermin?.hidden)
}

// ── №4: интерактивное обучение можно включить заново ──
{
  // итерация 8, А2: кнопка убрана из главного меню и осталась только в справке
  const menu = readFileSync('src/player/MainMenu.tsx', 'utf8')
  check('№4 в главном меню больше нет «Обучение заново»', !menu.includes('Обучение заново'))
  const helpSrc = readFileSync('src/player/HelpPanel.tsx', 'utf8')
  check('№4 в справке «Обучение заново» осталось', helpSrc.includes('Обучение заново') && helpSrc.includes('resetTips('))
  const tips = await import('../src/player/tips')
  tips.markTip('combat')
  check('№4 подсказка отмечена просмотренной', tips.tipSeen('combat'))
  tips.resetTips()
  check('№4 сброс возвращает подсказки', !tips.tipSeen('combat'))
}

// ── редактор: конструктор условий потребностей на месте ──
{
  check('№1 в редакторе есть условия убывания и восстановление', typeof CampaignEditor === 'function' && (warmth?.decay_when?.length ?? 0) > 0)
}

console.log(failed ? `\nПРОВАЛОВ: ${failed}` : '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ')
process.exit(failed ? 1 : 0)
