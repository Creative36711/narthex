import { DEFAULT_EMOTION } from '../shared/types'
import { Ico } from '../shared/icons'
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import type { EditorStore } from './store'
import { makeId } from './ids'
import { askText, askConfirm } from './prompt'
import { FlagSelect, AudioUpload } from './Fields'
import { META_COUNTER_KEYS } from './schemas'
import { showList } from '../shared/modals'
import { inkToDlgDoc } from './inkImport'
import { DialogueScriptView } from './DialogueScriptView'
import { DialoguePlaytest } from './DialoguePlaytest'

// Monaco тянет за собой свои стили: подгружаем редактор кода только когда мастер
// действительно открыл вкладку «Служебный ink» (и смоуки не тащат его в Node)
const InkEditor = lazy(() => import('./MonacoEditors').then((m) => ({ default: m.InkEditor })))

import { dlgToScript, scriptToDlg, storeRefs, type ScriptIssue } from './dlgScript'

/** человеческие подписи счётчиков хроники (условие «счётчик хроники») */
const META_COUNTER_LABELS: Record<string, string> = {
  endings_seen: 'Увидено концовок',
  runs: 'Забегов',
  deaths: 'Смертей',
  victories: 'Побед',
  kills: 'Убийств',
  quests_completed: 'Выполнено квестов',
  ticks_survived: 'Прожито тиков',
  travels: 'Переходов',
  dialogues: 'Разговоров',
}
import {
  generateInk,
  migrateDlgDoc,
  parseTokens,
  tokenString,
  TOKEN_KINDS,
  type TokenKind,
  type DlgCheck,
  type DlgChoice,
  type DlgCond,
  type DlgDoc,
  type DlgEffect,
  type DlgEmotion,
  type DlgLine,
  type DlgNode,
  type DlgSection,
  type DlgStep,
} from './dialogueDoc'

/**
 * Визуальный конструктор диалогов: узлы, реплики, условия, проверки навыков
 * и ответы — формами; .ink генерируется автоматически. Никакого кода.
 */

/** настроения для диалога: общий реестр кампании (фидбек 9.14) + ключи портретов NPC */
function emotionsFor(store: EditorStore, inkPath: string): Array<{ id: DlgEmotion; label: string }> {
  const reg = store.meta.emotions ?? []
  const out: Array<{ id: DlgEmotion; label: string }> = [
    { id: DEFAULT_EMOTION.id, label: DEFAULT_EMOTION.label },
    ...reg.filter((e) => e.id !== DEFAULT_EMOTION.id).map((e) => ({ id: e.id, label: e.label })),
  ]
  for (const p of store.entityPaths()) {
    const e = store.entity(p)
    if (e?.type !== 'npc' || e.dialogue !== inkPath) continue
    for (const key of Object.keys(e.portrait ?? {})) {
      if (!out.some((em) => em.id === key)) out.push({ id: key, label: key })
    }
  }
  return out
}

const EFFECT_TYPES: Array<{ id: DlgEffect['type']; label: string }> = [
  { id: 'set_flag', label: 'Поставить флаг' },
  { id: 'clear_flag', label: 'Сбросить флаг' },
  { id: 'add_item', label: 'Дать предмет' },
  { id: 'remove_item', label: 'Забрать предмет' },
  { id: 'change_need', label: 'Изменить потребность' },
  { id: 'change_hp', label: 'Изменить здоровье' },
  { id: 'change_disposition', label: 'Изменить отношение' },
  { id: 'advance_time', label: 'Промотать время' },
  { id: 'sleep', label: 'Сон (время + отдых)' },
  { id: 'start_quest', label: 'Начать квест' },
  { id: 'join_party', label: 'Взять в отряд' },
  { id: 'leave_party', label: 'Напарник покидает отряд' },
  { id: 'change_companion_need', label: 'Изменить потребность напарника' },
  { id: 'transfer_to_companion', label: 'Передать предмет напарнику' },
  { id: 'play_cutscene', label: 'Показать катсцену' },
  { id: 'set_description', label: 'Изменить описание' },
  { id: 'apply_status', label: 'Наложить статус' },
  { id: 'remove_status', label: 'Снять статус' },
  { id: 'set_weather', label: 'Сменить погоду' },
  { id: 'unlock_codex', label: 'Открыть запись кодекса' },
  { id: 'unlock_recipe', label: 'Открыть рецепт крафта' },
  { id: 'open_trade', label: 'Открыть торговлю (завершает разговор)' },
  { id: 'open_craft', label: 'Открыть изготовление (завершает разговор)' },
  { id: 'fire_rule', label: 'Запустить правило (завершает разговор)' },
  { id: 'set_entity_state', label: 'Сменить облик персонажа' },
  { id: 'learn_name', label: 'Раскрыть настоящее имя персонажа' },
  { id: 'go_to_scene', label: 'Перейти в другую сцену' },
  { id: 'start_combat', label: 'Начать бой (завершает разговор)' },
  { id: 'change_scene_state', label: 'Сменить состояние/декорацию сцены' },
  { id: 'game_over_death', label: 'Гибель / поражение (завершает игру)' },
  { id: 'game_over_victory', label: 'Победа / триумф (завершает игру)' },
]

function blankEffect(type: DlgEffect['type']): DlgEffect {
  switch (type) {
    case 'set_flag': return { type, flag: '' }
    case 'clear_flag': return { type, flag: '' }
    case 'add_item': return { type, item: '', qty: 1 }
    case 'remove_item': return { type, item: '', qty: 1 }
    case 'fire_rule': return { type, rule: '' }
    case 'join_party': return { type, npc: '' }
    case 'leave_party': return { type, npc: '' }
    case 'change_companion_need': return { type, npc: '', need: '', delta: 10 }
    case 'transfer_to_companion': return { type, npc: '', item: '', qty: 1 }
    case 'open_trade': return { type, npc: '' }
    case 'start_quest': return { type, quest: '' }
    case 'advance_time': return { type, ticks: 1 }
    case 'change_need': return { type, need: '', delta: 10 }
    case 'change_hp': return { type, delta: 5 }
    case 'sleep': return { type, ticks: 8 }
    case 'change_disposition': return { type, target: '', delta: 5 }
    case 'play_cutscene': return { type, cutscene: '' }
    case 'set_description': return { type, entity: '', text: '' }
    case 'apply_status': return { type, status: '' }
    case 'remove_status': return { type, status: '' }
    case 'set_weather': return { type, weather: '' }
    case 'unlock_codex': return { type, entry: '' }
    case 'unlock_recipe': return { type, recipe: '' }
    case 'open_craft': return { type, recipe: '' }
    case 'set_entity_state': return { type, entity: '', state: '' }
    case 'learn_name': return { type, entity: '' }
    case 'go_to_scene': return { type, scene: '', close_dialogue: true }
    case 'start_combat': return { type, arena: '' }
    case 'change_scene_state': return { type, state: '' }
    case 'game_over_death': return { type, message: '' }
    case 'game_over_victory': return { type, message: '' }
    case 'present_item': return { type, ok: '', fail: '' }
  }
}

