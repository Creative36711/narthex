import { useRef, useState } from 'react'
import { Ico } from '../shared/icons'
import { showAlert } from '../shared/modals'
import { importChroniclePackage } from '../editor/newCampaign'

interface Props {
  /** импорт пакета .chronicle, если игрок принёс свою кампанию */
  onImported: (id: string) => void
  onEditor: () => void
}

/**
 * Пустой реестр кампаний: ни одной кампании на диске нет.
 *
 * Так бывает у свежей сборки (демо-кампания убрана, она осталась только
 * полигоном для смоуков) и после удаления последней кампании в редакторе.
 * Движок в этом состоянии обязан не падать, а показать два пути: создать
 * кампанию в редакторе или импортировать готовый пакет .chronicle.
 */
export function NoCampaignScreen({ onImported, onEditor }: Props) {
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const doImport = async (file: File) => {
    setBusy(true)
    try {
      onImported((await importChroniclePackage(file)).id)
    } catch (e) {
      void showAlert('Не удалось импортировать кампанию', String(e))
    } finally {
      setBusy(false)
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
          Ни одной кампании в <code>public/campaigns</code>. Создайте свою в
          редакторе — движок подставит стартовую сцену, а вы опишете правила,
          квесты и диалоги. Готовую кампанию можно импортировать файлом
          <code> .chronicle</code>.
        </p>
        <div className="menu-buttons">
          <button className="btn btn-primary" onClick={onEditor}>
            <Ico n="hammer" /> Создать кампанию
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()} disabled={busy}>
            {busy ? 'Импортирую…' : 'Импортировать .chronicle'}
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".chronicle,application/json"
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
