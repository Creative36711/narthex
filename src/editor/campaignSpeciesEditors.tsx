

/**
 * Виды и портреты героев: реестр происхождений и слои портрета.
 *
 * Вынесено из `CampaignEditor.tsx`: секция паспорта кампании со своим набором
 * полей, чтобы модуль редактора оставался в пределах лимита размера.
 */

import { Ico } from '../shared/icons'
import type { EditorStore } from './store'
import { AnimImageEditor, RefSelect, DiceNotationInput } from './Fields'
import { makeId } from './ids'
import type { CampaignMeta, HeroPortraitLayerDef, ImageValue } from '../shared/types'
import { askText } from './prompt'
/**
 * Виды и портреты героев: реестр происхождений и слои портрета.
 *
 * Вынесено из `CampaignEditor.tsx`: секция паспорта кампании со своим набором
 * полей, чтобы модуль редактора оставался в пределах лимита размера.
 */


export function SpeciesRegistry({ m, store, commit }: { m: CampaignMeta; store: EditorStore; commit: () => void }) {
  const list = (m.species ??= [])
  return (
    <div className="props-group">
      <h4>Шаблоны видов существ</h4>
      <div className="muted small" style={{ marginBottom: 8 }}>
        Заготовки боевого костяка для персонажей: крыса, скелет, наёмник… В редакторе
        персонажа кнопка «Применить вид» перезаписывает эти поля значениями шаблона.
      </div>
      {list.map((sp, i) => (
        <details key={sp.id} className="need-conds">
          <summary><b>{sp.label}</b>{sp.description ? <span className="muted small"> — {sp.description}</span> : null}</summary>
          <div className="fld-row">
            <label className="fld">
              <span>Название</span>
              <input value={sp.label} onChange={(e) => ((sp.label = e.target.value), commit())} />
            </label>
            <label className="fld" style={{ flex: 1 }}>
              <span>Комментарий для мастера</span>
              <input value={sp.description ?? ''} onChange={(e) => ((sp.description = e.target.value || undefined), commit())} />
            </label>
            <button className="btn btn-small ce-del" data-tip="Удалить вид" onClick={() => (list.splice(i, 1), commit())}><Ico n="close" /> </button>
          </div>
          <div className="fld-row" style={{ flexWrap: 'wrap' }}>
            {(['STR', 'CON', 'SIZ', 'DEX', 'INT', 'POW', 'CHA'] as const).map((k) => (
              <label key={k} className="fld fld-num">
                <span>{k}</span>
                <input
                  type="number" min={1} max={99}
                  value={sp.stats?.[k] ?? 10}
                  onChange={(e) => (((sp.stats ??= {})[k] = Number(e.target.value) || 10), commit())}
                />
              </label>
            ))}
            <label className="fld fld-num" data-tip="Очки брони без предмета (шкура, кости, кираса рода)">
              <span>Броня</span>
              <input type="number" min={0} value={sp.armor ?? 0} onChange={(e) => ((sp.armor = Number(e.target.value) || undefined), commit())} />
            </label>
          </div>
          <div className="fld-block">
            <span className="fld-caption">Навыки вида</span>
            {Object.entries(sp.skills ?? {}).map(([skill, val], j) => (
              <div className="fld-row" key={j}>
                <RefSelect label="Навык" kind="skill" store={store} value={skill} optional={false} onChange={(v) => {
                  const sk = { ...(sp.skills ?? {}) }
                  delete sk[skill]
                  sk[v ?? ''] = val
                  sp.skills = sk
                  commit()
                }} />
                <label className="fld fld-num">
                  <span>%</span>
                  <input type="number" min={0} max={200} value={val} onChange={(e) => (((sp.skills ??= {})[skill] = Number(e.target.value) || 0), commit())} />
                </label>
                <button className="btn btn-small ce-del" data-tip="Убрать навык" onClick={() => {
                  const sk = { ...(sp.skills ?? {}) }
                  delete sk[skill]
                  sp.skills = sk
                  commit()
                }}><Ico n="close" /> </button>
              </div>
            ))}
            <button className="btn btn-small" onClick={() => {
              const sk = { ...(sp.skills ?? {}) }
              const free = store.options('skill').find((o) => !(o.id in sk))
              sk[free?.id ?? 'spot'] = 30
              sp.skills = sk
              commit()
            }}>+ навык</button>
          </div>
          <div className="fld-block">
            <span className="fld-caption">Природное оружие (укус, когти — необязательно)</span>
            <label className="fld fld-check" style={{ marginBottom: 6 }}>
              <input
                type="checkbox"
                checked={!!sp.natural_weapon}
                onChange={(e) => {
                  if (e.target.checked) sp.natural_weapon = { skill: store.options('skill')[0]?.id ?? 'brawl', damage: '1d4', label: 'Удар' }
                  else delete sp.natural_weapon
                  commit()
                }}
              />
              <span>У вида есть природное оружие</span>
            </label>
            {sp.natural_weapon && (
              <div className="fld-row" style={{ flexWrap: 'wrap' }}>
                <RefSelect label="Навык атаки" kind="skill" store={store} value={sp.natural_weapon.skill} optional={false} onChange={(v) => ((sp.natural_weapon!.skill = v ?? ''), commit())} />
                <DiceNotationInput
                  label="Урон"
                  tip="Нотация кубиков природной атаки, напр. 1d4"
                  value={sp.natural_weapon.damage}
                  onChange={(v) => ((sp.natural_weapon!.damage = v), commit())}
                />
                <label className="fld">
                  <span>Название удара</span>
                  <input value={sp.natural_weapon.label ?? ''} onChange={(e) => ((sp.natural_weapon!.label = e.target.value || undefined), commit())} />
                </label>
                <label className="fld fld-check" data-tip="Прибавлять бонус повреждения от силы к урону">
                  <input type="checkbox" checked={!!sp.natural_weapon.damage_bonus} onChange={(e) => ((sp.natural_weapon!.damage_bonus = e.target.checked || undefined), commit())} />
                  <span>+ бонус силы</span>
                </label>
              </div>
            )}
          </div>
          <div className="fld-block">
            <span className="fld-caption">Способности вида (из реестра «Статусы и способности»)</span>
            <div className="chips">
              {(m.abilities ?? []).map((a) => {
                const on = (sp.abilities ?? []).includes(a.id)
                return (
                  <button key={a.id} type="button" className={`chip ${on ? 'chip-on' : ''}`} onClick={() => {
                    const set = new Set(sp.abilities ?? [])
                    if (on) set.delete(a.id); else set.add(a.id)
                    if (set.size) sp.abilities = [...set]; else delete sp.abilities
                    commit()
                  }}>{a.label || a.id}</button>
                )
              })}
              {(m.abilities ?? []).length === 0 && <span className="muted small">В кампании пока нет способностей.</span>}
            </div>
          </div>
          <div className="fld-row">
            <label className="fld fld-num" data-tip="Ниже этого % здоровья существо может бросить бой">
              <span>Порог бегства, % HP</span>
              <input
                type="number" min={0} max={100}
                value={sp.morale?.below_hp_pct ?? ''} placeholder="не сбегает"
                onChange={(e) => {
                  const v = Number(e.target.value) || 0
                  if (v > 0) sp.morale = { below_hp_pct: v, flee_chance: sp.morale?.flee_chance ?? 50 }
                  else delete sp.morale
                  commit()
                }}
              />
            </label>
            {sp.morale && (
              <label className="fld fld-num" data-tip="Шанс побега в начале хода (0–100%)">
                <span>Шанс побега, %</span>
                <input type="number" min={0} max={100} value={sp.morale.flee_chance} onChange={(e) => ((sp.morale!.flee_chance = Number(e.target.value) || 0), commit())} />
              </label>
            )}
          </div>
        </details>
      ))}
      <button
        className="btn btn-small"
        onClick={async () => {
          const label = await askText('Название вида', 'например «Горная крыса»')
          if (!label) return
          list.push({ id: makeId('species_', label, list.map((x) => x.id)), label, stats: { STR: 10, CON: 10, SIZ: 10, DEX: 10, INT: 10, POW: 10, CHA: 10 } })
          commit()
        }}
      >
        + вид
      </button>
    </div>
  )
}

