import { Ico } from '../shared/icons'
import { useId, useState } from 'react'
import { FlagAutocomplete } from './FlagAutocomplete'
import type { Condition, Effect, ImageValue, NpcDef } from '../shared/types'
import { framesOf } from '../player/frames'
import { makeId } from './ids'
import type { EditorStore } from './store'
import { isExternalUrl } from '../core/loader'
import { askText, showAlert } from '../shared/modals'
import { journalEntryOptionLabel } from './questJournal'
import { checkExternalUrl, reportAssetError, type AssetKind, type UrlCheck } from './assets'
import {
  CONDITION_SCHEMAS,
  EFFECT_SCHEMAS,
  conditionSummary,
  effectSummary,
  type FieldSpec,
} from './schemas'

/**
 * Универсальные поля форм + визуальные конструкторы списков условий и эффектов.
 */

// ─────────────── одно поле по схеме ───────────────

export function Field({
  spec,
  value,
  onChange,
  store,
  ctx,
}: {
  spec: FieldSpec
  value: unknown
  onChange: (v: unknown) => void
  store: EditorStore
  /** весь объект условия/эффекта — для полей, зависящих от соседних (стадия ← квест) */
  ctx?: Record<string, unknown>
}) {
  const refKinds: Record<string, Parameters<EditorStore['options']>[0]> = {
    entityRef: 'entity',
    npcRef: 'npc',
    itemRef: 'item',
    locationRef: 'location',
    sceneRef: 'scene',
    questRef: 'quest',
    arenaRef: 'arena',
    ruleRef: 'rule',
    needRef: 'need',
    skillRef: 'skill',
    dispRef: 'disposition',
    cutsceneRef: 'cutscene',
    statusRef: 'status',
    weatherRef: 'weather',
    codexRef: 'codex',
  }

  if (spec.kind === 'number') {
    return (
      <label className="fld">
        <span>{spec.label}</span>
        <input
          type="number"
          value={value === undefined || value === null ? '' : Number(value)}
          onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        />
      </label>
    )
  }
  if (spec.kind === 'boolean') {
    return (
      <label className="fld fld-check">
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
        <span>{spec.label}</span>
      </label>
    )
  }
  if (spec.kind === 'select') {
    return (
      <label className="fld">
        <span>{spec.label}</span>
        <select value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
          {(spec.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </label>
    )
  }
  if (spec.kind === 'json') {
    return <JsonField label={spec.label} value={value} onChange={onChange} placeholder={spec.placeholder} />
  }
  if (spec.kind === 'timeOfDay') {
    return <TimeOfDayField label={spec.label} value={value} onChange={onChange} />
  }
  if (spec.kind === 'units') {
    return <UnitListField label={spec.label} store={store} value={value} optional={spec.optional} onChange={onChange} />
  }
  if (spec.kind === 'rewardItems') {
    return <ItemListField label={spec.label} store={store} value={value} optional={spec.optional} onChange={onChange} />
  }
  if (spec.kind === 'flagRef') {
    return (
      <FlagSelect
        label={spec.label}
        store={store}
        value={value === undefined ? '' : String(value)}
        optional={spec.optional}
        onChange={onChange}
      />
    )
  }
  if (spec.kind === 'dialogueNodeRef') {
    return (
      <DialogueNodeRef
        label={spec.label}
        store={store}
        npcId={typeof ctx?.entity === 'string' ? ctx.entity : ''}
        value={value === undefined ? '' : String(value)}
        optional={spec.optional}
        onChange={onChange}
      />
    )
  }
  if (spec.kind === 'questStageRef' || spec.kind === 'journalKeyRef') {
    return (
      <QuestSubRef
        label={spec.label}
        mode={spec.kind === 'questStageRef' ? 'stage' : 'journal'}
        store={store}
        questId={typeof ctx?.quest === 'string' ? ctx.quest : ''}
        value={value === undefined ? '' : String(value)}
        onChange={onChange}
      />
    )
  }
  if (spec.kind === 'conditions') {
    return (
      <div className="fld fld-block">
        <span>{spec.label}</span>
        <ConditionListEditor
          store={store}
          conditions={(value as Condition[]) ?? []}
          onChange={(v) => onChange(v)}
        />
      </div>
    )
  }
  if (spec.kind === 'effects') {
    return (
      <div className="fld fld-block">
        <span>{spec.label}</span>
        <EffectListEditor store={store} effects={(value as Effect[]) ?? []} onChange={(v) => onChange(v)} />
      </div>
    )
  }
  // *Ref-поля — выпадающий список с названиями (мастер не видит и не вводит id)
  const refKind = refKinds[spec.kind]
  if (refKind) {
    return (
      <RefSelect
        label={spec.label}
        kind={refKind}
        store={store}
        value={value === undefined ? '' : String(value)}
        optional={spec.optional}
        onChange={onChange}
      />
    )
  }
  if (spec.kind === 'portraitPick') {
    return (
      <PortraitPick
        label={spec.label}
        store={store}
        value={value === undefined ? '' : String(value)}
        optional={spec.optional}
        onChange={onChange}
      />
    )
  }
  const isFlag = spec.label.toLowerCase().includes('флаг')
  if (isFlag) {
    return (
      <div className="fld">
        <span>{spec.label}</span>
        <FlagAutocomplete
          value={String(value ?? '')}
          flags={store.options('flag')}
          placeholder={spec.placeholder}
          ariaLabel={spec.label}
          onChange={(next) => onChange(next === '' && spec.optional ? undefined : next)}
        />
      </div>
    )
  }
  return (
    <label className="fld">
      <span>{spec.label}</span>
      <input
        type="text"
        value={String(value ?? '')}
        placeholder={spec.placeholder}
        onChange={(e) => onChange(e.target.value === '' && spec.optional ? undefined : e.target.value)}
      />
    </label>
  )
}



/**
 * Портрет для сообщения (фидбек 19): не ручной путь, а выбор — взять портрет
 * одного из существующих персонажей или загрузить своё изображение.
 */
function PortraitPick({
  label,
  store,
  value,
  optional,
  onChange,
}: {
  label: string
  store: EditorStore
  value: string
  optional?: boolean
  onChange: (v: unknown) => void
}) {
  const npcs = store
    .entityPaths()
    .map((p) => store.entity(p))
    .filter((e): e is NpcDef => !!e && e.type === 'npc' && Object.values(e.portrait ?? {}).some(Boolean))
    .sort((a, b) => a.label.localeCompare(b.label, 'ru'))
  const portraitOf = (n: (typeof npcs)[number]) => n.portrait!.neutral || Object.values(n.portrait!)[0] || ''
  const fromNpc = npcs.find((n) => portraitOf(n) === value)
  return (
    <div className="fld fld-block">
      <span>{label}</span>
      <div className="fld-row" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label className="fld" style={{ flex: 1, minWidth: 180 }}>
          <span>Портрет персонажа</span>
          <select
            value={fromNpc?.id ?? ''}
            onChange={(e) => {
              const n = npcs.find((x) => x.id === e.target.value)
              if (!n) return
              onChange(portraitOf(n))
            }}
          >
            <option value="">— не использовать —</option>
            {npcs.map((n) => (
              <option key={n.id} value={n.id}>{n.label}</option>
            ))}
          </select>
        </label>
        <div style={{ flex: 1, minWidth: 220 }}>
          <ImageUpload
            label="…или своё изображение"
            value={value}
            dir="assets/img/messages"
            store={store}
            onChange={(p) => onChange(p === '' && optional ? undefined : p)}
          />
        </div>
      </div>
    </div>
  )
}

/** Селект узла диалога выбранного NPC (фидбек: никакого ручного knot). */
function DialogueNodeRef({
  label,
  store,
  npcId,
  value,
  optional,
  onChange,
}: {
  label: string
  store: EditorStore
  npcId: string
  value: string
  optional?: boolean
  onChange: (v: unknown) => void
}) {
  let nodes: Array<{ id: string; label: string }> = []
  for (const p of store.entityPaths()) {
    const e = store.entity(p)
    if (e?.type !== 'npc' || e.id !== npcId || !e.dialogue) continue
    const doc = store.jsonFiles.get(e.dialogue.replace(/\.ink$/, '.dlg.json')) as
      | { nodes?: Array<{ id: string; label?: string }> }
      | undefined
    nodes = (doc?.nodes ?? []).map((n) => ({ id: n.id, label: n.label ?? n.id }))
  }
  return (
    <label className="fld">
      <span>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value === '' ? (optional ? undefined : '') : e.target.value)}
      >
        <option value="">— с начала разговора —</option>
        {value !== '' && !nodes.some((n) => n.id === value) && <option value={value}>{value}</option>}
        {nodes.map((n) => (
          <option key={n.id} value={n.id}>{n.label}</option>
        ))}
      </select>
    </label>
  )
}

