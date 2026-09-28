import { useState } from 'react'
import { BUILTIN_CODEX_CATEGORIES, type CodexEntryDef } from '../shared/types'
import type { EditorStore } from './store'
import { AssetUpload, FileAdvancedJson, RefSelect } from './Fields'

export function newCodexEntry(id: string, label: string): CodexEntryDef {
  return { id, label, text: '' }
}

/** категории: свои из меты, иначе встроенные три (блок 10 ТЗ) */
function categories(store: EditorStore): Array<{ id: string; label: string }> {
  return store.meta.codex_categories ?? BUILTIN_CODEX_CATEGORIES
}

/**
 * Редактор записи кодекса/бестиария (блок 10 ТЗ «Гибкий движок»):
 * категория, название, текст, картинка. Записи разблокируются эффектом
 * `unlock_codex` — до этого игрок их не видит.
 */
export function CodexEditor({ store, path }: { store: EditorStore; path: string }) {
  const entry = store.codexEntry(path)
  const [, force] = useState(0)
  const commit = () => {
    store.touch(path)
    force((n) => n + 1)
  }
  const cats = categories(store)

  return (
    <div className="rule-editor">
      <div className="props-group">
        <h4>Запись кодекса</h4>
        <label className="fld">
          <span>Название</span>
          <input value={entry.label} onChange={(e) => ((entry.label = e.target.value), commit())} />
        </label>
        <label className="fld">
          <span>Категория</span>
          <select
            value={entry.category ?? ''}
            onChange={(e) => ((entry.category = e.target.value || undefined), commit())}
          >
            <option value="">— встроенные (Хроники) —</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </label>
        <label className="fld">
          <span>Текст записи</span>
          <textarea rows={10} value={entry.text} onChange={(e) => ((entry.text = e.target.value), commit())} />
        </label>
        <RefSelect
          label="Существо бестиария (NPC из «Сущностей»)"
          kind="npc"
          store={store}
          value={entry.creature_entity ?? ''}
          optional
          onChange={(v) => {
            if (v) entry.creature_entity = v
            else delete entry.creature_entity
            commit()
          }}
        />
        {(entry.category ?? 'chronicles') === 'creatures' && !entry.creature_entity && (
          <div className="muted small">Запись в категории «Существа» без привязки к персонажу — покажет только текст и картинку, боевой сводки не будет.</div>
        )}
        <AssetUpload
          label="Картинка (необязательно)"
          value={entry.image ?? ''}
          dir="assets/img/codex"
          store={store}
          kind="image"
          onChange={(p) => ((entry.image = p || undefined), commit())}
        />
      </div>

      <FileAdvancedJson store={store} path={path} commit={commit} />
    </div>
  )
}
