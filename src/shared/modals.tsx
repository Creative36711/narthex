import { useEffect, useRef, useState } from 'react'
import { groupIssues, groupNote } from './issueReport'

/**
 * Стилизованные диалоги вместо браузерных prompt()/confirm()/alert()
 * (фидбек: никаких системных окон ни в игре, ни в редакторе).
 * ModalHost монтируется один раз в корне (App и EditorApp).
 */

type ModalRequest =
  | { kind: 'text'; title: string; placeholder?: string; initial?: string; ok: string; resolve: (v: string | null) => void }
  | {
      kind: 'textarea'
      title: string
      body?: string
      placeholder?: string
      initial?: string
      ok: string
      fileLabel: string
      resolve: (v: string | null) => void
    }
  | { kind: 'confirm'; title: string; ok: string; cancel: string; checkLabel?: string; resolve: (v: boolean) => void }
  | { kind: 'alert'; title: string; body?: string; resolve: () => void }
  | {
      kind: 'list'
      title: string
      body?: string
      items: string[]
      /** кнопка «скопировать» (например, отчёт для ИИ-генератора, фидбек 9.14) */
      copy?: { label: string; text: string }
      resolve: () => void
    }

let pushRequest: ((r: ModalRequest) => void) | null = null
const queue: ModalRequest[] = []

function submit(r: ModalRequest) {
  if (pushRequest) pushRequest(r)
  else queue.push(r)
}

/** Запрос строки (замена prompt()). ok — подпись кнопки подтверждения. */
export function askText(title: string, placeholder = '', initial = '', ok = 'Создать'): Promise<string | null> {
  return new Promise((resolve) => submit({ kind: 'text', title, placeholder, initial, ok, resolve }))
}

/**
 * Запрос большого текста (замена prompt() для многострочного ввода):
 * файл ИЛИ вставленный текст. Кнопка «Выбрать файл…» читает файл в поле.
 */
export function askTextArea(
  title: string,
  opts: { body?: string; placeholder?: string; initial?: string; ok?: string; fileLabel?: string } = {},
): Promise<string | null> {
  return new Promise((resolve) =>
    submit({
      kind: 'textarea',
      title,
      body: opts.body,
      placeholder: opts.placeholder,
      initial: opts.initial,
      ok: opts.ok ?? 'Продолжить',
      fileLabel: opts.fileLabel ?? 'Выбрать файл…',
      resolve,
    }),
  )
}

/** Запрос подтверждения (замена confirm()). */
export function askConfirm(title: string, ok = 'Да', cancel = 'Отмена'): Promise<boolean> {
  return new Promise((resolve) => submit({ kind: 'confirm', title, ok, cancel, resolve }))
}

let lastChecked = false

/**
 * Подтверждение с галочкой (например «вшить внешние ссылки в пакет»):
 * возвращает и ответ, и состояние галочки.
 */
export function askChecked(
  title: string,
  checkLabel: string,
  ok = 'Да',
  cancel = 'Отмена',
): Promise<{ ok: boolean; checked: boolean }> {
  lastChecked = false
  return new Promise((resolve) =>
    submit({
      kind: 'confirm',
      title,
      ok,
      cancel,
      checkLabel,
      resolve: (v: boolean) => resolve({ ok: v, checked: lastChecked }),
    }),
  )
}

/** Сообщение (замена alert()). */
export function showAlert(title: string, body?: string): Promise<void> {
  return new Promise((resolve) => submit({ kind: 'alert', title, body, resolve }))
}

/**
 * Сообщение со списком (отчёт валидации/импорта): длинные перечни удобнее
 * читать построчно, а не в сплошном тексте.
 */
export function showList(
  title: string,
  items: string[],
  body?: string,
  copy?: { label: string; text: string },
): Promise<void> {
  // 30 одинаковых строк мастер не прочитает: повторы схлопываем в сводку
  const grouped = groupIssues(items)
  const note = groupNote(grouped)
  const text = [body, note].filter(Boolean).join('\n')
  // кнопка «скопировать» отдаёт готовый текст как есть (отчёт для ИИ уже
  // собран целиком на месте вызова — дублировать строки нельзя)
  const full = copy
  return new Promise((resolve) =>
    submit({ kind: 'list', title, body: text || undefined, items: grouped.lines, copy: full, resolve }),
  )
}

