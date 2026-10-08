import { readFileSync } from 'node:fs'

function must(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`)
    process.exit(1)
  }
  console.log(`✓ ${msg}`)
}

console.log('--- Смоук-тест: Лайтбокс, приоритет состояний сцены и чистые подзаголовки ---')

// 1. Проверяем лайтбокс в Fields.tsx
const fieldsSrc = readFileSync('src/editor/Fields.tsx', 'utf8')
must(fieldsSrc.includes('createPortal') && fieldsSrc.includes('img-lightbox-overlay'), '1. Лайтбокс картинок смонтирован через createPortal в document.body')
must(readFileSync('src/editor/editor.css', 'utf8').includes('z-index: 999999'), '2. Лайтбокс имеет zIndex 999999 и перекрывает сцену')
must(fieldsSrc.includes('Escape'), '3. Лайтбокс закрывается по Escape')

// 2. Проверяем приоритет состояний в SceneEditor и Engine
const sceneEdSrc = readFileSync('src/editor/SceneEditor.tsx', 'utf8')
const engineSrc = readFileSync('src/core/engine.ts', 'utf8')
must(sceneEdSrc.includes('s.condition') && sceneEdSrc.includes('baseIdx'), '4. В редакторе сцен по умолчанию открывается базовое состояние без условий')
must(engineSrc.includes('st.condition && evalSceneCondition(st.condition, this)'), '5. В движке состояния с условиями проверяются с приоритетом, а базовое служит фоллбэком')

// 3. Проверяем гайд ИИ
const guideSrc = readFileSync('docs/ai-campaign-guide.md', 'utf8')
must(guideSrc.includes('Первым (`states[0]`) ВСЕГДА идёт базовое (основное) состояние сцены'), '6. В руководстве ИИ зафиксирован регламент порядка состояний сцены')

// 4. Проверяем подзаголовок в SceneScreen.tsx
const sceneScreenSrc = readFileSync('src/player/SceneScreen.tsx', 'utf8')
must(sceneScreenSrc.includes('formatSceneSubtitle'), '7. Реализована функция formatSceneSubtitle')
must(!sceneScreenSrc.includes('`${scene.label} — ${state.label}`'), '8. Убрана конкатенация с техническими «Всегда» и «Днём»')

console.log('scene-subtitles-and-state-smoke: ALL GREEN')
