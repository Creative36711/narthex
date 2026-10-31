/**
 * Шапка редактора и наложенные окна страницы.
 *
 * Вынесено из `EditorApp.tsx`: шапка с меню «Файл», «Инструменты» и «Проект»
 * и модальные окна (аудит, мастер ИИ, книга мастера, занятость) читают общий
 * контекст страницы и не держат собственного состояния.
 */

import { Ico } from '../shared/icons'
import { navLabelOf } from './editorMenus'
import { askConfirm } from './prompt'
import { AiWizard } from './AiWizard'
import { CampaignAuditDialog } from './CampaignAuditDialog'
import { EditorBookPanel } from './EditorBookPanel'
import type { EditorUi } from './editorAppTypes'

/** Шапка: кампания, тема полотна, сохранение и меню редактора. */
export function EditorTopbar({ ui }: { ui: EditorUi }) {
  return (
      <header className="editor-topbar">
        <span className="editor-brand">
          <Ico n="forge" /> Narthex <span className="editor-brand-sub">· редактор</span>
        </span>
        <select
          className="editor-theme-select"
          value={ui.edTheme}
          onChange={(e) => ui.changeEdTheme(e.target.value as 'paper' | 'dark' | 'anthracite')}
          data-tip="Тема оформления редактора (рабочее полотно)"
          aria-label="Тема оформления редактора"
        >
          <option value="paper">Полотно: бумага</option>
          <option value="dark">Полотно: тёмная</option>
          <option value="anthracite">Полотно: графит</option>
        </select>
        {ui.campaigns.length > 0 ? (
          <select
            className="campaign-select"
            value={ui.base}
            onChange={async (e) => {
              const v = e.target.value
              if (ui.store.dirty.size && !(await askConfirm('Есть несохранённые изменения. Сменить кампанию без сохранения?', 'Сменить'))) return
              ui.setBase(v)
            }}
            data-tip="Кампания"
          >
            {ui.campaigns.map((c) => (
              // у открытой кампании показываем живое название из редактора: правка
              // «Кампания → название» видна в списке сразу, без «Сохранить»
              <option key={c.id} value={`/ui.campaigns/${c.id}`}>
                {`/ui.campaigns/${c.id}` === ui.base ? ui.store.meta.title : c.title}
              </option>
            ))}
            {!ui.campaigns.some((c) => `/ui.campaigns/${c.id}` === ui.base) && <option value={ui.base}>{ui.store.meta.title}</option>}
          </select>
        ) : (
          <span className="editor-title">{ui.store.meta.title}</span>
        )}
        <span className="editor-spacer" />
        <button className="btn btn-small" onClick={() => ui.store.undo()} disabled={!ui.store.canUndo()} data-tip="Отменить последнее изменение в кампании">
          <Ico n="undo" /> Отменить
        </button>
        <details className="editor-toolbar-menu">
          <summary className="btn btn-small">Файл <Ico n="chevron" /></summary>
          <div className="editor-toolbar-popup" onClick={(e) => { if ((e.target as HTMLElement).closest('button')) e.currentTarget.closest('details')?.removeAttribute('open') }}>
            <button className="editor-toolbar-item" onClick={ui.ops.save} disabled={!ui.store.dirty.size}><Ico n="download" /> Сохранить (Ctrl+S)</button>
            <button className="editor-toolbar-item" onClick={ui.ops.newCampaign}><Ico n="plus" /> Новая кампания</button>
            <div className="editor-toolbar-divider" />
            <div className="editor-toolbar-divider" />
            <button className="editor-toolbar-item" onClick={() => ui.fileInput.current?.click()}><Ico n="up" /> Импорт .narthex / патча…</button>
            <button className="editor-toolbar-item" onClick={() => ui.folderInput.current?.click()}><Ico n="folder" /> Импорт папки проекта…</button>
            <button className="editor-toolbar-item" onClick={ui.doImportJson}><Ico n="up" /> Импорт из JSON</button>
            <div className="editor-toolbar-divider" />
            <button
              className="editor-toolbar-item"
              onClick={ui.fileOps.doExportPatch}
              disabled={ui.modifiedCount === 0}
              data-tip={ui.modifiedCount > 0 ? `Экспортировать только изменённые файлы (${ui.modifiedCount}) в микро-архив` : 'Нет изменений относительно исходной базы'}
            >
              <Ico n="download" /> Экспорт правок для ИИ (.narthex)
              {ui.modifiedCount > 0 && <span className="ai-btn-badge">{ui.modifiedCount}</span>}
            </button>
            <button className="editor-toolbar-item" onClick={ui.fileOps.doExport}><Ico n="download" /> Экспорт всей кампании (.narthex)</button>
            <button className="editor-toolbar-item" onClick={ui.fileOps.doExportJson}><Ico n="download" /> Экспорт JSON (монолит)</button>
            <div className="editor-toolbar-divider" />
            <button className="editor-toolbar-item danger" onClick={ui.ops.deleteCampaign}><Ico n="trash" /> Удалить кампанию</button>
          </div>
        </details>
        <details className="editor-toolbar-menu">
          <summary className="btn btn-small">Инструменты <Ico n="chevron" /></summary>
          <div className="editor-toolbar-popup" onClick={(e) => { if ((e.target as HTMLElement).closest('button')) e.currentTarget.closest('details')?.removeAttribute('open') }}>
            <button
              className="editor-toolbar-item"
              onClick={() => ui.setAuditOpen(true)}
            ><Ico n="check" /> Проверить кампанию</button>
            <button className="editor-toolbar-item" onClick={() => ui.ops.openAiTask()}><Ico n="sparkle" /> Мастер ИИ</button>
            <button className="editor-toolbar-item" onClick={() => { ui.setBookFile('README.md'); ui.setBookContextual(false); ui.setBookOpen(true) }}><Ico n="book" /> Книга мастера</button>
            <div className="editor-toolbar-divider" />
            <button
              className="editor-toolbar-item"
              onClick={ui.toggleAiDiff}
              data-tip={ui.aiDiffEnabled ? 'Отключить счётчик и уведомления о правках для ИИ' : 'Включить отслеживание правок и микро-патчи для ИИ'}
            >
              <Ico n="sparkle" /> Подсчёт правок для ИИ: {ui.aiDiffEnabled ? 'Включён' : 'Отключён'}
            </button>
          </div>
        </details>
        {ui.busy && <span className="muted small">{ui.busy}</span>}
        <span className={`editor-dirty ${ui.store.dirty.size ? 'on' : ''}`}>
          {ui.store.dirty.size ? `несохранено: ${ui.store.dirty.size}` : 'все сохранено'}
        </span>
        <button className="btn btn-small btn-primary" onClick={ui.ops.save} disabled={!ui.store.dirty.size} data-tip="Записать изменения кампании на диск">
          <Ico n="download" /> Сохранить
        </button>
        <button className="btn btn-small editor-audit-button" onClick={() => ui.setAuditOpen(true)} data-tip="Запустить полный аудит кампании (проверка связей, баланса и ошибок)">
          <Ico n="check" /> Проверка
        </button>
        <button className="btn btn-small editor-ai-button" onClick={() => ui.ops.openAiTask()} data-tip="Помощник мастера и ИИ: пакет правок, аудит и чемодан">
          <Ico n="sparkle" /> Мастер ИИ
          {ui.modifiedCount > 0 && <span className="ai-btn-badge">{ui.modifiedCount}</span>}
        </button>
        <button className="btn btn-small editor-playtest-button" onClick={() => void ui.ops.playtest()} data-tip="Запустить игру поверх редактора без записи изменений на диск"><Ico n="play" /> Плейтест</button>
        <button className="btn btn-small" onClick={() => void ui.ops.exitEditor()} data-tip="Выйти в главное меню игры"><Ico n="exit" /> Выйти</button>
        <input
          ref={ui.fileInput}
          type="file"
          accept=".narthex,.chronicle,.zip"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) ui.doImport(f)
            e.target.value = ''
          }}
        />
        <input
          ref={ui.folderInput}
          type="file"
          // @ts-expect-error webkitdirectory is standard for folder picking
          webkitdirectory=""
          directory=""
          multiple
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files ?? [])
            e.target.value = ''
            if (files.length > 0) void ui.fileOps.doImportDirectory(files)
          }}
        />
      </header>
  )
}

