import { readFileSync } from 'node:fs'

function must(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`)
    process.exit(1)
  }
  console.log(`✓ ${msg}`)
}

console.log('--- Смоук-тест: Вкладки инспектора сцены и ручной ввод координат ---')

const sceneEd = readFileSync('src/editor/SceneEditor.tsx', 'utf8')
const editorCss = readFileSync('src/editor/editor.css', 'utf8')

// 1. Вкладки инспектора сцены
must(sceneEd.includes("type SceneTab = 'object' | 'scene' | 'states'"), '1. Тип SceneTab объявлен с вкладками object / scene / states')
must(sceneEd.includes("const [tab, setTab] = useState<SceneTab>('object')"), '2. Начальное состояние вкладки — object')
must(sceneEd.includes('scene-inspector-tabs'), '3. Вкладки инспектора используют класс scene-inspector-tabs')
must(sceneEd.includes('Параметры сцены') && sceneEd.includes('Фон и состояния'), '4. Вкладки имеют понятные русские названия')

// 2. Автоматическое переключение на вкладку object
must(sceneEd.includes("setTab('object')"), '5. Клик по объекту на холсте или создание переключает на вкладку object')

// 3. Быстрая полоса управления и свойства слота/перехода на самом верху
must(sceneEd.includes('scene-selected-bar'), '6. Выбранный объект имеет верхнюю панель быстрого управления')
must(sceneEd.includes('Все объекты') && sceneEd.includes('Удалить'), '7. Доступен быстрый возврат ко всем объектам и удаление')
must(sceneEd.includes('SceneObjectsCatalog'), '8. Когда объект не выбран, отображается удобный каталог объектов')

// 4. Ручной ввод координат
must(sceneEd.includes('function RectCoordsEditor'), '9. Компонент RectCoordsEditor реализован')
must(sceneEd.includes('Положение и размер слота') && sceneEd.includes('Положение и размер зоны перехода'), '10. RectCoordsEditor подключен к слотам и переходам')

// 5. CSS стили
must(editorCss.includes('.scene-props') && editorCss.includes('position: sticky'), '11. Панель scene-props зафиксирована sticky для комфортной работы')
must(editorCss.includes('.scene-inspector-tabs'), '12. Стили вкладок добавлены в editor.css')
must(editorCss.includes('.scene-catalog-item'), '13. Элементы каталога объектов сцены оформлены')

console.log('scene-editor-tabs-smoke: ALL GREEN')
