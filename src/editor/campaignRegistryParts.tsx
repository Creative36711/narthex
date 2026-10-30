/**
 * Строительные блоки паспорта кампании: реестры строк, тумблеры механик,
 * модификаторы черт, сдвиги навыков, редактор условий потребностей и выбор
 * значения из реестра.
 *
 * Вынесено из `CampaignEditor.tsx`: это переиспользуемые элементы форм паспорта,
 * у них нет собственного состояния страницы, поэтому они живут отдельно.
 */

import { Ico } from '../shared/icons'
import type { ReactNode } from 'react'
import type { EditorStore } from './store'
import { RefSelect } from './Fields'
import { BUILTIN_STAT_LABELS } from '../shared/skills'
import { makeId } from './ids'
import { FlagSelect } from './Fields'
import type { FeatDef, NeedCondition, TimeOfDay } from '../shared/types'
import { askText } from './prompt'
import { migrateNeedCondition } from '../shared/migrate'
import { ChipMultiSelect } from './campaignDiceEditors'


/** Редактор campaign.json формой: мета, время, старт, потребности, фракции. */
const NEED_COND_TYPES: Array<{ id: string; label: string }> = [
  { id: 'time_of_day', label: 'Время суток' },
  { id: 'flag', label: 'Флаг установлен' },
  { id: 'flag!', label: 'Флага НЕТ' },
  { id: 'in_location', label: 'Герой в любой из локаций' },
  { id: 'in_location!', label: 'Герой НИ в одной из локаций' },
  { id: 'has_item', label: 'Есть любой из предметов' },
  { id: 'has_item!', label: 'Нет ни одного из предметов' },
  { id: 'equipped', label: 'Надет любой из предметов' },
  { id: 'equipped!', label: 'Не надет ни один из предметов' },
  { id: 'weather', label: 'Погода — текущая' },
  { id: 'weather!', label: 'Погода НЕ текущая' },
]

function blankNeedCond(key: string): NeedCondition {
  const not = key.endsWith('!') || undefined
  const type = key.replace(/!$/, '') as NeedCondition['type']
  switch (type) {
    case 'time_of_day': return { type, values: ['night'] }
    case 'flag': return { type, flag: '', not }
    case 'in_location': return { type, locations: [], not }
    case 'has_item': return { type, items: [], not }
    case 'equipped': return { type, items: [], not }
    case 'weather': return { type, weather: '', not }
  }
}

/**
 * Реестр строками: название — обычное поле, служебный код мастеру не показывается и
 * редактируется (ломает ссылки), добавление — через диалог имени.
 * Заменяет прежний ввод «id=Название через запятую»: человек не должен
 * читать и писать парсерный формат (фидбек 27, п.2 и п.4).
 */
export function RegistryRows<T extends { id: string; label: string }>({
  items,
  onChange,
  addTitle,
  prefix = '',
  render,
}: {
  items: T[]
  onChange: (next: T[]) => void
  addTitle: string
  prefix?: string
  render?: (item: T, patch: (p: Partial<T>) => void) => ReactNode
}) {
  const add = async () => {
    const label = await askText(addTitle, 'например «Кража»')
    if (!label?.trim()) return
    onChange([...items, { ...({ id: makeId(prefix, label.trim(), items.map((x) => x.id)), label: label.trim() } as T) }])
  }
  return (
    <div>
      {items.map((it, i) => (
        <div key={it.id} className="fld-row need-row" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label className="fld" style={{ flex: 2, minWidth: 180 }}>
            <span>Название</span>
            <input
              value={it.label}
              onChange={(e) => {
                const next = [...items]
                next[i] = { ...it, label: e.target.value }
                onChange(next)
              }}
            />
          </label>
          {render?.(it, (patch) => {
            const next = [...items]
            next[i] = { ...it, ...patch }
            onChange(next)
          })}
          <button className="btn btn-small ce-del" data-tip="Удалить из реестра" onClick={() => onChange(items.filter((_, j) => j !== i))}>
            <Ico n="close" />
          </button>
        </div>
      ))}
      <button className="btn btn-small" onClick={() => void add()}>
        <Ico n="plus" /> добавить
      </button>
    </div>
  )
}

export type FeatModKind = 'skill' | 'stat' | 'hp' | 'mp' | 'mov'
const FEAT_MOD_KINDS: Array<{ id: FeatModKind; label: string }> = [
  { id: 'skill', label: 'Навык' },
  { id: 'stat', label: 'Характеристика' },
  { id: 'hp', label: 'Здоровье (HP)' },
  { id: 'mp', label: 'Мана (MP)' },
  { id: 'mov', label: 'Движение (MOV)' },
]

