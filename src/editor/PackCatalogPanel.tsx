import { CAPABILITY_REGISTRY } from '../core/caps'
import { projectCapabilityMode, type CapabilityMode } from '../core/pack/capability-modes'
import type { EditorStore } from './store'
import { PACK_CATALOG, PROJECT_KIND_CATALOG } from './packCatalog'

export function PackCatalogPanel({ store }: { store: EditorStore }) {
  const kind = PROJECT_KIND_CATALOG.find((entry) => entry.id === store.project.kind)
  const activePack = PACK_CATALOG.find((pack) => pack.id === kind?.pack)
  const availableCaps = activePack?.caps ?? []
  const capabilities = CAPABILITY_REGISTRY.filter((capability) => availableCaps.includes(capability.id))
  const requiredCaps = kind?.requires ?? []
  const code = store.project.code && typeof store.project.code === 'object' && !Array.isArray(store.project.code)
    ? store.project.code as Record<string, unknown>
    : {}
  const codeReady = typeof code.entry === 'string' && code.entry.trim().length > 0

  return (
    <section className="panel" style={{ maxWidth: 1080, margin: '20px auto', padding: 24 }}>
      <h2 style={{ marginTop: 0 }}>Возможности проекта</h2>
      <p className="muted">
        Режимы хранятся в <code>project.json</code>. «Выкл.» оставляет возможности и их данные в проекте,
        но отключает поведение; «Ядро» возвращает штатную систему. Валидаторы продолжают проверять данные во всех режимах.
      </p>
      {!activePack ? (
        <p className="muted">Для типа проекта «{String(store.project.kind ?? 'не указан')}» нет установленного пака с возможностями.</p>
      ) : (
        <div style={{ borderTop: '1px solid var(--line, #8884)', padding: '12px 0 22px' }}>
          <h3 style={{ margin: '4px 0 12px' }}>{activePack.title} · режимы возможностей</h3>
          <div style={{ display: 'grid', gap: 10 }}>
            {capabilities.map((capability) => {
              const mode = projectCapabilityMode(store.project, capability.id)
              const required = requiredCaps.includes(capability.id)
              return (
                <label key={capability.id} className="fld-row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--line, #8884)', paddingBottom: 10 }}>
                  <span>
                    <strong>{capability.title}</strong> <code>{capability.id}</code>
                    <span className="muted small" style={{ display: 'block' }}>{capability.enables}{required ? ' · требуется типу проекта' : ''}</span>
                    {mode === 'off' && <span className="muted small">Данные сохранены; поведение отключено, формы доступны только для чтения.</span>}
                  </span>
                  <select
                    aria-label={`Режим ${capability.title}`}
                    value={mode}
                    onChange={(event) => store.setCapabilityMode(capability.id, event.target.value as CapabilityMode, availableCaps, requiredCaps)}
                  >
                    <option value="core">Ядро</option>
                    <option value="code" disabled={!codeReady}>Код {codeReady ? '' : '(нужен code.entry)'}</option>
                    <option value="off" disabled={required}>Выкл.</option>
                  </select>
                </label>
              )
            })}
          </div>
        </div>
      )}

      <h2>Каталог паков</h2>
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
