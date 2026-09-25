/**
 * Звук и музыка в редакторе (итерация 8, блок H6):
 * - реестры кампании: треки `music_tracks` (файл/ссылка/MusicDoc), звуки `sounds`
 *   (файл/ссылка/SoundDoc, вариативность — несколько источников под одним id);
 * - тема интерфейса `ui_sounds` + плейлисты `default_music`/`combat_music`;
 * - карта звуков взаимодействий (сущность → категория → тип слота → тема);
 * - правила музыки «условия → треки» у локаций и сцен.
 * Везде выбор из списков и предпрослушивание (▶), сырые id не показываются.
 */
import { useState } from 'react'
import type {
  MusicCondition,
  MusicDoc,
  MusicLayer,
  MusicMood,
  MusicRule,
  MusicScale,
  MusicSource,
  SoundDef,
  SoundDoc,
  SoundHook,
  SoundHookMap,
  SoundSource,
  TimeOfDay,
} from '../shared/types'
import { isSoundDoc, playSource } from '../shared/audio'
import { isMusicDoc } from '../shared/synth'
import { startTrackSource, type TrackHandle } from '../shared/music'
import type { EditorStore } from './store'
import { AssetUpload, FlagSelect } from './Fields'
import { askText } from './prompt'
import { makeId } from './ids'

export const SOUND_HOOK_LABELS: Array<{ id: SoundHook; label: string }> = [
  { id: 'pickup', label: 'Взять' },
  { id: 'use', label: 'Использовать' },
  { id: 'open', label: 'Открыть' },
  { id: 'talk', label: 'Заговорить' },
  { id: 'drop', label: 'Выбросить' },
  { id: 'travel', label: 'Переход по зоне' },
]

export const UI_HOOK_LABELS: Array<{ id: string; label: string }> = [
  { id: 'menu_music', label: 'Музыка меню' },
  { id: 'click', label: 'Кнопки (клик)' },
  { id: 'panel_open', label: 'Панель открылась' },
  { id: 'panel_close', label: 'Панель закрылась' },
  { id: 'message', label: 'Сообщение' },
  { id: 'travel_depart', label: 'Выезд' },
  { id: 'travel_arrive', label: 'Прибытие' },
  { id: 'scene_transition', label: 'Переход по зоне (тема)' },
  { id: 'combat_start', label: 'Начало боя' },
  { id: 'hit', label: 'Попадание' },
  { id: 'miss', label: 'Промах' },
  { id: 'crit', label: 'Критический удар' },
  { id: 'parry', label: 'Парирование/уворот' },
  { id: 'death', label: 'Смерть в бою' },
  { id: 'victory', label: 'Победа' },
  { id: 'defeat', label: 'Поражение' },
  { id: 'quest_started', label: 'Квест взят' },
  { id: 'quest_completed', label: 'Квест завершён' },
  { id: 'skill_up', label: 'Навык вырос' },
  { id: 'coin', label: 'Монеты (купля-продажа)' },
]

const MOODS: MusicMood[] = ['спокойная', 'тревожная', 'боевая', 'торжественная', 'таинственная']
const SCALES: MusicScale[] = ['минор', 'мажор', 'дорийский', 'фригийский', 'пентатоника']
const LAYERS: MusicLayer[] = ['пад-аккорды', 'арпеджио', 'бас', 'перкуссия']
const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const TOD: TimeOfDay[] = ['morning', 'day', 'evening', 'night']
const TOD_LABELS: Record<TimeOfDay, string> = { morning: 'утро', day: 'день', evening: 'вечер', night: 'ночь' }

const ZZFX_LABELS = [
  'Громкость (0…1)', 'Разброс', 'Частота, Гц', 'Атака, с', 'Сустейн, с', 'Затухание, с',
  'Форма волны (0 синус, 1 квадрат, 2 пила, 3 треуг., 4 шум)', 'Изгиб формы', 'Скольжение тона', 'Ускорение скольжения',
  'Скачок тона (полутоны)', 'Время скачка, с', 'Повтор, с', 'Шум (0…1)', 'Модуляция (FM)', 'Биткраш',
  'Эхо, с', 'Громкость сустейна (0…1)', 'Кривая затухания', 'Клиппинг (0…1)',
]

