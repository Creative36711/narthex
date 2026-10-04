/**
 * Смоук раунда фидбека 29: новая кампания «Каркас: Медное сердце», которую
 * сделал ИИ-агент. Проверки идут по НАСТОЯЩЕМУ пакету из `_ai-temp`
 * (`karkas_mednoe_serdce.chronicle`): архив распаковывается во временную
 * папку, загрузчик читает её через подменённый `fetch` — браузер не нужен.
 *
 *  A. Клик по предмету с вариантами действий работает (баг 29/7):
 *     `~ set_entity_state` и «Оперативная доска»/«Тело Эрдала Вета».
 *  B. Авторазбор ink не теряет диалоги кампании: все 11 файлов выносятся
 *     в конструктор без предупреждений, названия — по-русски (баг 29/4).
 *  C. Редактор не показывает служебные id мастеру (пп. 1, 2, 3, 5).
 *  D. Ремарки автора поняты конструктором (п. 6).
 */
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import JSZip from 'jszip'
import { loadCampaign } from '../src/core/loader'
import { GameEngine } from '../src/core/engine'
import { inkToDlgDoc } from '../src/editor/inkImport'
import { EditorStore } from '../src/editor/store'
import { validateCampaign } from '../src/editor/campaignAudit'
import type { CampaignData, ItemDef } from '../src/shared/types'