/** Селект стадии или журнальной записи выбранного квеста (фидбек №12). */
function QuestSubRef({
  label,
  mode,
  store,
  questId,
  value,
  onChange,
}: {
  label: string
  mode: 'stage' | 'journal'
  store: EditorStore
  questId: string
  value: string
  onChange: (v: unknown) => void
}) {
  const quest = store.questPaths().map((p) => store.quest(p)).find((q) => q?.id === questId)
  const options: Array<{ id: string; label: string }> = quest
    ? mode === 'stage'
      ? quest.stages.map((st) => ({ id: st.id, label: st.label ?? st.id }))
      : Object.keys(quest.journal_entries).map((k) => ({
          id: k,
          label: journalEntryOptionLabel(quest, k),
        }))
    : []
  return (
    <label className="fld">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {!quest && <option value={value}>{value || '— сначала выберите квест —'}</option>}
        {quest && value === '' && <option value="">— не выбрано —</option>}
        {quest && value !== '' && !options.some((o) => o.id === value) && (
          <option value={value}>{mode === 'journal' ? 'Запись не найдена — проверьте ключ' : value}</option>
        )}
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>
    </label>
  )
}

/** Мультивыбор периодов суток чипами (фидбек №11). */
function TimeOfDayField({
  label,
  value,
  onChange,
}: {
  label: string
  value: unknown
  onChange: (v: unknown) => void
}) {
  const selected = new Set((Array.isArray(value) ? value : value ? [value] : []).map(String))
  const toggle = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange(ORDERED_TIMES.filter((t) => next.has(t.id)).map((t) => t.id))
  }
  return (
    <div className="fld fld-block">
      <span>{label}</span>
      <div className="chip-row">
        {ORDERED_TIMES.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`chip ${selected.has(t.id) ? 'chip-on' : ''}`}
            onClick={() => toggle(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  )
}

const ORDERED_TIMES = [
  { id: 'morning', label: 'Утро' },
  { id: 'day', label: 'День' },
  { id: 'evening', label: 'Вечер' },
  { id: 'night', label: 'Ночь' },
]

/** Визуальный список отрядов {NPC × количество} для start_combat (фидбек №11). */
function UnitListField({
  label,
  store,
  value,
  optional,
  onChange,
}: {
  label: string
  store: EditorStore
  value: unknown
  optional?: boolean
  onChange: (v: unknown) => void
}) {
  const units = (Array.isArray(value) ? value : []) as Array<{ entity: string; count: number }>
  const npcs = store.options('npc')
  const set = (next: Array<{ entity: string; count: number }>) =>
    onChange(next.length === 0 && optional ? undefined : next)
  return (
    <div className="fld fld-block">
      <span>{label}</span>
      {units.map((u, i) => (
        <div key={i} className="journal-row">
          <select
            className="journal-key"
            value={u.entity}
            onChange={(e) => set(units.map((x, j) => (j === i ? { ...x, entity: e.target.value } : x)))}
          >
            {!npcs.some((o) => o.id === u.entity) && <option value={u.entity}>{u.entity || '— персонаж —'}</option>}
            {npcs.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
          <span className="muted small">×</span>
          <input
            type="number"
            className="journal-key"
            min={1}
            value={u.count ?? 1}
            onChange={(e) => set(units.map((x, j) => (j === i ? { ...x, count: Math.max(1, Number(e.target.value)) } : x)))}
          />
          <button className="btn btn-small ce-del" onClick={() => set(units.filter((_, j) => j !== i))}><Ico n="close" /> </button>
        </div>
      ))}
      <button
        type="button"
        className="btn btn-small"
        onClick={() => set([...units, { entity: npcs[0]?.id ?? '', count: 1 }])}
      >
        + участник
      </button>
    </div>
  )
}

/** Визуальный список наград {предмет × количество} (фидбек №11). */
function ItemListField({
  label,
  store,
  value,
  optional,
  onChange,
}: {
  label: string
  store: EditorStore
  value: unknown
  optional?: boolean
  onChange: (v: unknown) => void
}) {
  const items = (Array.isArray(value) ? value : []) as Array<{ item: string; quantity: number }>
  const opts = store.options('item')
  const set = (next: Array<{ item: string; quantity: number }>) =>
    onChange(next.length === 0 && optional ? undefined : next)
  return (
    <div className="fld fld-block">
      <span>{label}</span>
      {items.map((u, i) => (
        <div key={i} className="journal-row">
          <select
            className="journal-key"
            value={u.item}
            onChange={(e) => set(items.map((x, j) => (j === i ? { ...x, item: e.target.value } : x)))}
          >
            {!opts.some((o) => o.id === u.item) && <option value={u.item}>{u.item || '— предмет —'}</option>}
            {opts.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
          <span className="muted small">×</span>
          <input
            type="number"
            className="journal-key"
            min={1}
            value={u.quantity ?? 1}
            onChange={(e) => set(items.map((x, j) => (j === i ? { ...x, quantity: Math.max(1, Number(e.target.value)) } : x)))}
          />
          <button className="btn btn-small ce-del" onClick={() => set(items.filter((_, j) => j !== i))}><Ico n="close" /> </button>
        </div>
      ))}
      <button type="button" className="btn btn-small" onClick={() => set([...items, { item: opts[0]?.id ?? '', quantity: 1 }])}>
        + предмет
      </button>
    </div>
  )
}

/**
 * Выбор флага: русские названия из реестра кампании («Кампания → Флаги»)
 * + создание нового флага на месте (фидбек №4).
 */
export function FlagSelect({
  label,
  store,
  value,
  optional,
  onChange,
}: {
  label: string
  store: EditorStore
  value: string
  optional?: boolean
  onChange: (v: string | undefined) => void
}) {
  const options = store.options('flag')
  const known = options.some((o) => o.id === value)
  return (
    <label className="fld">
      <span>{label}</span>
      <select
        value={value}
        onChange={async (e) => {
          if (e.target.value === '__new__') {
            const name = await askText('Название нового флага', 'например «Мост разрушен»')
            if (!name) return
            const id = makeId('', name, options.map((o) => o.id))
            if (!store.meta.flags) store.meta.flags = []
            store.meta.flags.push({ id, label: name })
            store.touch('campaign.json')
            onChange(id)
            return
          }
          onChange(e.target.value === '' ? (optional ? undefined : '') : e.target.value)
        }}
      >
        {(optional || value === '') && <option value="">{optional ? '— не задано —' : '— выбрать флаг —'}</option>}
        {!known && value !== '' && <option value={value}>{value}</option>}
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
        <option value="__new__"><Ico n="plus" />  Создать новый флаг…</option>
      </select>
    </label>
  )
}

/** Выпадающий список ссылок: показывает названия, хранит id. */
export function RefSelect({
  label,
  kind,
  store,
  value,
  optional,
  onChange,
}: {
  label: string
  kind: Parameters<EditorStore['options']>[0]
  store: EditorStore
  value: string
  optional?: boolean
  onChange: (v: string | undefined) => void
}) {
  const options = store.options(kind)
  const known = options.some((o) => o.id === value)
  return (
    <label className="fld">
      <span>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value === '' ? (optional ? undefined : '') : e.target.value)}
      >
        {(optional || value === '') && <option value="">— не выбрано —</option>}
        {!known && value !== '' && <option value={value}>{value}</option>}
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>
    </label>
  )
}

/**
 * Загрузка медиафайла: с компьютера или по ссылке (итерация 8, блок C).
 * Ссылка проверяется сразу: если хостинг запрещает встраивание, мастер
 * видит предупреждение и понимает, что кампания будет зависеть от сети.
 */
export function AssetUpload({
  label,
  value,
  dir,
  store,
  kind = 'image',
  onChange,
}: {
  label: string
  value: string
  /** подпапка в кампании, напр. "assets/img/maps" */
  dir: string
  store: EditorStore
  kind?: AssetKind
  onChange: (path: string) => void
}) {
  const inputId = useId()
  const [busy, setBusy] = useState(false)
  const [url, setUrl] = useState('')
  const [check, setCheck] = useState<UrlCheck | null>(null)
  const [checking, setChecking] = useState(false)
  const accept =
    kind === 'audio'
      ? 'audio/*'
      : kind === 'video'
        ? 'video/*'
        : kind === 'font'
          ? '.woff2,.woff,.ttf,.otf'
          : 'image/*'

  const pick = async (file: File) => {
    setBusy(true)
    try {
      const clean = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '_')
      const rel = `${dir}/${clean}`
      await store.saveBinary(rel, file)
      onChange(rel)
    } catch (e) {
      void reportAssetError(e)
    } finally {
      setBusy(false)
    }
  }

  const applyUrl = async () => {
    const u = url.trim()
    if (!u) return
    setChecking(true)
    setCheck(null)
    const res = await checkExternalUrl(u, kind)
    setCheck(res)
    setChecking(false)
    if (res.ok) onChange(u)
  }

  return (
    <div className="fld fld-block img-upload">
      <span>{label}</span>
      <div className="img-upload-row">
        {value ? (
          kind === 'audio' ? (
            <audio className="asset-preview-audio" src={assetSrc(store, value)} controls />
          ) : kind === 'font' ? (
            <div className="asset-preview-font" data-tip={`Подключённый файл: ${value}`}>
              <div className="asset-font-badge">
                <Ico n="check" /> Подключён
              </div>
              <div className="asset-font-sample">Aa Бб 123</div>
              <div className="asset-font-filename">{value.split('/').pop() || value}</div>
            </div>
          ) : (
            <img className="img-upload-preview" src={assetSrc(store, value)} alt="" />
          )
        ) : (
          <div className="img-upload-empty">нет файла</div>
        )}
        <div className="img-upload-btns">
          <label className="btn btn-small" htmlFor={inputId}>
            {busy ? 'Загрузка…' : 'Выбрать файл…'}
          </label>
          <input
            id={inputId}
            type="file"
            accept={accept}
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) pick(f)
              e.target.value = ''
            }}
          />
          {value && (
            <button className="btn btn-small ce-del" onClick={() => { onChange(''); setCheck(null) }}><Ico n="close" />  убрать</button>
          )}
        </div>
      </div>
      <div className="img-upload-url">
        <input
          type="url"
          value={url}
          placeholder="или вставьте ссылку (https://…)"
          spellCheck={false}
          onChange={(e) => {
            setUrl(e.target.value)
            setCheck(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void applyUrl()
            }
          }}
        />
        <button className="btn btn-small" disabled={!url.trim() || checking} onClick={() => void applyUrl()}>
          {checking ? 'Проверяю…' : 'Вставить ссылку'}
        </button>
      </div>
      {check && (
        <div className={`asset-check ${check.ok ? (check.cors ? 'ok' : 'warn') : 'bad'}`}>
          {check.ok ? (check.cors ? '' : '') : ''}
          {check.message}
        </div>
      )}
      {isExternalUrl(value) && (
        <div className="muted small">
          Файл лежит на чужом сервере: без интернета картинка/звук не покажется. Чтобы кампания
          стала автономной, отметьте «Вшить внешние ссылки в пакет» при экспорте.
        </div>
      )}
    </div>
  )
}