/** предпрослушивание музыки (▶): один активный фрагмент за раз */
let previewTrackHandle: TrackHandle | null = null
export function previewMusicSource(src: MusicSource, volume = 0.9): void {
  if (previewTrackHandle) {
    previewTrackHandle.stop(0.15)
    previewTrackHandle = null
  }
  previewTrackHandle = startTrackSource(src, volume, true)
  setTimeout(() => {
    previewTrackHandle?.stop(0.4)
    previewTrackHandle = null
  }, 7000)
}

function sourceKind(src: SoundSource | MusicSource): 'file' | 'synth' {
  return typeof src === 'object' && src !== null && (isSoundDoc(src) || isMusicDoc(src)) ? 'synth' : 'file'
}

// ─────────────── конструкторы синтез-документов ───────────────

function SoundDocEditor({ value, onChange }: { value: SoundDoc; onChange: () => void }) {
  const p = value.zzfx ?? (value.zzfx = [1, 0.05, 220, 0, 0, 0.1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.7, 1, 0])
  return (
    <div className="zzfx-grid">
      {ZZFX_LABELS.map((lab, i) => (
        <label key={i} className="fld zzfx-cell">
          <span>{lab}</span>
          <input
            type="number"
            step="any"
            value={p[i] ?? 0}
            onChange={(e) => {
              p[i] = Number(e.target.value)
              onChange()
            }}
          />
        </label>
      ))}
    </div>
  )
}

