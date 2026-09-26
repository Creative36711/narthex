import { useId, useState } from 'react'

/** Поиск и выбор флага без нестилизованного браузерного datalist. */
export function FlagAutocomplete({
  value,
  flags,
  onChange,
  placeholder = 'Выберите или введите флаг',
  ariaLabel = 'Флаг',
}: {
  value: string
  flags: string[]
  onChange: (value: string) => void
  placeholder?: string
  ariaLabel?: string
}) {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const matches = [...new Set(flags)]
    .filter((flag) => !value.trim() || flag.toLocaleLowerCase('ru-RU').includes(value.trim().toLocaleLowerCase('ru-RU')))
    .sort((a, b) => a.localeCompare(b, 'ru-RU'))

  return (
    <div
      className="flag-autocomplete"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false)
      }}
    >
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-controls={listId}
        aria-expanded={open}
        onFocus={() => setOpen(true)}
        onChange={(event) => { onChange(event.target.value); setOpen(true) }}
        onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false) }}
      />
      {open && (
        <div className="flag-autocomplete-list" id={listId} role="listbox" aria-label="Известные флаги">
          {matches.length ? matches.map((flag) => (
            <button
              key={flag}
              type="button"
              role="option"
              aria-selected={value === flag}
              className={`flag-autocomplete-option${value === flag ? ' is-selected' : ''}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => { onChange(flag); setOpen(false) }}
            >
              {flag}
            </button>
          )) : (
            <div className="flag-autocomplete-empty">Нет совпадений. Можно задать свой флаг.</div>
          )}
        </div>
      )}
    </div>
  )
}
