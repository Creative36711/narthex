/**
 * Побочные эффекты страницы редактора: загрузка кампании, подписка на стор,
 * закрытие меню по клику, реестр кампаний, горячие клавиши и автовыбор записи.
 *
 * Вынесено из `EditorApp.tsx`: у эффектов нет разметки, им нужны только стор и
 * сеттеры страницы. Тело эффектов перенесено без изменений.
 */

import { useEffect, useMemo } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { stopMusic } from '../shared/music'
import { setAmbientAudioEnabled } from '../shared/audio'
import { showList } from './prompt'
import { fetchCampaignIndex } from './campaignIndex'
import type { CampaignIndexEntry } from '../shared/types'
import type { EditorSection, EditorStore } from './store'

/** Аргументы эффекта загрузки кампании. */
export interface LoadEffectArgs {
  store: EditorStore
  base: string
  setError: Dispatch<SetStateAction<string | null>>
  setSelected: Dispatch<SetStateAction<string | null>>
  setReadyStore: Dispatch<SetStateAction<EditorStore | null>>
}

/** Аргументы эффекта реестра кампаний. */
export interface IndexEffectArgs {
  base: string
  setCampaigns: Dispatch<SetStateAction<CampaignIndexEntry[]>>
}

/** Аргументы эффекта автовыбора записи раздела. */
export interface AutoSelectEffectArgs {
  loaded: boolean
  base: string
  error: string | null
  testCampaign: unknown
  section: EditorSection
  selected: string | null
  store: EditorStore
  setSelected: Dispatch<SetStateAction<string | null>>
}

/**
 * Загрузка кампании при смене базового пути.
 * @param args стор, путь кампании и сеттеры готовности/ошибки
 */
export function useEditorLoadEffect({ store, base, setError, setSelected, setReadyStore }: LoadEffectArgs) {
  useEffect(() => {
    setError(null)
    setSelected(null)
    // в редакторе фоновой музыки нет (фидбек 9) и фоновых звуков тоже: иначе
    // щелчок по кнопке и гул локации перебивают предпрослушивание синтеза
    stopMusic(0.2)
    setAmbientAudioEnabled(false)
    // пустой base — на диске нет ни одной кампании: грузить нечего, снизу
    // покажем экран «Кампаний пока нет» с кнопкой создания
    if (!base) {
      setReadyStore(null)
      return
    }
    store
      .load()
      .then(() => {
        setReadyStore(store)
        // автопочинка при загрузке (битые правила, таблицы встреч не в своём
        // разделе манифеста): мастер должен видеть, что пакет был повреждён
        // и что именно редактор исправил на лету
        if (store.loadWarnings.length) {
          void showList(
            'Кампания исправлена при загрузке',
            store.loadWarnings,
            'В пакете были файлы, которые движок и редактор не могут читать как есть ' +
              '(правила без id/conditions или таблицы встреч в manifest.rules). ' +
              'Редактор разложил их по местам на лету — нажмите «Сохранить», чтобы починка осталась на диске.',
          )
        }
      })
      .catch((e) => setError(String(e)))
  }, [store, base, setError, setSelected, setReadyStore])
}

/**
 * Подписка на изменения стора: страница перерисовывается на каждый commit.
 * @param store стор редактора
 * @param force перерисовать страницу
 */
export function useEditorStoreSubscription(store: EditorStore, force: (updater: (n: number) => number) => void) {
  useEffect(() => store.subscribe(() => force((n) => n + 1)), [store, force])
}

/**
 * Плейтест — это уже игра: фоновые звуки включаются только в нём.
 * @param testCampaign запущенная тестовая кампания или null
 */
export function useEditorAmbientEffect(testCampaign: unknown) {
  // плейтест — это уже игра: возвращаем фоновые звуки движка, в редакторе их нет
  useEffect(() => {
    setAmbientAudioEnabled(!!testCampaign)
  }, [testCampaign])
}

