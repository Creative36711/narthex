/**
 * Вкладка «Создание героя»: происхождения, навыки, характеристики и шаблоны.
 *
 * Вынесено из `CampaignEditor.tsx`: у вкладки свои строки и предпросмотр,
 * страница редактора только показывает её.
 */

import { Ico } from '../shared/icons'
import { DiceNotationInput } from './Fields'
import { makeId } from './ids'
import { askText } from './prompt'
import { ChipMultiSelect } from './campaignDiceEditors'
import { HeroPortraitsEditor } from './campaignSpeciesEditors'
import type { CampaignTabProps } from './campaignTabProps'

export function CampaignCreationTab({ store, m, commit }: CampaignTabProps) {
  return (
        <>
      <div className="props-group">
        <h4>Создание персонажа</h4>
        <div className="muted small" style={{ marginBottom: 8 }}>
          Экран перед новым забегом: игрок распределяет характеристики,
          выбирает происхождение и навыки. Выключено — забег стартует
          сразу готовым персонажем-шаблоном.
        </div>
        <label className="fld fld-check">
          <input
            type="checkbox"
            checked={!!m.char_creation}
            onChange={(e) => {
              if (e.target.checked) {
                m.char_creation = {
                  total_points: 30,
                  stat_limits: { min: 3, max: 18 },
                  mandatory_skills: [],
                  forbidden_skills: [],
                }
              } else delete m.char_creation
              commit()
            }}
          />
          <span>Показывать экран создания персонажа</span>
        </label>
        {m.char_creation && (
          <>
            <div className="fld-row" style={{ flexWrap: 'wrap' }}>
              <label className="fld fld-num">
                <span>Бюджет характеристик</span>
                <input type="number" min={0} value={m.char_creation.total_points} onChange={(e) => ((m.char_creation!.total_points = Math.max(0, Number(e.target.value) || 0)), commit())} />
              </label>
              <label className="fld fld-num">
                <span>Характеристика: минимум</span>
                <input type="number" min={1} value={m.char_creation.stat_limits.min} onChange={(e) => ((m.char_creation!.stat_limits.min = Math.max(1, Number(e.target.value) || 1)), commit())} />
              </label>
              <label className="fld fld-num">
                <span>Характеристика: максимум</span>
                <input type="number" min={1} value={m.char_creation.stat_limits.max} onChange={(e) => ((m.char_creation!.stat_limits.max = Math.max(1, Number(e.target.value) || 1)), commit())} />
              </label>
            </div>
            <div className="fld-row" style={{ flexWrap: 'wrap' }}>
              <label className="fld fld-num">
                <span>Бюджет навыков (0 — без него)</span>
                <input
                  type="number" min={0}
                  value={m.char_creation.skill_points ?? 0}
                  onChange={(e) => {
                    const v = Math.max(0, Number(e.target.value) || 0)
                    if (v > 0) m.char_creation!.skill_points = v
                    else delete m.char_creation!.skill_points
                    commit()
                  }}
                />
              </label>
              <label className="fld fld-num">
                <span>Предел навыка сверху (0 — нет)</span>
                <input
                  type="number" min={0}
                  value={m.char_creation.skill_cap ?? 0}
                  onChange={(e) => {
                    const v = Math.max(0, Number(e.target.value) || 0)
                    if (v > 0) m.char_creation!.skill_cap = v
                    else delete m.char_creation!.skill_cap
                    commit()
                  }}
                />
              </label>
              <label className="fld fld-num">
                <span>Предел навыка снизу</span>
                <input
                  type="number" min={0}
                  value={m.char_creation.skill_floor ?? 0}
                  data-tip="Ниже этого значения игрок не сможет опустить навык"
                  onChange={(e) => {
                    const v = Math.max(0, Number(e.target.value) || 0)
                    if (v > 0) m.char_creation!.skill_floor = v
                    else delete m.char_creation!.skill_floor
                    commit()
                  }}
                />
              </label>
            </div>
            <label className="fld fld-check">
              <input type="checkbox" checked={!!m.char_creation.choose_name} onChange={(e) => ((m.char_creation!.choose_name = e.target.checked || undefined), commit())} />
              <span>Игрок вводит имя героя</span>
            </label>
            <label className="fld fld-check">
              <input type="checkbox" checked={!!m.char_creation.choose_age} onChange={(e) => ((m.char_creation!.choose_age = e.target.checked || undefined), commit())} />
              <span>Игрок задаёт возраст</span>
            </label>
            <label className="fld fld-check" data-tip="Короткая предыстория героя своими словами — видна в листе персонажа">
              <input type="checkbox" checked={!!m.char_creation.choose_bio} onChange={(e) => ((m.char_creation!.choose_bio = e.target.checked || undefined), commit())} />
              <span>Игрок пишет биографию</span>
            </label>

            <HeroPortraitsEditor m={m} store={store} commit={commit} />

            <label className="fld fld-check">
              <input
                type="checkbox"
                checked={!!m.char_creation.roll}
                onChange={(e) => {
                  if (e.target.checked) {
                    m.char_creation!.roll = { notation: '3d6', per_stat: { INT: '2d6+6', SIZ: '2d6+6' }, arrays: 1, rerolls: 0, redistribute: 3 }
                  } else delete m.char_creation!.roll
                  commit()
                }}
              />
              <span data-tip="Базовый метод BRP: характеристики бросаются кубиками, а не покупаются за очки. Распределение характеристик происхождений в этом режиме игнорируется.">
                Характеристики — броски кубиков (вместо бюджета очков)
              </span>
            </label>
            {m.char_creation.roll && (
              <div className="fld-row" style={{ flexWrap: 'wrap' }}>
                <DiceNotationInput
                  label="Базовая формула броска"
                  tip="Сколько и каких костей бросается на характеристику по умолчанию"
                  value={m.char_creation.roll.notation ?? '3d6'}
                  onChange={(v) => ((m.char_creation!.roll!.notation = v || '3d6'), commit())}
                />
                <label className="fld fld-num" data-tip="Сколько наборов бросается, игрок выбирает один">
                  <span>Наборов на выбор</span>
                  <input type="number" min={1} value={m.char_creation.roll.arrays ?? 1} onChange={(e) => ((m.char_creation!.roll!.arrays = Math.max(1, Number(e.target.value) || 1)), commit())} />
                </label>
                <label className="fld fld-num" data-tip="Сколько характеристик можно перебросить по одной штуке">
                  <span>Перебросов</span>
                  <input type="number" min={0} value={m.char_creation.roll.rerolls ?? 0} onChange={(e) => ((m.char_creation!.roll!.rerolls = Math.max(0, Number(e.target.value) || 0)), commit())} />
                </label>
                <label className="fld fld-num" data-tip="Очков сверх выброшенного набора для докрутки (BRP: до 3)">
                  <span>Докрутка очков</span>
                  <input type="number" min={0} value={m.char_creation.roll.redistribute ?? 0} onChange={(e) => ((m.char_creation!.roll!.redistribute = Math.max(0, Number(e.target.value) || 0)), commit())} />
                </label>
              </div>
            )}
            {m.char_creation.roll && (
              <div className="fld" style={{ marginBottom: 10 }}>
                <span className="muted small" style={{ display: 'block', marginBottom: 4 }}>
                  Свои формулы по характеристикам (пусто — базовая). BRP: INT и SIZ бросаются 2d6+6.
                </span>
                <div className="fld-row" style={{ flexWrap: 'wrap' }}>
                  {(['STR', 'CON', 'SIZ', 'DEX', 'INT', 'POW', 'CHA'] as const).map((k) => (
                    <div key={k} style={{ maxWidth: 240, minWidth: 190 }}>
                      <DiceNotationInput
                        label={k}
                        compact
                        optional
                        tip="Своя формула броска характеристики (пусто — базовая)"
                        value={m.char_creation!.roll!.per_stat?.[k] ?? ''}
                        onChange={(v) => {
                          const per = { ...(m.char_creation!.roll!.per_stat ?? {}) }
                          if (v.trim()) per[k] = v.trim()
                          else delete per[k]
                          m.char_creation!.roll!.per_stat = Object.keys(per).length ? per : undefined
                          commit()
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* навыки-переключатели: клик по навыку включает/выключает его роль */}
            <div className="fld" style={{ marginBottom: 10 }}>
              <span className="muted small" style={{ display: 'block', marginBottom: 4 }}>
                Обязательные навыки — у любого происхождения стартуют не ниже 25%
              </span>
              <ChipMultiSelect
                options={store.options('skill')}
                value={m.char_creation.mandatory_skills!}
                onChange={(v) => ((m.char_creation!.mandatory_skills = v), commit())}
                emptyLabel="нажмите на навык, чтобы сделать обязательным"
              />
            </div>
            <div className="fld" style={{ marginBottom: 10 }}>
              <span className="muted small" style={{ display: 'block', marginBottom: 4 }}>
                Запрещённые навыки — очки на них тратить нельзя
              </span>
              <ChipMultiSelect
                className="chipset-warn"
                options={store.options('skill')}
                value={m.char_creation.forbidden_skills!}
                onChange={(v) => ((m.char_creation!.forbidden_skills = v), commit())}
                emptyLabel="нажмите на навык, чтобы запретить его"
              />
            </div>

            <h4 style={{ marginTop: 12 }}>Происхождения</h4>
            {(m.char_creation.professions ?? []).map((p, i) => (
              <div key={i} className="prof-card">
                <div className="prof-card-head">
                  <label className="fld"><span>Название</span>
                    <input value={p.label} onChange={(e) => ((p.label = e.target.value), commit())} />
                  </label>
                  <button className="btn btn-small ce-del" data-tip="Удалить происхождение" onClick={() => (m.char_creation!.professions!.splice(i, 1), commit())}><Ico n="close" /></button>
                </div>
                <label className="fld"><span>Описание</span>
                  <input value={p.description ?? ''} onChange={(e) => ((p.description = e.target.value || undefined), commit())} />
                </label>

                <div className="prof-sec">Стартовые характеристики (пустое поле = минимум):</div>
                <div className="prof-stats">
                  {(['STR', 'CON', 'SIZ', 'DEX', 'INT', 'POW', 'CHA'] as const).map((k) => (
                    <label key={k} className="prof-stat" data-tip={`${k}: от ${m.char_creation!.stat_limits.min} до ${m.char_creation!.stat_limits.max}`}>
                      <span>{k}</span>
                      <input
                        type="number"
                        value={p.stats?.[k] ?? ''}
                        placeholder={String(m.char_creation!.stat_limits.min)}
                        onChange={(e) => {
                          const raw = e.target.value.trim()
                          if (raw === '') {
                            if (p.stats) {
                              delete p.stats[k]
                              if (!Object.keys(p.stats).length) delete p.stats
                            }
                          } else {
                            const lim = m.char_creation!.stat_limits
                            ;(p.stats ??= {})[k] = Math.min(lim.max, Math.max(lim.min, Math.round(Number(raw) || lim.min)))
                          }
                          commit()
                        }}
                      />
                    </label>
                  ))}
                </div>

                <div className={`prof-budget ${(() => {
                  const spent = (['STR', 'CON', 'SIZ', 'DEX', 'INT', 'POW', 'CHA'] as const).reduce((t, k) => t + Math.max(0, (p.stats?.[k] ?? m.char_creation!.stat_limits.min) - m.char_creation!.stat_limits.min), 0)
                  return spent === m.char_creation!.total_points ? 'ok' : 'warn'
                })()}`}
                >
                  Распределено характеристик:{' '}
                  {(['STR', 'CON', 'SIZ', 'DEX', 'INT', 'POW', 'CHA'] as const).reduce((t, k) => t + Math.max(0, (p.stats?.[k] ?? m.char_creation!.stat_limits.min) - m.char_creation!.stat_limits.min), 0)}{' '}
                  из {m.char_creation!.total_points} — мастер обязан распределить весь бюджет
                </div>

                <div className="prof-sec">Бонусы к навыкам (бесплатно поверх бюджета):</div>
                {Object.entries(p.skill_bonus).map(([sk, v]) => (
                  <div className="prof-line" key={sk}>
                    <span className="prof-line-label">{store.labelFor('skill', sk)}</span>
                    <input className="fld-num" type="number" value={v}
                      onChange={(e) => ((p.skill_bonus[sk] = Number(e.target.value) || 0), commit())} />
                    <button className="btn btn-small ce-del" data-tip="Убрать бонус" onClick={() => (delete p.skill_bonus[sk], commit())}><Ico n="close" /></button>
                  </div>
                ))}
                <select value="" onChange={(e) => {
                  const id = e.target.value
                  if (id) (p.skill_bonus[id] = p.skill_bonus[id] ?? 5, commit())
                }}>
                  <option value="">+ бонус навыку…</option>
                  {store.options('skill').map((s) => (<option key={s.id} value={s.id}>{s.label}</option>))}
                </select>

                <div className="prof-sec">Стартовое снаряжение:</div>
                {(p.items ?? []).map((it, j) => (
                  <div className="prof-line" key={j}>
                    <span className="prof-line-label">{store.labelFor('item', it.item)}</span>
                    <input type="number" min={1} value={it.quantity}
                      onChange={(e) => ((it.quantity = Math.max(1, Number(e.target.value) || 1)), commit())} />
                    <button className="btn btn-small ce-del" data-tip="Убрать предмет" onClick={() => ((p.items = p.items!.filter((_, x) => x !== j)), commit())}><Ico n="close" /></button>
                  </div>
                ))}
                <select value="" onChange={(e) => {
                  const id = e.target.value
                  if (id) ((p.items ??= []).push({ item: id, quantity: 1 }), commit())
                }}>
                  <option value="">+ предмет…</option>
                  {store.options('item').map((s) => (<option key={s.id} value={s.id}>{s.label}</option>))}
                </select>
              </div>
            ))}
            <button className="btn btn-small" onClick={async () => {
              const label = await askText('Название происхождения', 'например «Солдат»')
              if (!label) return
              if (!m.char_creation!.professions) m.char_creation!.professions = []
              m.char_creation!.professions.push({ id: makeId('profession_', label, m.char_creation!.professions.map((x) => x.id)), label, skill_bonus: {} })
              commit()
            }}>+ происхождение</button>

            <h4 style={{ marginTop: 12 }}>Призвания</h4>
            <div className="muted small" style={{ marginBottom: 8 }}>
              Второй шаблон создания героя: происхождение распределяет характеристики,
              призвание — стартовые НАВЫКИ. Мастер обязан распределить ВЕСЬ бюджет
              навыков; игрок после выбора может убавлять значения под себя.
            </div>
            {(m.char_creation.callings ?? []).map((c, i) => {
              const floorOf = (id: string) =>
                Math.max(m.char_creation!.skill_floor ?? 0, (m.char_creation!.mandatory_skills ?? []).includes(id) ? 25 : 0)
              const budget = m.char_creation!.skill_points ?? 0
              const spent = Object.entries(c.skills).reduce((t, [id, v]) => t + Math.max(0, v - floorOf(id)), 0)
              const okBudget = budget === 0 || spent === budget
              return (
                <div key={i} className="prof-card">
                  <div className="prof-card-head">
                    <label className="fld"><span>Название</span>
                      <input value={c.label} onChange={(e) => ((c.label = e.target.value), commit())} />
                    </label>
                    <button className="btn btn-small ce-del" data-tip="Удалить призвание" onClick={() => (m.char_creation!.callings!.splice(i, 1), commit())}><Ico n="close" /></button>
                  </div>
                  <label className="fld"><span>Описание</span>
                    <input value={c.description ?? ''} onChange={(e) => ((c.description = e.target.value || undefined), commit())} />
                  </label>

                  <div className="prof-sec">Стартовые навыки (абсолютные проценты):</div>
                  {Object.entries(c.skills).sort((a, b) => store.labelFor('skill', a[0]).localeCompare(store.labelFor('skill', b[0]), 'ru')).map(([sk, v]) => (
                    <div className="prof-line" key={sk}>
                      <span className="prof-line-label">{store.labelFor('skill', sk)}</span>
                      <input
                        className="fld-num" type="number" min={floorOf(sk)}
                        max={m.char_creation!.skill_cap}
                        value={v}
                        onChange={(e) => {
                          let nv = Math.round(Number(e.target.value) || 0)
                          nv = Math.max(floorOf(sk), nv)
                          const cap = m.char_creation!.skill_cap
                          if (cap !== undefined) nv = Math.min(nv, cap)
                          c.skills[sk] = nv
                          commit()
                        }}
                      />
                      <button className="btn btn-small ce-del" data-tip="Убрать навык" onClick={() => (delete c.skills[sk], commit())}><Ico n="close" /></button>
                    </div>
                  ))}
                  <select value="" onChange={(e) => {
                    const id = e.target.value
                    if (id) (c.skills[id] = Math.min(floorOf(id) + 10, m.char_creation!.skill_cap ?? Number.MAX_SAFE_INTEGER), commit())
                  }}>
                    <option value="">+ навык…</option>
                    {store.options('skill').map((x) => (<option key={x.id} value={x.id} disabled={c.skills[x.id] !== undefined}>{x.label}</option>))}
                  </select>

                  <div className={`prof-budget ${okBudget ? 'ok' : 'warn'}`}>
                    Распределено навыков: {spent} из {budget || '—'}
                    {!okBudget && ' — мастер обязан распределить весь бюджет'}
                  </div>
                </div>
              )
            })}
            <button className="btn btn-small" onClick={async () => {
              const label = await askText('Название призвания', 'например «Наёмник»')
              if (!label) return
              if (!m.char_creation!.callings) m.char_creation!.callings = []
              m.char_creation!.callings.push({ id: makeId('calling_', label, m.char_creation!.callings.map((x) => x.id)), label, skills: {} })
              commit()
            }}>+ призвание</button>
          </>
        )}
      </div>
        </>
  )
}