const COND_TYPES: Array<{ id: string; label: string }> = [
  { id: 'flag', label: 'Флаг установлен' },
  { id: 'flag!', label: 'Флага НЕТ' },
  { id: 'npc_known', label: 'Имя персонажа раскрыто' },
  { id: 'npc_known!', label: 'Имя персонажа НЕ раскрыто' },
  { id: 'item_ge', label: 'Предметов не меньше' },
  { id: 'item_ge!', label: 'Предметов меньше' },
  { id: 'has_item', label: 'Есть предмет' },
  { id: 'has_item!', label: 'Нет предмета' },
  { id: 'disp_ge', label: 'Отношение не ниже' },
  { id: 'disp_ge!', label: 'Отношение ниже' },
  { id: 'quest', label: 'Квест на стадии' },
  { id: 'quest!', label: 'Квест НЕ на стадии' },
  { id: 'in_party', label: 'В отряде' },
  { id: 'in_party!', label: 'НЕ в отряде' },
  { id: 'hp_ge', label: 'Здоровье не ниже' },
  { id: 'hp_ge!', label: 'Здоровье ниже' },
  { id: 'has_status', label: 'Есть статус' },
  { id: 'has_status!', label: 'Статуса НЕТ' },
  { id: 'weather_is', label: 'Погода сейчас' },
  { id: 'weather_is!', label: 'Погода НЕ такая' },
  { id: 'skill_ge', label: 'Навык не ниже' },
  { id: 'skill_ge!', label: 'Навык ниже' },
  { id: 'meta_counter', label: 'Счётчик хроники не ниже' },
  { id: 'meta_counter!', label: 'Счётчик хроники ниже' },
]

function blankCond(key: string): DlgCond {
  const not = key.endsWith('!') || undefined
  const type = key.replace(/!$/, '') as DlgCond['type']
  switch (type) {
    case 'flag': return { type, flag: '', not }
    case 'npc_known': return { type, entity: '', not }
    case 'item_ge': return { type, item: '', count: 1, not }
    case 'has_item': return { type, item: '', not }
    case 'disp_ge': return { type, target: '', value: 10, not }
    case 'quest': return { type, quest: '', stage: '', not }
    case 'in_party': return { type, npc: '', not }
    case 'hp_ge': return { type, value: 10, not }
    case 'has_status': return { type, status: '', not }
    case 'weather_is': return { type, weather: '', not }
    case 'skill_ge': return { type, skill: '', threshold: 40, not }
    case 'meta_counter': return { type, key: 'endings_seen', ge: 1, not }
  }
}

function condKey(c: DlgCond): string {
  return c.not ? `${c.type}!` : c.type
}

// ─────────────── корень конструктора ───────────────

/** флаги, придуманные в сценарии, дописываем в реестр кампании (ремонт молча) */
function registerNewFlags(store: EditorStore, list: Array<{ id: string; label: string }>, note: string): boolean {
  if (!list.length) return false
  const flags = (store.meta.flags ??= [])
  let added = false
  for (const f of list) {
    if (flags.some((x) => x.id === f.id || x.label === f.label)) continue
    flags.push({ id: f.id, label: f.label, description: note })
    added = true
  }
  if (added) store.touch('campaign.json')
  return added
}

type DlgMode = 'script' | 'form' | 'ink'

let lastDlgMode: DlgMode = (() => {
  try {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('cf_dlg_mode') : null
    if (saved === 'script' || saved === 'form' || saved === 'ink') return saved
  } catch {}
  return 'script'
})()

/**
 * Диалог в трёх видах одного документа (фидбек 29):
 *  • «Сценарий» — мастерский текст словами (по умолчанию, это рабочий вид);
 *  • «Конструктор» — формы для точной правки структуры;
 *  • «Служебный ink» — то, что исполняет движок; можно править код и вернуть
 *    его обратно в формы (импорт).
 */
