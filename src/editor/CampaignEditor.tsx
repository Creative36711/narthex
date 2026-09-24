import { useState } from 'react'
import type { EditorStore } from './store'
import { JsonField } from './Fields'
import { BUILTIN_SKILL_LABELS } from '../shared/skills'
import { makeId } from './ids'
import { BUILTIN_SLOT_TYPES } from './slotTypes'
import { askText } from './prompt'

/** Редактор campaign.json формой: мета, время, старт, потребности, фракции. */
export function CampaignEditor({ store }: { store: EditorStore }) {
  const m = store.meta
  // дефолты для необязательных полей (без touch — просто нормализация)
  if (!m.time_of_day) m.time_of_day = { morning: 6, day: 10, evening: 18, night: 22 }
  if (!m.factions) m.factions = []
  if (!m.roguelike) m.roguelike = { permadeath: true, meta_progress: [], randomize_on_restart: [] }
  if (m.starting_tick === undefined) m.starting_tick = 0
  if (m.max_companions === undefined) m.max_companions = 2
  const [, force] = useState(0)
  const commit = () => {
    store.touch('campaign.json')
    force((n) => n + 1)
  }
  const [gen, setGen] = useState(0)

  const sceneOpts = store.options('scene')
  const locOpts = store.options('location')
  const regionOpts = store.world.regions.map((r) => ({ id: r.id, label: r.label }))
  const npcOpts = store.options('npc')

  return (
    <div className="rule-editor">
      <div className="props-group">
        <h4>О кампании</h4>
        <div className="fld-row">
          <label className="fld">
            <span>Название</span>
            <input value={m.title} onChange={(e) => ((m.title = e.target.value), commit())} />
          </label>
          <label className="fld">
            <span>Автор</span>
            <input value={m.author} onChange={(e) => ((m.author = e.target.value), commit())} />
          </label>
          <label className="fld">
            <span>Версия</span>
            <input value={m.version} onChange={(e) => ((m.version = e.target.value), commit())} />
          </label>
        </div>
        <label className="fld fld-block">
          <span>Описание (видно в главном меню)</span>
          <textarea rows={3} value={m.description} onChange={(e) => ((m.description = e.target.value), commit())} />
        </label>
      </div>

      <div className="props-group">
        <h4>Время</h4>
        <div className="fld-row">
          <label className="fld">
            <span>Название тика</span>
            <input value={m.tick_label} onChange={(e) => ((m.tick_label = e.target.value), commit())} />
          </label>
          <label className="fld">
            <span>Тиков в сутках</span>
            <input type="number" value={m.ticks_per_day} onChange={(e) => ((m.ticks_per_day = Number(e.target.value)), commit())} />
          </label>
          {(['morning', 'day', 'evening', 'night'] as const).map((k) => (
            <label key={k} className="fld">
              <span>{{ morning: 'Утро с', day: 'День с', evening: 'Вечер с', night: 'Ночь с' }[k]}</span>
              <input type="number" value={m.time_of_day![k]} onChange={(e) => ((m.time_of_day![k] = Number(e.target.value)), commit())} />
            </label>
          ))}
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
          <label className="fld">
            <span>Стартовый тик</span>
            <input type="number" value={m.starting_tick ?? 0} onChange={(e) => ((m.starting_tick = Number(e.target.value)), commit())} />
          </label>
          <label className="fld">
            <span>Макс. напарников</span>
            <input type="number" value={m.max_companions ?? 2} onChange={(e) => ((m.max_companions = Number(e.target.value)), commit())} />
          </label>
        </div>
      </div>

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
            <label className="fld" title="Ниже этого значения полоска подсвечивается красным — предупреждение игроку">
              <span>Тревога ниже</span>
              <input type="number" value={n.critical_threshold} onChange={(e) => ((n.critical_threshold = Number(e.target.value)), commit())} />
            </label>
            <label className="fld" title="Что случится, когда потребность упадёт до нуля">
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
            <button className="btn btn-small ce-del" title="Удалить" onClick={() => (m.needs.splice(i, 1), commit())}>✕</button>
          </div>
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
              <span>Отношение к игроку</span>
              <input type="number" value={f.base_disposition} onChange={(e) => ((f.base_disposition = Number(e.target.value)), commit())} />
            </label>
            <button className="btn btn-small ce-del" title="Удалить" onClick={() => (m.factions!.splice(i, 1), commit())}>✕</button>
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
        {(m.skills ?? []).map((sk, i) => (
          <div key={i} className="fld-row need-row">
            <label className="fld">
              <span>Название</span>
              <input value={sk.label} onChange={(e) => ((sk.label = e.target.value), commit())} />
            </label>
            <button className="btn btn-small ce-del" title="Удалить" onClick={() => (m.skills!.splice(i, 1), commit())}>✕</button>
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

      <div className="props-group">
        <h4>Флаги</h4>
        <div className="muted small" style={{ marginBottom: 8 }}>
          Флаги — «память мира»: отметки о событиях (что сделано, о чём узнали).
          Здесь их реестр с понятными названиями; в правилах, сценах и диалогах флаг
          выбирается из списка (или создаётся на месте).
        </div>
        {(m.flags ?? []).map((f, i) => (
          <div key={i} className="fld-row need-row">
            <label className="fld">
              <span>Название</span>
              <input value={f.label} onChange={(e) => ((f.label = e.target.value), commit())} />
            </label>
            <label className="fld" style={{ flex: 2 }}>
              <span>Для чего нужен</span>
              <input
                value={f.description ?? ''}
                placeholder="необязательно"
                onChange={(e) => {
                  if (e.target.value) f.description = e.target.value
                  else delete f.description
                  commit()
                }}
              />
            </label>
            <button className="btn btn-small ce-del" title="Удалить из реестра (контент, где флаг используется, не меняется)" onClick={() => (m.flags!.splice(i, 1), commit())}>✕</button>
          </div>
        ))}
        <button
          className="btn btn-small"
          onClick={async () => {
            const label = await askText('Название нового флага', 'например «Мост разрушен»')
            if (!label) return
            if (!m.flags) m.flags = []
            m.flags.push({ id: makeId('', label, m.flags.map((x) => x.id)), label })
            commit()
          }}
        >
          + флаг
        </button>
      </div>

      <div className="props-group">
        <h4>Типы слотов сцены</h4>
        <div className="muted small" style={{ marginBottom: 8 }}>
          Что можно ставить в слоты на сценах. Каждой сущности назначается тип
          в её карточке — по нему фильтруется выбор «кто/что стоит в слоте».
          Встроенные типы удалить нельзя; добавьте свои — например «Робот» или «Дух».
        </div>
        <div className="chips" style={{ marginBottom: 8 }}>
          {BUILTIN_SLOT_TYPES.map((t) => (
            <span key={t.id} className="chip chip-static" title="Встроенный тип — удалить нельзя">
              {t.label}
            </span>
          ))}
        </div>
        {(m.slot_types ?? []).map((t, i) => (
          <div key={i} className="fld-row need-row">
            <label className="fld">
              <span>Название</span>
              <input value={t.label} onChange={(e) => ((t.label = e.target.value), commit())} />
            </label>
            <button className="btn btn-small ce-del" title="Удалить" onClick={() => (m.slot_types!.splice(i, 1), commit())}>✕</button>
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
        <h4>Категории предметов</h4>
        <div className="muted small" style={{ marginBottom: 8 }}>
          Категория определяет, что умеет предмет: восстанавливать здоровье или потребности,
          быть оружием или бронёй. Поля в форме предмета появляются по его категории.
        </div>
        {(m.item_categories ?? []).map((c, i) => (
          <div key={i} className="fld-row need-row" style={{ flexWrap: 'wrap' }}>
            <label className="fld">
              <span>Название</span>
              <input value={c.label} onChange={(e) => ((c.label = e.target.value), commit())} />
            </label>
            <label className="fld fld-check" title="Предметы категории можно использовать для лечения">
              <input type="checkbox" checked={!!c.restores_hp} onChange={(e) => {
                if (e.target.checked) c.restores_hp = true
                else delete c.restores_hp
                commit()
              }} />
              <span>Лечит (HP)</span>
            </label>
            {m.needs.map((n) => (
              <label key={n.id} className="fld fld-check" title={`Предметы категории восстанавливают «${n.label}»`}>
                <input
                  type="checkbox"
                  checked={(c.restores_needs ?? []).includes(n.id)}
                  onChange={(e) => {
                    const set = new Set(c.restores_needs ?? [])
                    if (e.target.checked) set.add(n.id)
                    else set.delete(n.id)
                    if (set.size) c.restores_needs = [...set]
                    else delete c.restores_needs
                    commit()
                  }}
                />
                <span>{n.label}</span>
              </label>
            ))}
            <label className="fld fld-check">
              <input type="checkbox" checked={!!c.is_weapon} onChange={(e) => {
                if (e.target.checked) c.is_weapon = true
                else delete c.is_weapon
                commit()
              }} />
              <span>Оружие</span>
            </label>
            <label className="fld fld-check">
              <input type="checkbox" checked={!!c.is_armor} onChange={(e) => {
                if (e.target.checked) c.is_armor = true
                else delete c.is_armor
                commit()
              }} />
              <span>Броня</span>
            </label>
            <button className="btn btn-small ce-del" title="Удалить" onClick={() => (m.item_categories!.splice(i, 1), commit())}>✕</button>
          </div>
        ))}
        <button
          className="btn btn-small"
          onClick={async () => {
            const label = await askText('Название категории предметов', 'например «Зелья»')
            if (!label) return
            if (!m.item_categories) m.item_categories = []
            m.item_categories.push({ id: makeId('cat_', label, m.item_categories.map((x) => x.id)), label })
            commit()
          }}
        >
          + категория
        </button>
      </div>

      <div className="props-group">
        <h4>Рогалик</h4>
        <label className="fld fld-check">
          <input type="checkbox" checked={m.roguelike!.permadeath} onChange={(e) => ((m.roguelike!.permadeath = e.target.checked), commit())} />
          <span>Перманентная смерть (сейв удаляется при гибели)</span>
        </label>
      </div>

      <details className="advanced-json" onToggle={(e) => (e.target as HTMLDetailsElement).open && setGen((n) => n + 1)}>
        <summary>Расширенный JSON (валюты, мета-прогресс, отношения фракций)</summary>
        <JsonField
          key={gen}
          label=""
          rows={16}
          pretty
          value={m}
          onChange={(v) => {
            if (v !== undefined) {
              Object.assign(store, { meta: v })
              commit()
            }
          }}
        />
      </details>
    </div>
  )
}

function SelectFld({ label, value, options, onChange }: { label: string; value: string; options: Array<{ id: string; label: string }>; onChange: (v: string) => void }) {
  return (
    <label className="fld">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {!options.some((o) => o.id === value) && <option value={value}>{value}</option>}
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>
    </label>
  )
}
