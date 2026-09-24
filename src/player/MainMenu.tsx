import { useRef, useState } from 'react'
import type { CampaignData } from '../shared/types'
import { importChroniclePackage, type CampaignIndexEntry } from '../editor/newCampaign'

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
  const [importBusy, setImportBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const doImport = async (file: File) => {
    setImportBusy(true)
    try {
      const entry = await importChroniclePackage(file)
      onImported(entry.id)
      setShowList(false)
    } catch (e) {
      alert(`Не удалось импортировать кампанию: ${e}`)
    } finally {
      setImportBusy(false)
    }
  }

  return (
    <div className="main-menu">
      <div className="main-menu-inner">
        <div className="brand">CHRONICLE FORGE</div>
        <div className="brand-sub">движок тактических визуальных новелл</div>

        <div className="campaign-current">
          <h1 className="campaign-title">{m.title}</h1>
          <p className="campaign-desc">{m.description}</p>
          <div className="menu-buttons">
            <button className="btn btn-primary" onClick={onNewGame}>
              Новый забег
            </button>
            {canContinue && (
              <button className="btn" onClick={onContinue}>
                Продолжить
              </button>
            )}
            <button className="btn" onClick={() => setShowList(true)}>
              📚 Кампании
            </button>
            {onHelp && (
              <button className="btn" onClick={onHelp}>
                ❓ Как играть
              </button>
            )}
            {onEditor && (
              <button className="btn" onClick={onEditor}>
                🛠 Редактор
              </button>
            )}
          </div>
          <div className="menu-meta">
            v{m.version} · автор: {m.author} · движок {m.engine_version}
          </div>
        </div>
      </div>

      {showList && (
        <div className="campaigns-overlay" onClick={() => setShowList(false)}>
          <div className="campaigns-box" onClick={(e) => e.stopPropagation()}>
            <div className="campaigns-head">
              <h2>Кампании</h2>
              <button className="btn btn-small" onClick={() => setShowList(false)}>✕</button>
            </div>
            <div className="campaign-list">
              {campaigns.map((c) => (
                <button
                  key={c.id}
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
              ))}
            </div>
            <div className="campaigns-foot">
              <button className="btn" disabled={importBusy} onClick={() => fileRef.current?.click()}>
                {importBusy ? 'Импорт…' : '📦 Импортировать кампанию (.chronicle)'}
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
