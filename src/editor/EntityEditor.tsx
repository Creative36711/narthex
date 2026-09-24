import { useState } from 'react'
import type { ItemDef, NpcDef, StatBlock } from '../shared/types'
import type { EditorStore } from './store'
import { JsonField } from './Fields'

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
        <h4>Предмет · <code>{item.id}</code></h4>
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
        <label className="fld">
          <span>Изображение (путь)</span>
          <input value={item.image ?? ''} onChange={(e) => {
            if (e.target.value) item.image = e.target.value
            else delete item.image
            commit()
          }} />
        </label>
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
            <label className="fld">
              <span>Навык</span>
              <input value={item.weapon_data.skill} onChange={(e) => ((item.weapon_data!.skill = e.target.value), commit())} />
            </label>
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
        <h4>NPC · <code>{npc.id}</code></h4>
        <div className="fld-row">
          <label className="fld">
            <span>Имя</span>
            <input value={npc.label} onChange={(e) => ((npc.label = e.target.value), commit())} />
          </label>
          <label className="fld">
            <span>Фракция</span>
            <input value={npc.faction ?? ''} onChange={(e) => {
              if (e.target.value) npc.faction = e.target.value
              else delete npc.faction
              commit()
            }} />
          </label>
          <label className="fld">
            <span>Личная поправка</span>
            <input type="number" value={npc.base_disposition ?? 0} onChange={(e) => ((npc.base_disposition = Number(e.target.value)), commit())} />
          </label>
        </div>
        <div className="fld-row">
          <label className="fld">
            <span>Диалог (.ink)</span>
            <input list="dlg-paths" value={npc.dialogue ?? ''} onChange={(e) => {
              if (e.target.value) npc.dialogue = e.target.value
              else delete npc.dialogue
              commit()
            }} />
            <datalist id="dlg-paths">
              {store.dialoguePaths().map((p) => <option key={p} value={p} />)}
            </datalist>
          </label>
          <label className="fld">
            <span>Портрет neutral (путь)</span>
            <input value={npc.portrait?.neutral ?? ''} onChange={(e) => {
              npc.portrait = { ...(npc.portrait ?? {}), neutral: e.target.value }
              if (!e.target.value) delete npc.portrait.neutral
              commit()
            }} />
          </label>
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
        {Object.entries(npc.skills).map(([k, v]) => (
          <div key={k} className="journal-row">
            <input
              className="journal-key"
              value={k}
              onChange={(e) => {
                const entries = Object.entries(npc.skills)
                npc.skills = Object.fromEntries(entries.map(([kk, vv]) => (kk === k ? [e.target.value, vv] : [kk, vv])))
                commit()
              }}
            />
            <input
              type="number"
              className="journal-key"
              value={v}
              onChange={(e) => ((npc.skills[k] = Number(e.target.value)), commit())}
            />
            <button className="btn btn-small ce-del" onClick={() => (delete npc.skills[k], commit())}>✕</button>
          </div>
        ))}
        <button className="btn btn-small" onClick={() => ((npc.skills[`skill_${Object.keys(npc.skills).length + 1}`] = 30), commit())}>
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
