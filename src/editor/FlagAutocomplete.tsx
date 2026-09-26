import { useId, useState } from 'react'

export interface FlagOption {
  id: string
  label: string
  active?: boolean
}

/** Поиск и выбор флага по русскому названию, сохраняя в кампании его id. */
export function FlagAutocomplete({
  value,
  flags,
  onChange,
  placeholder = 'Выберите или введите флаг',
  ariaLabel = 'Флаг',
}: {
  value: string
  flags: FlagOption[]
  onChange: (value: string) => void
  placeholder?: string
  ariaLabel?: string
}) {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState<string | null>(null)
  const selected = flags.find((flag) => flag.id === value)
  const shownValue = open && query !== null ? query : selected?.label ?? value
  const search = (query ?? '').trim().toLocaleLowerCase('ru-RU')
  const matches = [...new Map(flags.map((flag) => [flag.id, flag])).values()]
    .filter((flag) => !search || `${flag.label} ${flag.id}`.toLocaleLowerCase('ru-RU').includes(search))
    .sort((a, b) => a.label.localeCompare(b.label, 'ru-RU'))
  const commitQuery = () => {
    const text = (query ?? selected?.label ?? value).trim()
    const exact = flags.find((flag) => flag.id === text || flag.label.localeCompare(text, 'ru-RU', { sensitivity: 'base' }) === 0)
    onChange(exact?.id ?? text)
    setOpen(false)
  }

  return (
    <div
      className="flag-autocomplete"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) commitQuery()
      }}
    >
      <input
        type="text"
        value={shownValue}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-controls={listId}
        aria-expanded={open}
        onFocus={() => { setQuery(null); setOpen(true) }}
        onClick={() => { if (!open) { setQuery(null); setOpen(true) } }}
        onChange={(event) => { setQuery(event.target.value); onChange(event.target.value); setOpen(true) }}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false) }
          if (event.key === 'Enter') { event.preventDefault(); commitQuery() }
        }}
      />
      {open && (
        <div className="flag-autocomplete-list" id={listId} role="listbox" aria-label="Известные флаги">
          {matches.length ? matches.map((flag) => (
            <button
              key={flag.id}
              type="button"
              role="option"
              aria-selected={value === flag.id}
              className={`flag-autocomplete-option${value === flag.id ? ' is-selected' : ''}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => { onChange(flag.id); setQuery(null); setOpen(false) }}
            >
              <span>{flag.label}</span>
              {flag.active !== undefined && (
                <small className={flag.active ? 'flag-autocomplete-active' : 'flag-autocomplete-inactive'}>
                  {flag.active ? 'Включён' : 'Выключен'}
                </small>
              )}
            </button>
          )) : (
            <div className="flag-autocomplete-empty">Нет совпадений. Можно задать свой флаг.</div>
          )}
        </div>
      )}
    </div>
  )
}
