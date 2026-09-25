import { Ico } from '../shared/icons'
import { useState } from 'react'
import type { Effect, EmotionDef, EntityDef, ItemCategoryDef, ItemDef, NpcDef, StatBlock } from '../shared/types'
import { BUILTIN_EMOTIONS } from '../shared/types'
import type { EditorStore } from './store'
import { FlagSelect, ImageUpload, JsonField, RefSelect } from './Fields'
import { BUILTIN_SKILL_LABELS } from '../shared/skills'
import { SoundHookMapEditor } from './AudioSection'
import { askText } from './prompt'
import { slugify } from './ids'
import { slotTypesFor, defaultSlotType } from './slotTypes'

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

// ─────────────── предмет ───────────────

/** Сколько HP/потребности восстанавливает предмет (читаем из on_use). */
function getUseDelta(item: ItemDef, need?: string): number {
  for (const e of item.on_use?.effects ?? []) {
    if (!need && e.type === 'change_hp') return e.delta
    if (need && e.type === 'change_need' && e.need === need) return e.delta
  }
  return 0
}

/** Записать восстановление HP/потребности в on_use (0 — убрать эффект). */
function setUseDelta(item: ItemDef, need: string | undefined, delta: number): void {
  const effects: Effect[] = (item.on_use?.effects ?? []).filter((e) =>
    need ? !(e.type === 'change_need' && e.need === need) : e.type !== 'change_hp',
  )
  if (delta) effects.push(need ? { type: 'change_need', need, delta } : { type: 'change_hp', delta })
  if (effects.length === 0) delete item.on_use
  else item.on_use = { consume: true, ...(item.on_use ?? {}), effects }
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
  const currency = store.meta.currencies[0]
  const curId = currency?.id ?? 'silver'
  const price = item.value?.[curId] ?? ''
  const categories = store.meta.item_categories ?? []
  const cat: ItemCategoryDef | undefined = categories.find((c) => c.id === item.category)
  const needLabel = (id: string) => store.labelFor('need', id)

  const applyCategory = (id: string) => {
    item.category = id
    const c = categories.find((k) => k.id === id)
    // категория управляет боевыми свойствами: оружие/броня получают заготовки
    if (c?.is_weapon && !item.weapon_data)
      item.weapon_data = { skill: 'sword', damage: '1d6', damage_bonus: true, range: 1, attacks_per_round: 1, parry_capable: true }
    if (!c?.is_weapon) delete item.weapon_data
    if (c?.is_armor && !item.armor_data) item.armor_data = { points: 1 }
    if (!c?.is_armor) delete item.armor_data
    commit()
  }

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
            <select value={item.category} onChange={(e) => applyCategory(e.target.value)}>
              {!categories.some((c) => c.id === item.category) && <option value={item.category}>{item.category || '— не выбрана —'}</option>}
              {store.options('itemCategory').map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </label>
          <SlotTypeField e={item} store={store} commit={commit} />
        </div>
        <div className="muted small" style={{ marginBottom: 8 }}>
          Категории и их свойства настраиваются в разделе «Кампания» → «Категории предметов».
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
            <span>Цена</span>
            <input
              type="number"
              value={price}
              onChange={(e) => {
                if (e.target.value === '') {
                  if (item.value) {
                    delete item.value[curId]
                    if (Object.keys(item.value).length === 0) delete item.value
                  }
                } else item.value = { ...(item.value ?? {}), [curId]: Number(e.target.value) }
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

      {(cat?.restores_hp || (cat?.restores_needs?.length ?? 0) > 0) && (
        <div className="props-group">
          <h4>Действие при использовании</h4>
          <div className="fld-row">
            {cat?.restores_hp && (
              <label className="fld">
                <span>Восстанавливает здоровье (HP)</span>
                <input
                  type="number"
                  value={getUseDelta(item) || ''}
                  onChange={(e) => (setUseDelta(item, undefined, Number(e.target.value) || 0), commit())}
                />
              </label>
            )}
            {(cat?.restores_needs ?? []).map((n) => (
              <label key={n} className="fld">
                <span>Восстанавливает «{needLabel(n)}»</span>
                <input
                  type="number"
                  value={getUseDelta(item, n) || ''}
                  onChange={(e) => (setUseDelta(item, n, Number(e.target.value) || 0), commit())}
                />
              </label>
            ))}
          </div>
          <div className="muted small">Предмет расходуется при использовании из инвентаря.</div>
        </div>
      )}

      {cat?.is_weapon && item.weapon_data && (
        <div className="props-group">
          <h4>Свойства оружия</h4>
          <div className="fld-row">
            <SkillSelect
              label="Навык владения"
              store={store}
              value={item.weapon_data.skill}
              onChange={(v) => ((item.weapon_data!.skill = v), commit())}
            />
            <DamageInput label="Урон" value={item.weapon_data.damage} onChange={(v) => ((item.weapon_data!.damage = v), commit())} />
            <label className="fld fld-check">
              <input type="checkbox" checked={item.weapon_data.damage_bonus} onChange={(e) => ((item.weapon_data!.damage_bonus = e.target.checked), commit())} />
              <span>+ бонус силы</span>
            </label>
            <label className="fld fld-check">
              <input type="checkbox" checked={item.weapon_data.parry_capable} onChange={(e) => ((item.weapon_data!.parry_capable = e.target.checked), commit())} />
              <span>Парирует</span>
            </label>
          </div>
        </div>
      )}
      {cat?.is_armor && item.armor_data && (
        <div className="props-group">
          <h4>Свойства брони</h4>
          <label className="fld">
            <span>Очки брони (−к урону)</span>
            <input type="number" value={item.armor_data.points} onChange={(e) => ((item.armor_data!.points = Number(e.target.value)), commit())} />
          </label>
        </div>
      )}

      <div className="props-group">
        <SoundHookMapEditor
          store={store}
          value={item.sounds ?? (item.sounds = {})}
          onChange={commit}
          data-tip="Звуки действий предмета"
        />
      </div>

      <AdvancedJson store={store} path={path} commit={commit} />
    </div>
  )
}

// ─────────────── NPC ───────────────

/** состояния портрета — общий реестр кампании (фидбек 9.14) */
function emotionsOf(store: EditorStore): EmotionDef[] {
  return store.meta.emotions?.length ? store.meta.emotions : BUILTIN_EMOTIONS
}

function emLabelOf(store: EditorStore, id: string): string {
  return emotionsOf(store).find((e) => e.id === id)?.label ?? `Состояние «${id}»`
}

/** предметы, подходящие под слот снаряжения */
function itemsWhere(store: EditorStore, pred: (i: ItemDef) => boolean): Array<{ id: string; label: string }> {
  const out: Array<{ id: string; label: string }> = []
  for (const p of store.entityPaths()) {
    const e = store.entity(p)
    if (e?.type === 'item' && pred(e)) out.push({ id: e.id, label: e.label || e.id })
  }
  return out.sort((a, b) => a.label.localeCompare(b.label, 'ru'))
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
  const weapons = itemsWhere(store, (i) => !!i.weapon_data)
  const armors = itemsWhere(store, (i) => !!i.armor_data)
  const allItems = store.options('item')
  const portraitKeys = Object.keys(npc.portrait ?? {})

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
          <label className="fld" data-tip="Прибавка к отношению фракции лично для этого персонажа: +20 — дружелюбнее прочих, −20 — недолюбливает героя">
            <span>Личное отношение к герою (±)</span>
            <input type="number" value={npc.base_disposition ?? 0} onChange={(e) => ((npc.base_disposition = Number(e.target.value)), commit())} />
          </label>
          <SlotTypeField e={npc} store={store} commit={commit} />
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
      </div>

      <div className="props-group">
        <h4>Портреты (состояния)</h4>
        <div className="muted small" style={{ marginBottom: 8 }}>
          «Обычный» показывается по умолчанию; остальные состояния включаются в репликах диалога
          (в конструкторе диалогов — поле «настроение»).
        </div>
        <div className="fld-row" style={{ flexWrap: 'wrap' }}>
          {portraitKeys.map((k) => (
            <div key={k} style={{ position: 'relative' }}>
              <ImageUpload
                label={emLabelOf(store, k)}
                value={npc.portrait?.[k] ?? ''}
                dir="assets/img/npc"
                store={store}
                onChange={(p) => {
                  npc.portrait = { ...(npc.portrait ?? {}) }
                  if (p) npc.portrait[k] = p
                  else if (k !== 'neutral') delete npc.portrait[k]
                  else npc.portrait[k] = ''
                  commit()
                }}
              />
              {k !== 'neutral' && (
                <button
                  className="btn btn-small ce-del"
                  data-tip="Убрать состояние"
                  style={{ position: 'absolute', top: 0, right: 0 }}
                  onClick={() => {
                    delete npc.portrait?.[k]
                    commit()
                  }}
                >
                  <Ico n="close" /> 
                </button>
              )}
            </div>
          ))}
        </div>
        {!portraitKeys.includes('neutral') && (
          <ImageUpload
            label="Обычный"
            value=""
            dir="assets/img/npc"
            store={store}
            onChange={(p) => {
              npc.portrait = { ...(npc.portrait ?? {}), neutral: p }
              commit()
            }}
          />
        )}
        <div className="fld-row">
          {emotionsOf(store)
            .filter((e) => !portraitKeys.includes(e.id))
            .map((e) => (
              <button
                key={e.id}
                className="btn btn-small"
                onClick={() => {
                  npc.portrait = { ...(npc.portrait ?? {}), [e.id]: '' }
                  commit()
                }}
              >
                + {e.label}
              </button>
            ))}
          <button
            className="btn btn-small"
            onClick={async () => {
              const name = await askText('Название нового состояния', 'например «Задумчивость»')
              if (!name) return
              const key = slugify(name) || `state_${portraitKeys.length + 1}`
              // своё состояние попадает в общий реестр кампании
              if (!store.meta.emotions?.some((e) => e.id === key)) {
                if (!store.meta.emotions) store.meta.emotions = [...BUILTIN_EMOTIONS]
                store.meta.emotions.push({ id: key, label: name })
                store.touch('campaign.json')
              }
              npc.portrait = { ...(npc.portrait ?? {}), [key]: '' }
              commit()
            }}
          >
            + своё состояние…
          </button>
        </div>
        <ImageUpload
          label="Изображение в бою (жетон на арене)"
          value={npc.token ?? ''}
          dir="assets/img/npc"
          store={store}
          onChange={(p) => {
            if (p) npc.token = p
            else delete npc.token
            commit()
          }}
        />
        <div className="muted small">Если жетон не задан, в бою используется обычный портрет.</div>
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
        </div>
        <div className="fld-row" style={{ marginTop: 8 }}>
          <label className="fld" data-tip="Шкура, панцирь, чешуя — снижает получаемый урон. Не путать с надетой бронёй: предмет-броня из снаряжения даёт свои очки поверх природной защиты.">
            <span>Природная защита (очки)</span>
            <input type="number" value={npc.armor ?? 0} onChange={(e) => {
              const v = Number(e.target.value)
              if (v) npc.armor = v
              else delete npc.armor
              commit()
            }} />
          </label>
        </div>
        <div className="muted small">
          Природная защита — свойство существа (шкура, панцирь). Надетая броня из снаряжения ниже добавляет свои очки отдельно.
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
            <button className="btn btn-small ce-del" onClick={() => (delete npc.skills[k], commit())}><Ico n="close" /> </button>
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

      <div className="props-group">
        <h4>Снаряжение и инвентарь</h4>
        <div className="fld-row">
          <label className="fld">
            <span>Оружие в руках</span>
            <select
              value={npc.equipment?.weapon ?? ''}
              onChange={(e) => {
                npc.equipment = { ...(npc.equipment ?? {}) }
                if (e.target.value) npc.equipment.weapon = e.target.value
                else delete npc.equipment.weapon
                if (Object.keys(npc.equipment).length === 0) delete npc.equipment
                commit()
              }}
            >
              <option value="">— без оружия (кулаки / природное) —</option>
              {weapons.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </label>
          <label className="fld">
            <span>Надетая броня</span>
            <select
              value={npc.equipment?.armor ?? ''}
              onChange={(e) => {
                npc.equipment = { ...(npc.equipment ?? {}) }
                if (e.target.value) npc.equipment.armor = e.target.value
                else delete npc.equipment.armor
                if (Object.keys(npc.equipment).length === 0) delete npc.equipment
                commit()
              }}
            >
              <option value="">— без брони —</option>
              {armors.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="muted small" style={{ marginBottom: 8 }}>Прочее имущество (для торговли и сюжета):</div>
        {(npc.inventory ?? []).map((entry, i) => (
          <div key={i} className="journal-row">
            <select
              className="journal-key"
              value={entry.item}
              onChange={(e) => ((entry.item = e.target.value), commit())}
            >
              {!allItems.some((o) => o.id === entry.item) && <option value={entry.item}>{entry.item || '— предмет —'}</option>}
              {allItems.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
            <input
              type="number"
              className="journal-key"
              min={1}
              value={entry.quantity}
              onChange={(e) => ((entry.quantity = Math.max(1, Number(e.target.value))), commit())}
            />
            <span className="muted small">шт.</span>
            <button
              className="btn btn-small ce-del"
              onClick={() => {
                npc.inventory!.splice(i, 1)
                if (npc.inventory!.length === 0) delete npc.inventory
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
            npc.inventory = [...(npc.inventory ?? []), { item: allItems[0]?.id ?? '', quantity: 1 }]
            commit()
          }}
        >
          + предмет
        </button>
      </div>

      <div className="props-group">
        <h4>Торговля</h4>
        <label className="fld fld-check">
          <input
            type="checkbox"
            checked={!!npc.trader}
            onChange={(e) => {
              if (e.target.checked) npc.trader = { sells: [], buys: true, buy_rate: 0.4 }
              else npc.trader = null
              commit()
            }}
          />
          <span>Персонаж торгует</span>
        </label>
        {npc.trader && (
          <>
            <div className="muted small" style={{ margin: '8px 0' }}>
              Прилавок торговца. Цена — по предмету (можно переопределить), запас пустой — неограниченный.
            </div>
            {npc.trader.sells.map((s, i) => (
              <div key={i} className="journal-row">
                <select
                  className="journal-key"
                  value={s.item}
                  onChange={(e) => ((s.item = e.target.value), commit())}
                >
                  {!allItems.some((o) => o.id === s.item) && <option value={s.item}>{s.item || '— предмет —'}</option>}
                  {allItems.map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
                <label className="fld fld-inline" data-tip="Пусто — цена берётся из карточки предмета">
                  <span>цена</span>
                  <input
                    type="number"
                    value={s.price ?? ''}
                    placeholder="по карточке"
                    onChange={(e) => {
                      if (e.target.value === '') delete s.price
                      else s.price = Number(e.target.value)
                      commit()
                    }}
                  />
                </label>
                <label className="fld fld-inline" data-tip="Пусто — запас не ограничен">
                  <span>запас</span>
                  <input
                    type="number"
                    value={s.stock ?? ''}
                    placeholder="∞"
                    onChange={(e) => {
                      if (e.target.value === '') delete s.stock
                      else s.stock = Number(e.target.value)
                      commit()
                    }}
                  />
                </label>
                <button className="btn btn-small ce-del" onClick={() => (npc.trader!.sells.splice(i, 1), commit())}><Ico n="close" /> </button>
              </div>
            ))}
            <button
              className="btn btn-small"
              onClick={() => {
                npc.trader!.sells.push({ item: allItems[0]?.id ?? '' })
                commit()
              }}
            >
              + товар
            </button>
            <div className="fld-row" style={{ marginTop: 8 }}>
              <label className="fld fld-check">
                <input
                  type="checkbox"
                  checked={npc.trader.buys}
                  onChange={(e) => ((npc.trader!.buys = e.target.checked), commit())}
                />
                <span>Скупает вещи игрока</span>
              </label>
              {npc.trader.buys && (
                <label className="fld fld-inline" data-tip="Какую долю стоимости предмета торговец платит при скупке">
                  <span>доля закупки, %</span>
                  <input
                    type="number"
                    min={5}
                    max={100}
                    value={Math.round((npc.trader.buy_rate ?? 0.4) * 100)}
                    onChange={(e) => ((npc.trader!.buy_rate = Math.min(100, Math.max(5, Number(e.target.value))) / 100), commit())}
                  />
                </label>
              )}
            </div>
          </>
        )}
      </div>

      <div className="props-group">
        <h4>Расписание (где персонаж в течение дня)</h4>
        <div className="muted small" style={{ marginBottom: 8 }}>
          НПС с расписанием появляется в указанной сцене и слоте только в свои
          часы — в остальное время его там нет (стражник ночью уходит в казарму,
          торговец закрывает лавку). Без расписания персонаж стоит там, где он
          выбран в слоте сцены, всегда.
        </div>
        {(npc.schedule ?? []).map((en, i) => {
          const scenes = store.scenePaths().map((p) => store.scene(p)).filter((x): x is NonNullable<typeof x> => !!x)
          const scene = scenes.find((sc) => sc.id === en.scene)
          return (
            <div key={i} className="journal-row" style={{ flexWrap: 'wrap' }}>
              <label className="fld fld-inline">
                <span>с</span>
                <input
                  type="number"
                  min={0}
                  max={(store.meta.ticks_per_day ?? 24) - 1}
                  value={en.time_range[0]}
                  onChange={(e) => ((en.time_range[0] = Number(e.target.value)), commit())}
                />
              </label>
              <label className="fld fld-inline">
                <span>до</span>
                <input
                  type="number"
                  min={0}
                  max={store.meta.ticks_per_day ?? 24}
                  value={en.time_range[1]}
                  onChange={(e) => ((en.time_range[1] = Number(e.target.value)), commit())}
                />
              </label>
              <span className="muted small">ч —</span>
              <select
                className="journal-key"
                value={en.scene}
                onChange={(e) => {
                  en.scene = e.target.value
                  const sc = scenes.find((x) => x.id === en.scene)
                  en.location = sc?.location ?? ''
                  en.slot = sc?.slots[0]?.id ?? ''
                  commit()
                }}
              >
                {!scene && <option value={en.scene}>{en.scene || '— сцена —'}</option>}
                {scenes.map((sc) => (
                  <option key={sc.id} value={sc.id}>{sc.label}</option>
                ))}
              </select>
              <select
                className="journal-key"
                value={en.slot}
                onChange={(e) => ((en.slot = e.target.value), commit())}
              >
                {!scene?.slots.some((sl) => sl.id === en.slot) && <option value={en.slot}>{en.slot || '— слот —'}</option>}
                {(scene?.slots ?? []).map((sl) => (
                  <option key={sl.id} value={sl.id}>
                    {sl.label ?? (sl.default_entity ? store.labelFor('entity', sl.default_entity) : sl.id)}
                  </option>
                ))}
              </select>
              <button className="btn btn-small ce-del" onClick={() => (npc.schedule!.splice(i, 1), commit())}><Ico n="close" /> </button>
            </div>
          )
        })}
        <button
          className="btn btn-small"
          onClick={() => {
            const sc = store.scenePaths().map((p) => store.scene(p)).find((x) => !!x)
            if (!npc.schedule) npc.schedule = []
            npc.schedule.push({
              time_range: [6, 18],
              location: sc?.location ?? '',
              scene: sc?.id ?? '',
              slot: sc?.slots[0]?.id ?? '',
            })
            commit()
          }}
        >
          + время и место
        </button>
      </div>

      <div className="props-group">
        <h4>Особые места (по событиям)</h4>
        <div className="muted small" style={{ marginBottom: 8 }}>
          Пока флаг события установлен, персонаж находится здесь — расписание и
          обычное место не действуют. Пример: «после налёта — прячется в храме».
        </div>
        {(npc.presence_overrides ?? []).map((ov, i) => {
          const scenes = store.scenePaths().map((p) => store.scene(p)).filter((x): x is NonNullable<typeof x> => !!x)
          const scene = scenes.find((sc) => sc.id === ov.scene)
          return (
            <div key={i} className="journal-row" style={{ flexWrap: 'wrap' }}>
              <FlagSelect
                label="если флаг"
                store={store}
                value={ov.flag ?? ''}
                onChange={(f) => ((ov.flag = f ?? ''), commit())}
              />
              <FlagSelect
                label="и НЕ установлен"
                store={store}
                value={ov.not_flag ?? ''}
                optional
                onChange={(f) => {
                  if (f) ov.not_flag = f
                  else delete ov.not_flag
                  commit()
                }}
              />
              <span className="muted small">→</span>
              <select
                className="journal-key"
                value={ov.scene}
                onChange={(e) => {
                  ov.scene = e.target.value
                  const sc = scenes.find((x) => x.id === ov.scene)
                  ov.location = sc?.location ?? ''
                  ov.slot = sc?.slots[0]?.id ?? ''
                  commit()
                }}
              >
                {!scene && <option value={ov.scene}>{ov.scene || '— сцена —'}</option>}
                {scenes.map((sc) => (
                  <option key={sc.id} value={sc.id}>{sc.label}</option>
                ))}
              </select>
              <select
                className="journal-key"
                value={ov.slot}
                onChange={(e) => ((ov.slot = e.target.value), commit())}
              >
                {!scene?.slots.some((sl) => sl.id === ov.slot) && <option value={ov.slot}>{ov.slot || '— слот —'}</option>}
                {(scene?.slots ?? []).map((sl) => (
                  <option key={sl.id} value={sl.id}>
                    {sl.label ?? (sl.default_entity ? store.labelFor('entity', sl.default_entity) : sl.id)}
                  </option>
                ))}
              </select>
              <button className="btn btn-small ce-del" onClick={() => {
                npc.presence_overrides!.splice(i, 1)
                if (npc.presence_overrides!.length === 0) delete npc.presence_overrides
                commit()
              }}><Ico n="close" /> </button>
            </div>
          )
        })}
        <button
          className="btn btn-small"
          onClick={() => {
            const sc = store.scenePaths().map((p) => store.scene(p)).find((x) => !!x)
            if (!npc.presence_overrides) npc.presence_overrides = []
            npc.presence_overrides.push({
              flag: '',
              location: sc?.location ?? '',
              scene: sc?.id ?? '',
              slot: sc?.slots[0]?.id ?? '',
            })
            commit()
          }}
        >
          + место по событию
        </button>
      </div>

      <div className="props-group">
        <h4>Добыча с противника</h4>
        <div className="muted small" style={{ marginBottom: 8 }}>
          Что может выпасть с этого персонажа после победы в бою.
        </div>
        {(npc.loot_table ?? []).map((entry, i) => (
          <div key={i} className="journal-row">
            <select
              className="journal-key"
              value={entry.item}
              onChange={(e) => ((entry.item = e.target.value), commit())}
            >
              {!allItems.some((o) => o.id === entry.item) && <option value={entry.item}>{entry.item || '— предмет —'}</option>}
              {allItems.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
            <label className="fld fld-inline">
              <span>шанс, %</span>
              <input
                type="number"
                min={1}
                max={100}
                value={Math.round(entry.chance * 100)}
                onChange={(e) => ((entry.chance = Math.min(100, Math.max(1, Number(e.target.value))) / 100), commit())}
              />
            </label>
            <label className="fld fld-inline">
              <span>от</span>
              <input type="number" min={1} value={entry.min ?? 1} onChange={(e) => ((entry.min = Math.max(1, Number(e.target.value))), commit())} />
            </label>
            <label className="fld fld-inline">
              <span>до</span>
              <input type="number" min={1} value={entry.max ?? entry.min ?? 1} onChange={(e) => ((entry.max = Math.max(1, Number(e.target.value))), commit())} />
            </label>
            <button
              className="btn btn-small ce-del"
              onClick={() => {
                npc.loot_table!.splice(i, 1)
                if (npc.loot_table!.length === 0) delete npc.loot_table
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
            npc.loot_table = [...(npc.loot_table ?? []), { item: allItems[0]?.id ?? '', chance: 0.5, min: 1, max: 1 }]
            commit()
          }}
        >
          + добыча
        </button>
      </div>

      <div className="props-group">
        <SoundHookMapEditor
          store={store}
          value={npc.sounds ?? (npc.sounds = {})}
          onChange={commit}
          data-tip="Звуки действий персонажа"
        />
      </div>

      <AdvancedJson store={store} path={path} commit={commit} />
    </div>
  )
}

/** Тип сущности в слотах сцены (фидбек №3 пятого раунда). */
function SlotTypeField({ e, store, commit }: { e: EntityDef; store: EditorStore; commit: () => void }) {
  const types = slotTypesFor(store)
  const current = e.slot_type ?? defaultSlotType(e)
  return (
    <label className="fld" data-tip="По типу фильтруется, в какие слоты сцены можно ставить эту сущность">
      <span>Тип в слотах сцены</span>
      <select
        value={current}
        onChange={(ev) => {
          e.slot_type = ev.target.value
          commit()
        }}
      >
        {!types.some((t) => t.id === current) && <option value={current}>{current}</option>}
        {types.map((t) => (
          <option key={t.id} value={t.id}>{t.label}</option>
        ))}
      </select>
    </label>
  )
}

/** Структурный ввод урона: N кубиков dX + модификатор (фидбек №9). */
function DamageInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const m = /^(\d+)d(\d+)([+-]\d+)?$/.exec(value.trim()) ?? ['', '1', '6', '']
  const count = Number(m[1] || 1)
  const die = Number(m[2] || 6)
  const mod = Number(m[3] || 0)
  const emit = (c: number, d: number, mo: number) => onChange(`${c}d${d}${mo > 0 ? `+${mo}` : mo < 0 ? String(mo) : ''}`)
  return (
    <label className="fld">
      <span>{label}</span>
      <div className="dmg-row">
        <select value={count} onChange={(e) => emit(Number(e.target.value), die, mod)}>
          {[1, 2, 3, 4].map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <span className="muted">×</span>
        <select value={die} onChange={(e) => emit(count, Number(e.target.value), mod)}>
          {[4, 6, 8, 10, 12, 20].map((n) => (
            <option key={n} value={n}>d{n}</option>
          ))}
        </select>
        <span className="muted">+</span>
        <input type="number" value={mod} onChange={(e) => emit(count, die, Number(e.target.value) || 0)} data-tip="Модификатор (может быть отрицательным)" />
      </div>
    </label>
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
