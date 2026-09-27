import { useState } from 'react'
import { Ico } from '../shared/icons'
import { askConfirm } from '../shared/modals'
import type { GameEngine } from '../core/engine'
import { listSaveSlots, removeSaveSlot, type SaveSlot, type SaveSlotInfo } from '../core/engine'

/**
 * Панель «Сохранения» (аудит §5.6 п.9): автосейв + ручные слоты игрока.
 * Автосейв — только для загрузки; ручные — записать/загрузить/удалить.
 * Загрузка пересобирает движок наверху (App), здесь только выбор.
 */
export function SavesPanel({
  engine,
  onClose,
  onLoadSlot,
}: {
  engine: GameEngine
  onClose: () => void
  onLoadSlot: (slot: SaveSlot) => void
}) {
  const campaign = engine.campaign
  const [, bump] = useState(0)
  const slots = listSaveSlots(campaign.meta.id, campaign)
  const manualCount = engine.saveSlotsCount()
  const occupied = new Map(slots.map((s) => [String(s.slot), s]))

  const describe = (info: SaveSlotInfo): string => {
    const env = info.envelope
    const date = new Date(env.updated_at ?? env.created_at ?? '')
    const when = Number.isFinite(date.getTime())
      ? date.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
      : 'время неизвестно'
    const ver = env.campaign_version ? ` · кампания ${env.campaign_version}` : ''
    const place = info.location && info.scene ? `${info.location} — ${info.scene}` : info.scene || info.location || ''
    return `${when}${place ? ` · ${place}` : ''}${ver}`
  }

  return (
    <div className="overlay panel-overlay" onClick={onClose}>
      <div className="panel side-panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-header">
          <h2><Ico n="scroll" />  Сохранения</h2>
          <button className="btn btn-small" onClick={onClose}><Ico n="close" /> </button>
        </div>
        <p className="muted small">
          Автосейв движок пишет сам; ручные слоты — честный снимок на всякий случай.
          {manualCount === 0 && ' Мастер кампании запретил ручные слоты — только автосейв.'}
          {manualCount > 0 && engine.campaign.meta.roguelike?.permadeath &&
            ' Пермадет стирает автосейв, ручные слоты переживают забег.'}
        </p>

        {/* автосейв */}
        <div className="save-slot-row">
          <div className="inv-item-main">
            <b>Автосейв</b>
            <div className="muted small">{occupied.get('auto') ? describe(occupied.get('auto')!) : 'ещё не записан'}</div>
          </div>
          <div className="inv-item-side">
            <button
              className="btn btn-small"
              disabled={!occupied.has('auto')}
              onClick={() => onLoadSlot('auto')}
            >
              Загрузить
            </button>
          </div>
        </div>

        {/* ручные слоты */}
        {Array.from({ length: manualCount }, (_, i) => i + 1).map((n) => {
          const info = occupied.get(String(n))
          return (
            <div key={n} className="save-slot-row">
              <div className="inv-item-main">
                <b>Слот {n}</b>
                <div className="muted small">{info ? describe(info) : 'пусто'}</div>
              </div>
              <div className="inv-item-side" style={{ display: 'flex', gap: 6 }}>
                <button
                  className="btn btn-small btn-primary"
                  disabled={!!engine.state.game_over}
                  data-tip="Записать текущий забег в этот слот"
                  onClick={async () => {
                    if (info && !(await askConfirm(`Слот ${n}: перезаписать существующее сохранение?`))) return
                    if (engine.manualSave(n)) bump((x) => x + 1)
                  }}
                >
                  Записать
                </button>
                <button className="btn btn-small" disabled={!info} onClick={() => onLoadSlot(n)}>
                  Загрузить
                </button>
                {info && (
                  <button
                    className="btn btn-small"
                    data-tip="Удалить сохранение из слота"
                    onClick={async () => {
                      if (await askConfirm(`Слот ${n}: удалить сохранение безвозвратно?`)) {
                        removeSaveSlot(campaign.meta.id, n)
                        bump((x) => x + 1)
                      }
                    }}
                  >
                    <Ico n="close" />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
