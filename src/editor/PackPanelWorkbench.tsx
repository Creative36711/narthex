import { useMemo, useState } from 'react'
import type { EditorStore } from './store'
import {
  buildPackPanelTabs,
  groupPackPanelTabs,
  packPanelSlotTitle,
  type PackPanelBuildResult,
  type PackPanelTab,
} from './packPanels'

/**
 * Рабочее полотно пака: вкладки собираются из манифеста, а не из кода студии.
 * Компонент не знает ни одного id пака или панели и не содержит логики паков —
 * он показывает то, что объявил установленный пак.
 */

const EMPTY_BUILD: PackPanelBuildResult = { ok: true, tabs: [], diagnostics: [], message: '', hiddenPanels: 0 }

export function PackPanelTabs({ tabs, selected, onSelect }: {
  tabs: readonly PackPanelTab[]
  selected: string | null
  onSelect: (key: string) => void
}) {
  if (tabs.length === 0) return null
  return (
    <div className="ce-tabs pack-panel-tabs" role="tablist" aria-label="Панели пака">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={selected === tab.key}
          className={`ce-tab ${selected === tab.key ? 'on' : ''}`}
          data-panel-id={tab.panelId}
          data-slot={tab.slot}
          data-order={tab.order}
          data-pack-id={tab.packId}
          onClick={() => onSelect(tab.key)}
        >
          {tab.title}
        </button>
      ))}
    </div>
  )
}

export function PackPanelWorkbench({ store }: { store: EditorStore }) {
  const resolution = store.packResolution
  const manifest = resolution && resolution.status === 'ready' ? resolution.manifest : null
  const modes = store.capabilityModes
  const activeCaps = modes && modes.status === 'ready' ? modes.activeCaps : null

  const built = useMemo(
    () => (manifest ? buildPackPanelTabs([manifest], { activeCaps }) : EMPTY_BUILD),
    [manifest, activeCaps],
  )
  const [selected, setSelected] = useState<string | null>(null)
  const current = built.tabs.find((tab) => tab.key === selected) ?? built.tabs[0] ?? null
  const groups = groupPackPanelTabs(built.tabs)

  return (
    <section className="panel pack-panels" data-pack-panels>
      <h2 style={{ marginTop: 0 }}>Панели пака</h2>
      <p className="muted">
        Вкладки собраны из <code>pack.json</code>: id, заголовок, слот, порядок и условия показа приходят
        только из манифеста. Возможность, выключенная в проекте, убирает свою панель целиком.
      </p>

      {!manifest && (
        <p className="muted" data-pack-panels-empty>
          Пак проекта не определён — собирать вкладки не из чего.
        </p>
      )}

      {manifest && !built.ok && (
        <div className="panel error-panel" role="alert" data-pack-panels-error>
          {built.message}
        </div>
      )}

      {manifest && built.ok && built.tabs.length === 0 && (
        <p className="muted" data-pack-panels-empty>
          {built.hiddenPanels > 0
            ? `Все панели (${built.hiddenPanels}) скрыты выключенными возможностями проекта.`
            : 'В манифесте пака нет панелей.'}
        </p>
      )}

      {manifest && built.ok && groups.map((group) => (
        <div className="pack-panel-slot" data-slot={group.slot} key={group.slot}>
          <h3 className="pack-panel-slot-title">{group.title}</h3>
          <PackPanelTabs tabs={group.tabs} selected={current?.key ?? null} onSelect={setSelected} />
        </div>
      ))}

      {manifest && built.ok && current && (
        <article
          className="panel pack-panel-body"
          role="tabpanel"
          data-panel-id={current.panelId}
          data-slot={current.slot}
          key={current.key}
        >
          <h3 style={{ marginTop: 0 }}>{current.title}</h3>
          <dl className="pack-panel-meta">
            <div>
              <dt>Пак</dt>
              <dd>{current.packTitle} · <code>{current.packId}</code></dd>
            </div>
            <div>
              <dt>Панель</dt>
              <dd><code>{current.panelId}</code></dd>
            </div>
            <div>
              <dt>Слот</dt>
              <dd>{packPanelSlotTitle(current.slot)} · <code>{current.slot}</code></dd>
            </div>
            <div>
              <dt>Порядок</dt>
              <dd>{current.order ?? 'без order — после объявленных'}</dd>
            </div>
            <div>
              <dt>Схема данных</dt>
              <dd>{current.schema ? <code>{current.schema}</code> : 'не указана в манифесте'}</dd>
            </div>
            <div>
              <dt>Возможности</dt>
              <dd>
                {current.caps.length === 0
                  ? 'показывается всегда'
                  : current.caps.map((cap) => <code key={cap} className="pack-panel-cap">{cap}</code>)}
              </dd>
            </div>
          </dl>
          <p className="muted small" style={{ marginBottom: 0 }}>
            Содержимое панели подключает сам пак; студия показывает объявленную оболочку и не содержит
            бизнес-логики паков.
          </p>
        </article>
      )}
    </section>
  )
}
