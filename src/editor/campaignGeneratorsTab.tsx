/**
 * Вкладка «Генераторы»: таблицы событий, имена, описания сцен и приключения.
 *
 * Вынесено из `CampaignEditor.tsx`: вкладка строит собственные списки и слоты,
 * страница редактора только показывает её.
 */

import { Ico } from '../shared/icons'
import { makeId } from './ids'
import { GeneratorKindSection, GenListsEditor, GenFieldAdder, GenSlotSelect, GenSlotAdder } from './campaignGenerators'
import { genFieldLabel } from './campaignGeneratorLabels'
import type { CampaignGeneratorsTabProps } from './campaignTabProps'

export function CampaignGeneratorsTab({ store, m, commit, locOpts }: CampaignGeneratorsTabProps) {
        const g = m.generators ?? { event_tables: [], npc: [], scenes: [], adventures: [] }
        const setG = (next: typeof g) => { m.generators = next; commit() }
        const ruleIds = new Set(store.ids('rule'))
        const ruleExists = (rid: string) => ruleIds.has(rid)
        const tables = g.event_tables ?? []
        return (
          <div className="props-group">
            <h4>Таблицы случайных событий</h4>
            <p className="muted small">
              Включены — время от времени в мире случаются события: шаг мира,
              бросок на шанс, затем выбор случайного подходящего правила
              (проверяются условия, как у обычных правил). Отдельную таблицу можно
              временно выключить. Событие можно вызвать и вручную — реакцией
              «бросить таблицу случайных событий» у правил или в диалогах.
            </p>
            {tables.map((t, i) => (
              <div key={t.id} className="panel" style={{ padding: 10, marginBottom: 10 }}>
                <div className="fld-row">
                  <input value={t.label} placeholder="Название таблицы (например «Пящие в деревне»)" onChange={(e) => { const nt = tables.map((x, j) => j === i ? { ...x, label: e.target.value } : x); setG({ ...g, event_tables: nt }) }} style={{ flex: 1 }} />
                  <label className="fld fld-check" data-tip="Выключить таблицу (не удаляя)">
                    <input type="checkbox" checked={!t.disabled} onChange={(e) => { const nt = tables.map((x, j) => j === i ? { ...x, disabled: !e.target.checked || undefined } : x); setG({ ...g, event_tables: nt }) }} />
                    <span>вкл</span>
                  </label>
                  <button className="btn btn-small btn-danger" onClick={() => setG({ ...g, event_tables: tables.filter((_, j) => j !== i) })}><Ico n="trash" /></button>
                </div>
                <div className="fld-row">
                  <label className="fld" data-tip="Каждые N шагов мира (минут по умолчанию) — один бросок на событие">
                    <span>ШАГ мира, минут</span>
                    <input type="number" min={1} value={t.interval_ticks} onChange={(e) => { const nt = tables.map((x, j) => j === i ? { ...x, interval_ticks: Math.max(1, +e.target.value || 1) } : x); setG({ ...g, event_tables: nt }) }} />
                  </label>
                  <label className="fld" data-tip="Вероятность события на шаге: 1 — каждый шаг, 0.5 — каждый второй в среднем">
                    <span>Шанс 0..1</span>
                    <input type="number" min={0} max={1} step={0.05} value={t.chance ?? 1} onChange={(e) => { const nt = tables.map((x, j) => j === i ? { ...x, chance: +e.target.value } : x); setG({ ...g, event_tables: nt }) }} />
                  </label>
                </div>
                <span className="fld-label">Время суток события <span className="muted">(ничего не отмечено — в любое время)</span></span>
                <div className="chips" style={{ margin: '4px 0 10px' }}>
                  {(['morning', 'day', 'evening', 'night'] as const).map((tod) => {
                    const labels = { morning: 'утро', day: 'день', evening: 'вечер', night: 'ночь' }
                    const on = (t.time_of_day ?? []).includes(tod)
                    return (
                      <button key={tod} type="button" className={`chip ${on ? 'chip-on' : ''}`}
                        onClick={() => {
                          const cur = new Set(t.time_of_day ?? [])
                          if (on) cur.delete(tod); else cur.add(tod)
                          const nt = tables.map((x, j) => j === i ? { ...x, time_of_day: cur.size ? [...cur] : undefined } : x)
                          setG({ ...g, event_tables: nt })
                        }}>{labels[tod]}</button>
                    )
                  })}
                </div>
                <span className="fld-label">Только в локациях <span className="muted">(ничего не отмечено — везде)</span></span>
                <div className="chips" style={{ margin: '4px 0 10px' }}>
                  {locOpts.map((o) => {
                    const on = (t.locations ?? []).includes(o.id)
                    return (
                      <button key={o.id} type="button" className={`chip ${on ? 'chip-on' : ''}`}
                        onClick={() => {
                          const cur = new Set(t.locations ?? [])
                          if (on) cur.delete(o.id); else cur.add(o.id)
                          const nt = tables.map((x, j) => j === i ? { ...x, locations: cur.size ? [...cur] : undefined } : x)
                          setG({ ...g, event_tables: nt })
                        }}>{o.label}</button>
                    )
                  })}
                </div>
                <span className="fld-label">Правила-кандидаты <span className="muted">(из них выбирается одно на событие; условия у правила сужают выбор)</span></span>
                <div className="chips" style={{ margin: '4px 0 6px' }}>
                  {store.options('rule').map((o) => {
                    const on = t.rules.includes(o.id)
                    return (
                      <button key={o.id} type="button" className={`chip ${on ? 'chip-on' : ''}`}
                        onClick={() => {
                          const cur = new Set(t.rules)
                          if (on) cur.delete(o.id); else cur.add(o.id)
                          const nt = tables.map((x, j) => j === i ? { ...x, rules: [...cur] } : x)
                          setG({ ...g, event_tables: nt })
                        }}>{o.label}</button>
                    )
                  })}
                </div>
                {t.rules.some((r) => !ruleExists(r)) && (
                  <div className="muted small" style={{ color: 'var(--danger, #d66)' }}>В списке есть отсутствующие правила — перевыберите их выше.</div>
                )}
              </div>
            ))}
            <button
              className="btn btn-small"
              onClick={() => {
                const id = makeId('table', 'таблица', tables.map((x) => x.id))
                setG({ ...g, event_tables: [...tables, { id, label: 'Новая таблица', interval_ticks: 6, chance: 0.5, rules: [] }] })
              }}
            >
              <Ico n="plus" /> таблица событий
            </button>
            {tables.some((t) => (t.locations ?? []).some((l) => !locOpts.some((o) => o.id === l))) && (
              <p className="muted small" style={{ color: 'var(--danger, #d66)' }}>Есть отметки по удалённым локациям — снимите их в таблицах выше.</p>
            )}

            <h4 style={{ marginTop: 18 }}>Генераторы лиц и мест</h4>
            <p className="muted small">
              Генераторы — это взвешенные списки значений мастера: движок выбирает
              из них случайные имена, описания, детали мест и цели приключений.
              Значение возвращают эффект «сгенерировать переменные» и вызовы в
              диалогах; повторный вызов с тем же зерном даёт тот же результат.
            </p>
            <GeneratorKindSection
              heading="Лица (NPC)"
              hint="Случайные имена, чины и характеры для встреч в мире."
              items={g.npc ?? []}
              onChange={(npc) => setG({ ...g, npc: npc.length ? npc : undefined })}
              makeNew={(existing) => ({ id: makeId('gennpc', 'генератор лиц', existing.map((x) => x.id)), label: 'Новый генератор лиц', lists: {}, name: [] })}
              store={store}
              fields={<span>Складывание имени: подряд идут части — либо выбор из вашего списка, либо фиксированный текст. Поля — пары «что заполнить → из какого списка брать» (например: description — описание, disposition_label — метка расположения, stats.STR, skills.stealth).</span>}
              renderBody={(gen, update, _store) => (
                <>
                  <GenListsEditor lists={gen.lists} onChange={(lists) => update({ ...gen, lists })} />
                  <span className="fld-label">Имя из частей</span>
                  {(gen.name ?? []).map((part, pi) => (
                    <div key={pi} className="fld-row" style={{ alignItems: 'center' }}>
                      <select value={part.list !== undefined ? 'list' : 'literal'} onChange={(e) => { const name = (gen.name ?? []).map((x, j) => j === pi ? (e.target.value === 'list' ? { list: Object.keys(gen.lists)[0] ?? '' } : { literal: ((x as { literal?: string }).literal ?? ' ') }) : x); update({ ...gen, name }) }}>
                        <option value="list">выбор из списка</option>
                        <option value="literal">фиксированный текст</option>
                      </select>
                      {part.list !== undefined ? (
                        <select value={part.list} onChange={(e) => { const name = (gen.name ?? []).map((x, j) => j === pi ? ({ list: e.target.value }) : x); update({ ...gen, name }) }}>
                          {Object.keys(gen.lists).map((k) => <option key={k} value={k}>{k}</option>)}
                        </select>
                      ) : (
                        <input value={part.literal ?? ''} placeholder="текст (пробел, «-ог»…)" onChange={(e) => { const name = (gen.name ?? []).map((x, j) => j === pi ? ({ literal: e.target.value }) : x); update({ ...gen, name }) }} />
                      )}
                      <button className="btn btn-small" onClick={() => update({ ...gen, name: (gen.name ?? []).filter((_, j) => j !== pi) })}><Ico n="close" /></button>
                    </div>
                  ))}
                  <button className="btn btn-small" onClick={() => update({ ...gen, name: [...(gen.name ?? []), { list: Object.keys(gen.lists)[0] ?? '' }] })} disabled={!Object.keys(gen.lists).length}><Ico n="plus" /> часть имени</button>
                  <span className="fld-label" style={{ marginTop: 8 }}>Прочие поля персонажа</span>
                  {Object.entries(gen.fields ?? {}).map(([fld, key]) => (
                    <div key={fld} className="fld-row" style={{ alignItems: 'center' }}>
                      <input value={genFieldLabel(fld)} disabled style={{ width: 230 }} data-tip={"Техническое имя поля: " + fld} />
                      <select value={key} onChange={(e) => update({ ...gen, fields: { ...(gen.fields ?? {}), [fld]: e.target.value } })}>
                        {Object.keys(gen.lists).map((k) => <option key={k} value={k}>{k}</option>)}
                      </select>
                      <button className="btn btn-small" onClick={() => { const fields = { ...(gen.fields ?? {}) }; delete fields[fld]; update({ ...gen, fields }) }}><Ico n="close" /></button>
                    </div>
                  ))}
                  <div className="fld-row" style={{ alignItems: 'center' }}>
                    <GenFieldAdder existing={gen.lists} onAdd={(fld, key) => update({ ...gen, fields: { ...(gen.fields ?? {}), [fld]: key } })} />
                  </div>
                </>
              )}
            />
            <GeneratorKindSection
              heading="Места (описания сцен)"
              hint="Случайные детали места в слотах сцены: «в углу —…», «пахнет —…»."
              items={g.scenes ?? []}
              onChange={(scenes) => setG({ ...g, scenes: scenes.length ? scenes : undefined })}
              makeNew={(existing) => ({ id: makeId('gensc', 'генератор мест', existing.map((x) => x.id)), label: 'Новый генератор мест', lists: {}, slots: {} })}
              store={store}
              fields={<span>Слоты: «идентификатор слота сцены → какой список», значение ставится описанием слота.</span>}
              renderBody={(gen, update, store) => (
                <>
                  <GenListsEditor lists={gen.lists} onChange={(lists) => update({ ...gen, lists })} />
                  <span className="fld-label">Наполнение слотов сцены</span>
                  {Object.entries(gen.slots ?? {}).map(([slotId, key]) => (
                    <div key={slotId} className="fld-row" style={{ alignItems: 'center' }}>
                      <GenSlotSelect slotId={slotId} store={store} onChange={(v) => { const slots = { ...(gen.slots ?? {}) }; delete slots[slotId]; slots[v] = key; update({ ...gen, slots }) }} />
                      <select value={key} onChange={(e) => update({ ...gen, slots: { ...(gen.slots ?? {}), [slotId]: e.target.value } })}>
                        {Object.keys(gen.lists).map((k) => <option key={k} value={k}>{k}</option>)}
                      </select>
                      <button className="btn btn-small" onClick={() => { const slots = { ...(gen.slots ?? {}) }; delete slots[slotId]; update({ ...gen, slots }) }}><Ico n="close" /></button>
                    </div>
                  ))}
                  <GenSlotAdder store={store} gen={gen} onAdd={(slotId, key) => update({ ...gen, slots: { ...(gen.slots ?? {}), [slotId]: key } })} />
                </>
              )}
            />
            <GeneratorKindSection
              heading="Приключения (цепочки целей)"
              hint="Цели квеста: строка с подстановками из ваших списков {список:ключ}."
              items={g.adventures ?? []}
              onChange={(adventures) => setG({ ...g, adventures: adventures.length ? adventures : undefined })}
              makeNew={(existing) => ({ id: makeId('genadv', 'генератор приключений', existing.map((x) => x.id)), label: 'Новый генератор приключений', lists: {}, goals: [] })}
              store={store}
              fields={<span>Цели — строки, по одной. Подстановки пишите как {'{список:ключ}'} — их пункты выбираются из ваших списков.</span>}
              renderBody={(gen, update) => (
                <>
                  <GenListsEditor lists={gen.lists} onChange={(lists) => update({ ...gen, lists })} />
                  <label className="fld" data-tip="Одна цель на строку. Подстановка: {список:ключ} — выбирает пункт из списка">
                    <span>Цели приключений (по строке)</span>
                    <textarea
                      rows={(gen.goals?.length ?? 0) + 2}
                      value={(gen.goals ?? []).join('\n')}
                      placeholder="Добыть в {список:места} трофей {список:трофеи}"
                      onChange={(e) => update({ ...gen, goals: e.target.value.split('\n').filter((x) => x.trim()) })}
                    />
                  </label>
                </>
              )}
            />
            <div className="fld-row">
              <button className="btn btn-small btn-danger" disabled={!m.generators} onClick={() => { delete m.generators; commit() }}>
                Удалить весь блок
              </button>
            </div>
          </div>
        )
}