export function DialogueBuilder({ store, path }: { store: EditorStore; path: string }) {
  const dlgPath = path.replace(/\.ink$/, '.dlg.json')
  const raw = store.jsonFiles.get(dlgPath)
  const [nodeIdx, setNodeIdx] = useState(0)
  const [mode, setModeState] = useState<DlgMode>(lastDlgMode)
  const setMode = (m: DlgMode) => {
    lastDlgMode = m
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem('cf_dlg_mode', m)
    } catch {}
    setModeState(m)
  }
  const [playtest, setPlaytest] = useState(false)
  const [, force] = useState(0)

  const refs = useMemo(() => storeRefs(store, dlgPath), [store, dlgPath])
  /** документ без реестров: их применит эффект ниже — он же покажет ошибки строками */
  const doc = useMemo(() => (raw ? migrateDlgDoc(raw) : null), [raw])
  const [scriptText, setScriptText] = useState<string>(() =>
    doc ? (doc.script ?? dlgToScript(doc, refs)) : '')
  const [issues, setIssues] = useState<ScriptIssue[]>([])

  // придуманные в сценарии, но не зарегистрированные флаги — НЕ пишем в
  // реестр при просмотре (иначе простой осмотр диалога меняет campaign.json
  // и всплывёт как «изменение» в списке ИИ-мастера); регистрируем при первой
  // настоящей правке мастера (см. commit)
  const [pendingFlags, setPendingFlags] = useState<Array<{ id: string; label: string }>>([])

  useEffect(() => {
    if (!doc) return
    let dirty = doc !== raw // миграция v1 → v2 на месте
    if (doc.script === undefined) {
      doc.script = dlgToScript(doc, refs) // разговор пришёл из ink/форм — сразу показываем текстом
      dirty = true
    }
    if (doc.script && !doc.nodes.length) {
      // документ от ИИ: пришёл текстом без структуры — разбираем и показываем ошибки
      const res = scriptToDlg(doc.script, refs, doc)
      doc.nodes = res.doc.nodes
      if (res.doc.label !== undefined) doc.label = res.doc.label
      setIssues(res.issues)
      setPendingFlags(res.newFlags)
      dirty = true
    }
    if (dirty) {
      store.jsonFiles.set(dlgPath, doc)
      // производная нормализация (миграция/парс при открытии) — не правка
      // мастера: пиннем её как точку отсчёта, чтобы просмотр не всплывал в списке изменений
      store.acceptChangeAsBaseline(dlgPath)
    }
  }, [doc, raw, dlgPath, store, refs])

  if (!doc) return null

  const commit = (group = '') => {
    // правка мастера по-настоящему легла — теперь регистрация придуманных в
    // сценарии флагов законна и честно всплывёт как изменение campaign.json
    if (pendingFlags.length) {
      registerNewFlags(store, pendingFlags, `Придуман в разговоре «${doc.label ?? store.dialogueLabel(path)}».`)
      setPendingFlags([])
    }
    store.textFiles.set(path, generateInk(doc))
    store.touch(dlgPath, group)
    store.touch(path, group)
    force((n) => n + 1)
  }

  const registerFlags = (list: Array<{ id: string; label: string }>) => {
    registerNewFlags(store, list, `Придуман в разговоре «${doc.label ?? store.dialogueLabel(path)}».`)
  }

  /** правка сценария: разбираем текст и обновляем структуру того же документа */
  const applyScript = (text: string) => {
    setScriptText(text)
    const res = scriptToDlg(text, refs, doc)
    doc.nodes = res.doc.nodes
    if (res.doc.label !== undefined) doc.label = res.doc.label
    doc.script = text
    registerFlags(res.newFlags)
    setIssues(res.issues)
    commit('script')
  }

  /** правка формы: структура изменилась — текст сценария пересобираем */
  const commitForm = () => {
    commit()
    const text = dlgToScript(doc, refs)
    doc.script = text
    setScriptText(text)
    setIssues([])
  }

  /** правка служебного ink: читаем применённый код обратно в формы и в текст */
  const applyInk = () => {
    const ink = store.textFiles.get(path) ?? generateInk(doc)
    const { doc: imported, warnings } = inkToDlgDoc(ink)
    doc.nodes = imported.nodes
    if (imported.label) doc.label = imported.label
    const text = dlgToScript(doc, refs)
    doc.script = text
    setScriptText(text)
    setIssues([])
    commit()
    if (warnings.length) {
      void showList('Ink прочитан с замечаниями', warnings, 'Строки из списка нужно доделать в конструкторе или в сценарии.')
    }
  }

  const node = doc.nodes[Math.min(nodeIdx, Math.max(0, doc.nodes.length - 1))]
  const emotions = emotionsFor(store, path)

  const addNode = async () => {
    const label = await askText('Название узла разговора', 'например «Расспросить о банде»')
    if (!label) return
    doc.nodes.push({
      id: makeId('node_', label, doc.nodes.map((n) => n.id)),
      label,
      sections: [{ steps: [{ kind: 'line', line: { text: '' } }] }],
      choices: [{ text: 'Назад.', sections: [], goto: doc.nodes[0]?.id ?? 'end' }],
    })
    setNodeIdx(doc.nodes.length - 1)
    commitForm()
  }

  const counts = { nodes: doc.nodes.length, choices: doc.nodes.reduce((n, x) => n + x.choices.length, 0) }

  return (
    <div className="dlg-builder">
      <div className="dlg-head">
        <label className="fld dlg-title-field">
          <span>Название разговора</span>
          <input
            value={doc.label ?? ''}
            placeholder="например «Алдрик, стражник ворот»"
            onChange={(e) => {
              doc.label = e.target.value || undefined
              commitForm()
            }}
          />
        </label>
        <div className="dlg-tabs">
          <button className={`btn btn-small ${mode === 'script' ? 'btn-primary' : ''}`} onClick={() => setMode('script')}
            data-tip="Мастерский текст: реплики, ремарки, варианты, условия и эффекты словами">
            <Ico n="doc" /> Сценарий
          </button>
          <button className={`btn btn-small ${mode === 'form' ? 'btn-primary' : ''}`} onClick={() => { setMode('form'); if (!doc.script) commitForm() }}
            data-tip="Поля и списки: точная правка структуры разговора">
            <Ico n="edit" /> Конструктор
          </button>
          <button className={`btn btn-small ${mode === 'ink' ? 'btn-primary' : ''}`} onClick={() => setMode('ink')}
            data-tip="То, что исполняет движок. Можно править код и вернуть правку в формы">
            <Ico n="doc" /> Служебный ink
          </button>
          <span className="muted small dlg-counts">{counts.nodes} узл., {counts.choices} вариант(ов)</span>
        </div>
      </div>

      {mode === 'script' && (
        <DialogueScriptView
          doc={doc}
          value={scriptText}
          issues={issues}
          onText={applyScript}
          onPlaytest={() => setPlaytest(true)}
        />
      )}

      {mode === 'form' && (
        <div className="dlg-form-wrap">
          <div className="dlg-nodes">
            <div className="fld-caption">Узлы разговора</div>
            {doc.nodes.map((n, i) => (
              <button
                key={n.id}
                className={`editor-list-item ${i === nodeIdx ? 'on' : ''}`}
                onClick={() => setNodeIdx(i)}
              >
                {n.label}
              </button>
            ))}
            <div className="editor-list-tools">
              <button className="btn btn-small" onClick={addNode}>+ узел</button>
              {nodeIdx > 0 && (
                <button
                  className="btn btn-small ce-del"
                  onClick={async () => {
                    if (!(await askConfirm(`Удалить узел «${node!.label}»?`, 'Удалить'))) return
                    doc.nodes.splice(nodeIdx, 1)
                    setNodeIdx(0)
                    commitForm()
                  }}
                >
                  <Ico n="close" />
                </button>
              )}
            </div>
            <div className="muted small" style={{ marginTop: 8 }}>
              Разговор начинается с первого узла. Ответы ведут в другие узлы, остаются на месте или заканчивают разговор.
              Правки формы пересобирают текст сценария.
            </div>
          </div>

          <div className="dlg-node-form">
            {node && <NodeForm key={node.id} node={node} doc={doc} store={store} commit={commitForm} emotions={emotions} />}
          </div>
        </div>
      )}

      {mode === 'ink' && (
        <div className="dlg-ink advanced-json-page">
          <div className="muted small">
            Служебный Ink-исходник разговора — то, что читает движок. Мастеру его знать не обязательно:
            текст сценария и формы собирают этот код сами. Правку кода можно вернуть в удобный вид
            кнопкой «Перечитать в формы» (условия, варианты и переходы станут узлами).
          </div>
          <Suspense fallback={<div className="muted small">Открываю редактор кода…</div>}>
            <InkEditor
              key={path}
              store={store}
              path={path}
              onApplied={applyInk}
              extra={(
                <button className="btn btn-small" onClick={applyInk} data-tip="Прочитать применённый код обратно в конструктор и текст сценария">
                  <Ico n="check" /> Перечитать в формы
                </button>
              )}
            />
          </Suspense>
        </div>
      )}

      {playtest && (
        <DialoguePlaytest store={store} path={path} doc={doc} onClose={() => setPlaytest(false)} />
      )}
    </div>
  )
}

/** есть ли у ink визуальный исходник конструктора */
export function hasDlgDoc(store: EditorStore, inkPath: string): boolean {
  return store.jsonFiles.has(inkPath.replace(/\.ink$/, '.dlg.json'))
}

