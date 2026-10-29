import type { PackMissingDiagnostic } from '../core/pack/registry'

export function PackMissingNotice({ diagnostic, onExit }: {
  diagnostic: PackMissingDiagnostic
  onExit: () => void
}) {
  return (
    <div className="screen-center">
      <section className="panel error-panel" role="alert" aria-labelledby="pack-missing-title">
        <h2 id="pack-missing-title">Этот жанр не поддерживается</h2>
        <p><code>{diagnostic.code}</code></p>
        <p>{diagnostic.message}</p>
        <button className="btn" onClick={onExit}>Вернуться</button>
      </section>
    </div>
  )
}
