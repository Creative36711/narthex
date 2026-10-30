/**
 * Главы и происхождения кампании: редактор глав, карточка происхождения и
 * разбор строки базового навыка.
 *
 * Вынесено из `CampaignEditor.tsx`: это самостоятельные формы паспорта со своей
 * таблицей полей; страница редактора только показывает их во вкладках.
 */

import { Ico } from '../shared/icons'
import { useState } from 'react'
import type { EditorStore } from './store'
import { makeId } from './ids'
import type { CampaignMeta } from '../shared/types'
import { campaignFingerprint } from '../shared/fingerprint'
import { exportMonolith } from './monolith'

/** роли шрифтов темы: подпись и образец для предпросмотра */
export function ChaptersEditor({ m, commit }: { m: CampaignMeta; commit: () => void }) {
  const chapters = m.chapters ?? []
  const sorted = [...chapters].sort((a, b) => (a.order ?? chapters.indexOf(a)) - (b.order ?? chapters.indexOf(b)))
  const upd = (id: string, patch: Partial<(typeof chapters)[number]>) => {
    m.chapters = chapters.map((c) => (c.id === id ? { ...c, ...patch } : c))
    commit()
  }
  return (
    <div className="props-group">
      <h4>Главы кампании</h4>
      <p className="muted small" style={{ marginTop: 0 }}>
        Группировка контента по частям: сцены, правила, квесты и катсцены помечают выбором «Глава» в своих формах;
        списки слева фильтруются по ней. Сам движок глав не различает — это сборка для мастера и будущей выкладки «бесплатный пролог → продолжение».
      </p>
      {sorted.map((c) => (
        <div key={c.id} className="panel" style={{ padding: 8, marginBottom: 8 }}>
          <div className="fld-row">
            <label className="fld">
              <span>Название главы</span>
              <input value={c.label} onChange={(e) => upd(c.id, { label: e.target.value })} />
            </label>
            <label className="fld" data-tip="Меньше — раньше">
              <span>Порядок</span>
              <input type="number" value={c.order ?? sorted.indexOf(c) + 1} onChange={(e) => upd(c.id, { order: Number(e.target.value) || undefined })} />
            </label>
            <button
              className="btn btn-small ce-del"
              style={{ alignSelf: 'end' }}
              data-tip="Сцены/правила этой главы останутся — просто потеряют пометку"
              onClick={() => { m.chapters = chapters.filter((x) => x.id !== c.id); commit() }}
            >
              <Ico n="close" />
            </button>
          </div>
          <label className="fld fld-block">
            <span>О чём глава (кратко)</span>
            <input value={c.description ?? ''} placeholder="первая ночь в городе, завязка конфликта…" onChange={(e) => upd(c.id, { description: e.target.value || undefined })} />
          </label>
        </div>
      ))}
      <button
        className="btn btn-small"
        onClick={() => {
          const id = makeId('chapter', 'глава', chapters.map((x) => x.id))
          m.chapters = [...chapters, { id, label: 'Новая глава', order: chapters.length + 1 }]
          commit()
        }}
      >
        <Ico n="plus" /> глава
      </button>
    </div>
  )
}

/** Отпечаток кампании — по клику (монолит пересобирается, тяжело для рендера-на-каплю). */
export function AttributionEditor({ m, commit, store }: { m: CampaignMeta; commit: () => void; store: EditorStore }) {
  const [print, setPrint] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const a = m.attribution ?? {}
  const upd = (patch: Partial<typeof a>) => {
    const next = { ...a, ...patch }
    const empty = !next.author && !next.origin_url && !next.published_at && !next.note
    m.attribution = empty ? undefined : next
    commit()
  }
  return (
    <div className="props-group">
      <h4>Авторство и публикация</h4>
      <div className="fld-row">
        <label className="fld">
          <span>Автор (как на титуле публикации)</span>
          <input value={a.author ?? ''} onChange={(e) => upd({ author: e.target.value || undefined })} />
        </label>
        <label className="fld" data-tip="Каноническая копия — репозиторий мастера; история коммитов доказывает первую публикацию">
          <span>Канонический адрес репозитория</span>
          <input value={a.origin_url ?? ''} placeholder="https://github.com/автор/кампания" onChange={(e) => upd({ origin_url: e.target.value || undefined })} />
        </label>
      </div>
      <div className="fld-row">
        <label className="fld">
          <span>Вышла (дата)</span>
          <input
            type="date"
            value={/^\d{4}-\d{2}-\d{2}$/.test(a.published_at ?? '') ? a.published_at : ''}
            onChange={(e) => upd({ published_at: e.target.value || undefined })}
          />
        </label>
      </div>
      <label className="fld fld-block">
        <span>Сноска о происхождении (источники, вдохновение)</span>
        <input value={a.note ?? ''} onChange={(e) => upd({ note: e.target.value || undefined })} />
      </label>
      <div className="fld-row" style={{ alignItems: 'center' }}>
        {print ? (
          <code className="small" style={{ wordBreak: 'break-all' }}>отпечаток: {print}</code>
        ) : (
          <button
            className="btn btn-small"
            disabled={busy}
            data-tip="SHA-256 канонической формы кампании без полей публикации: смена «автора» не поменяет подпись"
            onClick={async () => {
              setBusy(true)
              try {
                const { doc } = exportMonolith(store)
                const hex = await campaignFingerprint(doc)
                setPrint(`${hex.slice(0, 16)}…${hex.slice(-8)}`)
              } finally {
                setBusy(false)
              }
            }}
          >
            Показать отпечаток кампании
          </button>
        )}
        <span className="muted small">Мастерская сравнит его со своими кампаниями — совпадение до полей публикации означает перелив.</span>
      </div>
    </div>
  )
}
