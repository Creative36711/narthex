import type { CampaignData } from '../shared/types'
import type { CampaignIndexEntry } from '../editor/newCampaign'

interface Props {
  campaign: CampaignData
  campaigns: CampaignIndexEntry[]
  onSelectCampaign: (id: string) => void
  canContinue: boolean
  onNewGame: () => void
  onContinue: () => void
  onEditor?: () => void
  onHelp?: () => void
}

/**
 * Главное меню Chronicle Forge: платформа кампаний (ТЗ 1) —
 * слева список кампаний, справа выбранная и действия.
 */
export function MainMenu({ campaign, campaigns, onSelectCampaign, canContinue, onNewGame, onContinue, onEditor, onHelp }: Props) {
  const m = campaign.meta
  const many = campaigns.length > 1
  return (
    <div className="main-menu">
      <div className={`main-menu-inner ${many ? 'with-list' : ''}`}>
        <div className="brand">CHRONICLE FORGE</div>
        <div className="brand-sub">движок тактических визуальных новелл</div>

        <div className="menu-columns">
          {many && (
            <div className="campaign-list">
              <div className="campaign-list-title">Кампании</div>
              {campaigns.map((c) => (
                <button
                  key={c.id}
                  className={`campaign-card ${c.id === m.id ? 'on' : ''}`}
                  onClick={() => onSelectCampaign(c.id)}
                >
                  <span className="campaign-card-title">{c.title}</span>
                  {c.author && <span className="campaign-card-author">{c.author}</span>}
                </button>
              ))}
            </div>
          )}

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
      </div>
    </div>
  )
}