function MusicDocEditor({ value, onChange }: { value: MusicDoc; onChange: () => void }) {
  return (
    <>
      <div className="fld-row">
        <label className="fld">
          <span>Настроение</span>
          <select
            value={value.mood}
            onChange={(e) => {
              value.mood = e.target.value as MusicMood
              onChange()
            }}
          >
            {MOODS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>
        <label className="fld">
          <span>Гамма</span>
          <select
            value={value.scale}
            onChange={(e) => {
              value.scale = e.target.value as MusicScale
              onChange()
            }}
          >
            {SCALES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="fld">
          <span>Тональность</span>
          <select
            value={value.key ?? 'C'}
            onChange={(e) => {
              value.key = e.target.value
              onChange()
            }}
          >
            {KEYS.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="fld-row">
        <label className="fld">
          <span>Темп (ударов в минуту, пусто — от настроения)</span>
          <input
            type="number"
            min={30}
            max={220}
            value={value.tempo ?? ''}
            onChange={(e) => {
              if (e.target.value) value.tempo = Number(e.target.value)
              else delete value.tempo
              onChange()
            }}
          />
        </label>
        <label className="fld">
          <span>Зерно случайности (одинаковое — одна музыка)</span>
          <input
            type="number"
            value={value.seed ?? 0}
            onChange={(e) => {
              value.seed = Number(e.target.value)
              onChange()
            }}
          />
        </label>
      </div>
      <div className="fld fld-block">
        <span>Слои</span>
        <div className="chips">
          {LAYERS.map((l) => {
            const on = value.layers.includes(l)
            return (
              <button
                key={l}
                type="button"
                className={`chip ${on ? 'chip-on' : ''}`}
                onClick={() => {
                  if (on) value.layers = value.layers.filter((x) => x !== l)
                  else value.layers = [...value.layers, l]
                  if (!value.layers.length) value.layers = [l]
                  onChange()
                }}
              >
                {l}
              </button>
            )
          })}
        </div>
      </div>
      <label className="fld fld-block">
        <span>Аккорды ступенями гаммы (через запятую: i, VI, III, VII)</span>
        <input
          value={(value.progression ?? []).join(', ')}
          onChange={(e) => {
            const arr = e.target.value
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
            if (arr.length) value.progression = arr
            else delete value.progression
            onChange()
          }}
        />
      </label>
    </>
  )
}

function defaultSoundDoc(): SoundDoc {
  return { zzfx: [1, 0.05, 320, 0, 0.05, 0.08, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.7, 1, 0] }
}

function defaultMusicDoc(): MusicDoc {
  return { mood: 'спокойная', scale: 'минор', layers: ['пад-аккорды', 'бас'], seed: 1 }
}

// ─────────────── выбор источника (файл/ссылка ИЛИ синтез) ───────────────

function SourceEditor({
  store,
  value,
  onChange,
  dir,
  what,
}: {
  store: EditorStore
  value: SoundSource | MusicSource
  onChange: (v: SoundSource | MusicSource) => void
  dir: string
  what: 'звук' | 'музыка'
}) {
  const synth = sourceKind(value) === 'synth'
  return (
    <div className="src-editor">
      <div className="chips" style={{ marginBottom: 6 }}>
        <button type="button" className={`chip ${!synth ? 'chip-on' : ''}`} onClick={() => onChange('')}>
          Файл или ссылка
        </button>
        <button
          type="button"
          className={`chip ${synth ? 'chip-on' : ''}`}
          onClick={() => onChange(what === 'музыка' ? (defaultMusicDoc() as MusicSource) : (defaultSoundDoc() as SoundSource))}
        >
          Синтез из описания (без файлов)
        </button>
        <button
          type="button"
          className="chip"
          title="Прослушать, как звучит сейчас"
          onClick={() => {
            if (!value) return
            if (what === 'музыка') previewMusicSource(value as MusicSource)
            else playSource(value as SoundSource)
          }}
        >
          ▶ Прослушать
        </button>
      </div>
      {synth ? (
        isMusicDoc(value) ? (
          <MusicDocEditor value={value} onChange={() => onChange({ ...value })} />
        ) : (
          <SoundDocEditor value={value as SoundDoc} onChange={() => onChange({ ...(value as SoundDoc) })} />
        )
      ) : (
        <AssetUpload
          label={`${what === 'музыка' ? 'Аудиофайл' : 'Звуковой файл'} (mp3/ogg/wav) или ссылка`}
          value={typeof value === 'string' ? value : ''}
          dir={dir}
          store={store}
          kind="audio"
          onChange={(p) => onChange(p)}
        />
      )}
    </div>
  )
}

// ─────────────── выбор звука/трека из реестра (с ▶) ───────────────

function sorted<T extends { label: string }>(arr: T[] | undefined): T[] {
  return [...(arr ?? [])].sort((a, b) => a.label.localeCompare(b.label, 'ru'))
}

export function SoundSelect({
  store,
  value,
  onChange,
}: {
  store: EditorStore
  value: string | undefined
  onChange: (id: string | undefined) => void
}) {
  const sounds = sorted(store.meta.sounds)
  return (
    <span className="sound-select">
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)}>
        <option value="">— нет —</option>
        {sounds.map((s) => (
          <option key={s.id} value={s.id}>{s.label}</option>
        ))}
      </select>
      <button
        type="button"
        className="btn btn-small"
        title="Прослушать"
        disabled={!value}
        onClick={() => {
          const def = store.meta.sounds?.find((s) => s.id === value)
          if (!def) return
          const srcs = Array.isArray(def.src) ? def.src : [def.src]
          const src = srcs[Math.floor(Math.random() * srcs.length)]
          if (src) playSource(src)
        }}
      >
        ▶
      </button>
    </span>
  )
}

export function MusicTrackSelect({
  store,
  value,
  onChange,
}: {
  store: EditorStore
  value: string | undefined
  onChange: (id: string | undefined) => void
}) {
  const tracks = sorted(store.meta.music_tracks)
  return (
    <span className="sound-select">
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)}>
        <option value="">— нет —</option>
        {tracks.map((t) => (
          <option key={t.id} value={t.id}>{t.label}</option>
        ))}
      </select>
      <button
        type="button"
        className="btn btn-small"
        title="Прослушать"
        disabled={!value}
        onClick={() => {
          const t = store.meta.music_tracks?.find((x) => x.id === value)
          if (t) previewMusicSource(t.src, 0.9 * (t.volume ?? 1))
        }}
      >
        ▶
      </button>
    </span>
  )
}