/** Наложения поверх рабочей области: аудит, мастер ИИ, книга мастера, занятость. */
export function EditorOverlays({ ui }: { ui: EditorUi }) {
  return (
    <>
      {ui.auditOpen && (
        <CampaignAuditDialog
          store={ui.store}
          lastPlaytest={ui.lastPlaytest}
          onClose={() => ui.setAuditOpen(false)}
          onPrepareAi={(report) => { ui.setAuditOpen(false); ui.ops.openAiTask(report) }}
          onRunPlaytest={() => { ui.setAuditOpen(false); void ui.ops.playtest() }}
        />
      )}
      {ui.aiWizard && <AiWizard
        store={ui.store}
        hasCampaign={!!ui.base}
        lastPlaytest={ui.lastPlaytest}
        initialReport={ui.aiTaskReport}
        onClose={() => { ui.setAiWizard(false); ui.setAiTaskReport('') }}
      />}
      {ui.bookOpen && <EditorBookPanel section={ui.section} sectionLabel={navLabelOf(ui.section)} initialFile={ui.bookFile} contextual={ui.bookContextual} onClose={() => ui.setBookOpen(false)} />}
      {ui.busy && (
        <div className="editor-busy-overlay" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
          <div className="editor-busy-modal">
            <div className="spinner" />
            <div className="editor-busy-title">{ui.busy}</div>
            <div className="editor-busy-sub muted small">
              Пожалуйста, подождите: распаковка ресурсов и запись файлов кампании…
            </div>
          </div>
        </div>
      )}
    </>
  )
}