/** название диалога (для списков): подпись документа, иначе имя персонажа-собеседника */
export function dialogueTitle(store: EditorStore, inkPath: string): string {
  return store.dialogueLabel(inkPath)
}

// ─────────────── узел ───────────────

function NodeForm({
  node,
  doc,
  store,
  commit,
  emotions,
}: {
  node: DlgNode
  doc: DlgDoc
  store: EditorStore
  commit: () => void
  emotions: Array<{ id: DlgEmotion; label: string }>
}) {
  return (
    <div className="rule-editor">
      <div className="props-group">
        <h4>Узел: {node.label}</h4>
        <label className="fld">
          <span>Название узла (видно только мастеру)</span>
          <input value={node.label} onChange={(e) => ((node.label = e.target.value), commit())} />
        </label>
      </div>

      <div className="props-group">
        <h4>Реплики НПС</h4>
        <SectionListEditor sections={node.sections} doc={doc} store={store} commit={commit} emotions={emotions} />
        {node.choices.length === 0 && (
          <GotoSelect
            label="После реплик"
            doc={doc}
            value={node.goto ?? 'end'}
            allowStay={false}
            onChange={(v) => ((node.goto = v), commit())}
          />
        )}
      </div>

      <div className="props-group">
        <h4>Таймер на раздумье</h4>
        <div className="muted small" style={{ marginBottom: 8 }}>
          Сколько секунд игрок может думать над ответами. Истекло — разговор уходит в выбранный
          узел или заканчивается. Работает, когда у узла есть варианты ответа; в игре видна полоска
          обратного отсчёта.
        </div>
        <div className="fld-row">
          <label className="fld fld-num" data-tip="Пусто или 0 — без ограничения времени">
            <span>Секунд на раздумье</span>
            <input
              type="number"
              min={0}
              value={node.timer?.seconds ?? 0}
              onChange={(e) => {
                const v = Math.max(0, Math.round(Number(e.target.value) || 0))
                if (v > 0) node.timer = { seconds: v, node: node.timer?.node }
                else delete node.timer
                commit()
              }}
            />
          </label>
          <GotoSelect
            label="Если игрок промолчал"
            doc={doc}
            value={node.timer?.node ?? 'end'}
            allowStay
            onChange={(v) => {
              if (!node.timer) return
              node.timer = { seconds: node.timer.seconds, node: v === 'end' ? undefined : v }
              commit()
            }}
          />
        </div>
        {!node.timer && <div className="muted small">Сейчас без таймера: игрок может думать сколько угодно.</div>}
      </div>

      <div className="props-group">
        <h4>Варианты ответа игрока</h4>
        {node.choices.length > 0 &&
          !node.choices.some((c) => !c.once && (!c.conds || c.conds.length === 0)) && (
            <div className="dlg-warn">
              <Ico n="warn" />  Нет всегда доступного варианта — конструктор добавит «Закончить разговор» автоматически.
            </div>
          )}
        {node.choices.map((c, i) => (
          <ChoiceForm
            key={i}
            choice={c}
            index={i}
            doc={doc}
            node={node}
            store={store}
            commit={commit}
            emotions={emotions}
            onRemove={() => (node.choices.splice(i, 1), commit())}
          />
        ))}
        <button
          className="btn btn-small"
          onClick={() => (node.choices.push({ text: 'Новый ответ', sections: [], goto: 'stay' }), commit())}
        >
          + ответ
        </button>
      </div>
    </div>
  )
}

// ─────────────── куда дальше ───────────────

function GotoSelect({
  label,
  doc,
  value,
  allowStay = true,
  onChange,
}: {
  label: string
  doc: DlgDoc
  value: string
  allowStay?: boolean
  onChange: (v: string) => void
}) {
  return (
    <label className="fld">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {allowStay && <option value="stay">↩ остаться (те же варианты)</option>}
        <option value="end"><Ico n="stop" />  конец разговора</option>
        {doc.nodes.map((n) => (
          <option key={n.id} value={n.id}>→ {n.label}</option>
        ))}
      </select>
    </label>
  )
}

// ─────────────── условия ───────────────

