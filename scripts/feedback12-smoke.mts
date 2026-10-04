import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const f = (p: string) => readFileSync(join(root, p), 'utf8')
let fails = 0
const must = (ok: boolean, name: string) => {
  console.log((ok ? '✓ ' : '✗ ') + name)
  if (!ok) fails++
}

const css = f('src/index.css')
const ecss = f('src/editor/editor.css')
const tip = f('src/shared/tooltip.ts')
const main = f('src/main.tsx')
const fields = f('src/editor/Fields.tsx')
const world = f('src/editor/WorldEditor.tsx')
const campaign = f('src/editor/CampaignEditor.tsx')
const editor = f('src/editor/EditorApp.tsx')
const quest = f('src/editor/QuestEditor.tsx')
const ent = f('src/editor/EntityEditor.tsx')
const assets = f('src/editor/assets.ts')
const art = f('src/shared/ArtView.tsx')
const hud = f('src/player/HUD.tsx')
const cellar = JSON.parse(f('public/campaigns/ash-of-caerden/arenas/arena_cellar.json'))

// 1 — адаптивные тултипы у краёв и поверх сайдбара
must(tip.includes('window.innerWidth - b.width') && tip.includes('window.innerHeight - b.height') && css.includes('.ui-tooltip'),
  '1 тултипы не вылезают за края экрана (клампы) и не обрезаются контейнерами')
must(css.includes('.ui-tooltip') && css.includes('z-index: 10000') && main.includes('initTooltips()'),
  '1 плашка поверх всего (z-index 10000), подключена в main.tsx')

// 2 — залипающие вкладки без зазора с шапкой
must(ecss.includes('.rule-editor:has(.ce-tabs) { padding-top: 0; }') && ecss.includes('.rule-editor { padding: 0; }') && ecss.includes('.rule-editor > .ce-tabs { margin: 0 -18px 14px;'),
  '2 вкладки приклеены к шапке без «пляшущего» зазора')

// 3 — JSON во вкладках на весь экран, «Мир» получил вкладку JSON
must(fields.includes('inline?: boolean') && fields.includes('advanced-json-page') && campaign.includes('advanced-json-page') && !campaign.includes('<details className="advanced-json"'),
  '3 JSON во вкладках развёрнут на весь экран, без сворачивания')
must(world.includes("useState<'map' | 'json'>") && world.includes('inline') && !world.includes('Расширенный JSON мира'),
  '3 «Мир»: JSON — отдельная вкладка, а не свёрнутый блок сбоку')

// 4 — фильтры «Персонажей» понятные
must(editor.includes("['all', 'Все'], ['npc', 'Персонажи'], ['item', 'Предметы']") && !editor.includes('Надевается'),
  '4 фильтры списка «Персонажи»: Все/Персонажи/Предметы')

// 5 — успех/провал квеста цветом
must(quest.includes('sel-outcome') && css.includes('select.sel-outcome.success') && css.includes('select.sel-outcome.failure'),
  '5 итог этапа квеста: успех зелёный, провал красный')

// 6 — ютуб-ссылки принимаются
must(assets.includes("kind === 'video' && youtubeId(url)") && assets.includes('YouTube-ссылка распознана'),
  '6 ссылка youtube.com/watch?v= принимается, а не «не открывается»')

// 7 — состояния портрета выбираются из списка
must(ent.includes('emotion-pick') && ent.includes('__new__') && ent.includes('+ Создать новое состояние…'),
  '7 состояния выбираются из списка; создать новое — прямо в том же месте')

// 8 — никаких нативных подсказок в катсцене
must(!art.includes('<title>') && !art.includes('</title>'),
  '8 у слоёв катсцен нет нативных подсказок «Небо» и т.п.')

// 9 — расстановка боя подвала на открытом полу
must(JSON.stringify(cellar.spawn_zones.player.hexes) === '[[2,2],[3,2],[3,3]]' && JSON.stringify(cellar.spawn_zones.enemy.hexes) === '[[6,4],[7,4],[6,3]]',
  '9 спавн подвала — на свободном полу, не на бочках/столах')
must(cellar.hex_grid.blocked_hexes.length > 20,
  '9 бочки/столы/лестница в подвале отмечены непроходимыми по картине')

// 10 — иконка выхода в HUD
must(hud.includes('n="exit"') && !hud.includes('⏻'),
  '10 «Выход» в HUD — иконка-дверь, не глиф-квадрат')

// 11 — поле урона оружия (ряд «N × dN + мод» переехал в общий DiceNotationInput;
// ширины стали компактными по фидбеку 27, п.3 — проверяем структуру, не числа)
must(css.includes('.dmg-row') && css.includes('dmg-summary') && ent.includes('DiceNotationInput'),
  '11 урон оружия: структурный ряд полей вместо текста')

console.log(fails ? `ПРОВАЛЕНО: ${fails}` : 'ALL GREEN')
if (fails) process.exitCode = 1
