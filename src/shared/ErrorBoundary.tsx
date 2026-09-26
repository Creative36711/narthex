import { Component, type ReactNode } from 'react'

/**
 * Граница ошибок (фидбек 20): вместо «тёмного экрана без объяснений»
 * показываем текст ошибки прямо на экране — его можно прислать разработчику.
 * Подробности одновременно пишутся в консоль (F12 → Консоль).
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error('[chronicle] сбой приложения:', error, info)
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
            {String(this.state.error?.stack ?? this.state.error)}
          </pre>
          <div className="row-buttons" style={{ marginTop: 10 }}>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              Перезапустить страницу
            </button>
          </div>
        </div>
      </div>
    )
  }
}
