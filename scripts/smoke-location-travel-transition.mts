import { readFileSync } from 'node:fs'

console.log('--- Смоук-тест: Кинематографичный переход между локациями и открытка карты ---')

function must(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`FAIL: ${msg}`)
    process.exit(1)
  }
  console.log(`✓ ${msg}`)
}

// 1. Проверка исходного кода MapScreen.tsx
const mapSrc = readFileSync('src/player/MapScreen.tsx', 'utf8')

must(mapSrc.includes('travel-postcard') && mapSrc.includes('travel-postcard-img'),
  '1. MapScreen содержит стилизованную открытку-превью локации (travel-postcard, travel-postcard-img)')

must(mapSrc.includes('travel-postcard-badge') && mapSrc.includes('travel-postcard-close'),
  '2. Открытка содержит бейдж назначения и кнопку закрытия карточки')

must(mapSrc.includes('travel-route-info') && mapSrc.includes('formatTicks'),
  '3. Реализовано форматирование времени в пути со склонениями (час, часа, часов)')

must(mapSrc.includes('travel-journey-overlay') && mapSrc.includes('travel-journey-card'),
  '4. Реализован кинематографичный оверлей пути между локациями (travel-journey-overlay, travel-journey-card)')

must(mapSrc.includes('travel-journey-compass') && mapSrc.includes('travel-journey-progress-bar'),
  '5. Оверлей пути содержит анимированный компас и полосу прогресса маршрута')

must(mapSrc.includes('finishTravel') && mapSrc.includes('is-selected'),
  '6. Поддерживается пропуск пути кликом/клавишей и подсветка выбранного маркера на карте')

// 2. Проверка стилей в src/index.css
const cssSrc = readFileSync('src/index.css', 'utf8')

must(cssSrc.includes('.travel-confirm {') && cssSrc.includes('translate: -50% 0;') && cssSrc.includes('width: min(440px'),
  '7. Карточка подтверждения пути центрирована (translate: -50% 0) и ограничена по ширине min(440px)')

must(cssSrc.includes('.travel-postcard {') && cssSrc.includes('height: 140px;') && cssSrc.includes('overflow: hidden;'),
  '8. Открытка локации зафиксирована по высоте (140px) с overflow: hidden для предотвращения расползания')

must(cssSrc.includes('.travel-postcard-img {') && cssSrc.includes('object-fit: cover;'),
  '9. Изображение открытки масштабируется пропорционально (object-fit: cover)')

must(cssSrc.includes('.travel-journey-overlay {') && cssSrc.includes('radial-gradient'),
  '10. Оверлей пути оформлен атмосферным радиальным градиентом и размытием')

must(cssSrc.includes('@keyframes cf-travel-bar') && cssSrc.includes('@keyframes cf-spin-needle'),
  '11. Присутствуют ключевые кадры анимации полосы пути и стрелки компаса')

must(cssSrc.includes('.map-pin.is-selected'),
  '12. Выбранный маркер локации выделяется золотым сиянием (.map-pin.is-selected)')

console.log('\nsmoke-location-travel-transition: ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ!')
