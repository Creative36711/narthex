/**
 * Смоук восьмого раунда фидбека, блок D — декларативная графика (ArtDoc).
 * Требует dev-сервер на :5173. Запуск: npx tsx scripts/feedback8-D-smoke.mts
 */
import { readFileSync } from 'node:fs'
import { loadCampaign } from '../src/core/loader'
import { GameEngine } from '../src/core/engine'
import '../packs/narrative/operations'
import { artToSvg, artToDataUrl } from '../src/shared/ArtView'
import type { ArtDoc, CampaignData, SceneDef } from '../src/shared/types'

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

// ── рендер примитивов ──
const art: ArtDoc = {
  canvas: { w: 1280, h: 720 },
  background: '#101820',
  layers: [
    { label: 'небо', shape: { type: 'rect', x: 0, y: 0, w: 1280, h: 400, fill: { gradient: { from: '#1c2340', to: '#d9895b', angle: 90 } } } },
    { label: 'солнце', shape: { type: 'ellipse', cx: 900, cy: 380, rx: 70, ry: 70, fill: '#ffcf7a', opacity: 0.9 } },
    { label: 'горы', shape: { type: 'polygon', points: [0, 500, 300, 250, 640, 480, 1280, 300, 1280, 720, 0, 720], fill: '#1d2b3a' } },
    { label: 'дорога', shape: { type: 'line', x1: 100, y1: 700, x2: 640, y2: 460, color: '#b89a6a', width: 6 } },
    { label: 'повозка', shape: { type: 'rect', x: 560, y: 560, w: 160, h: 80, fill: '#553311', rotate: 15 } },
    { label: 'подпись', shape: { type: 'text', x: 640, y: 90, text: 'Долина <Каэрден> & «тракт»', size: 48, color: '#fff', align: 'middle' } },
  ],
}
{
  const svg = artToSvg(art)
  check('D svg: корректный viewBox холста', svg.includes('viewBox="0 0 1280 720"'))
  check('D svg: фон', svg.includes('<rect width="1280" height="720" fill="#101820"/>'))
  check('D svg: прямоугольник', svg.includes('<rect x="0" y="0" width="1280" height="400"'))
  check('D svg: линейный градиент вынесен в defs', /<defs><linearGradient[^>]+>.*<\/linearGradient><\/defs>/.test(svg))
  check('D svg: эллипс с прозрачностью', svg.includes('<ellipse cx="900" cy="380" rx="70" ry="70" fill="#ffcf7a"') && svg.includes('opacity="0.9"'))
  check('D svg: многоугольник', svg.includes('<polygon points="0,500 300,250 640,480 1280,300 1280,720 0,720"'))
  check('D svg: линия', svg.includes('<line x1="100" y1="700" x2="640" y2="460" stroke="#b89a6a" stroke-width="6"'))
  check('D svg: поворот вокруг центра', svg.includes('rotate(15 640 600)'))
  check('D svg: текст экранирован', svg.includes('Долина &lt;Каэрден&gt; &amp; «тракт»') && svg.includes('text-anchor="middle"'))
  check('D svg: слои без нативных <title> (фидбек 12: без подсказок при наведении)', !svg.includes('<title>'))
  check('D data-URL для Konva/превью', artToDataUrl(art).startsWith('data:image/svg+xml'))
  check('D пустой ArtDoc не падает', artToSvg({ layers: [] }).includes('<svg') && artToSvg(null) === '')
  check(
    'D неизвестный примитив пропускается',
    !artToSvg({ layers: [{ shape: { type: 'star' } as never }] }).includes('star'),
  )
}

// ── сцена с векторным фоном в движке ──
{
  const campaign: CampaignData = await loadCampaign('http://localhost:5173/campaigns/ash-of-caerden')
  const scene: SceneDef = {
    id: 'scene_art_test',
    label: 'Тест векторного фона',
    location: 'loc_gates',
    canvas: { w: 1280, h: 720 },
    states: [{ id: 'state_art', label: 'Вектор', art, condition: null }],
    slots: [
      // слот поставлен ровно на «повозку» из ArtDoc — координаты те же
      { id: 'slot_cart', label: 'Повозка', type: ['item'], shape: 'rect', x: 560, y: 560, w: 160, h: 80, condition: null },
    ],
    navigation: [{ area: { x: 20, y: 620, w: 260, h: 80 }, open_map: true, label: 'Карта' }],
  }
  campaign.scenes[scene.id] = scene
  const e = new GameEngine(campaign)
  e.start()
  e.goToScene(scene.id)
  const st = e.activeSceneState(e.currentScene())
  check('D движок отдаёт состояние с art', !!st.art && !st.image)
  check('D слот в координатах ArtDoc', e.currentScene().slots[0].x === 560)
}

// ── UI ──
{
  const scr = readFileSync('src/player/SceneScreen.tsx', 'utf8')
  check('D экран сцены игрока рендерит ArtView', scr.includes('<ArtView') && scr.includes('state.art'))
  const ed = readFileSync('src/editor/SceneEditor.tsx', 'utf8')
  // фон ArtDoc в редакторе рисуется тем же ArtView, что и в игре (правка раунда:
  // data-URL-SVG внутри <img> в превью не отображался) и лежит под Konva
  const edCss = readFileSync('src/editor/editor.css', 'utf8')
  check('D редактор сцен: art как фон', ed.includes('<ArtView className="scene-stage-art"') && ed.includes('scene-stage-with-art') && edCss.includes('.scene-stage.scene-stage-with-art { background: transparent;'))
  check('D редактор сцен: «заменить изображением»', ed.includes('Заменить изображением'))
  check('D редактор сцен: расширенный JSON', ed.includes('Расширенный JSON') && ed.includes('ArtDoc'))
  const map = readFileSync('src/player/MapScreen.tsx', 'utf8')
  check('D карта региона может быть ArtDoc', map.includes('region.map_art'))
  const world = readFileSync('src/editor/WorldEditor.tsx', 'utf8')
  check('D редактор мира поддерживает ArtDoc карты', world.includes('map_art') && world.includes('Сделать векторной'))
  const types = readFileSync('src/shared/types.ts', 'utf8')
  check('D формат: ArtDoc и примитивы в types.ts', ['ArtDoc', 'ArtRect', 'ArtEllipse', 'ArtPolygon', 'ArtLine', 'ArtText'].every((t) => types.includes(`interface ${t}`)))
}

console.log(failed ? `\nПРОВАЛОВ: ${failed}` : '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ')
process.exit(failed ? 1 : 0)
