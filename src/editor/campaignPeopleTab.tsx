/**
 * Вкладка «Люди»: расы, портреты героев и реестры персонажей кампании.
 *
 * Вынесено из `CampaignEditor.tsx`: вкладка собирает несколько реестров,
 * страница редактора только переключает её.
 */

import { Ico } from '../shared/icons'
import { BUILTIN_SKILL_LABELS, BUILTIN_STAT_LABELS } from '../shared/skills'
import { makeId } from './ids'
import { askText } from './prompt'
import { SpeciesRegistry } from './campaignSpeciesEditors'
import { NeedCondEditor, RegistryRows } from './campaignRegistryParts'
import { buildSkillBase, parseSkillBase } from './campaignSkillBase'
import type { CampaignTabProps } from './campaignTabProps'

export function CampaignPeopleTab({ store, m, commit }: CampaignTabProps) {
  return (
        <>
      <div className="props-group">
        <h4>Потребности</h4>
        {m.needs.map((n, i) => (
          <div key={i} className="fld-row need-row">
            <label className="fld">
              <span>Название</span>
              <input value={n.label} onChange={(e) => ((n.label = e.target.value), commit())} />
            </label>
            <label className="fld">
              <span>Максимум</span>
              <input type="number" value={n.max} onChange={(e) => ((n.max = Number(e.target.value)), commit())} />
            </label>
            <label className="fld">
              <span>Убыль за тик</span>
              <input type="number" step="0.1" value={n.decay_per_tick} onChange={(e) => ((n.decay_per_tick = Number(e.target.value)), commit())} />
            </label>
            <label className="fld" data-tip="Ниже этого значения полоска подсвечивается красным — предупреждение игроку">
              <span>Тревога ниже</span>
              <input type="number" value={n.critical_threshold} onChange={(e) => ((n.critical_threshold = Number(e.target.value)), commit())} />
            </label>
            <label className="fld" data-tip="Что случится, когда потребность упадёт до нуля">
              <span>При нуле</span>
              <select
                value={n.on_zero_effect ?? 'death'}
                onChange={(e) => ((n.on_zero_effect = e.target.value), commit())}
              >
                <option value="death">Смерть героя</option>
                {store.options('rule').map((r) => (
                  <option key={r.id} value={r.id}>Правило: {r.label}</option>
                ))}
              </select>
            </label>
            <label className="fld" data-tip="Краткое название для компактного отображения в HUD">
              <span>Короткое имя</span>
              <input value={n.short_label ?? ''} onChange={(e) => ((n.short_label = e.target.value || undefined), commit())} placeholder="например: Голод" />
            </label>
            <label className="fld" style={{ flex: 2, minWidth: 220 }} data-tip="Полное описание потребности: игрок видит его в подсказке к полоске">
              <span>Описание (подсказка игроку)</span>
              <input value={n.description ?? ''} onChange={(e) => ((n.description = e.target.value || undefined), commit())} placeholder="например: «Без еды слабеешь: падает урон и внимание»" />
            </label>
            <button className="btn btn-small ce-del" data-tip="Удалить" onClick={() => (m.needs.splice(i, 1), commit())}><Ico n="close" /> </button>
          </div>
        ))}
        {m.needs.map((n, i) => (
          <details key={`cond_${i}`} className="need-conds">
            <summary>
              {n.label}: условия убывания и восстановление
              {n.decay_when?.length ? ` · убывает при ${n.decay_when.length} усл.` : '· убывает всегда'}
              {n.restore_per_tick ? ` · восстанавливается +${n.restore_per_tick}/тик` : ''}
            </summary>
            <div className="fld-block">
              <span className="fld-caption">Убывает, только когда выполнены ВСЕ условия (пусто — убывает всегда)</span>
              <NeedCondEditor
                conds={n.decay_when ?? []}
                store={store}
                commit={commit}
                onChange={(c) => {
                  if (c.length) n.decay_when = c
                  else delete n.decay_when
                  commit()
                }}
              />
            </div>
            <div className="fld-block" style={{ marginTop: 10 }}>
              <label className="fld fld-inline">
                <span>Восстановление за тик (0 — нет)</span>
                <input
                  type="number"
                  min={0}
                  value={n.restore_per_tick ?? 0}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    if (v > 0) n.restore_per_tick = v
                    else {
                      delete n.restore_per_tick
                      delete n.restore_when
                    }
                    commit()
                  }}
                />
              </label>
              {!!n.restore_per_tick && (
                <>
                  <span className="fld-caption">…когда выполнены ВСЕ условия (пусто — всегда)</span>
                  <NeedCondEditor
                    conds={n.restore_when ?? []}
                    store={store}
                    commit={commit}
                    onChange={(c) => {
                      if (c.length) n.restore_when = c
                      else delete n.restore_when
                      commit()
                    }}
                  />
                </>
              )}
            </div>
          </details>
        ))}
        <button
          className="btn btn-small"
          onClick={async () => {
            const label = await askText('Название потребности', 'например «Тепло»')
            if (!label) return
            m.needs.push({ id: makeId('need_', label, m.needs.map((x) => x.id)), label, max: 100, decay_per_tick: 1, critical_threshold: 25, on_zero_effect: 'death' })
            commit()
          }}
        >
          + потребность
        </button>
      </div>

      <div className="props-group">
        <h4>Фракции</h4>
        {m.factions!.map((f, i) => (
          <div key={i} className="fld-row need-row">
            <label className="fld">
              <span>Название</span>
              <input value={f.label} onChange={(e) => ((f.label = e.target.value), commit())} />
            </label>
            <label className="fld">
              <span>Описание фракции</span>
              <input value={f.description ?? ''} onChange={(e) => ((f.description = e.target.value || undefined), commit())} />
            </label>
            <label className="fld">
              <span>Отношение к игроку</span>
              <input type="number" value={f.base_disposition} onChange={(e) => ((f.base_disposition = Number(e.target.value)), commit())} />
            </label>
            <label className="fld fld-check" data-tip="Для служебных фракций (дикие твари и т.п.): отношение не имеет смысла, игрок её не увидит">
              <input
                type="checkbox"
                checked={!!f.hidden}
                onChange={(e) => {
                  if (e.target.checked) f.hidden = true
                  else delete f.hidden
                  commit()
                }}
              />
              <span>Скрытая (не показывать в игре)</span>
            </label>
            <button className="btn btn-small ce-del" data-tip="Удалить" onClick={() => (m.factions!.splice(i, 1), commit())}><Ico n="close" /> </button>
          </div>
        ))}
        <button
          className="btn btn-small"
          onClick={async () => {
            const label = await askText('Название фракции', 'например «Гильдия воров»')
            if (!label) return
            m.factions!.push({ id: makeId('faction_', label, m.factions!.map((x) => x.id)), label, base_disposition: 0 })
            commit()
          }}
        >
          + фракция
        </button>
      </div>

      <div className="props-group">
        <h4>Навыки игры</h4>
        <div className="muted small" style={{ marginBottom: 8 }}>
          Единый список навыков кампании: он используется в листе персонажа, в проверках,
          в бою и во всех выпадающих списках редактора.
        </div>
        <div className="fld-row" style={{ flexWrap: 'wrap', marginBottom: 6 }}>
          <div className="fld" style={{ flex: 1, minWidth: 300 }} data-tip="Категории навыков для группировки в листе персонажа: названия видит игрок">
            <span>Категории навыков</span>
            <RegistryRows
              items={m.skill_categories ?? []}
              onChange={(v) => ((m.skill_categories = v.length ? v : undefined), commit())}
              addTitle="Название новой категории навыков"
            />
          </div>
        </div>
        {(m.skills ?? []).map((sk, i) => (
          <div key={i} className="fld-row need-row">
            <label className="fld">
              <span>Название</span>
              <input value={sk.label} onChange={(e) => ((sk.label = e.target.value), commit())} />
            </label>
            {(m.skill_categories?.length ?? 0) > 0 && (
              <label className="fld" data-tip="Категория для группировки в листе персонажа">
                <span>Категория</span>
                <select
                  value={sk.category ?? ''}
                  onChange={(e) => {
                    if (e.target.value) sk.category = e.target.value
                    else delete sk.category
                    commit()
                  }}
                >
                  <option value="">—</option>
                  {(m.skill_categories ?? []).map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </label>
            )}
            {(() => {
              const { fixedNum, statKey, mult } = parseSkillBase(sk.base)
              const availableStats = Object.entries(BUILTIN_STAT_LABELS).map(([id, label]) => ({
                id,
                label: `${id} (${label})`,
              }))
              return (
                <>
                  <label className="fld fld-narrow" data-tip="Базовый шанс без обучения (число в процентах, например 25)">
                    <span>Базовый %</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={fixedNum ?? ''}
                      placeholder="0"
                      onChange={(e) => {
                        const val = e.target.value.trim() === '' ? undefined : Math.max(0, parseInt(e.target.value, 10) || 0)
                        const res = buildSkillBase(val, statKey, mult)
                        if (res === undefined) delete sk.base
                        else sk.base = res
                        commit()
                      }}
                    />
                  </label>
                  <label className="fld" data-tip="Зависимость базового шанса от характеристики (DEX, INT и др.) по желанию">
                    <span>Характеристика</span>
                    <select
                      value={statKey}
                      onChange={(e) => {
                        const nextStat = e.target.value
                        const res = buildSkillBase(fixedNum, nextStat, mult)
                        if (res === undefined) delete sk.base
                        else sk.base = res
                        commit()
                      }}
                    >
                      <option value="">— нет —</option>
                      {availableStats.map((st) => (
                        <option key={st.id} value={st.id}>{st.label}</option>
                      ))}
                    </select>
                  </label>
                  {statKey ? (
                    <label className="fld fld-narrow" data-tip="Множитель характеристики в формуле (например DEX×2)">
                      <span>Множитель</span>
                      <select
                        value={mult}
                        onChange={(e) => {
                          const nextMult = parseInt(e.target.value, 10) || 1
                          const res = buildSkillBase(fixedNum, statKey, nextMult)
                          if (res === undefined) delete sk.base
                          else sk.base = res
                          commit()
                        }}
                      >
                        <option value={1}>×1</option>
                        <option value={2}>×2</option>
                        <option value={3}>×3</option>
                        <option value={4}>×4</option>
                        <option value={5}>×5</option>
                      </select>
                    </label>
                  ) : null}
                </>
              )
            })()}
            <button className="btn btn-small ce-del" data-tip="Удалить" onClick={() => (m.skills!.splice(i, 1), commit())}><Ico n="close" /> </button>
          </div>
        ))}
        <button
          className="btn btn-small"
          onClick={async () => {
            const label = await askText('Название навыка', 'например «Стрельба из лука»')
            if (!label) return
            if (!m.skills) m.skills = []
            // если название совпадает со стандартным — используем стандартный id (у него есть встроенный перевод)
            const builtin = Object.entries(BUILTIN_SKILL_LABELS).find(([, l]) => l.toLowerCase() === label.toLowerCase())?.[0]
            m.skills.push({ id: builtin ?? makeId('skill_', label, m.skills.map((x) => x.id)), label })
            commit()
          }}
        >
          + навык
        </button>
      </div>

      <SpeciesRegistry m={m} store={store} commit={commit} />

        </>
  )
}