/** путь файла → src для предпросмотра (внешние ссылки — как есть) */
function assetSrc(store: EditorStore, value: string): string {
  return store.assetSrc(value)
}

/** Загрузка изображения с компьютера или по ссылке. */
export function ImageUpload({
  label,
  value,
  dir,
  store,
  onChange,
}: {
  label: string
  value: string
  dir: string
  store: EditorStore
  onChange: (path: string) => void
}) {
  return <AssetUpload label={label} value={value} dir={dir} store={store} kind="image" onChange={onChange} />
}

/**
 * «Живые» изображения (разрешено мастеру-пункт «живые сцены»): статичное
 * изображение — как обычно; «Оживить…» превращает в цикл кадров (список
 * картинок + темп + зацикленность). Значение: string одиночное, объект
 * {frames, fps, loop} — анимация.
 */
export function AnimImageEditor({
  label,
  value,
  dir,
  store,
  onChange,
}: {
  label: string
  value: ImageValue | undefined
  dir: string
  store: EditorStore
  onChange: (v: ImageValue | undefined) => void
}) {
  const info = framesOf(value)
  const animated = (info?.frames.length ?? 0) > 0 && typeof value !== 'string'

  if (!animated) {
    const base = info?.frames[0] ?? ''
    return (
      <div>
        <ImageUpload
          label={label}
          value={base}
          dir={dir}
          store={store}
          onChange={(p) => onChange(p || undefined)}
        />
        <div className="muted small" style={{ margin: '4px 0' }}>
          Хотите «живой» вариант? Это несколько картинок, сменяющих друг друга по таймеру
          (пламя, мигание фонаря, дверцу у печи).
        </div>
        <div className="fld-row">
          <button
            className="btn btn-small"
            data-tip="Переключить поле в режим кадров: добавьте 2+ картинки и темп"
            onClick={() => onChange({ frames: base ? [base, ''] : ['', ''], fps: 2, loop: true })}
          >
            <Ico n="sparkle" /> Оживить (кадры за кадром)…
          </button>
          <button
            className="btn btn-small"
            data-tip="Лист-анимация: один файл с раскладкой N×M кадров (дым, вода, покачивание)"
            onClick={() => onChange({ sheet: base || '', cols: 3, rows: 1, fps: 8, loop: true })}
          >
            <Ico n="sparkle" /> Оживить (лист N×M)…
          </button>
        </div>
      </div>
    )
  }

  // спрайт-лист (SheetDoc): один файл-картинка с раскладкой
  if (info?.sheet) {
    const sheet = value as { sheet: string; cols: number; rows: number; fps?: number; loop?: boolean }
    return (
      <div className="fld fld-block img-upload anim-frames">
        <span>{label} — лист-анимация ({sheet.cols}×{sheet.rows}, {sheet.fps ?? 8} к/с{sheet.loop !== false ? ', зациклено' : ''})</span>
        <ImageUpload
          label="Файл-лист (PNG с раскладкой кадров сеткой)"
          value={sheet.sheet}
          dir={dir}
          store={store}
          onChange={(p) => onChange({ ...sheet, sheet: p })}
        />
        <div className="anim-controls">
          <label className="fld anim-fps">
            <span>Колонок</span>
            <input type="number" min={1} max={32} value={sheet.cols} onChange={(e) => onChange({ ...sheet, cols: Math.max(1, Math.min(32, +e.target.value || 1)) })} />
          </label>
          <label className="fld anim-fps">
            <span>Строк</span>
            <input type="number" min={1} max={32} value={sheet.rows} onChange={(e) => onChange({ ...sheet, rows: Math.max(1, Math.min(32, +e.target.value || 1)) })} />
          </label>
          <label className="fld anim-fps">
            <span>Темп, кадр/с</span>
            <input type="number" min={0.25} max={30} step={0.25} value={sheet.fps ?? 8} onChange={(e) => onChange({ ...sheet, fps: Math.max(0.25, Math.min(30, +e.target.value || 8)) })} />
          </label>
          <label className="fld fld-check anim-loop">
            <input type="checkbox" checked={sheet.loop !== false} onChange={(e) => onChange({ ...sheet, loop: e.target.checked || undefined })} />
            <span>Зациклить</span>
          </label>
          <button
            className="btn btn-small anim-static"
            data-tip="Оставить файл как обычную картинку — анимация выключится"
            onClick={() => onChange(sheet.sheet || undefined)}
          >
            Только картинку
          </button>
        </div>
        <div className="muted small">
          Кадры читаются слева-направо по строкам. Файл не режется: игра сама делит лист на сетку.
        </div>
      </div>
    )
  }

  const set = (patch: Partial<{ frames: string[]; fps: number; loop: boolean }>) => {
    onChange({ frames: info!.frames, fps: info!.fps, loop: info!.loop, ...patch })
  }

  return (
    <div className="fld fld-block img-upload anim-frames">
      <span>{label} — оживление ({info!.frames.length} кадр(а), {info!.fps} к/с{info!.loop ? ', зациклено' : ''})</span>
      {info!.frames.map((f, i) => (
        <div key={i} className="anim-frame-row">
          <ImageUpload
            label={`Кадр ${i + 1}`}
            value={f}
            dir={dir}
            store={store}
            onChange={(p) => {
              const frames = [...info!.frames]
              frames[i] = p
              set({ frames })
            }}
          />
          <button
            className="btn btn-small ce-del"
            data-tip="Убрать кадр"
            onClick={() => {
              const frames = info!.frames.filter((_, j) => j !== i)
              if (frames.length === 1) onChange(frames[0])
              else if (!frames.length) onChange(undefined)
              else set({ frames })
            }}
          >
            <Ico n="close" />
          </button>
        </div>
      ))}
      <div className="anim-controls">
        <button className="btn btn-small" onClick={() => set({ frames: [...info!.frames, ''] })}>
          <Ico n="plus" /> Кадр
        </button>
        <label className="fld anim-fps">
          <span>Темп, кадр/с</span>
          <input
            type="number"
            min={0.25}
            max={12}
            step={0.25}
            value={info!.fps}
            onChange={(e) => {
              const v = Number(e.target.value)
              if (v > 0) set({ fps: Math.min(12, v) })
            }}
          />
        </label>
        <label className="fld fld-check anim-loop">
          <input type="checkbox" checked={info!.loop} onChange={(e) => set({ loop: e.target.checked })} />
          <span>Зациклить</span>
        </label>
        <button
          className="btn btn-small anim-static"
          data-tip="Оставить только первый кадр — анимация выключится"
          onClick={() => onChange(info!.frames.find(Boolean) || undefined)}
        >
          Сделать статичным
        </button>
      </div>
    </div>
  )
}