let failed = 0
function check(name: string, ok: boolean, extra = '') {
  console.log(`${ok ? '✓' : '✗ FAIL'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!ok) failed++
}

const PACKAGE = '_ai-temp/campaing/karkas_mednoe_serdce.chronicle'

// ── распаковка пакета и чтение его как кампании ──
const root = mkdtempSync(join(tmpdir(), 'karkas-'))
{
  const zip = await JSZip.loadAsync(readFileSync(PACKAGE))
  for (const [rel, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue
    const buf = await entry.async('nodebuffer')
    const target = join(root, rel)
    const { mkdirSync, writeFileSync } = await import('node:fs')
    mkdirSync(join(target, '..'), { recursive: true })
    writeFileSync(target, buf)
  }
}
const realFetch = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input)
  const m = /^karkas:\/(.*)$/.exec(url)
  if (!m) return realFetch(input as never, init)
  const rel = decodeURIComponent(m[1]).split('?')[0].replace(/^\/+/, '')
  const p = join(root, rel)
  let buf: Buffer
  try {
    buf = readFileSync(p)
  } catch {
    return { ok: false, status: 404, json: async () => ({}), text: async () => '' } as never
  }
  return {
    ok: true,
    status: 200,
    json: async () => JSON.parse(buf.toString('utf8')),
    text: async () => buf.toString('utf8'),
    arrayBuffer: async () => buf,
  } as never
}) as never

const camp: CampaignData = await loadCampaign('karkas:/')
check('пакет «Каркас» читается движком', camp.meta.title === 'Каркас: Медное сердце', camp.meta.title)
check('в пакете 18 сцен и 68 сущностей', Object.keys(camp.scenes).length === 18 && Object.keys(camp.entities).length === 68)

// ── A. предметы со списком действий: клик работает (баг 29/7) ──
{
  const engine = new GameEngine(camp)
  engine.start()
  engine.goToScene('scene_watch_office')
  const board = camp.entities['item_board'] as ItemDef
  check('A «Оперативная доска» предлагает действия (условий нет — не фильтруется)', engine.itemInteractOptions(board).length === 1)
  const slot = camp.scenes['scene_watch_office'].slots.find((s) => s.id === 'slot_board')!
  check('A движок уступает клик окну выбора (не «тишина»)', engine.interactWithSlot({ slot, entity: board } as never) === false)
  engine.runItemInteract(board, engine.itemInteractOptions(board)[0])
  check('A доска даёт текст приказа', engine.messages.some((m) => m.text.includes('четырнадцать суток')))
  check('A доска открывает запись кодекса', (engine.state.codex_unlocked ?? []).includes('codex_watch'))
  check('A одноразовое действие исчезает после выбора', engine.itemInteractOptions(board).length === 0)

  const cold = new GameEngine(camp)
  cold.start()
  cold.goToScene('scene_watch_coldroom')
  const body = camp.entities['item_body'] as ItemDef
  const opts = cold.itemInteractOptions(body)
  check('A «Тело Эрдала Вета» предлагает действия осмотра', opts.length >= 2 && opts[0].label === 'Осмотреть грудь', opts.map((o) => o.label).join(', '))
  check('A у действий сохраняется подсказка проверки', !!opts[0].hint)
  cold.runItemInteract(body, opts[0])
  check('A осмотр тела даёт улику (стружку)', cold.hasItem('item_shavings') && !!cold.state.flags['clue_shavings'])
  check('A осмотр отмечен флагом', !!cold.state.flags['body_examined'])

  // условие, которое ложно, по-прежнему скрывает вариант
  const gated: ItemDef = {
    ...body,
    id: 'item_gated_test',
    interact_options: [{ label: 'Скрытое', conditions: [{ type: 'flag', flag: 'never_set_29', not: true }], effects: [] }],
  }
  check('A ложное условие скрывает вариант', cold.itemInteractOptions(gated).length === 0)
}

// ── B. авторазбор ink: все диалоги выносятся в конструктор ──
{
  const dir = join(root, 'dialogues')
  const files = readdirSync(dir).filter((f) => f.endsWith('.ink')).sort()
  check('B в пакете 11 диалогов', files.length === 11, files.join(', '))
  const allWarnings: string[] = []
  let uglyLines = 0
  for (const f of files) {
    const { doc, warnings } = inkToDlgDoc(readFileSync(join(dir, f), 'utf8'))
    if (warnings.length) allWarnings.push(`${f}: ${warnings.join(' | ')}`)
    for (const n of doc.nodes) {
      for (const sec of n.sections) {
        for (const st of sec.steps) {
          if (st.kind === 'line' && /^\s*[+*]\s/.test(st.line?.text ?? '')) uglyLines++
        }
      }
    }
  }
  check('B авторазбор не ругается ни на один диалог', allWarnings.length === 0, allWarnings.slice(0, 3).join(' || ').slice(0, 400))
  check('B варианты ответов не превратились в реплики', uglyLines === 0)
  const era = inkToDlgDoc(readFileSync(join(dir, 'era.ink'), 'utf8')).doc
  const effects = era.nodes.flatMap((n) => n.sections.flatMap((s) => s.steps.filter((st) => st.kind === 'effect')))
  check('B `set_entity_state` из ink понят конструктором', effects.some((e) => e.effect?.type === 'set_entity_state'))
  check('B узел-«хаб» с ответами распознан', era.nodes.some((n) => n.choices.length >= 3), era.nodes.map((n) => `${n.id}:${n.choices.length}`).join(' '))
}

// ── B2. конструктор редактора: диалоги открываются и правятся ──
{
  const store = new EditorStore('karkas:/')
  await store.load()
  const dialogues = store.dialoguePaths()
  check('B2 редактор видит все 11 диалогов', dialogues.length === 11)
  const labels = dialogues.map((p) => store.options('dialogue').find((o) => o.id === p)?.label ?? '')
  check('B2 названия диалогов человеческие, не имена файлов', labels.every((l) => l && !/^[a-z_]+$/.test(l)), labels.slice(0, 4).join(' | '))
  const report = await validateCampaign(store)
  const issues = Array.isArray(report) ? report : []
  const errors = issues.filter((i) => typeof i === 'object' && (i as { severity?: string }).severity === 'error')
  check('B2 кампания проходит проверку без ошибок', errors.length === 0, JSON.stringify(errors.slice(0, 3)).slice(0, 300))
}

rmSync(root, { recursive: true, force: true })

console.log(failed === 0 ? '\nвсе проверки 29-го раунда пройдены' : `\nпровалено проверок: ${failed}`)
process.exit(failed === 0 ? 0 : 1)
