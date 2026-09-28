import { Ico } from '../shared/icons'
import { useState } from 'react'
import type { Effect, EmotionDef, EntityDef, ItemCategoryDef, ItemDef, NpcDef, StatBlock } from '../shared/types'
import { DEFAULT_EMOTION, equipmentSlots } from '../shared/types'
import type { EditorStore } from './store'
import { ConditionListEditor, EffectListEditor, FlagSelect, ImageUpload, RefSelect, FileAdvancedJson, AnimImageEditor } from './Fields'
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
          label="Изображение предмета (в инвентаре и торговле)"
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
        <h4>Предмет в сцене</h4>
        <AnimImageEditor
          label="Спрайт в сцене (картинка предмета в его слоте; без него — слот пуст)"
          value={item.scene_sprite}
          dir="assets/img/items"
          store={store}
          onChange={(v) => {
            if (v) item.scene_sprite = v
            else delete item.scene_sprite
            commit()
          }}
        />
        <div className="muted small" style={{ marginBottom: 8 }}>
          Спрайт вписывается в слот целиком (как у персонажей): сужается/расширяется,
          ничего не обрезается. Если спрайта нет — в слоте ничего не рисуется, даже если
          задано изображение предмета.
        </div>
        <label className="fld fld-check">
          <input
            type="checkbox"
            checked={item.shadow !== false}
            onChange={(e) => {
              if (e.target.checked) delete item.shadow
              else item.shadow = false
              commit()
            }}
          />
          <span>Мягкая тень под спрайтом</span>
        </label>

        <h4 style={{ marginTop: 14 }}>Портреты предмета (окно действий)</h4>
        <div className="muted small" style={{ marginBottom: 8 }}>
          Клик по предмету в сцене открывает окно действий — как мини-диалог.
          «Обычный» портрет показывается в этом окне по умолчанию; остальные
          состояния можно указать у конкретного действия (поле «Состояние портрета»).
          Без портретов окно показывает только текст.
        </div>
        <div className="fld-row" style={{ flexWrap: 'wrap' }}>
          {Object.keys(item.portrait ?? {}).map((k) => (
            <div key={k} style={{ position: 'relative' }}>
              <ImageUpload
                label={emLabelOf(store, k)}
                value={item.portrait?.[k] ?? ''}
                dir="assets/img/items"
                store={store}
                onChange={(p) => {
                  item.portrait = { ...(item.portrait ?? {}) }
                  if (p) item.portrait[k] = p
                  else if (k !== 'neutral') delete item.portrait[k]
                  else item.portrait[k] = ''
                  if (!Object.keys(item.portrait).length) delete item.portrait
                  commit()
                }}
              />
              {k !== 'neutral' && (
                <button
                  className="btn btn-small ce-del"
                  data-tip="Убрать состояние"
                  style={{ position: 'absolute', top: 0, right: 0 }}
                  onClick={() => {
                    delete item.portrait?.[k]
                    if (!Object.keys(item.portrait ?? {}).length) delete item.portrait
                    commit()
                  }}
                >
                  <Ico n="close" />
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="fld-row">
          <select
            value=""
            data-tip="Добавить состояние портрета предмета"
            onChange={async (e) => {
              const v = e.target.value
              if (!v) return
              item.portrait = { ...(item.portrait ?? {}) }
              if (v === '__new__') {
                const name = await askText('Название нового состояния', 'например «Открыт»')
                if (!name) return
                const key = slugify(name) || `state_${Object.keys(item.portrait).length + 1}`
                if (!store.meta.emotions?.some((x) => x.id === key)) {
                  if (!store.meta.emotions) store.meta.emotions = []
                  store.meta.emotions.push({ id: key, label: name })
                  store.touch('campaign.json')
                }
                item.portrait[key] = ''
                commit()
                return
              }
              item.portrait[v] = ''
              commit()
            }}
          >
            <option value="">+ состояние портрета…</option>
            {!Object.keys(item.portrait ?? {}).includes('neutral') && <option value="neutral">Обычный</option>}
            {emotionsOf(store)
              .filter((x) => !(item.portrait ?? {})[x.id])
              .map((x) => (
                <option key={x.id} value={x.id}>{x.label}</option>
              ))}
            <option value="__new__">+ Создать новое состояние…</option>
          </select>
        </div>
      </div>

      <div className="props-group">
        <h4>Действия с предметом в сцене</h4>
        <div className="muted small" style={{ marginBottom: 8 }}>
          Клик по предмету открывает окно выбора действия (как реплики диалога):
          «собрать траву», «срезать куст», «поджечь»… У каждого действия — свои
          условия-ширма и реакции. Без списка срабатывает «простое действие»
          (либо просто показывается описание).
        </div>
        {(item.interact_options ?? []).map((_, i) => (
          <ItemOptionEditor
            key={i}
            index={i}
            options={item.interact_options!}
            store={store}
            portraitKeys={Object.keys(item.portrait ?? {})}
            onCommit={commit}
          />
        ))}
        <button
          className="btn btn-small"
          onClick={() => {
            item.interact_options = [...(item.interact_options ?? []), { label: 'Осмотреть', effects: [] }]
            commit()
          }}
        >
          <Ico n="plus" /> Действие
        </button>
        {(item.interact_options?.length ?? 0) === 0 && item.on_interact && (
          <div className="muted small">
            Есть «простое действие» (старое поле, в JSON): оно сработает без выбора,
            пока здесь нет ни одного действия.
          </div>
        )}
      </div>

      <div className="props-group">
        <h4>Условия взаимодействия</h4>
        <div className="muted small" style={{ marginBottom: 8 }}>
          Пока условия не выполнены, предмет остаётся «декорацией»: виден в сцене,
          но не нажимается и не подсвечивается. Например: колодец нельзя использовать,
          пока нет верёвки. Пустой список — взаимодействовать можно всегда.
        </div>
        <ConditionListEditor
          store={store}
          conditions={item.interactable_when ?? []}
          onChange={(conds) => {
            if (conds.length) item.interactable_when = conds
            else delete item.interactable_when
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
            <label className="fld fld-num" data-tip="0 — вечное оружие. Износ: критический провал в бою −1. Слом чинится рецептом «починка».">
              <span>Прочность (0 — вечное)</span>
              <input
                type="number" min={0}
                value={item.weapon_data.durability ?? 0}
                onChange={(e) => {
                  const v = Math.max(0, Number(e.target.value) || 0)
                  if (v > 0) item.weapon_data!.durability = v
                  else delete item.weapon_data!.durability
                  commit()
                }}
              />
            </label>
            <label className="fld fld-num" data-tip="Дальность в гексах: 1 — руопашная.">
              <span>Дальность</span>
              <input
                type="number" min={1}
                value={item.weapon_data.range}
                onChange={(e) => ((item.weapon_data!.range = Math.max(1, Number(e.target.value) || 1)), commit())}
              />
            </label>
            <label className="fld fld-num" data-tip="Сколько атак в раунде делает боец с этим оружием (последующие с штрафом из правил кампании).">
              <span>Атак в раунде</span>
              <input
                type="number" min={1}
                value={item.weapon_data.attacks_per_round}
                onChange={(e) => ((item.weapon_data!.attacks_per_round = Math.max(1, Number(e.target.value) || 1)), commit())}
              />
            </label>
            <ItemSelect
              label="Боеприпасы (id предмета)"
              store={store}
              value={item.weapon_data.ammo_item ?? ''}
              allowNone
              onChange={(v) => {
                if (v) item.weapon_data!.ammo_item = v
                else delete item.weapon_data!.ammo_item
                commit()
              }}
            />
          </div>
          <div className="fld-row">
            {(
              [
                ['impale', 'Пронзание (+урон без брони)'],
                ['knockback', 'Отброс на гекс'],
                ['disarm', 'Разоружение'],
                ['grapple', 'Захват (ход потерян)'],
                ['push_harmless', 'Толчок без урона'],
              ] as const
            ).map(([trait, tl]) => (
              <label key={trait} className="fld fld-check" data-tip="Особый удар: срабатывает при уверенном успехе и критическом.">
                <input
                  type="checkbox"
                  checked={(item.weapon_data!.traits ?? []).includes(trait)}
                  onChange={(e) => {
                    const cur = new Set(item.weapon_data!.traits ?? [])
                    if (e.target.checked) cur.add(trait)
                    else cur.delete(trait)
                    if (cur.size) item.weapon_data!.traits = [...cur]
                    else delete item.weapon_data!.traits
                    commit()
                  }}
                />
                <span>{tl}</span>
              </label>
            ))}
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
          <label className="fld fld-num" data-tip="0 — вечная броня. Износ: каждый пробивший удар в бою −1. Слом чинится рецептом «починка».">
            <span>Прочность (0 — вечная)</span>
            <input
              type="number" min={0}
              value={item.armor_data.durability ?? 0}
              onChange={(e) => {
                const v = Math.max(0, Number(e.target.value) || 0)
                if (v > 0) item.armor_data!.durability = v
                else delete item.armor_data!.durability
                commit()
              }}
            />
          </label>
        </div>
      )}

      <div className="props-group">
        <h4>Экипировка</h4>
        <label className="fld">
          <span>Слот экипировки</span>
          <select
            value={item.equip_slot ?? ''}
            onChange={(e) => {
              const v = e.target.value
              if (v) item.equip_slot = v
              else delete item.equip_slot
              commit()
            }}
          >
            <option value="">Не экипируется</option>
            {equipmentSlots(store.meta).map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </label>
        <div className="muted small">
          Старым предметам со свойствами оружия/брони слот определяется по этим
          свойствам (Оружие/Броня), пока мастер не выберет свой.
        </div>
      </div>

      <div className="props-group">
        <SoundHookMapEditor
          store={store}
          value={item.sounds ?? (item.sounds = {})}
          onChange={commit}
          heading="Звуки действий предмета"
        />
      </div>

      <FileAdvancedJson store={store} path={path} commit={commit} />
    </div>
  )
}

// ─────────────── NPC ───────────────

/** состояния портрета — общий реестр кампании (фидбек 9.14) */
/** встроенные состояния фигурки боя (поверх — id статусов реестра) */
const FIGURE_STATES_BASE = [
  { id: 'dead', label: 'Погиб' },
  { id: 'down', label: 'Без сознания' },
]

function figureStateLabel(store: EditorStore, id: string): string {
  const base = FIGURE_STATES_BASE.find((x) => x.id === id)
  if (base) return base.label
  return `в статусе «${store.options('status').find((o) => o.id === id)?.label ?? id}»`
}

function emotionsOf(store: EditorStore): EmotionDef[] {
  return store.meta.emotions ?? []
}

function emLabelOf(store: EditorStore, id: string): string {
  if (id === DEFAULT_EMOTION.id) return DEFAULT_EMOTION.label
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
  /** есть ли у НПС хоть одно изображение — тогда спойлер «Изображения» открыт */
  const hasArt =
    Object.values(npc.portrait ?? {}).some(Boolean) ||
    !!npc.scene_sprite ||
    Object.values(npc.scene_sprite_states ?? {}).some(Boolean) ||
    !!npc.combat_figure ||
    !!npc.token

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
        <SpeciesPresets npc={npc} commit={commit} />
        <label className="fld fld-block">
          <span>Описание</span>
          <textarea
            rows={2}
            value={npc.description ?? ''}
            onChange={(e) => ((npc.description = e.target.value), commit())}
          />
        </label>
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

      {/* изображения НПС занимают много места — держим их под спойлером;
          открыт, если изображения уже есть */}
      <details className="spoiler-block" {...(hasArt ? { open: true } : {})}>
        <summary>Изображения: портреты, спрайт, фигурка</summary>
      <div className="props-group">
        <h4>Портреты</h4>
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
          <select
            className="emotion-pick"
            value=""
            data-tip="Выбрать состояние из списка или создать новое — прямо здесь"
            onChange={async (e) => {
              const v = e.target.value
              if (!v) return
              if (v === '__new__') {
                const name = await askText('Название нового состояния', 'например «Задумчивость»')
                if (!name) return
                const key = slugify(name) || `state_${portraitKeys.length + 1}`
                // своё состояние попадает в общий реестр кампании
                if (!store.meta.emotions?.some((x) => x.id === key)) {
                  if (!store.meta.emotions) store.meta.emotions = []
                  store.meta.emotions.push({ id: key, label: name })
                  store.touch('campaign.json')
                }
                npc.portrait = { ...(npc.portrait ?? {}), [key]: '' }
                commit()
                return
              }
              npc.portrait = { ...(npc.portrait ?? {}), [v]: '' }
              commit()
            }}
          >
            <option value="">+ состояние (выбрать из списка)…</option>
            {emotionsOf(store)
              .filter((x) => !portraitKeys.includes(x.id))
              .map((x) => (
                <option key={x.id} value={x.id}>{x.label}</option>
              ))}
            <option value="__new__">+ Создать новое состояние…</option>
          </select>
        </div>
      </div>

      <div className="props-group">
        <h4>Спрайт в сцене</h4>
        <div className="muted small" style={{ marginBottom: 8 }}>
          Изображение с вырезанным фоном (прозрачный PNG), которым персонаж стоит в сцене.
          Если не задано — в сцене используется портрет «Обычный».
        </div>
        <AnimImageEditor
          label="Спрайт в сцене"
          value={npc.scene_sprite}
          dir="assets/img/npc"
          store={store}
          onChange={(v) => {
            if (v) npc.scene_sprite = v
            else delete npc.scene_sprite
            commit()
          }}
        />
        {/* состояния спрайта — по образцу «Портретов»: ключи из общего
            реестра состояний; показ — «Состояние спрайта» в свойствах слота сцены */}
        <div className="muted small" style={{ margin: '8px 0 8px' }}>
          Состояния — как у портретов: добавьте варианты спрайта (с мечом, раненый, в движении…),
          а показывать их поможет выбор «Состояние спрайта» в свойствах слота сцены.
        </div>
        <div className="fld-row" style={{ flexWrap: 'wrap' }}>
          {Object.keys(npc.scene_sprite_states ?? {}).map((k) => (
            <div key={k} style={{ position: 'relative' }}>
              <AnimImageEditor
                label={emLabelOf(store, k)}
                value={npc.scene_sprite_states?.[k]}
                dir="assets/img/npc"
                store={store}
                onChange={(v) => {
                  npc.scene_sprite_states = { ...(npc.scene_sprite_states ?? {}) }
                  if (v) npc.scene_sprite_states[k] = v
                  else delete npc.scene_sprite_states[k]
                  if (!Object.keys(npc.scene_sprite_states).length) delete npc.scene_sprite_states
                  commit()
                }}
              />
              <button
                className="btn btn-small ce-del"
                data-tip="Убрать состояние"
                style={{ position: 'absolute', top: 0, right: 0 }}
                onClick={() => {
                  delete npc.scene_sprite_states?.[k]
                  if (npc.scene_sprite_states && !Object.keys(npc.scene_sprite_states).length) delete npc.scene_sprite_states
                  commit()
                }}
              >
                <Ico n="close" />
              </button>
            </div>
          ))}
        </div>
        <div className="fld-row">
          <select
            className="emotion-pick"
            value=""
            data-tip="Добавить состояние спрайта — из списка или своё"
            onChange={async (e) => {
              const v = e.target.value
              if (!v) return
              let key = v
              let label = emotionsOf(store).find((x) => x.id === v)?.label ?? v
              if (v === '__new__') {
                const name = await askText('Название нового состояния спрайта', 'например «Раненый»')
                if (!name) return
                key = slugify(name) || `state_${Object.keys(npc.scene_sprite_states ?? {}).length + 1}`
                label = name
                if (!store.meta.emotions?.some((x) => x.id === key)) {
                  if (!store.meta.emotions) store.meta.emotions = []
                  store.meta.emotions.push({ id: key, label })
                  store.touch('campaign.json')
                }
              }
              npc.scene_sprite_states = { ...(npc.scene_sprite_states ?? {}), [key]: '' }
              commit()
              e.target.value = ''
            }}
          >
            <option value="">+ Добавить состояние спрайта…</option>
            {emotionsOf(store)
              .filter((x) => !(x.id in (npc.scene_sprite_states ?? {})))
              .map((x) => (
                <option key={x.id} value={x.id}>{x.label}</option>
              ))}
            <option value="__new__">+ Создать новое состояние…</option>
          </select>
        </div>
        <label className="fld fld-check">
          <input
            type="checkbox"
            checked={npc.shadow !== false}
            onChange={(e) => {
              if (e.target.checked) delete npc.shadow
              else npc.shadow = false
              commit()
            }}
          />
          <span>Мягкая тень под персонажем (в сцене и в бою)</span>
        </label>
      </div>

      <div className="props-group">
        <h4>В бою</h4>
        <div className="muted small" style={{ marginBottom: 8 }}>
          Фигурка показывается на арене вместо жетона (без круглой рамки) и разворачивается
          при движении и атаке. Если фигурки нет — рисуется круглый жетон.
        </div>
        <AnimImageEditor
          label="Фигурка боя"
          value={npc.combat_figure}
          dir="assets/img/npc"
          store={store}
          onChange={(v) => {
            if (v) npc.combat_figure = v
            else delete npc.combat_figure
            commit()
          }}
        />
        <label className="fld">
          <span>Как разворачивать фигурку</span>
          <select
            value={npc.figure_mode ?? 'topdown'}
            onChange={(e) => {
              const v = e.target.value as NpcDef['figure_mode']
              if (v === 'topdown') delete npc.figure_mode
              else npc.figure_mode = v
              commit()
            }}
          >
            <option value="topdown">Вид сверху — поворот по направлению</option>
            <option value="side">Вид сбоку — зеркало влево/вправо</option>
            <option value="static">Не разворачивать</option>
          </select>
        </label>
        <h4 style={{ marginTop: 14 }}>Состояния фигурки боя</h4>
        <div className="muted small" style={{ marginBottom: 8 }}>
          Свои изображения для особых моментов боя: «Погиб» — когда персонаж убит,
          «Без сознания» — когда выведен из боя, «в статусе …» — пока статус активен.
          Если изображения нет — фигурка не меняется.
        </div>
        <div className="fld-row" style={{ flexWrap: 'wrap' }}>
          {Object.keys(npc.combat_figure_states ?? {}).map((k) => (
            <div key={k} style={{ position: 'relative' }}>
              <AnimImageEditor
                label={figureStateLabel(store, k)}
                value={npc.combat_figure_states?.[k]}
                dir="assets/img/npc"
                store={store}
                onChange={(v) => {
                  npc.combat_figure_states = { ...(npc.combat_figure_states ?? {}) }
                  if (v) npc.combat_figure_states[k] = v
                  else delete npc.combat_figure_states[k]
                  if (!Object.keys(npc.combat_figure_states).length) delete npc.combat_figure_states
                  commit()
                }}
              />
              <button
                className="btn btn-small ce-del"
                data-tip="Убрать состояние"
                style={{ position: 'absolute', top: 0, right: 0 }}
                onClick={() => {
                  delete npc.combat_figure_states?.[k]
                  if (!Object.keys(npc.combat_figure_states ?? {}).length) delete npc.combat_figure_states
                  commit()
                }}
              >
                <Ico n="close" />
              </button>
            </div>
          ))}
        </div>
        <div className="fld-row">
          <select
            value=""
            data-tip="Добавить состояние фигурки из списка"
            onChange={(e) => {
              const v = e.target.value
              if (!v) return
              npc.combat_figure_states = { ...(npc.combat_figure_states ?? {}), [v]: '' }
              commit()
            }}
          >
            <option value="">+ состояние из этой фигурки…</option>
            {[...FIGURE_STATES_BASE, ...store.options('status').map((o) => ({ id: o.id, label: `в статусе «${o.label}»` }))]
              .filter((x) => !(npc.combat_figure_states ?? {})[x.id])
              .map((x) => (
                <option key={x.id} value={x.id}>{x.label}</option>
              ))}
          </select>
        </div>
        <ImageUpload
          label="Изображение жетона (используется, только если фигурка не задана)"
          value={npc.token ?? ''}
          dir="assets/img/npc"
          store={store}
          onChange={(p) => {
            if (p) npc.token = p
            else delete npc.token
            commit()
          }}
        />
        <div className="muted small">Если и жетон не задан, в бою используется обычный портрет.</div>
      </div>

      </details>

      <details className="spoiler-block" {...((npc.abilities?.length ?? 0) > 0 || !!npc.morale) ? { open: true } : {}}>
        <summary>Способности и мораль</summary>
      <div className="props-group">
        <h4>Способности и мораль</h4>
        <div className="muted small" style={{ marginBottom: 8 }}>
          Реестр способностей — «Кампания и реестры» → «Статусы и способности».
        </div>
        <div className="chips" style={{ marginBottom: 8 }}>
          {store.options('ability').map((o) => {
            const on = (npc.abilities ?? []).includes(o.id)
            return (
              <button
                key={o.id}
                type="button"
                className={`chip ${on ? 'chip-on' : ''}`}
                onClick={() => {
                  const set = new Set(npc.abilities ?? [])
                  if (on) set.delete(o.id)
                  else set.add(o.id)
                  if (set.size) npc.abilities = [...set]
                  else delete npc.abilities
                  commit()
                }}
              >
                {o.label}
              </button>
            )
          })}
          {store.options('ability').length === 0 && <span className="muted small">В кампании пока нет способностей.</span>}
        </div>
        <div className="fld-row">
          <label className="fld" data-tip="Когда здоровье падёт ниже этого процента, враг в начале своего хода может сбежать">
            <span>Мораль: порог бегства, % HP</span>
            <input
              type="number" min={0} max={100} value={npc.morale?.below_hp_pct ?? ''} placeholder="не сбегает"
              onChange={(e) => {
                const v = Number(e.target.value) || 0
                if (v > 0) npc.morale = { below_hp_pct: v, flee_chance: npc.morale?.flee_chance ?? 50 }
                else delete npc.morale
                commit()
              }}
            />
          </label>
          <label className="fld" data-tip="Шанс бегства при каждом броске морали (0–100)">
            <span>Шанс бегства, %</span>
            <input
              type="number" min={0} max={100} value={npc.morale?.flee_chance ?? ''} placeholder="—" disabled={!npc.morale}
              onChange={(e) => {
                if (npc.morale) npc.morale.flee_chance = Math.max(0, Math.min(100, Number(e.target.value) || 0))
                commit()
              }}
            />
          </label>
        </div>
      </div>

      </details>

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

      <details className="spoiler-block" {...((npc.inventory?.length ?? 0) > 0 || Object.keys(npc.equipment ?? {}).length > 0) ? { open: true } : {}}>
        <summary>Снаряжение и инвентарь</summary>
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

      </details>

      <details className="spoiler-block" {...(!!npc.trader) ? { open: true } : {}}>
        <summary>Торговля</summary>
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

      </details>

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

      <FileAdvancedJson store={store} path={path} commit={commit} />
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
        <span className="muted">=</span>
        <span className="dmg-summary">{`${count}d${die}${mod > 0 ? `+${mod}` : mod < 0 ? String(mod) : ''}`}</span>
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

function ItemSelect({
  label,
  store,
  value,
  onChange,
  allowNone,
}: {
  label: string
  store: EditorStore
  value: string
  onChange: (v: string) => void
  allowNone?: boolean
}) {
  const options = store.options('item')
  return (
    <label className="fld">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {allowNone && <option value="">— нет —</option>}
        {!allowNone && !options.some((o) => o.id === value) && <option value={value}>{value}</option>}
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>
    </label>
  )
}


/**
 * Одно действие с предметом в сцене (фидбек №8): подпись, подсказка,
 * состояние портрета, условия показа, реакции, звук, расход предмета.
 */
function ItemOptionEditor({
  index,
  options,
  store,
  portraitKeys,
  onCommit,
}: {
  index: number
  options: NonNullable<ItemDef['interact_options']>
  store: EditorStore
  portraitKeys: string[]
  onCommit: () => void
}) {
  const [open, setOpen] = useState(false)
  const opt = options[index]
  const patch = (p: Partial<typeof opt>) => {
    options[index] = { ...opt, ...p }
    onCommit()
  }
  const sounds = [...(store.meta.sounds ?? [])].sort((a, b) => a.label.localeCompare(b.label, 'ru'))
  return (
    <div className="ce-item">
      <div className="ce-head" onClick={() => setOpen(!open)}>
        <span className="ce-summary">
          {opt.label || '(без названия)'}
          {(opt.conditions?.length ?? 0) > 0 && ` · условий: ${opt.conditions!.length}`}
          {opt.consume && ' · расходуется'}
        </span>
        <button
          className="btn btn-small ce-del"
          onClick={(e) => {
            e.stopPropagation()
            options.splice(index, 1)
            onCommit()
          }}
        >
          <Ico n="close" />
        </button>
      </div>
      {open && (
        <div className="ce-body">
          <div className="fld-row">
            <label className="fld">
              <span>Подпись кнопки</span>
              <input value={opt.label} onChange={(e) => patch({ label: e.target.value })} />
            </label>
            <label className="fld">
              <span>Состояние портрета</span>
              <select
                value={opt.emotion ?? ''}
                onChange={(e) => (e.target.value ? patch({ emotion: e.target.value }) : patch({ emotion: undefined }))}
              >
                <option value="">Обычный</option>
                {portraitKeys
                  .filter((k) => k !== 'neutral')
                  .map((k) => (
                    <option key={k} value={k}>{emLabelOf(store, k)}</option>
                  ))}
              </select>
            </label>
          </div>
          <label className="fld fld-block">
            <span>Подсказка под кнопкой (условия, расход, проверка)</span>
            <input value={opt.hint ?? ''} onChange={(e) => patch({ hint: e.target.value || undefined })} />
          </label>
          <label className="fld fld-block">
            <span>Сообщение после выполнения</span>
            <textarea rows={2} value={opt.message ?? ''} onChange={(e) => patch({ message: e.target.value || undefined })} />
          </label>
          <div className="fld-row">
            <label className="fld">
              <span>Звук действия</span>
              <select
                value={opt.sound ?? ''}
                onChange={(e) => (e.target.value ? patch({ sound: e.target.value }) : patch({ sound: undefined }))}
              >
                <option value="">По умолчанию (использование/открытие)</option>
                {sounds.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </label>
            <label className="fld fld-check">
              <input type="checkbox" checked={!!opt.consume} onChange={(e) => patch({ consume: e.target.checked || undefined })} />
              <span>Предмет исчезает после выполнения</span>
            </label>
          </div>
          <h5 className="ce-subhead">Условия показа (все выполнены — действие видно)</h5>
          <ConditionListEditor
            store={store}
            conditions={opt.conditions ?? []}
            onChange={(conds) => patch({ conditions: conds.length ? conds : undefined })}
          />
          <h5 className="ce-subhead">Что происходит</h5>
          <EffectListEditor
            store={store}
            effects={opt.effects}
            onChange={(fx) => {
              opt.effects = fx
              onCommit()
            }}
          />
        </div>
      )}
    </div>
  )
}

/** Готовый «вид» существа: статы, навыки, броня, природное оружие и мораль одним нажатием. */
interface SpeciesPreset {
  label: string
  blurb: string
  stats: StatBlock
  skills: Record<string, number>
  armor: number
  weapon: { skill: string; damage: string; label: string; damage_bonus?: boolean }
  morale: { below_hp_pct: number; flee_chance: number }
}

/** шаблоны видов (стартовая заготовка аудита §5.6): применение перезаписывает
 *  боевую часть персонажа — дальше мастер правит под себя */
const SPECIES_PRESETS: SpeciesPreset[] = [
  {
    label: 'Волк',
    blurb: 'Быстрый зверь: укус 1d6, отличный слух и чутьё, спасается бегством когда ранен.',
    stats: { STR: 12, CON: 11, SIZ: 8, DEX: 14, INT: 4, POW: 8, CHA: 5 },
    skills: { bite: 45, dodge: 40, spot: 50, stealth: 40 },
    armor: 0,
    weapon: { skill: 'bite', damage: '1d6', label: 'Укус' },
    morale: { below_hp_pct: 30, flee_chance: 50 },
  },
  {
    label: 'Скелет',
    blurb: 'Медленный, но упорный нежить: костяные пальцы 1d4, броня из кости, не убегает.',
    stats: { STR: 10, CON: 10, SIZ: 10, DEX: 9, INT: 1, POW: 10, CHA: 1 },
    skills: { melee: 35, dodge: 25 },
    armor: 1,
    weapon: { skill: 'melee', damage: '1d4', label: 'Костяные пальцы' },
    morale: { below_hp_pct: 0, flee_chance: 0 },
  },
  {
    label: 'Гигантская крыса',
    blurb: 'Роящийся падальщик: укус 1d4, ловкая тварь подвалов и трущоб.',
    stats: { STR: 6, CON: 9, SIZ: 3, DEX: 15, INT: 2, POW: 6, CHA: 2 },
    skills: { bite: 40, dodge: 50, stealth: 60 },
    armor: 0,
    weapon: { skill: 'bite', damage: '1d4', label: 'Укус' },
    morale: { below_hp_pct: 40, flee_chance: 60 },
  },
  {
    label: 'Лютый медведь',
    blurb: 'Стена шерсти: лапа 1d8, толстая шкура на 2 очка брони, не отступает.',
    stats: { STR: 18, CON: 16, SIZ: 18, DEX: 8, INT: 3, POW: 12, CHA: 3 },
    skills: { claw: 55, dodge: 20, spot: 45 },
    armor: 2,
    weapon: { skill: 'claw', damage: '1d8', label: 'Лапа' },
    morale: { below_hp_pct: 0, flee_chance: 0 },
  },
]

function SpeciesPresets({ npc, commit }: { npc: NpcDef; commit: () => void }) {
  const [sel, setSel] = useState('')
  const preset = SPECIES_PRESETS.find((p) => p.label === sel)
  return (
    <div className="fld-row" style={{ alignItems: 'flex-end' }}>
      <label className="fld" data-tip={preset ? preset.blurb : 'Готовая заготовка существа: статы, навыки, броня и природное оружие одним нажатием'}>
        <span>Вид существа (шаблон)</span>
        <select value={sel} onChange={(e) => setSel(e.target.value)}>
          <option value="">— выбрать вид —</option>
          {SPECIES_PRESETS.map((p) => <option key={p.label} value={p.label}>{p.label}</option>)}
        </select>
      </label>
      <button
        className="btn btn-small"
        disabled={!preset}
        data-tip="Перезапишет статы, навыки, броню, природное оружие и мораль персонажа"
        onClick={() => {
          if (!preset) return
          npc.stats = { ...preset.stats }
          npc.skills = { ...preset.skills }
          npc.armor = preset.armor
          npc.natural_weapon = {
            skill: preset.weapon.skill,
            damage: preset.weapon.damage,
            damage_bonus: preset.weapon.damage_bonus ?? false,
            range: 1,
            attacks_per_round: 1,
            parry_capable: false,
            label: preset.weapon.label,
          }
          npc.morale = { ...preset.morale }
          commit()
        }}
      >
        Применить вид
      </button>
      {preset && <span className="muted small" style={{ maxWidth: 320 }}>{preset.blurb}</span>}
    </div>
  )
}
