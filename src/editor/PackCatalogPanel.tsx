import { PACK_CATALOG } from './packCatalog'

export function PackCatalogPanel() {
  return (
    <section className="panel" style={{ maxWidth: 1080, margin: '20px auto', padding: 24 }}>
      <h2 style={{ marginTop: 0 }}>Каталог паков</h2>
      <p className="muted">
        Манифесты и панели загружены из общего реестра <code>packs/registry.json</code>.
        Чтобы добавить пакет, зарегистрируйте его каталог с <code>pack.json</code> — исходники редактора не перечисляют пакеты.
      </p>
      {PACK_CATALOG.map((pack) => (
        <article key={pack.id} style={{ borderTop: '1px solid var(--line, #8884)', padding: '18px 0' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0 }}>{pack.title}</h3>
            <code>{pack.id}</code>
            <span className="muted small">v{pack.version} · runtime: {pack.runtime}</span>
          </div>
          <p className="muted small" style={{ marginBottom: 8 }}>
            Схема данных: <code>{pack.provides.schema}</code> · сейвы: <code>{pack.saves.namespace}</code> v{pack.saves.version}
          </p>
          <div className="fld-row" style={{ alignItems: 'flex-start', gap: 24, flexWrap: 'wrap' }}>
            <div>
              <strong>Панели ({pack.provides.panels.length})</strong>
              <ul>{pack.provides.panels.map((panel) => <li key={panel.id}>{panel.title} · {panel.slot}</li>)}</ul>
            </div>
            <div>
              <strong>Валидаторы ({pack.provides.validators.length})</strong>
              <ul>{pack.provides.validators.map((validator) => <li key={validator.id}>{validator.title} · {validator.severity}</li>)}</ul>
            </div>
            <div>
              <strong>Пробы ({pack.provides.probes.length})</strong>
              <ul>{pack.provides.probes.map((probe) => <li key={probe.id}>{probe.title} · {probe.budget_ms} ms</li>)}</ul>
            </div>
          </div>
        </article>
      ))}
    </section>
  )
}
