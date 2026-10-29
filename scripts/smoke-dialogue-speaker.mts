/**
 * Дз.22 — «третье лицо в диалоге» (# speaker): парсер движка, сериализация
 * конструктора (док ↔ ink), импорт рукописного ink и аудит (неведомый
 * спикер = ошибка, спикер у ремарки = ошибка, спикер без гейта присутствия =
 * предупреждение). Заодно — рогалик-предупреждение про permadeath+слоты
 * и призрачная кнопка лагеря (якоря в коде GUI).
 *
 * Запуск: npx tsx scripts/smoke-dialogue-speaker.mts
 */
import { readFileSync } from 'fs'
import { EditorStore } from '../src/editor/store'
import { validateCampaign } from '../src/editor/campaignAudit'
import { parseLineTags } from '../packs/narrative/index'
import { generateInk } from '../src/editor/dialogueDoc'
import { inkToDlgDoc } from '../src/editor/inkImport'
import type { CampaignAuditReport } from '../src/editor/campaignAudit'
import type { DlgDoc, DlgLine } from '../src/shared/types'

let failed = 0
function ok(name: string, cond: boolean, detail?: string) {
  if (cond) console.log(`  ✓ ${name}`)
  else { console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`); failed += 1 }
}

// ── 1. парсер движка: тег # speaker ───────────────────────────────────────
console.log('[парсер тегов движка]')
{
  const t = parseLineTags(['speaker: npc_resh', 'emotion: angry'])
  ok('speaker извлекается', t.speaker === 'npc_resh')
  ok('эмоция рядом не страдает', t.emotion === 'angry')
  const none = parseLineTags(['action'])
  ok('без тега спикера нет', none.speaker === undefined)
}

// ── 2. конструктор: док → ink → док сохраняет спикера ──────────────────────
console.log('[круговой обход документа]')
{
  const doc = inkToDlgDoc(generateInk({
    version: 2, label: 'Тест спикера',
    nodes: [{
      id: 'main', label: 'Начало', sections: [{
        steps: [
          { kind: 'line', line: { text: 'Стой, пейджер. # неизвест', speaker: 'npc_resh', emotion: 'angry' } as DlgLine },
          { kind: 'line', line: { text: 'Пепел падает на пол.', action: true, speaker: 'npc_resh' } },
        ],
      }],
      choices: [{ text: 'Что дальше?', goto: 'end', sections: [] }],
    }],
  } as DlgDoc))
  const ink = generateInk(inkToDlgDoc(generateInk(doc.doc as unknown as DlgDoc)).doc)
  ok('тег # speaker в ink', ink.includes('# speaker: npc_resh'), ink.split('\n').slice(0, 6).join(' | '))
  ok('ремарка лишена тега speaker (криминалистика)', !/action.*# speaker|# speaker.*action/.test(ink))
  const back = inkToDlgDoc(ink).doc as unknown as DlgDoc
  const lines = back.nodes[0].sections[0].steps.filter((s) => s.kind === 'line').map((s) => (s as { line: DlgLine }).line)
  ok('спикер пережил круговой обход', lines[0].speaker === 'npc_resh')
  ok('у ремарки спикер не появился', lines[1].action === true && lines[1].speaker === undefined)
}

// ── 3. аудит ──────────────────────────────────────────────────────────────
console.log('[аудит]')
async function storeWith(docs: Record<string, DlgDoc>, metaExtra: Record<string, unknown> = {}): Promise<CampaignAuditReport> {
  const store = new EditorStore()
  store.meta = {
    id: 't', title: 'T', version: '0.0.0', min_engine: '0.8.0', package_format: 1,
    start_scene: 'sc_a', ...metaExtra,
  } as never
  store.world = { version: 1, regions: [], locations: [] } as never
  store.manifest = {
    version: 1, scenes: [], entities: ['npc_kast.json', 'npc_resh.json'], rules: [],
    dialogues: ['d_test.ink'],
  } as never
  store.jsonFiles.set('entities/npc_kast.json', { id: 'npc_kast', type: 'npc', label: 'Каст', dialogue: 'dialogues/d_test.ink' })
  store.jsonFiles.set('entities/npc_resh.json', { id: 'npc_resh', type: 'npc', label: 'Реш' })
  for (const [p, d] of Object.entries(docs)) store.jsonFiles.set(p, d)
  return validateCampaign(store)
}
function dlg(lines: DlgLine[], choiceConds?: object[]): DlgDoc {
  return {
    version: 2, label: 'Д', nodes: [{
      id: 'main', label: 'S', sections: [{ steps: lines.map((l) => ({ kind: 'line' as const, line: l })) }],
      choices: [{ text: 'Дальше', goto: 'end', sections: [], ...(choiceConds ? { conds: choiceConds } : {}) }],
    }],
  } as DlgDoc
}
{
  const r = await storeWith({ 'dialogues/d_test.dlg.json': dlg([{ text: 'Говорю я.', speaker: 'npc_unknown' }]) })
  ok('неведомый спикер — ошибка', r.structure.some((i) => i.severity === 'error' && i.message.includes('npc_unknown')))
}
{
  const r = await storeWith({ 'dialogues/d_test.dlg.json': dlg([{ text: 'Он подходит.', action: true, speaker: 'npc_resh' }]) })
  ok('спикер у ремарки — ошибка', r.structure.some((i) => i.severity === 'error' && i.message.includes('у ремарки задан спикер')))
}
{
  const r = await storeWith({ 'dialogues/d_test.dlg.json': dlg([{ text: 'Стой!', speaker: 'npc_resh' }]) })
  ok('без гейта присутствия — предупреждение', r.structure.some((i) => i.severity === 'warning' && i.message.includes('из пустоты')), JSON.stringify(r.structure.map((i) => i.message)).slice(0, 200))
}
{
  const r = await storeWith({ 'dialogues/d_test.dlg.json': dlg([{ text: 'Стой!', speaker: 'npc_resh' }], [{ type: 'in_party', npc: 'npc_resh' }]) })
  ok('с гейтом in_party предупреждения нет', !r.structure.some((i) => i.message.includes('из пустоты')))
}
{
  const r = await storeWith({ 'dialogues/d_test.dlg.json': dlg([{ text: 'Обычная реплика.' }]) }, { roguelike: { permadeath: true } })
  ok('permadeath + слоты по умолчанию — предупреждение', r.structure.some((i) => i.severity === 'warning' && i.message.includes('ручных слотов')), JSON.stringify(r.structure.map((i) => i.message)).slice(0, 200))
  const r0 = await storeWith({ 'dialogues/d_test.dlg.json': dlg([{ text: 'Обычная реплика.' }]) }, { roguelike: { permadeath: true }, save_slots: 0 })
  ok('permadeath + save_slots: 0 — предупреждения нет', !r0.structure.some((i) => i.message.includes('ручных слотов')))
}

// ── 4. якоря GUI/гайда ────────────────────────────────────────────────────
console.log('[якоря в коде и доке]')
{
  const hud = readFileSync('src/player/HUD.tsx', 'utf-8')
  ok('призрачная кнопка лагеря (disabled по campAvailable)', hud.includes('campAvailable()') && hud.includes('disabled={!camp.ok}'))
  ok('подсказка-причина на серой кнопке', hud.includes('Ночлег здесь невозможен'))
  const overlay = readFileSync('src/player/DialogueOverlay.tsx', 'utf-8')
  ok('оверлей рисует спикера', overlay.includes('activeLine?.speaker') && overlay.includes('displayedNpc'))
  const guide = readFileSync('docs/ai-campaign-guide.md', 'utf-8')
  ok('гайд: раздел про # speaker', guide.includes('# speaker:'))
  ok('гайд: призрачная кнопка лагеря', guide.includes('видна всегда'))
  ok('гайд: железный рогалик = save_slots 0', guide.includes('save_slots: 0'))
  const types = readFileSync('src/shared/types.ts', 'utf-8')
  ok('тип DlgLine.speaker с аннотацией', /speaker\?: string/.test(types) && types.includes('Присутствие спикера'))
}

if (failed > 0) { console.error(`\nПРОВАЛЕНО: ${failed}`); process.exit(1) }
console.log('\nВсе проверки дз.22 (спикер, рогалик-слоты, призрачный лагерь) зелёные.')
