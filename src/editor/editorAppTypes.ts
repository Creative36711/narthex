/**
 * Общий контекст страницы редактора: состояние, сеттеры и операции.
 *
 * Вынесено из `EditorApp.tsx`, чтобы части страницы (шапка, рабочая область,
 * оверлеи, экраны-заглушки) получали одно и то же вместо сорока отдельных
 * параметров. Набор полей — ровно то, что эти части читают.
 */

import type { Dispatch, RefObject, SetStateAction } from 'react'
import type { CampaignData } from '../shared/types'
import type { CampaignIndexEntry } from '../shared/types'
import type { GameEngine } from '../core/engine'
import type { PlaytestRecord } from './campaignAudit'
import type { EditorSection, EditorStore } from './store'
import type { CampaignOps } from './editorAppCampaignOps'
import type { FileOps } from './editorAppFileOps'

/** Строка списка документов раздела: путь, заголовок и группа. */
export interface EditorListItem {
  path: string
  title: string
  group?: string
  groupOrder?: string
}

/** Всё, что нужно частям страницы редактора. */
export interface EditorUi {
  store: EditorStore
  base: string
  setBase: Dispatch<SetStateAction<string>>
  readyStore: EditorStore | null
  setReadyStore: Dispatch<SetStateAction<EditorStore | null>>
  loaded: boolean
  error: string | null
  setError: Dispatch<SetStateAction<string | null>>
  section: EditorSection
  setSection: Dispatch<SetStateAction<EditorSection>>
  openMenu: string | null
  setOpenMenu: Dispatch<SetStateAction<string | null>>
  aiWizard: boolean
  setAiWizard: Dispatch<SetStateAction<boolean>>
  aiTaskReport: string
  setAiTaskReport: Dispatch<SetStateAction<string>>
  auditOpen: boolean
  setAuditOpen: Dispatch<SetStateAction<boolean>>
  lastPlaytest: PlaytestRecord | null
  setLastPlaytest: Dispatch<SetStateAction<PlaytestRecord | null>>
  q: string
  setQ: Dispatch<SetStateAction<string>>
  kindF: 'all' | 'npc' | 'item'
  setKindF: Dispatch<SetStateAction<'all' | 'npc' | 'item'>>
  chapterF: string
  setChapterF: Dispatch<SetStateAction<string>>
  selected: string | null
  setSelected: Dispatch<SetStateAction<string | null>>
  busy: string | null
  setBusy: Dispatch<SetStateAction<string | null>>
  campaigns: CampaignIndexEntry[]
  setCampaigns: Dispatch<SetStateAction<CampaignIndexEntry[]>>
  testCampaign: CampaignData | null
  testEngine: GameEngine | null
  setTestEngine: Dispatch<SetStateAction<GameEngine | null>>
  debugOpen: boolean
  setDebugOpen: Dispatch<SetStateAction<boolean>>
  bookOpen: boolean
  setBookOpen: Dispatch<SetStateAction<boolean>>
  bookFile: string
  setBookFile: Dispatch<SetStateAction<string>>
  bookContextual: boolean
  setBookContextual: Dispatch<SetStateAction<boolean>>
  edTheme: 'paper' | 'dark' | 'anthracite'
  changeEdTheme: (v: 'paper' | 'dark' | 'anthracite') => void
  aiDiffEnabled: boolean
  toggleAiDiff: () => void
  fileInput: RefObject<HTMLInputElement | null>
  folderInput: RefObject<HTMLInputElement | null>
  modifiedCount: number
  itemsAll: EditorListItem[]
  items: EditorListItem[]
  hasList: boolean
  questsOff: boolean
  sel: string | null
  groupCounts: Map<string, number>
  createNew: (entityType?: 'item' | 'npc') => Promise<void>
  doImport: (file: File) => Promise<void>
  doImportJson: () => Promise<void>
  ops: CampaignOps
  fileOps: FileOps
  onExit: () => void
}
