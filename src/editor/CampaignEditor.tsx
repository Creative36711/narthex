import { DEFAULT_EMOTION } from '../shared/types'
import { Ico } from '../shared/icons'
import { useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { EditorStore } from './store'
import { AnimImageEditor, AssetUpload, ConditionListEditor, EffectListEditor, ImageUpload, JsonField, RefSelect, DiceNotationInput } from './Fields'
import { BUILTIN_SKILL_LABELS, BUILTIN_STAT_LABELS } from '../shared/skills'
import { makeId } from './ids'
import { FlagSelect } from './Fields'
import { ParticleListEditor } from './AtmosEditors'
import type { CampaignFeatures, CampaignMeta, DiceRules, EndingDef, FeatDef, FontDef, GenWeightedItem, HeroPortraitLayerDef, ImageValue, NeedCondition, StatusDef, TimeOfDay } from '../shared/types'
import { CLASSIC_DICE_RULES, DEFAULT_DICE_RULES } from '../shared/types'
import { campaignFingerprint } from '../shared/fingerprint'
import { exportMonolith } from './monolith'
import { brightenHex } from '../shared/theme'
import { PROFILE_GROUPS, VISUAL_PROFILES, resolveProfile, contrastRatio } from '../shared/profiles'

import { askText, askConfirm } from './prompt'
import { showList, showAlert } from '../shared/modals'
import { applyPublish, loadCompat, planPublish, storeInventory, type PublishPlan } from './compatPublish'
import { diffReportLines } from '../shared/compat'
import { ENGINE_VERSION, PACKAGE_FORMAT, bumpVersion } from '../shared/versions'
import type { CampaignCompat } from '../shared/types'
import { migrateNeedCondition } from '../shared/migrate'
import { AudioRegistries, SoundHookMapEditor } from './AudioSection'

/** Тумблеры профиля механик (блок 1 ТЗ «Гибкий движок»): подпись и подсказка. */
const FEATURE_TOGGLES: Array<{ key: keyof CampaignFeatures; label: string; hint: string }> = [
  { key: 'map', label: 'Карта мира', hint: 'Путешествия между локациями. Выключите для камерных кампаний в одной локации — переходы останутся через сцены.' },
  { key: 'inventory', label: 'Инвентарь', hint: 'Вещи, экипировка и предметы в бою. Выдача предметов эффектами продолжит работать «за кадром».' },
  { key: 'needs', label: 'Потребности', hint: 'Шкалы выживания (голод, жажда…) и их убывание со временем.' },
  { key: 'skills', label: 'Навыки и проверки', hint: 'Проверки навыков будут заканчиваться успехом без броска, рост навыков отключится.' },
  { key: 'relationships', label: 'Отношения', hint: 'Панель отношений скроется; сами отношения продолжат меняться и влиять на диалоги.' },
  { key: 'trade', label: 'Торговля', hint: 'Прилавки торговцев перестанут открываться.' },
  { key: 'combat', label: 'Тактический бой', hint: 'Конфликты будут разрешаться немедленной победой без арены.' },
  { key: 'time', label: 'Часы в интерфейсе', hint: 'Скрывает время суток в HUD; само время продолжит идти для расписаний и событий.' },
]

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
function RegistryRows<T extends { id: string; label: string }>({
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

/**
 * Модификаторы черты строками «что — насколько»: без парсерного текста
 * «навык=+5, hp=+2» (фидбек 27, п.2: в редакторе всё читается человеком).
 */
type FeatModKind = 'skill' | 'stat' | 'hp' | 'mp' | 'mov'
const FEAT_MOD_KINDS: Array<{ id: FeatModKind; label: string }> = [
  { id: 'skill', label: 'Навык' },
  { id: 'stat', label: 'Характеристика' },
  { id: 'hp', label: 'Здоровье (HP)' },
  { id: 'mp', label: 'Мана (MP)' },
  { id: 'mov', label: 'Движение (MOV)' },
]

function FeatModRows({ store, mods, onChange }: {
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
function SkillDeltaRows({ store, mods, onChange }: {
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
function ChipMultiSelect({
  options,
  value,
  onChange,
  emptyLabel,
  className = '',
}: {
  options: Array<{ id: string; label: string }>
  value: string[]
  onChange: (v: string[]) => void
  emptyLabel: string
  className?: string
}) {
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])
  return (
    <div className={`chips chip-multi ${className}`}>
      {options.length === 0 && <span className="muted small">{emptyLabel}</span>}
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className={`chip ${value.includes(o.id) ? 'chip-on' : ''}`}
          onClick={() => toggle(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Секция «Правила бросков (d100)» (итерация 8, А7): пресеты + ручная подстройка. */
function DiceRulesEditor({
  value,
  commit,
}: {
  value: DiceRules
  commit: () => void
}) {
  const set = (patch: Partial<DiceRules>) => {
    Object.assign(value, patch)
    commit()
  }
  const preset = (p: 'generous' | 'classic') => {
    const r = p === 'classic' ? CLASSIC_DICE_RULES : DEFAULT_DICE_RULES
    Object.assign(value, { ...r })
    commit()
  }
  const isClassic =
    value.critical_divisor === CLASSIC_DICE_RULES.critical_divisor &&
    value.special_divisor === CLASSIC_DICE_RULES.special_divisor
  const isGenerous =
    value.critical_divisor === DEFAULT_DICE_RULES.critical_divisor &&
    value.special_divisor === DEFAULT_DICE_RULES.special_divisor &&
    !value.fumble_low_skill
  return (
    <div className="props-group">
      <h4>Правила бросков (d100)</h4>
      <div className="muted small" style={{ marginBottom: 8 }}>
        Пороги успеха и провала для проверок навыков. Показываются игроку в справке,
        поэтому менять их стоит до начала забега.
      </div>
      <div className="fld-row">
        <button
          className={`btn btn-small ${isGenerous ? 'btn-primary' : ''}`}
          onClick={() => preset('generous')}
          data-tip="Критический успех ≤ навык/5, особый ≤ навык/2, крит-провал 96–100"
        >
          <Ico n="dice" />  Хроника (по умолчанию)
        </button>
        <button
          className={`btn btn-small ${isClassic ? 'btn-primary' : ''}`}
          onClick={() => preset('classic')}
          data-tip="Критический успех ≤ навык/20, особый ≤ навык/5, крит-провал 00 или 96–100 при навыке ниже 30"
        >
          <Ico n="book" />  Классический BRP
        </button>
      </div>
      <div className="fld-row">
        <label className="fld" data-tip="Критический успех: бросок не больше «навык ÷ делитель»">
          <span>Крит: навык ÷</span>
          <input
            type="number"
            min={1}
            max={100}
            value={value.critical_divisor}
            onChange={(e) => set({ critical_divisor: Math.max(1, Number(e.target.value) || 1) })}
          />
        </label>
        <label className="fld" data-tip="Особый (хороший) успех: бросок не больше «навык ÷ делитель»">
          <span>Особый успех: навык ÷</span>
          <input
            type="number"
            min={1}
            max={100}
            value={value.special_divisor}
            onChange={(e) => set({ special_divisor: Math.max(1, Number(e.target.value) || 1) })}
          />
        </label>
        <label className="fld" data-tip="Критический провал начинается с этого броска">
          <span>Крит-провал с</span>
          <input
            type="number"
            min={2}
            max={100}
            value={value.fumble_from}
            onChange={(e) => set({ fumble_from: Math.min(100, Math.max(2, Number(e.target.value) || 96)) })}
          />
        </label>
      </div>
      <label className="fld fld-check" data-tip="Классический BRP: при низком навыке весь хвост 96–99 — тоже крит-провал">
        <input
          type="checkbox"
          checked={value.fumble_low_skill != null}
          onChange={(e) => {
            if (e.target.checked) value.fumble_low_skill = 30
            else delete value.fumble_low_skill
            commit()
          }}
        />
        <span>
          Весь хвост {value.fumble_from}–99 — провал при навыке ниже{''}
          <input
            type="number"
            min={1}
            max={100}
            disabled={value.fumble_low_skill == null}
            value={value.fumble_low_skill ?? 30}
            onChange={(e) => set({ fumble_low_skill: Number(e.target.value) || 30 })}
            style={{ width: 64 }}
          />
        </span>
      </label>
      <div className="muted small">
        Пример при навыке 45: крит ≤ {Math.floor(45 / (value.critical_divisor || 1))}, особый успех ≤{''}
        {Math.floor(45 / (value.special_divisor || 1))}, успех ≤ 45, крит-провал{''}
        {value.fumble_low_skill != null && 45 < value.fumble_low_skill
          ? `${value.fumble_from}–100`
          : `100${value.fumble_from < 100 ? ` и ${value.fumble_from}–99 при промахе выше навыка` : ''}`}
        .
      </div>
    </div>
  )
}

const TOD_RU: Array<{ id: TimeOfDay; label: string }> = [
  { id: 'morning', label: 'утро' },
  { id: 'day', label: 'день' },
  { id: 'evening', label: 'вечер' },
  { id: 'night', label: 'ночь' },
]

/** конструктор условий потребности («когда убывает» / «когда восстанавливается») */
function NeedCondEditor({
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

/** роли шрифтов темы: подпись и образец для предпросмотра */
const FONT_ROLES: Array<{ key: 'body' | 'display' | 'hand'; label: string; sample: string; cls: string }> = [
  { key: 'body', label: 'Основной текст', sample: 'Съешь же ещё этих мягких французских булок, да выпей чаю.', cls: 'font-sample-body' },
  { key: 'display', label: 'Заголовки', sample: 'Пепел Каэрдена', cls: 'font-sample-display' },
  { key: 'hand', label: 'Рукописный (журнал, записки)', sample: 'День третий. Дождь не утихает…', cls: 'font-sample-hand' },
]

/** живой предпросмотр шрифта: ставит временный @font-face и показывает образец */
function FontSample({ store, fontId, meta, role }: { store: EditorStore; fontId: string; meta: CampaignMeta; role: (typeof FONT_ROLES)[number] }) {
  const [family, setFamily] = useState<string | null>(null)
  const font = (meta.fonts ?? []).find((f) => f.id === fontId)
  useEffect(() => {
    if (!font?.src) {
      setFamily(null)
      return
    }
    const fam = `cf-preview-${font.id}`
    const el = document.createElement('style')
    el.textContent = `@font-face { font-family: '${fam}'; src: url('${store.assetSrc(font.src)}'); font-weight: ${font.weight || '400'}; font-style: ${font.style || 'normal'}; font-display: swap; }`
    document.head.appendChild(el)
    setFamily(fam)
    return () => {
      document.head.removeChild(el)
    }
  }, [font?.src, font?.weight, font?.style, store])
  const theme = meta.theme ?? {}
  const assigned = theme.fonts?.[role.key]
  return (
    <div className={`font-sample ${role.cls}`}>
      <span className="muted small">{role.label}: </span>
      {assigned && family ? (
        <span style={{ fontFamily: `'${family}', Georgia, serif` }}>{role.sample}</span>
      ) : assigned ? (
        <span className="muted">{role.sample}</span>
      ) : (
        <span className="muted small">— шрифт профиля —</span>
      )}
    </div>
  )
}

/** живой мини-предпросмотр: та же композиция, что в игре (сцена + панель HUD) */
function ProfilePreview({ meta }: { meta: CampaignMeta }) {
  const profile = resolveProfile(meta)
  const accent = meta.theme?.accent ?? profile.swatches.accent
  const accentBright = meta.theme?.accent ? brightenHex(meta.theme.accent) : brightenHex(profile.swatches.accent)
  const style = {
    '--pv-bg': profile.swatches.bg,
    '--pv-panel': profile.swatches.panel,
    '--pv-text': profile.swatches.text,
    '--pv-accent': accent,
    '--pv-accent-bright': accentBright,
    '--pv-frame': profile.swatches.frame,
    '--pv-font': profile.fonts.body,
    '--pv-display': profile.fonts.display,
  } as CSSProperties
  return (
    <div className="profile-preview" style={style} aria-label={`Предпросмотр: профиль ${profile.label}`}>
      <div className="profile-preview-scene">
        <span className="profile-preview-loc">Городские ворота — вид снаружи</span>
      </div>
      <div className="profile-preview-panel">
        <span className="pp-bar"><i style={{ width: '64%' }} /></span>
        <span className="pp-bar" style={{ opacity: 0.7 }}><i style={{ width: '38%' }} /></span>
        <span className="pp-btn solid">Действие</span>
        <span className="pp-btn">Открыть</span>
        <span className="pp-text">Текст интерфейса</span>
      </div>
    </div>
  )
}

/** карточки визуальных профилей: автор видит названия и свотчи, не id;
    каталог сгруппирован (фирменный / фэнтези / хоррор / детектив / выживание / фантастика) */
function ProfilePicker({ meta, commit }: { meta: CampaignMeta; commit: () => void }) {
  const current = resolveProfile(meta).id
  const set = (id: string) => {
    meta.theme = { ...(meta.theme ?? {}), profile: id as NonNullable<CampaignMeta['theme']>['profile'] }
    commit()
  }
  return (
    <div className="profile-catalog" role="radiogroup" aria-label="Визуальный профиль игры">
      {PROFILE_GROUPS.map((g) => {
        const cards = VISUAL_PROFILES.filter((p) => p.group === g.id)
        if (!cards.length) return null
        return (
          <div key={g.id} className="profile-group">
            <span className="profile-group-label">{g.label}</span>
            <div className="profile-cards">
              {cards.map((p) => {
                const on = p.id === current
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    className={`profile-card ${on ? 'on' : ''}`}
                    onClick={() => {
                      if (!on) set(p.id)
                    }}
                  >
                    <span className="profile-check" aria-hidden="true"><Ico n="check" /></span>
                    <span className="profile-swatch" aria-hidden="true">
                      <i style={{ background: p.swatches.bg }} />
                      <i style={{ background: p.swatches.panel }} />
                      <i style={{ background: p.swatches.text }} />
                      <i style={{ background: p.swatches.accent }} />
                      <i className="sw-frame" style={{ background: p.swatches.frame }} />
                    </span>
                    <span className="profile-card-title">{p.label}</span>
                    <span className="profile-card-tag">{p.tagline}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** вкладка «Оформление»: визуальный профиль, атмосфера, шрифты, фоны, акцент (редизайн 2026 + блок 2 ТЗ) */
function ThemeTab({ meta, store, commit }: { meta: CampaignMeta; store: EditorStore; commit: () => void }) {
  const fonts = meta.fonts ?? (meta.fonts = [])
  const theme = meta.theme ?? (meta.theme = {})
  const fontOpts = fonts.map((f) => ({ id: f.id, label: f.label || f.id }))
  const profile = resolveProfile(meta)
  const accent = theme.accent ?? profile.swatches.accent
  // контраст акцента к панели: ниже порога — предупреждаем, но не запрещаем
  const accentContrast = contrastRatio(accent, profile.swatches.panel)

  const setFont = (patch: Partial<NonNullable<CampaignMeta['theme']>['fonts'] & object>) => {
    theme.fonts = { ...(theme.fonts ?? {}), ...patch }
    commit()
  }

  const resetToProfile = async () => {
    if (!(await askConfirm(
      `Вернуть оформление профиля «${profile.label}» по умолчанию?`,
      'Сбросить',
    ))) return
    // сбрасываем только авторские переопределения — профиль и контент не трогаем
    delete theme.accent
    delete theme.fonts
    delete theme.menu
    delete theme.end
    delete theme.atmosphere
    commit()
  }

  return (
    <>
      <div className="props-group">
        <h4>Визуальный профиль</h4>
        <div className="muted small" style={{ marginBottom: 4 }}>
          Стартовый художественный набор игры: палитра, шрифты, стиль панелей и атмосферный эффект.
          Профиль не меняет механику и данные — только оформление. После выбора его можно
          докрутить: акцент, шрифты, фоны.
        </div>
        <ProfilePicker meta={meta} commit={commit} />
        <ProfilePreview meta={meta} />
        <div style={{ marginTop: 12 }}>
          <label className="fld fld-check">
            <input
              type="checkbox"
              checked={theme.atmosphere !== false}
              onChange={(e) => {
                if (e.target.checked) delete theme.atmosphere
                else theme.atmosphere = false
                commit()
              }}
            />
            <span>Атмосферный эффект профиля ({profile.effectLabel})</span>
          </label>
        </div>
      </div>

      <div className="props-group">
        <h4>Акцентный цвет</h4>
        <div className="muted small" style={{ marginBottom: 8 }}>
          Переопределяет акцент профиля: кнопки, рамки, подсветки. Если контраст низкий —
          подсказка под полем.
        </div>
        <div className="fld-row">
          <label className="fld" data-tip="Цвет кнопок, рамок и подсветок. Слишком тёмный — пропадёт контраст.">
            <span>Цвет кнопок, рамок и подсветок</span>
            <input
              type="color"
              value={accent}
              onChange={(e) => {
                theme.accent = e.target.value
                commit()
              }}
            />
          </label>
          {theme.accent && (
            <button
              className="btn btn-small"
              onClick={() => {
                delete theme.accent
                commit()
              }}
            >
              Вернуть акцент профиля
            </button>
          )}
        </div>
        {accentContrast < 2.5 && (
          <div className="accent-contrast-warn" role="alert">
            <Ico n="warn" />  Низкий контраст с панелями ({accentContrast.toFixed(1)}:1). Подсветки и
            подписи на кнопках могут стать трудночитаемыми — выберите светлее.
          </div>
        )}
      </div>

      <div className="props-group">
        <h4>Тоны поверхностей и рамка-«кадр»</h4>
        <div className="muted small" style={{ marginBottom: 8 }}>
          Докрутка палитры профиля: панели, карточки и кнопки, колодцы полей, фон журнала.
          Пустое поле — тон профиля. Рамка-«кадр» обрамляет все панели игры: PNG с
          изображением-изображением (прозрачная сердцевина, орнамент по краям).
        </div>
        <div className="fld-row" style={{ flexWrap: 'wrap' }}>
          {([
            ['panel', 'Панели'],
            ['cards', 'Карточки и кнопки'],
            ['inset', 'Колодцы полей'],
            ['log', 'Фон журнала'],
          ] as const).map(([key, label]) => (
            <label key={key} className="fld" data-tip="Пусто — тон визуального профиля">
              <span>{label}</span>
              <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  type="color"
                  value={theme.tokens?.[key] ?? '#888888'}
                  onChange={(e) => {
                    theme.tokens = { ...(theme.tokens ?? {}), [key]: e.target.value }
                    commit()
                  }}
                  disabled={!theme.tokens?.[key]}
                />
                <input
                  type="checkbox"
                  checked={!!theme.tokens?.[key]}
                  data-tip={`Свой тон «${label}»`}
                  onChange={(e) => {
                    const next = { ...(theme.tokens ?? {}) }
                    if (e.target.checked) next[key] = '#2a2f3c'
                    else delete next[key]
                    theme.tokens = Object.keys(next).length ? next : undefined
                    commit()
                  }}
                />
              </span>
            </label>
          ))}
        </div>
        <ImageUpload
          label="Рамка-«кадр» для панелей (PNG, орнамент по краям)"
          value={theme.frame?.image ?? ''}
          dir="assets/img/ui"
          store={store}
          onChange={(path) => {
            if (path) theme.frame = { ...(theme.frame ?? {}), image: path }
            else if (theme.frame) { delete theme.frame.image; if (!theme.frame.image && !theme.frame.slice && !theme.frame.width) delete theme.frame }
            commit()
          }}
        />
        {theme.frame?.image && (
          <div className="fld-row">
            <label className="fld fld-num" data-tip="Какую часть картинки от края считать орнаментом (px, умолчание 30)">
              <span>Глубина среза, px</span>
              <input
                type="number" min={4} max={120}
                value={theme.frame.slice ?? 30}
                onChange={(e) => { theme.frame!.slice = Number(e.target.value) || undefined; commit() }}
              />
            </label>
            <label className="fld fld-num" data-tip="Видимая толщина рамки на панели (px, умолчание 20)">
              <span>Толщина рамки, px</span>
              <input
                type="number" min={4} max={60}
                value={theme.frame.width ?? 20}
                onChange={(e) => { theme.frame!.width = Number(e.target.value) || undefined; commit() }}
              />
            </label>
          </div>
        )}
      </div>

      <div className="props-group">
        <h4>Полный CSS мастера (продвинутое оформление)</h4>
        <div className="muted small" style={{ marginBottom: 8 }}>
          Свой CSS применяется <b>только к игре</b> (редактор остаётся в фирменном стиле).
          Пишите правила для селекторов внутри контейнера игры, например{' '}
          <code>.cf-themed .btn {'{ … }'}</code>. Движок не гарантирует стабильность классов между
          версиями — слой на совести мастера; сначала попробуйте токены и рамки выше,
          они почти всегда закрывают нужный наряд. Эта возможность готовится как отдельная опция —
          в будущем может стать платной «премиум-темой».
        </div>
        <label className="fld">
          <span>Свои CSS-правила</span>
          <textarea
            rows={10}
            style={{ fontFamily: 'monospace' }}
            placeholder={'.cf-themed .panel { box-shadow: 0 0 24px rgba(0,0,0,.5); }'}
            value={theme.custom_css ?? ''}
            onChange={(e) => {
              if (e.target.value.trim()) theme.custom_css = e.target.value
              else delete theme.custom_css
              commit()
            }}
          />
        </label>
        <div className="muted small">Проверить результат сразу можно через кнопку «Плейтест» — CSS подхватывается без перезапуска.</div>
      </div>

      <div className="props-group">
        <h4>Надписи системных меню и кнопок</h4>
        <div className="muted small" style={{ marginBottom: 8 }}>
          Задайте атмосферные названия системных элементов под мир вашей кампании (пусто — названия по умолчанию).
        </div>
        <div className="fld-row" style={{ flexWrap: 'wrap' }}>
          {([
            ['inventory', 'Инвентарь', 'например «Сумка дознавателя»'],
            ['journal', 'Журнал', 'например «Дело № 137»'],
            ['map', 'Карта', 'например «Схема ярусов»'],
            ['camp', 'Лагерь / Отдых', 'например «Перекур»'],
            ['codex', 'Кодекс', 'например «Архив Надзора»'],
            ['craft', 'Ремесло', 'например «Верстак»'],
            ['character', 'Герой / Персонаж', 'например «Досье»'],
            ['pass_turn', 'Завершить ход в бою', 'например «Выждать»'],
            ['flee', 'Отступить из боя', 'например «Бежать»'],
          ] as const).map(([key, label, ph]) => {
            const u = meta.ui_labels ?? {}
            return (
              <label key={key} className="fld" style={{ minWidth: 200, flex: '1 1 200px' }}>
                <span>{label}</span>
                <input
                  value={u[key] ?? ''}
                  placeholder={ph}
                  onChange={(e) => {
                    const next = { ...(meta.ui_labels ?? {}) }
                    if (e.target.value.trim()) next[key] = e.target.value
                    else delete next[key]
                    if (Object.keys(next).length > 0) meta.ui_labels = next
                    else delete meta.ui_labels
                    commit()
                  }}
                />
              </label>
            )
          })}
        </div>
      </div>

      <div className="props-group">
        <h4>Шрифты кампании</h4>
        <div className="muted small" style={{ marginBottom: 8 }}>
          Загруженные шрифты применяются ко всей игре: диалогам, панелям, меню. Редактор остаётся
          в фирменном стиле. Лучше всего подходят форматы <b>woff2/woff</b> — они весят меньше.
        </div>
        {fonts.map((f, i) => (
          <div key={f.id} className="props-group theme-font-row">
            <div className="fld-row">
              <label className="fld">
                <span>Название</span>
                <input value={f.label} onChange={(e) => ((f.label = e.target.value), commit())} />
              </label>
              <label className="fld">
                <span>Начертание</span>
                <select
                  value={f.weight || '400'}
                  onChange={(e) => {
                    if (e.target.value === '400') delete f.weight
                    else f.weight = e.target.value
                    commit()
                  }}
                >
                  <option value="400">Обычное</option>
                  <option value="700">Жирное</option>
                  <option value="300">Тонкое</option>
                </select>
              </label>
              <label className="fld">
                <span>Наклон</span>
                <select
                  value={f.style || 'normal'}
                  onChange={(e) => {
                    if (e.target.value === 'normal') delete f.style
                    else f.style = e.target.value as FontDef['style']
                    commit()
                  }}
                >
                  <option value="normal">Прямой</option>
                  <option value="italic">Курсив</option>
                </select>
              </label>
              <label className="fld" data-tip="Поправка размера шрифта: 100% — как есть, 90% — чуть уменьшить, 110% — увеличить">
                <span>Масштаб шрифта</span>
                <input
                  type="number"
                  min={0.7}
                  max={1.4}
                  step={0.05}
                  placeholder="1.0"
                  value={f.size_adjust ?? ''}
                  onChange={(e) => {
                    const val = e.target.value ? Number(e.target.value) : undefined
                    if (val === 1 || !val) delete f.size_adjust
                    else f.size_adjust = val
                    commit()
                  }}
                />
              </label>
            </div>
            <AssetUpload
              label="Файл шрифта (.woff2, .woff, .ttf, .otf)"
              value={f.src}
              dir="assets/fonts"
              store={store}
              kind="font"
              onChange={(p) => ((f.src = p), commit())}
            />
            <button
              className="btn btn-small ce-del"
              onClick={() => {
                fonts.splice(i, 1)
                // снять роли, что ссылались на удалённый шрифт
                if (theme.fonts) {
                  for (const k of ['body', 'display', 'hand'] as const) {
                    if (theme.fonts[k] === f.id) delete theme.fonts[k]
                  }
                }
                commit()
              }}
            >
              <Ico n="trash" />  Удалить шрифт
            </button>
          </div>
        ))}
        <button
          className="btn btn-small"
          onClick={() => {
            const id = makeId('font', String(fonts.length + 1), fonts.map((x) => x.id))
            fonts.push({ id, label: 'Новый шрифт', src: '' })
            commit()
          }}
        >
          <Ico n="plus" />  Добавить шрифт
        </button>
      </div>

      <div className="props-group">
        <h4>Куда какой шрифт</h4>
        {FONT_ROLES.map((role) => (
          <div key={role.key} className="theme-role">
            <label className="fld">
              <span>{role.label}</span>
              <select value={theme.fonts?.[role.key] ?? ''} onChange={(e) => setFont({ [role.key]: e.target.value || undefined })}>
                <option value="">Профиль (по умолчанию)</option>
                {fontOpts.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <FontSample store={store} fontId={theme.fonts?.[role.key] ?? ''} meta={meta} role={role} />
          </div>
        ))}
      </div>

      <div className="props-group">
        <h4>Размеры текста и типографика</h4>
        <div className="fld-row">
          <label className="fld" data-tip="Общий масштаб текста всей кампании (80% .. 140%)">
            <span>Общий масштаб текста: {Math.round((theme.font_scale ?? 1) * 100)}%</span>
            <input
              type="range"
              min={0.8}
              max={1.4}
              step={0.05}
              value={theme.font_scale ?? 1}
              onChange={(e) => {
                theme.font_scale = Number(e.target.value) === 1 ? undefined : Number(e.target.value)
                commit()
              }}
            />
          </label>
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', paddingBottom: 4 }}>
            <button
              type="button"
              className="btn btn-small"
              onClick={() => { theme.font_scale = 0.9; commit() }}
            >
              90%
            </button>
            <button
              type="button"
              className="btn btn-small"
              onClick={() => { theme.font_scale = undefined; commit() }}
            >
              100%
            </button>
            <button
              type="button"
              className="btn btn-small"
              onClick={() => { theme.font_scale = 1.15; commit() }}
            >
              115%
            </button>
            <button
              type="button"
              className="btn btn-small"
              onClick={() => { theme.font_scale = 1.25; commit() }}
            >
              125%
            </button>
          </div>
        </div>

        <div className="fld-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginTop: 8 }}>
          <label className="fld" data-tip="Размер основного текста, описаний сцен и предметов (px, умолчание 15)">
            <span>Основной текст (px)</span>
            <input
              type="number"
              min={11}
              max={28}
              placeholder="15"
              value={theme.font_sizes?.body ?? ''}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : undefined
                theme.font_sizes = { ...(theme.font_sizes ?? {}), body: val }
                if (!theme.font_sizes.body && !theme.font_sizes.display && !theme.font_sizes.dialogue && !theme.font_sizes.ui) {
                  delete theme.font_sizes
                }
                commit()
              }}
            />
          </label>
          <label className="fld" data-tip="Размер реплик и вариантов ответов в диалогах (px, умолчание 16)">
            <span>Диалоги (px)</span>
            <input
              type="number"
              min={12}
              max={30}
              placeholder="16"
              value={theme.font_sizes?.dialogue ?? ''}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : undefined
                theme.font_sizes = { ...(theme.font_sizes ?? {}), dialogue: val }
                if (!theme.font_sizes.body && !theme.font_sizes.display && !theme.font_sizes.dialogue && !theme.font_sizes.ui) {
                  delete theme.font_sizes
                }
                commit()
              }}
            />
          </label>
          <label className="fld" data-tip="Базовый размер заголовков локаций, сцен, панелей (px, умолчание 20)">
            <span>Заголовки (px)</span>
            <input
              type="number"
              min={14}
              max={36}
              placeholder="20"
              value={theme.font_sizes?.display ?? ''}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : undefined
                theme.font_sizes = { ...(theme.font_sizes ?? {}), display: val }
                if (!theme.font_sizes.body && !theme.font_sizes.display && !theme.font_sizes.dialogue && !theme.font_sizes.ui) {
                  delete theme.font_sizes
                }
                commit()
              }}
            />
          </label>
          <label className="fld" data-tip="Размер кнопок, списков и элементов интерфейса (px, умолчание 13)">
            <span>Кнопки и интерфейс (px)</span>
            <input
              type="number"
              min={10}
              max={22}
              placeholder="13"
              value={theme.font_sizes?.ui ?? ''}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : undefined
                theme.font_sizes = { ...(theme.font_sizes ?? {}), ui: val }
                if (!theme.font_sizes.body && !theme.font_sizes.display && !theme.font_sizes.dialogue && !theme.font_sizes.ui) {
                  delete theme.font_sizes
                }
                commit()
              }}
            />
          </label>
        </div>

        <div className="fld-row" style={{ marginTop: 8 }}>
          <label className="fld" data-tip="Межстрочный интервал (множитель 1.2 .. 2.0, по умолчанию 1.5)">
            <span>Межстрочный интервал: {theme.line_height ?? 1.5}</span>
            <input
              type="range"
              min={1.2}
              max={2.0}
              step={0.05}
              value={theme.line_height ?? 1.5}
              onChange={(e) => {
                const val = Number(e.target.value)
                theme.line_height = val === 1.5 ? undefined : val
                commit()
              }}
            />
          </label>
          <label className="fld" data-tip="Межбуквенный интервал, например 0.02em (по умолчанию обычно)">
            <span>Межбуквенный интервал</span>
            <input
              type="text"
              placeholder="напр. 0.02em"
              value={theme.letter_spacing ?? ''}
              onChange={(e) => {
                theme.letter_spacing = e.target.value.trim() || undefined
                commit()
              }}
            />
          </label>
        </div>

        <div
          className="font-preview-box"
          style={{
            marginTop: 12,
            padding: 12,
            border: '1px solid var(--ed-line)',
            borderRadius: 6,
            background: 'var(--ed-bg-2)',
          }}
        >
          <div style={{ fontSize: `${Math.round((theme.font_sizes?.display ?? 20) * (theme.font_scale ?? 1))}px`, fontWeight: 'bold', color: 'var(--gold, #d4af37)', marginBottom: 6 }}>
            Пример заголовка сцены
          </div>
          <div style={{ fontSize: `${Math.round((theme.font_sizes?.dialogue ?? 16) * (theme.font_scale ?? 1))}px`, color: 'var(--ed-text)', lineHeight: theme.line_height ?? 1.5, marginBottom: 6 }}>
            «Здравствуй, путник. Здесь каждый шаг отдаётся эхом в пустых шлюзах.»
          </div>
          <div style={{ fontSize: `${Math.round((theme.font_sizes?.body ?? 15) * (theme.font_scale ?? 1))}px`, color: 'var(--ed-text-muted, #aaa)', lineHeight: theme.line_height ?? 1.5 }}>
            Листы объявлений трепещут на ржавой доске под порывами сырого сквозняка.
          </div>
        </div>
      </div>

      <div className="props-group">
        <h4>Главное меню</h4>
        <AssetUpload
          label="Фоновая картинка меню"
          value={theme.menu?.background ?? ''}
          dir="assets/img"
          store={store}
          onChange={(p) => {
            theme.menu = { ...(theme.menu ?? {}), background: p || undefined }
            commit()
          }}
        />
        <div className="fld-row">
          <label className="fld" data-tip="Чем темнее фон, тем читаемее текст поверх картинки">
            <span>Затемнение фона</span>
            <input
              type="range"
              min={0}
              max={0.9}
              step={0.05}
              value={theme.menu?.dim ?? 0.5}
              onChange={(e) => {
                theme.menu = { ...(theme.menu ?? {}), dim: Number(e.target.value) }
                commit()
              }}
            />
          </label>
          <label className="fld fld-check">
            <input
              type="checkbox"
              checked={!!theme.menu?.ken_burns}
              onChange={(e) => {
                theme.menu = { ...(theme.menu ?? {}), ken_burns: e.target.checked || undefined }
                commit()
              }}
            />
            <span>Медленный зум фона («кен-бёрнс»)</span>
          </label>
        </div>
        <AssetUpload
          label="Арт-заголовок кампании (лого над названием, необязательно)"
          value={theme.menu?.title_art ?? ''}
          dir="assets/img"
          store={store}
          onChange={(p) => {
            theme.menu = { ...(theme.menu ?? {}), title_art: p || undefined }
            commit()
          }}
        />
      </div>

      <div className="props-group">
        <h4>Экран финала</h4>
        <AssetUpload
          label="Фон экрана победы/смерти (нет — возьмётся фон меню)"
          value={theme.end?.background ?? ''}
          dir="assets/img"
          store={store}
          onChange={(p) => {
            theme.end = { background: p || undefined }
            if (!theme.end.background) delete theme.end
            commit()
          }}
        />
      </div>

      <div className="props-group">
        <h4>Сброс</h4>
        <div className="muted small" style={{ marginBottom: 8 }}>
          Убрать авторские переопределения (акцент, шрифты, фоны, атмосферу) и вернуть
          оформление выбранного профиля. Контент кампании и профиль не меняются.
        </div>
        <button className="btn btn-small" onClick={() => void resetToProfile()}>
          <Ico n="undo" />  Сбросить к профилю «{profile.label}»
        </button>
      </div>
    </>
  )
}


/** Редактор глав кампании: id получаются автоматически (переименовывать не надо), мастер задаёт название/порядок/описание. */
function ChaptersEditor({ m, commit }: { m: CampaignMeta; commit: () => void }) {
  const chapters = m.chapters ?? []
  const sorted = [...chapters].sort((a, b) => (a.order ?? chapters.indexOf(a)) - (b.order ?? chapters.indexOf(b)))
  const upd = (id: string, patch: Partial<(typeof chapters)[number]>) => {
    m.chapters = chapters.map((c) => (c.id === id ? { ...c, ...patch } : c))
    commit()
  }
  return (
    <div className="props-group">
      <h4>Главы кампании</h4>
      <p className="muted small" style={{ marginTop: 0 }}>
        Группировка контента по частям: сцены, правила, квесты и катсцены помечают выбором «Глава» в своих формах;
        списки слева фильтруются по ней. Сам движок глав не различает — это сборка для мастера и будущей выкладки «бесплатный пролог → продолжение».
      </p>
      {sorted.map((c) => (
        <div key={c.id} className="panel" style={{ padding: 8, marginBottom: 8 }}>
          <div className="fld-row">
            <label className="fld">
              <span>Название главы</span>
              <input value={c.label} onChange={(e) => upd(c.id, { label: e.target.value })} />
            </label>
            <label className="fld" data-tip="Меньше — раньше">
              <span>Порядок</span>
              <input type="number" value={c.order ?? sorted.indexOf(c) + 1} onChange={(e) => upd(c.id, { order: Number(e.target.value) || undefined })} />
            </label>
            <button
              className="btn btn-small ce-del"
              style={{ alignSelf: 'end' }}
              data-tip="Сцены/правила этой главы останутся — просто потеряют пометку"
              onClick={() => { m.chapters = chapters.filter((x) => x.id !== c.id); commit() }}
            >
              <Ico n="close" />
            </button>
          </div>
          <label className="fld fld-block">
            <span>О чём глава (кратко)</span>
            <input value={c.description ?? ''} placeholder="первая ночь в городе, завязка конфликта…" onChange={(e) => upd(c.id, { description: e.target.value || undefined })} />
          </label>
        </div>
      ))}
      <button
        className="btn btn-small"
        onClick={() => {
          const id = makeId('chapter', 'глава', chapters.map((x) => x.id))
          m.chapters = [...chapters, { id, label: 'Новая глава', order: chapters.length + 1 }]
          commit()
        }}
      >
        <Ico n="plus" /> глава
      </button>
    </div>
  )
}

/** Отпечаток кампании — по клику (монолит пересобирается, тяжело для рендера-на-каплю). */
function AttributionEditor({ m, commit, store }: { m: CampaignMeta; commit: () => void; store: EditorStore }) {
  const [print, setPrint] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const a = m.attribution ?? {}
  const upd = (patch: Partial<typeof a>) => {
    const next = { ...a, ...patch }
    const empty = !next.author && !next.origin_url && !next.published_at && !next.note
    m.attribution = empty ? undefined : next
    commit()
  }
  return (
    <div className="props-group">
      <h4>Авторство и публикация</h4>
      <div className="fld-row">
        <label className="fld">
          <span>Автор (как на титуле публикации)</span>
          <input value={a.author ?? ''} onChange={(e) => upd({ author: e.target.value || undefined })} />
        </label>
        <label className="fld" data-tip="Каноническая копия — репозиторий мастера; история коммитов доказывает первую публикацию">
          <span>Канонический адрес (GitHub)</span>
          <input value={a.origin_url ?? ''} placeholder="https://github.com/автор/кампания" onChange={(e) => upd({ origin_url: e.target.value || undefined })} />
        </label>
      </div>
      <div className="fld-row">
        <label className="fld">
          <span>Вышла (дата)</span>
          <input
            type="date"
            value={/^\d{4}-\d{2}-\d{2}$/.test(a.published_at ?? '') ? a.published_at : ''}
            onChange={(e) => upd({ published_at: e.target.value || undefined })}
          />
        </label>
      </div>
      <label className="fld fld-block">
        <span>Сноска о происхождении (источники, вдохновение)</span>
        <input value={a.note ?? ''} onChange={(e) => upd({ note: e.target.value || undefined })} />
      </label>
      <div className="fld-row" style={{ alignItems: 'center' }}>
        {print ? (
          <code className="small" style={{ wordBreak: 'break-all' }}>отпечаток: {print}</code>
        ) : (
          <button
            className="btn btn-small"
            disabled={busy}
            data-tip="SHA-256 канонической формы кампании без полей публикации: смена «автора» не поменяет подпись"
            onClick={async () => {
              setBusy(true)
              try {
                const { doc } = exportMonolith(store)
                const hex = await campaignFingerprint(doc)
                setPrint(`${hex.slice(0, 16)}…${hex.slice(-8)}`)
              } finally {
                setBusy(false)
              }
            }}
          >
            Показать отпечаток кампании
          </button>
        )}
        <span className="muted small">Мастерская сравнит его со своими кампаниями — совпадение до полей публикации означает перелив.</span>
      </div>
    </div>
  )
}

function parseSkillBase(base: string | number | undefined): { fixedNum: number | undefined; statKey: string; mult: number } {
  if (typeof base === 'number') {
    return { fixedNum: base, statKey: '', mult: 1 }
  }
  if (typeof base === 'string') {
    let fixedNum: number | undefined
    let statKey = ''
    let mult = 1
    const parts = base.split('+').map((p) => p.trim())
    for (const part of parts) {
      if (/^\d+$/.test(part)) {
        fixedNum = parseInt(part, 10)
      } else {
        const m = part.match(/^([A-Za-z]+)(?:\s*[×x*]\s*(\d+))?$/)
        if (m) {
          statKey = m[1].toUpperCase()
          mult = m[2] ? parseInt(m[2], 10) : 1
        }
      }
    }
    return { fixedNum, statKey, mult }
  }
  return { fixedNum: undefined, statKey: '', mult: 1 }
}

function buildSkillBase(fixedNum: number | undefined, statKey: string, mult: number): string | number | undefined {
  const cleanStat = statKey.trim().toUpperCase()
  if (cleanStat) {
    const statPart = mult > 1 ? `${cleanStat}×${mult}` : cleanStat
    if (fixedNum != null && !isNaN(fixedNum) && fixedNum > 0) {
      return `${fixedNum}+${statPart}`
    }
    return statPart
  }
  if (fixedNum != null && !isNaN(fixedNum)) {
    return fixedNum
  }
  return undefined
}

export function CampaignEditor({ store }: { store: EditorStore }) {
  const m = store.meta
  // дефолты для необязательных полей (без touch — просто нормализация)
  if (!m.time_of_day) m.time_of_day = { morning: 6, day: 10, evening: 18, night: 22 }
  if (!m.factions) m.factions = []
  if (!m.roguelike) m.roguelike = { permadeath: true, meta_progress: [], randomize_on_restart: [] }
  if (m.starting_tick === undefined) m.starting_tick = 0
  if (m.max_companions === undefined) m.max_companions = 2
  // правила бросков d100 (итерация 8, А7): по умолчанию — «щедрые»
  if (!m.dice_rules) m.dice_rules = { ...DEFAULT_DICE_RULES }
  const [, force] = useState(0)
  const commit = () => {
    store.touch('campaign.json')
    force((n) => n + 1)
  }
  type CeTab = 'main' | 'creation' | 'versions' | 'chronicle' | 'mechanics' | 'look' | 'statuses' | 'people' | 'items' | 'flags' | 'audio' | 'json' | 'generators'

  const [tab, setTab] = useState<CeTab>('main')

  const sceneOpts = store.options('scene')
  const locOpts = store.options('location')
  const regionOpts = store.world.regions.map((r) => ({ id: r.id, label: r.label }))
  const npcOpts = store.options('npc')

  return (
    <div className="rule-editor">
      <div className="ce-tabs" role="tablist" aria-label="Вкладки кампании">
        {([['main', 'Основное'], ['creation', 'Создание героя'], ['versions', 'Версии'], ['mechanics', 'Механики'], ['look', 'Оформление'], ['statuses', 'Статусы и способности'], ['people', 'Персонажи'], ['items', 'Предметы и слоты'], ['flags', 'Флаги'], ['audio', 'Звук и музыка'], ['generators', 'События и генераторы'], ['chronicle', 'Хроника'], ['json', 'JSON']] as const).map(([id, lab]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={`ce-tab ${tab === id ? 'on' : ''}`} onClick={() => setTab(id)}>
            {lab}
          </button>
        ))}
      </div>

      {tab === 'versions' && <VersionsTab store={store} commit={commit} />}

      {tab === 'chronicle' && (
        <div className="ce-page">
      <div className="props-group">
        <h4>Хроника: прогресс между забегами</h4>
        <div className="muted small" style={{ marginBottom: 8 }}>
          Необязательный «надзабеговой» слой: достижения, метавалюты и магазин
          постоянных усилений. Включён — в игре в HUD появляется кнопка «Хроника».
          Всё хранится на устройстве игрока отдельной записью между забегами.
        </div>
        <div className="fld-row">
          <label className="fld fld-check">
            <input type="checkbox" checked={!!m.metaprogress} onChange={(e) => { if (e.target.checked) { m.metaprogress = { currencies: [{ id: 'ember', label: 'Угли' }], achievements: [], unlocks: [] } } else { delete m.metaprogress } commit() }} />
            <span>Хроника включена</span>
          </label>
        </div>
        {m.metaprogress && (
          <>
            <h4>Метавалюты</h4>
            <div className="muted small" style={{ marginBottom: 8 }}>
              Копятся между забегами и тратятся в магазине усилений.
            </div>
            {(m.metaprogress.currencies ?? []).map((c, ci) => (
              <div key={c.id} className="fld-row" style={{ alignItems: 'center' }}>
                <input
                  style={{ flex: 1 }}
                  value={c.label}
                  placeholder="Название метавалюты (например «Угли»)"
                  onChange={(e) => { m.metaprogress!.currencies![ci] = { ...c, label: e.target.value }; commit() }}
                />
                <button
                  className="btn btn-small btn-danger"
                  data-tip="Убрать метавалюту (цены контента скинутся на первую по списку)"
                  onClick={() => {
                    m.metaprogress!.currencies = (m.metaprogress!.currencies ?? []).filter((_, j) => j !== ci)
                    if (!(m.metaprogress!.currencies ?? []).length) m.metaprogress!.currencies = [{ id: 'ember', label: 'Угли' }]
                    commit()
                  }}
                ><Ico n="trash" /></button>
              </div>
            ))}
            <div className="fld-row">
              <button className="btn btn-small" onClick={() => { m.metaprogress!.currencies = [...(m.metaprogress!.currencies ?? []), { id: makeId('meta', `валюта ${(m.metaprogress!.currencies?.length ?? 0) + 1}`, (m.metaprogress!.currencies ?? []).map((x) => x.id)), label: '' }]; commit() }}><Ico n="plus" /> метавалюта</button>
            </div>

            <h4 style={{ marginTop: 14 }}>Достижения</h4>
            <div className="muted small" style={{ marginBottom: 8 }}>
              Награды/заметки пути. У каждого — условие спокойствия: либо счётчик
              действий за все забеги, либо условия (как у правил). «Тайное»
              скрытое в хронике, пока не открыто.
            </div>
            <div className="fld-row">
              <button
                className="btn btn-small"
                onClick={() => {
                  m.metaprogress!.achievements = [...(m.metaprogress!.achievements ?? []), { id: makeId('ach', `достижение ${(m.metaprogress!.achievements?.length ?? 0) + 1}`, (m.metaprogress!.achievements ?? []).map((x) => x.id)), label: 'Новое достижение' }]
                  commit()
                }}
              ><Ico n="plus" /> достижение</button>
            </div>
            {(m.metaprogress.achievements ?? []).map((a, ai) => (
              <div key={a.id} className="panel" style={{ padding: 8, marginTop: 6 }}>
                <div className="fld-row">
                  <input style={{ flex: 1 }} value={a.label} placeholder="Название достижения"
                    onChange={(e) => { const arr = [...(m.metaprogress!.achievements ?? [])]; arr[ai] = { ...a, label: e.target.value }; m.metaprogress!.achievements = arr; commit() }} />
                  <button className="btn btn-small btn-danger" onClick={() => { m.metaprogress!.achievements = (m.metaprogress!.achievements ?? []).filter((_, j) => j !== ai); commit() }}><Ico n="trash" /></button>
                </div>
                <div className="fld-row" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
                  <label className="fld fld-check" data-tip="Открывается автоматически, когда сумма действий за все забеги достигнет цели">
                    <input
                      type="checkbox"
                      checked={!!a.counter}
                      onChange={(e) => { const arr = [...(m.metaprogress!.achievements ?? [])]; arr[ai] = { ...a }; if (e.target.checked) arr[ai].counter = { stat: 'kills', target: 10 }; else delete arr[ai].counter; m.metaprogress!.achievements = arr; commit() }}
                    />
                    <span>открывается счётчиком</span>
                  </label>
                  {a.counter && (
                    <>
                      <select
                        value={a.counter.stat}
                        onChange={(e) => { const arr = [...(m.metaprogress!.achievements ?? [])]; arr[ai] = { ...a, counter: { stat: e.target.value as never, target: a.counter?.target ?? 10 } }; m.metaprogress!.achievements = arr; commit() }}
                      >
                        <option value="kills">убийств в бою</option>
                        <option value="travels">переходов между сценами</option>
                        <option value="dialogues">начатых разговоров</option>
                        <option value="ticks_survived">прожитых минут</option>
                        <option value="quests_completed">завершённых квестов</option>
                      </select>
                      <label className="fld" data-tip="Цель: сколько раз нужно выполнить действие (суммарно за все забеги)">
                        <span>цель</span>
                        <input type="number" min={1} value={a.counter.target}
                          onChange={(e) => { const arr = [...(m.metaprogress!.achievements ?? [])]; arr[ai] = { ...a, counter: { stat: a.counter!.stat, target: Math.max(1, +e.target.value || 1) } }; m.metaprogress!.achievements = arr; commit() }} />
                      </label>
                    </>
                  )}
                  <label className="fld fld-check" data-tip="Не показывать в хронике до открытия">
                    <input type="checkbox" checked={!!a.hidden}
                      onChange={(e) => { const arr = [...(m.metaprogress!.achievements ?? [])]; arr[ai] = { ...a, hidden: e.target.checked || undefined }; m.metaprogress!.achievements = arr; commit() }} />
                    <span>тайное</span>
                  </label>
                </div>
                <div className="fld-row" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
                  <span className="fld-label">Награда:</span>
                  <label className="fld">
                    <span>метавалюта</span>
                    <select value={a.reward?.currency ?? ''} onChange={(e) => { const arr = [...(m.metaprogress!.achievements ?? [])]; arr[ai] = { ...a }; if (e.target.value) { arr[ai].reward = { ...(arr[ai].reward ?? {}), currency: e.target.value, amount: arr[ai].reward?.amount ?? 5 } } else if (arr[ai].reward) { delete arr[ai].reward!.currency; delete arr[ai].reward!.amount; if (!Object.keys(arr[ai].reward!).length) delete arr[ai].reward } m.metaprogress!.achievements = arr; commit() }}>
                      <option value="">— не нужна —</option>
                      {(m.metaprogress!.currencies ?? []).map((c) => <option key={c.id} value={c.id}>{c.label || 'Без названия'}</option>)}
                    </select>
                  </label>
                  {a.reward?.currency && (
                    <label className="fld">
                      <span>сумма</span>
                      <input type="number" min={1} value={a.reward.amount ?? 5} onChange={(e) => { const arr = [...(m.metaprogress!.achievements ?? [])]; arr[ai] = { ...a, reward: { ...(arr[ai].reward ?? {}), amount: Math.max(1, +e.target.value || 1) } }; m.metaprogress!.achievements = arr; commit() }} />
                    </label>
                  )}
                  <label className="fld" data-tip="Очки опыта на шаг развития (0 — без опыта)">
                    <span>опыт</span>
                    <input type="number" min={0} value={a.reward?.xp ?? 0} onChange={(e) => { const v = Math.max(0, +e.target.value || 0); const arr = [...(m.metaprogress!.achievements ?? [])]; arr[ai] = { ...a }; if (v > 0) arr[ai].reward = { ...(arr[ai].reward ?? {}), xp: v }; else if (arr[ai].reward) { delete arr[ai].reward!.xp; if (!Object.keys(arr[ai].reward!).length) delete arr[ai].reward } m.metaprogress!.achievements = arr; commit() }} />
                  </label>
                </div>
                <div className="fld-row">
                  <label className="fld fld-check" data-tip="Дополнительные условия (как у правил): открывается, когда все выполнены">
                    <input type="checkbox" checked={!!a.conditions?.length} onChange={(e) => { const arr = [...(m.metaprogress!.achievements ?? [])]; arr[ai] = { ...a }; if (e.target.checked) arr[ai].conditions = [{ type: 'flag_set', flag: '' }]; else delete arr[ai].conditions; m.metaprogress!.achievements = arr; commit() }} />
                    <span>Открытие по условиям забега</span>
                  </label>
                </div>
                {a.conditions?.length ? (
                  <ConditionListEditor
                    store={store}
                    conditions={a.conditions}
                    onChange={(conds) => { const arr = [...(m.metaprogress!.achievements ?? [])]; arr[ai] = { ...a, conditions: conds.length ? conds : undefined }; m.metaprogress!.achievements = arr; commit() }}
                  />
                ) : null}
              </div>
            ))}

            <h4 style={{ marginTop: 14 }}>Магазин постоянных усилений</h4>
            <div className="muted small" style={{ marginBottom: 8 }}>
              Усиления, которые игрок покупает за метавалюту из «Хроники» и получает
              на старте каждого следующего забега.
            </div>
            <div className="fld-row">
              <button
                className="btn btn-small"
                onClick={() => { m.metaprogress!.unlocks = [...(m.metaprogress!.unlocks ?? []), { id: makeId('unlock', 'новое усиление', (m.metaprogress?.unlocks ?? []).map((x) => x.id)), label: 'Новое усиление', cost: [{ currency: m.metaprogress!.currencies?.[0]?.id ?? 'ember', amount: 10 }], grants: [] }]; commit() }}
              ><Ico n="plus" /> усиление</button>
            </div>
            {(m.metaprogress.unlocks ?? []).map((u, ui) => (
              <div key={u.id} className="panel" style={{ padding: 8, marginTop: 6 }}>
                <div className="fld-row">
                  <input value={u.label} onChange={(e) => { const arr = [...(m.metaprogress!.unlocks ?? [])]; arr[ui] = { ...u, label: e.target.value }; m.metaprogress!.unlocks = arr; commit() }} style={{ flex: 1 }} placeholder="Название усиления" />
                  <button className="btn btn-small btn-danger" onClick={() => { m.metaprogress!.unlocks = (m.metaprogress?.unlocks ?? []).filter((_, j) => j !== ui); commit() }}><Ico n="trash" /></button>
                </div>
                <label className="fld" style={{ marginTop: 4 }}>
                  <span>Описание (что игрок получит на старте забега)</span>
                  <input value={u.description ?? ''} onChange={(e) => { const arr = [...(m.metaprogress!.unlocks ?? [])]; arr[ui] = { ...u, description: e.target.value || undefined }; m.metaprogress!.unlocks = arr; commit() }} />
                </label>
                <div className="fld-row" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className="fld-label">Цена:</span>
                  {u.cost.map((c, ci) => (
                    <span key={ci} className="fld-row" style={{ alignItems: 'center', gap: 4 }}>
                      <input type="number" min={1} value={c.amount} style={{ width: 76 }}
                        onChange={(e) => { const arr = [...(m.metaprogress!.unlocks ?? [])]; const cost = [...u.cost]; cost[ci] = { ...c, amount: Math.max(1, +e.target.value || 1) }; arr[ui] = { ...u, cost }; m.metaprogress!.unlocks = arr; commit() }} />
                      <select value={c.currency}
                        onChange={(e) => { const arr = [...(m.metaprogress!.unlocks ?? [])]; const cost = [...u.cost]; cost[ci] = { ...c, currency: e.target.value }; arr[ui] = { ...u, cost }; m.metaprogress!.unlocks = arr; commit() }}>
                        {(m.metaprogress!.currencies ?? []).map((x) => <option key={x.id} value={x.id}>{x.label || 'Без названия'}</option>)}
                      </select>
                      {u.cost.length > 1 && (
                        <button className="btn btn-small" onClick={() => { const arr = [...(m.metaprogress!.unlocks ?? [])]; arr[ui] = { ...u, cost: u.cost.filter((_, j) => j !== ci) }; m.metaprogress!.unlocks = arr; commit() }}><Ico n="close" /></button>
                      )}
                    </span>
                  ))}
                  <button className="btn btn-small" data-tip="Цена в нескольких метавалютах" onClick={() => { const arr = [...(m.metaprogress!.unlocks ?? [])]; arr[ui] = { ...u, cost: [...u.cost, { currency: m.metaprogress!.currencies?.[0]?.id ?? 'ember', amount: 1 }] }; m.metaprogress!.unlocks = arr; commit() }}>+ цена</button>
                </div>
                <span className="fld-label">Что даст на старте каждого забега</span>
                <EffectListEditor
                  store={store}
                  effects={u.grants}
                  onChange={(grants) => { const arr = [...(m.metaprogress!.unlocks ?? [])]; arr[ui] = { ...u, grants }; m.metaprogress!.unlocks = arr; commit() }}
                />
              </div>
            ))}
          </>
        )}
      </div>

        </div>
      )}

      {tab === 'mechanics' && (
        <div className="props-group">
          <h4>New Game+: повторный забег с наследием</h4>
          <div className="muted small" style={{ marginBottom: 8 }}>
            Победивший герой может начать забег заново, сохранив часть накопленного.
            Каждый такой «круг» ужесточает мир на заданные шаги — до бесконечности.
            Выключено (по умолчанию) — финал означает финал.
          </div>
          <div className="fld-row">
            <label className="fld fld-check">
              <input
                type="checkbox"
                checked={!!m.new_game_plus}
                onChange={(e) => { if (e.target.checked) m.new_game_plus = {}; else delete m.new_game_plus; commit() }}
              />
              <span>New Game+ разрешён</span>
            </label>
          </div>
          {m.new_game_plus && (() => {
            const ng = m.new_game_plus!
            const ALL_KEEPS: Array<{ id: string; label: string }> = [
              { id: 'skills', label: 'Навыки' },
              { id: 'skill_marks', label: 'Галочки роста' },
              { id: 'stats', label: 'Характеристики и запасы здоровья/каналы' },
              { id: 'inventory', label: 'Инвентарь и экипировка' },
              { id: 'feats', label: 'Опыт, уровень и черты' },
              { id: 'prepared', label: 'Подготовленные способности' },
            ]
            const keep = new Set(ng.keep ?? ALL_KEEPS.map((k) => k.id))
            const toggleKeep = (id: string, on: boolean) => {
              const next = new Set(keep)
              if (on) next.add(id)
              else next.delete(id)
              ng.keep = next.size === ALL_KEEPS.length ? undefined : [...next]
              commit()
            }
            const boost = ng.boost ?? {}
            const setBoost = (key: 'enemy_damage_step' | 'need_decay_step' | 'prices_step', v: number | undefined) => {
              const next = { ...boost }
              if (v === undefined || v <= 0) delete next[key]
              else next[key] = v
              ng.boost = Object.keys(next).length ? next : undefined
              commit()
            }
            return (
              <div className="panel" style={{ padding: 8 }}>
                <label className="fld" style={{ maxWidth: 320 }}>
                  <span>Подпись кнопки на экране финала</span>
                  <input
                    value={ng.label ?? ''}
                    placeholder="Новая игра+"
                    onChange={(e) => { ng.label = e.target.value || undefined; commit() }}
                  />
                </label>
                <div style={{ margin: '8px 0 4px' }}>Что переносится герой в новый круг:</div>
                <div className="fld-row" style={{ flexWrap: 'wrap' }}>
                  {ALL_KEEPS.map((k) => (
                    <label key={k.id} className="fld fld-check">
                      <input type="checkbox" checked={keep.has(k.id)} onChange={(e) => toggleKeep(k.id, e.target.checked)} />
                      <span>{k.label}</span>
                    </label>
                  ))}
                </div>
                <div style={{ margin: '8px 0 4px' }}>Ужесточение мира за каждый круг (поверх выбранной сложности):</div>
                <div className="fld-row" style={{ flexWrap: 'wrap' }}>
                  <label className="fld" data-tip="+N% к урону врагов за каждый круг (0 — не менять)">
                    <span>Урон врагов, %/круг</span>
                    <input type="number" min={0} max={200} value={Math.round((boost.enemy_damage_step ?? 0) * 100)} onChange={(e) => setBoost('enemy_damage_step', (+e.target.value || 0) / 100)} />
                  </label>
                  <label className="fld" data-tip="+N% к расходу потребностей за каждый круг">
                    <span>Расход потребностей, %/круг</span>
                    <input type="number" min={0} max={200} value={Math.round((boost.need_decay_step ?? 0) * 100)} onChange={(e) => setBoost('need_decay_step', (+e.target.value || 0) / 100)} />
                  </label>
                  <label className="fld" data-tip="+N% к ценам за каждый круг">
                    <span>Цены, %/круг</span>
                    <input type="number" min={0} max={200} value={Math.round((boost.prices_step ?? 0) * 100)} onChange={(e) => setBoost('prices_step', (+e.target.value || 0) / 100)} />
                  </label>
                </div>
              </div>
            )
          })()}

          <h4>Профиль механик кампании</h4>
          <p className="muted small">
            Всё включено по умолчанию. Снимите галочку, чтобы убрать подсистему из этой
            кампании — и из движка, и из интерфейса игрока.
          </p>
          {FEATURE_TOGGLES.map((f) => {
            const on = m.features?.[f.key] !== false
            return (
              <label key={f.key} className="fld feature-toggle">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={(e) => {
                    m.features = { ...(m.features ?? {}), [f.key]: e.target.checked }
                    commit()
                  }}
                />
                <span>
                  <b>{f.label}</b>
                  <div className="muted small">{f.hint}</div>
                </span>
              </label>
            )
          })}
        </div>
      )}

      {tab === 'look' && <ThemeTab meta={m} store={store} commit={commit} />}

      {tab === 'statuses' && <StatusRegistry m={m} store={store} commit={commit} />}

      {tab === 'main' && (
        <>
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

      <ChaptersEditor m={m} commit={commit} />

      <div className="props-group">
        <h4>Серия и части (DLC)</h4>
        <div className="fld-row">
          <label className="fld" data-tip="id базовой кампании (без него — эта кампания основная часть)">
            <span>Продолжает кампанию</span>
            <input
              value={m.series?.base ?? ''}
              placeholder="id базовой кампании (пусто — основная)"
              onChange={(e) => ((m.series = { ...(m.series ?? {}), base: e.target.value || undefined }), commit())}
            />
          </label>
          <label className="fld" data-tip="Основная игра — 1">
            <span>Номер части</span>
            <input
              type="number"
              min={1}
              value={m.series?.part ?? 1}
              onChange={(e) => ((m.series = { ...(m.series ?? {}), part: Number(e.target.value) || 1 }), commit())}
            />
          </label>
          <label className="fld">
            <span>Название части</span>
            <input
              value={m.series?.label ?? ''}
              placeholder="например «Пролог»"
              onChange={(e) => ((m.series = { ...(m.series ?? {}), label: e.target.value || undefined }), commit())}
            />
          </label>
        </div>
        <p className="muted small" style={{ margin: 0 }}>
          Как продавать «бесплатный пролог, дальше — платно»: пролог — первая часть без «Продолжает кампанию»,
          продолжение — второй пакет с указанием id пролога. Платёжный гейт появится с мастерской; здесь — только данные.
        </p>
      </div>

      <AttributionEditor m={m} commit={commit} store={store} />

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

      <DiceRulesEditor value={m.dice_rules!} commit={commit} />

      <div className="props-group">
        <h4>Отдых и удача</h4>
        <div className="fld-row" style={{ flexWrap: 'wrap' }}>
          <label className="fld" data-tip="Кости лечения HP за сон; «0» — сон не лечит">
            <span>Лечение за сон</span>
            <input
              value={m.rest?.hp ?? '1d3'}
              placeholder="1d3"
              onChange={(e) => {
                const r = { ...(m.rest ?? {}), hp: e.target.value || '1d3' }
                m.rest = r
                commit()
              }}
            />
          </label>
          <label className="fld fld-check">
            <input
              type="checkbox"
              checked={m.rest?.mp_full !== false}
              onChange={(e) => ((m.rest = { ...(m.rest ?? {}), mp_full: e.target.checked || undefined }), commit())}
            />
            <span>Сон восстанавливает MP полностью</span>
          </label>
          <label className="fld fld-num" data-tip="Максимум удачи = POW × множитель. 0 — удача выключена">
            <span>Множитель удачи (×POW)</span>
            <input
              type="number" min={0}
              value={m.luck?.multiplier ?? 5}
              onChange={(e) => {
                const v = Math.max(0, Number(e.target.value) || 0)
                m.luck = { ...(m.luck ?? {}), multiplier: v === 5 && !m.luck ? undefined : v }
                commit()
              }}
            />
          </label>
          <label className="fld fld-num" data-tip="Стоимость переброска провального броска вне боя">
            <span>Цена переброска</span>
            <input
              type="number" min={1}
              value={m.luck?.reroll_cost ?? 1}
              onChange={(e) => ((m.luck = { ...(m.luck ?? {}), reroll_cost: Math.max(1, Number(e.target.value) || 1) }), commit())}
            />
          </label>
          <label className="fld fld-check" data-tip="По книге удача не восстанавливается; для рогалика обычно мягче">
            <input
              type="checkbox"
              checked={m.luck?.rest_luck !== false}
              onChange={(e) => ((m.luck = { ...(m.luck ?? {}), rest_luck: e.target.checked || undefined }), commit())}
            />
            <span>Удача восстанавливается на отдыхе</span>
          </label>
        </div>
      </div>

      <div className="props-group">
        <h4>Производные опции (усталость, рассудок, слава, достаток, страсти, причастность)</h4>
        <div className="fld-row" style={{ flexWrap: 'wrap' }}>
          <label className="fld fld-check" data-tip="Очки усталости = (STR+CON). Траты задаёте эффектами change_fatigue; на нуле срабатывают правила">
            <input
              type="checkbox"
              checked={!!m.vitals?.fatigue}
              onChange={(e) => {
                const v = { ...(m.vitals ?? {}) }
                if (e.target.checked) v.fatigue = true
                else delete v.fatigue
                if (Object.keys(v).length) m.vitals = v
                else delete m.vitals
                commit()
              }}
            />
            <span>Очки усталости (STR+CON)</span>
          </label>
          <label className="fld fld-check" data-tip="Рассудок = POW×5. Потери — change_sanity, пороги — правилами на sanity_le">
            <input
              type="checkbox"
              checked={!!m.vitals?.sanity}
              onChange={(e) => {
                const v = { ...(m.vitals ?? {}) }
                if (e.target.checked) v.sanity = true
                else delete v.sanity
                if (Object.keys(v).length) m.vitals = v
                else delete m.vitals
                commit()
              }}
            />
            <span>Рассудок (POW×5)</span>
          </label>
          <label className="fld fld-check" data-tip="Репутация героя — счётчик славы; чип в HUD и влияние на мир через условия reputation_ge">
            <input
              type="checkbox"
              checked={!!m.reputation}
              onChange={(e) => {
                if (e.target.checked) m.reputation = true
                else delete m.reputation
                commit()
              }}
            />
            <span>Репутация</span>
          </label>
          <label className="fld" data-tip="Названия ступеней достатка через запятую, от низшей к высшей: Нищий, Бедный, Свободный, Знатный. Пусто — системы нет">
            <span>Шкала достатка</span>
            <input
              value={(m.wealth_levels ?? []).join(', ')}
              onChange={(e) => {
                const arr = e.target.value.split(',').map((x) => x.trim()).filter(Boolean)
                if (arr.length) m.wealth_levels = arr
                else delete m.wealth_levels
                commit()
              }}
            />
          </label>
          <div className="fld" style={{ flex: 1, minWidth: 300 }} data-tip="Страсти героя: их названия видит игрок, а в правилах и проверках они выбираются списком — писать ничего не нужно">
            <span>Страсти</span>
            <RegistryRows
              items={m.passions_list ?? []}
              onChange={(v) => ((m.passions_list = v.length ? v : undefined), commit())}
              addTitle="Название новой страсти"
              prefix="passion_"
            />
          </div>
          <div className="fld" style={{ flex: 1, minWidth: 300 }} data-tip="Силы причастности: названия видит игрок, в эффектах и условиях они выбираются списком">
            <span>Причастность</span>
            <RegistryRows
              items={m.allegiances ?? []}
              onChange={(v) => ((m.allegiances = v.length ? v : undefined), commit())}
              addTitle="Название новой силы причастности"
              prefix="power_"
            />
          </div>
          <label className="fld" data-tip="Книжный уровень мощи кампании; для heroic+ используйте формулы 2d6+6 в генерации характеристик">
            <span>Уровень мощи</span>
            <select
              value={m.power_level ?? 'normal'}
              onChange={(e) => {
                if (e.target.value === 'normal') delete m.power_level
                else m.power_level = e.target.value as 'heroic' | 'epic' | 'superhuman'
                commit()
              }}
            >
              <option value="normal">Обычный (умолчание)</option>
              <option value="heroic">Героический</option>
              <option value="epic">Эпический</option>
              <option value="superhuman">Сверхчеловеческий</option>
            </select>
          </label>
          <label className="fld fld-num" data-tip="Порог страсти/навыка-союзника для аугмента (умолчание 50; книжно +20 при ≥50)">
            <span>Порог аугмента</span>
            <input
              type="number" min={1}
              value={m.augments?.threshold ?? 50}
              onChange={(e) => ((m.augments = { ...(m.augments ?? {}), threshold: Math.max(1, Number(e.target.value) || 50) }), commit())}
            />
          </label>
          <label className="fld fld-num" data-tip="Прибавка к броску при аугменте/подмоге (умолчание +20)">
            <span>Бонус аугмента</span>
            <input
              type="number" min={0}
              value={m.augments?.bonus ?? 20}
              onChange={(e) => ((m.augments = { ...(m.augments ?? {}), bonus: Math.max(0, Number(e.target.value) || 20) }), commit())}
            />
          </label>
        </div>
      </div>

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
        <h4>Рогалик</h4>
        <label className="fld fld-check">
          <input type="checkbox" checked={m.roguelike!.permadeath} onChange={(e) => ((m.roguelike!.permadeath = e.target.checked), commit())} />
          <span>Перманентная смерть (сейв удаляется при гибели)</span>
        </label>
      </div>


        </>
      )}
      {tab === 'creation' && (
        <>
      <div className="props-group">
        <h4>Создание персонажа</h4>
        <div className="muted small" style={{ marginBottom: 8 }}>
          Экран перед новым забегом: игрок распределяет характеристики,
          выбирает происхождение и навыки. Выключено — забег стартует
          сразу готовым персонажем-шаблоном.
        </div>
        <label className="fld fld-check">
          <input
            type="checkbox"
            checked={!!m.char_creation}
            onChange={(e) => {
              if (e.target.checked) {
                m.char_creation = {
                  total_points: 30,
                  stat_limits: { min: 3, max: 18 },
                  mandatory_skills: [],
                  forbidden_skills: [],
                }
              } else delete m.char_creation
              commit()
            }}
          />
          <span>Показывать экран создания персонажа</span>
        </label>
        {m.char_creation && (
          <>
            <div className="fld-row" style={{ flexWrap: 'wrap' }}>
              <label className="fld fld-num">
                <span>Бюджет характеристик</span>
                <input type="number" min={0} value={m.char_creation.total_points} onChange={(e) => ((m.char_creation!.total_points = Math.max(0, Number(e.target.value) || 0)), commit())} />
              </label>
              <label className="fld fld-num">
                <span>Характеристика: минимум</span>
                <input type="number" min={1} value={m.char_creation.stat_limits.min} onChange={(e) => ((m.char_creation!.stat_limits.min = Math.max(1, Number(e.target.value) || 1)), commit())} />
              </label>
              <label className="fld fld-num">
                <span>Характеристика: максимум</span>
                <input type="number" min={1} value={m.char_creation.stat_limits.max} onChange={(e) => ((m.char_creation!.stat_limits.max = Math.max(1, Number(e.target.value) || 1)), commit())} />
              </label>
            </div>
            <div className="fld-row" style={{ flexWrap: 'wrap' }}>
              <label className="fld fld-num">
                <span>Бюджет навыков (0 — без него)</span>
                <input
                  type="number" min={0}
                  value={m.char_creation.skill_points ?? 0}
                  onChange={(e) => {
                    const v = Math.max(0, Number(e.target.value) || 0)
                    if (v > 0) m.char_creation!.skill_points = v
                    else delete m.char_creation!.skill_points
                    commit()
                  }}
                />
              </label>
              <label className="fld fld-num">
                <span>Предел навыка сверху (0 — нет)</span>
                <input
                  type="number" min={0}
                  value={m.char_creation.skill_cap ?? 0}
                  onChange={(e) => {
                    const v = Math.max(0, Number(e.target.value) || 0)
                    if (v > 0) m.char_creation!.skill_cap = v
                    else delete m.char_creation!.skill_cap
                    commit()
                  }}
                />
              </label>
              <label className="fld fld-num">
                <span>Предел навыка снизу</span>
                <input
                  type="number" min={0}
                  value={m.char_creation.skill_floor ?? 0}
                  data-tip="Ниже этого значения игрок не сможет опустить навык"
                  onChange={(e) => {
                    const v = Math.max(0, Number(e.target.value) || 0)
                    if (v > 0) m.char_creation!.skill_floor = v
                    else delete m.char_creation!.skill_floor
                    commit()
                  }}
                />
              </label>
            </div>
            <label className="fld fld-check">
              <input type="checkbox" checked={!!m.char_creation.choose_name} onChange={(e) => ((m.char_creation!.choose_name = e.target.checked || undefined), commit())} />
              <span>Игрок вводит имя героя</span>
            </label>
            <label className="fld fld-check">
              <input type="checkbox" checked={!!m.char_creation.choose_age} onChange={(e) => ((m.char_creation!.choose_age = e.target.checked || undefined), commit())} />
              <span>Игрок задаёт возраст</span>
            </label>
            <label className="fld fld-check" data-tip="Короткая предыстория героя своими словами — видна в листе персонажа">
              <input type="checkbox" checked={!!m.char_creation.choose_bio} onChange={(e) => ((m.char_creation!.choose_bio = e.target.checked || undefined), commit())} />
              <span>Игрок пишет биографию</span>
            </label>

            <HeroPortraitsEditor m={m} store={store} commit={commit} />

            <label className="fld fld-check">
              <input
                type="checkbox"
                checked={!!m.char_creation.roll}
                onChange={(e) => {
                  if (e.target.checked) {
                    m.char_creation!.roll = { notation: '3d6', per_stat: { INT: '2d6+6', SIZ: '2d6+6' }, arrays: 1, rerolls: 0, redistribute: 3 }
                  } else delete m.char_creation!.roll
                  commit()
                }}
              />
              <span data-tip="Базовый метод BRP: характеристики бросаются кубиками, а не покупаются за очки. Распределение характеристик происхождений в этом режиме игнорируется.">
                Характеристики — броски кубиков (вместо бюджета очков)
              </span>
            </label>
            {m.char_creation.roll && (
              <div className="fld-row" style={{ flexWrap: 'wrap' }}>
                <DiceNotationInput
                  label="Базовая формула броска"
                  tip="Сколько и каких костей бросается на характеристику по умолчанию"
                  value={m.char_creation.roll.notation ?? '3d6'}
                  onChange={(v) => ((m.char_creation!.roll!.notation = v || '3d6'), commit())}
                />
                <label className="fld fld-num" data-tip="Сколько наборов бросается, игрок выбирает один">
                  <span>Наборов на выбор</span>
                  <input type="number" min={1} value={m.char_creation.roll.arrays ?? 1} onChange={(e) => ((m.char_creation!.roll!.arrays = Math.max(1, Number(e.target.value) || 1)), commit())} />
                </label>
                <label className="fld fld-num" data-tip="Сколько характеристик можно перебросить по одной штуке">
                  <span>Перебросов</span>
                  <input type="number" min={0} value={m.char_creation.roll.rerolls ?? 0} onChange={(e) => ((m.char_creation!.roll!.rerolls = Math.max(0, Number(e.target.value) || 0)), commit())} />
                </label>
                <label className="fld fld-num" data-tip="Очков сверх выброшенного набора для докрутки (BRP: до 3)">
                  <span>Докрутка очков</span>
                  <input type="number" min={0} value={m.char_creation.roll.redistribute ?? 0} onChange={(e) => ((m.char_creation!.roll!.redistribute = Math.max(0, Number(e.target.value) || 0)), commit())} />
                </label>
              </div>
            )}
            {m.char_creation.roll && (
              <div className="fld" style={{ marginBottom: 10 }}>
                <span className="muted small" style={{ display: 'block', marginBottom: 4 }}>
                  Свои формулы по характеристикам (пусто — базовая). BRP: INT и SIZ бросаются 2d6+6.
                </span>
                <div className="fld-row" style={{ flexWrap: 'wrap' }}>
                  {(['STR', 'CON', 'SIZ', 'DEX', 'INT', 'POW', 'CHA'] as const).map((k) => (
                    <div key={k} style={{ maxWidth: 240, minWidth: 190 }}>
                      <DiceNotationInput
                        label={k}
                        compact
                        optional
                        tip="Своя формула броска характеристики (пусто — базовая)"
                        value={m.char_creation!.roll!.per_stat?.[k] ?? ''}
                        onChange={(v) => {
                          const per = { ...(m.char_creation!.roll!.per_stat ?? {}) }
                          if (v.trim()) per[k] = v.trim()
                          else delete per[k]
                          m.char_creation!.roll!.per_stat = Object.keys(per).length ? per : undefined
                          commit()
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* навыки-переключатели: клик по навыку включает/выключает его роль */}
            <div className="fld" style={{ marginBottom: 10 }}>
              <span className="muted small" style={{ display: 'block', marginBottom: 4 }}>
                Обязательные навыки — у любого происхождения стартуют не ниже 25%
              </span>
              <ChipMultiSelect
                options={store.options('skill')}
                value={m.char_creation.mandatory_skills!}
                onChange={(v) => ((m.char_creation!.mandatory_skills = v), commit())}
                emptyLabel="нажмите на навык, чтобы сделать обязательным"
              />
            </div>
            <div className="fld" style={{ marginBottom: 10 }}>
              <span className="muted small" style={{ display: 'block', marginBottom: 4 }}>
                Запрещённые навыки — очки на них тратить нельзя
              </span>
              <ChipMultiSelect
                className="chipset-warn"
                options={store.options('skill')}
                value={m.char_creation.forbidden_skills!}
                onChange={(v) => ((m.char_creation!.forbidden_skills = v), commit())}
                emptyLabel="нажмите на навык, чтобы запретить его"
              />
            </div>

            <h4 style={{ marginTop: 12 }}>Происхождения</h4>
            {(m.char_creation.professions ?? []).map((p, i) => (
              <div key={i} className="prof-card">
                <div className="prof-card-head">
                  <label className="fld"><span>Название</span>
                    <input value={p.label} onChange={(e) => ((p.label = e.target.value), commit())} />
                  </label>
                  <button className="btn btn-small ce-del" data-tip="Удалить происхождение" onClick={() => (m.char_creation!.professions!.splice(i, 1), commit())}><Ico n="close" /></button>
                </div>
                <label className="fld"><span>Описание</span>
                  <input value={p.description ?? ''} onChange={(e) => ((p.description = e.target.value || undefined), commit())} />
                </label>

                <div className="prof-sec">Стартовые характеристики (пустое поле = минимум):</div>
                <div className="prof-stats">
                  {(['STR', 'CON', 'SIZ', 'DEX', 'INT', 'POW', 'CHA'] as const).map((k) => (
                    <label key={k} className="prof-stat" data-tip={`${k}: от ${m.char_creation!.stat_limits.min} до ${m.char_creation!.stat_limits.max}`}>
                      <span>{k}</span>
                      <input
                        type="number"
                        value={p.stats?.[k] ?? ''}
                        placeholder={String(m.char_creation!.stat_limits.min)}
                        onChange={(e) => {
                          const raw = e.target.value.trim()
                          if (raw === '') {
                            if (p.stats) {
                              delete p.stats[k]
                              if (!Object.keys(p.stats).length) delete p.stats
                            }
                          } else {
                            const lim = m.char_creation!.stat_limits
                            ;(p.stats ??= {})[k] = Math.min(lim.max, Math.max(lim.min, Math.round(Number(raw) || lim.min)))
                          }
                          commit()
                        }}
                      />
                    </label>
                  ))}
                </div>

                <div className={`prof-budget ${(() => {
                  const spent = (['STR', 'CON', 'SIZ', 'DEX', 'INT', 'POW', 'CHA'] as const).reduce((t, k) => t + Math.max(0, (p.stats?.[k] ?? m.char_creation!.stat_limits.min) - m.char_creation!.stat_limits.min), 0)
                  return spent === m.char_creation!.total_points ? 'ok' : 'warn'
                })()}`}
                >
                  Распределено характеристик:{' '}
                  {(['STR', 'CON', 'SIZ', 'DEX', 'INT', 'POW', 'CHA'] as const).reduce((t, k) => t + Math.max(0, (p.stats?.[k] ?? m.char_creation!.stat_limits.min) - m.char_creation!.stat_limits.min), 0)}{' '}
                  из {m.char_creation!.total_points} — мастер обязан распределить весь бюджет
                </div>

                <div className="prof-sec">Бонусы к навыкам (бесплатно поверх бюджета):</div>
                {Object.entries(p.skill_bonus).map(([sk, v]) => (
                  <div className="prof-line" key={sk}>
                    <span className="prof-line-label">{store.labelFor('skill', sk)}</span>
                    <input className="fld-num" type="number" value={v}
                      onChange={(e) => ((p.skill_bonus[sk] = Number(e.target.value) || 0), commit())} />
                    <button className="btn btn-small ce-del" data-tip="Убрать бонус" onClick={() => (delete p.skill_bonus[sk], commit())}><Ico n="close" /></button>
                  </div>
                ))}
                <select value="" onChange={(e) => {
                  const id = e.target.value
                  if (id) (p.skill_bonus[id] = p.skill_bonus[id] ?? 5, commit())
                }}>
                  <option value="">+ бонус навыку…</option>
                  {store.options('skill').map((s) => (<option key={s.id} value={s.id}>{s.label}</option>))}
                </select>

                <div className="prof-sec">Стартовое снаряжение:</div>
                {(p.items ?? []).map((it, j) => (
                  <div className="prof-line" key={j}>
                    <span className="prof-line-label">{store.labelFor('item', it.item)}</span>
                    <input type="number" min={1} value={it.quantity}
                      onChange={(e) => ((it.quantity = Math.max(1, Number(e.target.value) || 1)), commit())} />
                    <button className="btn btn-small ce-del" data-tip="Убрать предмет" onClick={() => ((p.items = p.items!.filter((_, x) => x !== j)), commit())}><Ico n="close" /></button>
                  </div>
                ))}
                <select value="" onChange={(e) => {
                  const id = e.target.value
                  if (id) ((p.items ??= []).push({ item: id, quantity: 1 }), commit())
                }}>
                  <option value="">+ предмет…</option>
                  {store.options('item').map((s) => (<option key={s.id} value={s.id}>{s.label}</option>))}
                </select>
              </div>
            ))}
            <button className="btn btn-small" onClick={async () => {
              const label = await askText('Название происхождения', 'например «Солдат»')
              if (!label) return
              if (!m.char_creation!.professions) m.char_creation!.professions = []
              m.char_creation!.professions.push({ id: makeId('profession_', label, m.char_creation!.professions.map((x) => x.id)), label, skill_bonus: {} })
              commit()
            }}>+ происхождение</button>

            <h4 style={{ marginTop: 12 }}>Призвания</h4>
            <div className="muted small" style={{ marginBottom: 8 }}>
              Второй шаблон создания героя: происхождение распределяет характеристики,
              призвание — стартовые НАВЫКИ. Мастер обязан распределить ВЕСЬ бюджет
              навыков; игрок после выбора может убавлять значения под себя.
            </div>
            {(m.char_creation.callings ?? []).map((c, i) => {
              const floorOf = (id: string) =>
                Math.max(m.char_creation!.skill_floor ?? 0, (m.char_creation!.mandatory_skills ?? []).includes(id) ? 25 : 0)
              const budget = m.char_creation!.skill_points ?? 0
              const spent = Object.entries(c.skills).reduce((t, [id, v]) => t + Math.max(0, v - floorOf(id)), 0)
              const okBudget = budget === 0 || spent === budget
              return (
                <div key={i} className="prof-card">
                  <div className="prof-card-head">
                    <label className="fld"><span>Название</span>
                      <input value={c.label} onChange={(e) => ((c.label = e.target.value), commit())} />
                    </label>
                    <button className="btn btn-small ce-del" data-tip="Удалить призвание" onClick={() => (m.char_creation!.callings!.splice(i, 1), commit())}><Ico n="close" /></button>
                  </div>
                  <label className="fld"><span>Описание</span>
                    <input value={c.description ?? ''} onChange={(e) => ((c.description = e.target.value || undefined), commit())} />
                  </label>

                  <div className="prof-sec">Стартовые навыки (абсолютные проценты):</div>
                  {Object.entries(c.skills).sort((a, b) => store.labelFor('skill', a[0]).localeCompare(store.labelFor('skill', b[0]), 'ru')).map(([sk, v]) => (
                    <div className="prof-line" key={sk}>
                      <span className="prof-line-label">{store.labelFor('skill', sk)}</span>
                      <input
                        className="fld-num" type="number" min={floorOf(sk)}
                        max={m.char_creation!.skill_cap}
                        value={v}
                        onChange={(e) => {
                          let nv = Math.round(Number(e.target.value) || 0)
                          nv = Math.max(floorOf(sk), nv)
                          const cap = m.char_creation!.skill_cap
                          if (cap !== undefined) nv = Math.min(nv, cap)
                          c.skills[sk] = nv
                          commit()
                        }}
                      />
                      <button className="btn btn-small ce-del" data-tip="Убрать навык" onClick={() => (delete c.skills[sk], commit())}><Ico n="close" /></button>
                    </div>
                  ))}
                  <select value="" onChange={(e) => {
                    const id = e.target.value
                    if (id) (c.skills[id] = Math.min(floorOf(id) + 10, m.char_creation!.skill_cap ?? Number.MAX_SAFE_INTEGER), commit())
                  }}>
                    <option value="">+ навык…</option>
                    {store.options('skill').map((x) => (<option key={x.id} value={x.id} disabled={c.skills[x.id] !== undefined}>{x.label}</option>))}
                  </select>

                  <div className={`prof-budget ${okBudget ? 'ok' : 'warn'}`}>
                    Распределено навыков: {spent} из {budget || '—'}
                    {!okBudget && ' — мастер обязан распределить весь бюджет'}
                  </div>
                </div>
              )
            })}
            <button className="btn btn-small" onClick={async () => {
              const label = await askText('Название призвания', 'например «Наёмник»')
              if (!label) return
              if (!m.char_creation!.callings) m.char_creation!.callings = []
              m.char_creation!.callings.push({ id: makeId('calling_', label, m.char_creation!.callings.map((x) => x.id)), label, skills: {} })
              commit()
            }}>+ призвание</button>
          </>
        )}
      </div>
        </>
      )}

      {tab === 'people' && (
        <>
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
            <label className="fld" data-tip="Ниже этого значения полоска подсвечивается красным — предупреждение игроку">
              <span>Тревога ниже</span>
              <input type="number" value={n.critical_threshold} onChange={(e) => ((n.critical_threshold = Number(e.target.value)), commit())} />
            </label>
            <label className="fld" data-tip="Что случится, когда потребность упадёт до нуля">
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
            <label className="fld" data-tip="Краткое название для компактного отображения в HUD">
              <span>Короткое имя</span>
              <input value={n.short_label ?? ''} onChange={(e) => ((n.short_label = e.target.value || undefined), commit())} placeholder="например: Голод" />
            </label>
            <label className="fld" style={{ flex: 2, minWidth: 220 }} data-tip="Полное описание потребности: игрок видит его в подсказке к полоске">
              <span>Описание (подсказка игроку)</span>
              <input value={n.description ?? ''} onChange={(e) => ((n.description = e.target.value || undefined), commit())} placeholder="например: «Без еды слабеешь: падает урон и внимание»" />
            </label>
            <button className="btn btn-small ce-del" data-tip="Удалить" onClick={() => (m.needs.splice(i, 1), commit())}><Ico n="close" /> </button>
          </div>
        ))}
        {m.needs.map((n, i) => (
          <details key={`cond_${i}`} className="need-conds">
            <summary>
              {n.label}: условия убывания и восстановление
              {n.decay_when?.length ? ` · убывает при ${n.decay_when.length} усл.` : '· убывает всегда'}
              {n.restore_per_tick ? ` · восстанавливается +${n.restore_per_tick}/тик` : ''}
            </summary>
            <div className="fld-block">
              <span className="fld-caption">Убывает, только когда выполнены ВСЕ условия (пусто — убывает всегда)</span>
              <NeedCondEditor
                conds={n.decay_when ?? []}
                store={store}
                commit={commit}
                onChange={(c) => {
                  if (c.length) n.decay_when = c
                  else delete n.decay_when
                  commit()
                }}
              />
            </div>
            <div className="fld-block" style={{ marginTop: 10 }}>
              <label className="fld fld-inline">
                <span>Восстановление за тик (0 — нет)</span>
                <input
                  type="number"
                  min={0}
                  value={n.restore_per_tick ?? 0}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    if (v > 0) n.restore_per_tick = v
                    else {
                      delete n.restore_per_tick
                      delete n.restore_when
                    }
                    commit()
                  }}
                />
              </label>
              {!!n.restore_per_tick && (
                <>
                  <span className="fld-caption">…когда выполнены ВСЕ условия (пусто — всегда)</span>
                  <NeedCondEditor
                    conds={n.restore_when ?? []}
                    store={store}
                    commit={commit}
                    onChange={(c) => {
                      if (c.length) n.restore_when = c
                      else delete n.restore_when
                      commit()
                    }}
                  />
                </>
              )}
            </div>
          </details>
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
              <span>Описание фракции</span>
              <input value={f.description ?? ''} onChange={(e) => ((f.description = e.target.value || undefined), commit())} />
            </label>
            <label className="fld">
              <span>Отношение к игроку</span>
              <input type="number" value={f.base_disposition} onChange={(e) => ((f.base_disposition = Number(e.target.value)), commit())} />
            </label>
            <label className="fld fld-check" data-tip="Для служебных фракций (дикие твари и т.п.): отношение не имеет смысла, игрок её не увидит">
              <input
                type="checkbox"
                checked={!!f.hidden}
                onChange={(e) => {
                  if (e.target.checked) f.hidden = true
                  else delete f.hidden
                  commit()
                }}
              />
              <span>Скрытая (не показывать в игре)</span>
            </label>
            <button className="btn btn-small ce-del" data-tip="Удалить" onClick={() => (m.factions!.splice(i, 1), commit())}><Ico n="close" /> </button>
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
        <div className="fld-row" style={{ flexWrap: 'wrap', marginBottom: 6 }}>
          <div className="fld" style={{ flex: 1, minWidth: 300 }} data-tip="Категории навыков для группировки в листе персонажа: названия видит игрок">
            <span>Категории навыков</span>
            <RegistryRows
              items={m.skill_categories ?? []}
              onChange={(v) => ((m.skill_categories = v.length ? v : undefined), commit())}
              addTitle="Название новой категории навыков"
            />
          </div>
        </div>
        {(m.skills ?? []).map((sk, i) => (
          <div key={i} className="fld-row need-row">
            <label className="fld">
              <span>Название</span>
              <input value={sk.label} onChange={(e) => ((sk.label = e.target.value), commit())} />
            </label>
            {(m.skill_categories?.length ?? 0) > 0 && (
              <label className="fld" data-tip="Категория для группировки в листе персонажа">
                <span>Категория</span>
                <select
                  value={sk.category ?? ''}
                  onChange={(e) => {
                    if (e.target.value) sk.category = e.target.value
                    else delete sk.category
                    commit()
                  }}
                >
                  <option value="">—</option>
                  {(m.skill_categories ?? []).map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </label>
            )}
            {(() => {
              const { fixedNum, statKey, mult } = parseSkillBase(sk.base)
              const availableStats = Object.entries(BUILTIN_STAT_LABELS).map(([id, label]) => ({
                id,
                label: `${id} (${label})`,
              }))
              return (
                <>
                  <label className="fld fld-narrow" data-tip="Базовый шанс без обучения (число в процентах, например 25)">
                    <span>Базовый %</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={fixedNum ?? ''}
                      placeholder="0"
                      onChange={(e) => {
                        const val = e.target.value.trim() === '' ? undefined : Math.max(0, parseInt(e.target.value, 10) || 0)
                        const res = buildSkillBase(val, statKey, mult)
                        if (res === undefined) delete sk.base
                        else sk.base = res
                        commit()
                      }}
                    />
                  </label>
                  <label className="fld" data-tip="Зависимость базового шанса от характеристики (DEX, INT и др.) по желанию">
                    <span>Характеристика</span>
                    <select
                      value={statKey}
                      onChange={(e) => {
                        const nextStat = e.target.value
                        const res = buildSkillBase(fixedNum, nextStat, mult)
                        if (res === undefined) delete sk.base
                        else sk.base = res
                        commit()
                      }}
                    >
                      <option value="">— нет —</option>
                      {availableStats.map((st) => (
                        <option key={st.id} value={st.id}>{st.label}</option>
                      ))}
                    </select>
                  </label>
                  {statKey ? (
                    <label className="fld fld-narrow" data-tip="Множитель характеристики в формуле (например DEX×2)">
                      <span>Множитель</span>
                      <select
                        value={mult}
                        onChange={(e) => {
                          const nextMult = parseInt(e.target.value, 10) || 1
                          const res = buildSkillBase(fixedNum, statKey, nextMult)
                          if (res === undefined) delete sk.base
                          else sk.base = res
                          commit()
                        }}
                      >
                        <option value={1}>×1</option>
                        <option value={2}>×2</option>
                        <option value={3}>×3</option>
                        <option value={4}>×4</option>
                        <option value={5}>×5</option>
                      </select>
                    </label>
                  ) : null}
                </>
              )
            })()}
            <button className="btn btn-small ce-del" data-tip="Удалить" onClick={() => (m.skills!.splice(i, 1), commit())}><Ico n="close" /> </button>
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

      <SpeciesRegistry m={m} store={store} commit={commit} />

        </>
      )}
      {tab === 'items' && (
        <>
      <div className="props-group">
        <h4>Типы слотов сцены</h4>
        <div className="muted small" style={{ marginBottom: 8 }}>
          Что можно ставить в слоты на сценах. Каждой сущности назначается тип
          в её карточке — по нему фильтруется выбор «кто/что стоит в слоте».
          Встроенных типов нет — добавьте свои: «Персонаж», «Предмет»,
          «Мебель», «Робот», «Дух»… любые, какие нужны вашей истории.
        </div>
        {(m.slot_types ?? []).map((t, i) => (
          <div key={i} className="fld-row need-row">
            <label className="fld">
              <span>Название</span>
              <input value={t.label} onChange={(e) => ((t.label = e.target.value), commit())} />
            </label>
            <details style={{ flex: '1 1 100%' }}>
              <summary><Ico n="sound" />  Звуки действий предметов в этом типе слота</summary>
              <SoundHookMapEditor
                store={store}
                value={t.sounds ?? (t.sounds = {})}
                onChange={commit}
                heading="Звуки действий (для этого типа слота)"
              />
            </details>
            <button className="btn btn-small ce-del" data-tip="Удалить" onClick={() => (m.slot_types!.splice(i, 1), commit())}><Ico n="close" /> </button>
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
        <h4>Слоты экипировки</h4>
        <div className="muted small" style={{ marginBottom: 8 }}>
          Куда персонаж надевает предметы. Встроенных слотов нет — создайте
          свои: «Оружие», «Броня», «Амулет», «Имплант»… Броня всех надетых
          слотов суммируется в бою.
        </div>
        {(m.equipment_slots ?? []).map((s, i) => (
          <div key={i} className="fld-row need-row">
            <label className="fld">
              <span>Название</span>
              <input value={s.label} onChange={(e) => ((s.label = e.target.value), commit())} />
            </label>
            <button className="btn btn-small ce-del" data-tip="Удалить" onClick={() => (m.equipment_slots!.splice(i, 1), commit())}><Ico n="close" /> </button>
          </div>
        ))}
        <button
          className="btn btn-small"
          onClick={async () => {
            const label = await askText('Название слота экипировки', 'например «Амулет»')
            if (!label) return
            if (!m.equipment_slots) m.equipment_slots = []
            m.equipment_slots.push({ id: makeId('slot_', label, m.equipment_slots.map((x) => x.id)), label })
            commit()
          }}
        >
          + слот экипировки
        </button>
      </div>

      <div className="props-group">
        <h4>Календарь</h4>
        <div className="muted small" style={{ marginBottom: 8 }}>
          Свои месяцы и дни недели: дата появится в игре под часами. Названия
          пишутся через запятую и циклятся. Без календаря — обычные «День N».
        </div>
        <div className="fld-row" style={{ flexWrap: 'wrap' }}>
          <label className="fld">
            <span>Название летоисчисления</span>
            <input
              value={m.calendar?.year_label ?? ''}
              placeholder="например «Летопись Каэрдена»"
              onChange={(e) => {
                if (!m.calendar) m.calendar = {}
                if (e.target.value) m.calendar.year_label = e.target.value
                else delete m.calendar.year_label
                commit()
              }}
            />
          </label>
          <label className="fld">
            <span>Начальный год</span>
            <input
              type="number"
              value={m.calendar?.start_year ?? 1}
              onChange={(e) => {
                if (!m.calendar) m.calendar = {}
                m.calendar.start_year = Number(e.target.value) || 1
                commit()
              }}
            />
          </label>
          <label className="fld">
            <span>Дней в месяце</span>
            <input
              type="number"
              value={m.calendar?.days_per_month ?? 30}
              onChange={(e) => {
                if (!m.calendar) m.calendar = {}
                m.calendar.days_per_month = Math.max(1, Number(e.target.value) || 30)
                commit()
              }}
            />
          </label>
        </div>
        <label className="fld">
          <span>Месяцы (через запятую)</span>
          <input
            value={(m.calendar?.months ?? []).join(', ')}
            placeholder="Верескень, Листопад, Грудень…"
            onChange={(e) => {
              if (!m.calendar) m.calendar = {}
              const months = e.target.value.split(',').map((x) => x.trim()).filter(Boolean)
              if (months.length) m.calendar.months = months
              else delete m.calendar.months
              commit()
            }}
          />
        </label>
        <label className="fld">
          <span>Дни недели (через запятую)</span>
          <input
            value={(m.calendar?.day_names ?? []).join(', ')}
            placeholder="Светодень, Ветродень…"
            onChange={(e) => {
              if (!m.calendar) m.calendar = {}
              const names = e.target.value.split(',').map((x) => x.trim()).filter(Boolean)
              if (names.length) m.calendar.day_names = names
              else delete m.calendar.day_names
              commit()
            }}
          />
        </label>
        {m.calendar && (
          <button
            className="btn btn-small"
            onClick={() => {
              delete m.calendar
              commit()
            }}
          >
            Убрать календарь
          </button>
        )}
      </div>

      <div className="props-group">
        <h4>Погода</h4>
        <div className="muted small" style={{ marginBottom: 8 }}>
          Типы погоды с визуальным слоем и зацикленными звуками. Погоду меняют
          эффекты «Сменить погоду»; условия «Погода сейчас» доступны правилам,
          слотам и музыке. Список слоёв — целиком ваш: движок умеет рисовать
          дождь, снег, туман и пепел, свои id подключаются классом weather-&lt;id&gt;.
        </div>
        {/* id скрыт от мастера: видно только название, как во всех реестрах */}
        <div className="prof-sec" style={{ marginTop: 0 }}>Слои погоды (реестр кампании):</div>
        {(m.overlay_layers ?? []).map((l, i) => (
          <div className="prof-line" key={i}>
            <span className="prof-line-label">{l.label}</span>
            <button className="btn btn-small ce-del" data-tip="Удалить слой" onClick={() => ((m.overlay_layers = m.overlay_layers!.filter((_, x) => x !== i)), commit())}><Ico n="close" /></button>
          </div>
        ))}
        <button className="btn btn-small" onClick={async () => {
          const label = await askText('Название слоя погоды', 'например «Огненный дождь»')
          if (!label) return
          ;(m.overlay_layers ??= []).push({ id: makeId('overlay_', label, m.overlay_layers.map((x) => x.id)), label })
          commit()
        }}>+ слой погоды</button>
        {(m.overlay_layers ?? []).length === 0 && (
          <div className="muted small" style={{ marginTop: 4 }}>Без реестра селект «Слой» у погоды будет пустым.</div>
        )}
        <h4 style={{ marginTop: 10 }}>Мастерская спецэффектов (слои из файлов)</h4>
        <div className="muted small" style={{ marginBottom: 6 }}>
          Атмосферные слои из картинки-«частицы»: дождь из собственного файла, листопад,
          пыль, искры, мухи, туманная взвесь. Ключ слоя вписывается в поле «Слой» у погоды
          ниже — движок сам его отрисует поверх сцены. Встроенные слои rain/snow/fog/ash работают без реестра.
        </div>
        <ParticleListEditor list={m.atmospherics ?? (m.atmospherics = [])} store={store} commit={commit} />

        {(m.weathers ?? []).map((w, i) => (
          <div key={i} className="props-group" style={{ border: '1px solid var(--border)', padding: 10, borderRadius: 8, marginBottom: 8 }}>
            <div className="fld-row" style={{ flexWrap: 'wrap' }}>
              <label className="fld">
                <span>Название</span>
                <input value={w.label} onChange={(e) => ((w.label = e.target.value), commit())} />
              </label>
              <label className="fld">
                <span>Слой</span>
                <select
                  value={w.overlay ?? 'none'}
                  onChange={(e) => {
                    const v = e.target.value
                    if (v && v !== 'none') w.overlay = v
                    else delete w.overlay
                    commit()
                  }}
                >
                  {/* список слоёв — из реестра кампании, а не из движка */}
                  {w.overlay && !(m.overlay_layers ?? []).some((l) => l.id === w.overlay) && (
                    <option value={w.overlay}>{w.overlay} (вне реестра)</option>
                  )}
                  <option value="none">Без слоя</option>
                  <optgroup label="Встроенные движком">
                    <option value="rain">Дождь (встроенный)</option>
                    <option value="snow">Снег (встроенный)</option>
                    <option value="fog">Туман (встроенный)</option>
                    <option value="ash">Пепел (встроенный)</option>
                  </optgroup>
                  <optgroup label="Слои кампании (реестр выше)">
                    {(m.overlay_layers ?? []).map((l) => (
                      <option key={l.id} value={l.id}>{l.label}</option>
                    ))}
                  </optgroup>
                  {(m.atmospherics?.length ?? 0) > 0 && (
                    <optgroup label="Мастерская спецэффектов (из файлов)">
                      {m.atmospherics!.map((a) => (
                        <option key={a.id} value={a.id}>{a.label || a.id}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </label>
              <button className="btn btn-small ce-del" data-tip="Удалить погоду" onClick={() => (m.weathers!.splice(i, 1), commit())}><Ico n="close" /> </button>
            </div>
            <label className="fld">
              <span>Зацикленные звуки погоды</span>
              <select
                value=""
                onChange={(e) => {
                  const id = e.target.value
                  if (!id) return
                  if (!w.ambient) w.ambient = []
                  if (!w.ambient.includes(id)) w.ambient.push(id)
                  commit()
                }}
              >
                <option value="">+ добавить звук…</option>
                {(m.sounds ?? [])
                  .filter((s) => !(w.ambient ?? []).includes(s.id) && !(w.ambient ?? []).includes(s.id.replace(/^sfx_/, 'snd_')) && !(w.ambient ?? []).includes(s.id.replace(/^snd_/, 'sfx_')))
                  .map((s) => (
                    <option key={s.id} value={s.id}>{s.label || s.id}</option>
                  ))}
              </select>
            </label>
            <div className="chips">
              {(w.ambient ?? []).map((id) => {
                const sl = (sounds?: Array<{ id: string; label?: string }>) => {
                  const exact = (sounds ?? []).find((s) => s.id === id)
                  if (exact) return exact.label || exact.id
                  const alt = id.startsWith('snd_') ? id.replace(/^snd_/, 'sfx_') : id.startsWith('sfx_') ? id.replace(/^sfx_/, 'snd_') : ''
                  if (alt) {
                    const found = (sounds ?? []).find((s) => s.id === alt)
                    if (found) return found.label || found.id
                  }
                  return id.replace(/^(snd_|sfx_)/, '').replace(/_/g, ' ')
                }
                return (
                  <span key={id} className="chip">
                    {sl(m.sounds)}
                    <button className="chip-del" data-tip="Убрать звук" onClick={() => ((w.ambient = (w.ambient ?? []).filter((x) => x !== id)), commit())}><Ico n="close" /> </button>
                  </span>
                )
              })}
            </div>
            <div className="fld-row" style={{ flexWrap: 'wrap' }} data-tip="Влияние этой погоды на бой: действует на обе стороны">
              <label className="fld fld-num" data-tip="Общий штраф всему движению (и бойцам игрока, и врагам); итог не ниже 1">
                <span>Штраф движения в бою</span>
                <input
                  type="number" min={0}
                  value={w.combat?.mov_penalty ?? 0}
                  onChange={(e) => {
                    const v = Math.max(0, Number(e.target.value) || 0)
                    if (v > 0) w.combat = { ...(w.combat ?? {}), mov_penalty: v }
                    else if (w.combat) delete w.combat.mov_penalty
                    commit()
                  }}
                />
              </label>
              <label className="fld fld-num" data-tip="Срезание дальности оружия (туман, темнота); итог ≥ 1">
                <span>Срезание дальности</span>
                <input
                  type="number" min={0}
                  value={w.combat?.range_penalty ?? 0}
                  onChange={(e) => {
                    const v = Math.max(0, Number(e.target.value) || 0)
                    if (v > 0) w.combat = { ...(w.combat ?? {}), range_penalty: v }
                    else if (w.combat) delete w.combat.range_penalty
                    commit()
                  }}
                />
              </label>
              <div className="fld" style={{ flex: 2, minWidth: 260 }} data-tip="Сдвиги навыков в бою под этой погодой: строка «навык — сдвиг», минус — штраф">
                <span>Сдвиг навыков</span>
                <SkillDeltaRows
                  store={store}
                  mods={w.combat?.skill_mods ?? []}
                  onChange={(arr) => {
                    if (arr.length) w.combat = { ...(w.combat ?? {}), skill_mods: arr }
                    else if (w.combat) delete w.combat.skill_mods
                    commit()
                  }}
                />
              </div>
              <label className="fld" data-tip="Статус, который действует на всех бойцов в бою под этой погодой (мороз, пар)">
                <span>Статус в бою</span>
                <select
                  value={w.combat?.status ?? ''}
                  onChange={(e) => {
                    const v = e.target.value
                    if (v) w.combat = { ...(w.combat ?? {}), status: v }
                    else if (w.combat) delete w.combat.status
                    commit()
                  }}
                >
                  <option value="">— нет —</option>
                  {(m.statuses ?? []).map((st) => (
                    <option key={st.id} value={st.id}>{st.label || st.id}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        ))}
        <button
          className="btn btn-small"
          onClick={async () => {
            const label = await askText('Название погоды', 'например «Моросящий дождь»')
            if (!label) return
            if (!m.weathers) m.weathers = []
            m.weathers.push({ id: makeId('weather_', label, m.weathers.map((x) => x.id)), label })
            commit()
          }}
        >
          + погода
        </button>
      </div>


      <div className="props-group">
        <h4>Финальные экраны (концовки)</h4>
        <div className="muted small" style={{ marginBottom: 8 }}>
          Сколько угодно финалов: движок берёт <strong>первую</strong> подходящую
          (исход + все условия). Ставьте узкие ветки (флаг/квест) выше, общие
          и без условий — в конец. Без подходящей — стандартный экран
          («Забег окончен» / «Победа»).
        </div>
        {(m.endings ?? []).map((en, i) => (
          <div key={i} className="prof-card">
            <div className="prof-card-head">
              <label className="fld"><span>Название (для редактора)</span>
                <input value={en.label} onChange={(e) => ((en.label = e.target.value), commit())} />
              </label>
              <button className="btn btn-small ce-del" data-tip="Удалить концовку" onClick={() => ((m.endings = m.endings!.filter((_, x) => x !== i)), commit())}><Ico n="close" /></button>
            </div>
            <div className="fld-row" style={{ flexWrap: 'wrap' }}>
              <label className="fld"><span>Заголовок экрана</span>
                <input value={en.title} onChange={(e) => ((en.title = e.target.value), commit())} />
              </label>
              <label className="fld"><span>Тон экрана</span>
                <select
                  value={en.tone ?? ''}
                  onChange={(e) => {
                    const v = e.target.value
                    if (v) en.tone = v as EndingDef['tone']
                    else delete en.tone
                    commit()
                  }}
                >
                  <option value="">По исходу (гибель/победа)</option>
                  <option value="death">Гибель</option>
                  <option value="victory">Победа</option>
                  <option value="neutral">Нейтральный</option>
                </select>
              </label>
              <label className="fld"><span>К исходу</span>
                <select
                  value={en.on ?? ''}
                  onChange={(e) => {
                    const v = e.target.value
                    if (v) en.on = v as EndingDef['on']
                    else delete en.on
                    commit()
                  }}
                >
                  <option value="">Любой исход</option>
                  <option value="death">Только гибель</option>
                  <option value="victory">Только победа</option>
                </select>
              </label>
            </div>
            <label className="fld"><span>Текст концовки</span>
              <textarea rows={3} value={en.text ?? ''} onChange={(e) => ((en.text = e.target.value || undefined), commit())} />
            </label>
            <ImageUpload
              label="Фон финала (необязательно)"
              value={en.image ?? ''}
              dir="assets/img/endings"
              store={store}
              onChange={(p) => {
                if (p) en.image = p
                else delete en.image
                commit()
              }}
            />
            <div className="prof-sec">Условия (все сразу; пусто — всегда):</div>
            <ConditionListEditor
              store={store}
              conditions={en.conditions ?? []}
              onChange={(v) => {
                if (v.length) en.conditions = v
                else delete en.conditions
                commit()
              }}
            />
          </div>
        ))}
        <button className="btn btn-small" onClick={async () => {
          const label = await askText('Название концовки', 'например «Банда разбита»')
          if (!label) return
          ;(m.endings ??= []).push({ id: makeId('ending_', label, m.endings?.map((x) => x.id) ?? []), label, title: label })
          commit()
        }}>+ концовка</button>
      </div>

      <div className="props-group">
        <h4>Категории предметов</h4>
        <div className="muted small" style={{ marginBottom: 8 }}>
          Категория определяет, что умеет предмет: восстанавливать здоровье или потребности,
          быть оружием или бронёй. Поля в форме предмета появляются по его категории.
        </div>
        {(m.item_categories ?? []).map((c, i) => (
          <div key={i} className="itemcat-card">
            <div className="fld-row need-row">
              <label className="fld">
                <span>Название</span>
                <input value={c.label} onChange={(e) => ((c.label = e.target.value), commit())} />
              </label>
              <button className="btn btn-small ce-del" data-tip="Удалить" onClick={() => (m.item_categories!.splice(i, 1), commit())}><Ico n="close" /> </button>
            </div>
            {/* галочки возможностей категории: сетка с переносом — без
                горизонтальной прокрутки, сколько бы их ни было */}
            <div className="itemcat-checks">
              <label className="fld fld-check" data-tip="Предметы категории можно использовать для лечения">
                <input type="checkbox" checked={!!c.restores_hp} onChange={(e) => {
                  if (e.target.checked) c.restores_hp = true
                  else delete c.restores_hp
                  commit()
                }} />
                <span>Лечит (HP)</span>
              </label>
              {m.needs.map((n) => (
                <label key={n.id} className="fld fld-check" data-tip={`Предметы категории восстанавливают «${n.label}»`}>
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
            </div>
            <details>
              <summary><Ico n="sound" />  Звуки действий предметов этой категории</summary>
              <SoundHookMapEditor
                store={store}
                value={c.sounds ?? (c.sounds = {})}
                onChange={commit}
                heading="Звуки действий (для категории)"
              />
            </details>
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


        </>
      )}
      {tab === 'flags' && (
        <>
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
            <label className="fld" style={{ flex: 2 }} data-tip="Какое событие запоминает флаг и где он читается (правила, диалоги, квесты). Для ИИ-кампаний поле обязательное.">
              <span>Для чего нужен{!f.description?.trim() && <span className="fld-err"> — не заполнено</span>}</span>
              <input
                value={f.description ?? ''}
                placeholder="напр.: поднята, когда следователь нашёл квитанцию; читается в финале"
                onChange={(e) => {
                  if (e.target.value) f.description = e.target.value
                  else delete f.description
                  commit()
                }}
              />
            </label>
            <button className="btn btn-small ce-del" data-tip="Удалить из реестра (контент, где флаг используется, не меняется)" onClick={() => (m.flags!.splice(i, 1), commit())}><Ico n="close" /> </button>
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
        <h4>Состояния портретов (настроения)</h4>
        <div className="muted small" style={{ marginBottom: 8 }}>
          Свой список состояний для портретов персонажей (ехидство, задумчивость…).
          Все состояния из списка можно переименовывать и удалять. Дефолтное состояние
          «{DEFAULT_EMOTION.label}» есть всегда — сюда попадает загруженная картинка, в список оно не входит.
          Состояния из списка предлагаются в конструкторе диалогов у всех персонажей.
        </div>
        {(m.emotions ?? []).map((em, i) => (
          <div key={em.id} className="fld-row need-row">
            <label className="fld">
              <span>Название</span>
              <input
                value={em.label}
                onChange={(e) => ((em.label = e.target.value), commit())}
              />
            </label>
            <button
              className="btn btn-small ce-del"
              data-tip="Удалить из реестра (картинки у персонажей останутся)"
              onClick={() => (m.emotions!.splice(i, 1), commit())}
            >
              <Ico n="close" /> 
            </button>
          </div>
        ))}
        <button
          className="btn btn-small"
          onClick={async () => {
            const label = await askText('Название нового состояния', 'например «Ехидство»')
            if (!label) return
            if (!m.emotions) m.emotions = []
            m.emotions.push({ id: makeId('', label, m.emotions.map((x) => x.id)), label })
            commit()
          }}
        >
          + состояние
        </button>
      </div>


        </>
      )}
      {tab === 'audio' && (
        <>
      <AudioRegistries store={store} />


        </>
      )}
      {tab === 'generators' && (() => {
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
      })()}
      {tab === 'json' && (
        <div className="advanced-json-page">
          <JsonField
            label=""
            rows={26}
            pretty
            fill
            value={m}
            onChange={(v) => {
              if (v !== undefined) {
                Object.assign(store, { meta: v })
                commit()
              }
            }}
          />
        </div>
      )}
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

/**
 * Реестр статусов кампании (блок 5 ТЗ «Гибкий движок»). Вкладка называется
 * «Статусы и способности» — блок 6 добавит сюда же способности.
 */
function StatusRegistry({ m, store, commit }: { m: CampaignMeta; store: EditorStore; commit: () => void }) {
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
function VersionsTab({ store, commit }: { store: EditorStore; commit: () => void }) {
  const m = store.meta
  const [, force] = useState(0)
  const [compat, setCompat] = useState<CampaignCompat | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void loadCompat(store).then((c) => setCompat(c))
  }, [store])

  const publish = async () => {
    setBusy(true)
    try {
      const plan: PublishPlan = await planPublish(store)
      const lines = diffReportLines(plan.diff)
      await showList(
        plan.previous ? `Обновление ${plan.previous.version} → ${plan.suggestedVersion}` : 'Первая публикация версии',
        lines,
        plan.diff.breaking
          ? `Есть ломающие изменения: сохранения до версии ${plan.suggestedBase} поддерживаться не будут. Игрок увидит это до обновления кампании.`
          : 'Ломающих изменений нет: сохранения игроков продолжат работать.',
        { label: 'Скопировать отчёт', text: lines.join('\n') },
      )
      const nextVersion =
        (await askText(
          'Версия кампании',
          'например 1.5.0',
          plan.suggestedVersion,
          'Опубликовать',
        )) ?? ''
      if (!nextVersion.trim()) return
      const notes = (await askText('Что изменилось (видно игроку)', 'например «переписана глава 3»', plan.compat.notes ?? '', 'Записать')) ?? undefined
      const paths = applyPublish(store, plan, nextVersion.trim(), notes)
      await store.saveToDisk(paths)
      setCompat(await loadCompat(store))
      commit()
      force((n) => n + 1)
      await showAlert('Версия опубликована', `Записаны ${paths.join(', ')}. Сохраните кампанию, чтобы изменения попали на диск.`)
    } catch (e) {
      await showAlert('Не удалось опубликовать версию', String(e))
    } finally {
      setBusy(false)
    }
  }

  const inventory = storeInventory(store)

  return (
    <>
      <div className="props-group">
        <h4>Версии</h4>
        <p className="muted small">
          Версия кампании — для игрока и для совместимости сохранений. Версия движка
          и формат пакета подставляются сами: их задаёт Chronicle Forge, не мастер.
        </p>
        <div className="fld-row">
          <label className="fld">
            <span>Версия кампании</span>
            <input value={m.version} onChange={(e) => ((m.version = e.target.value), commit())} />
          </label>
          <label className="fld" data-tip="Минимальная версия движка, на которой кампания работает корректно">
            <span>Мин. движок</span>
            <input
              value={m.min_engine ?? ''}
              placeholder={ENGINE_VERSION}
              onChange={(e) => ((m.min_engine = e.target.value || undefined), commit())}
            />
          </label>
          <div className="fld">
            <span>Движок сейчас</span>
            <input value={ENGINE_VERSION} readOnly />
          </div>
          <div className="fld">
            <span>Формат пакета</span>
            <input value={`v${PACKAGE_FORMAT}`} readOnly />
          </div>
        </div>
        <div className="fld-row">
          <label className="fld" data-tip="Сохранения от какой версии кампании ещё поддерживаются. Заполняется при публикации обновления.">
            <span>Сохранения поддерживаются с версии</span>
            <input
              value={m.save_base_version ?? ''}
              placeholder="поддерживаются все"
              onChange={(e) => ((m.save_base_version = e.target.value || undefined), commit())}
            />
          </label>
          <div className="fld">
            <span>Быстро поднять версию</span>
            <span className="btn-row">
              <button className="btn btn-small" onClick={() => ((m.version = bumpVersion(m.version, 'patch')), commit())}>+_patch</button>
              <button className="btn btn-small" onClick={() => ((m.version = bumpVersion(m.version, 'minor')), commit())}>+minor</button>
              <button className="btn btn-small" onClick={() => ((m.version = bumpVersion(m.version, 'major')), commit())}>+major</button>
            </span>
          </div>
        </div>
      </div>

      <div className="props-group">
        <h4>Контракт совместимости (compat.json)</h4>
        {compat ? (
          <p className="muted small">
            Опубликована версия {compat.version}
            {compat.save_base_version ? `; сохранения поддерживаются с ${compat.save_base_version}` : '; поддерживаются все сохранения'}
            {compat.updated_at ? `; обновлено ${new Date(compat.updated_at).toLocaleString('ru-RU')}` : ''}
            {compat.breaks?.length ? `; ломающих изменений: ${compat.breaks.length}` : ''}.
          </p>
        ) : (
          <p className="muted small">
            Контракта ещё нет: кампания не публиковалась. При первой публикации
            редактор зафиксирует текущее состояние пакета как точку отсчёта.
          </p>
        )}
        <p className="muted small">
          Объектов в пакете: {Object.values(inventory.ids).reduce((n, list) => n + list.length, 0)} ·
          отпечаток инвентаризации: <code>{inventory.digest}</code>
        </p>
        <button className="btn btn-primary" disabled={busy} onClick={() => void publish()}>
          {busy ? 'Сравнение…' : 'Проверить совместимость и опубликовать версию'}
        </button>
      </div>
    </>
  )
}


// ─────────────── генераторы: конструкторы без JSON (фидбек «без техно-форм») ───────────────

type GenBase = { id: string; label: string; description?: string; lists: Record<string, GenWeightedItem[]> }

/** Панель генератора одного вида (лица/места/приключения): заготовка + фабрика. */
function GeneratorKindSection<T extends GenBase>({
  heading,
  hint,
  items,
  onChange,
  makeNew,
  fields,
  store,
  renderBody,
}: {
  /** прописано как heading, а не title: у секции нет нативного тултипа —
   *  весь смысл подписи виден в заголовке (правка фидбека №9) */
  heading: string
  hint: string
  items: T[]
  onChange: (next: T[]) => void
  makeNew: (existing: T[]) => T
  fields: React.ReactNode
  store: EditorStore
  renderBody: (gen: T, update: (g: T) => void, store: EditorStore) => React.ReactNode
}) {
  return (
    <div className="props-group" style={{ borderTop: '1px dashed var(--border-soft)', marginTop: 12, paddingTop: 10 }}>
      <h5 className="ce-subhead">{heading}</h5>
      <div className="muted small" style={{ marginBottom: 6 }}>{hint}</div>
      {items.map((gen, i) => (
        <div key={gen.id} className="panel" style={{ padding: 8, marginBottom: 8 }}>
          <div className="fld-row">
            <input value={gen.label} placeholder="Название генератора" style={{ flex: 1 }}
              onChange={(e) => { const arr = items.map((x, j) => j === i ? { ...x, label: e.target.value } : x); onChange(arr) }} />
            <button className="btn btn-small btn-danger" onClick={() => onChange(items.filter((_, j) => j !== i))}><Ico n="trash" /></button>
          </div>
          <label className="fld">
            <span>Описание (для себя)</span>
            <input value={gen.description ?? ''} onChange={(e) => { const arr = items.map((x, j) => j === i ? { ...x, description: e.target.value || undefined } : x); onChange(arr) }} />
          </label>
          <div className="muted small" style={{ margin: '4px 0' }}>{fields}</div>
          {renderBody(gen, (g2) => { const arr = items.map((x, j) => j === i ? g2 : x); onChange(arr) }, store)}
        </div>
      ))}
      <button className="btn btn-small" onClick={() => onChange([...items, makeNew(items)])}><Ico n="plus" /> {heading.toLowerCase()}</button>
    </div>
  )
}

/** Списки генератора: ключ → строки «значение | вес» (вес опционален). */
function GenListsEditor({
  lists,
  onChange,
}: {
  lists: Record<string, GenWeightedItem[]>
  onChange: (next: Record<string, GenWeightedItem[]>) => void
}) {
  const addList = () => {
    let n = 1
    while (lists[`список_${n}`]) n++
    onChange({ ...lists, [`список_${n}`]: [] })
  }
  return (
    <>
      <span className="fld-label">Списки значений (вес через «|»: «Суровый | 2»)</span>
      {Object.entries(lists).map(([key, items]) => (
        <div key={key} className="panel" style={{ padding: 8, marginBottom: 6 }}>
          <div className="fld-row" style={{ alignItems: 'center' }}>
            <input
              value={key}
              data-tip="Ключ списка — в подстановках {список:ключ} и привязках полей"
              style={{ width: 170 }}
              onChange={(e) => {
                const nk = e.target.value.trim()
                const next: Record<string, GenWeightedItem[]> = {}
                for (const [k, v] of Object.entries(lists)) next[k === key && nk ? nk : k] = v
                onChange(next)
              }}
            />
            <button className="btn btn-small" onClick={() => { const next = { ...lists }; delete next[key]; onChange(next) }}><Ico n="close" /></button>
          </div>
          <textarea
            rows={Math.min(6, items.length + 1)}
            value={items.map((x) => (x.weight && x.weight !== 1 ? `${x.value} | ${x.weight}` : x.value)).join('\n')}
            placeholder="один вариант на строку; реже/чаще — «вариант | вес»"
            onChange={(e) => {
              const items: GenWeightedItem[] = e.target.value.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
                const m = l.match(/^(.*?)\s*\|\s*(\d+)\s*$/)
                return m ? { value: m[1] ?? '', weight: Math.max(1, +m![2] || 1) } : { value: l }
              })
              onChange({ ...lists, [key]: items })
            }}
          />
        </div>
      ))}
      <button className="btn btn-small" onClick={addList}><Ico n="plus" /> список значений</button>
    </>
  )
}

/** Русские подписи технических полей лица (имена в данных не переименовываем) */
const GEN_FIELD_LABELS: Record<string, string> = {
  description: 'описание',
  disposition_label: 'метка расположения',
}
/** «описание (description)» — по-русски, с техническим именем рядом */
export function genFieldLabel(field: string): string {
  return GEN_FIELD_LABELS[field] ? `${GEN_FIELD_LABELS[field]} (${field})` : field
}

/** Добавление пары «поле → список» для лиц. */
function GenFieldAdder({ existing, onAdd }: { existing: Record<string, GenWeightedItem[]>; onAdd: (field: string, key: string) => void }) {
  const [field, setField] = useState('')
  const keys = Object.keys(existing)
  const [key, setKey] = useState(keys[0] ?? '')
  return (
    <>
      <input
        value={field}
        placeholder="имя поля"
        data-tip="Техническое имя поля лица: description (описание), disposition_label (метка расположения), stats.STR, skills.stealth, item.weapon…"
        onChange={(e) => setField(e.target.value)}
      />
      <select value={keys.includes(key) ? key : keys[0] ?? ''} onChange={(e) => setKey(e.target.value)}>
        {keys.map((k) => <option key={k} value={k}>{k}</option>)}
      </select>
      <button className="btn btn-small" disabled={!field.trim() || !keys.length} onClick={() => onAdd(field.trim(), keys.includes(key) ? key : keys[0] ?? '')}><Ico n="plus" /> поле</button>
    </>
  )
}

function GenSlotSelect({ slotId, store, onChange }: { slotId: string; store: EditorStore; onChange: (v: string) => void }) {
  const opts = collectSlotOptions(store)
  const known = opts.some((o) => o.id === slotId)
  return (
    <select value={slotId} onChange={(e) => onChange(e.target.value)} style={{ width: 200 }}>
      {!known && <option value={slotId}>{slotId}</option>}
      {opts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select>
  )
}

function GenSlotAdder({ store, gen, onAdd }: { store: EditorStore; gen: { lists: Record<string, GenWeightedItem[]>; slots: Record<string, string> }; onAdd: (slotId: string, key: string) => void }) {
  const opts = collectSlotOptions(store).filter((o) => !(gen.slots ?? {})[o.id])
  const keys = Object.keys(gen.lists)
  const [slotId, setSlotId] = useState(opts[0]?.id ?? '')
  const [key, setKey] = useState(keys[0] ?? '')
  if (!opts.length || !keys.length) return null
  return (
    <div className="fld-row" style={{ alignItems: 'center' }}>
      <select value={opts.some((o) => o.id === slotId) ? slotId : opts[0]!.id} onChange={(e) => setSlotId(e.target.value)}>
        {opts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
      <select value={keys.includes(key) ? key : keys[0]} onChange={(e) => setKey(e.target.value)}>
        {keys.map((k) => <option key={k} value={k}>{k}</option>)}
      </select>
      <button className="btn btn-small" onClick={() => onAdd(opts.some((o) => o.id === slotId) ? slotId : opts[0]!.id, keys.includes(key) ? key : keys[0]!)}><Ico n="plus" /> слот</button>
    </div>
  )
}



/** Все слоты всех сцен кампании: «сцена · слот» (значение — id слота). */
function collectSlotOptions(store: EditorStore): Array<{ id: string; label: string }> {
  const seen = new Set<string>()
  const out: Array<{ id: string; label: string }> = []
  for (const p of store.scenePaths()) {
    const sc = store.scene(p)
    if (!sc) continue
    for (const sl of sc.slots ?? []) {
      if (seen.has(sl.id)) continue
      seen.add(sl.id)
      out.push({ id: sl.id, label: `${sc.label}: ${sl.label ?? sl.id}` })
    }
  }
  return out.sort((a, b) => a.label.localeCompare(b.label, 'ru'))
}

/**
 * Реестр шаблонов видов существ (вместо встроенных пресетов движка):
 * мастер описывает виды своей кампании, редактор персонажа предлагает
 * «Применить вид» — перезаписывает статы/навыки/броню/оружие/мораль NPC.
 */
function SpeciesRegistry({ m, store, commit }: { m: CampaignMeta; store: EditorStore; commit: () => void }) {
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
function HeroPortraitsEditor({ m, store, commit }: { m: CampaignMeta; store: EditorStore; commit: () => void }) {
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