/**
 * Портреты героя (пункт «портрет героя»): галерея готовых карточек и/или
 * составной облик по сегментам («лицо», «волосы», «одежда»). Игрок выбирает
 * на экране создания персонажа; портрет едет в лист персонажа. У каждого
 * варианта — состояния облика: ранен (< половины HP), устал (потребность ≤ 25),
 * обычный, либо любой статус из реестра (пока он активен на герое).
 */
export function HeroPortraitsEditor({ m, store, commit }: { m: CampaignMeta; store: EditorStore; commit: () => void }) {
  const cc = (m.char_creation ??= ({} as CampaignMeta['char_creation']))!
  if (!cc.total_points) return null // блок выключен — портретам неоткуда жить
  const emotions = m.emotions ?? []
  const statuses = m.statuses ?? []
  let uid = 1 + (cc.portraits?.length ?? 0) + (cc.portrait_layers?.reduce((n, l) => n + l.options.length, 0) ?? 0)
  const nextId = (prefix: string) => `${prefix}_${uid++}`

  /** конструктор состояний облика: выбор ключа + свой кадр */
  function StatesEditor({ states, dir, onChange }: { states: Record<string, ImageValue> | undefined; dir: string; onChange: (v: Record<string, ImageValue> | undefined) => void }) {
    const cur = states ?? {}
    const stdKeys: Array<{ id: string; label: string }> = [
      { id: 'wounded', label: 'Ранен (HP < 50%)' },
      { id: 'tired', label: 'Устал (потребность ≤ 25)' },
      { id: 'neutral', label: 'Обычный (по умолчанию)' },
    ]
    const statusKeys = statuses.map((st) => ({ id: st.id, label: `Статус «${st.label || st.id}»` }))
    const allKeys = [...stdKeys, ...statusKeys]
    return (
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {Object.keys(cur).map((k) => (
          <div key={k} style={{ position: 'relative' }}>
            <AnimImageEditor
              label={allKeys.find((x) => x.id === k)?.label ?? k}
              value={cur[k]}
              dir={dir}
              store={store}
              onChange={(v) => {
                const next = { ...cur }
                if (v) next[k] = v
                else delete next[k]
                onChange(Object.keys(next).length ? next : undefined)
              }}
            />
            <button
              className="btn btn-small ce-del"
              data-tip="Убрать состояние"
              style={{ position: 'absolute', top: 0, right: 0 }}
              onClick={() => {
                const next = { ...cur }
                delete next[k]
                onChange(Object.keys(next).length ? next : undefined)
              }}
            >
              <Ico n="close" />
            </button>
          </div>
        ))}
        <select
          className="btn btn-small"
          value=""
          data-tip="Добавить состояние облика — отдельный кадр для этого случая"
          onChange={(e) => {
            const k = e.target.value
            if (!k) return
            onChange({ ...cur, [k]: '' })
          }}
        >
          <option value="">+ состояние…</option>
          {allKeys.filter((k) => !(k.id in cur)).map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
        </select>
        {emotions.length > 0 && (
          <span className="muted small" style={{ alignSelf: 'center' }}>свои ключи состояний — из реестра «Состояния» выше</span>
        )}
      </div>
    )
  }

  /** карточка портрета галереи */
  function PortraitRow({ p }: { p: NonNullable<typeof cc.portraits>[number] }) {
    const list = cc.portraits!
    return (
      <details className="need-conds">
        <summary>
          {p.label || '(без названия)'}
          <button
            className="btn btn-small ce-del"
            data-tip="Удалить портрет"
            onClick={(e) => {
              e.preventDefault(); e.stopPropagation()
              list.splice(list.indexOf(p), 1)
              if (!list.length) delete cc.portraits
              commit()
            }}
          >
            <Ico n="close" />
          </button>
        </summary>
        <div className="fld-row" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <label className="fld" style={{ minWidth: 160 }}>
            <span>Название</span>
            <input value={p.label} onChange={(e) => ((p.label = e.target.value), commit())} />
          </label>
          <AnimImageEditor
            label="Портрет"
            value={p.image}
            dir="assets/img/hero"
            store={store}
            onChange={(v) => ((p.image = v ?? ''), commit())}
          />
        </div>
        <AnimImageEditor
          label="Статическая фигурка боя для этого постоянного облика (не меняется от экипировки)"
          value={p.combat_figure}
          dir="assets/img/hero"
          store={store}
          onChange={(v) => { if (v) p.combat_figure = v; else delete p.combat_figure; commit() }}
        />
        {!!p.combat_figure && <label className="fld" style={{ maxWidth: 240 }}><span>Разворот фигурки</span><select value={p.combat_figure_mode ?? ''} onChange={(e) => { if (e.target.value) p.combat_figure_mode = e.target.value as 'topdown' | 'side' | 'static'; else delete p.combat_figure_mode; commit() }}><option value="">Как у шаблона героя</option><option value="topdown">Сверху (поворачивать)</option><option value="side">Сбоку (зеркалить)</option><option value="static">Статичная</option></select></label>}
        <div className="muted small" style={{ margin: '4px 0' }}>Состояния облика (необязательно):</div>
        <StatesEditor
          states={p.states}
          dir="assets/img/hero"
          onChange={(v) => ((p.states = v), commit())}
        />
      </details>
    )
  }

  /** сегмент составного портрета */
  function LayerGroup({ layer }: { layer: HeroPortraitLayerDef }) {
    const layers = cc.portrait_layers!
    return (
      <details className="need-conds">
        <summary>
          {layer.label || '(сегмент)'} · вариантов: {layer.options.length}
          <button
            className="btn btn-small ce-del"
            data-tip="Удалить сегмент"
            onClick={(e) => {
              e.preventDefault(); e.stopPropagation()
              layers.splice(layers.indexOf(layer), 1)
              if (!layers.length) delete cc.portrait_layers
              commit()
            }}
          >
            <Ico n="close" />
          </button>
        </summary>
        <div className="fld-row" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label className="fld" style={{ maxWidth: 260 }}>
            <span>Название настройки (видит игрок)</span>
            <input value={layer.label} onChange={(e) => ((layer.label = e.target.value), commit())} />
          </label>
          <label className="fld" style={{ minWidth: 190 }}>
            <span>Категория внешности</span>
            <select value={layer.category ?? 'other'} onChange={(e) => { layer.category = e.target.value as HeroPortraitLayerDef['category']; commit() }}>
              <option value="other">Другое</option><option value="identity">Пол / представление</option><option value="skin">Цвет кожи</option><option value="build">Телосложение</option><option value="face">Лицо</option><option value="hair">Волосы</option><option value="clothing">Одежда</option><option value="markings">Татуировки и отметины</option>
            </select>
          </label>
        </div>
        {layer.options.map((o) => (
          <details key={o.id} className="need-conds" style={{ marginLeft: 8 }}>
            <summary>
              {o.label || '(вариант)'}
              <button
                className="btn btn-small ce-del"
                data-tip="Удалить вариант"
                onClick={(e) => {
                  e.preventDefault(); e.stopPropagation()
                  layer.options.splice(layer.options.indexOf(o), 1)
                  commit()
                }}
              >
                <Ico n="close" />
              </button>
            </summary>
            <div className="fld-row" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <label className="fld" style={{ minWidth: 140 }}>
                <span>Название варианта</span>
                <input value={o.label} onChange={(e) => ((o.label = e.target.value), commit())} />
              </label>
              <AnimImageEditor
                label="Изображение слоя"
                value={o.image}
                dir="assets/img/hero"
                store={store}
                onChange={(v) => ((o.image = v ?? ''), commit())}
              />
            </div>
            <StatesEditor
              states={o.states}
              dir="assets/img/hero"
              onChange={(v) => ((o.states = v), commit())}
            />
            <AnimImageEditor
              label="Статическая фигурка боя для этого постоянного варианта (не зависит от экипировки)"
              value={o.combat_figure}
              dir="assets/img/hero"
              store={store}
              onChange={(v) => { if (v) o.combat_figure = v; else delete o.combat_figure; commit() }}
            />
            {!!o.combat_figure && <label className="fld" style={{ maxWidth: 240 }}><span>Разворот фигурки</span><select value={o.combat_figure_mode ?? ''} onChange={(e) => { if (e.target.value) o.combat_figure_mode = e.target.value as 'topdown' | 'side' | 'static'; else delete o.combat_figure_mode; commit() }}><option value="">Как у шаблона героя</option><option value="topdown">Сверху (поворачивать)</option><option value="side">Сбоку (зеркалить)</option><option value="static">Статичная</option></select></label>}
          </details>
        ))}
        <button
          className="btn btn-small"
          onClick={() => (layer.options.push({ id: nextId('opt'), label: 'Вариант', image: '' }), commit())}
        >
          <Ico n="plus" /> Вариант
        </button>
      </details>
    )
  }

  return (
    <div className="props-group" style={{ marginTop: 8 }}>
      <h4>Портрет героя</h4>
      <div className="muted small" style={{ marginBottom: 8 }}>
        Включайте только нужные настройки: готовые портреты и/или сегменты внешности (цвет кожи, телосложение, волосы, татуировки и любые собственные категории). Без вариантов этот раздел игроку не показывается. Фигурку боя можно задать как постоянный вариант начального облика; экипировка на неё не влияет.
      </div>
      {(cc.portraits ?? []).map((p) => <PortraitRow key={p.id} p={p} />)}
      <button
        className="btn btn-small"
        onClick={() => ((cc.portraits ??= []).push({ id: nextId('portrait'), label: 'Портрет', image: '' }), commit())}
      >
        <Ico n="plus" /> Готовый портрет
      </button>
      <div className="muted small" style={{ margin: '10px 0 6px' }}>Составной облик по сегментам:</div>
      {(cc.portrait_layers ?? []).map((l) => <LayerGroup key={l.id} layer={l} />)}
      <div>
        <button
          className="btn btn-small"
          onClick={() => ((cc.portrait_layers ??= []).push({ id: nextId('layer'), label: 'Сегмент', category: 'other', options: [{ id: nextId('opt'), label: 'Вариант', image: '' }] }), commit())}
        >
          <Ico n="plus" /> Сегмент облика
        </button>
      </div>
    </div>
  )
}
