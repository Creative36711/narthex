import { DEFAULT_EMOTION } from '../shared/types'
import { Ico } from '../shared/icons'
import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import type { EditorStore } from './store'
import { AssetUpload, ConditionListEditor, EffectListEditor, ImageUpload, JsonField, RefSelect } from './Fields'
import { BUILTIN_SKILL_LABELS } from '../shared/skills'
import { makeId } from './ids'
import { FlagSelect } from './Fields'
import type { CampaignFeatures, CampaignMeta, DiceRules, EndingDef, FontDef, NeedCondition, StatusDef, TimeOfDay } from '../shared/types'
import { CLASSIC_DICE_RULES, DEFAULT_DICE_RULES } from '../shared/types'
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
  }
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
  type CeTab = 'main' | 'creation' | 'versions' | 'mechanics' | 'look' | 'statuses' | 'people' | 'items' | 'flags' | 'audio' | 'json'
  const [tab, setTab] = useState<CeTab>('main')

  const sceneOpts = store.options('scene')
  const locOpts = store.options('location')
  const regionOpts = store.world.regions.map((r) => ({ id: r.id, label: r.label }))
  const npcOpts = store.options('npc')

  return (
    <div className="rule-editor">
      <div className="ce-tabs" role="tablist" aria-label="Вкладки кампании">
        {([['main', 'Основное'], ['creation', 'Создание героя'], ['versions', 'Версии'], ['mechanics', 'Механики'], ['look', 'Оформление'], ['statuses', 'Статусы и способности'], ['people', 'Персонажи'], ['items', 'Предметы и слоты'], ['flags', 'Флаги'], ['audio', 'Звук и музыка'], ['json', 'JSON']] as const).map(([id, lab]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={`ce-tab ${tab === id ? 'on' : ''}`} onClick={() => setTab(id)}>
            {lab}
          </button>
        ))}
      </div>

      {tab === 'versions' && <VersionsTab store={store} commit={commit} />}

      {tab === 'mechanics' && (
        <div className="props-group">
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
        <h4>Бой и смерть</h4>
        <div className="fld-row" style={{ flexWrap: 'wrap' }}>
          <label className="fld fld-check" data-tip="Кнопка «Бежать из боя»: бесплатные атаки вслед + проверка навыка отступления">
            <input
              type="checkbox"
              checked={m.combat?.flee !== false}
              onChange={(e) => {
                const c = { ...(m.combat ?? {}) }
                c.flee = e.target.checked ? undefined : false
                m.combat = Object.keys(c).length && JSON.stringify(c) !== '{}' ? c : undefined
                if (!Object.values(c).some((v) => v !== undefined)) delete m.combat
                commit()
              }}
            />
            <span>Бегство из боя разрешено</span>
          </label>
          <label className="fld" data-tip="Навык проверки отступления; пусто — dodge, а при его отсутствии — DEX×5">
            <span>Навык отступления</span>
            <input
              value={typeof m.combat?.flee === 'object' ? (m.combat.flee.skill ?? '') : ''}
              placeholder="dodge"
              onChange={(e) => {
                const c = { ...(m.combat ?? {}), flee: { skill: e.target.value || undefined } }
                if (!e.target.value) (c.flee as { skill?: string }).skill = undefined
                m.combat = c
                commit()
              }}
            />
          </label>
          <label className="fld fld-num" data-tip="Штраф каждой следующей атаки за раунд при attacks_per_round > 1">
            <span>Штраф повторных атак</span>
            <input
              type="number"
              value={m.combat?.multi_attack_penalty ?? -20}
              onChange={(e) => {
                const c = { ...(m.combat ?? {}) }
                c.multi_attack_penalty = Number(e.target.value) || 0
                m.combat = c
                commit()
              }}
            />
          </label>
          <label className="fld fld-check" data-tip="Действие «Прицелиться»: тратит одну атаку, следующая — с бонусом">
            <input
              type="checkbox"
              checked={m.combat?.aim !== false}
              onChange={(e) => {
                const c = { ...(m.combat ?? {}) }
                c.aim = e.target.checked ? undefined : false
                m.combat = c
                commit()
              }}
            />
            <span>Прицельные атаки</span>
          </label>
          <label className="fld fld-num" data-tip="Бонус за прицеливание (по умолчанию +20%)">
            <span>Бонус прицеливания</span>
            <input
              type="number"
              value={typeof m.combat?.aim === 'object' ? (m.combat.aim.bonus ?? 20) : 20}
              onChange={(e) => {
                const c = { ...(m.combat ?? {}) }
                c.aim = { bonus: Number(e.target.value) || 0 }
                m.combat = c
                commit()
              }}
            />
          </label>
          <label className="fld fld-check" data-tip="Уход из угрожаемого гекса провоцирует бесплатную атаку врага">
            <input
              type="checkbox"
              checked={m.combat?.opportunity_attacks !== false}
              onChange={(e) => {
                const c = { ...(m.combat ?? {}) }
                c.opportunity_attacks = e.target.checked ? undefined : false
                m.combat = c
                commit()
              }}
            />
            <span>Атаки возможности</span>
          </label>
          <label className="fld" data-tip="Скрытность: красться (сцена), прятаться и внезапные атаки (бой). Поля ниже — навыки скрытности и внимательности.">
            <span>Скрытность</span>
            <select
              value={m.stealth ? 'on' : 'off'}
              onChange={(e) => {
                if (e.target.value === 'on') m.stealth = { skill: 'stealth', perception_skill: 'perception' }
                else delete m.stealth
                commit()
              }}
            >
              <option value="off">Выключена (умолчание)</option>
              <option value="on">Включена (стелс-механики)</option>
            </select>
          </label>
          {m.stealth && (
            <>
              <label className="fld">
                <span>Навык скрытности</span>
                <input value={m.stealth.skill ?? 'stealth'} onChange={(e) => ((m.stealth!.skill = e.target.value || 'stealth'), commit())} />
              </label>
              <label className="fld" data-tip="Навык обнаружения NPC; у NPC без него берётся INT×2, либо поле perception самого NPC">
                <span>Навык внимательности</span>
                <input value={m.stealth.perception_skill ?? 'perception'} onChange={(e) => ((m.stealth!.perception_skill = e.target.value || 'perception'), commit())} />
              </label>
            </>
          )}
          <label className="fld" data-tip="instant: 0 HP = смерть. brp: тяжёлые раны (нокаут от удара ≥ ½ max HP при провале CON) и последний спасбросок CON при 0 HP">
            <span>Правила гибели</span>
            <select
              value={m.combat?.death?.mode ?? 'instant'}
              onChange={(e) => {
                const c = { ...(m.combat ?? {}) }
                c.death = { ...(c.death ?? {}), mode: e.target.value as 'instant' | 'brp' }
                m.combat = c
                commit()
              }}
            >
              <option value="instant">Мгновенная смерть (умолчание)</option>
              <option value="brp">BRP: тяжёлые раны и спасброски CON</option>
            </select>
          </label>
          {m.combat?.death?.mode === 'brp' && (
            <label className="fld fld-num" data-tip="Множитель CON для спасбросков сознания/смерти (умолчание 5)">
              <span>Множитель CON</span>
              <input
                type="number" min={1}
                value={m.combat.death.con_multiplier ?? 5}
                onChange={(e) => ((m.combat!.death!.con_multiplier = Math.max(1, Number(e.target.value) || 5)), commit())}
              />
            </label>
          )}
        </div>
        <div className="muted small">
          В режиме BRP «проигранный» бой с выжившим без сознания героем завершается эффектами
          «on_defeat» у конкретного start_combat — например, плен. Без них герой погибает.
        </div>
      </div>

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
          готовым персонажем-шаблоном, как раньше.
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
                <label className="fld">
                  <span>Базовая формула броска</span>
                  <input
                    value={m.char_creation.roll.notation ?? '3d6'}
                    placeholder="3d6"
                    onChange={(e) => ((m.char_creation!.roll!.notation = e.target.value || '3d6'), commit())}
                  />
                </label>
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
                    <label key={k} className="fld" style={{ maxWidth: 90 }}>
                      <span>{k}</span>
                      <input
                        value={m.char_creation!.roll!.per_stat?.[k] ?? ''}
                        placeholder={m.char_creation!.roll!.notation ?? '3d6'}
                        onChange={(e) => {
                          const per = { ...(m.char_creation!.roll!.per_stat ?? {}) }
                          if (e.target.value.trim()) per[k] = e.target.value.trim()
                          else delete per[k]
                          m.char_creation!.roll!.per_stat = Object.keys(per).length ? per : undefined
                          commit()
                        }}
                      />
                    </label>
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
        {(m.skills ?? []).map((sk, i) => (
          <div key={i} className="fld-row need-row">
            <label className="fld">
              <span>Название</span>
              <input value={sk.label} onChange={(e) => ((sk.label = e.target.value), commit())} />
            </label>
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
                  {(m.overlay_layers ?? []).map((l) => (
                    <option key={l.id} value={l.id}>{l.label}</option>
                  ))}
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
                  .filter((s) => !(w.ambient ?? []).includes(s.id))
                  .map((s) => (
                    <option key={s.id} value={s.id}>{s.label || s.id}</option>
                  ))}
              </select>
            </label>
            <div className="chips">
              {(w.ambient ?? []).map((id) => (
                <span key={id} className="chip">
                  {(m.sounds ?? []).find((s) => s.id === id)?.label || id}
                  <button className="chip-del" data-tip="Убрать звук" onClick={() => ((w.ambient = (w.ambient ?? []).filter((x) => x !== id)), commit())}><Ico n="close" /> </button>
                </span>
              ))}
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
          Сколько угодно финалов: при завершении забега движок показывает первую
          концовку, у которой совпадает исход и выполнены все условия. Без подходящей —
          стандартный экран («Забег окончен» / «Победа»).
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
            <label className="fld">
              <span>Описание (видно игроку)</span>
              <input value={s.description ?? ''} onChange={(e) => ((s.description = e.target.value || undefined), commit())} />
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
                <label className="fld" data-tip="Нотация кубиков, напр. 1d6+2. Бонус силы НЕ добавляется; броня цели поглощает.">
                  <span>Урон (кубики)</span>
                  <input value={a.damage ?? ''} placeholder="1d6" onChange={(e) => ((a.damage = e.target.value || undefined), commit())} />
                </label>
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
                <label className="fld" data-tip="Нотация кубиков, напр. 1d6">
                  <span>Лечение (кубики)</span>
                  <input value={a.heal ?? ''} placeholder="1d6" onChange={(e) => ((a.heal = e.target.value || undefined), commit())} />
                </label>
              )}
            </div>
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
