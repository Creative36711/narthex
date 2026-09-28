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
  // сторож условий: каждая числовая проверка (здоровье, расположение, предметы)
  // пересобрана с тем же порогом — ловит потерю аргументов парсера (баг get_hp >= null)
  const srcCmp = [...new Set([...src.matchAll(/(get_hp\(\)|get_disposition\("[^"]+"\)|item_count\("[^"]+"\))\s*(>=|<|==|!=)\s*(-?\d+)/g)].map((m) => `${m[1]} ${m[2]} ${m[3]}`))]
  const lostCmp = srcCmp.filter((c) => !out.replace(/\s+/g, ' ').includes(c))
  check(`${file}: пороги условий сохранены (${srcCmp.length})`, lostCmp.length === 0, lostCmp.slice(0, 2).join(' | '))
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

// полный round-trip: пересборка воспроизводит исходный ink посимвольно
// (после нормализации хвостовых пробелов) — гарантия «тихого» автоимпорта без потерь
{
  const norm = (s: string) => s.replace(/\s+$/gm, '').trim()
  for (const file of files) {
    const src = readFileSync(`${dir}/${file}`, 'utf8')
    const { doc, warnings } = inkToDlgDoc(src, file)
    if (warnings.length) continue
    check(`${file}: round-trip посимвольный`, norm(regenInk(doc)) === norm(src))
  }
  // регрессия 29-09: условие get_hp() >= 12 не должно терять порог (сдвиг групп regex)
  const cor = inkToDlgDoc(readFileSync(`${dir}/corvin.ink`, 'utf8')).doc
  let hp: { type?: string; value?: number } | null = null
  const pick = (secs: { conds?: { type: string; value?: number }[] }[]) =>
    secs.forEach((s) => (s.conds ?? []).forEach((c) => { if (c.type === 'hp_ge') hp = c }))
  cor.nodes.forEach((n) => { pick(n.sections); n.choices.forEach((c) => { pick(c.sections); pick(c.check?.success.sections ?? []); pick(c.check?.fail.sections ?? []) }) })
  check('corvin: порог лечения hp ≥ 12 разобран', (hp as { value?: number } | null)?.value === 12, JSON.stringify(hp))
}

// русские названия: у каждого рукописного диалога полигона лежит визуальный
// исходник (.dlg.json) с русским label диалога и узлов — регресс 29-09:
// после миграции на ink списки и конструктор показывали «aldric», «first meeting»
{
  const isCyr = (s: string) => /[а-яё]/i.test(s)
  for (const file of files) {
    const dlgFile = file.replace(/\.ink$/, '.dlg.json')
    let dlg: { label?: string; nodes?: { id: string; label?: string }[] } | null = null
    try { dlg = JSON.parse(readFileSync(`${dir}/${dlgFile}`, 'utf8')) } catch { dlg = null }
    check(`${dlgFile}: визуальный исходник на месте`, !!dlg)
    if (!dlg) continue
    const latinNodes = (dlg.nodes ?? []).filter((n) => n.label && !isCyr(n.label)).map((n) => n.id)
    check(`${dlgFile}: название диалога по-русски`, isCyr(dlg.label ?? ''), dlg.label)
    check(`${dlgFile}: названия узлов по-русски`, latinNodes.length === 0, latinNodes.join(', '))
  }
}

console.log(failed ? `\nПРОВАЛЕНО: ${failed}` : '\nвсе проверки зелёные')
process.exit(failed ? 1 : 0)
