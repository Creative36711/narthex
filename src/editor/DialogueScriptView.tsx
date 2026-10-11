import { useEffect, useMemo, useRef, useState } from 'react'
import { Ico } from '../shared/icons'
import { askConfirm } from './prompt'
import { SCRIPT_HELP, exampleScript, type ScriptIssue } from './dlgScript'
import type { DlgDoc } from '../shared/types'

/**
 * Мастерский сценарий разговора (фидбек 29): мастер пишет текст словами,
 * редактор собирает из него структуру конструктора и ink.
 *
 * Здесь только ввод и подсказки: разбор делает DialogueBuilder (он же хранит
 * документ и генерирует ink). Ошибки показываются строками — щелчок по ошибке
 * ставит курсор на виновную строку.
 */
export function DialogueScriptView({
  doc,
  value,
  issues,
  onText,
  onPlaytest,
}: {
  doc: DlgDoc
  value: string
  issues: ScriptIssue[]
  onText: (text: string) => void
  onPlaytest: () => void
}) {
  const area = useRef<HTMLTextAreaElement | null>(null)
  const gutter = useRef<HTMLDivElement | null>(null)
  const [help, setHelp] = useState(false)
  const errors = issues.filter((i) => i.severity === 'error')
  const warns = issues.filter((i) => i.severity === 'warning')
  const lines = useMemo(() => value.split('\n').length, [value])

  // у длинных разговоров держим подсказку сверху, а не в конце страницы
  useEffect(() => {
    const el = area.current
    if (!el) return
    const onScroll = () => {
      if (gutter.current) gutter.current.scrollTop = el.scrollTop
    }
    el.addEventListener('scroll', onScroll)
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  const gotoLine = (line: number) => {
    const el = area.current
    if (!el) return
    const text = el.value
    const starts = [0]
    for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1)
    const from = starts[Math.min(line - 1, starts.length - 1)] ?? 0
    const to = starts[Math.min(line, starts.length - 1)] ?? text.length
    el.focus()
    el.setSelectionRange(from, to)
    const lineHeight = 21
    el.scrollTop = Math.max(0, (line - 1) * lineHeight - el.clientHeight / 3)
  }

  const insertExample = async () => {
    if (value.trim() && !(await askConfirm('Заменить текст сценария примером?', 'Заменить'))) return
    onText(exampleScript())
  }

  return (
    <div className="dlg-script">
      <div className="dlg-script-bar">
        <button className="btn btn-small" onClick={onPlaytest} data-tip="Пройти этот разговор в редакторе: видно реплики, варианты и переходы">
          <Ico n="play" /> Проверить разговор
        </button>
        <button className={`btn btn-small ${help ? 'btn-primary' : ''}`} onClick={() => setHelp((v) => !v)}>
          <Ico n="info" /> Шпаргалка
        </button>
        <button className="btn btn-small" onClick={insertExample} data-tip="Небольшой разговор со всеми приёмами: реплики, ремарки, условие, вариант, предмет">
          Показать пример
        </button>
        <span className="muted small dlg-script-status">
          {errors.length ? `${errors.length} ошибк(и) — текст сохранён, но пока не собран` : warns.length ? `${warns.length} замечание(й)` : 'текст собран без замечаний'}
        </span>
      </div>

      {help && (
        <div className="dlg-script-help">
          <div className="muted small" style={{ marginBottom: 6 }}>
            Пишите как в сценарии: строка — реплика собеседника. Всё остальное помечается
            началом строки. Названия берутся из реестров кампании — id и ink не нужны.
          </div>
          <div className="dlg-script-help-grid">
            {SCRIPT_HELP.map((h) => (
              <div key={h.code} className="dlg-script-help-row">
                <code>{h.code}</code>
                <span className="muted small">{h.hint}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="dlg-script-editor">
        <div className="dlg-script-gutter" ref={gutter} aria-hidden>
          {Array.from({ length: lines }, (_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
        <textarea
          ref={area}
          value={value}
          spellCheck
          onChange={(e) => onText(e.target.value)}
          onKeyDown={(e) => {
            // Tab — отступ, как в текстовом редакторе (варианты удобно держать с отступом)
            if (e.key !== 'Tab') return
            e.preventDefault()
            const el = e.currentTarget
            const from = el.selectionStart
            const to = el.selectionEnd
            const next = `${value.slice(0, from)}    ${value.slice(to)}`
            onText(next)
            requestAnimationFrame(() => el.setSelectionRange(from + 4, from + 4))
          }}
          aria-label="Мастерский сценарий разговора"
        />
      </div>

      {(errors.length > 0 || warns.length > 0) && (
        <div className="dlg-script-issues">
          {errors.map((iss, i) => (
            <button key={`e${i}`} className="dlg-issue err" onClick={() => gotoLine(iss.line)}>
              <b>Строка {iss.line}:</b> {iss.message}
              {iss.text ? <span className="muted small"> — «{iss.text}»</span> : null}
            </button>
          ))}
          {warns.map((iss, i) => (
            <button key={`w${i}`} className="dlg-issue warn" onClick={() => iss.line > 0 && gotoLine(iss.line)}>
              <b>{iss.line > 0 ? `Строка ${iss.line}:` : 'Замечание:'}</b> {iss.message}
            </button>
          ))}
        </div>
      )}

      <div className="muted small dlg-script-foot">
        Разговор: {doc.nodes.length} узл(ов), {doc.nodes.reduce((n, x) => n + x.choices.length, 0)} вариант(ов).
        Тот же документ открыт и в «Конструкторе» — формы пересоберут этот текст, поэтому
        правьте в том виде, который удобнее.
      </div>
    </div>
  )
}