/** Загрузка звука (музыка, озвучка) с компьютера или по ссылке. */
export function AudioUpload({
  label,
  value,
  dir,
  store,
  onChange,
}: {
  label: string
  value: string
  dir: string
  store: EditorStore
  onChange: (path: string) => void
}) {
  return <AssetUpload label={label} value={value} dir={dir} store={store} kind="audio" onChange={onChange} />
}

export function JsonField({
  label,
  value,
  onChange,
  placeholder,
  rows = 2,
  pretty = false,
  fill = false,
}: {
  label: string
  value: unknown
  onChange: (v: unknown) => void
  placeholder?: string
  rows?: number
  pretty?: boolean
  /** растянуть текстовое поле на всю доступную высоту (вкладки JSON) */
  fill?: boolean
}) {
  const [text, setText] = useState(() => (value === undefined ? '' : JSON.stringify(value, null, pretty ? 2 : undefined)))
  const [err, setErr] = useState(false)
  return (
    <label className={`fld fld-block${fill ? ' fld-fill' : ''}`}>
      <span>
        {label} {err && <em className="fld-err">← некорректный JSON</em>}
      </span>
      <textarea
        rows={rows}
        className={fill ? 'json-fill' : undefined}
        value={text}
        placeholder={placeholder}
        spellCheck={false}
        onChange={(e) => {
          setText(e.target.value)
          if (e.target.value.trim() === '') {
            setErr(false)
            onChange(undefined)
            return
          }
          try {
            onChange(JSON.parse(e.target.value))
            setErr(false)
          } catch {
            setErr(true)
          }
        }}
      />
    </label>
  )
}

