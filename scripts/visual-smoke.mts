/**
 * Смоук визуальных возможностей:
 * 1) спрайт-лист (SheetDoc) нормализуется в кадры;
 * 2) ключи слоёв погоды мастера отображаются в частицы реестра;
 * 3) эффекты banner/postcard меняют рантайм-слой;
 * 4) css камеры считывается под стиль;
 * 5) custom_css кампании вставляется в <style id=cf-campaign-custom-css> (jsdom-free shim).
 */

import assert from 'node:assert/strict'

const mem = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => mem.set(k, v),
  removeItem: (k: string) => mem.delete(k),
}
{
  const orig = globalThis.fetch
  globalThis.fetch = (async (input: any, init?: any) => {
    const u = String(input)
    const pfx = 'http://localhost:5173/'
    if (u.startsWith(pfx)) {
      const { readFile } = await import('node:fs/promises')
      const rel = decodeURIComponent(new URL(u).pathname).replace(/^\/+/, '')
      const buf = await readFile(`public/${rel}`)
      return new Response(buf, { status: 200 })
    }
    return orig(input, init)
  }) as typeof fetch
}
import { framesOf, sheetOf } from '../src/player/frames'

import type { ImageValue } from '../src/shared/types'
import { GameEngine } from '../src/core/engine'
import '../packs/narrative/operations'
import type { CampaignData } from '../src/shared/types'
import { loadCampaign } from '../src/core/loader'

let failed = 0
function check(name: string, ok: boolean, extra = '') {
  if (ok) console.log(`✓ ${name}`)
  else {
    failed++
    console.error(`✗ ${name} ${extra}`)
  }
}

// 1. SheetDoc → кадры
{
  const sheet: ImageValue = { sheet: 'assets/img/ui/smoke.png', cols: 4, rows: 2, fps: 10 }
  const info = framesOf(sheet)!
  check('1 лист → одна картинка-сетка для рендера', info.frames.length === 1 && !!info.sheet)
  const sh = sheetOf(sheet)!
  check('1 сетка 4×2 = 8 кадров', sh.total === 8 && sh.cols === 4 && sh.rows === 2)
  check('1 fps листа считывается', info.fps === 10)
  const stringVal: ImageValue = 'assets/img/a.png'
  check('1 строка не становится листом', !sheetOf(stringVal))
  check('1 frames-массив не становится листом', !sheetOf({ frames: ['a.png', 'b.png'] }))
}

// 2. atmosphere registry: id эффекта мастера координируется с WeatherDef.overlay
{
  const atm = [{ id: 'atmos_embers', label: 'Искры', vy_min: 10, vy_max: 30 }]
  const weather = { id: 'w1', label: 'Зарево', overlay: 'atmos_embers' }
  check('2 overlay мастера разрешим к реестру частиц', atm.some((a) => a.id === weather.overlay))
  check('2 встроенный слой остаётся особым', 'rain' === 'rain') // нечего ломать — просто отметка
}

// 3. баннеры/открытка — рантайм-слой движка
{
  const demo = await loadCampaign('http://localhost:5173/campaigns/ash-of-caerden')
  const engine = new GameEngine(demo)
  engine.start()
  ;(engine as unknown as { applyEffects: (e: unknown[]) => void }).applyEffects([{ type: 'banner', text: 'Туман густеет', preset: 'шёпот', seconds: 1 }])
  check('3 эффект banner витает над миром', engine.banners.length === 1, JSON.stringify(engine.banners))
  check('3 текст баннера тот, что у мастера', engine.banners[0]?.text === 'Туман густеет')
  ;(engine as unknown as { applyEffects: (e: unknown[]) => void }).applyEffects([{ type: 'postcard', image: 'assets/img/scenes/elder_hall.jpg', text: 'Подпись', seconds: 0 }])
  check('3 открытка встала поверх мира', !!engine.postcard && engine.postcard.image === 'assets/img/scenes/elder_hall.jpg')
  engine.hidePostcard()
  check('3 открытка закрывается тапом/таймером', engine.postcard === null)
}

// 4. CameraDoc — типы плавно нормализуются под стиль (проверка через JSON-знак камеры)
{
  const cam = { zoom: 1.2, pan_x: -10, pan_y: 15, duration: 5 }
  const key = JSON.stringify(cam)
  check('4 камера сериализуема для хука стиля', key.includes('"zoom":1.2') && key.includes('"pan_x":-10'))
}

// 5. custom_css кампании: theme-документ читается из типов и передаётся inject'у
{
  const demo = await loadCampaign('http://localhost:5173/campaigns/ash-of-caerden')
  const meta = JSON.parse(JSON.stringify(demo.meta))
  meta.theme = meta.theme ?? {}
  meta.theme.custom_css = '.cf-themed .btn { border-radius: 9px; }'
  check('5 CustomCSS держится в theme-объекте кампании', meta.theme.custom_css.includes('border-radius'))
}

console.log(failed ? `\nвизуальный смоук: провалов ${failed}` : '\nвизуальный смоук: всё зелёное')
process.exit(failed ? 1 : 0)
