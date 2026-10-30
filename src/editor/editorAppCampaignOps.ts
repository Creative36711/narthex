/**
 * Операции над кампанией в редакторе: реестр кампаний, создание, удаление,
 * сохранение, плейтест и правка метаданных.
 *
 * Вынесено из `EditorApp.tsx`: у этих операций один контекст — стор, базовый
 * путь и сеттеры состояния страницы. Функции остались прежними: тело перенесено
 * без изменений, контекст отдаётся параметром, чтобы страница не разрасталась.
 */

import { fetchCampaignIndex } from './campaignIndex'
import { dialogueTitle } from './dialogueIndex'
import { BUILTIN_CODEX_CATEGORIES } from '../shared/types'
import type { CampaignIndexEntry, CampaignData, CampaignMeta, ItemDef } from '../shared/types'
import { exportMonolith } from './monolith'
import { campaignFromMonolith } from './playtest'
import { resolveProjectModesForStudio } from './packCatalog'
import type { CapabilityProfile } from '../core/caps'
import { GameEngine } from '../core/engine'
import { setAmbientAudioEnabled, setAudioCampaign } from '../shared/audio'
import { setMusicCampaign } from '../shared/music'
import { campaignContentHash } from './campaignAudit'
import type { Dispatch, SetStateAction } from 'react'
import { campaignIdFromPath } from './editorMenus'
import type { PlaytestRecord } from './campaignAudit'
import { createCampaign, syncIndexEntry } from './newCampaign'
import { clearAiDiffSnapshot } from '../shared/aiBaseline'
import { askConfirm, askText, askTextArea, showAlert, showList } from './prompt'
import type { EditorStore, EditorSection, ManifestDef } from './store'

/** Состояние страницы редактора, нужное операциям над кампанией. */
export interface CampaignOpsCtx {
  store: EditorStore
  base: string
  campaigns: CampaignIndexEntry[]
  section: EditorSection
  selected: string | null
  setBase: Dispatch<SetStateAction<string>>
  setSection: Dispatch<SetStateAction<EditorSection>>
  setBusy: Dispatch<SetStateAction<string | null>>
  setCampaigns: Dispatch<SetStateAction<CampaignIndexEntry[]>>
  setSelected: Dispatch<SetStateAction<string | null>>
  setAiWizard: Dispatch<SetStateAction<boolean>>
  setAiTaskReport: Dispatch<SetStateAction<string>>
  setLastPlaytest: Dispatch<SetStateAction<PlaytestRecord | null>>
  setTestCampaign: Dispatch<SetStateAction<CampaignData | null>>
  setTestEngine: Dispatch<SetStateAction<GameEngine | null>>
  setDebugOpen: Dispatch<SetStateAction<boolean>>
  lastPlaytest: PlaytestRecord | null
  onExit: () => void
}

/**
 * Собрать операции над кампанией поверх текущего состояния страницы.
 * @param ctx стор, базовый путь и сеттеры редактора
 */