export function FeatModRows({ store, mods, onChange }: {
  store: EditorStore
  mods: FeatDef['mods']
  onChange: (mods: FeatDef['mods']) => void
}) {
  type Row = { kind: FeatModKind; key: string; value: number }
  const rows: Row[] = [
    ...Object.entries(mods?.skills ?? {}).map(([key, value]) => ({ kind: 'skill' as const, key, value })),
    ...Object.entries(mods?.stats ?? {}).map(([key, value]) => ({ kind: 'stat' as const, key, value })),
    ...(mods?.hp ? [{ kind: 'hp' as const, key: '', value: mods.hp }] : []),
    ...(mods?.mp ? [{ kind: 'mp' as const, key: '', value: mods.mp }] : []),
    ...(mods?.mov ? [{ kind: 'mov' as const, key: '', value: mods.mov }] : []),
  ]
  const skills = store.options('skill')
  const stats = Object.entries(BUILTIN_STAT_LABELS).map(([id, label]) => ({ id, label }))
  const push = (next: Row[]) => {
    const out: NonNullable<FeatDef['mods']> = {}
    const skillMap: Record<string, number> = {}
    const statMap: Partial<Record<'STR' | 'CON' | 'SIZ' | 'DEX' | 'INT' | 'POW' | 'CHA' | 'EDU', number>> = {}
    for (const r of next) {
      if (r.kind === 'skill' && r.key) skillMap[r.key] = r.value
      else if (r.kind === 'stat' && r.key) statMap[r.key as keyof typeof statMap] = r.value
      else if (r.kind === 'hp' && r.value) out.hp = r.value
      else if (r.kind === 'mp' && r.value) out.mp = r.value
      else if (r.kind === 'mov' && r.value) out.mov = r.value
    }
    if (Object.keys(skillMap).length) out.skills = skillMap
    if (Object.keys(statMap).length) out.stats = statMap
    onChange(Object.keys(out).length ? out : undefined)
  }
  return (
    <div>
      {rows.map((r, i) => (
        <div key={i} className="fld-row" style={{ alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 4 }}>
          <label className="fld" style={{ flex: 1, minWidth: 140 }}>
            <span>Что даёт</span>
            <select
              value={r.kind}
              onChange={(e) => {
                const kind = e.target.value as FeatModKind
                const next = [...rows]
                const key = kind === 'skill' ? (skills[0]?.id ?? '') : kind === 'stat' ? 'STR' : ''
                next[i] = { kind, key, value: r.value || 5 }
                push(next)
              }}
            >
              {FEAT_MOD_KINDS.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          {(r.kind === 'skill' || r.kind === 'stat') && (
            <label className="fld" style={{ flex: 2, minWidth: 160 }}>
              <span>{r.kind === 'skill' ? 'Навык' : 'Характеристика'}</span>
              <select
                value={r.key}
                onChange={(e) => {
                  const next = [...rows]
                  next[i] = { ...r, key: e.target.value }
                  push(next)
                }}
              >
                {(r.kind === 'skill' ? skills : stats).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="fld fld-num" data-tip="Прибавка при взятии черты (можно отрицательную)">
            <span>Прибавка</span>
            <input
              type="number"
              value={r.value}
              onChange={(e) => {
                const next = [...rows]
                next[i] = { ...r, value: Number(e.target.value) || 0 }
                push(next)
              }}
            />
          </label>
          <button className="btn btn-small ce-del" data-tip="Убрать модификатор" onClick={() => push(rows.filter((_, j) => j !== i))}>
            <Ico n="close" />
          </button>
        </div>
      ))}
      <button className="btn btn-small" onClick={() => push([...rows, { kind: 'skill', key: skills[0]?.id ?? '', value: 5 }])}>
        <Ico n="plus" /> добавить модификатор
      </button>
    </div>
  )
}

/** Сдвиги навыков под погодой: строка «навык — сдвиг» вместо текста «dodge=-10». */
export function SkillDeltaRows({ store, mods, onChange }: {
  store: EditorStore
  mods: Array<{ skill: string; delta: number }>
  onChange: (mods: Array<{ skill: string; delta: number }>) => void
}) {
  const skills = store.options('skill')
  return (
    <div>
      {mods.map((m, i) => (
        <div key={i} className="fld-row" style={{ alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 4 }}>
          <label className="fld" style={{ flex: 2, minWidth: 160 }}>
            <span>Навык</span>
            <select
              value={m.skill}
              onChange={(e) => onChange(mods.map((x, j) => (j === i ? { ...x, skill: e.target.value } : x)))}
            >
              {!!m.skill && !skills.some((o) => o.id === m.skill) && <option value={m.skill}>{m.skill}</option>}
              {skills.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="fld fld-num" data-tip="Сдвиг навыка в бою под этой погодой: минус — штраф">
            <span>Сдвиг</span>
            <input
              type="number"
              value={m.delta}
              onChange={(e) => onChange(mods.map((x, j) => (j === i ? { ...x, delta: Number(e.target.value) || 0 } : x)))}
            />
          </label>
          <button className="btn btn-small ce-del" data-tip="Убрать сдвиг" onClick={() => onChange(mods.filter((_, j) => j !== i))}>
            <Ico n="close" />
          </button>
        </div>
      ))}
      <button className="btn btn-small" onClick={() => onChange([...mods, { skill: skills[0]?.id ?? '', delta: -10 }])}>
        <Ico n="plus" /> добавить сдвиг
      </button>
    </div>
  )
}

/**
 * Мультивыбор чипами (итерация 8, А3): несколько локаций/предметов
 * в одном условии — «любой из» (с «не» — «ни одного из»).
 */
const TOD_RU: Array<{ id: TimeOfDay; label: string }> = [
  { id: 'morning', label: 'утро' },
  { id: 'day', label: 'день' },
  { id: 'evening', label: 'вечер' },
  { id: 'night', label: 'ночь' },
]

/** конструктор условий потребности («когда убывает» / «когда восстанавливается») */
export function NeedCondEditor({
  conds,
  store,
  commit,
  onChange,
}: {
  conds: NeedCondition[]
  store: EditorStore
  commit: () => void
  onChange: (c: NeedCondition[]) => void
}) {
  // старый формат (одиночные location/item) приводим к новому на месте
  const list = conds.map(migrateNeedCondition)
  list.forEach((c, i) => {
    conds[i] = c
  })

  return (
    <div className="dlg-conds">
      {list.map((c, i) => (
        <div key={i} className="journal-row" style={{ flexWrap: 'wrap' }}>
          <select
            className="journal-key"
            value={c.type === 'time_of_day' ? 'time_of_day' : (c as { not?: boolean }).not ? `${c.type}!` : c.type}
            onChange={(e) => {
              conds[i] = blankNeedCond(e.target.value)
              commit()
            }}
          >
            {NEED_COND_TYPES.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
          {c.type === 'time_of_day' && (
            <div className="chips">
              {TOD_RU.map((t) => (
                <label key={t.id} className={`chip ${c.values.includes(t.id) ? 'chip-on' : ''}`}>
                  <input
                    type="checkbox"
                    checked={c.values.includes(t.id)}
                    onChange={(e) => {
                      c.values = e.target.checked ? [...c.values, t.id] : c.values.filter((x) => x !== t.id)
                      if (c.values.length === 0) c.values = ['night']
                      commit()
                    }}
                  />
                  {t.label}
                </label>
              ))}
            </div>
          )}
          {c.type === 'flag' && (
            <FlagSelect label="" store={store} value={c.flag} onChange={(f) => ((c.flag = f ?? ''), commit())} />
          )}
          {c.type === 'in_location' && (
            <ChipMultiSelect
              options={store.options('location')}
              value={c.locations ?? []}
              emptyLabel="в кампании пока нет локаций"
              onChange={(v) => {
                c.locations = v
                commit()
              }}
            />
          )}
          {(c.type === 'has_item' || c.type === 'equipped') && (
            <ChipMultiSelect
              options={store.options('item')}
              value={c.items ?? []}
              emptyLabel="в кампании пока нет предметов"
              onChange={(v) => {
                c.items = v
                commit()
              }}
            />
          )}
          {c.type === 'weather' && (
            <RefSelect
              label=""
              kind="weather"
              store={store}
              value={c.weather}
              onChange={(w) => ((c.weather = w ?? ''), commit())}
            />
          )}
          <button className="btn btn-small ce-del" onClick={() => onChange(conds.filter((_, j) => j !== i))}><Ico n="close" /> </button>
        </div>
      ))}
      <button className="btn btn-small" onClick={() => onChange([...conds, blankNeedCond('time_of_day')])}>
        + условие
      </button>
    </div>
  )
}

export function SelectFld({ label, value, options, onChange }: { label: string; value: string; options: Array<{ id: string; label: string }>; onChange: (v: string) => void }) {
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

/**
 * Реестр статусов кампании (блок 5 ТЗ «Гибкий движок»). Вкладка называется
 * «Статусы и способности» — блок 6 добавит сюда же способности.
 */
