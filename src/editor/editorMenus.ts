/**
 * Меню редактора и путь кампании: категории верхней навигации, подписи
 * разделов и разбор пути к папке кампании.
 *
 * Вынесено из `EditorApp.tsx`, чтобы компонент редактора оставался в пределах
 * лимита размера: это чистые данные и разбор строки, без состояния.
 */

import type { EditorSection } from './store'

export type SectionItem = { id: EditorSection; label: string }

/** верхнее меню — категории (фидбек 4): плоский список из 9 кнопок захламлял шапку */
export const MENUS: Array<{ id: string; label: string; items: SectionItem[] }> = [
  {
    id: 'project',
    label: 'Проект',
    items: [
      { id: 'campaign', label: 'Кампания и реестры' },
      { id: 'packs', label: 'Каталог паков' },
      { id: 'panels', label: 'Панели пака' },
      { id: 'design', label: 'Дизайн-документ' },
    ],
  },
  {
    id: 'world',
    label: 'Мир',
    items: [
      { id: 'world', label: 'Регионы и локации' },
      { id: 'scenes', label: 'Сцены' },
      { id: 'arenas', label: 'Арены боя' },
    ],
  },
  {
    id: 'cast',
    label: 'Персонажи',
    items: [
      { id: 'entities', label: 'Сущности (NPC и предметы)' },
      { id: 'dialogues', label: 'Диалоги' },
    ],
  },
  {
    id: 'story',
    label: 'История',
    items: [
      { id: 'quests', label: 'Квесты' },
      { id: 'cutscenes', label: 'Катсцены' },
      { id: 'rules', label: 'Правила мира' },
      { id: 'codex', label: 'Кодекс' },
    ],
  },
  {
    id: 'mechanics',
    label: 'Механики',
    items: [
      { id: 'combat', label: 'Правила боя' },
      { id: 'recipes', label: 'Рецепты крафта' },
    ],
  },
]

export function navLabelOf(id: EditorSection): string {
  for (const m of MENUS) for (const it of m.items) if (it.id === id) return it.label
  return id
}

export function campaignIdFromPath(path: string): string {
  const pathname = path.startsWith('http') ? new URL(path).pathname : path
  const parts = pathname.split('/').filter(Boolean)
  return parts[parts.length - 1] ?? ''
}
