/**
 * Смоук «дизайн-документ» (§R9 ТЗ): бланк, инструкция агента, манифест
 * чемодана и поле design_doc в схеме согласованы между собой.
 *
 * Проверяет:
 *  1) бланк docs/ai-design-template.md содержит все обязательные разделы
 *     (11 штук, в порядке) и правило «сначала документ, потом JSON»;
 *  2) в теле бланка нет технических идентификаторов формата — они
 *     разрешены только в приложении «Соответствие разделам JSON» (§R7);
 *  3) инструкция агенту (docs/ai-start-instruction.md) требует заполнить
 *     документ до генерации кампании и упоминает обновление на каждой
 *     итерации (§R6);
 *  4) §0 гайда дословно синхронизирован с первоисточником инструкции;
 *  5) манифест чемодана (AI_KIT_FILES) совпадает с содержимым public/ai;
 *  6) в docs/campaign.schema.json поле design_doc есть в CampaignMeta
 *     и необязательно (§R5).
 *
 * Прогон: npx tsx scripts/design-doc-guard.mts  (npm run smoke:design-doc)
 */
import { readdirSync, readFileSync } from 'node:fs'
import { AI_KIT_FILES } from '../src/editor/aiKit'

let failed = 0
const check = (label: string, ok: boolean, extra?: string) => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `\n    ${extra}` : ''}`)
  if (!ok) failed++
}

const template = readFileSync('docs/ai-design-template.md', 'utf8')
const instruction = readFileSync('docs/ai-start-instruction.md', 'utf8')
const guide = readFileSync('docs/ai-campaign-guide.md', 'utf8')
const schema = JSON.parse(readFileSync('docs/campaign.schema.json', 'utf8')) as {
  $defs: Record<string, { properties?: Record<string, { type?: string; description?: string }>; required?: string[] }>
}

// ── 1) обязательные разделы бланка, в порядке ──
const SECTIONS = [
  '## 1. Паспорт',
  '## 2. Завязка и мир',
  '## 3. Главы',
  '## 4. Сцены',
  '## 5. Персонажи',
  '## 6. Квесты и концовки',
  '## 7. Какие механики задействованы',
  '## 8. Рамки баланса',
  '## 9. Что пока нельзя сделать в движке',
  '## 10. Журнал решений',
  '## 11. Приложение «Соответствие разделам JSON»',
]
{
  let pos = -1
  const missing: string[] = []
  for (const heading of SECTIONS) {
    const at = template.indexOf(heading)
    if (at < 0) missing.push(heading)
    else if (at <= pos) missing.push(`${heading} (не в порядке)`)
    else pos = at
  }
  check('бланк: все обязательные разделы на месте и по порядку', missing.length === 0, missing.join('; '))
  check(
    'бланк: правило «сначала документ, потом JSON» и обновление на каждой итерации',
    /Сначала документ, потом\s+JSON/.test(template) && /на каждой итерации/.test(template),
  )
}

// ── 2) технические идентификаторы — только в приложении ──
{
  const APPENDIX = 'Приложение «Соответствие разделам JSON»'
  const at = template.indexOf(APPENDIX)
  const body = at >= 0 ? template.slice(0, at) : template
  const hits: string[] = []
  for (const token of ['set_flag', 'conditions', 'effects', 'MonolithDoc', 'meta.', 'skill_check_gate', 'design_doc', 'cf-feedback']) {
    if (body.includes(token)) hits.push(token)
  }
  for (const m of body.matchAll(/\b[a-z][a-z0-9_]*_[a-z0-9_]*\b/g)) hits.push(m[0])
  for (const m of body.matchAll(/\b(?:meta|campaign|world|scenes|quests)\./g)) hits.push(m[0])
  check(
    'бланк: в теле нет технических идентификаторов вне приложения (§R7)',
    at >= 0 && hits.length === 0,
    at < 0 ? 'не найдено приложение «Соответствие разделам JSON»' : [...new Set(hits)].join(', '),
  )
}

// ── 3) инструкция агенту: до генерации и на каждой итерации ──
check(
  'инструкция: design_doc заполняется до генерации кампании',
  instruction.includes('design_doc') && /до генерации кампании/.test(instruction),
)
check(
  'инструкция: документ обновляется на каждой итерации',
  /на каждой итерации/.test(instruction) && /Сначала обнови `design_doc`/.test(instruction),
)
check(
  'инструкция: возвращается campaign.json через «Файл → Импорт из JSON»',
  /«Файл → Импорт из JSON»/.test(instruction),
)

// ── 4) §0 гайда = первоисточник (demoteHeadings + заголовок §0) ──
{
  const demote = (md: string): string =>
    md.replace(/^(#{1,6}) /gm, (_m, h: string) => '#'.repeat(Math.min(6, h.length + 2)) + ' ')
  const block = guide.match(/<!-- START-INSTRUCTION:BEGIN -->\n([\s\S]*?)\n<!-- START-INSTRUCTION:END -->/)?.[1] ?? ''
  const lines = block.split('\n')
  const title = lines[0] ?? ''
  const body = lines.slice(1).join('\n').replace(/^\n+/, '').replace(/\n+$/, '')
  check(
    '§0 гайда синхронизирован с docs/ai-start-instruction.md',
    block !== '' && body === demote(instruction.trim()),
  )
  check('заголовок §0 — «С чего начать», без упоминания стартового txt', /^## 0\. С чего начать/.test(title) && !title.includes('НАЧНИ'))
}

// ── 5) манифест чемодана ↔ public/ai ──
{
  const actual = readdirSync('public/ai').sort()
  const manifest = AI_KIT_FILES.map((f) => f.name).sort()
  const extra = actual.filter((name) => !manifest.includes(name))
  const missing = manifest.filter((name) => !actual.includes(name))
  check(
    'манифест чемодана совпадает с содержимым public/ai (ровно 4 файла в архиве с campaign.json)',
    extra.length === 0 && missing.length === 0,
    extra.length || missing.length ? `лишние: ${extra.join(', ') || '—'}; нет: ${missing.join(', ') || '—'}` : undefined,
  )
}

// ── 6) design_doc в схеме ──
{
  const meta = schema.$defs.CampaignMeta
  const prop = meta?.properties?.design_doc
  check(
    'campaign.schema.json: design_doc есть в CampaignMeta и необязателен',
    !!prop && prop.type === 'string' && !(meta?.required ?? []).includes('design_doc'),
    prop ? `type=${prop.type}` : 'поля нет',
  )
}

console.log(failed ? `\nПРОВАЛЕНО: ${failed}` : '\nдизайн-документ согласован')
process.exit(failed ? 1 : 0)
