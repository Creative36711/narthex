/**
 * Игровые визуальные профили (редизайн 2026, каталог из 13 направлений).
 *
 * Профиль — «стартовый художественный набор»: палитра поверхностей, пара
 * шрифтовых ролей, формы, стиль панелей/HUD и именованный атмосферный
 * эффект. Это НЕ тип механики: выбор профиля не трогает правила, dice_rules,
 * реестры и сохранения. После применения автор может свободно менять акцент,
 * шрифты, фоны и атмосферу (ThemeDoc) и смешивать жанры — безопасные
 * настройки, а не отдельные ветки логики.
 *
 * Реестр именованных значений (а не произвольный CSS): движок применяет
 * профиль классом `.cf-profile-<id>` на контейнере `.cf-themed` — ни одного
 * `if (genre === …)` в игровых компонентах.
 *
 * Обратная совместимость: старые кампании с `theme.profile` = 'fantasy' |
 * 'horror' | 'survival' аккуратно сопоставляются с новыми профилями
 * (LEGACY_PROFILE_IDS) — игра и редактор их понимают, данные не мигрируют.
 */

import type { CampaignMeta, VisualProfileId } from './types'

/** Фирменный профиль движка — дефолт для новых кампаний */
export const DEFAULT_PROFILE: VisualProfileId = 'forge'

/**
 * Старые id профилей (редизайн 2026, первая итерация) → новые.
 * Сохраняем чтение старых кампаний без миграции данных.
 */
export const LEGACY_PROFILE_IDS: Record<string, VisualProfileId> = {
  fantasy: 'dark-fantasy',
  horror: 'gothic-horror',
  survival: 'wilderness',
}

export type ProfileGroup = 'brand' | 'fantasy' | 'horror' | 'detective' | 'survival' | 'sci-fi'

export const PROFILE_GROUPS: Array<{ id: ProfileGroup; label: string }> = [
  { id: 'brand', label: 'Фирменный стиль' },
  { id: 'fantasy', label: 'Фэнтези' },
  { id: 'horror', label: 'Хоррор' },
  { id: 'detective', label: 'Детектив и история' },
  { id: 'survival', label: 'Выживание' },
  { id: 'sci-fi', label: 'Фантастика и города' },
]

export interface VisualProfile {
  id: VisualProfileId
  /** человекочитаемое русское название (единственное, что видит автор) */
  label: string
  /** группа каталога — для карточек в редакторе */
  group: ProfileGroup
  /** короткая характеристика для карточки в редакторе */
  tagline: string
  /** свотчи для живого предпросмотра в редакторе (не используются в игре) */
  swatches: {
    /** фон сцены/окна */
    bg: string
    /** панель интерфейса */
    panel: string
    /** основной текст */
    text: string
    /** акцент */
    accent: string
    /** характерная деталь: рамка сцены */
    frame: string
  }
  /** шрифтовые роли профиля (для предпросмотра; в игре задаются CSS-классом) */
  fonts: { body: string; display: string }
  /** именованный атмосферный эффект (CSS-слой на контейнере) */
  effect: 'ember' | 'grain' | 'clean' | 'haze' | 'vignette' | 'ink' | 'dust' | 'scan' | 'neon'
  /** подпись эффекта для чекбокса «Атмосферный эффект» в редакторе */
  effectLabel: string
}

