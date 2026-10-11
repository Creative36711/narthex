import { readFileSync } from 'node:fs'

function must(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`)
    process.exit(1)
  }
  console.log(`✓ ${msg}`)
}

console.log('--- Смоук-тест: Расширенная визуализация и использование изображений в игре ---')

// 1. Инвентарь и карточка осмотра
const panelsSrc = readFileSync('src/player/Panels.tsx', 'utf8')
must(panelsSrc.includes('itemImageSrc'), '1. Функция itemImageSrc экспортирована и извлекает картинку предмета')
must(panelsSrc.includes('inv-item-thumb-box') && panelsSrc.includes('inv-thumb'), '2. Миниатюры предметов отображаются в сетке инвентаря')
must(panelsSrc.includes('item-inspect-card') && panelsSrc.includes('item-inspect-art'), '3. Карточка детального осмотра предмета реализована в инвентаре')

// 2. Торговля
const tradeSrc = readFileSync('src/player/TradePanel.tsx', 'utf8')
must(tradeSrc.includes('inv-item-thumb-box') && tradeSrc.includes('item-inspect-card'), '4. Торговля поддерживает миниатюры и карточку осмотра товара/предмета')

// 3. Предъявление предмета в диалоге (present_item)
const dialogueSrc = readFileSync('src/player/DialogueOverlay.tsx', 'utf8')
must(dialogueSrc.includes('dialogue-present-grid') && dialogueSrc.includes('present-item-card') && dialogueSrc.includes('present-item-thumb'), '5. Предъявление улик в диалоге стилизовано галереей карточек с изображениями')

// 4. Кодекс и бестиарий
const codexSrc = readFileSync('src/player/CodexPanel.tsx', 'utf8')
must(codexSrc.includes('creatureArtSrc') && codexSrc.includes('codex-image-wrap'), '6. Кодекс использует арт сущности для бестиария и аккуратную обертку изображений')

// 5. Карта мира
const mapSrc = readFileSync('src/player/MapScreen.tsx', 'utf8')
must(mapSrc.includes('travel-postcard') && mapSrc.includes('travel-postcard-img'), '7. Окно отправления на карте отображает открытку-превью локации')

// 6. CSS
const indexCss = readFileSync('src/index.css', 'utf8')
must(indexCss.includes('.inv-item-thumb-box') && indexCss.includes('.item-inspect-card') && indexCss.includes('.present-item-card') && indexCss.includes('.travel-postcard'), '8. Все визуальные стили добавлены в index.css')

console.log('game-images-visual-smoke: ALL GREEN')
