/**
 * Вкладка «Основное», вторая половина: опыт и черты, лагерь, опасности,
 * преступления, цены, старт игры и рогалик.
 *
 * Вынесено из `CampaignEditor.tsx`: это продолжение той же вкладки, разделённое
 * по смыслу — правила прокачки и мира против паспортных полей.
 */

import { Ico } from '../shared/icons'
import { ConditionListEditor, EffectListEditor, RefSelect } from './Fields'
import { makeId } from './ids'
import type { FeatDef } from '../shared/types'
import { askText } from './prompt'
import { ChipMultiSelect } from './campaignDiceEditors'
import { FeatModRows, RegistryRows, SelectFld } from './campaignRegistryParts'
import type { CampaignMainTabProps } from './campaignTabProps'

export function CampaignMainRules({ store, m, commit, sceneOpts, locOpts, regionOpts, npcOpts }: CampaignMainTabProps) {
  return (
        <>
      <div className="props-group">
        <h4>Опыт, уровни и черты</h4>
        <div className="muted small" style={{ marginBottom: 8 }}>
          Необязательный рост героя: действия начисляют опыт (реакции правил и
          диалогов), за уровни герой выбирает «черты» — маленькие усиления.
          Выключено — герой растёт только тренировкой навыков при отдыхе.
        </div>
        <div className="fld-row">
          <label className="fld fld-check" data-tip="Вкл — в игре копится опыт, герой получает уровни и выбирает черты. Выкл — рост только навыками при отдыхе">
            <input type="checkbox" checked={!!m.progression} onChange={(e) => { if (e.target.checked) { m.progression = { xp_per_level: 100, feats_per_level: 1 } } else { delete m.progression } commit() }} />
            <span>Уровни и опыт</span>
          </label>
          {m.progression && (
            <>
              <label className="fld" data-tip="Стоимость каждого N-го уровня: базовое × N (накопительно). Например 100: 2-й уровень при 100 опыта, 3-й при 300, 4-й при 600">
                <span>Опыта за уровень</span>
                <input type="number" min={1} value={m.progression.xp_per_level ?? 100} onChange={(e) => { m.progression!.xp_per_level = +e.target.value || 100; commit() }} />
              </label>
              <label className="fld" data-tip="Сколько черт герой выбирает за каждый новый уровень (вкладка персонажа)">
                <span>Черт на уровень</span>
                <input type="number" min={0} value={m.progression.feats_per_level ?? 1} onChange={(e) => { m.progression!.feats_per_level = +e.target.value || 0; commit() }} />
              </label>
              <label className="fld" data-tip="Пусто — без потолка. На потолке опыт перестаёт копиться">
                <span>Максимальный уровень</span>
                <input type="number" min={1} value={m.progression.max_level ?? ''} onChange={(e) => { if (e.target.value === '') { delete m.progression!.max_level } else { m.progression!.max_level = +e.target.value || 1 } commit() }} />
              </label>
            </>
          )}
        </div>
        {m.progression && (
          <div className="fld-row" style={{ flexDirection: 'column', gap: 8 }}>
            <div className="muted small" data-tip="Каждая черта: название и описание видит игрок, модификаторы и требования — движок">
              Черты прокачки (что герой выбирает за уровни)
            </div>
            {(m.progression.feats ?? []).map((f, i) => {
              const patchFeat = (p: Partial<FeatDef>) => {
                const feats = (m.progression!.feats ?? []).map((x, j) => (j === i ? { ...x, ...p } : x))
                m.progression!.feats = feats
                commit()
              }
              return (
                <div key={f.id} className="panel" style={{ padding: 8 }}>
                  <div className="fld-row">
                    <label className="fld" style={{ flex: 1, minWidth: 200 }}>
                      <span>Название черты</span>
                      <input value={f.label} onChange={(e) => patchFeat({ label: e.target.value })} />
                    </label>
                    <label className="fld" style={{ flex: 2, minWidth: 240 }}>
                      <span>Описание (что даёт)</span>
                      <input value={f.description ?? ''} onChange={(e) => patchFeat({ description: e.target.value || undefined })} />
                    </label>
                    <button
                      className="btn btn-small ce-del"
                      style={{ alignSelf: 'end' }}
                      data-tip="Удалить черту"
                      onClick={() => {
                        m.progression!.feats = (m.progression!.feats ?? []).filter((_, j) => j !== i)
                        commit()
                      }}
                    >
                      <Ico n="close" />
                    </button>
                  </div>
                  <div className="fld-row">
                    <div className="fld" style={{ flex: 2, minWidth: 280 }} data-tip="Что даёт черта при взятии: прибавки к навыкам, характеристикам, здоровью, мане и движению">
                      <span>Модификаторы (что даёт черта)</span>
                      <FeatModRows store={store} mods={f.mods} onChange={(mods) => patchFeat({ mods })} />
                    </div>
                    <div className="fld" style={{ flex: 2, minWidth: 280 }} data-tip="Кто может взять черту: требования выбираются списком. Пусто — без требований">
                      <span>Требования (кто может взять)</span>
                      <ConditionListEditor
                        store={store}
                        conditions={f.requires ?? []}
                        onChange={(c) => patchFeat({ requires: c.length ? c : undefined })}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
            <button
              className="btn btn-small"
              onClick={() => void (async () => {
                const label = await askText('Название новой черты', 'например «Твёрдая рука»')
                if (!label?.trim()) return
                const feats = m.progression!.feats ?? []
                m.progression!.feats = [...feats, { id: makeId('feat_', label.trim(), feats.map((x) => x.id)), label: label.trim() }]
                commit()
              })()}
            >
              <Ico n="plus" /> черта
            </button>
          </div>
        )}
      </div>

      <div className="props-group">
        <h4>Лагерь, опасности, преступления, цены</h4>
        <div className="fld-row" style={{ flexWrap: 'wrap' }}>
          <label className="fld fld-check" data-tip="Кнопка «Разбить лагерь» в HUD на локациях с отметкой camp">
            <input
              type="checkbox"
              checked={!!m.camping}
              onChange={(e) => {
                if (e.target.checked) m.camping = { ticks: 8 }
                else delete m.camping
                commit()
              }}
            />
            <span>Лагерь и ночлег</span>
          </label>
          {m.camping && (
            <>
              <label className="fld fld-num" data-tip="Сколько тиков идёт отдых">
                <span>Длительность, тиков</span>
                <input
                  type="number" min={1}
                  value={m.camping.ticks ?? 8}
                  onChange={(e) => ((m.camping!.ticks = Math.max(1, Number(e.target.value) || 8)), commit())}
                />
              </label>
              <label className="fld fld-num" data-tip="Шанс ночной засады 0..1. Мастер сам решает последствия — через правило засады">
                <span>Шанс засады (0..1)</span>
                <input
                  type="number" min={0} max={1} step={0.05}
                  value={m.camping.ambush_chance ?? 0}
                  onChange={(e) => ((m.camping!.ambush_chance = Math.max(0, Math.min(1, Number(e.target.value) || 0))), commit())}
                />
              </label>
              <RefSelect
                label="Правило засады"
                kind="rule"
                store={store}
                value={m.camping.ambush_rule ?? ''}
                optional
                onChange={(v) => ((m.camping!.ambush_rule = v || undefined), commit())}
              />
              <label className="fld fld-num" data-tip="Минимальная длительность ночлега. Сделайте её меньше максимальной — и игрок сам выберет в окне, сколько спать. По умолчанию равна «Длительности» (сон фиксированный)">
                <span>Минимум, тиков</span>
                <input
                  type="number" min={1}
                  value={m.camping.min_ticks ?? m.camping.ticks ?? 8}
                  onChange={(e) => ((m.camping!.min_ticks = Math.max(1, Number(e.target.value) || (m.camping!.ticks ?? 8))), commit())}
                />
              </label>
              <label className="fld fld-num" data-tip="Максимальная длительность ночлега. Если больше минимума — открывается окно выбора с прогнозом по часам">
                <span>Максимум, тиков</span>
                <input
                  type="number" min={1}
                  value={m.camping.max_ticks ?? m.camping.ticks ?? 8}
                  onChange={(e) => ((m.camping!.max_ticks = Math.max(1, Number(e.target.value) || (m.camping!.ticks ?? 8))), commit())}
                />
              </label>
              <div
                className="fld"
                style={{ flex: 1, minWidth: 300 }}
                data-tip="Применяются ЗА КАЖДЫЙ тик сна (до природного тикания потребностей): сон на 6 часов даёт в 6 раз больше, чем на 1. Белый список: Потребность, ХП, Усталость, Рассудок — остальные эффекты движок пропускает с записью в журнал"
              >
                <span>Почасовые эффекты (за тик)</span>
                <EffectListEditor
                  store={store}
                  effects={m.camping.per_tick ?? []}
                  onChange={(fx) => ((m.camping!.per_tick = fx.length ? fx : undefined), commit())}
                />
              </div>
              <div
                className="fld"
                style={{ flex: 1, minWidth: 300 }}
                data-tip="Сколько восстанавливает ночлег. Применяется ПОСЛЕ хода времени: 8 часов сна снимают свою долю, восстановление покрывает и её. Рост делится с напарниками («общий стол»). Пустой блок — классика: лагерь сам по себе потребности не лечит, помогут только предметы (кровать, одеяло и т.п.); тексты кнопки сна обещают лишь прирост навыков и лечение."
              >
                <span>Восстановление потребностей</span>
                {Object.entries(m.camping.restore ?? {}).map(([needId, val]) => (
                  <div key={needId} className="fld-row" style={{ gap: 6, alignItems: 'center' }}>
                    <RefSelect
                      label="Потребность"
                      store={store}
                      kind="need"
                      value={needId}
                      onChange={(v) => {
                        if (!v) return
                        const next = { ...(m.camping!.restore ?? {}) }
                        delete next[needId]
                        next[v] = val
                        m.camping!.restore = next
                        commit()
                      }}
                    />
                    <input
                      type="number"
                      style={{ width: 80 }}
                      value={val}
                      onChange={(e) => {
                        m.camping!.restore = { ...(m.camping!.restore ?? {}), [needId]: Number(e.target.value) || 0 }
                        commit()
                      }}
                    />
                    <button
                      className="btn btn-small"
                      onClick={() => {
                        const next = { ...(m.camping!.restore ?? {}) }
                        delete next[needId]
                        if (Object.keys(next).length) m.camping!.restore = next
                        else delete m.camping!.restore
                        commit()
                      }}
                    >
                      <Ico n="close" />
                    </button>
                  </div>
                ))}
                <button
                  className="btn btn-small"
                  onClick={() => {
                    const opts = store.options('need').filter((o) => !(m.camping!.restore ?? {})[o.id])
                    const first = opts[0]?.id
                    if (!first) return
                    m.camping!.restore = { ...(m.camping!.restore ?? {}), [first]: 100 }
                    commit()
                  }}
                >
                  <Ico n="plus" /> потребность
                </button>
              </div>
            </>
          )}
          <label className="fld fld-num" data-tip="Метров падения на один кубик урона (книжное умолчание 3)">
            <span>Падение: м/кубик</span>
            <input
              type="number" min={1}
              value={m.hazards?.fall_meters_per_die ?? 3}
              onChange={(e) => ((m.hazards = { ...(m.hazards ?? {}), fall_meters_per_die: Math.max(1, Number(e.target.value) || 3) }), commit())}
            />
          </label>
        </div>
        <div className="fld-row" style={{ flexWrap: 'wrap' }}>
          <div className="fld" style={{ flex: 1, minWidth: 300 }} data-tip="Преступления: названия видит игрок; герой «совершает преступление» эффектом, выбрав его из списка">
            <span>Преступления</span>
            <RegistryRows
              items={m.crimes ?? []}
              onChange={(v) => ((m.crimes = v.length ? v : undefined), commit())}
              addTitle="Название нового преступления"
              prefix="crime_"
            />
          </div>
          <div className="fld" style={{ flex: 1, minWidth: 340 }} data-tip="Ценовые события: множитель и фильтр категорий; включаются эффектом «Ценовое событие» (правило, диалог или квест)">
            <span>Ценовые события</span>
            <RegistryRows
              items={m.price_events ?? []}
              onChange={(v) => ((m.price_events = v.length ? v : undefined), commit())}
              addTitle="Название нового ценового события"
              prefix="price_"
              render={(ev, patch) => (
                <>
                  <label className="fld fld-num" data-tip="Множитель цены: 1.5 — выкуп дороже на 50%">
                    <span>Множитель ×</span>
                    <input
                      type="number" step={0.1} min={0.1}
                      value={ev.multiplier}
                      onChange={(e) => patch({ multiplier: Math.max(0.1, Number(e.target.value) || 1) })}
                    />
                  </label>
                  <div className="fld" style={{ flex: 2, minWidth: 200 }}>
                    <span data-tip="Пусто — цены меняются на все предметы">Категории предметов</span>
                    <ChipMultiSelect
                      options={store.options('itemCategory')}
                      value={ev.categories ?? []}
                      emptyLabel="все категории — нажмите, чтобы ограничить"
                      onChange={(v) => patch({ categories: v.length ? v : undefined })}
                    />
                  </div>
                </>
              )}
            />
          </div>
        </div>
      </div>

      <div className="props-group">
        <h4>Старт игры</h4>
        <div className="fld-row">
          <SelectFld label="Регион" value={m.starting_region} options={regionOpts} onChange={(v) => ((m.starting_region = v), commit())} />
          <SelectFld label="Локация" value={m.starting_location} options={locOpts} onChange={(v) => ((m.starting_location = v), commit())} />
          <SelectFld label="Сцена" value={m.starting_scene} options={sceneOpts} onChange={(v) => ((m.starting_scene = v), commit())} />
        </div>
        <div className="fld-row">
          <SelectFld label="Персонаж игрока" value={m.default_player} options={npcOpts} onChange={(v) => ((m.default_player = v), commit())} />
          <label className="fld" data-tip="Абсолютный тик игры, с которого начинается забег (умолчание движка — 8, утро первого дня). Условие «Прошло тиков с начала» и таймер дедлайна отсчитываются именно от него.">
            <span>Стартовый тик</span>
            <input type="number" value={m.starting_tick ?? 8} onChange={(e) => ((m.starting_tick = Number(e.target.value)), commit())} />
          </label>
          <label className="fld">
            <span>Макс. напарников</span>
            <input type="number" value={m.max_companions ?? 2} onChange={(e) => ((m.max_companions = Number(e.target.value)), commit())} />
          </label>
        </div>
      </div>

      <div className="props-group">
        <h4>Рогалик</h4>
        <label className="fld fld-check">
          <input type="checkbox" checked={m.roguelike!.permadeath} onChange={(e) => ((m.roguelike!.permadeath = e.target.checked), commit())} />
          <span>Перманентная смерть (сейв удаляется при гибели)</span>
        </label>
      </div>


        </>
  )
}