// ─────────────── форма по схеме типа ───────────────

function SchemaForm({
  fields,
  obj,
  onChange,
  store,
}: {
  fields: FieldSpec[]
  obj: Record<string, unknown>
  onChange: (obj: Record<string, unknown>) => void
  store: EditorStore
}) {
  return (
    <div className="schema-form">
      {fields.map((f) => (
        <Field
          key={f.key}
          spec={f}
          value={obj[f.key]}
          store={store}
          ctx={obj}
          onChange={(v) => {
            const next = { ...obj }
            if (v === undefined) delete next[f.key]
            else next[f.key] = v
            onChange(next)
          }}
        />
      ))}
      {fields.length === 0 && <div className="muted small">Без параметров</div>}
    </div>
  )
}

// ─────────────── список условий ───────────────

export function ConditionListEditor({
  store,
  conditions,
  onChange,
}: {
  store: EditorStore
  conditions: Condition[]
  onChange: (c: Condition[]) => void
}) {
  const [open, setOpen] = useState<number | null>(null)
  const types = (Object.keys(CONDITION_SCHEMAS) as Condition['type'][]).sort((a, b) => CONDITION_SCHEMAS[a].label.localeCompare(CONDITION_SCHEMAS[b].label, 'ru'))
  return (
    <div className="ce-list">
      {conditions.map((c, i) => {
        const schema = CONDITION_SCHEMAS[c.type]
        return (
          <div key={i} className="ce-item">
            <div className="ce-head" onClick={() => setOpen(open === i ? null : i)}>
              <span className="ce-summary">{conditionSummary(c, store)}</span>
              <button
                className="btn btn-small ce-del"
                onClick={(e) => {
                  e.stopPropagation()
                  onChange(conditions.filter((_, j) => j !== i))
                }}
              >
                <Ico n="close" /> 
              </button>
            </div>
            {open === i && (
              <div className="ce-body">
                <label className="fld">
                  <span>Тип</span>
                  <select
                    value={c.type}
                    onChange={(e) => {
                      const t = e.target.value as Condition['type']
                      const next = [...conditions]
                      next[i] = { type: t, ...CONDITION_SCHEMAS[t].blank } as Condition
                      onChange(next)
                    }}
                  >
                    {types.map((t) => (
                      <option key={t} value={t}>
                        {CONDITION_SCHEMAS[t].label}
                      </option>
                    ))}
                  </select>
                </label>
                <SchemaForm
                  fields={schema.fields}
                  obj={c as unknown as Record<string, unknown>}
                  store={store}
                  onChange={(obj) => {
                    const next = [...conditions]
                    next[i] = { ...obj, type: c.type } as Condition
                    onChange(next)
                  }}
                />
              </div>
            )}
          </div>
        )
      })}
      <button
        className="btn btn-small"
        onClick={() => {
          onChange([...conditions, { type: 'flag_set', flag: '' } as Condition])
          setOpen(conditions.length)
        }}
      >
        + условие
      </button>
    </div>
  )
}

