import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { ErrorBoundary } from './shared/ErrorBoundary'
import { initTooltips } from './shared/tooltip'

initTooltips()
import { ModalHost } from './shared/modals'

/**
 * Диагностика «тёмного экрана» (фидбек 20). Вставьте в консоль браузера:
 *
 *     copy(__cf_diag())
 *
 * — и пришлите результат. Команда соберёт состояние сцены, фон и размеры
 * элементов, чтобы было видно, что именно не отрисуется.
 */
;(window as unknown as Record<string, unknown>).__cf_diag = () => {
  const q = (sel: string) => document.querySelector(sel) as HTMLElement | null
  const box = (el: HTMLElement | null) =>
    el ? `${Math.round(el.clientWidth)}×${Math.round(el.clientHeight)}` : 'нет'
  const stage = q('.scene-stage')
  const bg = stage?.querySelector('img.scene-bg') as HTMLImageElement | null
  const lines = [
    `сборка: ${BUILD_STAMP}`,
    `адрес: ${location.href}`,
    `окно: ${innerWidth}×${innerHeight}`,
    `root: ${box(q('#root'))}`,
    `game-view: ${box(q('.game-view'))}`,
    `scene-wrap: ${box(q('.scene-wrap'))}`,
    `scene-stage: ${box(stage)}`,
    `hud: ${box(q('.hud'))}`,
    `фон сцены: ${bg ? `${bg.currentSrc || bg.src} (${bg.complete ? (bg.naturalWidth ? 'загружен' : 'ОШИБКА загрузки') : 'ещё грузится'})` : 'нет <img> (арт/запасной фон)'}`,
    `ошибок на странице: ${(window as unknown as { __cf_errs?: string[] }).__cf_errs?.length ?? 0}`,
  ]
  const errs = (window as unknown as { __cf_errs?: string[] }).__cf_errs ?? []
  if (errs.length) lines.push('последние ошибки:', ...errs.map((e) => `  - ${e}`))
  return lines.join('\n')
}

const w = window as unknown as { __cf_errs?: string[] }
w.__cf_errs = []
window.addEventListener('error', (e) => {
  w.__cf_errs!.push(`${e.message} @ ${e.filename?.split('/').pop()}:${e.lineno}`)
  if (w.__cf_errs!.length > 10) w.__cf_errs!.shift()
})

/** метка сборки — видна в консоли и в __cf_diag() */
export const BUILD_STAMP = new Date().toISOString()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ModalHost />
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