export function MusicTrackMultiSelect({
  store,
  value,
  onChange,
}: {
  store: EditorStore
  value: string[]
  onChange: (ids: string[]) => void
}) {
  const tracks = sorted(store.meta.music_tracks)
  return (
    <div className="chips">
      {tracks.map((t) => {
        const on = value.includes(t.id)
        return (
          <span key={t.id} className={`chip ${on ? 'chip-on' : ''}`}>
            <button
              type="button"
              title={on ? 'Убрать из списка' : 'Добавить в список'}
              onClick={() => (on ? onChange(value.filter((x) => x !== t.id)) : onChange([...value, t.id]))}
            >
              {t.label}
            </button>
            <button type="button" className="chip-play" title="Прослушать" onClick={() => previewMusicSource(t.src, 0.9 * (t.volume ?? 1))}>
              ▶
            </button>
          </span>
        )
      })}
      {!tracks.length && <span className="muted small">Сначала добавьте треки в разделе «Музыка».</span>}
    </div>
  )
}

// ─────────────── карта звуков взаимодействий ───────────────

export function SoundHookMapEditor({
  store,
  value,
  onChange,
  title = 'Звуки действий',
}: {
  store: EditorStore
  value: SoundHookMap
  onChange: () => void
  title?: string
}) {
  return (
    <div className="fld fld-block">
      <span>{title}</span>
      <div className="muted small" style={{ marginBottom: 6 }}>
        Не заданные действия молчат или берут звук из более общего места (категория, тип слота, тема кампании).
      </div>
      {SOUND_HOOK_LABELS.map((h) => (
        <div key={h.id} className="settings-row" style={{ padding: '2px 0' }}>
          <span className="settings-label">{h.label}</span>
          <SoundSelect
            store={store}
            value={value[h.id]}
            onChange={(id) => {
              if (id) value[h.id] = id
              else delete value[h.id]
              onChange()
            }}
          />
        </div>
      ))}
    </div>
  )
}

// ─────────────── правила музыки «условия → треки» ───────────────

function condLabel(c: MusicCondition): string {
  const parts: string[] = []
  if (c.time_of_day) {
    const t = Array.isArray(c.time_of_day) ? c.time_of_day : [c.time_of_day]
    parts.push(t.map((x) => TOD_LABELS[x]).join('/'))
  }
  if (c.flag) parts.push(`флаг «${c.flag}»`)
  if (c.not_flag) parts.push(`нет флага «${c.not_flag}»`)
  return parts.join(', ') || 'всегда'
}

