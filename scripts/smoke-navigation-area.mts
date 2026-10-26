/**
 * Регрессия на D-072: сцена без `area` в navigation не должна ронять игру.
 *
 * 26.10 браузерный прогон нашёл `TypeError: Cannot read properties of
 * undefined (reading 'x')` на проекте fmv-crossing. `SceneScreen.tsx` читал
 * `nav.area.x`; у сцены координат не было. Защита живёт в
 * `migrateNavigation()` — нормализует данные до отрисовки.
 */
import assert from 'node:assert/strict'
import { migrateNavigation } from '../src/shared/migrate'
import type { SceneDef, WorldDef } from '../src/shared/types'

const world = { regions: [] } as unknown as WorldDef

function scene(navigation: unknown[]): SceneDef {
  return { id: 'scene_probe', location: 'loc_probe', canvas: { w: 640, h: 360 }, navigation } as unknown as SceneDef
}

// 1. Зона без area получает координаты всей сцены.
{
  const s = scene([{ label: 'Открыть карту после видео', open_map: true }])
  const out = migrateNavigation(s, world)
  assert.deepEqual(out[0]!.area, { x: 0, y: 0, w: 640, h: 360 }, 'area должна быть добавлена')
  assert.equal(out[0]!.open_map, true, 'open_map должен сохраниться')
  console.log('✓ зона без area нормализована')
}

// 2. Существующие координаты не перезаписываются.
{
  const area = { x: 17, y: 23, w: 120, h: 40 }
  const s = scene([{ label: 'В город', area }])
  const out = migrateNavigation(s, world)
  assert.deepEqual(out[0]!.area, area)
  console.log('✓ существующая area не тронута')
}

// 3. Смешанный случай и мутация самой сцены.
{
  const s = scene([
    { label: 'A', open_map: true },
    { label: 'B', area: { x: 1, y: 2, w: 3, h: 4 } },
  ])
  migrateNavigation(s, world)
  assert.ok(s.navigation.every((nav) => nav.area && nav.area.w > 0), 'все зоны обязаны иметь area')
  console.log('✓ migrateNavigation пишет нормализованные зоны обратно в сцену')
}

console.log('smoke:navigation-area: 3/3 PASS')