// ─────────────── список эффектов ───────────────

export function EffectListEditor({
  store,
  effects,
  onChange,
}: {
  store: EditorStore
  effects: Effect[]
  onChange: (e: Effect[]) => void
}) {
  const [open, setOpen] = useState<number | null>(null)
  const types = (Object.keys(EFFECT_SCHEMAS) as Effect['type'][]).sort((a, b) => EFFECT_SCHEMAS[a].label.localeCompare(EFFECT_SCHEMAS[b].label, 'ru'))
  return (
    <div className="ce-list">
      {effects.map((ef, i) => {
        const schema = EFFECT_SCHEMAS[ef.type]
        return (
          <div key={i} className="ce-item">
            <div className="ce-head" onClick={() => setOpen(open === i ? null : i)}>
              <span className="ce-summary ce-effect">{effectSummary(ef, store)}</span>
              <span className="ce-tools" onClick={(e) => e.stopPropagation()}>
                <button
                  className="btn btn-small"
                  disabled={i === 0}
                  data-tip="Выше"
                  onClick={() => {
                    const next = [...effects]
                    ;[next[i - 1], next[i]] = [next[i], next[i - 1]]
                    onChange(next)
                  }}
                >
                  ↑
                </button>
                <button
                  className="btn btn-small ce-del"
                  onClick={() => onChange(effects.filter((_, j) => j !== i))}
                >
                  <Ico n="close" /> 
                </button>
              </span>
            </div>
            {open === i && (
              <div className="ce-body">
                <label className="fld">
                  <span>Тип</span>
                  <select
                    value={ef.type}
                    onChange={(e) => {
                      const t = e.target.value as Effect['type']
                      const next = [...effects]
                      next[i] = { type: t, ...EFFECT_SCHEMAS[t].blank } as Effect
                      onChange(next)
                    }}
                  >
                    {types.map((t) => (
                      <option key={t} value={t}>
                        {EFFECT_SCHEMAS[t].label}
                      </option>
                    ))}
                  </select>
                </label>
                <SchemaForm
                  fields={schema.fields}
                  obj={ef as unknown as Record<string, unknown>}
                  store={store}
                  onChange={(obj) => {
                    const next = [...effects]
                    next[i] = { ...obj, type: ef.type } as Effect
                    onChange(next)
                  }}
                />
              </div>
            )}
          </div>
        )
      })}
      <button
        className="btn btn-small"
        onClick={() => {
          onChange([...effects, { type: 'show_message', text: '' } as Effect])
          setOpen(effects.length)
        }}
      >
        + эффект
      </button>
    </div>
  )
}


