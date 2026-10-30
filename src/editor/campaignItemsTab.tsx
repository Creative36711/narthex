/**
 * Вкладка «Предметы»: типы слотов сцены, слоты экипировки, календарь и погода.
 *
 * Вынесено из `CampaignEditor.tsx`: реестры предметной части кампании; концовки
 * и категории предметов вынесены в соседнюю секцию.
 */

import { Ico } from '../shared/icons'
import { makeId } from './ids'
import { ParticleListEditor } from './AtmosEditors'
import { askText } from './prompt'
import { SoundHookMapEditor } from './AudioSection'
import { SkillDeltaRows } from './campaignRegistryParts'
import type { CampaignTabProps } from './campaignTabProps'
import { CampaignItemsExtras } from './campaignItemsExtras'

export function CampaignItemsTab({ store, m, commit }: CampaignTabProps) {
  return (
        <>
      <div className="props-group">
        <h4>Типы слотов сцены</h4>
        <div className="muted small" style={{ marginBottom: 8 }}>
          Что можно ставить в слоты на сценах. Каждой сущности назначается тип
          в её карточке — по нему фильтруется выбор «кто/что стоит в слоте».
          Встроенных типов нет — добавьте свои: «Персонаж», «Предмет»,
          «Мебель», «Робот», «Дух»… любые, какие нужны вашей истории.
        </div>
        {(m.slot_types ?? []).map((t, i) => (
          <div key={i} className="fld-row need-row">
            <label className="fld">
              <span>Название</span>
              <input value={t.label} onChange={(e) => ((t.label = e.target.value), commit())} />
            </label>
            <details style={{ flex: '1 1 100%' }}>
              <summary><Ico n="sound" />  Звуки действий предметов в этом типе слота</summary>
              <SoundHookMapEditor
                store={store}
                value={t.sounds ?? (t.sounds = {})}
                onChange={commit}
                heading="Звуки действий (для этого типа слота)"
              />
            </details>
            <button className="btn btn-small ce-del" data-tip="Удалить" onClick={() => (m.slot_types!.splice(i, 1), commit())}><Ico n="close" /> </button>
          </div>
        ))}
        <button
          className="btn btn-small"
          onClick={async () => {
            const label = await askText('Название типа слота', 'например «Робот»')
            if (!label) return
            if (!m.slot_types) m.slot_types = []
            m.slot_types.push({ id: makeId('slot_', label, m.slot_types.map((x) => x.id)), label })
            commit()
          }}
        >
          + тип слота
        </button>
      </div>

      <div className="props-group">
        <h4>Слоты экипировки</h4>
        <div className="muted small" style={{ marginBottom: 8 }}>
          Куда персонаж надевает предметы. Встроенных слотов нет — создайте
          свои: «Оружие», «Броня», «Амулет», «Имплант»… Броня всех надетых
          слотов суммируется в бою.
        </div>
        {(m.equipment_slots ?? []).map((s, i) => (
          <div key={i} className="fld-row need-row">
            <label className="fld">
              <span>Название</span>
              <input value={s.label} onChange={(e) => ((s.label = e.target.value), commit())} />
            </label>
            <button className="btn btn-small ce-del" data-tip="Удалить" onClick={() => (m.equipment_slots!.splice(i, 1), commit())}><Ico n="close" /> </button>
          </div>
        ))}
        <button
          className="btn btn-small"
          onClick={async () => {
            const label = await askText('Название слота экипировки', 'например «Амулет»')
            if (!label) return
            if (!m.equipment_slots) m.equipment_slots = []
            m.equipment_slots.push({ id: makeId('slot_', label, m.equipment_slots.map((x) => x.id)), label })
            commit()
          }}
        >
          + слот экипировки
        </button>
      </div>

      <div className="props-group">
        <h4>Календарь</h4>
        <div className="muted small" style={{ marginBottom: 8 }}>
          Свои месяцы и дни недели: дата появится в игре под часами. Названия
          пишутся через запятую и циклятся. Без календаря — обычные «День N».
        </div>
        <div className="fld-row" style={{ flexWrap: 'wrap' }}>
          <label className="fld">
            <span>Название летоисчисления</span>
            <input
              value={m.calendar?.year_label ?? ''}
              placeholder="например «Летопись Каэрдена»"
              onChange={(e) => {
                if (!m.calendar) m.calendar = {}
                if (e.target.value) m.calendar.year_label = e.target.value
                else delete m.calendar.year_label
                commit()
              }}
            />
          </label>
          <label className="fld">
            <span>Начальный год</span>
            <input
              type="number"
              value={m.calendar?.start_year ?? 1}
              onChange={(e) => {
                if (!m.calendar) m.calendar = {}
                m.calendar.start_year = Number(e.target.value) || 1
                commit()
              }}
            />
          </label>
          <label className="fld">
            <span>Дней в месяце</span>
            <input
              type="number"
              value={m.calendar?.days_per_month ?? 30}
              onChange={(e) => {
                if (!m.calendar) m.calendar = {}
                m.calendar.days_per_month = Math.max(1, Number(e.target.value) || 30)
                commit()
              }}
            />
          </label>
        </div>
        <label className="fld">
          <span>Месяцы (через запятую)</span>
          <input
            value={(m.calendar?.months ?? []).join(', ')}
            placeholder="Верескень, Листопад, Грудень…"
            onChange={(e) => {
              if (!m.calendar) m.calendar = {}
              const months = e.target.value.split(',').map((x) => x.trim()).filter(Boolean)
              if (months.length) m.calendar.months = months
              else delete m.calendar.months
              commit()
            }}
          />
        </label>
        <label className="fld">
          <span>Дни недели (через запятую)</span>
          <input
            value={(m.calendar?.day_names ?? []).join(', ')}
            placeholder="Светодень, Ветродень…"
            onChange={(e) => {
              if (!m.calendar) m.calendar = {}
              const names = e.target.value.split(',').map((x) => x.trim()).filter(Boolean)
              if (names.length) m.calendar.day_names = names
              else delete m.calendar.day_names
              commit()
            }}
          />
        </label>
        {m.calendar && (
          <button
            className="btn btn-small"
            onClick={() => {
              delete m.calendar
              commit()
            }}
          >
            Убрать календарь
          </button>
        )}
      </div>

      <div className="props-group">
        <h4>Погода</h4>
        <div className="muted small" style={{ marginBottom: 8 }}>
          Типы погоды с визуальным слоем и зацикленными звуками. Погоду меняют
          эффекты «Сменить погоду»; условия «Погода сейчас» доступны правилам,
          слотам и музыке. Список слоёв — целиком ваш: движок умеет рисовать
          дождь, снег, туман и пепел, свои id подключаются классом weather-&lt;id&gt;.
        </div>
        {/* id скрыт от мастера: видно только название, как во всех реестрах */}
        <div className="prof-sec" style={{ marginTop: 0 }}>Слои погоды (реестр кампании):</div>
        {(m.overlay_layers ?? []).map((l, i) => (
          <div className="prof-line" key={i}>
            <span className="prof-line-label">{l.label}</span>
            <button className="btn btn-small ce-del" data-tip="Удалить слой" onClick={() => ((m.overlay_layers = m.overlay_layers!.filter((_, x) => x !== i)), commit())}><Ico n="close" /></button>
          </div>
        ))}
        <button className="btn btn-small" onClick={async () => {
          const label = await askText('Название слоя погоды', 'например «Огненный дождь»')
          if (!label) return
          ;(m.overlay_layers ??= []).push({ id: makeId('overlay_', label, m.overlay_layers.map((x) => x.id)), label })
          commit()
        }}>+ слой погоды</button>
        {(m.overlay_layers ?? []).length === 0 && (
          <div className="muted small" style={{ marginTop: 4 }}>Без реестра селект «Слой» у погоды будет пустым.</div>
        )}
        <h4 style={{ marginTop: 10 }}>Мастерская спецэффектов (слои из файлов)</h4>
        <div className="muted small" style={{ marginBottom: 6 }}>
          Атмосферные слои из картинки-«частицы»: дождь из собственного файла, листопад,
          пыль, искры, мухи, туманная взвесь. Ключ слоя вписывается в поле «Слой» у погоды
          ниже — движок сам его отрисует поверх сцены. Встроенные слои rain/snow/fog/ash работают без реестра.
        </div>
        <ParticleListEditor list={m.atmospherics ?? (m.atmospherics = [])} store={store} commit={commit} />

        {(m.weathers ?? []).map((w, i) => (
          <div key={i} className="props-group" style={{ border: '1px solid var(--border)', padding: 10, borderRadius: 8, marginBottom: 8 }}>
            <div className="fld-row" style={{ flexWrap: 'wrap' }}>
              <label className="fld">
                <span>Название</span>
                <input value={w.label} onChange={(e) => ((w.label = e.target.value), commit())} />
              </label>
              <label className="fld">
                <span>Слой</span>
                <select
                  value={w.overlay ?? 'none'}
                  onChange={(e) => {
                    const v = e.target.value
                    if (v && v !== 'none') w.overlay = v
                    else delete w.overlay
                    commit()
                  }}
                >
                  {/* список слоёв — из реестра кампании, а не из движка */}
                  {w.overlay && !(m.overlay_layers ?? []).some((l) => l.id === w.overlay) && (
                    <option value={w.overlay}>{w.overlay} (вне реестра)</option>
                  )}
                  <option value="none">Без слоя</option>
                  <optgroup label="Встроенные эффекты">
                    <option value="rain">Дождь</option>
                    <option value="snow">Снег</option>
                    <option value="fog">Туман</option>
                    <option value="ash">Пепел</option>
                  </optgroup>
                  <optgroup label="Слои кампании (реестр выше)">
                    {(m.overlay_layers ?? []).map((l) => (
                      <option key={l.id} value={l.id}>{l.label}</option>
                    ))}
                  </optgroup>
                  {(m.atmospherics?.length ?? 0) > 0 && (
                    <optgroup label="Мастерская спецэффектов (из файлов)">
                      {m.atmospherics!.map((a) => (
                        <option key={a.id} value={a.id}>{a.label || a.id}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </label>
              <button className="btn btn-small ce-del" data-tip="Удалить погоду" onClick={() => (m.weathers!.splice(i, 1), commit())}><Ico n="close" /> </button>
            </div>
            <label className="fld">
              <span>Зацикленные звуки погоды</span>
              <select
                value=""
                onChange={(e) => {
                  const id = e.target.value
                  if (!id) return
                  if (!w.ambient) w.ambient = []
                  if (!w.ambient.includes(id)) w.ambient.push(id)
                  commit()
                }}
              >
                <option value="">+ добавить звук…</option>
                {(m.sounds ?? [])
                  .filter((s) => !(w.ambient ?? []).includes(s.id) && !(w.ambient ?? []).includes(s.id.replace(/^sfx_/, 'snd_')) && !(w.ambient ?? []).includes(s.id.replace(/^snd_/, 'sfx_')))
                  .map((s) => (
                    <option key={s.id} value={s.id}>{s.label || s.id}</option>
                  ))}
              </select>
            </label>
            <div className="chips">
              {(w.ambient ?? []).map((id) => {
                const sl = (sounds?: Array<{ id: string; label?: string }>) => {
                  const exact = (sounds ?? []).find((s) => s.id === id)
                  if (exact) return exact.label || exact.id
                  const alt = id.startsWith('snd_') ? id.replace(/^snd_/, 'sfx_') : id.startsWith('sfx_') ? id.replace(/^sfx_/, 'snd_') : ''
                  if (alt) {
                    const found = (sounds ?? []).find((s) => s.id === alt)
                    if (found) return found.label || found.id
                  }
                  return id.replace(/^(snd_|sfx_)/, '').replace(/_/g, ' ')
                }
                return (
                  <span key={id} className="chip">
                    {sl(m.sounds)}
                    <button className="chip-del" data-tip="Убрать звук" onClick={() => ((w.ambient = (w.ambient ?? []).filter((x) => x !== id)), commit())}><Ico n="close" /> </button>
                  </span>
                )
              })}
            </div>
            <div className="fld-row" style={{ flexWrap: 'wrap' }} data-tip="Влияние этой погоды на бой: действует на обе стороны">
              <label className="fld fld-num" data-tip="Общий штраф всему движению (и бойцам игрока, и врагам); итог не ниже 1">
                <span>Штраф движения в бою</span>
                <input
                  type="number" min={0}
                  value={w.combat?.mov_penalty ?? 0}
                  onChange={(e) => {
                    const v = Math.max(0, Number(e.target.value) || 0)
                    if (v > 0) w.combat = { ...(w.combat ?? {}), mov_penalty: v }
                    else if (w.combat) delete w.combat.mov_penalty
                    commit()
                  }}
                />
              </label>
              <label className="fld fld-num" data-tip="Срезание дальности оружия (туман, темнота); итог ≥ 1">
                <span>Срезание дальности</span>
                <input
                  type="number" min={0}
                  value={w.combat?.range_penalty ?? 0}
                  onChange={(e) => {
                    const v = Math.max(0, Number(e.target.value) || 0)
                    if (v > 0) w.combat = { ...(w.combat ?? {}), range_penalty: v }
                    else if (w.combat) delete w.combat.range_penalty
                    commit()
                  }}
                />
              </label>
              <div className="fld" style={{ flex: 2, minWidth: 260 }} data-tip="Сдвиги навыков в бою под этой погодой: строка «навык — сдвиг», минус — штраф">
                <span>Сдвиг навыков</span>
                <SkillDeltaRows
                  store={store}
                  mods={w.combat?.skill_mods ?? []}
                  onChange={(arr) => {
                    if (arr.length) w.combat = { ...(w.combat ?? {}), skill_mods: arr }
                    else if (w.combat) delete w.combat.skill_mods
                    commit()
                  }}
                />
              </div>
              <label className="fld" data-tip="Статус, который действует на всех бойцов в бою под этой погодой (мороз, пар)">
                <span>Статус в бою</span>
                <select
                  value={w.combat?.status ?? ''}
                  onChange={(e) => {
                    const v = e.target.value
                    if (v) w.combat = { ...(w.combat ?? {}), status: v }
                    else if (w.combat) delete w.combat.status
                    commit()
                  }}
                >
                  <option value="">— нет —</option>
                  {(m.statuses ?? []).map((st) => (
                    <option key={st.id} value={st.id}>{st.label || st.id}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        ))}
        <button
          className="btn btn-small"
          onClick={async () => {
            const label = await askText('Название погоды', 'например «Моросящий дождь»')
            if (!label) return
            if (!m.weathers) m.weathers = []
            m.weathers.push({ id: makeId('weather_', label, m.weathers.map((x) => x.id)), label })
            commit()
          }}
        >
          + погода
        </button>
      </div>
      <CampaignItemsExtras store={store} m={m} commit={commit} />
        </>
  )
}
