/**
 * Отпечаток кампании (проектирование мастерской, защита авторства):
 * SHA-256 канонической JSON-формы монолита. Канон: порядок ключей объектов
 * сортируется, массивы — как есть; поля публикации (meta.author,
 * meta.attribution, meta.series) из отпечатка исключены — смена их
 * «новым автором» не поменяет подпись, и мастерская увидит совпадение.
 *
 * Совместимость: отпечаток не меняет файловый формат; вычисляется на лету.
 */
export const FINGERPRINT_STRIP_PATHS = new Set(['meta.author', 'meta.attribution', 'meta.series'])

/** канонизация: объекты с отсортированными ключами, без исключённых путей */
export function canonicalize(value: unknown, path = '', strip: Set<string> = FINGERPRINT_STRIP_PATHS): unknown {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map((v, i) => canonicalize(v, `${path}[${i}]`, strip))
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    const p = path ? `${path}.${key}` : key
    if (strip.has(p)) continue
    out[key] = canonicalize((value as Record<string, unknown>)[key], p, strip)
  }
  return out
}

export function canonicalJson(doc: unknown): string {
  return JSON.stringify(canonicalize(doc))
}

/** hex sha-256 строки; работает и в браузере, и в Node (crypto.subtle) */
export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const subtle = globalThis.crypto?.subtle
  if (!subtle) throw new Error('crypto.subtle недоступен в этой среде')
  const buf = await subtle.digest('SHA-256', data)
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Отпечаток монолита кампании (полные 64 hex; для показа используйте первые 16) */
export async function campaignFingerprint(monolithDoc: unknown): Promise<string> {
  return sha256Hex(canonicalJson(monolithDoc))
}

/** похожесть двух кампаний по отпечаткам (true = та же каноническая форма) */
export async function sameCampaignCanonical(a: unknown, b: unknown): Promise<boolean> {
  return (await campaignFingerprint(a)) === (await campaignFingerprint(b))
}
