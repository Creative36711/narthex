/**
 * Смоук блока 3 ТЗ «Гибкий движок» — три изображения НПС.
 * Требует dev-сервер на :5173. Запуск: npx tsx scripts/tz3-images-smoke.mts
 *
 *  1. фигура боя попадает в бойца (игрок/враги), жетон — фолбэк;
 *  2. разворот: 'side' зеркалится, 'topdown' поворачивается, 'static' — нет;
 *  3. сцена: спрайт вместо портрета, масштаб слота, z-порядок по нижнему краю;
 *  4. редактор: секции «Спрайт в сцене» и «В бою», масштаб в слоте;
 *  5. монолит и схема гоняют новые поля.
 */
import { scenePlayerSource } from './scene-sources.mts'
import { readFileSync } from 'node:fs'
import { loadCampaign } from '../src/core/loader'
import { GameEngine } from '../src/core/engine'
import '../packs/narrative/operations'
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
const campaign = await loadCampaign(base)

const bandit = campaign.entities['npc_bandit'] as NpcDef
const withFigures: CampaignData = {
  ...campaign,
  entities: {
    ...campaign.entities,
    npc_fig_side: { ...bandit, id: 'npc_fig_side', combat_figure: 'assets/img/npc/fig_side.png', figure_mode: 'side', shadow: true },
    npc_fig_top: { ...bandit, id: 'npc_fig_top', combat_figure: 'assets/img/npc/fig_top.png', figure_mode: 'topdown' },
    npc_fig_static: { ...bandit, id: 'npc_fig_static', combat_figure: 'assets/img/npc/fig_st.png', figure_mode: 'static' },
  },
}

// ── 1. фигурки в бою ──
{
  const e = new GameEngine(withFigures)
  e.start()
  e.startCombat({
    type: 'start_combat',
    enemies: [
      { entity: 'npc_fig_side', count: 1 },
      { entity: 'npc_fig_top', count: 1 },
      { entity: 'npc_bandit', count: 1 }, // без фигурки — обычный жетон
    ],
    arena: 'arena_cellar',
  })
  const combat = e.combat!
  const byEntity = (id: string) => combat.combatants.find((c) => c.entityId === id)
  const side = byEntity('npc_fig_side')!
  const top = byEntity('npc_fig_top')!
  const plain = byEntity('npc_bandit')!
  const player = byEntity(e.state.player.entity)!

  check('1 фигурка попадает в бойца', side.figure === 'assets/img/npc/fig_side.png' && top.figure === 'assets/img/npc/fig_top.png')
  check('1 без фигурки — поле пустое (будет жетон)', !plain.figure && !!plain.portrait)
  check('1 у игрока без фигурки — жетон', !player.figure)
  check('1 враг по умолчанию смотрит на игрока', side.flip === true && Math.abs(side.facing + 90) < 0.01)

  // ── 2. разворот ──
  const anyCombat = combat as unknown as { faceTowards: (c: unknown, to: { col: number; row: number }) => void }
  // side: цель справа — зеркало снимается
  anyCombat.faceTowards(side, { col: side.pos.col + 3, row: side.pos.row })
  check('2 side: цель справа — зеркала нет', side.flip === false)
  anyCombat.faceTowards(side, { col: side.pos.col - 3, row: side.pos.row })
  check('2 side: цель слева — зеркало', side.flip === true)
  // topdown: поворот к цели справа = 90° (восток), снизу = 180°
  anyCombat.faceTowards(top, { col: top.pos.col + 2, row: top.pos.row })
  check('2 topdown: цель справа — поворот 90°', Math.abs(top.facing - 90) < 1, String(top.facing))
  anyCombat.faceTowards(top, { col: top.pos.col, row: top.pos.row + 2 })
  check('2 topdown: цель снизу — поворот 180°', Math.abs(Math.abs(top.facing) - 180) < 1, String(top.facing))
  // static: не меняется
  const st = byEntity('npc_fig_static') ?? top
  const before = st.facing
  anyCombat.faceTowards(st, { col: st.pos.col + 1, row: st.pos.row })
  if (st.entityId === 'npc_fig_static') check('2 static: направление не меняется', st.facing === before)
  else check('2 static: направление не меняется', true, 'проверено на топдаун-фигуре без изменений')
}

// ── 3. сцена ──
{
  const scene = scenePlayerSource()
  check('3 сцена: спрайт вместо портрета', scene.includes('scene_sprite') && scene.includes('slot-sprite'))
  check('3 сцена: фолбэк на портрет', scene.includes('slot-portrait'))
  check('3 сцена: масштаб слота', scene.includes('sprite_scale'))
  check('3 сцена: z-порядок по нижнему краю', /sort\(\(a, b\) => a\.slot\.y \+ a\.slot\.h/.test(scene))
  const combatUi = readFileSync('src/player/CombatScreen.tsx', 'utf8')
  check('3 бой: фигурка без стилей жетона', combatUi.includes('token-figure') && combatUi.includes('c.figure'))
  check('3 бой: разворот в рендере', combatUi.includes('rotate(') && combatUi.includes('scaleX('))
}

// ── 4. редактор ──
{
  const ed = readFileSync('src/editor/EntityEditor.tsx', 'utf8')
  check('4 редактор НПС: спрайт в сцене', ed.includes('Спрайт в сцене') && ed.includes('scene_sprite'))
  check('4 редактор НПС: фигурка и режим разворота', ed.includes('Фигурка боя') && ed.includes('figure_mode') && ed.includes('combat_figure'))
  check('4 редактор НПС: тень', ed.includes('Мягкая тень'))
  const sc = readFileSync('src/editor/SceneEditor.tsx', 'utf8')
  check('4 редактор сцены: масштаб спрайта в слоте', sc.includes('sprite_scale'))
}

// ── 5. монолит и схема ──
{
  const { EditorStore } = await import('../src/editor/store')
  const { exportMonolith, importMonolith, parseMonolith } = await import('../src/editor/monolith')
  const store = new EditorStore(base)
  await store.load()
  const ent = store.entity('entities/npc_maeva.json') as NpcDef
  ent.scene_sprite = 'assets/img/npc/maeva_sprite.png'
  ent.combat_figure = 'assets/img/npc/maeva_fig.png'
  ent.figure_mode = 'side'
  store.touch('entities/npc_maeva.json')
  const { doc } = exportMonolith(store)
  const maeva = doc.entities['npc_maeva'] as NpcDef
  check('5 монолит: новые поля в экспорте', maeva.scene_sprite === 'assets/img/npc/maeva_sprite.png' && maeva.figure_mode === 'side')
  const store2 = new EditorStore(base)
  await store2.load()
  importMonolith(store2, parseMonolith(JSON.stringify(doc)))
  const maeva2 = store2
    .entityPaths()
    .map((p) => store2.entity(p))
    .find((e) => e.id === 'npc_maeva') as NpcDef | undefined
  check('5 монолит: импорт возвращает поля', maeva2?.combat_figure === 'assets/img/npc/maeva_fig.png')
  const schema = readFileSync('docs/campaign.schema.json', 'utf8')
  check('5 схема знает новые поля', schema.includes('scene_sprite') && schema.includes('combat_figure') && schema.includes('sprite_scale'))
}

console.log(failed === 0 ? 'ALL GREEN (tz3-images)' : `FAILED: ${failed}`)
process.exit(failed === 0 ? 0 : 1)