function CondListEditor({
  conds,
  store,
  commit,
  onChange,
}: {
  conds: DlgCond[]
  store: EditorStore
  commit: () => void
  onChange: (c: DlgCond[]) => void
}) {
  return (
    <div className="dlg-conds">
      {conds.map((c, i) => (
        <div key={i} className="journal-row">
          <select
            className="journal-key"
            value={condKey(c)}
            onChange={(e) => {
              conds[i] = blankCond(e.target.value)
              commit()
            }}
          >
            {COND_TYPES.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
          <CondFields cond={c} store={store} commit={commit} />
          <button className="btn btn-small ce-del" onClick={() => onChange(conds.filter((_, j) => j !== i))}><Ico n="close" /> </button>
        </div>
      ))}
      <button className="btn btn-small" onClick={() => onChange([...conds, blankCond('flag')])}>
        + условие
      </button>
    </div>
  )
}

function CondFields({ cond: c, store, commit }: { cond: DlgCond; store: EditorStore; commit: () => void }) {
  switch (c.type) {
    case 'flag':
      return <FlagSelect label="" store={store} value={c.flag} onChange={(f) => ((c.flag = f ?? ''), commit())} />
    case 'item_ge':
      return (
        <>
          <InlineRef kind="item" store={store} value={c.item} onChange={(v) => ((c.item = v), commit())} />
          <input type="number" className="journal-key" min={1} value={c.count} onChange={(e) => ((c.count = Math.max(1, Number(e.target.value))), commit())} />
          <span className="muted small">шт.</span>
        </>
      )
    case 'has_item':
      return <InlineRef kind="item" store={store} value={c.item} onChange={(v) => ((c.item = v), commit())} />
    case 'disp_ge':
      return (
        <>
          <InlineRef kind="disposition" store={store} value={c.target} onChange={(v) => ((c.target = v), commit())} />
          <input type="number" className="journal-key" value={c.value} onChange={(e) => ((c.value = Number(e.target.value)), commit())} />
        </>
      )
    case 'quest':
      return (
        <>
          <InlineRef kind="quest" store={store} value={c.quest} onChange={(v) => ((c.quest = v), commit())} />
          <QuestStageSelect store={store} questId={c.quest} value={c.stage} onChange={(v) => ((c.stage = v), commit())} />
        </>
      )
    case 'in_party':
      return <InlineRef kind="npc" store={store} value={c.npc} onChange={(v) => ((c.npc = v), commit())} />
    case 'npc_known':
      return <InlineRef kind="npc" store={store} value={c.entity} onChange={(v) => ((c.entity = v), commit())} />
    case 'hp_ge':
      return (
        <>
          <input type="number" className="journal-key" value={c.value} onChange={(e) => ((c.value = Number(e.target.value)), commit())} />
          <span className="muted small">HP</span>
        </>
      )
    case 'has_status':
      return <InlineRef kind="status" store={store} value={c.status} onChange={(v) => ((c.status = v), commit())} />
    case 'weather_is':
      return <InlineRef kind="weather" store={store} value={c.weather} onChange={(v) => ((c.weather = v), commit())} />
    case 'skill_ge':
      return (
        <>
          <InlineRef kind="skill" store={store} value={c.skill} onChange={(v) => ((c.skill = v), commit())} />
          <input
            type="number"
            className="journal-key"
            min={0}
            value={c.threshold}
            data-tip="Порог: навык героя не ниже этого числа"
            onChange={(e) => ((c.threshold = Math.max(0, Number(e.target.value) || 0)), commit())}
          />
          <span className="muted small">порог</span>
        </>
      )
    case 'meta_counter':
      return (
        <>
          <select className="journal-key" value={c.key} onChange={(e) => ((c.key = e.target.value), commit())}>
            {META_COUNTER_KEYS.map((k) => (
              <option key={k} value={k}>{META_COUNTER_LABELS[k] ?? k}</option>
            ))}
          </select>
          <input
            type="number"
            className="journal-key"
            min={0}
            value={c.ge}
            data-tip="Сколько раз/штук минимум"
            onChange={(e) => ((c.ge = Math.max(0, Number(e.target.value) || 0)), commit())}
          />
          <span className="muted small">не меньше</span>
        </>
      )
  }
}

function InlineRef({
  kind,
  store,
  value,
  onChange,
}: {
  kind: Parameters<EditorStore['options']>[0]
  store: EditorStore
  value: string
  onChange: (v: string) => void
}) {
  const options = store.options(kind)
  return (
    <select className="journal-key" value={value} onChange={(e) => onChange(e.target.value)}>
      {!options.some((o) => o.id === value) && <option value={value}>{value || '— выбрать —'}</option>}
      {options.map((o) => (
        <option key={o.id} value={o.id}>{o.label}</option>
      ))}
    </select>
  )
}

function QuestStageSelect({
  store,
  questId,
  value,
  onChange,
}: {
  store: EditorStore
  questId: string
  value: string
  onChange: (v: string) => void
}) {
  const quest = store.questPaths().map((p) => store.quest(p)).find((q) => q?.id === questId)
  return (
    <select className="journal-key" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">(не начат)</option>
      {quest?.stages.map((st) => (
        <option key={st.id} value={st.id}>{st.label ?? st.id}</option>
      ))}
      {value !== '' && !quest?.stages.some((st) => st.id === value) && <option value={value}>{value}</option>}
    </select>
  )
}

// ─────────────── шаги и блоки ───────────────

function StepListEditor({
  steps,
  store,
  commit,
  emotions,
  onChange,
}: {
  steps: DlgStep[]
  store: EditorStore
  commit: () => void
  emotions: Array<{ id: DlgEmotion; label: string }>
  onChange: (s: DlgStep[]) => void
}) {
  return (
    <div className="dlg-steps">
      {steps.map((st, i) => (
        <div key={i} className="dlg-step">
          {st.kind === 'line' ? (
            <LineRow
              line={st.line}
              store={store}
              emotions={emotions}
              commit={commit}
              onRemove={() => onChange(steps.filter((_, j) => j !== i))}
            />
          ) : (
            <EffectRow
              effect={st.effect}
              store={store}
              commit={commit}
              onRemove={() => onChange(steps.filter((_, j) => j !== i))}
              onReplace={(ne) => {
                steps[i] = { kind: 'effect', effect: ne }
                commit()
              }}
            />
          )}
        </div>
      ))}
      <div className="dlg-step-tools">
        <button className="btn btn-small" onClick={() => onChange([...steps, { kind: 'line', line: { text: '' } }])}>
          + реплика
        </button>
        <button className="btn btn-small" onClick={() => onChange([...steps, { kind: 'effect', effect: blankEffect('set_flag') }])}>
          + действие
        </button>
      </div>
    </div>
  )
}

function SectionListEditor({
  sections,
  doc,
  store,
  commit,
  emotions,
}: {
  sections: DlgSection[]
  doc: DlgDoc
  store: EditorStore
  commit: () => void
  emotions: Array<{ id: DlgEmotion; label: string }>
}) {
  return (
    <div className="dlg-sections">
      {sections.map((sec, i) => {
        const hasConds = !!sec.conds && sec.conds.length > 0
        return (
          <div key={i} className={`dlg-section ${hasConds ? 'dlg-section-cond' : ''}`}>
            <div className="dlg-section-head">
              <label className="fld-check small">
                <input
                  type="checkbox"
                  checked={hasConds}
                  onChange={(e) => {
                    if (e.target.checked) sec.conds = [blankCond('flag')]
                    else {
                      delete sec.conds
                      delete sec.else_steps
                      delete sec.else_goto
                    }
                    commit()
                  }}
                />
                <span>показывать при условии</span>
              </label>
              <span className="editor-spacer" />
              {sections.length > 1 && (
                <button className="btn btn-small ce-del" data-tip="Удалить блок" onClick={() => (sections.splice(i, 1), commit())}><Ico n="close" />  блок</button>
              )}
            </div>
            {hasConds && (
              <CondListEditor conds={sec.conds!} store={store} commit={commit} onChange={(c) => ((sec.conds = c), commit())} />
            )}
            <StepListEditor steps={sec.steps} store={store} commit={commit} emotions={emotions} onChange={(s) => ((sec.steps = s), commit())} />
            {hasConds && (
              <details className="dlg-else" open={!!sec.else_steps?.length}>
                <summary>Иначе (условие не выполнено)</summary>
                <StepListEditor
                  steps={sec.else_steps ?? []}
                  store={store}
                  commit={commit}
                  emotions={emotions}
                  onChange={(s) => {
                    if (s.length) sec.else_steps = s
                    else delete sec.else_steps
                    commit()
                  }}
                />
                <GotoSelectOptional label="Иначе — куда дальше" doc={doc} value={sec.else_goto} onChange={(v) => {
                  if (v) sec.else_goto = v
                  else delete sec.else_goto
                  commit()
                }} />
              </details>
            )}
            <GotoSelectOptional label={hasConds ? 'При условии — куда дальше' : 'После блока — куда дальше'} doc={doc} value={sec.goto} onChange={(v) => {
              if (v) sec.goto = v
              else delete sec.goto
              commit()
            }} />
          </div>
        )
      })}
      <button className="btn btn-small" onClick={() => (sections.push({ steps: [] }), commit())}>
        + блок реплик
      </button>
    </div>
  )
}

/** необязательный переход: пусто = продолжить по порядку */
function GotoSelectOptional({
  label,
  doc,
  value,
  onChange,
}: {
  label: string
  doc: DlgDoc
  value: string | undefined
  onChange: (v: string | undefined) => void
}) {
  return (
    <label className="fld fld-inline dlg-goto-opt">
      <span className="muted small">{label}</span>
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)}>
        <option value="">— продолжить дальше —</option>
        <option value="end"><Ico n="stop" />  конец разговора</option>
        <option value="stay">↩ к вариантам ответа</option>
        {doc.nodes.map((n) => (
          <option key={n.id} value={n.id}>→ {n.label}</option>
        ))}
      </select>
    </label>
  )
}