/**
 * «Расширенный JSON» — единый паттерн (фидбек 9.12): правка файла целиком
 * как текста (все поля, включая редкие, которых нет в формах). Хранится в
 * jsonFiles стора и пишется на диск вместе с формой.
 */
export function FileAdvancedJson({ store, path, commit, label = 'Расширенный JSON (все поля)', inline = false }: {
  store: EditorStore
  path: string
  commit: () => void
  label?: string
  /** true — показывать сразу на весь экран (для вкладок JSON), без сворачивания */
  inline?: boolean
}) {
  const [gen, setGen] = useState(0)
  const apply = (v: unknown) => {
    const text = v as string | undefined
    if (text !== undefined) {
      // Жёсткий запрет переименования id (`docs/compatibility.md`): на id
      // завязаны все ссылки пакета и сохранения игроков. Переименовать объект
      // нельзя — можно создать новый, а старый удалить.
      const before = store.jsonFiles.get(path) as { id?: string } | undefined
      const after = text as unknown as { id?: string }
      if (before?.id && after && typeof after === 'object' && after.id && after.id !== before.id) {
        void showAlert(
          'Менять id нельзя',
          `Id «${before.id}» → «${after.id}».\n\nНа этот id ссылаются другие объекты кампании и сохранения игроков: после переименования связи и старые сейвы сломаются. Создайте новый объект, перенесите в него содержимое, а старый удалите.`,
        )
        setGen((n) => n + 1) // вернуть в поле прежнее значение
        return
      }
      store.jsonFiles.set(path, text)
      commit()
    }
  }
  if (inline) {
    return (
      <div className="advanced-json-page">
        {label && (
          <div className="muted small" style={{ marginBottom: 6 }}>{label}</div>
        )}
        <JsonField label="" rows={26} pretty fill value={store.jsonFiles.get(path)} onChange={apply} />
      </div>
    )
  }
  return (
    <details className="advanced-json" onToggle={(e) => (e.target as HTMLDetailsElement).open && setGen((n) => n + 1)}>
      <summary>{label}</summary>
      <JsonField key={gen} label="" rows={22} pretty value={store.jsonFiles.get(path)} onChange={apply} />
    </details>
  )
}

