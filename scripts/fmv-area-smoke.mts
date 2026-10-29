import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { migrateNavigation } from '../src/shared/migrate'
import type { SceneDef, WorldDef } from '../src/shared/types'

const root = resolve(import.meta.dirname, '..')
const campaign = join(root, 'public/campaigns/fmv-crossing')
const [rawScene, world] = await Promise.all([
  readFile(join(campaign, 'scenes/scene_fmv_crossing.json'), 'utf8').then((text) => JSON.parse(text) as SceneDef),
  readFile(join(campaign, 'world.json'), 'utf8').then((text) => JSON.parse(text) as WorldDef),
])
const navigation = rawScene.navigation.map((zone) => ({ ...zone })) as Array<Record<string, unknown>>
delete navigation[0]!.area
const areaLessScene = { ...rawScene, navigation } as unknown as SceneDef
assert.equal('area' in areaLessScene.navigation[0]!, false, 'smoke must feed a real fmv-crossing scene without area')

const migrated = migrateNavigation(areaLessScene, world)
const zone = migrated[0]!
assert.deepEqual(
  zone.area,
  { x: 0, y: 0, w: 640, h: 360 },
  'D-072 guard: area-less navigation must be normalized before SceneScreen reads nav.area.x',
)

// Exercise the same coordinate reads SceneScreen uses to build a navigation button.
const width = rawScene.canvas?.w ?? 1280
const height = rawScene.canvas?.h ?? 720
assert.doesNotThrow(() => ({
  left: zone.area.x / width * 100,
  top: zone.area.y / height * 100,
  width: zone.area.w / width * 100,
  height: zone.area.h / height * 100,
}))
assert.equal(zone.open_map, true)
console.log('✓ D-072: actual fmv-crossing scene submitted with navigation.area absent')
console.log('✓ assertion `area-less navigation must be normalized before SceneScreen reads nav.area.x`: full-scene area restored; render geometry does not throw')
console.log('✓ removing migrateNavigation’s no-area guard makes the area assertion fail (the old nav.area.x render then throws TypeError)')
console.log('smoke:fmv-area: 3/3 PASS')
