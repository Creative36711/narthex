import { useState } from 'react'
import type { ItemDef, NpcDef, StatBlock } from '../shared/types'
import type { EditorStore } from './store'
import { ImageUpload, JsonField, RefSelect } from './Fields'
import { BUILTIN_SKILL_LABELS } from '../shared/skills'

/**
 * Редактор сущностей формами (предмет / NPC) + «расширенный JSON» для
 * редких полей. Обычному мастеру JSON не нужен.
 */

const STATS: Array<keyof StatBlock> = ['STR', 'CON', 'SIZ', 'DEX', 'INT', 'POW', 'CHA']

export function EntityEditor({ store, path }: { store: EditorStore; path: string }) {
  const ent = store.entity(path)
  const [, force] = useState(0)
  const commit = () => {
    store.touch(path)
    force((n) => n + 1)
  }
  if (!ent) return null
  return ent.type === 'item' ? (
    <ItemForm item={ent} store={store} path={path} commit={commit} />
  ) : (
    <NpcForm npc={ent} store={store} path={path} commit={commit} />
  )
}

function AdvancedJson({ store, path, commit }: { store: EditorStore; path: string; commit: () => void }) {
  const [gen, setGen] = useState(0)
  return (
    <details className="advanced-json" onToggle={(e) => (e.target as HTMLDetailsElement).open && setGen((n) => n + 1)}>
      <summary>Расширенный JSON (все поля)</summary>
      <JsonField
        key={gen}
        label=""
        rows={14}
        pretty
        value={store.jsonFiles.get(path)}
        onChange={(v) => {
          if (v !== undefined) {
            store.jsonFiles.set(path, v)
            commit()
          }
        }}
      />
    </details>
  )
}

function ItemForm({
  item,
  store,
  path,
  commit,
}: {
  item: ItemDef
  store: EditorStore
  path: string
  commit: () => void
}) {
  const silver = item.value?.item_silver ?? ''
  return (
    <div className="rule-editor">
      <div className="props-group">
        <h4>Предмет</h4>
        <div className="fld-row">
          <label className="fld">
            <span>Название</span>
            <input value={item.label} onChange={(e) => ((item.label = e.target.value), commit())} />
          </label>
          <label className="fld">
            <span>Категория</span>
            <input value={item.category} onChange={(e) => ((item.category = e.target.value), commit())} />
          </label>
        </div>
        <label className="fld fld-block">
          <span>Описание</span>
          <textarea rows={2} value={item.description} onChange={(e) => ((item.description = e.target.value), commit())} />
        </label>
        <div className="fld-row">
          <label className="fld">
            <span>Вес, кг</span>
            <input type="number" step="0.1" value={item.weight} onChange={(e) => ((item.weight = Number(e.target.value)), commit())} />
          </label>
          <label className="fld">
            <span>Цена (серебро)</span>
            <input
              type="number"
              value={silver}
              onChange={(e) => {
                if (e.target.value === '') delete item.value
                else item.value = { ...(item.value ?? {}), item_silver: Number(e.target.value) }
                commit()
              }}
            />
          </label>
          <label className="fld fld-check">
            <input type="checkbox" checked={item.stackable} onChange={(e) => ((item.stackable = e.target.checked), commit())} />
            <span>Стакается</span>
          </label>
        </div>
        <ImageUpload
          label="Изображение предмета"
          value={item.image ?? ''}
          dir="assets/img/items"
          store={store}
          onChange={(p) => {
            if (p) item.image = p
            else delete item.image
            commit()
          }}
        />
      </div>

      <div className="props-group">
        <h4>Боевые свойства</h4>
        <div className="fld-row">
          <label className="fld fld-check">
            <input
              type="checkbox"
              checked={!!item.weapon_data}
              onChange={(e) => {
                if (e.target.checked)
                  item.weapon_data = { skill: 'sword', damage: '1d6', damage_bonus: true, range: 1, attacks_per_round: 1, parry_capable: true }
                else delete item.weapon_data
                commit()
              }}
            />
            <span>Это оружие</span>
          </label>
          <label className="fld fld-check">
            <input
              type="checkbox"
              checked={!!item.armor_data}
              onChange={(e) => {
                if (e.target.checked) item.armor_data = { points: 1 }
                else delete item.armor_data
                commit()
              }}
            />
            <span>Это броня</span>
          </label>
        </div>
        {item.weapon_data && (
          <div className="fld-row">
            <SkillSelect
              label="Навык владения"
              store={store}
              value={item.weapon_data.skill}
              onChange={(v) => ((item.weapon_data!.skill = v), commit())}
            />
            <label className="fld">
              <span>Урон (кости)</span>
              <input value={item.weapon_data.damage} onChange={(e) => ((item.weapon_data!.damage = e.target.value), commit())} />
            </label>
            <label className="fld fld-check">
              <input type="checkbox" checked={item.weapon_data.damage_bonus} onChange={(e) => ((item.weapon_data!.damage_bonus = e.target.checked), commit())} />
              <span>+ бонус силы</span>
            </label>
            <label className="fld fld-check">
              <input type="checkbox" checked={item.weapon_data.parry_capable} onChange={(e) => ((item.weapon_data!.parry_capable = e.target.checked), commit())} />
              <span>Парирует</span>
            </label>
          </div>
        )}
        {item.armor_data && (
          <label className="fld">
            <span>Очки брони (−к урону)</span>
            <input type="number" value={item.armor_data.points} onChange={(e) => ((item.armor_data!.points = Number(e.target.value)), commit())} />
          </label>
        )}
      </div>

      <AdvancedJson store={store} path={path} commit={commit} />
    </div>
  )
}

