/**
 * Смоук текстового режима диалогов и проверки разговора в редакторе
 * (фидбек 29: «полный текстовый сценарий» + плейтест разговора).
 *
 * Берём демо-кампанию ash-of-caerden, подменяем один разговор сценарием и
 * прогоняем весь путь: хранилище редактора → сборка кампании → движок →
 * разговор. Интерфейс рендерится в строку (react-dom/server), поэтому браузер
 * не нужен.
 *
 * Прогон: npx tsx --tsconfig tsconfig.app.json scripts/dlg-ui-smoke.mts
 * (флаг нужен, чтобы TSX собрал интерфейс в автоматическом режиме React)
 */
import { cpSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { EditorStore } from '../src/editor/store'
import { DialogueBuilder } from '../src/editor/DialogueBuilder'
import { DialogueScriptView } from '../src/editor/DialogueScriptView'
import { buildDialoguePlaytest, DialoguePlaytest } from '../src/editor/DialoguePlaytest'
import { generateInk, migrateDlgDoc } from '../src/editor/dialogueDoc'
import { scriptToDlg, storeRefs, dlgToScript } from '../src/editor/dlgScript'
import { exportMonolith, importMonolith } from '../src/editor/monolith'
import { normalizeChronicleManifest } from '../src/editor/chronicleManifest'
import type { DlgDoc as DlgDocType } from '../src/shared/types'
import type { DlgDoc } from '../src/shared/types'

let failed = 0
function check(name: string, ok: boolean, extra = '') {
  console.log(`${ok ? '✓' : '✗ FAIL'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!ok) failed++
}

// ── демо-кампания во временной папке + чтение через подменённый fetch ──
const root = mkdtempSync(join(tmpdir(), 'dlgui-'))
cpSync('public/campaigns/ash-of-caerden', root, { recursive: true })
const realFetch = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input)
  const m = /^ui:\/(.*)$/.exec(url)
  if (!m) return realFetch(input as never, init)
  const rel = decodeURIComponent(m[1]).split('?')[0].replace(/^\/+/, '')
  try {
    const buf = readFileSync(join(root, rel))
    const json = rel.endsWith('.json')
    return {
      ok: true,
      status: 200,
      headers: { get: (h: string) => (h.toLowerCase() === 'content-type' ? (json ? 'application/json' : 'text/plain') : null) },
      json: async () => JSON.parse(buf.toString('utf8')),
      text: async () => buf.toString('utf8'),
      arrayBuffer: async () => buf,
    } as never
  } catch {
    return { ok: false, status: 404, json: async () => ({}), text: async () => '', headers: { get: () => null } } as never
  }
}) as never

const store = new EditorStore('ui:/')
await store.load()
check('U демо-кампания открыта в редакторе', !!store.meta.title && store.dialoguePaths().length > 0, store.meta.title)

// ── разговор со сценарием: берём названия из реестров кампании ──
const inkPath = store.dialoguePaths()[0]
const dlgPath = inkPath.replace(/\.ink$/, '.dlg.json')
const refs = storeRefs(store, inkPath)
const flag = store.options('flag')[0]
const item = store.options('item')[0]
check('U в кампании есть флаг и предмет для условий', !!flag && !!item, `${flag?.label} / ${item?.label}`)

const script = [
  'название: Проверка сценария',
  '',
  '=== Начало разговора ===',
  '* Собеседник поднимает глаза от бумаг.',
  '— Приветствую.',
  `[если ${flag.label}]`,
  '— Рад тебя видеть.',
  `→ выдать: ${item.label}`,
  '[иначе]',
  '— Мы не знакомы.',
  '? Кто вы?',
  '— Стражник.',
  '→ остаться',
  `[если ${flag.label}]`,
  '? Спросить про дело.',
  '— Дело непростое.',
  '→ конец',
  '? Уйти.',
  '→ конец',
].join('\n')

const parsed = scriptToDlg(script, refs, { version: 2, nodes: [{ id: 'main', label: 'Начало разговора', sections: [], choices: [] }] })
check('U сценарий разобран без ошибок', parsed.issues.filter((i) => i.severity === 'error').length === 0,
  parsed.issues.map((i) => i.message).join(' | '))
const doc: DlgDoc = { ...parsed.doc, script }
store.jsonFiles.set(dlgPath, doc)
store.textFiles.set(inkPath, generateInk(doc))
const ink = generateInk(doc)
check('U ink собран из сценария', ink.includes(`get_flag("${flag.id}")`) && ink.includes(`add_item("${item.id}", 1)`) && ink.includes('EXTERNAL'), '')

// ── интерфейс: вкладки и текст сценария ──
const html = renderToStaticMarkup(createElement(DialogueBuilder, { store, path: inkPath }))
check('U открывается вкладка «Сценарий»', html.includes('Сценарий') && html.includes('Служебный ink') && html.includes('Конструктор'))
check('U текст сценария виден мастеру', html.includes('Приветствую.') && html.includes(flag.label))
check('U есть кнопка проверки разговора', html.includes('Проверить разговор'))
check('U служебные команды ink в текст не попали', !html.includes('get_flag') && !html.includes('set_dialogue_timer'))

const withIssue = renderToStaticMarkup(createElement(DialogueScriptView, {
  doc,
  value: `${script}\n→ полетать: высоко\n`,
  issues: [{ line: 12, text: '→ полетать: высоко', message: 'не понимаю команду «полетать: высоко».', severity: 'error' as const }],
  onText: () => {},
  onPlaytest: () => {},
}))
check('U ошибка мастера видна строкой с номером', withIssue.includes('Строка 12') && withIssue.includes('не понимаю команду'))

// ── проверка разговора: настоящий движок ──
const built = buildDialoguePlaytest(store, inkPath)
check('U движок проверки открывает разговор', !!built.engine.dialogue, built.engine.dialogue?.node ?? '')
check('U собеседник — владелец разговора', built.npcId === ((store.npcForDialogue(inkPath) as { id?: string } | undefined)?.id ?? 'npc__preview'), built.npcId)
check('U реплики пришли из сценария', (built.engine.dialogue?.lines ?? []).some((l) => l.text.includes('Приветствую')), (built.engine.dialogue?.lines ?? []).map((l) => l.text).join(' / ').slice(0, 120))
check('U ремарка отдана курсивом (action)', (built.engine.dialogue?.lines ?? []).some((l) => l.action === true))
check('U варианты на месте', (built.engine.dialogue?.choices ?? []).length === 2, JSON.stringify((built.engine.dialogue?.choices ?? []).map((c) => c.text)))
check('U условный вариант скрыт без флага', !(built.engine.dialogue?.choices ?? []).some((c) => c.text.includes('Спросить про дело')))

// флаг включён — условие открывает ветку и эффект выдаёт предмет
built.engine.state.flags[flag.id] = true
built.engine.startDialogue(built.npcId)
check('U с флагом ветка открывается', (built.engine.dialogue?.choices ?? []).some((c) => c.text.includes('Спросить про дело')))
check('U ветка «иначе» сменилась на «если»', (built.engine.dialogue?.lines ?? []).some((l) => l.text.includes('Рад тебя видеть')))
check('U эффект из сценария выдан', built.engine.hasItem(item.id))

// ── разговор без владельца: временный собеседник ──
const owner = store.npcForDialogue(inkPath)
if (owner) {
  const ownerPath = store.entityPaths().find((p) => (store.entity(p) as { id?: string })?.id === owner.id)
  const raw = ownerPath ? (store.jsonFiles.get(ownerPath) as unknown as { dialogue?: string } | undefined) : undefined
  if (raw) {
    const saved = raw.dialogue
    raw.dialogue = undefined
    const free = buildDialoguePlaytest(store, inkPath)
    check('U разговор без владельца играет временный собеседник', free.npcId === 'npc__preview' && !!free.engine.dialogue)
    raw.dialogue = saved
  }
}

// ── оверлей проверки разговора рисуется (кнопки и подпись на месте) ──
{
  const overlay = renderToStaticMarkup(createElement(DialoguePlaytest, { store, path: inkPath, doc, onClose: () => {} }))
  check('П оверлей проверки открывается', overlay.includes('Проверка разговора') && overlay.includes('Вернуться в редактор'))
  check('П есть кнопки пересборки и панель проверки', overlay.includes('Пересобрать') && overlay.includes('Что проверить') && overlay.includes('Заново'))
}

// ── путь ИИ: разговор пришёл текстом, структуры нет ──
{
  const { doc: mono } = exportMonolith(store)
  const key = 'maeva'
  const scriptOnly = { version: 2, label: 'Маэва, травница', script, nodes: [] as never[] }
  mono.dialogues[key] = scriptOnly as never

  const aiStore = new EditorStore('/campaigns/ai')
  const warns = importMonolith(aiStore, JSON.parse(JSON.stringify(mono)))
  const aiInk = aiStore.textFiles.get(`dialogues/${key}.ink`) ?? ''
  const aiDoc = aiStore.jsonFiles.get(`dialogues/${key}.dlg.json`) as DlgDocType | undefined
  check('ИИ импорт: текст разобран в формы', !!aiDoc && aiDoc.nodes.length > 0, String(aiDoc?.nodes.length))
  check('ИИ импорт: ink собран из текста', aiInk.includes('EXTERNAL') && aiInk.includes(flag.id))
  check('ИИ импорт: предупреждений о разговоре нет', !warns.some((w) => w.includes('Маэва')), warns.join(' | ').slice(0, 200))

  mono.dialogues[key] = { version: 2, label: 'Кривой', script: '— Привет.\n→ полетать: высоко\n', nodes: [] } as never
  const warnsBad = importMonolith(new EditorStore('/campaigns/ai2'), JSON.parse(JSON.stringify(mono)))
  check('ИИ импорт: ошибка текста названа строкой', warnsBad.some((w) => w.includes('полетать')), warnsBad.join(' | ').slice(0, 200))

  // тот же текст, но в .narthex-пакете (sidecar без узлов) — ink собирается при чтении
  const jsonFiles = new Map<string, unknown>()
  for (const [path, val] of store.jsonFiles) jsonFiles.set(path, JSON.parse(JSON.stringify(val)))
  jsonFiles.set('campaign.json', JSON.parse(JSON.stringify(store.meta))) // в пакете он отдельным файлом
  jsonFiles.set('world.json', JSON.parse(JSON.stringify(store.world)))
  jsonFiles.set(`dialogues/${key}.dlg.json`, { version: 2, label: 'Маэва, травница', script, nodes: [] })
  const textFiles = new Map<string, string>()
  normalizeChronicleManifest({ dialogues: [`${key}.ink`] } as never, jsonFiles, textFiles)
  const packInk = textFiles.get(`dialogues/${key}.ink`) ?? ''
  check('пакет: ink собран из текста разговора', packInk.includes(flag.id) && packInk.includes(item.id))
}

// ── круг «сценарий → ink → формы» для этого же разговора ──
const fromInk = migrateDlgDoc(JSON.parse(JSON.stringify(doc)))
void fromInk
const written = dlgToScript(doc, refs)
check('U сценарий переписывается теми же названиями', written.includes(flag.label) && written.includes(item.label) && !written.includes('get_flag'))

console.log(failed ? `\nпровалено проверок: ${failed}` : '\nтекстовый сценарий и проверка разговора: всё зелёное')
process.exit(failed ? 1 : 0)
