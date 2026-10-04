import type { EncounterTableDef, RuleDef } from './types'

/**
 * Разбор файла из `rules/` Campaign Package: правило это или таблица встреч.
 *
 * Зачем нужно (дыра, найденная на кампании «Ржавая литургия»): ИИ-агент положил
 * файл с `encounter_tables` ещё и в `manifest.rules`. Загрузчик молча писал
 * `rules[r.id] = r` с `id === undefined`, и «правило» без `conditions`/`effects`
 * роняло и редактор (`RuleEditor`: reading 'length'), и движок
 * (`ruleConditionsOk`: reading 'every') — причём молча, без внятной причины.
 *
 * Теперь каждый вход `manifest.rules` проходит через эту функцию:
 * - файл с `encounter_tables` признаётся таблицей встреч и уходит в `encounters`
 *   (если его там ещё нет) — игра и редактор видят его там, где он должен быть;
 * - правило без `id` отбрасывается с предупреждением, а не ключом `undefined`;
 * - у правила без массивов `conditions`/`effects` массивы восстанавливаются
 *   пустыми: правило без условий — это осмысленное «сработает всегда»,
 *   а `undefined` — это авария.
 *
 * Функция чистая: вход не мутируется снаружи, предупреждения возвращаются
 * списком — вызывающий сам решает, куда их показать (консоль, баннер, отчёт).
 */
export type RuleFileVerdict =
  | { kind: 'rule'; rule: RuleDef; warnings: string[] }
  | { kind: 'encounters'; tables: EncounterTableDef[]; warnings: string[] }
  | { kind: 'invalid'; warnings: string[] }

/** Похоже ли значение на файл-обёртку таблиц встреч (`EncounterFileDef`). */
function isEncounterFile(obj: Record<string, unknown>): boolean {
  return Array.isArray(obj.encounter_tables)
}

/** Похоже ли значение на «голую» таблицу встреч без обёртки. */
function isBareTable(obj: Record<string, unknown>): boolean {
  return !('id' in obj) && !('conditions' in obj) && !('effects' in obj) && Array.isArray(obj.entries)
}

export function parseRuleFile(file: string, raw: unknown): RuleFileVerdict {
  const warnings: string[] = []
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    warnings.push(`rules/${file}: файл не является ни правилом, ни таблицей встреч — пропущен.`)
    return { kind: 'invalid', warnings }
  }
  const obj = raw as Record<string, unknown>

  if (isEncounterFile(obj) || isBareTable(obj)) {
    const tables = (isEncounterFile(obj) ? obj.encounter_tables : [obj]) as EncounterTableDef[]
    const clean = tables.filter((t) => !!t && typeof t === 'object' && typeof t.id === 'string')
    warnings.push(
      `rules/${file}: это таблица встреч, а не правило. Такие файлы перечисляют в manifest.encounters, ` +
        `а не в manifest.rules; загружено как встреч${clean.length === 1 ? 'а' : clean.length > 1 ? ` (${clean.length})` : ''}.`,
    )
    return { kind: 'encounters', tables: clean, warnings }
  }

  const rule = raw as RuleDef
  if (!rule.id || typeof rule.id !== 'string') {
    warnings.push(`rules/${file}: у правила нет id — файл пропущен (иначе он попал бы в реестр под ключом «undefined»).`)
    return { kind: 'invalid', warnings }
  }
  if (!Array.isArray(rule.conditions)) {
    warnings.push(`rules/${file}: у правила «${rule.id}» не было массива conditions — восстановлен пустым.`)
    rule.conditions = []
  }
  if (!Array.isArray(rule.effects)) {
    warnings.push(`rules/${file}: у правила «${rule.id}» не было массива effects — восстановлен пустым.`)
    rule.effects = []
  }
  if (rule.conditions_any !== undefined && !Array.isArray(rule.conditions_any)) {
    warnings.push(`rules/${file}: у правила «${rule.id}» conditions_any не массив — поле отброшено.`)
    delete rule.conditions_any
  }
  return { kind: 'rule', rule, warnings }
}
