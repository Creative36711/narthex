/**
 * Реестр статусов кампании: эффекты, пометки и сроки действия.
 *
 * Вынесено из `CampaignEditor.tsx`: у реестра собственные строки и подписи,
 * страница редактора только показывает его во вкладке «Статусы».
 */

import { Ico } from '../shared/icons'
import type { EditorStore } from './store'
import { AssetUpload, EffectListEditor, RefSelect, DiceNotationInput } from './Fields'
import { makeId } from './ids'
import type { CampaignMeta, StatusDef } from '../shared/types'
import { askText } from './prompt'

/**
 * «Длительные действия» (dz.20): сон на выбранное число часов, медитация,
 * дежурство, чтение — реестр meta.duration_actions. Запускаются эффектом
 * «Начать длительное действие» из диалога/правила/точки взаимодействия.
 */
export function StatusRegistry({ m, store, commit }: { m: CampaignMeta; store: EditorStore; commit: () => void }) {
  const list = (m.statuses ??= [])
  return (
    <>
      <div className="props-group">
        <h4>Статусы (яды, кровотечения, баффы)</h4>
        <p className="muted small">
          Длительные состояния. «Мир» живёт в тиках, «Бой» — в раундах, «Везде» — и там и там.
          Урон за тик не убивает героя (минимум 1 HP); в бою — может добить.
        </p>
        {list.map((s, i) => (
          <details key={s.id} className="need-conds" open>
            <summary>
              {s.label || '(без названия)'} · {s.scope === 'world' ? 'мир' : s.scope === 'combat' ? 'бой' : 'везде'} · {s.duration}
              <button
                className="btn btn-small ce-del"
                data-tip="Удалить статус"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  list.splice(i, 1)
                  commit()
                }}
              >
                <Ico n="close" />
              </button>
            </summary>
            <div className="fld-row">
              <label className="fld">
                <span>Название</span>
                <input value={s.label} onChange={(e) => ((s.label = e.target.value), commit())} />
              </label>
              <label className="fld">
                <span>Где действует</span>
                <select value={s.scope} onChange={(e) => ((s.scope = e.target.value as StatusDef['scope']), commit())}>
                  <option value="world">Мир (тики)</option>
                  <option value="combat">Бой (раунды)</option>
                  <option value="both">Везде</option>
                </select>
              </label>
              <label className="fld" data-tip="Длительность по умолчанию: тики в мире, раунды в бою">
                <span>Длительность</span>
                <input type="number" min={1} value={s.duration} onChange={(e) => ((s.duration = Math.max(1, Number(e.target.value) || 1)), commit())} />
              </label>
            </div>
            <div className="fld-row" style={{ alignItems: 'center' }}>
              <label className="fld fld-check" data-tip="Болезни и яды с течением: каждую стадию — спасбросок CON; провал — тяжесть ↑ (урон и модификаторы ×тяжесть), успех — тяжесть ↓, при нуле выздоровление">
                <input
                  type="checkbox"
                  checked={!!s.disease}
                  onChange={(e) => {
                    if (e.target.checked) s.disease = { interval_ticks: 24 }
                    else delete s.disease
                    commit()
                  }}
                />
                <span>Болезнь / яд с течением</span>
              </label>
              {s.disease && (
                <>
                  <label className="fld fld-num" data-tip="Период стадий в мировых тиках">
                    <span>Стадия каждые, тиков</span>
                    <input
                      type="number" min={1}
                      value={s.disease.interval_ticks}
                      onChange={(e) => ((s.disease!.interval_ticks = Math.max(1, Number(e.target.value) || 24)), commit())}
                    />
                  </label>
                  <label className="fld fld-num" data-tip="Спасбросок CON × множитель (умолчание 5)">
                    <span>Множитель CON</span>
                    <input
                      type="number" min={1}
                      value={s.disease.con_multiplier ?? 5}
                      onChange={(e) => ((s.disease!.con_multiplier = Math.max(1, Number(e.target.value) || 5)), commit())}
                    />
                  </label>
                  <label className="fld fld-num" data-tip="Предел тяжести (умолчание 5)">
                    <span>Предел тяжести</span>
                    <input
                      type="number" min={1}
                      value={s.disease.severity_max ?? 5}
                      onChange={(e) => ((s.disease!.severity_max = Math.max(1, Number(e.target.value) || 5)), commit())}
                    />
                  </label>
                </>
              )}
            </div>
            <label className="fld">
              <span>Описание (видно игроку)</span>
              <input value={s.description ?? ''} onChange={(e) => ((s.description = e.target.value || undefined), commit())} />
            </label>
            <label className="fld" data-tip="Краткое название для компактного отображения в HUD">
              <span>Короткое имя</span>
              <input value={s.short_label ?? ''} onChange={(e) => ((s.short_label = e.target.value || undefined), commit())} placeholder="например: Отравлен" />
            </label>
            <div className="fld-row">
              <label className="fld" data-tip="Урон за тик (мир) / за раунд (бой). Пусто — без урона.">
                <span>Урон HP за тик</span>
                <input
                  type="number" min={0} value={s.dot?.hp ?? ''} placeholder="нет"
                  onChange={(e) => {
                    const v = Number(e.target.value) || 0
                    s.dot = { ...(s.dot ?? {}) }
                    if (v > 0) s.dot.hp = v; else delete s.dot.hp
                    if (!Object.keys(s.dot).length) delete s.dot
                    commit()
                  }}
                />
              </label>
              <label className="fld">
                <span>Урон MP за тик</span>
                <input
                  type="number" min={0} value={s.dot?.mp ?? ''} placeholder="нет"
                  onChange={(e) => {
                    const v = Number(e.target.value) || 0
                    s.dot = { ...(s.dot ?? {}) }
                    if (v > 0) s.dot.mp = v; else delete s.dot.mp
                    if (!Object.keys(s.dot).length) delete s.dot
                    commit()
                  }}
                />
              </label>
              <label className="fld" data-tip="Прибавка к движению (может быть отрицательной; итог не ниже 1)">
                <span>Движение ±</span>
                <input
                  type="number" value={s.mov_mod ?? ''} placeholder="0"
                  onChange={(e) => {
                    const v = Number(e.target.value) || 0
                    if (v) s.mov_mod = v; else delete s.mov_mod
                    commit()
                  }}
                />
              </label>
            </div>
            <div className="fld-block">
              <span className="fld-caption">Модификаторы навыков на время статуса</span>
              {(s.skill_mods ?? []).map((mod, j) => (
                <div className="fld-row" key={j}>
                  <RefSelect
                    label="Навык"
                    kind="skill"
                    store={store}
                    value={mod.skill}
                    onChange={(v) => ((s.skill_mods![j].skill = v ?? ''), commit())}
                  />
                  <label className="fld">
                    <span>± к навыку</span>
                    <input
                      type="number" value={mod.delta}
                      onChange={(e) => ((s.skill_mods![j].delta = Number(e.target.value) || 0), commit())}
                    />
                  </label>
                  <button className="btn btn-small ce-del" onClick={() => {
                    s.skill_mods = s.skill_mods!.filter((_, k) => k !== j)
                    if (!s.skill_mods.length) delete s.skill_mods
                    commit()
                  }}><Ico n="close" /></button>
                </div>
              ))}
              <button className="btn btn-small" onClick={() => (((s.skill_mods ??= []).push({ skill: '', delta: -10 })), commit())}>
                + модификатор навыка
              </button>
            </div>
            <div className="fld-row">
              <label className="fld">
                <span>Сообщение при наложении (пусто — стандартное)</span>
                <input value={s.apply_message ?? ''} onChange={(e) => ((s.apply_message = e.target.value || undefined), commit())} />
              </label>
              <label className="fld">
                <span>Сообщение при истечении</span>
                <input value={s.expire_message ?? ''} onChange={(e) => ((s.expire_message = e.target.value || undefined), commit())} />
              </label>
            </div>
            <AssetUpload
              label="Иконка статуса (необязательно)"
              kind="image"
              dir="assets/img/status"
              store={store}
              value={s.icon ?? ''}
              onChange={(v) => ((s.icon = v || undefined), commit())}
            />
            <div className="fld-block">
              <span className="fld-caption">Эффекты при наложении</span>
              <EffectListEditor
                store={store}
                effects={s.on_apply ?? []}
                onChange={(ef) => ((s.on_apply = ef.length ? ef : undefined), commit())}
              />
            </div>
            <div className="fld-block">
              <span className="fld-caption">Эффекты при истечении</span>
              <EffectListEditor
                store={store}
                effects={s.on_expire ?? []}
                onChange={(ef) => ((s.on_expire = ef.length ? ef : undefined), commit())}
              />
            </div>
          </details>
        ))}
        <button
          className="btn btn-small"
          onClick={async () => {
            const label = await askText('Название статуса', 'например «Отравление»')
            if (!label) return
            list.push({ id: makeId('status_', label, list.map((x) => x.id)), label, scope: 'world', duration: 5 })
            commit()
          }}
        >
          + статус
        </button>
      </div>
      <div className="props-group">
        <h4>Способности</h4>
        <p className="muted small">
          Боевые способности: тратят MP, имеют кулдаун. НПС получают их полем
          «Способности» в форме персонажа; игрок — способностями своей сущности.
        </p>
        {(m.abilities ?? []).map((a, i) => (
          <details key={a.id} className="need-conds" open>
            <summary>
              {a.label || '(без названия)'} · {a.kind === 'damage' ? 'урон' : a.kind === 'status' ? 'статус' : 'лечение'} · {a.mp_cost} MP
              <button
                className="btn btn-small ce-del"
                data-tip="Удалить способность"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  m.abilities!.splice(i, 1)
                  commit()
                }}
              >
                <Ico n="close" />
              </button>
            </summary>
            <div className="fld-row">
              <label className="fld">
                <span>Название</span>
                <input value={a.label} onChange={(e) => ((a.label = e.target.value), commit())} />
              </label>
              <label className="fld">
                <span>Тип</span>
                <select value={a.kind} onChange={(e) => ((a.kind = e.target.value as typeof a.kind), commit())}>
                  <option value="damage">Урон</option>
                  <option value="status">Статус</option>
                  <option value="heal">Лечение</option>
                </select>
              </label>
              <label className="fld">
                <span>Стоимость, MP</span>
                <input type="number" min={0} value={a.mp_cost} onChange={(e) => ((a.mp_cost = Math.max(0, Number(e.target.value) || 0)), commit())} />
              </label>
              <label className="fld" data-tip="Сколько раундов нельзя применять снова (0 — без кулдауна)">
                <span>Кулдаун, раунд.</span>
                <input
                  type="number" min={0} value={a.cooldown_rounds ?? ''} placeholder="0"
                  onChange={(e) => {
                    const v = Number(e.target.value) || 0
                    if (v > 0) a.cooldown_rounds = v; else delete a.cooldown_rounds
                    commit()
                  }}
                />
              </label>
              <label className="fld" data-tip="Дальность в гексах: 1 — вплотную">
                <span>Дальность</span>
                <input type="number" min={1} value={a.range} onChange={(e) => ((a.range = Math.max(1, Number(e.target.value) || 1)), commit())} />
              </label>
            </div>
            <label className="fld">
              <span>Описание (видно игроку)</span>
              <input value={a.description ?? ''} onChange={(e) => ((a.description = e.target.value || undefined), commit())} />
            </label>
            <div className="fld-row">
              <RefSelect
                label="Навык попадания (пусто — без проверки)"
                kind="skill"
                store={store}
                value={a.skill ?? ''}
                optional
                onChange={(v) => ((a.skill = v || undefined), commit())}
              />
              {a.kind === 'damage' && (
                <DiceNotationInput
                  label="Урон (кубики)"
                  tip="Нотация кубиков, напр. 1d6+2. Бонус силы НЕ добавляется; броня цели поглощает."
                  optional
                  value={a.damage ?? ''}
                  onChange={(v) => ((a.damage = v || undefined), commit())}
                />
              )}
              {a.kind === 'status' && (
                <>
                  <RefSelect
                    label="Статус"
                    kind="status"
                    store={store}
                    value={a.status ?? ''}
                    onChange={(v) => ((a.status = v || undefined), commit())}
                  />
                  <label className="fld" data-tip="Длительность в раундах (пусто — из реестра статуса)">
                    <span>Длительность</span>
                    <input
                      type="number" min={0} value={a.status_duration ?? ''} placeholder="из реестра"
                      onChange={(e) => {
                        const v = Number(e.target.value) || 0
                        if (v > 0) a.status_duration = v; else delete a.status_duration
                        commit()
                      }}
                    />
                  </label>
                </>
              )}
              {a.kind === 'heal' && (
                <DiceNotationInput
                  label="Лечение (кубики)"
                  tip="Нотация кубиков, напр. 1d6"
                  optional
                  value={a.heal ?? ''}
                  onChange={(v) => ((a.heal = v || undefined), commit())}
                />
              )}
              <label className="fld fld-check" data-tip="Заклинание действует только подготовленное в слот (слоты задаются ниже — «Слоты подготовки магии»)">
                <input type="checkbox" checked={!!a.prepare} onChange={(e) => ((a.prepare = e.target.checked || undefined), commit())} />
                <span>Требует подготовки</span>
              </label>
            </div>
            <details className="need-conds">
              <summary>Откат при критическом провале ({(a.backlash_table ?? []).length ? `${a.backlash_table!.length} записей` : 'нет — просто промах'})</summary>
              <div className="muted small" style={{ margin: '4px 0 6px' }}>
                Магическое нарушение: срабатывает при критическом провале броска навыка применения; запись бьёт по заклинателю.
              </div>
              {(a.backlash_table ?? []).map((b, j) => (
                <div className="fld-row" key={j} style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <label className="fld fld-num">
                    <span>Вес</span>
                    <input type="number" min={1} value={b.weight} onChange={(e) => ((b.weight = Math.max(1, Number(e.target.value) || 1)), commit())} />
                  </label>
                  <label className="fld fld-num" data-tip="Знаковое: −2 — заклинатель теряет 2 HP">
                    <span>HP ±</span>
                    <input type="number" value={b.hp_delta ?? ''} placeholder="0" onChange={(e) => ((b.hp_delta = e.target.value === '' ? undefined : Number(e.target.value) || 0), commit())} />
                  </label>
                  <label className="fld fld-num" data-tip="Знаковое: −3 — заклинатель теряет 3 MP">
                    <span>MP ±</span>
                    <input type="number" value={b.mp_delta ?? ''} placeholder="0" onChange={(e) => ((b.mp_delta = e.target.value === '' ? undefined : Number(e.target.value) || 0), commit())} />
                  </label>
                  <RefSelect
                    label="Статус заклинателю"
                    kind="status"
                    store={store}
                    value={b.status ?? ''}
                    optional
                    onChange={(v) => ((b.status = v || undefined), commit())}
                  />
                  <label className="fld" style={{ flex: 1, minWidth: 160 }}>
                    <span>Строка в журнал</span>
                    <input value={b.text ?? ''} onChange={(e) => ((b.text = e.target.value || undefined), commit())} />
                  </label>
                  <button className="btn btn-small ce-del" data-tip="Удалить" onClick={() => { a.backlash_table = a.backlash_table!.filter((_, k) => k !== j); if (!a.backlash_table.length) delete a.backlash_table; commit() }}><Ico n="close" /> </button>
                </div>
              ))}
              <button className="btn btn-small" onClick={() => (((a.backlash_table ??= []).push({ weight: 1, hp_delta: -2 })), commit())}>
                <Ico n="plus" /> Запись отката
              </button>
            </details>
          </details>
        ))}
        <button
          className="btn btn-small"
          onClick={async () => {
            const label = await askText('Название способности', 'например «Огненный шар»')
            if (!label) return
            ;(m.abilities ??= []).push({ id: makeId('ability_', label, (m.abilities ?? []).map((x) => x.id)), label, mp_cost: 3, range: 3, kind: 'damage', damage: '1d6' })
            commit()
          }}
        >
          + способность
        </button>
        <label className="fld fld-num" data-tip="Сколько способностей с галочкой «Требует подготовки» герой держит в голове одновременно. Пусто — подготовка не требуется">
          <span>Слоты подготовки магии</span>
          <input
            type="number" min={0} value={m.magic?.slots ?? ''} placeholder="выключено"
            onChange={(e) => {
              const v = Number(e.target.value) || 0
              if (v > 0) m.magic = { ...(m.magic ?? {}), slots: v }
              else delete m.magic
              commit()
            }}
          />
        </label>
      </div>
    </>
  )
}

/**
 * Вкладка «Версии» (фаза B совместимости): версия кампании, минимальный
 * движок, публикация обновления с контрактом `compat.json`.
 *
 * Совместимость считается автоматически: редактор сравнивает пакет с
 * предыдущей публикацией и предлагает `save_base_version`. Мастер только
 * подтверждает — вручную таблицы совместимости вести не нужно.
 */