export function createCampaignOps(ctx: CampaignOpsCtx) {
  const { store, base, campaigns, section, selected, setSelected, setBase, setSection, setBusy, setCampaigns, setAiWizard, setAiTaskReport, setLastPlaytest, setTestCampaign, setTestEngine, setDebugOpen, lastPlaytest, onExit } = ctx

  const pushIndex = async (patch?: Partial<CampaignIndexEntry>) => {
    await syncIndexEntry({
      id: store.meta.id,
      title: store.meta.title,
      author: store.meta.author,
      description: store.meta.description,
      ...patch,
    })
    setCampaigns(await fetchCampaignIndex())
  }


  const updateCurrentCampaignDisplay = () => {
    const id = campaignIdFromPath(base)
    if (!id) return
    const entry: CampaignIndexEntry = {
      id,
      title: store.meta.title,
      author: store.meta.author,
      description: store.meta.description,
    }
    setCampaigns((list) => {
      const i = list.findIndex((item) => item.id === id)
      if (i < 0) return [...list, entry]
      const next = list.slice()
      next[i] = entry
      return next
    })
  }

  // undo: Ctrl+Z везде в редакторе НАЖИМАЕТ кнопку «Отменить» (фидбек №10:
  // «принцип простой — Ctrl+Z просто нажимает кнопку “Отменить”»). Родной
  // откат браузера в текстовых полях всё равно мёртв: каждое нажатие сразу
  // коммитится в магазин и переписывает DOM, стек браузера ломается.
  // Исключение — текстовые поля: там Ctrl+Z должен отменять правку текста
  // (правка фидбека №18), иначе мастер не может стереть опечатку.

  const newCampaign = async () => {
    const title = await askText('Название новой кампании', 'например «Тени Северного тракта»')
    if (!title) return
    setBusy('Создание кампании…')
    try {
      const id = await createCampaign(title)
      // подождать, пока dev-сервер начнёт отдавать новые файлы (иначе пустой экран)
      for (let i = 0; i < 10; i++) {
        const ok = await fetch(`/campaigns/${id}/campaign.json?t=${Date.now()}`).then((r) => r.ok).catch(() => false)
        if (ok) break
        await new Promise((r) => setTimeout(r, 250))
      }
      setSection('campaign')
      setSelected(null)
      setBase(`/campaigns/${id}`)
    } catch (e) {
      void showAlert('Не удалось создать кампанию', `${e}\n(Создание работает в dev-режиме vite / Tauri.)`)
    } finally {
      setBusy(null)
    }
  }


  const deleteCampaign = async () => {
    const cur = campaigns.find((c) => `/campaigns/${c.id}` === base)
    if (!cur) {
      void showAlert('Кампания не найдена в реестре', 'Обновите страницу и попробуйте ещё раз.')
      return
    }
    if (campaigns.length <= 1) {
      void showAlert('Нельзя удалить последнюю кампанию', 'Сначала создайте или импортируйте другую.')
      return
    }
    if (!(await askConfirm(`Удалить кампанию «${cur.title}» безвозвратно? Все её файлы будут стёрты с диска.`, 'Удалить навсегда'))) return
    setBusy('Удаление кампании…')
    try {
      const res = await fetch('/__editor/delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: cur.id }),
      })
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
      const next = campaigns.filter((c) => c.id !== cur.id)
      const saveRes = await fetch('/__editor/save', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: 'campaigns/index.json', text: JSON.stringify(next, null, 2) }),
      })
      if (!saveRes.ok) throw new Error(`${saveRes.status} ${await saveRes.text()}`)
      setCampaigns(next)
      // не оставляем в localStorage брошенный снимок базы правок мастера удалённой кампании
      clearAiDiffSnapshot(base)
      // удалили последнюю — редактор покажет пустой экран, а не путь в никуда
      setBase(next.length ? `/campaigns/${next[0].id}` : '')
    } catch (e) {
      void showAlert('Не удалось удалить кампанию', `${e}\n(Удаление работает в dev-режиме vite / Tauri.)`)
    } finally {
      setBusy(null)
    }
  }


  const exitEditor = () => onExit()

  const openAiTask = (report = '') => {
    setAiTaskReport(report)
    setAiWizard(true)
  }

  /** Импорт JSON: файл или вставленный текст. В пустом редакторе сразу создаём пакет. */

  const listFor = (s: EditorSection): Array<{ path: string; title: string; group?: string; groupOrder?: string }> => {
    switch (s) {
      case 'scenes':
        // группировка по локациям: мастеру проще искать нужную сцену (ревизия левой панели)
        return store.scenePaths().map((p) => {
          const sc = store.scene(p)
          const loc = sc?.location ? store.labelFor('location', sc.location) : ''
          return {
            path: p,
            title: sc?.label ?? p,
            group: loc || 'Без локации',
            groupOrder: loc ? `0${loc}` : '1',
          }
        })
      case 'entities':
        // группировка: персонажи, затем предметы по категориям (фидбек №8)
        return store.entityPaths().map((p) => {
          const e = store.entity(p)
          if (!e) return { path: p, title: p, type: 'item' as const }
          if (e.type === 'npc') return { path: p, title: e.label || p, type: 'npc' as const, group: 'Персонажи', groupOrder: '0' }
          const cat = store.labelFor('itemCategory', e.category)
          return { path: p, title: e.label || p, type: 'item' as const, group: `${cat}`, groupOrder: `1${cat}` }
        })
      case 'rules':
        return store.rulePaths().map((p) => ({ path: p, title: store.rule(p)?.label ?? p }))
      case 'quests':
        return store.questPaths().map((p) => ({ path: p, title: store.quest(p)?.label ?? p }))
      case 'dialogues':
        return store.dialoguePaths().map((p) => ({ path: p, title: dialogueTitle(store, p) }))
      case 'arenas':
        return store.arenaPaths().map((p) => ({ path: p, title: store.arena(p)?.label ?? p }))
      case 'cutscenes':
        return store.cutscenePaths().map((p) => ({ path: p, title: store.cutscene(p)?.label ?? p }))
      case 'recipes': {
        // группировка: починка отдельно, изготовление — по категории результата
        const out = []
        for (const p of store.recipePaths()) {
          const r = store.recipe(p)
          if (!r) { out.push({ path: p, title: p }); continue }
          if (r.repair) out.push({ path: p, title: r.label || p, group: 'Починка вещей', groupOrder: '1' })
          else {
            const item = (r.output?.item ? store.entity(`entities/${r.output.item}.json`) : undefined) as ItemDef | undefined
            const cat = item?.category ? store.labelFor('itemCategory', item.category) : ''
            out.push({ path: p, title: r.label || p, group: cat || 'Без категории', groupOrder: `0${cat}` })
          }
        }
        return out
      }
      case 'codex':
        // группировка по категориям кодекса (свои из меты, иначе встроенные; ядро — «Хроники»)
        return store.codexPaths().map((p) => {
          const ce = store.codexEntry(p)
          const cats = store.meta.codex_categories ?? BUILTIN_CODEX_CATEGORIES
          const cat = ce?.category ? (cats.find((c) => c.id === ce.category)?.label ?? ce.category) : 'Хроники'
          return { path: p, title: ce?.label ?? p, group: cat, groupOrder: cat }
        })
      default:
        return []
    }
  }

  /** создать элемент: мастер вводит название, id и имя файла генерируются сами */

  const removeSelected = async () => {
    if (!selected) return
    const title = listFor(section).find((i) => i.path === selected)?.title ?? selected
    if (!(await askConfirm(`Удалить «${title}»? (файл на диске останется)`, 'Удалить'))) return
    const fn = selected.split('/').pop()!
    const sectionKey = (section === 'dialogues' ? 'dialogues' : section) as keyof ManifestDef
    store.deleteFile(sectionKey, fn)
    if (section === 'dialogues') {
      // вместе с .ink убираем визуальный исходник конструктора
      const dlg = `dialogues/${fn.replace(/\.ink$/, '.dlg.json')}`
      store.jsonFiles.delete(dlg)
      store.dirty.delete(dlg)
    }
    setSelected(null)
  }


  const save = async () => {
    setBusy('Сохранение…')
    try {
      const stableId = campaignIdFromPath(base)
      if (!stableId) throw new Error('Не удалось определить неизменяемый id кампании из её каталога.')
      const rejectedId = store.meta.id !== stableId ? store.meta.id : undefined
      if (rejectedId) store.setCampaignId(stableId)

      await store.saveToDisk()
      await pushIndex()
      setBusy(null)
      if (rejectedId) {
        void showAlert(
          'ID кампании не изменён',
          `Кампания сохраняет свой ID «${stableId}». Значение «${rejectedId}» из импортированного JSON не применено. Чтобы создать отдельную копию, импортируйте пакет как новую кампанию.`,
        )
      }
    } catch (e) {
      setBusy(null)
      void showAlert('Ошибка сохранения', `${e}\n(Сохранение на диск работает в dev-режиме vite / Tauri.)`)
    }
  }


  const playtest = async (startSceneId?: string) => {
    try {
      const { doc, warnings } = exportMonolith(store)
      const problems = [...warnings, ...store.validateContent()]
      const campaign = campaignFromMonolith(doc)
      // Режимы возможностей проекта едут в плейтест ровно так, как их читает
      // ядро: структурный профиль (meta.caps + meta.project_cap_options) из core/caps.
      const runtimeMeta: CampaignMeta & CapabilityProfile = campaign.meta
      const capabilityModes = resolveProjectModesForStudio(store.project)
      if (capabilityModes.status === 'invalid') problems.push(capabilityModes.message)
      else if (capabilityModes.activeCaps !== null) runtimeMeta.caps = capabilityModes.activeCaps
      runtimeMeta.project_cap_options = store.project.cap_options
      campaign.basePath = base
      if (startSceneId) {
        let foundLoc = ''
        for (const reg of campaign.world.regions) {
          for (const loc of reg.locations) {
            if (loc.scenes.includes(startSceneId)) {
              foundLoc = loc.id
              break
            }
          }
          if (foundLoc) break
        }
        campaign.meta.starting_scene = startSceneId
        if (foundLoc) campaign.meta.starting_location = foundLoc
      }
      if (!campaign.meta.starting_scene || !campaign.scenes[campaign.meta.starting_scene]) {
        problems.push(`Стартовая сцена «${campaign.meta.starting_scene || 'не выбрана'}» не найдена.`)
      }
      if (problems.length) {
        void showList('Плейтест: проверьте кампанию', problems, 'Исправьте проблемы в редакторе и запустите проверку снова.')
        return
      }
      // Отдельный id гарантирует изоляцию автосохранений от настоящей кампании.
      campaign.meta.id = `${campaign.meta.id}__playtest`
      setLastPlaytest({ startedAt: Date.now(), finishedAt: 0, contentHash: campaignContentHash(store) })
      setTestCampaign(campaign)
      setMusicCampaign(campaign)
      setAudioCampaign(campaign)
      setAmbientAudioEnabled(true)
      if (startSceneId || !campaign.meta.char_creation) {
        const engine = new GameEngine(campaign)
        if (startSceneId) {
          engine.freshRun = false
        }
        engine.start()
        setTestEngine(engine)
        setDebugOpen(!!startSceneId)
      } else {
        setTestEngine(null)
        setDebugOpen(false)
      }
    } catch (e) {
      void showAlert('Не удалось подготовить плейтест', String(e))
    }
  }


  const recordPlaytestResult = async () => {
    const notes = await askTextArea('Результат плейтеста', {
      body: 'Запишите, что именно вы проверили, что сработало и какие ошибки встретились. Эта заметка попадёт в отчёт проверки и пакет задания для ИИ.',
      placeholder: 'Например: прошёл стартовый квест; переход из сцены в храм не срабатывает…',
      initial: lastPlaytest?.notes ?? '',
      ok: 'Сохранить результат',
    })
    if (notes === null) return
    setLastPlaytest((previous) => previous ? { ...previous, notes: notes.trim() } : { startedAt: Date.now(), finishedAt: 0, contentHash: '', notes: notes.trim() })
  }

  return { pushIndex, updateCurrentCampaignDisplay, newCampaign, deleteCampaign, exitEditor, openAiTask, listFor, removeSelected, save, playtest, recordPlaytestResult }
}

/** Операции над кампанией, собранные для страницы редактора. */
export type CampaignOps = ReturnType<typeof createCampaignOps>
