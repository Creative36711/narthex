import { useEffect, useRef, useState } from 'react'

/**
 * Стилизованный запрос текста вместо браузерного prompt() (фидбек №6).
 * askText() можно вызывать из любого места редактора; PromptHost — один на приложение.
 */

interface PromptRequest {
  title: string
  placeholder?: string
  initial?: string
  resolve: (v: string | null) => void
}

let pushRequest: ((r: PromptRequest) => void) | null = null

export function askText(title: string, placeholder = '', initial = ''): Promise<string | null> {
  return new Promise((resolve) => {
    if (pushRequest) pushRequest({ title, placeholder, initial, resolve })
    else resolve(window.prompt(title, initial)) // запасной вариант, если хост не смонтирован
  })
}

export function PromptHost() {
  const [req, setReq] = useState<PromptRequest | null>(null)
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    pushRequest = (r) => {
      setReq(r)
      setValue(r.initial ?? '')
    }
    return () => {
      pushRequest = null
    }
  }, [])

  useEffect(() => {
    if (req) inputRef.current?.focus()
  }, [req])

  if (!req) return null

  const done = (v: string | null) => {
    req.resolve(v)
    setReq(null)
  }

  return (
    <div className="prompt-overlay" onClick={() => done(null)}>
      <div className="prompt-box" onClick={(e) => e.stopPropagation()}>
        <div className="prompt-title">{req.title}</div>
        <input
          ref={inputRef}
          value={value}
          placeholder={req.placeholder}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && value.trim()) done(value.trim())
            if (e.key === 'Escape') done(null)
          }}
        />
        <div className="prompt-buttons">
          <button className="btn btn-small" onClick={() => done(null)}>Отмена</button>
          <button className="btn btn-small btn-primary" disabled={!value.trim()} onClick={() => done(value.trim())}>
            Создать
          </button>
        </div>
      </div>
    </div>
  )
}