export const VISUAL_PROFILES: VisualProfile[] = [
  {
    id: 'forge',
    label: 'Chronicle Forge',
    group: 'brand',
    tagline: 'Фирменный стиль движка: графитово-индиговые поверхности, латунный акцент, «хроникальная» дисплейная антиква. Дефолт для новых кампаний.',
    swatches: { bg: '#14161c', panel: '#1b1f27', text: '#e8ebf2', accent: '#c08a4a', frame: '#56637a' },
    fonts: { body: "'Segoe UI', system-ui, sans-serif", display: "'Palatino Linotype', Palatino, Georgia, serif" },
    effect: 'ember',
    effectLabel: 'медная дымка и мягкая виньетка',
  },
  {
    id: 'epic-fantasy',
    label: 'Эпическое фэнтези',
    group: 'fantasy',
    tagline: 'Ярче и величественнее: королевский индиго, насыщенный золото-синий, двойная рамка сцены, ощущение большого приключения.',
    swatches: { bg: '#171226', panel: '#241a38', text: '#f2e9d8', accent: '#e8b64c', frame: '#8a76b8' },
    fonts: { body: "Georgia, 'Times New Roman', serif", display: "'Palatino Linotype', Palatino, Georgia, serif" },
    effect: 'ember',
    effectLabel: 'золотое сияние и глубокая виньетка',
  },
  {
    id: 'dark-fantasy',
    label: 'Тёмное фэнтези',
    group: 'fantasy',
    tagline: 'Пепел, камень и ржавое золото: суровые тёплые поверхности и редакционная типографика — настроение «Пепла Каэрдена».',
    swatches: { bg: '#161210', panel: '#211a14', text: '#ecdfc6', accent: '#c9a45c', frame: '#6b543a' },
    fonts: { body: "Georgia, 'Times New Roman', serif", display: "'Palatino Linotype', Palatino, Georgia, serif" },
    effect: 'ember',
    effectLabel: 'тёплый свет и лёгкое зерно',
  },
  {
    id: 'myth-folklore',
    label: 'Мифы и фольклор',
    group: 'fantasy',
    tagline: 'Мох, берёза и воск: природные оттенки, мягкая гуманистическая антиква и сказочная дымка — интонация былин, а не классического фэнтези.',
    swatches: { bg: '#131a13', panel: '#1c261c', text: '#e9e4cf', accent: '#d19a45', frame: '#71896b' },
    fonts: { body: "'Palatino Linotype', Palatino, Georgia, serif", display: "Georgia, 'Times New Roman', serif" },
    effect: 'haze',
    effectLabel: 'сказочная дымка и мягкое зерно',
  },
  {
    id: 'gothic-horror',
    label: 'Готический хоррор',
    group: 'horror',
    tagline: 'Холодный камень и строгая контрастность: сталь-синие тона, тревожные акценты дозированно, мерцающее плёночное зерно.',
    swatches: { bg: '#0c0e11', panel: '#161b22', text: '#d7dde4', accent: '#8fa7bd', frame: '#4a5a6d' },
    fonts: { body: "'Segoe UI', system-ui, sans-serif", display: "'Times New Roman', Times, Georgia, serif" },
    effect: 'grain',
    effectLabel: 'виньетка и плёночное зерно',
  },
  {
    id: 'cosmic-horror',
    label: 'Космический хоррор',
    group: 'horror',
    tagline: 'Глубокая холодная бездна, бледно-бирюзовый свет «неизвестного», острые углы и очень тёмная виньетка.',
    swatches: { bg: '#0a1012', panel: '#10181b', text: '#cfe3e3', accent: '#6fd8d0', frame: '#47646e' },
    fonts: { body: "'Segoe UI', system-ui, sans-serif", display: "'Segoe UI', system-ui, sans-serif" },
    effect: 'vignette',
    effectLabel: 'глубокая пустота и холодное свечение',
  },
  {
    id: 'noir',
    label: 'Детектив / нуар',
    group: 'detective',
    tagline: 'Выразительный монохром: угольные поверхности, тёплый «соляный» акцент, редакционная антиква и жёсткая виньетка плёнки.',
    swatches: { bg: '#101013', panel: '#191a1e', text: '#e8e6e0', accent: '#d9a441', frame: '#5c5e68' },
    fonts: { body: "'Segoe UI', system-ui, sans-serif", display: "Georgia, 'Times New Roman', serif" },
    effect: 'grain',
    effectLabel: 'жёсткая виньетка и зерно плёнки',
  },
  {
    id: 'historical',
    label: 'Историческая хроника',
    group: 'detective',
    tagline: 'Чернила и бумага: сепия, антиква «документа», мелкие капители заголовков — ощущение летописи или архивного документа.',
    swatches: { bg: '#191410', panel: '#241d15', text: '#e6dcc4', accent: '#b5793f', frame: '#7a6a4e' },
    fonts: { body: "'Times New Roman', Times, Georgia, serif", display: "'Palatino Linotype', Palatino, Georgia, serif" },
    effect: 'ink',
    effectLabel: 'сепия и зерно старой бумаги',
  },
  {
    id: 'wilderness',
    label: 'Выживание в дикой местности',
    group: 'survival',
    tagline: 'Полевой HUD: природные зелёно-серые тона, янтарный акцент, ясная иерархия ресурсов и чистый кадр без декоративных слоёв.',
    swatches: { bg: '#111514', panel: '#1a201e', text: '#e0e8e2', accent: '#e0a63e', frame: '#55685f' },
    fonts: { body: "'Segoe UI', system-ui, sans-serif", display: "'Segoe UI', system-ui, sans-serif" },
    effect: 'clean',
    effectLabel: 'чистый кадр, без декоративных слоёв',
  },
  {
    id: 'postapocalypse',
    label: 'Постапокалипсис',
    group: 'survival',
    tagline: 'Пыль, выцветшие поверхности и ржавые акценты: моноширинные заголовки «полевой техники» и пылевая дымка.',
    swatches: { bg: '#171512', panel: '#201d18', text: '#ddd6c6', accent: '#c26a35', frame: '#6b6252' },
    fonts: { body: "'Segoe UI', system-ui, sans-serif", display: "'Consolas', 'Menlo', monospace" },
    effect: 'dust',
    effectLabel: 'пылевая дымка и виньетка',
  },
  {
    id: 'scifi',
    label: 'Научная фантастика / космоопера',
    group: 'sci-fi',
    tagline: 'Технологичные поверхности: глубокий космический сине-графит, ледяное свечение, сканлайны и моноширинные HUD-заголовки.',
    swatches: { bg: '#0d1420', panel: '#141d2e', text: '#dce8f5', accent: '#4fd8e8', frame: '#46648e' },
    fonts: { body: "'Segoe UI', system-ui, sans-serif", display: "'Consolas', 'Menlo', monospace" },
    effect: 'scan',
    effectLabel: 'сканлайны и холодное свечение',
  },
  {
    id: 'cyberpunk',
    label: 'Киберпанк',
    group: 'sci-fi',
    tagline: 'Резкие контрасты: почти чёрный фиолет, неоново-магентовый акцент с циановым подсвечиванием, тяжёлые плакатные заголовки.',
    swatches: { bg: '#120d18', panel: '#1c1426', text: '#ece5f5', accent: '#e84fd0', frame: '#7a55a0' },
    fonts: { body: "'Segoe UI', system-ui, sans-serif", display: "'Arial Black', 'Arial Bold', Gadget, sans-serif" },
    effect: 'neon',
    effectLabel: 'неоновое свечение и сканлайны',
  },
  {
    id: 'modern',
    label: 'Современное приключение',
    group: 'sci-fi',
    tagline: 'Городская история: чистый нейтрально-серый интерфейс, спокойный синий акцент, мягкие скругления и минимум декора.',
    swatches: { bg: '#14161a', panel: '#1d2026', text: '#eef0f4', accent: '#4a90d9', frame: '#5a6373' },
    fonts: { body: "'Segoe UI', system-ui, sans-serif", display: "'Segoe UI', system-ui, sans-serif" },
    effect: 'clean',
    effectLabel: 'чистый кадр, без декоративных слоёв',
  },
]

