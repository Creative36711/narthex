/**
 * Рабочая область редактора: навигация по разделам, список документов и сам
 * редактор выбранного документа.
 *
 * Вынесено из `EditorApp.tsx`: вкладки разделов и список строятся из манифеста
 * паков, все данные приходят из общего контекста страницы.
 */

import { Ico } from '../shared/icons'
import { SceneEditor } from './SceneEditor'
import { ArenaEditor } from './ArenaEditor'
import { RuleEditor } from './RuleEditor'
import { QuestEditor } from './QuestEditor'
import { DialogueHost } from './DialogueHost'
import { EntityEditor } from './EntityEditor'
import { CampaignEditor } from './CampaignEditor'
import { CombatRulesEditor } from './CombatRulesEditor'
import { WorldEditor } from './WorldEditor'
import { CutsceneEditor } from './CutsceneEditor'
import { RecipeEditor } from './RecipeEditor'
import { CodexEditor } from './CodexEditor'
import { MENUS, navLabelOf } from './editorMenus'
import { PackCatalogPanel } from './PackCatalogPanel'
import { PackPanelWorkbench } from './PackPanelWorkbench'
import { DesignDocPanel } from './DesignDocPanel'
import type { EditorUi } from './editorAppTypes'

/** Рабочая область: разделы, список документов раздела и открытый документ. */
export function EditorWorkspace({ ui }: { ui: EditorUi }) {
  return (
      <div className="editor-body">
        <nav className="editor-nav">
          {MENUS.map((menu) => {
            const active = menu.items.some((it) => it.id === ui.section)
            return (
              <div className="editor-nav-menu" key={menu.id} onClick={(e) => e.stopPropagation()}>
                <button
                  className={`editor-nav-btn ${active ? 'on' : ''}`}
                  onClick={() => ui.setOpenMenu(ui.openMenu === menu.id ? null : menu.id)}
                >
                  {menu.label}
                  <span className="editor-nav-caret"><Ico n="chevron" /></span>
                </button>
                {ui.openMenu === menu.id && (
                  <div className="editor-nav-popup">
                    {menu.items.map((it) => (
                      <button
                        key={it.id}
                        className={`editor-nav-btn ${ui.section === it.id ? 'on' : ''}`}
                        onClick={() => {
                          ui.setSection(it.id)
                          ui.setChapterF('')
                          ui.setSelected(null)
                          ui.setOpenMenu(null)
                        }}
                      >
                        {ui.section === it.id ? <Ico n="chevronRight" /> : ''}{it.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          <span className="muted small" style={{ marginLeft: 6 }}>{navLabelOf(ui.section)}</span>
          <button className="editor-help-button" type="button" aria-label="Открыть раздел книги" onClick={() => { ui.setBookFile('02-editor.md'); ui.setBookContextual(true); ui.setBookOpen(true) }}>?</button>
        </nav>

        {ui.hasList && (
          <aside className="editor-list">
            <input
              className="editor-list-search"
              placeholder="Поиск по названию…"
              value={ui.q}
              onChange={(e) => ui.setQ(e.target.value)}
            />
            {(ui.section === 'scenes' || ui.section === 'rules' || ui.section === 'quests' || ui.section === 'cutscenes') && (ui.store.meta.chapters?.length ?? 0) > 0 && (
              <select
                className="editor-list-chapter"
                value={ui.chapterF}
                data-tip="Фильтр по главе кампании (Проект → Основное → Главы)"
                onChange={(e) => ui.setChapterF(e.target.value)}
              >
                <option value="">все главы</option>
                <option value="-">без главы</option>
                {[...(ui.store.meta.chapters ?? [])]
                  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                  .map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            )}
            {ui.section === 'entities' && (
              <div className="chips editor-list-chips">
                {([['all', 'Все'], ['npc', 'Персонажи'], ['item', 'Предметы']] as const).map(([k, lbl]) => (
                  <button
                    key={k}
                    type="button"
                    className={`chip ${ui.kindF === k ? 'chip-on' : ''}`}
                    data-tip={k === 'npc' ? 'Только персонажи (NPC)' : k === 'item' ? 'Только предметы' : 'Все сущности подряд'}
                    onClick={() => ui.setKindF(k)}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            )}
            {ui.items.map((it, i) => (
              <div key={it.path}>
                {it.group && it.group !== ui.items[i - 1]?.group && (
                  <div className="editor-list-group">{it.group} <span className="editor-list-count">{ui.groupCounts.get(it.group)}</span></div>
                )}
                <button
                  className={`editor-list-item ${ui.sel === it.path ? 'on' : ''} ${ui.store.dirty.has(it.path) ? 'dirty' : ''}`}
                  onClick={() => ui.setSelected(it.path)}
                  data-tip={it.path}
                >
                  {it.title}
                </button>
              </div>
            ))}
            <div className="editor-list-tools">
              {ui.section === 'entities' ? (
                <>
                  <button className="btn btn-small" onClick={() => ui.createNew('item')}>+ предмет</button>
                  <button className="btn btn-small" onClick={() => ui.createNew('npc')}>+ NPC</button>
                </>
              ) : (
                <button className="btn btn-small" onClick={() => ui.createNew()} disabled={ui.section === 'quests' && ui.questsOff} title={ui.section === 'quests' && ui.questsOff ? 'Квесты выключены и доступны только для чтения' : undefined}>+ создать</button>
              )}
              {ui.sel && (
                <button className="btn btn-small ce-del" onClick={ui.ops.removeSelected} disabled={ui.section === 'quests' && ui.questsOff} title={ui.section === 'quests' && ui.questsOff ? 'Квесты выключены и доступны только для чтения' : undefined}><Ico n="close" /> </button>
              )}
            </div>
          </aside>
        )}

        <main className="editor-main">
          {ui.section === 'campaign' && <CampaignEditor key={`c-${ui.base}`} store={ui.store} />}
          {ui.section === 'packs' && <PackCatalogPanel store={ui.store} />}
          {ui.section === 'panels' && <PackPanelWorkbench key={`pp-${ui.base}`} store={ui.store} />}
          {ui.section === 'design' && <DesignDocPanel key={`d-${ui.base}`} store={ui.store} onEditWithAi={() => ui.ops.openAiTask()} />}
          {ui.section === 'combat' && <CombatRulesEditor key={`cb-${ui.base}`} store={ui.store} />}
          {ui.section === 'world' && <WorldEditor key={`w-${ui.base}`} store={ui.store} />}
          {ui.section === 'scenes' && ui.sel && <SceneEditor key={ui.sel} store={ui.store} path={ui.sel} onPlaytestScene={(sceneId) => void ui.ops.playtest(sceneId)} />}
          {ui.section === 'entities' && ui.sel && <EntityEditor key={ui.sel} store={ui.store} path={ui.sel} />}
          {ui.section === 'rules' && ui.sel && <RuleEditor key={ui.sel} store={ui.store} path={ui.sel} />}
          {ui.section === 'quests' && ui.sel && ui.questsOff ? (
            <section className="panel" style={{ maxWidth: 1080, margin: '20px auto', padding: 24 }}>
              <strong>Квесты выключены · только чтение</strong>
              <p className="muted">Данные сохранены без изменений. Включите «Квесты и стадии» в разделе «Проект → Каталог паков», чтобы продолжить редактирование.</p>
              <pre style={{ overflow: 'auto', whiteSpace: 'pre-wrap' }}>{JSON.stringify(ui.store.jsonFiles.get(ui.sel), null, 2) ?? 'Нет данных'}</pre>
            </section>
          ) : ui.section === 'quests' && ui.sel ? <QuestEditor key={ui.sel} store={ui.store} path={ui.sel} /> : null}
          {ui.section === 'dialogues' && ui.sel && <DialogueHost key={ui.sel} store={ui.store} path={ui.sel} />}
          {ui.section === 'arenas' && ui.sel && <ArenaEditor key={ui.sel} store={ui.store} path={ui.sel} />}
          {ui.section === 'cutscenes' && ui.sel && <CutsceneEditor key={ui.sel} store={ui.store} path={ui.sel} />}
          {ui.section === 'recipes' && ui.sel && <RecipeEditor key={ui.sel} store={ui.store} path={ui.sel} />}
          {ui.section === 'codex' && ui.sel && <CodexEditor key={ui.sel} store={ui.store} path={ui.sel} />}
          {ui.hasList && !ui.sel && (
            <div className="editor-empty-main">
              <p className="editor-empty-title">
                {ui.items.length === 0 ? 'В этом разделе пока пусто' : 'Ничего не выбрано'}
              </p>
              <p className="muted small">
                {ui.items.length === 0
                  ? 'Создайте первую запись — или импортируйте JSON / чемодан ИИ.'
                  : 'Выберите элемент слева или создайте новый.'}
              </p>
              <div className="editor-empty-actions">
                {ui.section === 'entities' ? (
                  <>
                    <button type="button" className="btn btn-primary" onClick={() => ui.createNew('npc')}>
                      + Персонаж
                    </button>
                    <button type="button" className="btn" onClick={() => ui.createNew('item')}>
                      + Предмет
                    </button>
                  </>
                ) : (
                  <button type="button" className="btn btn-primary" onClick={() => ui.createNew()}>
                    + Создать
                  </button>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
  )
}