export function ModalHost() {
  const [req, setReq] = useState<ModalRequest | null>(null)
  const [value, setValue] = useState('')
  const [checked, setChecked] = useState(false)
  const [copied, setCopied] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const okRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    pushRequest = (r) => {
      setReq((cur) => {
        if (cur) {
          queue.push(r)
          return cur
        }
        if (r.kind === 'text') setValue(r.initial ?? '')
        if (r.kind === 'textarea') setValue(r.initial ?? '')
        if (r.kind === 'confirm') setChecked(false)
        return r
      })
    }
    if (queue.length > 0) {
      const r = queue.shift()!
      if (r.kind === 'text') setValue(r.initial ?? '')
      if (r.kind === 'textarea') setValue(r.initial ?? '')
      if (r.kind === 'confirm') setChecked(false)
      setReq(r)
    }
    return () => {
      pushRequest = null
    }
  }, [])

  useEffect(() => {
    if (!req) return
    if (req.kind === 'text') inputRef.current?.focus()
    else if (req.kind === 'textarea') areaRef.current?.focus()
    else okRef.current?.focus()
  }, [req])

  if (!req) return null

  const close = () => {
    const next = queue.shift() ?? null
    if (next?.kind === 'text') setValue(next.initial ?? '')
    if (next?.kind === 'textarea') setValue(next.initial ?? '')
    setReq(next)
  }
  const cancel = () => {
    lastChecked = checked
    if (req.kind === 'text' || req.kind === 'textarea') req.resolve(null)
    else if (req.kind === 'confirm') req.resolve(false)
    else req.resolve()
    close()
  }
  const confirm = () => {
    lastChecked = checked
    if (req.kind === 'text') {
      if (!value.trim()) return
      req.resolve(value.trim())
    } else if (req.kind === 'textarea') {
      if (!value.trim()) return
      req.resolve(value)
    } else if (req.kind === 'confirm') req.resolve(true)
    else req.resolve()
    close()
  }

  return (
    <div className="modal-overlay" onClick={cancel}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.key === 'Escape' && cancel()}>
        <div className="modal-title">{req.title}</div>
        {req.kind === 'alert' && req.body && <div className="modal-body">{req.body}</div>}
        {req.kind === 'list' && (
          <>
            {req.body && <div className="modal-body">{req.body}</div>}
            <ul className="modal-list">
              {req.items.map((it, i) => (
                <li key={i}>{it}</li>
              ))}
            </ul>
            {req.copy && (
              <div className="modal-file-row">
                <button
                  className="btn btn-small"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(req.copy!.text)
                      setCopied(true)
                      setTimeout(() => setCopied(false), 1500)
                    } catch {
                      setCopied(false)
                    }
                  }}
                >
                  {copied ? 'Скопировано!' : req.copy.label}
                </button>
              </div>
            )}
          </>
        )}
        {req.kind === 'confirm' && req.checkLabel && (
          <label className="modal-check">
            <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
            <span>{req.checkLabel}</span>
          </label>
        )}
        {req.kind === 'text' && (
          <input
            ref={inputRef}
            value={value}
            placeholder={req.placeholder}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirm()
              if (e.key === 'Escape') cancel()
            }}
          />
        )}
        {req.kind === 'textarea' && (
          <>
            {req.body && <div className="modal-body">{req.body}</div>}
            <textarea
              ref={areaRef}
              className="modal-textarea"
              value={value}
              placeholder={req.placeholder}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') cancel()
              }}
            />
            <input
              ref={fileRef}
              type="file"
              accept=".json,.txt,.chronicle-json,application/json,text/plain"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (!f) return
                f.text().then((t) => setValue(t))
              }}
            />
            <div className="modal-file-row">
              <button className="btn btn-small" onClick={() => fileRef.current?.click()}>
                {req.fileLabel}
              </button>
            </div>
          </>
        )}
        <div className="modal-buttons">
          {req.kind !== 'alert' && (
            <button className="btn btn-small" onClick={cancel}>
              {req.kind === 'confirm' ? req.cancel : 'Отмена'}
            </button>
          )}
          <button
            ref={okRef}
            className="btn btn-small btn-primary"
            disabled={(req.kind === 'text' || req.kind === 'textarea') && !value.trim()}
            onClick={confirm}
          >
            {req.kind === 'text' || req.kind === 'textarea' ? req.ok : req.kind === 'confirm' ? req.ok : 'Понятно'}
          </button>
        </div>
      </div>
    </div>
  )
}