export function profileById(id: VisualProfileId): VisualProfile {
  return VISUAL_PROFILES.find((p) => p.id === id) ?? VISUAL_PROFILES[0]
}

export function profileLabel(id: VisualProfileId): string {
  return profileById(id).label
}

/**
 * Нормализация id профиля из данных кампании: новое значение — как есть,
 * старое (fantasy/horror/survival) — через LEGACY_PROFILE_IDS, неизвестное
 * — дефолт. Данные кампании при этом не переписываются.
 */
export function normalizeProfileId(id: string | null | undefined): VisualProfileId {
  if (!id) return DEFAULT_PROFILE
  const known = VISUAL_PROFILES.find((p) => p.id === id)
  if (known) return known.id
  const legacy = LEGACY_PROFILE_IDS[id]
  if (legacy) return legacy
  return DEFAULT_PROFILE
}

/**
 * Разрешение профиля кампании. Старые кампании (без `theme` или без
 * `theme.profile`) получают фирменный дефолт; неизвестное значение
 * не роняет игру — тоже дефолт.
 */
export function resolveProfile(meta: CampaignMeta | null | undefined): VisualProfile {
  return profileById(normalizeProfileId(meta?.theme?.profile))
}

/** CSS-класс профиля для контейнера `.cf-themed` */
export function profileClass(meta: CampaignMeta | null | undefined): string {
  return `cf-profile-${resolveProfile(meta).id}`
}

/** Включён ли атмосферный эффект профиля (поле `theme.atmosphere`) */
export function atmosphereOn(meta: CampaignMeta | null | undefined): boolean {
  return meta?.theme?.atmosphere !== false
}

/* ── контрастность (для предупреждения автору при выборе акцента) ── */

function srgbChannel(v: number): number {
  const c = v / 255
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

export function luminanceOf(hex: string): number {
  let s = hex.trim().replace(/^#/, '')
  if (/^[0-9a-f]{3}$/i.test(s)) s = s.split('').map((c) => c + c).join('')
  const m = /^([0-9a-f]{6})$/i.exec(s)
  if (!m) return 0.5
  const n = parseInt(m[1], 16)
  return 0.2126 * srgbChannel((n >> 16) & 255) + 0.7152 * srgbChannel((n >> 8) & 255) + 0.0722 * srgbChannel(n & 255)
}

/** отношение контраста WCAG (1…21) между двумя hex-цветами */
export function contrastRatio(a: string, b: string): number {
  const la = luminanceOf(a)
  const lb = luminanceOf(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}