function NpcForm({
  npc,
  store,
  path,
  commit,
}: {
  npc: NpcDef
  store: EditorStore
  path: string
  commit: () => void
}) {
  return (
    <div className="rule-editor">
      <div className="props-group">
        <h4>Персонаж (NPC)</h4>
        <div className="fld-row">
          <label className="fld">
            <span>Имя</span>
            <input value={npc.label} onChange={(e) => ((npc.label = e.target.value), commit())} />
          </label>
          <RefSelect
            label="Фракция"
            kind="faction"
            store={store}
            value={npc.faction ?? ''}
            optional
            onChange={(v) => {
              if (v) npc.faction = v
              else delete npc.faction
              commit()
            }}
          />
          <label className="fld" title="Прибавка к отношению фракции лично для этого персонажа: +20 — дружелюбнее прочих, −20 — недолюбливает героя">
            <span>Личное отношение к герою (±)</span>
            <input type="number" value={npc.base_disposition ?? 0} onChange={(e) => ((npc.base_disposition = Number(e.target.value)), commit())} />
          </label>
        </div>
        <RefSelect
          label="Диалог"
          kind="dialogue"
          store={store}
          value={npc.dialogue ?? ''}
          optional
          onChange={(v) => {
            if (v) npc.dialogue = v
            else delete npc.dialogue
            commit()
          }}
        />
        <ImageUpload
          label="Портрет (обычный)"
          value={npc.portrait?.neutral ?? ''}
          dir="assets/img/npc"
          store={store}
          onChange={(p) => {
            npc.portrait = { ...(npc.portrait ?? {}), neutral: p }
            if (!p) delete npc.portrait.neutral
            commit()
          }}
        />
        <div className="fld-row">
          <ImageUpload
            label="Портрет (радость)"
            value={npc.portrait?.happy ?? ''}
            dir="assets/img/npc"
            store={store}
            onChange={(p) => {
              npc.portrait = { ...(npc.portrait ?? {}), happy: p }
              if (!p) delete npc.portrait.happy
              commit()
            }}
          />
          <ImageUpload
            label="Портрет (гнев)"
            value={npc.portrait?.angry ?? ''}
            dir="assets/img/npc"
            store={store}
            onChange={(p) => {
              npc.portrait = { ...(npc.portrait ?? {}), angry: p }
              if (!p) delete npc.portrait.angry
              commit()
            }}
          />
        </div>
      </div>

      <div className="props-group">
        <h4>Характеристики</h4>
        <div className="stats-row">
          {STATS.map((k) => (
            <label key={k} className="fld stat-fld">
              <span>{k}</span>
              <input type="number" value={npc.stats[k] ?? 10} onChange={(e) => (((npc.stats as unknown as Record<string, number>)[k] = Number(e.target.value)), commit())} />
            </label>
          ))}
          <label className="fld stat-fld">
            <span>Броня</span>
            <input type="number" value={npc.armor ?? 0} onChange={(e) => {
              const v = Number(e.target.value)
              if (v) npc.armor = v
              else delete npc.armor
              commit()
            }} />
          </label>
        </div>
      </div>

      <div className="props-group">
        <h4>Навыки</h4>
        <div className="muted small" style={{ marginBottom: 8 }}>
          Список навыков игры задаётся в разделе «Кампания» → «Навыки игры».
        </div>
        {Object.entries(npc.skills).map(([k, v]) => (
          <div key={k} className="journal-row">
            <select
              className="journal-key"
              value={k}
              onChange={(e) => {
                const entries = Object.entries(npc.skills)
                npc.skills = Object.fromEntries(entries.map(([kk, vv]) => (kk === k ? [e.target.value, vv] : [kk, vv])))
                commit()
              }}
            >
              {!store.options('skill').some((o) => o.id === k) && <option value={k}>{BUILTIN_SKILL_LABELS[k] ?? k}</option>}
              {store.options('skill').map((o) => (
                <option key={o.id} value={o.id} disabled={o.id !== k && npc.skills[o.id] !== undefined}>{o.label}</option>
              ))}
            </select>
            <input
              type="number"
              className="journal-key"
              value={v}
              onChange={(e) => ((npc.skills[k] = Number(e.target.value)), commit())}
            />
            <span className="muted small">%</span>
            <button className="btn btn-small ce-del" onClick={() => (delete npc.skills[k], commit())}>✕</button>
          </div>
        ))}
        <button
          className="btn btn-small"
          onClick={() => {
            const free = store.options('skill').find((o) => npc.skills[o.id] === undefined)
            npc.skills[free?.id ?? `skill_${Object.keys(npc.skills).length + 1}`] = 30
            commit()
          }}
        >
          + навык
        </button>
      </div>

      <AdvancedJson store={store} path={path} commit={commit} />
      <div className="muted small">
        Торговля, расписание, лут, инвентарь и природное оружие — в «Расширенном JSON».
      </div>
    </div>
  )
}


/** Выпадающий список навыков из реестра кампании (по-русски). */
function SkillSelect({
  label,
  store,
  value,
  onChange,
}: {
  label: string
  store: EditorStore
  value: string
  onChange: (v: string) => void
}) {
  const options = store.options('skill')
  return (
    <label className="fld">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {!options.some((o) => o.id === value) && <option value={value}>{BUILTIN_SKILL_LABELS[value] ?? value}</option>}
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>
    </label>
  )
}
