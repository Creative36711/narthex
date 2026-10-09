import { useRef, useState } from 'react'
import { Ico } from '../shared/icons'
import { askConfirm, showAlert } from '../shared/modals'
import { importCampaignFromDirectory, importChroniclePackage } from '../editor/newCampaign'

interface Props {
  /** создаёт новую кампанию и открывает её в редакторе */
  onCreate: () => Promise<void>
  /** импорт пакета .chronicle, если игрок принёс свою кампанию */
  onImported: (id: string) => void
  /** необязательное пояснение, если записи были, но ни один пакет не открылся */
  notice?: string | null
}

/**
 * Пустой реестр кампаний: ни одной кампании на диске нет.
 *
 * Так бывает у свежей сборки (демо-кампания убрана, она осталась только
 * полигоном для смоуков) и после удаления последней кампании в редакторе.
 * Движок в этом состоянии обязан не падать, а показать два пути: создать
 * кампанию в редакторе или импортировать готовый пакет .chronicle.
 */
export function NoCampaignScreen({ onCreate, onImported, notice }: Props) {
  const [busy, setBusy] = useState<'create' | 'import' | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const folderRef = useRef<HTMLInputElement>(null)

  const doCreate = async () => {
    setBusy('create')
    try {
      await onCreate()
    } finally {
      setBusy(null)
    }
  }

  const doImport = async (file: File) => {
    setBusy('import')
    try {
      const entry = await importChroniclePackage(file, async (conflict) => {
        const update = await askConfirm(
          `ID «${conflict.id}» уже занят кампанией «${conflict.existingTitle}», а содержимое пакета отличается. Обновить её из «${conflict.incomingTitle}»?`,
          'Обновить кампанию',
        )
        if (update) return 'update'
        const copy = await askConfirm(
          `Импортировать «${conflict.incomingTitle}» как отдельную копию с новым ID?`,
          'Импортировать копию',
        )
        return copy ? 'copy' : 'cancel'
      })
      if (entry.cancelled) return
      onImported(entry.id)
      if (entry.alreadyInstalled) void showAlert('Кампания уже импортирована', `«${entry.title}» уже установлена; вторая копия не создана.`)
      if (entry.idWarning) void showAlert('ID кампании', entry.idWarning)
    } catch (e) {
      void showAlert('Не удалось импортировать кампанию', String(e))
    } finally {
      setBusy(null)
    }
  }

  const doImportDirectory = async (files: FileList | File[]) => {
    setBusy('import')
    try {
      const entry = await importCampaignFromDirectory(files, async (conflict) => {
        const update = await askConfirm(
          `ID «${conflict.id}» уже занят кампанией «${conflict.existingTitle}», а содержимое папки отличается. Обновить её из «${conflict.incomingTitle}»?`,
          'Обновить кампанию',
        )
        if (update) return 'update'
        const copy = await askConfirm(
          `Импортировать «${conflict.incomingTitle}» как отдельную копию с новым ID?`,
          'Импортировать копию',
        )
        return copy ? 'copy' : 'cancel'
      })
      if (entry.cancelled) return
      onImported(entry.id)
      if (entry.alreadyInstalled) void showAlert('Кампания уже импортирована', `«${entry.title}» уже установлена; вторая копия не создана.`)
      if (entry.idWarning) void showAlert('ID кампании', entry.idWarning)
    } catch (e) {
      void showAlert('Не удалось импортировать папку кампании', String(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="screen-center">
      <div className="panel no-campaign-panel" style={{ position: 'relative' }}>
        <div className="brand-row">
          <span className="brand">
            <Ico n="forge" /> Chronicle Forge
          </span>
        </div>
        <div className="brand-sub">движок тактических визуальных новелл</div>
        <h2>Кампаний пока нет</h2>
        <p>
          Ни одной кампании в <code>public/campaigns</code>. Создайте кампанию —
          сначала задайте ей название, затем откроется редактор. Движок подставит
          стартовую сцену, а вы опишете правила, квесты и диалоги. Или загрузите
          готовую кампанию из файла <code>.chronicle</code> или локальной папки.
        </p>
        {notice && <p className="no-campaign-notice" role="status">{notice}</p>}
        <div className="menu-buttons">
          <button className="btn btn-primary" onClick={() => void doCreate()} disabled={busy !== null}>
            <Ico n="hammer" /> {busy === 'create' ? 'Создаю кампанию…' : 'Создать кампанию'}
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()} disabled={busy !== null}>
            <Ico n="doc" /> {busy === 'import' ? 'Загружаю…' : 'Загрузить архив (.chronicle)'}
          </button>
          <button
            className="btn"
            data-tip="Импортировать локальную папку кампании (например из GitHub Desktop). Автоматически отфильтрует .git и tools/"
            onClick={() => folderRef.current?.click()}
            disabled={busy !== null}
          >
            <Ico n="folder" /> Импортировать папку
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".chronicle,.zip"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) void doImport(f)
          }}
        />
        <input
          ref={folderRef}
          type="file"
          // @ts-expect-error webkitdirectory is standard for folder picking
          webkitdirectory=""
          directory=""
          multiple
          style={{ display: 'none' }}
          onChange={(e) => {
            const files = Array.from(e.target.files ?? [])
            e.target.value = ''
            if (files.length > 0) void doImportDirectory(files)
          }}
        />
        {busy && (
          <div className="import-busy-overlay" onClick={(e) => e.stopPropagation()}>
            <div className="import-busy-card">
              <div className="spinner" />
              <div className="import-busy-title">
                {busy === 'create' ? 'Создание новой кампании…' : 'Распаковка и импорт кампании…'}
              </div>
              <div className="import-busy-sub muted small">
                Пожалуйста, подождите. Идёт запись файлов кампании на диск…
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

