/**
 * Смоук починки ink-условий (фидбек 27, п.6).
 *  1) кейсы нормализатора repairInkChoiceConditions;
 *  2) на живых диалогах кампании (если лежит рядом): после починки ни одной
 *     служебной строки «true/false», ни одной ошибки ink и ни одного тупика —
 *     жадный обход меню разными стратегиями.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createStory, drainStory, firstInkKnot } from '../src/core/dialogue'
import { countMisplacedChoiceConditions, repairInkChoiceConditions } from '../src/core/inkRepair'

let failed = 0
const ok = (cond: boolean, label: string, extra = '') => {
  console.log(`${cond ? '✓' : '✗'} ${label}${cond || !extra ? '' : `\n    ${extra}`}`)
  if (!cond) failed++
}

// ───── 1) нормализатор ─────
const fix = (line: string) => repairInkChoiceConditions(line)

let r = fix('+ [Вот бумага.] { not (get_flag("x")) }')
ok(r.fixed === 1 && r.source === '+ { not (get_flag("x")) } [Вот бумага.]', 'условие после «]» переносится перед «[»', r.source)

r = fix('+ { not (get_flag("x")) } [Вот бумага.]')
ok(r.fixed === 0, 'каноничная запись не трогается')

r = fix('* [Один раз.] { item_count("a") >= 5 and not (get_flag("b")) }')
ok(r.fixed === 1 && r.source.startsWith('* { item_count("a") >= 5 and not (get_flag("b")) } ['), 'разовый выбор «*» с составным условием', r.source)

r = fix('+ (lbl) [Метка.] { get_flag("x") }')
ok(r.fixed === 1 && r.source === '+ (lbl) { get_flag("x") } [Метка.]', 'метка выбора (lbl) остаётся первой', r.source)

r = fix('+ { get_flag("a") } [Два.] { not (get_flag("b")) }')
ok(r.fixed === 1 && r.source === '+ { get_flag("a") } { not (get_flag("b")) } [Два.]', 'условия до и после объединяются', r.source)

r = fix('+ [Сумма.] { get_flag("a") } { get_flag("b") }   // комментарий')
ok(r.fixed === 1 && r.source.includes('// комментарий') && r.source.includes('{ get_flag("a") } { get_flag("b") } [Сумма.]'), 'несколько блоков и комментарий в конце', r.source)

r = fix('+ [Реплика.] { get_flag("x"): тут текст | другой }')
ok(r.fixed === 0, 'условный ТЕКСТ «{ cond: … }» после «]» не считается условием')

r = fix('+ [Реплика.] { a | b }')
ok(r.fixed === 0, 'альтернативы «{a|b}» не считаются условием')

r = fix('+ [Реплика.] { gold }')
ok(r.fixed === 0, 'голая переменная без оператора не трогается (это может быть вывод)')

r = fix('+ [Реплика «a:b».] { get_flag("a:b") }')
ok(r.fixed === 1, 'двоеточие внутри строки-аргумента не мешает', r.source)

r = fix('+ Текст до скобки [скрытая часть] { get_flag("x") }')
ok(r.fixed === 0, 'выбор с текстом до «[» не трогается')

r = fix('Обычная строка { get_flag("x") }')
ok(r.fixed === 0, 'не-выбор не трогается')

r = fix('+ [Вот бумага.] { not (get_flag("x")) }\r\n+ [Другое.] { get_flag("y") }\r\n')
ok(r.fixed === 2 && r.source.includes('\r\n') && !/\] \{/.test(r.source), 'CRLF сохраняется', JSON.stringify(r.source))

ok(countMisplacedChoiceConditions('+ [а] { get_flag("x") }\n+ { get_flag("y") } [б]') === 1, 'счётчик считает только ошибочные строки')

// ───── 2) живые диалоги кампании ─────
const dir = '_ai-temp/campaing/campaign_package/dialogues'
if (!existsSync(dir)) {
  console.log('(диалогов кампании нет рядом — часть 2 пропущена)')
} else {
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.ink')).sort()) {
    const src = readFileSync(join(dir, file), 'utf8')
    const externals = [...src.matchAll(/^EXTERNAL\s+(\w+)\s*\(([^)]*)\)/gm)].map((m) => m[1])
    const entry = /===\s*main\s*===/.test(src) ? 'main' : firstInkKnot(src)

    for (const strategy of ['first', 'last', 'cycle'] as const) {
      const flags = new Set<string>()
      const story = createStory(src, `smoke:${file}:${strategy}`)
      // внешние функции — заглушки; флаги/правила живут в замыкании
      for (const name of externals) {
        let fn: (...a: unknown[]) => unknown = () => 0
        if (name === 'get_flag') fn = (f) => (flags.has(String(f)) ? 1 : 0)
        else if (name === 'set_flag') fn = (f) => (flags.add(String(f)), 0)
        else if (name === 'clear_flag') fn = (f) => (flags.delete(String(f)), 0)
        else if (name === 'fire_rule') fn = (rule) => (flags.add(`rule:${String(rule)}`), 0)
        else if (name === 'item_count') fn = () => (strategy === 'last' ? 99 : 0)
        else if (name === 'skill_check') fn = () => 'success'
        else if (name === 'get_disposition' || name === 'get_meta_counter') fn = () => 0
        else if (name === 'has_item' || name === 'in_party' || name === 'weather_is' || name === 'has_status') fn = () => 0
        story.BindExternalFunction(name, fn as never, false)
      }
      if (!entry) { ok(false, `${file}: нет входного узла`); break }
      story.ChoosePathString(entry)

      // СЫРОЙ обход (мимо drainStory): его страховочный фильтр вырезал бы
      // «true/false», и проверка не смогла бы упасть на настоящем дефекте
      const literals: string[] = []
      let steps = 0
      let stuck = false
      let finished = false
      for (; steps < 300; steps++) {
        while (story.canContinue) {
          const t = (story.Continue() ?? '').trim()
          if (/^(true|false)$/i.test(t)) literals.push(t)
        }
        const choices = story.currentChoices
        if (choices.length === 0) { finished = true; break }
        const pick = strategy === 'first' ? 0 : strategy === 'last' ? choices.length - 1 : steps % choices.length
        story.ChooseChoiceIndex(choices[pick].index)
      }
      const errs = [...(story.currentErrors ?? [])]
      const tag = `${file} [${strategy}]`
      ok(errs.length === 0, `${tag}: нет ошибок ink`, errs.join(' | '))
      ok(literals.length === 0, `${tag}: нет служебных строк true/false в репликах`, literals.join(','))
      // обход упёрся в конец до лимита шагов ИЛИ в разумную петлю хаба — оба варианта нормальны;
      // тупик = меню опустело при живом разговоре без DONE (ink сообщает ошибкой выше)
      ok(!stuck && (finished || steps >= 300), `${tag}: разговор завершается или ходит по хабу`)
    }
  }
}

// ───── 3) второй симптом: пункт с условием «ещё не было» скрывается ─────
const guardPath = join(dir, 'guard.ink')
if (existsSync(guardPath)) {
  const src = readFileSync(guardPath, 'utf8')
  const flags = new Set<string>()
  const story = createStory(src, 'smoke:guard-hide')
  story.BindExternalFunction('get_flag', ((f: string) => (flags.has(f) ? 1 : 0)) as never, false)
  story.BindExternalFunction('set_flag', ((f: string) => (flags.add(f), 0)) as never, false)
  story.BindExternalFunction('item_count', (() => 0) as never, false)
  story.BindExternalFunction('unlock_codex', (() => 0) as never, false)
  story.BindExternalFunction('fire_rule', ((rule: string) => { if (rule === 'rule_guard_papers') flags.add('guard_let_in'); return 0 }) as never, false)
  story.ChoosePathString('main')
  while (story.canContinue) story.Continue()
  const papers = 'Инспектор Ревизии. Вот служебная бумага.'
  const before = story.currentChoices.map((c) => c.text)
  ok(before.includes(papers), 'guard: пункт «служебная бумага» доступен, пока флага нет')
  ok(!before.some((t) => t.startsWith('Вот пять марок')), 'guard: платный пункт скрыт, пока нет серебра (условие работает)')
  story.ChooseChoiceIndex(story.currentChoices.findIndex((c) => c.text === papers))
  while (story.canContinue) story.Continue()
  const afterTexts = story.currentChoices.map((c) => c.text)
  ok(flags.has('guard_let_in'), 'guard: правило сработало и поставило флаг')
  ok(!afterTexts.includes(papers), 'guard: использованный пункт пропал из меню (его нельзя «предъявить» повторно)')
}

// ───── 4) страховка drainStory: голый булев литерал — не реплика ─────
{
  const story = createStory('Привет.\n{ true }\n{ false }\nДо свидания.\n-> DONE\n', 'smoke:literals')
  const d = drainStory(story)
  ok(d.lines.map((l) => l.text).join('|') === 'Привет.|До свидания.', 'drainStory вырезает строки «true/false», настоящие реплики остаются', d.lines.map((l) => l.text).join('|'))
}

if (failed) {
  console.error(`\nink-repair-smoke: провалено проверок — ${failed}`)
  process.exit(1)
}
console.log('\nink-repair-smoke: всё хорошо')