/**
 * Клик вне меню раздела закрывает его.
 * @param openMenu открытое меню раздела
 * @param setOpenMenu сеттер открытого меню
 */
export function useEditorMenuCloseEffect(openMenu: string | null, setOpenMenu: Dispatch<SetStateAction<string | null>>) {
  useEffect(() => {
    if (!openMenu) return
    const close = () => setOpenMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [openMenu, setOpenMenu])
}

/** Меню шапки ведут себя как одно меню: открытие одного закрывает прочие. */
export function useEditorToolbarMenusEffect() {
  // Toolbar menus behave as one dismissible menu: outside click closes them,
  // and opening one closes any other toolbar menu.
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      const active = target instanceof Element ? target.closest('.editor-toolbar-menu') : null
      document.querySelectorAll<HTMLElement>('.editor-toolbar-menu[open]').forEach((menu) => {
        if (menu !== active) menu.removeAttribute('open')
      })
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])
}

/**
 * Реестр кампаний перечитывается при смене кампании.
 * @param args базовый путь и сеттер реестра
 */
export function useEditorCampaignIndexEffect({ base, setCampaigns }: IndexEffectArgs) {
  // реестр кампаний перечитывается при смене кампании: названия и описания
  // берём из файлов кампаний, поэтому импорт с новым названием сразу виден
  useEffect(() => {
    fetchCampaignIndex().then(setCampaigns)
  }, [base, setCampaigns])
}

/**
 * Ctrl+Z в редакторе нажимает кнопку «Отменить», кроме текстовых полей: там
 * отменяет сам браузер, иначе мастер не может стереть опечатку.
 * @param store стор редактора
 */
export function useEditorUndoKeysEffect(store: EditorStore) {
  const textLike = useMemo(
    () => new Set(['text', 'search', 'url', 'tel', 'email', 'password', 'number']),
    [],
  )
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // e.key на кириллической раскладке даёт «я» — сравниваем физическую
      // клавишу (KeyZ), чтобы Ctrl+Z работал независимо от раскладки
      if (!(e.ctrlKey || e.metaKey) || e.code !== 'KeyZ' || e.shiftKey) return
      const t = e.target as HTMLElement
      if (t.closest('.monaco-editor')) return
      // текстовое поле / textarea: отменяет сам браузер, магазин не трогаем
      if (t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && textLike.has((t as HTMLInputElement).type))) return
      if (store.canUndo()) {
        e.preventDefault()
        e.stopPropagation()
        store.undo()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [store, textLike])
}

/**
 * Автовыбор первой записи при входе в раздел.
 * @param args раздел, стор и сеттер выбранной записи
 */
export function useEditorAutoSelectEffect({ loaded, base, error, testCampaign, section, selected, store, setSelected }: AutoSelectEffectArgs) {
  // Автовыбор первой записи при входе в раздел.
  // ХУК — до любых early return (`!base` / error / !loaded / playtest):
  // иначе «Кампаний пока нет» → «Создать» даёт React «Rendered more hooks…».
  useEffect(() => {
    if (!loaded || !base || error || testCampaign) return
    if (['campaign', 'world', 'combat', 'design', 'packs', 'panels'].includes(section)) return
    if (selected) return
    let first: string | undefined
    try {
      if (section === 'scenes') first = store.scenePaths()[0]
      else if (section === 'entities') first = store.entityPaths()[0]
      else if (section === 'rules') first = store.rulePaths()[0]
      else if (section === 'quests') first = store.questPaths()[0]
      else if (section === 'dialogues') first = store.dialoguePaths()[0]
      else if (section === 'arenas') first = store.arenaPaths()[0]
      else if (section === 'cutscenes') first = store.cutscenePaths()[0]
      else if (section === 'recipes') first = store.recipePaths()[0]
      else if (section === 'codex') first = store.codexPaths()[0]
    } catch {
      return
    }
    if (first) setSelected(first)
  }, [loaded, base, error, testCampaign, section, selected, store, setSelected])
}