// ─────────────── реплика и действие ───────────────

/**
 * Предпросмотр реплики: токены заменены русскими названиями
 * (мастер видит, как фраза будет выглядеть в игре) — итерация 8, блок B.
 */
function LinePreview({ text, store }: { text: string; store: EditorStore }) {
  const parts = parseTokens(text)
  if (!parts.some((p) => p.token)) return null
  const nameOf = (kind: TokenKind, id: string): string => {
    if (kind === 'count') return store.labelFor('item', id)
    if (kind === 'need') return store.labelFor('need', id)
    if (kind === 'skill') return store.labelFor('skill', id)
    return 'здоровье'
  }
  return (
    <div className="dlg-line-preview">
      <span className="muted small">В игре: </span>
      {parts.map((p, i) =>
        p.token ? (
          <b key={i} data-tip={p.text}>
            {nameOf(p.token.kind, p.token.id)}
          </b>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </div>
  )
}

/** Кнопка «{ } Вставить значение»: выбор типа и объекта → токен в позицию курсора. */
function TokenInserter({
  store,
  onInsert,
}: {
  store: EditorStore
  onInsert: (token: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<TokenKind>('count')
  const options = optionsForToken(store, kind)
  const [id, setId] = useState<string>('')
  const value = id || options[0]?.id || ''
  if (!open) {
    return (
      <button className="btn btn-small" data-tip="Вставить в реплику значение из игры (счётчик предмета, здоровье…)" onClick={() => setOpen(true)}>
        {'{ }'} Вставить значение
      </button>
    )
  }
  return (
    <div className="token-inserter">
      <select
        value={kind}
        onChange={(e) => {
          setKind(e.target.value as TokenKind)
          setId('')
        }}
      >
        {TOKEN_KINDS.map((t) => (
          <option key={t.id} value={t.id}>{t.label}</option>
        ))}
      </select>
      {options.length > 0 && (
        <select value={value} onChange={(e) => setId(e.target.value)}>
          {options.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
      )}
      <button
        className="btn btn-small btn-primary"
        onClick={() => {
          onInsert(tokenString(kind, options.length ? value : undefined))
          setOpen(false)
          setId('')
        }}
      >
        Вставить
      </button>
      <button className="btn btn-small" onClick={() => setOpen(false)}>Отмена</button>
      <span className="muted small">{TOKEN_KINDS.find((t) => t.id === kind)?.hint}</span>
    </div>
  )
}

function optionsForToken(store: EditorStore, kind: TokenKind): Array<{ id: string; label: string }> {
  if (kind === 'count') return store.options('item')
  if (kind === 'need') return store.options('need')
  if (kind === 'skill') return store.options('skill')
  if (kind === 'currency') return store.options('currency')
  if (kind === 'stat')
    return [
      { id: 'STR', label: 'Сила (СИЛ)' },
      { id: 'CON', label: 'Выносливость (ВЫН)' },
      { id: 'SIZ', label: 'Размер (РАЗ)' },
      { id: 'DEX', label: 'Ловкость (ЛОВ)' },
      { id: 'INT', label: 'Интеллект (ИНТ)' },
      { id: 'POW', label: 'Дух (ДУХ)' },
      { id: 'CHA', label: 'Харизма (ХАР)' },
    ]
  return []
}

function LineRow({
  line,
  store,
  onRemove,
  commit,
  emotions = [{ id: DEFAULT_EMOTION.id, label: DEFAULT_EMOTION.label }],
}: {
  line: DlgLine
  store: EditorStore
  onRemove?: () => void
  commit: () => void
  emotions?: Array<{ id: DlgEmotion; label: string }>
}) {
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const caret = useRef<number | null>(null)
  const [voiceOpen, setVoiceOpen] = useState(!!line.voice)
  const insert = (token: string) => {
    const el = areaRef.current
    const at = caret.current ?? el?.selectionStart ?? line.text.length
    line.text = line.text.slice(0, at) + token + line.text.slice(at)
    commit()
    requestAnimationFrame(() => {
      const pos = at + token.length
      el?.focus()
      el?.setSelectionRange(pos, pos)
      caret.current = pos
    })
  }
  return (
    <div className="dlg-line-row">
      <textarea
        ref={areaRef}
        rows={2}
        value={line.text}
        placeholder="Текст реплики…"
        onChange={(e) => {
          line.text = e.target.value
          caret.current = e.target.selectionStart
          commit()
        }}
        onSelect={(e) => (caret.current = (e.target as HTMLTextAreaElement).selectionStart)}
      />
      <LinePreview text={line.text} store={store} />
      <div className="dlg-line-opts">
        <TokenInserter store={store} onInsert={insert} />
        <select
          value={line.emotion ?? 'neutral'}
          data-tip="Настроение (состояние портрета)"
          onChange={(e) => {
            const v = e.target.value as DlgEmotion
            if (v === 'neutral') delete line.emotion
            else line.emotion = v
            commit()
          }}
        >
          {!emotions.some((em) => em.id === (line.emotion ?? 'neutral')) && <option value={line.emotion}>{line.emotion}</option>}
          {emotions.map((em) => (
            <option key={em.id} value={em.id}>{em.label}</option>
          ))}
        </select>
        <label className="fld-check small" data-tip="Ремарка — описание действия, выводится курсивом">
          <input
            type="checkbox"
            checked={!!line.action}
            onChange={(e) => {
              if (e.target.checked) line.action = true
              else delete line.action
              commit()
            }}
          />
          <span>ремарка</span>
        </label>
        <button
          className={`btn btn-small ${line.voice ? 'btn-primary' : ''}`}
          data-tip={line.voice ? `Озвучка: ${line.voice} (нажмите, чтобы изменить)` : 'Озвучка реплики или ремарки: файл или ссылка'}
          onClick={() => setVoiceOpen(!voiceOpen)}
        >
          <Ico n="mic" />{line.voice ? '' : ''}
        </button>
        {onRemove && (
          <button className="btn btn-small ce-del" onClick={onRemove}><Ico n="close" /> </button>
        )}
      </div>
      {voiceOpen && (
        <div className="dlg-line-voice">
          <AudioUpload
            label="Озвучка реплики или ремарки (файл или ссылка; без файла возможен синтезатор в настройках игрока)"
            value={line.voice ?? ''}
            dir="assets/voice"
            store={store}
            onChange={(v) => {
              if (v) line.voice = v
              else delete line.voice
              commit()
            }}
          />
        </div>
      )}
    </div>
  )
}

function EffectRow({
  effect: e,
  store,
  commit,
  onRemove,
  onReplace,
}: {
  effect: DlgEffect
  store: EditorStore
  commit: () => void
  onRemove: () => void
  onReplace: (e: DlgEffect) => void
}) {
  return (
    <div className="dlg-effect-row">
      <select value={e.type} onChange={(ev) => onReplace(blankEffect(ev.target.value as DlgEffect['type']))}>
        {EFFECT_TYPES.map((t) => (
          <option key={t.id} value={t.id}>{t.label}</option>
        ))}
      </select>
      {e.type === 'set_flag' && (
        <FlagSelect label="" store={store} value={e.flag} onChange={(f) => ((e.flag = f ?? ''), commit())} />
      )}
      {e.type === 'set_description' && (
        <>
          <InlineRef kind="entity" store={store} value={e.entity} onChange={(v) => ((e.entity = v), commit())} />
          <input value={e.text} placeholder="Новое описание" onChange={(ev) => ((e.text = ev.target.value), commit())} />
        </>
      )}
      {(e.type === 'add_item' || e.type === 'remove_item') && (
        <>
          <InlineRef kind="item" store={store} value={e.item} onChange={(v) => ((e.item = v), commit())} />
          <input type="number" min={1} value={e.qty} onChange={(ev) => ((e.qty = Math.max(1, Number(ev.target.value))), commit())} />
        </>
      )}
      {e.type === 'fire_rule' && <InlineRef kind="rule" store={store} value={e.rule} onChange={(v) => ((e.rule = v), commit())} />}
      {(e.type === 'join_party' || e.type === 'open_trade' || e.type === 'leave_party') && (
        <InlineRef kind="npc" store={store} value={e.npc} onChange={(v) => ((e.npc = v), commit())} />
      )}
      {e.type === 'change_companion_need' && (
        <>
          <InlineRef kind="npc" store={store} value={e.npc} onChange={(v) => ((e.npc = v), commit())} />
          <InlineRef kind="need" store={store} value={e.need} onChange={(v) => ((e.need = v), commit())} />
          <input type="number" value={e.delta} onChange={(ev) => ((e.delta = Number(ev.target.value)), commit())} />
        </>
      )}
      {e.type === 'transfer_to_companion' && (
        <>
          <InlineRef kind="npc" store={store} value={e.npc} onChange={(v) => ((e.npc = v), commit())} />
          <InlineRef kind="item" store={store} value={e.item} onChange={(v) => ((e.item = v), commit())} />
          <input type="number" min={1} value={e.qty} onChange={(ev) => ((e.qty = Math.max(1, Number(ev.target.value))), commit())} />
        </>
      )}
      {e.type === 'learn_name' && (
        <InlineRef kind="npc" store={store} value={e.entity} onChange={(v) => ((e.entity = v), commit())} />
      )}
      {e.type === 'start_quest' && <InlineRef kind="quest" store={store} value={e.quest} onChange={(v) => ((e.quest = v), commit())} />}
      {e.type === 'play_cutscene' && (
        <InlineRef kind="cutscene" store={store} value={e.cutscene} onChange={(v) => ((e.cutscene = v), commit())} />
      )}
      {(e.type === 'advance_time' || e.type === 'sleep') && (
        <>
          <input type="number" min={1} value={e.ticks} onChange={(ev) => ((e.ticks = Math.max(1, Number(ev.target.value))), commit())} />
          <span className="muted small">{store.meta.tick_label ?? 'тик'}</span>
        </>
      )}
      {e.type === 'change_need' && (
        <>
          <InlineRef kind="need" store={store} value={e.need} onChange={(v) => ((e.need = v), commit())} />
          <input type="number" value={e.delta} onChange={(ev) => ((e.delta = Number(ev.target.value)), commit())} />
        </>
      )}
      {e.type === 'change_hp' && (
        <input type="number" value={e.delta} onChange={(ev) => ((e.delta = Number(ev.target.value)), commit())} />
      )}
      {e.type === 'change_disposition' && (
        <>
          <InlineRef kind="disposition" store={store} value={e.target} onChange={(v) => ((e.target = v), commit())} />
          <input type="number" value={e.delta} onChange={(ev) => ((e.delta = Number(ev.target.value)), commit())} />
        </>
      )}
      {e.type === 'apply_status' && (
        <>
          <InlineRef kind="status" store={store} value={e.status} onChange={(v) => ((e.status = v), commit())} />
          <input
            type="number"
            min={0}
            value={e.duration ?? 0}
            data-tip="Длительность в тиках (0 — из реестра)"
            onChange={(ev) => {
              const v = Math.max(0, Number(ev.target.value) || 0)
              if (v > 0) e.duration = v
              else delete e.duration
              commit()
            }}
          />
          <span className="muted small">тиков (0 — из реестра)</span>
        </>
      )}
      {e.type === 'remove_status' && (
        <InlineRef kind="status" store={store} value={e.status} onChange={(v) => ((e.status = v), commit())} />
      )}
      {e.type === 'set_weather' && (
        <InlineRef kind="weather" store={store} value={e.weather} onChange={(v) => ((e.weather = v), commit())} />
      )}
      {e.type === 'unlock_codex' && (
        <InlineRef kind="codex" store={store} value={e.entry} onChange={(v) => ((e.entry = v), commit())} />
      )}
      {e.type === 'unlock_recipe' && (
        <InlineRef kind="recipe" store={store} value={e.recipe} onChange={(v) => ((e.recipe = v), commit())} />
      )}
      {e.type === 'open_craft' && (
        <>
          <InlineRef kind="recipe" store={store} value={e.recipe ?? ''} onChange={(v) => ((e.recipe = v || undefined), commit())} />
          <span className="muted small">пусто — весь список рецептов</span>
        </>
      )}
      {e.type === 'set_entity_state' && (
        <>
          <InlineRef kind="npc" store={store} value={e.entity} onChange={(v) => ((e.entity = v), commit())} />
          <select className="journal-key" value={e.state} onChange={(ev) => ((e.state = ev.target.value), commit())}>
            <option value="">— обычный облик —</option>
            {store.options('emotion').map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </>
      )}
      {e.type === 'go_to_scene' && (
        <>
          <InlineRef kind="scene" store={store} value={e.scene} onChange={(v) => ((e.scene = v), commit())} />
          <label className="fld-check small" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <input
              type="checkbox"
              checked={e.close_dialogue !== false}
              onChange={(ev) => ((e.close_dialogue = ev.target.checked), commit())}
            />
            <span>Закрыть диалог</span>
          </label>
        </>
      )}
      {e.type === 'start_combat' && (
        <InlineRef kind="arena" store={store} value={e.arena} onChange={(v) => ((e.arena = v), commit())} />
      )}
      {e.type === 'change_scene_state' && (
        <>
          <InlineRef kind="scene" store={store} value={e.scene ?? ''} onChange={(v) => ((e.scene = v || undefined), commit())} />
          <input
            value={e.state}
            placeholder="состояние (напр. night, broken)"
            onChange={(ev) => ((e.state = ev.target.value), commit())}
          />
        </>
      )}
      {e.type === 'game_over_death' && (
        <input
          value={e.message ?? ''}
          placeholder="причина гибели (эпилог)"
          onChange={(ev) => ((e.message = ev.target.value), commit())}
        />
      )}
      {e.type === 'game_over_victory' && (
        <input
          value={e.message ?? ''}
          placeholder="сообщение победы (эпилог)"
          onChange={(ev) => ((e.message = ev.target.value), commit())}
        />
      )}
      <button className="btn btn-small ce-del" onClick={onRemove}><Ico n="close" /> </button>
    </div>
  )
}

// ─────────────── вариант ответа ───────────────

function ChoiceForm({
  choice: c,
  index,
  doc,
  node,
  store,
  commit,
  emotions,
  onRemove,
}: {
  choice: DlgChoice
  index: number
  doc: DlgDoc
  node: DlgNode
  store: EditorStore
  commit: () => void
  emotions: Array<{ id: DlgEmotion; label: string }>
  onRemove: () => void
}) {
  const skills = store.options('skill')
  return (
    <details className="dlg-choice" open={index === 0 && node.choices.length <= 2}>
      <summary>▸ {c.text || '(без текста)'}{c.check ? '' : ''}{c.conds?.length ? '' : ''}</summary>
      <label className="fld">
        <span>Текст ответа игрока</span>
        <input value={c.text} onChange={(e) => ((c.text = e.target.value), commit())} />
      </label>
      <div className="fld-row">
        <label className="fld-check small">
          <input
            type="checkbox"
            checked={!!c.once}
            onChange={(e) => {
              if (e.target.checked) c.once = true
              else delete c.once
              commit()
            }}
          />
          <span>один раз за разговор</span>
        </label>
        <label className="fld-check small">
          <input
            type="checkbox"
            checked={!!c.conds}
            onChange={(e) => {
              if (e.target.checked) c.conds = [blankCond('flag')]
              else delete c.conds
              commit()
            }}
          />
          <span>показывать при условии</span>
        </label>
        <label className="fld-check small">
          <input
            type="checkbox"
            checked={!!c.check}
            onChange={(e) => {
              if (e.target.checked)
                c.check = {
                  skill: skills[0]?.id ?? 'persuade',
                  difficulty: 50,
                  success: { sections: [{ steps: [] }], goto: 'stay' },
                  fail: { sections: [{ steps: [] }], goto: 'stay' },
                }
              else delete c.check
              commit()
            }}
          />
          <span>проверка навыка <Ico n="dice" /> </span>
        </label>
      </div>
      {c.conds && (
        <div className="fld-block">
          <span className="fld-caption">Условия показа варианта</span>
          <CondListEditor conds={c.conds} store={store} commit={commit} onChange={(v) => {
            if (v.length) c.conds = v
            else delete c.conds
            commit()
          }} />
        </div>
      )}

      <div className="fld-block">
        <span className="fld-caption">Ответ НПС</span>
        <SectionListEditor sections={c.sections} doc={doc} store={store} commit={commit} emotions={emotions} />
      </div>

      {c.check && <CheckEditor check={c.check} doc={doc} store={store} commit={commit} emotions={emotions} />}

      {!c.check && (
        <GotoSelect label="Куда дальше" doc={doc} value={c.goto} onChange={(v) => ((c.goto = v), commit())} />
      )}
      <div className="dlg-choice-tools">
        <button className="btn btn-small ce-del" onClick={onRemove}><Ico n="close" />  удалить ответ</button>
      </div>
    </details>
  )
}

function CheckEditor({
  check,
  doc,
  store,
  commit,
  emotions,
}: {
  check: DlgCheck
  doc: DlgDoc
  store: EditorStore
  commit: () => void
  emotions: Array<{ id: DlgEmotion; label: string }>
}) {
  const skills = store.options('skill')
  return (
    <div className="dlg-check">
      <div className="fld-row">
        <label className="fld">
          <span>Навык</span>
          <select value={check.skill} onChange={(e) => ((check.skill = e.target.value), commit())}>
            {!skills.some((s) => s.id === check.skill) && <option value={check.skill}>{check.skill}</option>}
            {skills.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </label>
        <label className="fld" data-tip="Сложность смещает шанс: 50 — нейтральная, больше — сложнее">
          <span>Сложность</span>
          <input type="number" value={check.difficulty} onChange={(e) => ((check.difficulty = Number(e.target.value)), commit())} />
        </label>
      </div>
      <details className="dlg-else" open={!!check.mods?.length}>
        <summary>Изменённая сложность при условиях ({check.mods?.length ?? 0})</summary>
        {(check.mods ?? []).map((m, i) => (
          <div key={i} className="dlg-check-mod">
            <CondListEditor conds={m.conds} store={store} commit={commit} onChange={(v) => ((m.conds = v), commit())} />
            <label className="fld fld-inline">
              <span>Сложность</span>
              <input type="number" value={m.value} onChange={(e) => ((m.value = Number(e.target.value)), commit())} />
            </label>
            <button className="btn btn-small ce-del" onClick={() => (check.mods!.splice(i, 1), commit())}><Ico n="close" /> </button>
          </div>
        ))}
        <button
          className="btn btn-small"
          onClick={() => {
            check.mods = [...(check.mods ?? []), { conds: [blankCond('flag')], value: typeof check.difficulty === 'number' ? check.difficulty - 20 : 30 }]
            commit()
          }}
        >
          + вариант сложности
        </button>
      </details>
      <div className="dlg-branch dlg-branch-ok">
        <span className="fld-caption"><Ico n="check" />  Успех</span>
        <SectionListEditor sections={check.success.sections} doc={doc} store={store} commit={commit} emotions={emotions} />
        <GotoSelect label="После успеха" doc={doc} value={check.success.goto} onChange={(v) => ((check.success.goto = v), commit())} />
      </div>
      <div className="dlg-branch dlg-branch-fail">
        <span className="fld-caption"><Ico n="close" />  Провал</span>
        <SectionListEditor sections={check.fail.sections} doc={doc} store={store} commit={commit} emotions={emotions} />
        <GotoSelect label="После провала" doc={doc} value={check.fail.goto} onChange={(v) => ((check.fail.goto = v), commit())} />
      </div>
    </div>
  )
}
