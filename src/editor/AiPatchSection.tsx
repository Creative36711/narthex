/**
 * Блок ручных правок мастера в задании для ИИ: список изменённых файлов,
 * выбор состава чемодана и точка отсчёта.
 *
 * Вынесено из `AiWizard.tsx`: у блока свой набор подписей и раскрывающийся
 * список правок, а вкладка задания оставляет за собой поле задачи и действия.
 */

import { Ico } from '../shared/icons'

import type { AiBundleScope } from './aiTask'
import type { ModifiedFileEntry } from './store'

interface Props {
  modifiedFiles: ModifiedFileEntry[]
  filteredMods: ModifiedFileEntry[]
  categoryCountsSummary: string
  patchFilter: string
  bundleScope: AiBundleScope
  aiDiffTracking: boolean
  onPatchFilter: (value: string) => void
  onBundleScope: (value: AiBundleScope) => void
  onToggleAiDiffTracking: () => void
  onResetDiffBaseline: () => void
  onAcceptChange: (path: string) => void
}

export function AiPatchSection(props: Props) {
  const { modifiedFiles, filteredMods, categoryCountsSummary, patchFilter, bundleScope, aiDiffTracking } = props
  return (
    <>
        {/* Блок ручных правок мастера (аккордеон/спойлер с защитой от распирания) */}
        <div className="ai-patch-box">
          <details className="ai-patch-spoiler" open={modifiedFiles.length > 0 && modifiedFiles.length <= 8}>
            <summary className="ai-patch-summary-row">
              <span className="ai-patch-summary-left">
                <Ico n="download" />
                <strong>Ваши правки в редакторе:</strong>{' '}
                {modifiedFiles.length === 0 ? (
                  <span className="muted">нет отличий от исходной базы</span>
                ) : (
                  <span className="ai-patch-count-highlight">
                    {modifiedFiles.length} {modifiedFiles.length === 1 ? 'файл' : modifiedFiles.length < 5 ? 'файла' : 'файлов'}
                    {categoryCountsSummary ? ` (${categoryCountsSummary})` : ''}
                  </span>
                )}
              </span>
              <span className="ai-spoiler-caret"><Ico n="chevron" /></span>
            </summary>

            {modifiedFiles.length > 0 && (
              <div className="ai-patch-expanded-body">
                {/* Поиск при большом количестве файлов */}
                {modifiedFiles.length > 6 && (
                  <div className="ai-patch-filter-wrap">
                    <input
                      type="text"
                      className="ai-patch-filter-input"
                      placeholder="Фильтр по названию или пути…"
                      value={patchFilter}
                      onChange={(e) => props.onPatchFilter(e.target.value)}
                    />
                    <span className="muted small">Показано: {filteredMods.length} из {modifiedFiles.length}</span>
                  </div>
                )}

                {/* Скроллируемый контейнер с жестким ограничением высоты */}
                <div className="ai-patch-scroll-container">
                  {filteredMods.map((m: ModifiedFileEntry) => (
                    <div key={m.path} className={`ai-patch-row status-${m.status}`}>
                      <span className={`ai-status-badge badge-${m.status}`}>
                        {m.status === 'added' ? 'новый' : m.status === 'deleted' ? 'удалён' : 'изменён'}
                      </span>
                      <div className="ai-patch-row-details">
                        <span className="ai-patch-row-title">{m.title}</span>
                        <span className="ai-patch-row-path muted small">{m.path}</span>
                        {m.diffSummary && (
                          <span className="ai-patch-row-diff">{m.diffSummary}</span>
                        )}
                      </div>
                      <button
                        type="button"
                        className="btn btn-small ai-patch-drop"
                        aria-label="Убрать эту правку из списка"
                        data-tip="Убрать эту правку из списка: её текущее состояние станет базовым (правки остальных файлов сохранятся)"
                        onClick={() => props.onAcceptChange(m.path)}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>

                <div className="ai-patch-mini-actions">
                  <button
                    type="button"
                    className="btn btn-small"
                    onClick={props.onResetDiffBaseline}
                    data-tip="Считать текущее состояние исходной базой (список правок сразу очистится)"
                  >
                    Зафиксировать как новую базу
                  </button>
                </div>
              </div>
            )}
          </details>
        </div>

        {/* Выбор объёма чемодана */}
        <div className="fld fld-block" style={{ margin: 0 }}>
          <span style={{ fontWeight: 600 }}>Состав скачиваемого архива:</span>
          <div className="ai-scope-selector">
            <label className={`ai-scope-card ${bundleScope === 'patch' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="bundleScope"
                checked={bundleScope === 'patch'}
                onChange={() => props.onBundleScope('patch')}
              />
              <div className="ai-scope-text">
                <div className="ai-scope-title">
                  ⚡ Только мои правки + инструменты ИИ <span className="ai-scope-size">(~60–90 КБ)</span>
                </div>
            <div className="ai-scope-desc muted small">
              Идеально для чата. Содержит только изменённые вами файлы, задачу, схемы и гайд движка. Музыка и картинки не дублируются.
            </div>
          </div>
        </label>

        <label className={`ai-scope-card ${bundleScope === 'full' ? 'selected' : ''}`}>
          <input
            type="radio"
            name="bundleScope"
            checked={bundleScope === 'full'}
            onChange={() => props.onBundleScope('full')}
          />
          <div className="ai-scope-text">
            <div className="ai-scope-title">
              📦 Вся кампания целиком с медиа <span className="ai-scope-size">(полный архив, 20+ МБ)</span>
            </div>
            <div className="ai-scope-desc muted small">
              Включает все сцены, звуки, портреты и музыку. Нужен только при передаче проекта новому агенту с нуля.
            </div>
          </div>
        </label>
      </div>
      <label className="ai-diff-toggle-row muted small" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 10, cursor: 'pointer', userSelect: 'none' }}>
        <input
          type="checkbox"
          checked={aiDiffTracking}
          onChange={props.onToggleAiDiffTracking}
        />
        <span>Отслеживать ручные правки мастера и показывать счётчик изменений в редакторе</span>
      </label>
      <div className="muted small" style={{ marginTop: 4 }}>
        Список правок копится с момента последнего принятого чемодана ИИ и сохраняется между сессиями — редактор и игру можно закрывать полностью.
      </div>
      <button
        type="button"
        className="btn btn-small"
        style={{ marginTop: 6 }}
        onClick={props.onResetDiffBaseline}
        data-tip="Считать текущее состояние кампании точкой отсчёта: список ручных правок очистится"
      >⟲ Начать отсчёт правок заново</button>
    </div>
    </>
  )
}
