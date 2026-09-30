import { useRef, useState } from 'react'
import { Ico } from '../shared/icons'
import { showAlert } from '../shared/modals'
import { importChroniclePackage } from '../editor/newCampaign'

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
      onImported((await importChroniclePackage(file)).id)
    } catch (e) {
      void showAlert('Не удалось импортировать кампанию', String(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="screen-center">
      <div className="panel no-campaign-panel">
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
          готовую кампанию из файла <code> .chronicle</code>.
        </p>
        {notice && <p className="no-campaign-notice" role="status">{notice}</p>}
        <div className="menu-buttons">
          <button className="btn btn-primary" onClick={() => void doCreate()} disabled={busy !== null}>
            <Ico n="hammer" /> {busy === 'create' ? 'Создаю кампанию…' : 'Создать кампанию'}
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()} disabled={busy !== null}>
            {busy === 'import' ? 'Загружаю…' : 'Загрузить кампанию (.chronicle)'}
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
      </div>
    </div>
  )
}
