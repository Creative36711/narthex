/**
 * Вкладка «Механики»: тумблеры систем кампании и боевые сводки паспорта.
 *
 * Вынесено из `CampaignEditor.tsx`: у вкладки свои подписи и подсказки, страница
 * редактора только переключает её.
 */

import { FEATURE_TOGGLES } from './campaignRegistryData'
import type { CampaignTabProps } from './campaignTabProps'

export function CampaignMechanicsTab({ m, commit }: CampaignTabProps) {
  return (
        <div className="props-group">
          <h4>New Game+: повторный забег с наследием</h4>
          <div className="muted small" style={{ marginBottom: 8 }}>
            Победивший герой может начать забег заново, сохранив часть накопленного.
            Каждый такой «круг» ужесточает мир на заданные шаги — до бесконечности.
            Выключено (по умолчанию) — финал означает финал.
          </div>
          <div className="fld-row">
            <label className="fld fld-check">
              <input
                type="checkbox"
                checked={!!m.new_game_plus}
                onChange={(e) => { if (e.target.checked) m.new_game_plus = {}; else delete m.new_game_plus; commit() }}
              />
              <span>New Game+ разрешён</span>
            </label>
          </div>
          {m.new_game_plus && (() => {
            const ng = m.new_game_plus!
            const ALL_KEEPS: Array<{ id: string; label: string }> = [
              { id: 'skills', label: 'Навыки' },
              { id: 'skill_marks', label: 'Галочки роста' },
              { id: 'stats', label: 'Характеристики и запасы здоровья/каналы' },
              { id: 'inventory', label: 'Инвентарь и экипировка' },
              { id: 'feats', label: 'Опыт, уровень и черты' },
              { id: 'prepared', label: 'Подготовленные способности' },
            ]
            const keep = new Set(ng.keep ?? ALL_KEEPS.map((k) => k.id))
            const toggleKeep = (id: string, on: boolean) => {
              const next = new Set(keep)
              if (on) next.add(id)
              else next.delete(id)
              ng.keep = next.size === ALL_KEEPS.length ? undefined : [...next]
              commit()
            }
            const boost = ng.boost ?? {}
            const setBoost = (key: 'enemy_damage_step' | 'need_decay_step' | 'prices_step', v: number | undefined) => {
              const next = { ...boost }
              if (v === undefined || v <= 0) delete next[key]
              else next[key] = v
              ng.boost = Object.keys(next).length ? next : undefined
              commit()
            }
            return (
              <div className="panel" style={{ padding: 8 }}>
                <label className="fld" style={{ maxWidth: 320 }}>
                  <span>Подпись кнопки на экране финала</span>
                  <input
                    value={ng.label ?? ''}
                    placeholder="Новая игра+"
                    onChange={(e) => { ng.label = e.target.value || undefined; commit() }}
                  />
                </label>
                <div style={{ margin: '8px 0 4px' }}>Что переносится герой в новый круг:</div>
                <div className="fld-row" style={{ flexWrap: 'wrap' }}>
                  {ALL_KEEPS.map((k) => (
                    <label key={k.id} className="fld fld-check">
                      <input type="checkbox" checked={keep.has(k.id)} onChange={(e) => toggleKeep(k.id, e.target.checked)} />
                      <span>{k.label}</span>
                    </label>
                  ))}
                </div>
                <div style={{ margin: '8px 0 4px' }}>Ужесточение мира за каждый круг (поверх выбранной сложности):</div>
                <div className="fld-row" style={{ flexWrap: 'wrap' }}>
                  <label className="fld" data-tip="+N% к урону врагов за каждый круг (0 — не менять)">
                    <span>Урон врагов, %/круг</span>
                    <input type="number" min={0} max={200} value={Math.round((boost.enemy_damage_step ?? 0) * 100)} onChange={(e) => setBoost('enemy_damage_step', (+e.target.value || 0) / 100)} />
                  </label>
                  <label className="fld" data-tip="+N% к расходу потребностей за каждый круг">
                    <span>Расход потребностей, %/круг</span>
                    <input type="number" min={0} max={200} value={Math.round((boost.need_decay_step ?? 0) * 100)} onChange={(e) => setBoost('need_decay_step', (+e.target.value || 0) / 100)} />
                  </label>
                  <label className="fld" data-tip="+N% к ценам за каждый круг">
                    <span>Цены, %/круг</span>
                    <input type="number" min={0} max={200} value={Math.round((boost.prices_step ?? 0) * 100)} onChange={(e) => setBoost('prices_step', (+e.target.value || 0) / 100)} />
                  </label>
                </div>
              </div>
            )
          })()}

          <h4>Профиль механик кампании</h4>
          <p className="muted small">
            Всё включено по умолчанию. Снимите галочку, чтобы убрать подсистему из этой
            кампании — и из движка, и из интерфейса игрока.
          </p>
          {FEATURE_TOGGLES.map((f) => {
            const on = m.features?.[f.key] !== false
            return (
              <label key={f.key} className="fld feature-toggle">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={(e) => {
                    m.features = { ...(m.features ?? {}), [f.key]: e.target.checked }
                    commit()
                  }}
                />
                <span>
                  <b>{f.label}</b>
                  <div className="muted small">{f.hint}</div>
                </span>
              </label>
            )
          })}

          <h4>Грузоподъёмность и перегруз</h4>
          <p className="muted small">
            Настройка формулы переноски груза и последствий перегруза для героя. По умолчанию используется классическая формула BRP (STR + SIZ кг).
          </p>
          {(() => {
            const enc = m.encumbrance ?? {}
            const enabled = enc.enabled !== false
            const formula = enc.formula ?? 'str_siz_sum'
            const travelPenalty = enc.travel_penalty !== false
            const updateEnc = (patch: Partial<NonNullable<typeof m.encumbrance>>) => {
              m.encumbrance = { ...enc, ...patch }
              commit()
            }
            return (
              <div className="panel" style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label className="fld fld-check">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => updateEnc({ enabled: e.target.checked })}
                  />
                  <span>
                    <b>Учитывать перегруз и штрафы за переносимый вес</b>
                  </span>
                </label>

                {enabled && (
                  <>
                    <div className="fld-row" style={{ flexWrap: 'wrap' }}>
                      <label className="fld" style={{ minWidth: 260 }}>
                        <span>Базовая формула грузоподъёмности</span>
                        <select
                          value={formula}
                          onChange={(e) => updateEnc({ formula: e.target.value as any })}
                        >
                          <option value="str_siz_sum">STR + SIZ (кг) — классика BRP / РунКвест</option>
                          <option value="str_x2">STR × 2 (кг) — упор на чистую силу</option>
                          <option value="siz_x2">SIZ × 2 (кг) — упор на габариты тела</option>
                          <option value="str_plus_half_siz">STR + (SIZ / 2) (кг)</option>
                          <option value="fixed">Фиксированное значение (кг)</option>
                        </select>
                      </label>

                      {formula === 'fixed' && (
                        <label className="fld" style={{ width: 140 }}>
                          <span>Базовый лимит, кг</span>
                          <input
                            type="number"
                            min={1}
                            value={enc.base_capacity ?? 25}
                            onChange={(e) => updateEnc({ base_capacity: Number(e.target.value) || 25 })}
                          />
                        </label>
                      )}
                    </div>

                    <div className="fld-row" style={{ flexWrap: 'wrap', marginTop: 4 }}>
                      <label className="fld fld-check" style={{ width: '100%' }}>
                        <input
                          type="checkbox"
                          checked={travelPenalty}
                          onChange={(e) => updateEnc({ travel_penalty: e.target.checked })}
                        />
                        <span>Штрафы на путешествия по карте при перегрузе (увеличение времени пути / блокировка)</span>
                      </label>
                    </div>

                    {travelPenalty && (
                      <div className="fld-row" style={{ flexWrap: 'wrap', gap: 12 }}>
                        <label className="fld" data-tip="Во сколько раз дольше путь при лёгком перегрузе (1.0x - 1.5x)">
                          <span>Замедление (лёгкий перегруз), x</span>
                          <input
                            type="number"
                            step="0.1"
                            min="1.0"
                            max="5.0"
                            value={enc.light_travel_multiplier ?? 1.5}
                            onChange={(e) => updateEnc({ light_travel_multiplier: Number(e.target.value) || 1.5 })}
                          />
                        </label>

                        <label className="fld" data-tip="Во сколько раз дольше путь при тяжёлом перегрузе (1.5x - 2.0x)">
                          <span>Замедление (тяжёлый перегруз), x</span>
                          <input
                            type="number"
                            step="0.1"
                            min="1.0"
                            max="5.0"
                            value={enc.heavy_travel_multiplier ?? 2.0}
                            onChange={(e) => updateEnc({ heavy_travel_multiplier: Number(e.target.value) || 2.0 })}
                          />
                        </label>

                        <label className="fld" data-tip="При превышении лимита более чем в N раз путешествия блокируются (0 — не блокировать)">
                          <span>Критический порог блокировки, x</span>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="10.0"
                            value={enc.critical_threshold ?? 2.0}
                            onChange={(e) => updateEnc({ critical_threshold: Number(e.target.value) || 2.0 })}
                          />
                        </label>
                      </div>
                    )}

                    <div style={{ marginTop: 4 }}>
                      <span className="muted small"><b>Штрафы уклонения в бою:</b> лёгкий: −{enc.light_dodge_penalty ?? 10}%, тяжёлый: −{enc.heavy_dodge_penalty ?? 25}%, критический: −{enc.critical_dodge_penalty ?? 50}%.</span>
                    </div>
                  </>
                )}
              </div>
            )
          })()}
        </div>
  )
}
