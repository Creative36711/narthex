/**
 * Адаптивные подсказки (фидбек 12): одна общая плашка поверх всего (`position: fixed`),
 * вместо `::after` — она не обрезается контейнерами/сайдбаром и не вылезает за край
 * экрана (у кнопки «Выйти» подсказка уходила вправо и рождала нижний скроллбар).
 * Показываем под элементом; не влезает вниз — над; не влезает вправо/влево — сдвигаем.
 */
let el: HTMLDivElement | null = null
let current: Element | null = null

function ensure(): HTMLDivElement {
  if (!el) {
    el = document.createElement('div')
    el.className = 'ui-tooltip'
    el.style.display = 'none'
    document.body.appendChild(el)
  }
  return el
}

function show(target: Element): void {
  const text = target.getAttribute('data-tip')
  if (!text) return
  const box = ensure()
  box.textContent = text
  box.style.display = 'block'
  // сначала измеряем без привязки
  box.style.left = '0px'
  box.style.top = '0px'
  const b = box.getBoundingClientRect()
  const r = target.getBoundingClientRect()
  const M = 8
  // вертикаль: под элементом, при нехватке места — над
  let top = r.bottom + 8
  if (top + b.height > window.innerHeight - M) top = r.top - b.height - 8
  if (top < M) top = Math.max(M, Math.min(r.bottom + 8, window.innerHeight - b.height - M))
  // горизонтально: по центру, но внутри экрана
  let left = r.left + r.width / 2 - b.width / 2
  left = Math.max(M, Math.min(left, window.innerWidth - b.width - M))
  box.style.top = `${Math.round(top)}px`
  box.style.left = `${Math.round(left)}px`
}

function hide(): void {
  current = null
  if (el) el.style.display = 'none'
}

/** подключить один раз при старте приложения */
export function initTooltips(): void {
  if (typeof window === 'undefined') return
  window.addEventListener('mouseover', (e) => {
    const t = (e.target as Element | null)?.closest?.('[data-tip]')
    if (!t || t === current) return
    current = t
    show(t)
  })
  window.addEventListener('mouseout', (e) => {
    if (!current) return
    const to = (e.relatedTarget as Element | null)?.closest?.('[data-tip]')
    if (to === current) return
    if (to) {
      current = to
      show(to)
    } else {
      hide()
    }
  })
  window.addEventListener('scroll', hide, true)
  window.addEventListener('pointerdown', hide, true)
}
