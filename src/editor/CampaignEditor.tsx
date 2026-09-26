import { DEFAULT_EMOTION } from '../shared/types'
import { Ico } from '../shared/icons'
import { useEffect, useState } from 'react'
import type { EditorStore } from './store'
import { AssetUpload, JsonField } from './Fields'
import { BUILTIN_SKILL_LABELS } from '../shared/skills'
import { makeId } from './ids'
import { FlagSelect } from './Fields'
import type { CampaignFeatures, CampaignMeta, DiceRules, FontDef, NeedCondition, TimeOfDay } from '../shared/types'
import { CLASSIC_DICE_RULES, DEFAULT_DICE_RULES } from '../shared/types'
import { BUILTIN_SLOT_TYPES } from './slotTypes'
import { askText } from './prompt'
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
}: {
  options: Array<{ id: string; label: string }>
  value: string[]
  onChange: (v: string[]) => void
  emptyLabel: string
}) {
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])
  return (
    <div className="chips chip-multi">
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
          <Ico n="dice" />  Щедрые (по умолчанию)
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
        <span className="muted small">— системный шрифт —</span>
      )}
    </div>
  )
}

/** вкладка «Оформление»: шрифты, фон меню/финала, акцент (блок 2 ТЗ) */
function ThemeTab({ meta, store, commit }: { meta: CampaignMeta; store: EditorStore; commit: () => void }) {
  const fonts = meta.fonts ?? (meta.fonts = [])
  const theme = meta.theme ?? (meta.theme = {})
  const fontOpts = fonts.map((f) => ({ id: f.id, label: f.label || f.id }))

  const setFont = (patch: Partial<NonNullable<CampaignMeta['theme']>['fonts'] & object>) => {
    theme.fonts = { ...(theme.fonts ?? {}), ...patch }
    commit()
  }

  return (
    <>
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
                <option value="">Системный (по умолчанию)</option>
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
        <h4>Акцентный цвет</h4>
        <div className="fld-row">
          <label className="fld" data-tip="Заменяет золотой акцент интерфейса. Не меняйте на слишком тёмный — пропадёт контраст.">
            <span>Цвет кнопок, рамок и подсветок</span>
            <input
              type="color"
              value={theme.accent ?? '#c9a45c'}
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
              Вернуть золото по умолчанию
            </button>
          )}
        </div>
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
  type CeTab = 'main' | 'mechanics' | 'look' | 'people' | 'items' | 'flags' | 'audio' | 'json'
  const [tab, setTab] = useState<CeTab>('main')

  const sceneOpts = store.options('scene')
  const locOpts = store.options('location')
  const regionOpts = store.world.regions.map((r) => ({ id: r.id, label: r.label }))
  const npcOpts = store.options('npc')

  return (
    <div className="rule-editor">
      <div className="ce-tabs">
        {([['main', 'Основное'], ['mechanics', 'Механики'], ['look', 'Оформление'], ['people', 'Персонажи'], ['items', 'Предметы и слоты'], ['flags', 'Флаги'], ['audio', 'Звук и музыка'], ['json', 'JSON']] as const).map(([id, lab]) => (
          <button key={id} type="button" className={`ce-tab ${tab === id ? 'on' : ''}`} onClick={() => setTab(id)}>
            {lab}
          </button>
        ))}
      </div>

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
          Встроенные типы удалить нельзя; добавьте свои — например «Мебель», «Робот» или «Дух».
        </div>
        <div className="chips" style={{ marginBottom: 8 }}>
          {BUILTIN_SLOT_TYPES.map((t) => (
            <span key={t.id} className="chip chip-static" data-tip="Встроенный тип — удалить нельзя">
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
            <details style={{ flex: '1 1 100%' }}>
              <summary><Ico n="sound" />  Звуки действий предметов этой категории</summary>
              <SoundHookMapEditor
                store={store}
                value={c.sounds ?? (c.sounds = {})}
                onChange={commit}
                heading="Звуки действий (для категории)"
              />
            </details>
            <button className="btn btn-small ce-del" data-tip="Удалить" onClick={() => (m.item_categories!.splice(i, 1), commit())}><Ico n="close" /> </button>
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
