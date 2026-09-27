import { useState } from 'react'
import type { GameEngine } from '../core/engine'
import { Ico } from '../shared/icons'

/**
 * Хроника кампании: мета-прогресс между забегами (аудит B8b).
 * Достижения, метавалюты и магазин постоянных усилений.
 * Видимость и состав реестров решает мастер (meta.metaprogress).
 */
export function MetaPanel({ engine, onClose }: { engine: GameEngine; onClose: () => void }) {
  const metal = engine.campaign.meta.metaprogress
  const st = engine.metaStore()
  const [, force] = useState(0)
  const rerender = () => force((x) => x + 1)

  const currencies = metal?.currencies ?? []
  const unlocks = metal?.unlocks ?? []
  const achievements = engine.achievementStates()

  const counterLabel: Record<string, string> = {
    travels: 'переходов',
    dialogues: 'диалогов',
    ticks_survived: 'тиков прожито',
    kills: 'врагов повержено',
    quests_completed: 'квестов завершено',
  }

  return (
    <div className="overlay panel-overlay" onClick={onClose}>
      <div className="panel side-panel meta-side-panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-header">
          <h2><Ico n="star" />  Хроника</h2>
          <button className="btn btn-small" onClick={onClose}><Ico n="close" /> </button>
        </div>
      {!metal ? (
        <p className="muted">В этой кампании мастер не завёл мета-прогресс между забегами.</p>
      ) : (
        <div className="meta-panel panel-body">
          <div className="meta-summary">
            <div><span>Забегов</span><b>{st.runs}</b></div>
            <div><span>Побед</span><b>{st.victories}</b></div>
            <div><span>Смертей</span><b>{st.deaths}</b></div>
          </div>

          {currencies.length > 0 && (
            <>
              <h4>Накопления хроники</h4>
              <div className="meta-currencies">
                {currencies.map((c) => (
                  <div key={c.id} className="meta-currency" data-tip={c.description || undefined}>
                    <b>{c.label}</b>
                    <span>{st.currencies[c.id] ?? 0}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {unlocks.length > 0 && (
            <>
              <h4>Постоянные усиления</h4>
              <ul className="meta-unlocks">
                {unlocks.map((u) => {
                  const owned = engine.metaUnlockOwned(u.id)
                  const afford = engine.metaUnlockAffordable(u)
                  return (
                    <li key={u.id} className={owned ? 'owned' : ''} data-tip={u.description || undefined}>
                      <div className="meta-unlock-info">
                        <b>{u.label}</b>
                        <span className="meta-unlock-cost">
                          {owned
                            ? 'записано в хронику'
                            : u.cost.map((c) => `${c.amount} ${(currencies.find((x) => x.id === c.currency)?.label ?? c.currency).toLowerCase()}`).join(' + ')}
                        </span>
                      </div>
                      {!owned && (
                        <button
                          className="btn btn-small"
                          disabled={!afford}
                          onClick={() => { engine.buyMetaUnlock(u.id); rerender() }}
                        >
                          Купить
                        </button>
                      )}
                      {owned && <Ico n="star" />}
                    </li>
                  )
                })}
              </ul>
            </>
          )}

          <h4>Достижения ({achievements.filter((a) => a.done).length} из {achievements.length})</h4>
          {achievements.length === 0 && <p className="muted">Достижений пока нет — мастер не завёл реестр.</p>}
          <ul className="meta-achievements">
            {achievements.map(({ def, done, progress, target }) => (
              <li key={def.id} className={done ? 'done' : 'locked'} data-tip={def.description || undefined}>
                <span className="meta-ach-icon"><Ico n={done ? 'star' : 'lock'} /></span>
                <div className="meta-ach-info">
                  <b>{def.label}</b>
                  {!done && progress != null && target != null && (
                    <span className="meta-ach-progress">{Math.min(progress, target)}/{target} {counterLabel[def.counter!.stat] ?? ''}</span>
                  )}
                  {done && def.reward?.currency && (
                    <span className="meta-ach-reward">
                      +{def.reward.amount} {(currencies.find((c) => c.id === def.reward?.currency)?.label ?? def.reward.currency).toLowerCase()}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {(st.counters.kills ?? 0) > 0 || (st.counters.travels ?? 0) > 0 ? (
            <>
              <h4>За все забеги</h4>
              <div className="meta-totals muted">
                {(['travels', 'dialogues', 'kills', 'quests_completed', 'ticks_survived'] as const)
                  .map((k) => ({ k, v: st.counters[k] ?? 0 }))
                  .filter((x) => x.v > 0)
                  .map((x) => `${counterLabel[x.k]}: ${x.v}`)
                  .join(' · ')}
              </div>
            </>
          ) : null}
        </div>
      )}
      </div>
    </div>
  )
}
