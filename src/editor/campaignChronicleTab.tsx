/**
 * Вкладка «Хроника» паспорта кампании: вступление, события и связность мира.
 *
 * Вынесено из `CampaignEditor.tsx`: вкладка целиком собирается из полей
 * паспорта и не держит собственного состояния страницы.
 */

import { Ico } from '../shared/icons'
import { ConditionListEditor, EffectListEditor } from './Fields'
import { makeId } from './ids'
import type { CampaignTabProps } from './campaignTabProps'

export function CampaignChronicleTab({ store, m, commit }: CampaignTabProps) {
  return (
        <div className="ce-page">
      <div className="props-group">
        <h4>Хроника: прогресс между забегами</h4>
        <div className="muted small" style={{ marginBottom: 8 }}>
          Необязательный «надзабеговой» слой: достижения, метавалюты и магазин
          постоянных усилений. Включён — в игре в HUD появляется кнопка «Хроника».
          Всё хранится на устройстве игрока отдельной записью между забегами.
        </div>
        <div className="fld-row">
          <label className="fld fld-check">
            <input type="checkbox" checked={!!m.metaprogress} onChange={(e) => { if (e.target.checked) { m.metaprogress = { currencies: [{ id: 'ember', label: 'Угли' }], achievements: [], unlocks: [] } } else { delete m.metaprogress } commit() }} />
            <span>Хроника включена</span>
          </label>
        </div>
        {m.metaprogress && (
          <>
            <h4>Метавалюты</h4>
            <div className="muted small" style={{ marginBottom: 8 }}>
              Копятся между забегами и тратятся в магазине усилений.
            </div>
            {(m.metaprogress.currencies ?? []).map((c, ci) => (
              <div key={c.id} className="fld-row" style={{ alignItems: 'center' }}>
                <input
                  style={{ flex: 1 }}
                  value={c.label}
                  placeholder="Название метавалюты (например «Угли»)"
                  onChange={(e) => { m.metaprogress!.currencies![ci] = { ...c, label: e.target.value }; commit() }}
                />
                <button
                  className="btn btn-small btn-danger"
                  data-tip="Убрать метавалюту (цены контента скинутся на первую по списку)"
                  onClick={() => {
                    m.metaprogress!.currencies = (m.metaprogress!.currencies ?? []).filter((_, j) => j !== ci)
                    if (!(m.metaprogress!.currencies ?? []).length) m.metaprogress!.currencies = [{ id: 'ember', label: 'Угли' }]
                    commit()
                  }}
                ><Ico n="trash" /></button>
              </div>
            ))}
            <div className="fld-row">
              <button className="btn btn-small" onClick={() => { m.metaprogress!.currencies = [...(m.metaprogress!.currencies ?? []), { id: makeId('meta', `валюта ${(m.metaprogress!.currencies?.length ?? 0) + 1}`, (m.metaprogress!.currencies ?? []).map((x) => x.id)), label: '' }]; commit() }}><Ico n="plus" /> метавалюта</button>
            </div>

            <h4 style={{ marginTop: 14 }}>Достижения</h4>
            <div className="muted small" style={{ marginBottom: 8 }}>
              Награды/заметки пути. У каждого — условие спокойствия: либо счётчик
              действий за все забеги, либо условия (как у правил). «Тайное»
              скрытое в хронике, пока не открыто.
            </div>
            <div className="fld-row">
              <button
                className="btn btn-small"
                onClick={() => {
                  m.metaprogress!.achievements = [...(m.metaprogress!.achievements ?? []), { id: makeId('ach', `достижение ${(m.metaprogress!.achievements?.length ?? 0) + 1}`, (m.metaprogress!.achievements ?? []).map((x) => x.id)), label: 'Новое достижение' }]
                  commit()
                }}
              ><Ico n="plus" /> достижение</button>
            </div>
            {(m.metaprogress.achievements ?? []).map((a, ai) => (
              <div key={a.id} className="panel" style={{ padding: 8, marginTop: 6 }}>
                <div className="fld-row">
                  <input style={{ flex: 1 }} value={a.label} placeholder="Название достижения"
                    onChange={(e) => { const arr = [...(m.metaprogress!.achievements ?? [])]; arr[ai] = { ...a, label: e.target.value }; m.metaprogress!.achievements = arr; commit() }} />
                  <button className="btn btn-small btn-danger" onClick={() => { m.metaprogress!.achievements = (m.metaprogress!.achievements ?? []).filter((_, j) => j !== ai); commit() }}><Ico n="trash" /></button>
                </div>
                <div className="fld-row" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
                  <label className="fld fld-check" data-tip="Открывается автоматически, когда сумма действий за все забеги достигнет цели">
                    <input
                      type="checkbox"
                      checked={!!a.counter}
                      onChange={(e) => { const arr = [...(m.metaprogress!.achievements ?? [])]; arr[ai] = { ...a }; if (e.target.checked) arr[ai].counter = { stat: 'kills', target: 10 }; else delete arr[ai].counter; m.metaprogress!.achievements = arr; commit() }}
                    />
                    <span>открывается счётчиком</span>
                  </label>
                  {a.counter && (
                    <>
                      <select
                        value={a.counter.stat}
                        onChange={(e) => { const arr = [...(m.metaprogress!.achievements ?? [])]; arr[ai] = { ...a, counter: { stat: e.target.value as never, target: a.counter?.target ?? 10 } }; m.metaprogress!.achievements = arr; commit() }}
                      >
                        <option value="kills">убийств в бою</option>
                        <option value="travels">переходов между сценами</option>
                        <option value="dialogues">начатых разговоров</option>
                        <option value="ticks_survived">прожитых минут</option>
                        <option value="quests_completed">завершённых квестов</option>
                      </select>
                      <label className="fld" data-tip="Цель: сколько раз нужно выполнить действие (суммарно за все забеги)">
                        <span>цель</span>
                        <input type="number" min={1} value={a.counter.target}
                          onChange={(e) => { const arr = [...(m.metaprogress!.achievements ?? [])]; arr[ai] = { ...a, counter: { stat: a.counter!.stat, target: Math.max(1, +e.target.value || 1) } }; m.metaprogress!.achievements = arr; commit() }} />
                      </label>
                    </>
                  )}
                  <label className="fld fld-check" data-tip="Не показывать в хронике до открытия">
                    <input type="checkbox" checked={!!a.hidden}
                      onChange={(e) => { const arr = [...(m.metaprogress!.achievements ?? [])]; arr[ai] = { ...a, hidden: e.target.checked || undefined }; m.metaprogress!.achievements = arr; commit() }} />
                    <span>тайное</span>
                  </label>
                </div>
                <div className="fld-row" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
                  <span className="fld-label">Награда:</span>
                  <label className="fld">
                    <span>метавалюта</span>
                    <select value={a.reward?.currency ?? ''} onChange={(e) => { const arr = [...(m.metaprogress!.achievements ?? [])]; arr[ai] = { ...a }; if (e.target.value) { arr[ai].reward = { ...(arr[ai].reward ?? {}), currency: e.target.value, amount: arr[ai].reward?.amount ?? 5 } } else if (arr[ai].reward) { delete arr[ai].reward!.currency; delete arr[ai].reward!.amount; if (!Object.keys(arr[ai].reward!).length) delete arr[ai].reward } m.metaprogress!.achievements = arr; commit() }}>
                      <option value="">— не нужна —</option>
                      {(m.metaprogress!.currencies ?? []).map((c) => <option key={c.id} value={c.id}>{c.label || 'Без названия'}</option>)}
                    </select>
                  </label>
                  {a.reward?.currency && (
                    <label className="fld">
                      <span>сумма</span>
                      <input type="number" min={1} value={a.reward.amount ?? 5} onChange={(e) => { const arr = [...(m.metaprogress!.achievements ?? [])]; arr[ai] = { ...a, reward: { ...(arr[ai].reward ?? {}), amount: Math.max(1, +e.target.value || 1) } }; m.metaprogress!.achievements = arr; commit() }} />
                    </label>
                  )}
                  <label className="fld" data-tip="Очки опыта на шаг развития (0 — без опыта)">
                    <span>опыт</span>
                    <input type="number" min={0} value={a.reward?.xp ?? 0} onChange={(e) => { const v = Math.max(0, +e.target.value || 0); const arr = [...(m.metaprogress!.achievements ?? [])]; arr[ai] = { ...a }; if (v > 0) arr[ai].reward = { ...(arr[ai].reward ?? {}), xp: v }; else if (arr[ai].reward) { delete arr[ai].reward!.xp; if (!Object.keys(arr[ai].reward!).length) delete arr[ai].reward } m.metaprogress!.achievements = arr; commit() }} />
                  </label>
                </div>
                <div className="fld-row">
                  <label className="fld fld-check" data-tip="Дополнительные условия (как у правил): открывается, когда все выполнены">
                    <input type="checkbox" checked={!!a.conditions?.length} onChange={(e) => { const arr = [...(m.metaprogress!.achievements ?? [])]; arr[ai] = { ...a }; if (e.target.checked) arr[ai].conditions = [{ type: 'flag_set', flag: '' }]; else delete arr[ai].conditions; m.metaprogress!.achievements = arr; commit() }} />
                    <span>Открытие по условиям забега</span>
                  </label>
                </div>
                {a.conditions?.length ? (
                  <ConditionListEditor
                    store={store}
                    conditions={a.conditions}
                    onChange={(conds) => { const arr = [...(m.metaprogress!.achievements ?? [])]; arr[ai] = { ...a, conditions: conds.length ? conds : undefined }; m.metaprogress!.achievements = arr; commit() }}
                  />
                ) : null}
              </div>
            ))}

            <h4 style={{ marginTop: 14 }}>Магазин постоянных усилений</h4>
            <div className="muted small" style={{ marginBottom: 8 }}>
              Усиления, которые игрок покупает за метавалюту из «Хроники» и получает
              на старте каждого следующего забега.
            </div>
            <div className="fld-row">
              <button
                className="btn btn-small"
                onClick={() => { m.metaprogress!.unlocks = [...(m.metaprogress!.unlocks ?? []), { id: makeId('unlock', 'новое усиление', (m.metaprogress?.unlocks ?? []).map((x) => x.id)), label: 'Новое усиление', cost: [{ currency: m.metaprogress!.currencies?.[0]?.id ?? 'ember', amount: 10 }], grants: [] }]; commit() }}
              ><Ico n="plus" /> усиление</button>
            </div>
            {(m.metaprogress.unlocks ?? []).map((u, ui) => (
              <div key={u.id} className="panel" style={{ padding: 8, marginTop: 6 }}>
                <div className="fld-row">
                  <input value={u.label} onChange={(e) => { const arr = [...(m.metaprogress!.unlocks ?? [])]; arr[ui] = { ...u, label: e.target.value }; m.metaprogress!.unlocks = arr; commit() }} style={{ flex: 1 }} placeholder="Название усиления" />
                  <button className="btn btn-small btn-danger" onClick={() => { m.metaprogress!.unlocks = (m.metaprogress?.unlocks ?? []).filter((_, j) => j !== ui); commit() }}><Ico n="trash" /></button>
                </div>
                <label className="fld" style={{ marginTop: 4 }}>
                  <span>Описание (что игрок получит на старте забега)</span>
                  <input value={u.description ?? ''} onChange={(e) => { const arr = [...(m.metaprogress!.unlocks ?? [])]; arr[ui] = { ...u, description: e.target.value || undefined }; m.metaprogress!.unlocks = arr; commit() }} />
                </label>
                <div className="fld-row" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className="fld-label">Цена:</span>
                  {u.cost.map((c, ci) => (
                    <span key={ci} className="fld-row" style={{ alignItems: 'center', gap: 4 }}>
                      <input type="number" min={1} value={c.amount} style={{ width: 76 }}
                        onChange={(e) => { const arr = [...(m.metaprogress!.unlocks ?? [])]; const cost = [...u.cost]; cost[ci] = { ...c, amount: Math.max(1, +e.target.value || 1) }; arr[ui] = { ...u, cost }; m.metaprogress!.unlocks = arr; commit() }} />
                      <select value={c.currency}
                        onChange={(e) => { const arr = [...(m.metaprogress!.unlocks ?? [])]; const cost = [...u.cost]; cost[ci] = { ...c, currency: e.target.value }; arr[ui] = { ...u, cost }; m.metaprogress!.unlocks = arr; commit() }}>
                        {(m.metaprogress!.currencies ?? []).map((x) => <option key={x.id} value={x.id}>{x.label || 'Без названия'}</option>)}
                      </select>
                      {u.cost.length > 1 && (
                        <button className="btn btn-small" onClick={() => { const arr = [...(m.metaprogress!.unlocks ?? [])]; arr[ui] = { ...u, cost: u.cost.filter((_, j) => j !== ci) }; m.metaprogress!.unlocks = arr; commit() }}><Ico n="close" /></button>
                      )}
                    </span>
                  ))}
                  <button className="btn btn-small" data-tip="Цена в нескольких метавалютах" onClick={() => { const arr = [...(m.metaprogress!.unlocks ?? [])]; arr[ui] = { ...u, cost: [...u.cost, { currency: m.metaprogress!.currencies?.[0]?.id ?? 'ember', amount: 1 }] }; m.metaprogress!.unlocks = arr; commit() }}>+ цена</button>
                </div>
                <span className="fld-label">Что даст на старте каждого забега</span>
                <EffectListEditor
                  store={store}
                  effects={u.grants}
                  onChange={(grants) => { const arr = [...(m.metaprogress!.unlocks ?? [])]; arr[ui] = { ...u, grants }; m.metaprogress!.unlocks = arr; commit() }}
                />
              </div>
            ))}
          </>
        )}
      </div>

        </div>
  )
}
