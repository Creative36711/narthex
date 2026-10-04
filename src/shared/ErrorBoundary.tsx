import { Component, type ReactNode } from 'react'

/**
 * Граница ошибок (фидбек 20): вместо «тёмного экрана без объяснений»
 * показываем текст ошибки прямо на экране — его можно прислать разработчику.
 * Подробности одновременно пишутся в консоль (F12 → Консоль).
 * Текст сбоя копируется одной кнопкой (фидбек 26): вручную выделять простыню
 * со стек-трейсом — верный способ прислать его обрезанным.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null; copied: boolean }> {
  state = { error: null as Error | null, copied: false }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error('[chronicle] сбой приложения:', error, info)
  }

  private errorText(): string {
    const e = this.state.error
    return String(e?.stack ?? e)
  }

  private copy = async (): Promise<void> => {
    const text = this.errorText()
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // браузер без clipboard API (или запрет прав): старый добрый textarea
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try {
        document.execCommand('copy')
      } finally {
        ta.remove()
      }
    }
    this.setState({ copied: true })
    window.setTimeout(() => this.setState({ copied: false }), 2000)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="screen-center" style={{ padding: 20 }}>
        <div className="panel error-panel" style={{ maxWidth: 680, padding: 18 }}>
          <h2>Игра столкнулась с ошибкой</h2>
          <p className="muted">
            Экран потемнел не просто так: ниже текст сбоя. Пришлите его разработчику —
            а пока перезапустите страницу.
          </p>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#ff9c8a', fontSize: 12, maxHeight: 260, overflow: 'auto' }}>
            {this.errorText()}
          </pre>
          <div className="row-buttons" style={{ marginTop: 10 }}>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              Перезапустить страницу
            </button>
            <button className="btn" onClick={() => void this.copy()} data-tip="Скопировать текст сбоя целиком">
              {this.state.copied ? 'Скопировано' : 'Скопировать текст ошибки'}
            </button>
          </div>
        </div>
      </div>
    )
  }
}
