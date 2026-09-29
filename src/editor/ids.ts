/**
 * Автогенерация id из человекочитаемых названий (ТЗ 5: мастер задаёт названия,
 * id движок придумывает сам). Кириллица транслитерируется.
 */

const RU: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i',
  й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
  у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '',
  э: 'e', ю: 'yu', я: 'ya',
}

export function slugify(label: string): string {
  const lower = label.toLowerCase().trim()
  let out = ''
  for (const ch of lower) {
    if (/[a-z0-9]/.test(ch)) out += ch
    else if (RU[ch] !== undefined) out += RU[ch]
    // подчёркивание — тоже разделитель: иначе id вроде scene_old_map
    // терял его и превращался в файл scenegatesfront, а scene_old_map и
    // scene_oldmap давали одно имя файла (см. fileNameFor в monolith.ts)
    else if (/[\s_\-—–.,/\\]/.test(ch)) out += '_'
    // прочие символы отбрасываем
  }
  out = out.replace(/_+/g, '_').replace(/^_|_$/g, '')
  return out || 'unnamed'
}

/** уникальный id: prefix + slug (+ порядковый номер при коллизии) */
export function makeId(prefix: string, label: string, existing: string[]): string {
  const base = `${prefix}${slugify(label)}`
  if (!existing.includes(base)) return base
  let n = 2
  while (existing.includes(`${base}_${n}`)) n++
  return `${base}_${n}`
}