export function MusicRulesEditor({
  store,
  value,
  onChange,
  title,
}: {
  store: EditorStore
  value: MusicRule[]
  onChange: () => void
  title: string
}) {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <div className="fld fld-block">
      <span>{title}</span>
      <div className="muted small" style={{ marginBottom: 6 }}>
        Правила сверху вниз: играет первое подходящее под условия (время суток, флаги).
        Несколько треков в записи — плейлист со сменой и кроссфейдом.
      </div>
      {value.map((rule, i) => (
        <div key={i} className="need-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
          <div className="fld-row" style={{ alignItems: 'center' }}>
            <button type="button" className="btn btn-small" onClick={() => setOpen(open === i ? null : i)}>
              {open === i ? '▾' : '▸'} {i + 1}. {rule.tracks.length ? `${rule.tracks.length} трек(ов)` : 'треки не выбраны'}
              {rule.conditions?.length ? ` — ${rule.conditions.map(condLabel).join('; ')}` : ''}
            </button>
            <label className="fld-check small">
              <input
                type="checkbox"
                checked={!!rule.shuffle}
                onChange={(e) => {
                  rule.shuffle = e.target.checked || undefined
                  onChange()
                }}
              />
              <span>вперемешку</span>
            </label>
            <button className="btn btn-small" title="Поднять" disabled={i === 0} onClick={() => {
              ;[value[i - 1], value[i]] = [value[i], value[i - 1]]
              onChange()
            }}>↑</button>
            <button className="btn btn-small" title="Опустить" disabled={i === value.length - 1} onClick={() => {
              ;[value[i + 1], value[i]] = [value[i], value[i + 1]]
              onChange()
            }}>↓</button>
            <button className="btn btn-small ce-del" title="Удалить правило" onClick={() => {
              value.splice(i, 1)
              onChange()
            }}>✕</button>
          </div>
          {open === i && (
            <div style={{ padding: '4px 0 8px' }}>
              <div className="fld fld-block">
                <span>Треки</span>
                <MusicTrackMultiSelect store={store} value={rule.tracks} onChange={(ids) => {
                  rule.tracks = ids
                  onChange()
                }} />
              </div>
              <div className="fld fld-block">
                <span>Условия (все вместе; пусто — всегда)</span>
                {(rule.conditions ?? []).map((c, ci) => (
                  <div key={ci} className="fld-row">
                    <label className="fld">
                      <span>Время суток</span>
                      <select
                        value={Array.isArray(c.time_of_day) ? c.time_of_day[0] : c.time_of_day ?? ''}
                        onChange={(e) => {
                          if (e.target.value) c.time_of_day = e.target.value as TimeOfDay
                          else delete c.time_of_day
                          onChange()
                        }}
                      >
                        <option value="">любое</option>
                        {TOD.map((t) => (
                          <option key={t} value={t}>{TOD_LABELS[t]}</option>
                        ))}
                      </select>
                    </label>
                    <FlagSelect
                      label="Флаг установлен"
                      store={store}
                      value={c.flag ?? ''}
                      optional
                      onChange={(f) => {
                        if (f) c.flag = f
                        else delete c.flag
                        onChange()
                      }}
                    />
                    <FlagSelect
                      label="Флаг не установлен"
                      store={store}
                      value={c.not_flag ?? ''}
                      optional
                      onChange={(f) => {
                        if (f) c.not_flag = f
                        else delete c.not_flag
                        onChange()
                      }}
                    />
                    <button className="btn btn-small ce-del" title="Убрать условие" onClick={() => {
                      rule.conditions!.splice(ci, 1)
                      if (!rule.conditions!.length) delete rule.conditions
                      onChange()
                    }}>✕</button>
                  </div>
                ))}
                <button
                  className="btn btn-small"
                  onClick={() => {
                    if (!rule.conditions) rule.conditions = []
                    rule.conditions.push({})
                    onChange()
                  }}
                >
                  + условие
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
      <button
        className="btn btn-small"
        onClick={() => {
          value.push({ tracks: [] })
          setOpen(value.length - 1)
          onChange()
        }}
      >
        + правило «условия → треки»
      </button>
    </div>
  )
}

/** у локации музыка может быть легаси-строкой — приводим к правилам */
export function musicRulesOf(value: string | MusicRule[] | undefined): MusicRule[] {
  if (!value) return []
  if (typeof value === 'string') return value ? [{ tracks: [value] }] : []
  return value
}

// ─────────────── реестры «Звук и музыка» (раздел кампании) ───────────────

export function AudioRegistries({ store }: { store: EditorStore }) {
  const m = store.meta
  const [, force] = useState(0)
  const commit = () => {
    store.touch('campaign.json')
    force((n) => n + 1)
  }
  const [openTrack, setOpenTrack] = useState<string | null>(null)
  const [openSound, setOpenSound] = useState<string | null>(null)

  const srcs = (s: SoundDef): SoundSource[] => (Array.isArray(s.src) ? s.src : s.src ? [s.src] : [])

  return (
    <>
      <div className="props-group">
        <h4>🎵 Музыка</h4>
        <div className="muted small" style={{ marginBottom: 8 }}>
          Треки — файлы кампании, внешние ссылки или синтез из описания (звучит без файлов).
          Назначать треки можно у локаций и сцен, в катсценах и для боя.
        </div>
        {(m.music_tracks ?? []).map((t, i) => (
          <div key={t.id} className="need-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
            <div className="fld-row" style={{ alignItems: 'center' }}>
              <button type="button" className="btn btn-small" onClick={() => setOpenTrack(openTrack === t.id ? null : t.id)}>
                {openTrack === t.id ? '▾' : '▸'} {t.label || 'Трек без названия'}
              </button>
              <button type="button" className="btn btn-small" title="Прослушать" onClick={() => previewMusicSource(t.src, 0.9 * (t.volume ?? 1))}>▶</button>
              <button className="btn btn-small ce-del" title="Удалить трек (назначения станут пустыми)" onClick={() => {
                m.music_tracks!.splice(i, 1)
                commit()
              }}>✕</button>
            </div>
            {openTrack === t.id && (
              <div style={{ padding: '4px 0 10px' }}>
                <div className="fld-row">
                  <label className="fld">
                    <span>Название</span>
                    <input value={t.label} onChange={(e) => ((t.label = e.target.value), commit())} />
                  </label>
                  <label className="fld">
                    <span>Громкость (0…1)</span>
                    <input
                      type="number"
                      step="0.05"
                      min={0}
                      max={1}
                      value={t.volume ?? 1}
                      onChange={(e) => {
                        t.volume = Math.max(0, Math.min(1, Number(e.target.value)))
                        commit()
                      }}
                    />
                  </label>
                  <label className="fld-check" title="Один трек — зациклить; в плейлисте из нескольких треков играют по очереди">
                    <input
                      type="checkbox"
                      checked={t.loop !== false}
                      onChange={(e) => {
                        t.loop = e.target.checked
                        commit()
                      }}
                    />
                    <span>зациклить</span>
                  </label>
                </div>
                <SourceEditor
                  store={store}
                  what="музыка"
                  dir="assets/audio/music"
                  value={t.src}
                  onChange={(v) => {
                    t.src = v as MusicSource
                    commit()
                  }}
                />
              </div>
            )}
          </div>
        ))}
        <button
          className="btn btn-small"
          onClick={async () => {
            const label = await askText('Название трека', 'например «Таверна вечером»')
            if (!label) return
            if (!m.music_tracks) m.music_tracks = []
            const id = makeId('track_', label, m.music_tracks.map((x) => x.id))
            m.music_tracks.push({ id, label, src: '', loop: true })
            setOpenTrack(id)
            commit()
          }}
        >
          + трек
        </button>

        <div style={{ marginTop: 12 }}>
          <div className="settings-row">
            <span className="settings-label">Музыка в главном меню</span>
            <MusicTrackSelect
              store={store}
              value={m.ui_sounds?.['menu_music']}
              onChange={(id) => {
                if (!m.ui_sounds) m.ui_sounds = {}
                if (id) m.ui_sounds['menu_music'] = id
                else delete m.ui_sounds['menu_music']
                commit()
              }}
            />
          </div>
        </div>
        <div className="fld fld-block">
          <span>Музыка по умолчанию (когда локация/сцена молчит)</span>
          <MusicTrackMultiSelect store={store} value={m.default_music ?? []} onChange={(ids) => {
            m.default_music = ids
            commit()
          }} />
        </div>
        <div className="fld fld-block">
          <span>Музыка боя (если у арены не задана своя)</span>
          <MusicTrackMultiSelect store={store} value={m.combat_music ?? []} onChange={(ids) => {
            m.combat_music = ids
            commit()
          }} />
        </div>
      </div>

      <div className="props-group">
        <h4>🔊 Звуки</h4>
        <div className="muted small" style={{ marginBottom: 8 }}>
          Короткие эффекты: файлы, ссылки или синтез. Под одним названием может быть
          несколько вариантов — каждый раз сыграет случайный (три скрипа двери).
        </div>
        {(m.sounds ?? []).map((s, i) => (
          <div key={s.id} className="need-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
            <div className="fld-row" style={{ alignItems: 'center' }}>
              <button type="button" className="btn btn-small" onClick={() => setOpenSound(openSound === s.id ? null : s.id)}>
                {openSound === s.id ? '▾' : '▸'} {s.label || 'Звук без названия'}
                {srcs(s).length > 1 ? ` (${srcs(s).length} варианта)` : ''}
              </button>
              <button
                type="button"
                className="btn btn-small"
                title="Прослушать случайный вариант"
                onClick={() => {
                  const arr = srcs(s)
                  const src = arr[Math.floor(Math.random() * arr.length)]
                  if (src) playSource(src)
                }}
              >
                ▶
              </button>
              <button className="btn btn-small ce-del" title="Удалить звук (назначения станут пустыми)" onClick={() => {
                m.sounds!.splice(i, 1)
                commit()
              }}>✕</button>
            </div>
            {openSound === s.id && (
              <div style={{ padding: '4px 0 10px' }}>
                <label className="fld">
                  <span>Название</span>
                  <input value={s.label} onChange={(e) => ((s.label = e.target.value), commit())} />
                </label>
                {srcs(s).map((src, vi) => (
                  <div key={vi} className="src-variant">
                    <div className="fld-row" style={{ alignItems: 'center' }}>
                      <strong>Вариант {vi + 1}</strong>
                      {srcs(s).length > 1 && (
                        <button
                          className="btn btn-small ce-del"
                          title="Убрать вариант"
                          onClick={() => {
                            const arr = srcs(s)
                            arr.splice(vi, 1)
                            s.src = arr.length === 1 ? arr[0] : arr
                            commit()
                          }}
                        >
                          ✕ вариант
                        </button>
                      )}
                    </div>
                    <SourceEditor
                      store={store}
                      what="звук"
                      dir="assets/audio/sfx"
                      value={src}
                      onChange={(v) => {
                        const arr = srcs(s)
                        arr[vi] = v as SoundSource
                        s.src = arr.length === 1 ? arr[0] : arr
                        commit()
                      }}
                    />
                  </div>
                ))}
                <button
                  className="btn btn-small"
                  onClick={() => {
                    const arr = srcs(s)
                    arr.push('')
                    s.src = arr.length === 1 ? arr[0] : arr
                    commit()
                  }}
                >
                  + вариант (случайный выбор при воспроизведении)
                </button>
              </div>
            )}
          </div>
        ))}
        <button
          className="btn btn-small"
          onClick={async () => {
            const label = await askText('Название звука', 'например «Скрип двери»')
            if (!label) return
            if (!m.sounds) m.sounds = []
            const id = makeId('snd_', label, m.sounds.map((x) => x.id))
            m.sounds.push({ id, label, src: '' })
            setOpenSound(id)
            commit()
          }}
        >
          + звук
        </button>
      </div>

      <div className="props-group">
        <h4>🎧 Тема интерфейса</h4>
        <div className="muted small" style={{ marginBottom: 8 }}>
          Какие звуки сопровождают действия игрока: кнопки, панели, бой, квесты, дорога.
          Не заданные события молчат.
        </div>
        {UI_HOOK_LABELS.filter((h) => h.id !== 'menu_music').map((h) => (
          <div key={h.id} className="settings-row" style={{ padding: '2px 0' }}>
            <span className="settings-label">{h.label}</span>
            <SoundSelect
              store={store}
              value={m.ui_sounds?.[h.id]}
              onChange={(id) => {
                if (!m.ui_sounds) m.ui_sounds = {}
                if (id) m.ui_sounds[h.id] = id
                else delete m.ui_sounds[h.id]
                commit()
              }}
            />
          </div>
        ))}
      </div>
    </>
  )
}
