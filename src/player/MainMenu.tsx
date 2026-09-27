import { Ico } from '../shared/icons'
import { useRef, useState, useEffect } from 'react'
import type { CampaignData } from '../shared/types'
import { askConfirm, showAlert } from '../shared/modals'
import { SettingsPanel } from '../shared/SettingsPanel'
import { importChroniclePackage, type CampaignIndexEntry } from '../editor/newCampaign'
import { setAudioCampaign } from '../shared/audio'
import { refreshMusic, setMenuMode } from '../shared/music'
import { themeBackgroundUrl } from '../shared/theme'
import { assetUrl } from '../core/loader'

interface Props {
  campaign: CampaignData
  campaigns: CampaignIndexEntry[]
  onSelectCampaign: (id: string) => void
  /** кампания импортирована из .chronicle — обновить список и переключиться */
  onImported: (id: string) => void
  canContinue: boolean
  onNewGame: () => void
  onContinue: () => void
  onEditor?: () => void
  onHelp?: () => void
}

/**
 * Главное меню Chronicle Forge (ТЗ 1). Список кампаний открывается
 * отдельным окном по кнопке «Кампании» (фидбек №14): кампаний может быть много.
 * Там же — импорт пакета .chronicle.
 */
export function MainMenu({ campaign, campaigns, onSelectCampaign, onImported, canContinue, onNewGame, onContinue, onEditor, onHelp }: Props) {
  const m = campaign.meta
  const [showList, setShowList] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [importBusy, setImportBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // музыка меню (блок H): menu_music темы (или default_music)
  useEffect(() => {
    setAudioCampaign(campaign)
    setMenuMode(true)
    refreshMusic(null)
    return () => setMenuMode(false)
  }, [campaign])

  const doImport = async (file: File) => {
    setImportBusy(true)
    try {
      const entry = await importChroniclePackage(file)
      onImported(entry.id)
      setShowList(false)
    } catch (e) {
      void showAlert('Не удалось импортировать кампанию', String(e))
    } finally {
      setImportBusy(false)
    }
  }

  // тема кампании (блок 2 ТЗ): фон меню, затемнение, кен-бёрнс, арт-заголовок
  const menuBg = themeBackgroundUrl(campaign, 'menu')
  const menuTheme = m.theme?.menu

  return (
    <div className={`main-menu ${menuBg ? 'with-bg' : ''}`}>
      {menuBg && (
        <>
          <img
            className={`menu-bg ${menuTheme?.ken_burns ? 'ken-burns' : ''}`}
            src={menuBg}
            alt=""
            draggable={false}
          />
          {/* затемнение тоном профиля, а не фиксированным коричневым */}
          <div
            className="menu-dim"
            style={{ background: `color-mix(in srgb, var(--bg-deep) ${Math.round((menuTheme?.dim ?? 0.55) * 100)}%, transparent)` }}
          />
        </>
      )}
      <div className="main-menu-inner">
        <div className="brand-row">
          <span className="brand">
            <Ico n="forge" /> Chronicle Forge
          </span>
        </div>
        <div className="brand-sub">движок тактических визуальных новелл</div>

        <div className="campaign-current">
          {menuTheme?.title_art && (
            <img className="menu-title-art" src={assetUrl(campaign, menuTheme.title_art)} alt={m.title} draggable={false} />
          )}
          <h1 className="campaign-title">{m.title}</h1>
          <p className="campaign-desc">{m.description}</p>
          <div className="menu-buttons">
            <button className="btn btn-primary" onClick={onNewGame}>
              Новый забег
            </button>
            {canContinue && (
              <button className="btn" onClick={onContinue}>
                <Ico n="play" /> Продолжить
              </button>
            )}
          </div>
          <div className="menu-secondary">
            <button className="btn" onClick={() => setShowList(true)}>
              <Ico n="book" /> Кампании
            </button>
            {onHelp && (
              <button className="btn" onClick={onHelp}>
                <Ico n="help" /> Как играть
              </button>
            )}
            <button className="btn" onClick={() => setShowSettings(true)}>
              <Ico n="settings" /> Настройки
            </button>
            {onEditor && (
              <button className="btn" onClick={onEditor}>
                <Ico n="forge" /> Редактор
              </button>
            )}
          </div>
          <div className="menu-meta">
            v{m.version} · автор: {m.author} · движок {m.engine_version}
          </div>
        </div>
      </div>
      <SettingsPanel open={showSettings} onClose={() => setShowSettings(false)} />

      {showList && (
        <div className="campaigns-overlay" onClick={() => setShowList(false)}>
          <div className="campaigns-box" onClick={(e) => e.stopPropagation()}>
            <div className="campaigns-head">
              <h2>Кампании</h2>
              <button className="btn btn-small" onClick={() => setShowList(false)}><Ico n="close" /> </button>
            </div>
            <div className="campaign-list">
              {campaigns.map((c) => (
                <div key={c.id} className="campaign-row">
                  <button
                    className={`campaign-card ${c.id === m.id ? 'on' : ''}`}
                    onClick={() => {
                      onSelectCampaign(c.id)
                      setShowList(false)
                    }}
                  >
                    <span className="campaign-card-title">{c.title}</span>
                    {c.author && <span className="campaign-card-author">{c.author}</span>}
                    {c.description && <span className="campaign-card-desc">{c.description}</span>}
                  </button>
                  <button
                    className="btn btn-small campaign-del"
                    data-tip="Удалить кампанию с диска"
                    onClick={async () => {
                      if (campaigns.length <= 1) {
                        void showAlert('Нельзя удалить последнюю кампанию', 'Сначала создайте или импортируйте другую.')
                        return
                      }
                      if (!(await askConfirm(`Удалить кампанию «${c.title}» безвозвратно?`, 'Удалить навсегда'))) return
                      try {
                        const res = await fetch('/__editor/delete', {
                          method: 'POST',
                          headers: { 'content-type': 'application/json' },
                          body: JSON.stringify({ path: c.id }),
                        })
                        if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
                        const next = campaigns.filter((x) => x.id !== c.id)
                        await fetch('/__editor/save', {
                          method: 'POST',
                          headers: { 'content-type': 'application/json' },
                          body: JSON.stringify({ path: 'campaigns/index.json', text: JSON.stringify(next, null, 2) }),
                        })
                        // обновить реестр; если удалили открытую кампанию — переключиться
                        onImported(c.id === m.id && next[0] ? next[0].id : m.id)
                      } catch (err) {
                        void showAlert('Не удалось удалить кампанию', `${err}\n(Удаление работает в dev-режиме vite / Tauri.)`)
                      }
                    }}
                  >
                    <Ico n="trash" /> 
                  </button>
                </div>
              ))}
            </div>
            <div className="campaigns-foot">
              <button className="btn" disabled={importBusy} onClick={() => fileRef.current?.click()}>
                {importBusy ? 'Импорт…' : <><Ico n="doc" /> Импортировать кампанию (.chronicle)</>}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".chronicle,.zip"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void doImport(f)
                  e.target.value = ''
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
