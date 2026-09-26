/**
 * «✨ Кампания с ИИ» (фидбек 9.14): мастер собирает творческий бриф и
 * склеивает готовый промпт = [технический контракт] + [жёсткие требования] +
 * [свободное описание]. Мастер вставляет промпт в ЛЮБОЙ ИИ (чат) и полученный
 * JSON импортирует через «Импорт из JSON»; отчёт предупреждений импорта
 * копируется кнопкой «Скопировать отчёт для ИИ» — цикл исправлений 2–3 круга.
 *
 * Анкета — не клетка: все поля необязательны, свободное поле главное.
 */
import { useState } from 'react'
import guideRaw from '../../docs/ai-campaign-guide.md?raw'
import { Ico } from '../shared/icons'
import { buildAiCampaignPrompt } from './aiPrompt'

const GENRES = ['Фэнтези', 'Киберпанк', 'Хоррор', 'Постапок', 'Детектив', 'Приключение', 'Своя тема']
const TONES = ['мрачный', 'героический', 'ироничный', 'эпичный', 'спокойный', 'без пафоса']
const SCALES: Array<{ id: string; label: string; hint: string }> = [
  { id: 'small', label: 'Малая', hint: 'около 3 локаций, 3 персонажей, 1 главный квест' },
  { id: 'medium', label: 'Средняя', hint: 'около 6 локаций, 6 персонажей, 1 главный + 2 побочных квеста' },
  { id: 'big', label: 'Большая', hint: '10+ локаций, 10+ персонажей, сеть главных и побочных квестов' },
  { id: 'any', label: 'На усмотрение ИИ', hint: 'мастер доверяет выбору масштаба' },
]

export function AiWizard({ onClose }: { onClose: () => void }) {
  const [genre, setGenre] = useState('')
  const [genreText, setGenreText] = useState('')
  const [tone, setTone] = useState('')
  const [scale, setScale] = useState('medium')
  const [battle, setBattle] = useState(50) // 0 — только диалоги, 100 — только боёвка
  const [accents, setAccents] = useState<Record<string, boolean>>({})
  const [must, setMust] = useState('')
  const [mustNot, setMustNot] = useState('')
  const [idea, setIdea] = useState('')
  const [copyState, setCopyState] = useState<'ok' | 'fail' | null>(null)

  const buildPrompt = (): string => {
    const accList: string[] = []
    if (battle <= 20) accList.push('акцент на диалоги и истории, боёвки мало или нет')
    else if (battle >= 80) accList.push('акцент на боёвку и тактику, диалогов минимум')
    else accList.push('баланс боёвки и диалогов')
    if (accents['выживание']) accList.push('есть выживание (потребности: еда, тепло и т.п.)')
    if (accents['торговля']) accList.push('есть торговля и экономика')
    if (accents['напарники']) accList.push('есть напарники и отряд')
    const genreLine = [genre && genre !== 'Своя тема' ? genre : '', genreText].filter(Boolean).join(' — ')
    const scaleHint = SCALES.find((s) => s.id === scale)?.hint ?? ''
    return buildAiCampaignPrompt({
      genre: genreLine,
      tone,
      scale: scaleHint,
      accents: accList,
      must,
      mustNot,
      idea,
    }, guideRaw)
  }

  const copy = async () => {
    const text = buildPrompt()
    let ok = false
    try {
      await navigator.clipboard.writeText(text)
      ok = true
    } catch {
      // фолбэк без Clipboard API: скрытое поле + execCommand
      try {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        ok = document.execCommand('copy')
        ta.remove()
      } catch {
        ok = false
      }
    }
    setCopyState(ok ? 'ok' : 'fail')
    setTimeout(() => setCopyState(null), 5000)
  }

  const toggle = (k: string) => setAccents((a) => ({ ...a, [k]: !a[k] }))

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box ai-wizard" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title"><Ico n="sparkle" /> Кампания с ИИ</div>
        <div className="modal-body">
          Ответьте на вопросы (все необязательны) или просто опишите идею — и скопируйте
          готовый промпт. Вставьте его в любой ИИ (ChatGPT, Claude, DeepSeek, локальную модель),
          а полученный JSON импортируйте кнопкой «Импорт из JSON». Если импорт выдаст
          предупреждения — скопируйте отчёт для ИИ и попросите исправить: 2–3 круга — и кампания чистая.
        </div>

        <div className="fld fld-block">
          <span>Сеттинг / жанр</span>
          <div className="chips">
            {GENRES.map((g) => (
              <button key={g} type="button" className={`chip ${genre === g ? 'chip-on' : ''}`} onClick={() => setGenre(genre === g ? '' : g)}>
                {g}
              </button>
            ))}
          </div>
          <input
            style={{ marginTop: 6 }}
            value={genreText}
            placeholder="уточните своими словами: «нуарный киберпанк в тропическом мегаполисе»"
            onChange={(e) => setGenreText(e.target.value)}
          />
        </div>

        <div className="fld-row">
          <label className="fld">
            <span>Тон</span>
            <select value={tone} onChange={(e) => setTone(e.target.value)}>
              <option value="">— любой —</option>
              {TONES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="fld">
            <span>Масштаб</span>
            <select value={scale} onChange={(e) => setScale(e.target.value)}>
              {SCALES.map((s) => (
                <option key={s.id} value={s.id}>{s.label} — {s.hint}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="fld fld-block">
          <span>Акценты</span>
          <label className="settings-row" style={{ gap: 10 }}>
            <span className="muted small">диалоги</span>
            <input type="range" min={0} max={100} value={battle} onChange={(e) => setBattle(Number(e.target.value))} style={{ flex: 1 }} />
            <span className="muted small">боёвка</span>
          </label>
          <div className="chips">
            {['выживание', 'торговля', 'напарники'].map((k) => (
              <button key={k} type="button" className={`chip ${accents[k] ? 'chip-on' : ''}`} onClick={() => toggle(k)}>
                {k}
              </button>
            ))}
          </div>
        </div>

        <div className="fld-row">
          <label className="fld">
            <span>Обязательно должно быть</span>
            <input value={must} placeholder="«финал с моральным выбором»" onChange={(e) => setMust(e.target.value)} />
          </label>
          <label className="fld">
            <span>Чего быть не должно</span>
            <input value={mustNot} placeholder="«никакой магии»" onChange={(e) => setMustNot(e.target.value)} />
          </label>
        </div>

        <label className="fld fld-block">
          <span>Опишите идею своими словами (главное поле — хоть три абзаца)</span>
          <textarea className="modal-textarea" rows={6} value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="О чём кампания, кто герой, чем всё кончается, чего боитесь переборщить…" />
        </label>
        <div className="modal-buttons" onClick={(e) => e.stopPropagation()}>
          <span className={`copy-status ${copyState ?? ''}`}>
            {copyState === 'ok'
              ? 'Промпт скопирован в буфер обмена — вставьте его в чат с ИИ'
              : copyState === 'fail'
                ? 'Не удалось скопировать — выделите текст и скопируйте вручную'
                : ''}
          </span>
          <button className="btn" onClick={onClose}>Закрыть</button>
          <button className="btn btn-primary" onClick={copy}>Скопировать промпт</button>
        </div>
      </div>
    </div>
  )
}

/** отчёт импорта для ИИ: «исправь следующие проблемы» (цикл исправлений) */
export function aiFixReport(warns: string[]): string {
  return [
    'Исправь в этом JSON кампании для движка Chronicle Forge следующие проблемы импорта',
    'и выведи исправленный JSON целиком (только JSON, без пояснений):',
    ...warns.map((w, i) => `${i + 1}. ${w}`),
  ].join('\n')
}
