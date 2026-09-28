/**
 * Смоук импорта ink→конструктор: каждый рукописный диалог полигона
 * (ash-of-caerden) разбирается без потерь, а пересборка generateInk
 * сохраняет все узлы, тексты ответов и эффекты set_flag/add_item.
 *
 * Прогон: npx tsx scripts/ink-import-smoke.mts
 */
import { readFileSync, readdirSync } from 'node:fs'
import { inkToDlgDoc, regenInk } from '../src/editor/inkImport'

let failed = 0
const check = (label: string, ok: boolean, extra?: string) => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? ` — ${extra}` : ''}`)
  if (!ok) failed++
}

const dir = 'public/campaigns/ash-of-caerden/dialogues'
const files = readdirSync(dir).filter((f) => f.endsWith('.ink'))
check('папка диалогов полигона на месте', files.length >= 5, `${files.length} файлов`)

for (const file of files) {
  const src = readFileSync(`${dir}/${file}`, 'utf8')
  const { doc, warnings } = inkToDlgDoc(src, file)
  check(`${file}: импорт без потерь`, warnings.length === 0, warnings.length ? warnings.slice(0, 3).join(' | ') : `${doc.nodes.length} узлов`)

  const out = regenInk(doc)
  // все узлы исходника (без *-_hub) — в выходе, hub'ы пересчитаны транспортом
  const srcKnots = [...src.matchAll(/^=== ([\w-]+) ===$/gm)].map((m) => m[1])
  for (const k of srcKnots) {
    if (!out.includes(`=== ${k} ===`)) {
      check(`${file}: узел ${k} сохранён`, false)
      break
    }
  }
  // тексты всех ответов исходника присутствуют в выходном ink
  const choiceTexts = [...src.matchAll(/^[+*]\s*(?:\{[^\]]*\}\s*)?\[[^\]]+\]/gm)]
    .map((m) => m[0].match(/\[([^\]]+)\]/)?.[1] ?? '')
  const lost = choiceTexts.filter((t) => t && !out.includes(`[${t}]`))
  check(`${file}: тексты ответов сохранены (${choiceTexts.length})`, lost.length === 0, lost.slice(0, 2).join(' | '))
  // эффекты прокидываются (темп лайна ~ fn( )
  const srcEffects = new Set([...src.matchAll(/^\s*~\s*([a-z_]+\([^)]*\))$/gm)].map((m) => m[1].trim()))
  const lostFx = [...srcEffects].filter((e) => !out.includes(e))
  check(`${file}: эффекты сохранены (${srcEffects.size})`, lostFx.length === 0, lostFx.slice(0, 2).join(' | '))
  // сторож: ни один текст не должен превратиться в «мусорную скобку»
  const texts: string[] = []
  const walk = (secs: { steps: Array<{ kind: string; line?: { text: string } }> }[]) => secs.forEach((sc) => sc.steps.forEach((st) => { if (st.line) texts.push(st.line.text) }))
  doc.nodes.forEach((n) => { walk(n.sections); n.choices.forEach((c) => { walk(c.sections); walk(c.check?.success.sections ?? []); walk(c.check?.fail.sections ?? []) }) })
  check(`${file}: нет мусорных скобок в репликах`, texts.every((t) => t.trim() !== '}'))
}

// обратные переходы: импорт пересобранного ink даёт тот же документ (первая узел-стабильность)
{
  const a = inkToDlgDoc(readFileSync(`${dir}/aldric.ink`, 'utf8')).doc
  const b = inkToDlgDoc(regenInk(a)).doc
  const sig = (d: typeof a) => JSON.stringify(d.nodes.map((n) => [n.id, n.choices.map((c) => c.text)]))
  check('повторный импорт пересборки стабилен (aldric)', sig(a) === sig(b))
}

console.log(failed ? `\nПРОВАЛЕНО: ${failed}` : '\nвсе проверки зелёные')
process.exit(failed ? 1 : 0)