/** Выбор главы кампании (meta.chapters); пустой реестр → поле не показывается. */
export function ChapterSelect({ store, value, onChange }: { store: EditorStore; value: string | undefined; onChange: (v: string | undefined) => void }) {
  const chapters = store.meta.chapters ?? []
  if (!chapters.length) return null
  const sorted = [...chapters].sort((a, b) => (a.order ?? chapters.indexOf(a)) - (b.order ?? chapters.indexOf(b)))
  return (
    <label className="fld" data-tip="Группировка для мастера; движок главы не различает">
      <span>Глава</span>
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)}>
        <option value="">без главы</option>
        {sorted.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>
    </label>
  )
}

// ─────────────── нотация кубиков без свободного текста ───────────────

/**
 * Структурный ввод нотации «NdN±M»: число кубиков и тип кости выбираются из
 * списков, модификатор — числовое поле. Свободный текст в таких полях — это
 * источник «fdsf654» вместо урона (фидбек 26): списки не дают ввести мусор,
 * а итоговая строка всегда видна рядом.
 *
 * Нестандартное старое значение (например «2d7+1» из импорта) не теряется
 * молча: показано предупреждением и заменяется только первым же выбором.
 */
export function DiceNotationInput({
  label,
  value,
  onChange,
  tip,
  optional,
  compact,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  tip?: string
  /** разрешить пустое значение («не задано») — с кнопкой сброса */
  optional?: boolean
  /** узкий режим (формулы по характеристикам): без итоговой строки «= NdN» */
  compact?: boolean
}) {
  const raw = (value ?? '').trim()
  const m = /^(\d+)[dD](\d+)([+-]\d+)?$/.exec(raw)
  const custom = !!raw && !m
  const count = Number(m?.[1] || 1)
  const die = Number(m?.[2] || 6)
  const mod = Number(m?.[3] || 0)
  const baseCounts = [1, 2, 3, 4, 5, 6]
  const baseSides = [2, 3, 4, 6, 8, 10, 12, 20, 100]
  const countOpts = m && !baseCounts.includes(count) ? [...baseCounts, count].sort((a, b) => a - b) : baseCounts
  const sideOpts = m && !baseSides.includes(die) ? [...baseSides, die].sort((a, b) => a - b) : baseSides
  const summary = `${count}d${die}${mod > 0 ? `+${mod}` : mod < 0 ? String(mod) : ''}`
  const emit = (c: number, d: number, mo: number) =>
    onChange(`${c}d${d}${mo > 0 ? `+${mo}` : mo < 0 ? String(mo) : ''}`)
  return (
    <label className={`fld fld-dmg${compact ? ' fld-dmg-compact' : ''}`} data-tip={tip}>
      <span>{label}</span>
      <div className="dmg-row">
        <select value={m ? count : 1} onChange={(e) => emit(Number(e.target.value), die, mod)} aria-label={`${label}: сколько кубиков`}>
          {countOpts.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <span className="muted">×</span>
        <select value={m ? die : 6} onChange={(e) => emit(count, Number(e.target.value), mod)} aria-label={`${label}: тип кости`}>
          {sideOpts.map((n) => (
            <option key={n} value={n}>d{n}</option>
          ))}
        </select>
        <span className="muted">+</span>
        <input
          type="number"
          value={m ? mod : 0}
          onChange={(e) => emit(count, die, Number(e.target.value) || 0)}
          data-tip="Модификатор (может быть отрицательным)"
          aria-label={`${label}: модификатор`}
        />
        {!compact && (
          <>
            <span className="muted">=</span>
            <span className="dmg-summary">{m ? summary : '—'}</span>
          </>
        )}
        {optional && raw && (
          <button type="button" className="btn btn-small ce-del" data-tip="Сбросить: не задано" onClick={() => onChange('')}>
            <Ico n="close" />
          </button>
        )}
      </div>
      {custom && (
        <span className="fld-err small" style={{ marginTop: 4, display: 'block' }}>
          Текущее значение «{raw}» не формата NdN±M — заменится, как только выберете кости.
        </span>
      )}
      {!raw && !optional && (
        <span className="fld-err small" style={{ marginTop: 4, display: 'block' }}>
          Значение не задано — выберите кости.
        </span>
      )}
      {!raw && optional && <span className="muted small" style={{ marginTop: 2, display: 'block' }}>не задано</span>}
    </label>
  )
}
