import type { CampaignData } from '../shared/types'

interface Props {
  campaign: CampaignData
  canContinue: boolean
  onNewGame: () => void
  onContinue: () => void
  onEditor?: () => void
}

export function MainMenu({ campaign, canContinue, onNewGame, onContinue, onEditor }: Props) {
  const m = campaign.meta
  return (
    <div className="main-menu">
      <div className="main-menu-inner">
        <div className="brand">CHRONICLE FORGE</div>
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
  )
}
