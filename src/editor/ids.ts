/**
 * Автогенерация внутренних id документов из человекочитаемых названий.
 * ID самой кампании — исключение: это неизменяемая UUID-идентичность,
 * не связанная с названием (см. createCampaignUuid ниже).
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

/**
 * Безопасный id кампании для каталога. Готовые латинские id сохраняем как есть
 * (включая дефисы); всё остальное приводим к slug без разделителей пути.
 */
export function normalizeCampaignId(id: string): string {
  const lower = id.trim().toLowerCase()
  return /^[a-z0-9][a-z0-9_-]*$/.test(lower) ? lower : slugify(lower)
}

/** Случайный RFC 4122 UUID v4 — устойчивая идентичность новой кампании. */
export function createCampaignUuid(): string {
  const cryptoApi = globalThis.crypto
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID()
  if (!cryptoApi?.getRandomValues) throw new Error('Для создания id кампании нужен криптографический генератор случайных чисел.')
  const bytes = cryptoApi.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** уникальный id: prefix + slug (+ порядковый номер при коллизии) */
export function makeId(prefix: string, label: string, existing: string[]): string {
  const base = `${prefix}${slugify(label)}`
  if (!existing.includes(base)) return base
  let n = 2
  while (existing.includes(`${base}_${n}`)) n++
  return `${base}_${n}`
}
