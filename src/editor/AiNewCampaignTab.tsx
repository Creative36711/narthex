/**
 * Вкладка «Создать новую кампанию» мастера ИИ: анкета замысла и назначенный ID.
 *
 * Вынесено из `AiWizard.tsx` вместе со справочниками жанров, тональностей и
 * масштабов: это самостоятельный экран с собственным набором полей, а мастер
 * оставляет за собой вкладку задания и сборку промпта.
 */

import { Ico } from '../shared/icons'

export const GENRES = ['Фэнтези', 'Киберпанк', 'Хоррор', 'Постапок', 'Детектив', 'Приключение', 'Своя тема']
export const TONES = ['мрачный', 'героический', 'ироничный', 'эпичный', 'спокойный', 'без пафоса']
export const SCALES: Array<{ id: string; label: string; hint: string }> = [
  { id: 'small', label: 'Малая', hint: 'около 3 локаций, 3 персонажей, 1 главный квест' },
  { id: 'medium', label: 'Средняя', hint: 'около 6 локаций, 6 персонажей, 1 главный + 2 побочных квеста' },
  { id: 'big', label: 'Большая', hint: '10+ локаций, 10+ персонажей, сеть главных и побочных квестов' },
  { id: 'any', label: 'На усмотрение ИИ', hint: 'мастер доверяет выбору масштаба' },
]

export interface AiNewCampaignForm {
  genre: string
  genreText: string
  tone: string
  scale: string
  battle: number | null
  accents: Record<string, boolean>
  must: string
  mustNot: string
  idea: string
}

interface Props {
  form: AiNewCampaignForm
  assignedId: string
  busy: boolean
  onGenre: (value: string) => void
  onGenreText: (value: string) => void
  onTone: (value: string) => void
  onScale: (value: string) => void
  onBattle: (value: number | null) => void
  onToggleAccent: (key: string) => void
  onMust: (value: string) => void
  onMustNot: (value: string) => void
  onIdea: (value: string) => void
  onDownload: () => void
  onCopyPrompt: () => void
}

export function AiNewCampaignTab(props: Props) {
  const { form, assignedId, busy } = props
  return (
    <div className="ai-new-section">
        <div className="fld fld-block">
          <span>Сеттинг / жанр</span>
          <div className="chips">
            {GENRES.map((value) => (
              <button
                key={value}
                type="button"
                className={`chip ${form.genre === value ? 'chip-on' : ''}`}
                onClick={() => props.onGenre(form.genre === value ? '' : value)}
              >
                {value}
              </button>
            ))}
          </div>
          {form.genre === 'Своя тема' && (
            <input
              type="text"
              value={form.genreText}
              onChange={(e) => props.onGenreText(e.target.value)}
              placeholder="Укажите жанр или сеттинг…"
            />
          )}
        </div>

        <div className="fld fld-block">
          <span>Тональность</span>
          <div className="chips">
            {TONES.map((value) => (
              <button
                key={value}
                type="button"
                className={`chip ${form.tone === value ? 'chip-on' : ''}`}
                onClick={() => props.onTone(form.tone === value ? '' : value)}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        <div className="fld fld-block">
          <span>Масштаб кампании</span>
          <div className="chips">
            {SCALES.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`chip ${form.scale === item.id ? 'chip-on' : ''}`}
                onClick={() => props.onScale(form.scale === item.id ? '' : item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="fld fld-block">
          <span>Акценты механик</span>
          <div className="chips">
            {['выживание', 'торговля', 'напарники'].map((key) => (
              <button
                key={key}
                type="button"
                className={`chip ${form.accents[key] ? 'chip-on' : ''}`}
                onClick={() => props.onToggleAccent(key)}
              >
                {key}
              </button>
            ))}
          </div>
        </div>

        <div className="fld fld-block">
          <span>Основная задумка / завязка</span>
          <textarea
            value={form.idea}
            onChange={(e) => props.onIdea(e.target.value)}
            placeholder="О чём история, кто главный герой, с чего начинается приключение…"
          />
        </div>

        <div className="fld fld-block">
          <span>Соотношение диалогов и боёвки (необязательно)</span>
          <label className="settings-row ai-optional-toggle">
            <input
              type="checkbox"
              checked={form.battle !== null}
              onChange={(event) => props.onBattle(event.target.checked ? 50 : null)}
            />
            <span>Задать соотношение</span>
          </label>
          {form.battle !== null && (
            <label className="settings-row ai-battle-range" style={{ gap: 10 }}>
              <span className="muted small">диалоги</span>
              <input
                aria-label="Соотношение диалогов и боёвки"
                type="range"
                min={0}
                max={100}
                value={form.battle ?? 0}
                onChange={(event) => props.onBattle(Number(event.target.value))}
                style={{ flex: 1 }}
              />
              <span className="muted small">боёвка</span>
              <b className="muted small">{form.battle}%</b>
            </label>
          )}
        </div>

        <div className="fld fld-block">
          <span>Обязательно включить (необязательно)</span>
          <input
            type="text"
            value={form.must}
            onChange={(e) => props.onMust(e.target.value)}
            placeholder="Особые элементы, локации, персонажи или механики…"
          />
        </div>

        <div className="fld fld-block">
          <span>Исключить / запретить (необязательно)</span>
          <input
            type="text"
            value={form.mustNot}
            onChange={(e) => props.onMustNot(e.target.value)}
            placeholder="Чего точно не должно быть в кампании…"
          />
        </div>

        <div className="fld fld-block">
          <span>Назначенный ID кампании: <code>{assignedId}</code></span>
          <span className="muted small">ИИ сохранит этот ID в campaign.json для однозначной привязки.</span>
        </div>

        <div className="ai-main-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={props.onDownload}
            disabled={busy}
          >
            <Ico n="download" /> Скачать стартовое задание
          </button>
          <button
            type="button"
            className="btn"
            onClick={props.onCopyPrompt}
          >
            <Ico n="sparkle" /> Скопировать стартовый промпт
          </button>
        </div>
    </div>
  )
}
