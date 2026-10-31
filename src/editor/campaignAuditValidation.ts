import { charCreationTemplateFindings } from '../core/charcreate'
import { featureOn, type DlgDoc, type DlgLine, type DlgStep, type DlgSection } from '../shared/types'
import type { EditorStore } from './store'
import type { AuditFinding, CampaignAuditReport, PlaytestRecord } from './campaignAuditTypes'
import { validatePackageSchema } from './campaignAuditSchema'
import { campaignContentHash, collectCampaignMedia, inspectAlphaRoles, inspectLocalMedia } from './campaignAuditMedia'

/**
 * Внешние функции, которые движок отдаёт в ink (`src/core/dialogue.ts`).
 * Если ink зовёт такую функцию без `EXTERNAL`, inkjs не компилирует файл:
 * проверяем отдельно, потому что симптом — «диалог просто не открылся».
 */
const ENGINE_INK_FNS = new Set([
  'get_flag', 'set_flag', 'add_item', 'remove_item', 'item_count', 'has_item',
  'skill_check', 'stat_roll', 'opposed_roll', 'get_disposition', 'change_disposition',
  'in_party', 'join_party', 'open_trade', 'open_craft', 'fire_rule', 'start_quest',
  'quest_stage', 'advance_time', 'change_need', 'change_hp', 'get_hp', 'get_hp_max',
  'get_mp', 'get_mp_max', 'get_luck', 'get_level', 'get_xp', 'get_run_day',
  'get_currency', 'get_need', 'get_stat', 'get_skill', 'get_player_name', 'sleep',
  'play_cutscene', 'set_description', 'apply_status', 'remove_status', 'has_status',
  'set_weather', 'weather_is', 'unlock_codex', 'unlock_recipe', 'roll_table', 'gen',
  'set_dialogue_timer', 'has_meta_achievement', 'get_meta_counter',
])

export async function validateCampaign(store: EditorStore, lastPlaytest?: PlaytestRecord | null): Promise<CampaignAuditReport> {
  let structure: AuditFinding[] = []
  try {
    structure.push(...store.validateContent().map((message) => ({ severity: 'error' as const, message })))
  } catch (error) {
    structure.push({ severity: 'error', message: `Проверка ссылок завершилась ошибкой: ${String(error)}` })
  }
  try {
    structure.push(...validatePackageSchema(store).map((message) => ({ severity: 'error' as const, message })))
  } catch (error) {
    structure.push({ severity: 'error', message: `Проверка JSON Schema завершилась ошибкой: ${String(error)}` })
  }
  if (store.meta.char_creation) {
    structure.push(...charCreationTemplateFindings(store.meta.char_creation).map((message) => ({
      severity: 'warning' as const,
      message: `Шаблон создания персонажа: ${message}`,
    })))
  }
  // Флаги без пояснения «для чего нужен»: человек ещё вспомнит сам, а ИИ-агент
  // и чужой мастер — нет. Для ИИ-кампаний поле обязательное (требование чемодана).
  for (const f of store.meta.flags ?? []) {
    if (!f.description?.trim()) {
      structure.push({
        severity: 'warning',
        message: `Флаг «${f.label}»: не заполнено поле «Для чего нужен» — без него непонятно, какое событие запоминает флаг и где он читается.`,
      })
    }
  }
  // Конфиг без рёбер, но с неожиданным поведением (аудит «Каркаса», 2026-10):
  // лагерь включён, нужды включены, а restore пуст — кнопка обещает сон, но
  // потребности ночлег не восстановит. Поведение остаётся мастерским, движок
  // только голосует одной строкой.
  if (store.meta.camping && featureOn(store.meta, 'needs') && (store.meta.needs?.length ?? 0) > 0 && !store.meta.camping.restore && !store.meta.camping.per_tick?.length) {
    structure.push({
      severity: 'warning',
      message: 'Лагерь включён (meta.camping), нужды включены, но ни meta.camping.restore, ни meta.camping.per_tick не заданы: ночлег ходит время, лечит раны и растит навыки, но потребности (в т.ч. отдых) не восстанавливает. Если сон должен восполнять — задайте в паспорте restore, например { "need_rest": 100 }, либо почасовое per_tick (за каждый час сна), например change_need "+12"; если задумано, что лагерь — только передышка, игнорируйте это предупреждение.',
    })
  }

  // ── длительные действия (dz.20) ───────────────────────────────────────────
  {
    const TICK_WHITELIST = new Set(['change_need', 'change_hp', 'change_fatigue', 'change_sanity'])
    const acts = store.meta.duration_actions ?? []
    const ruleIds = new Set(store.options('rule').map((o) => o.id))
    const seen = new Set<string>()
    for (const a of acts) {
      if (!a.id || seen.has(a.id)) {
        structure.push({ severity: 'error', message: `Длительное действие: пустой или повторяющийся id «${a.id}» — ссылки из эффекта «Начать длительное действие» неотличимы.` })
      }
      seen.add(a.id)
      const minT = a.min_ticks ?? 1
      const maxT = a.max_ticks ?? minT
      if (maxT < minT) {
        structure.push({ severity: 'error', message: `Длительное действие «${a.label || a.id}»: max_ticks (${maxT}) меньше min_ticks (${minT}) — игрок не сможет его запустить.` })
      }
      if (a.interrupt_rule && !ruleIds.has(a.interrupt_rule)) {
        structure.push({ severity: 'warning', message: `Длительное действие «${a.label || a.id}»: правило прерывания «${a.interrupt_rule}» не найдено в реестре правил.` })
      }
      if ((a.interrupt_chance_per_tick ?? 0) > 0 && !a.interrupt_rule) {
        structure.push({ severity: 'warning', message: `Длительное действие «${a.label || a.id}»: задан шанс прерывания, но не задано правило прерывания — сон просто оборвётся без события. Если так задумано, игнорируйте.` })
      }
      for (const fx of a.per_tick ?? []) {
        if (!TICK_WHITELIST.has(fx.type)) {
          structure.push({ severity: 'error', message: `Длительное действие «${a.label || a.id}»: почасовой эффект «${fx.type}» вне белого списка (разрешены change_need, change_hp, change_fatigue, change_sanity) — движок его пропустит. Вынесите его в on_finish, если он нужен по завершении.` })
        }
      }
      if (a.per_tick?.some((fx) => fx.type === 'change_need' && !store.meta.needs?.some((n) => n.id === (fx as { need?: string }).need))) {
        structure.push({ severity: 'warning', message: `Длительное действие «${a.label || a.id}»: почасовой эффект ссылается на потребность, которой нет в реестре нужд кампании.` })
      }
    }
    if (store.meta.camping) {
      const campMin = store.meta.camping.min_ticks ?? store.meta.camping.ticks ?? 8
      const campMax = store.meta.camping.max_ticks ?? store.meta.camping.ticks ?? 8
      if (campMax < campMin) {
        structure.push({ severity: 'error', message: `Лагерь: max_ticks (${campMax}) меньше min_ticks (${campMin}) — ночлег недоступен.` })
      }
      for (const fx of store.meta.camping.per_tick ?? []) {
        if (!TICK_WHITELIST.has(fx.type)) {
          structure.push({ severity: 'error', message: `Лагерь: почасовой эффект «${fx.type}» вне белого списка (разрешены change_need, change_hp, change_fatigue, change_sanity) — движок его пропустит.` })
        }
      }
    }
  }
  // ── рогалик и сохранения (обсуждение 2026-10): пермадет, обходимый ручным
  // слотом, не пермадет, а штраф смерти; честный железный рогалик = только
  // автосейв (стирается смертью), т.е. save_slots: 0 ────────────────────────
  if (store.meta.roguelike?.permadeath && (store.meta.save_slots ?? 3) > 0) {
    structure.push({
      severity: 'warning',
      message: `Рогалик с необратимой гибелью (permadeath), но ручных слотов сохранения ${store.meta.save_slots ?? 3}: смерть стирает только автосейв, ручной слот переживает забег и перезаписывает концовку. Для честного железного рогалика задайте save_slots: 0; если «снимок на всякий случай» задуман — игнорируйте.`,
    })
  }

  // ── спикеры реплик (# speaker): ссылка на NPC, не у ремарок, и физическое
  // присутствие — через условия (dz.22) ─────────────────────────────────────
  {
    const npcIds = new Set(store.options('npc').map((o) => o.id))
    // владелец диалога ищется по npc.dialogue, как в dlgScript
    const ownerOf = (path: string): string | undefined => {
      for (const ep of store.entityPaths()) {
        const e = store.entity(ep) as { type?: string; dialogue?: string } | undefined
        if (e?.type === 'npc' && e.dialogue === path) return (e as { id?: string }).id
      }
      return undefined
    }
    for (const f of store.manifest.dialogues ?? []) {
      const inkPath = `dialogues/${f}`
      const doc = store.jsonFiles.get(inkPath.replace(/\.ink$/, '.dlg.json')) as DlgDoc | undefined
      if (!doc?.nodes) continue
      const owner = ownerOf(inkPath)
      const lines: Array<{ l: DlgLine; where: string }> = []
      const walkSteps = (steps: DlgStep[] | undefined, where: string): void => {
        for (const st of steps ?? []) if (st.kind === 'line') lines.push({ l: st.line, where })
      }
      const walkSections = (secs: DlgSection[] | undefined, where: string): void => {
        for (const sec of secs ?? []) { walkSteps(sec.steps, where); walkSteps(sec.else_steps, where) }
      }
      for (const node of doc.nodes) {
        walkSections(node.sections, `узел «${node.label || node.id}»`)
        for (const ch of node.choices) {
          walkSections(ch.sections, `вариант «${ch.text.slice(0, 30)}…» узла «${node.id}»`)
          if (ch.check) {
            walkSections(ch.check.success.sections, `проверка (успех) узла «${node.id}»`)
            walkSections(ch.check.fail.sections, `проверка (провал) узла «${node.id}»`)
          }
        }
      }
      const foreign = new Set<string>()
      const docText = JSON.stringify(doc)
      for (const { l, where } of lines) {
        if (!l.speaker) continue
        if (l.action) {
          structure.push({ severity: 'error', message: `Диалог ${inkPath}, ${where}: у ремарки задан спикер «${l.speaker}» — ремарка это проза повествования, спикера у неё нет; движитель спикера проигнорирует.` })
          continue
        }
        if (!npcIds.has(l.speaker)) {
          structure.push({ severity: 'error', message: `Диалог ${inkPath}, ${where}: спикер «${l.speaker}» не найден в реестре NPC кампании.` })
          continue
        }
        if (owner && l.speaker !== owner) foreign.add(l.speaker)
      }
      for (const sp of foreign) {
        const partyGate = docText.includes('"in_party"') && docText.includes(`"${sp}"`)
        if (!partyGate) {
          structure.push({ severity: 'warning', message: `Диалог ${inkPath}: спикер «${sp}» говорит в чужом разговоре, но ни одна ветка не проверяет его присутствие (in_party/условием) — он может заговорить из пустоты. Отгейтуйте ветку условием присутствия спикера; если голос «из-за двери» задуман — игнорируйте.` })
        }
      }
    }
  }

  // Подписи реестров читает человек — и в редакторе, и в HUD (фидбек 27,
  // пп. 2 и 4). ИИ-агенты иногда кладут в label служебный код вида
  // «crime_intrusion=Проникновение в тоннели» или «price_blockade*1.5»:
  // такой реестр мастеру непонятен, а игроку показывается как есть.
  const registries: Array<{ what: string; items?: Array<{ id: string; label: string }> }> = [
    { what: 'навыки', items: store.meta.skills },
    { what: 'категории навыков', items: store.meta.skill_categories },
    { what: 'преступления', items: store.meta.crimes },
    { what: 'ценовые события', items: store.meta.price_events },
    { what: 'флаги', items: store.meta.flags },
    { what: 'состояния', items: store.meta.statuses },
    { what: 'потребности', items: store.meta.needs },
    { what: 'фракции', items: store.meta.factions },
    { what: 'страсти', items: store.meta.passions_list },
    { what: 'приверженности', items: store.meta.allegiances },
    { what: 'категории предметов', items: store.meta.item_categories },
  ]
  for (const reg of registries) {
    for (const item of reg.items ?? []) {
      const label = (item.label ?? '').trim()
      if (!label) continue
      const codeLike =
        label.includes('=') ||
        label.includes('*') ||
        label === item.id ||
        /^[a-z0-9_]+$/.test(label) && label.includes('_')
      if (codeLike) {
        structure.push({
          severity: 'warning',
          message: `Подпись в реестре (${reg.what}) «${label}» похожа на служебный код: её читает человек — и мастер в редакторе, и игрок в игре. Напишите название обычными словами, служебное имя подставится само.`,
        })
      }
    }
  }
  // Флаги, поставленные вне реестра meta.flags: сырой ink («~ set_flag») и
  // эффекты set_flag/clear_flag ставят их мимо реестра — такой флаг не имеет
  // описания для мастера, не виден в редакторе и ловится только в рантайме.
  // Внутренние динамические ключи движка (known_*, npc_known_* — «герой
  // знаком»; scene_state:* — состояние сцены) реестру не принадлежат.
  const flagInternal = (f: string): boolean => f.startsWith('known_') || f.startsWith('npc_known_') || f.startsWith('scene_state:')
  const flagUses = new Map<string, string>() // flag → где впервые увидели
  const noteFlag = (f: string, where: string): void => {
    if (!flagUses.has(f)) flagUses.set(f, where)
  }
  for (const [path, text] of store.textFiles) {
    if (!/^dialogues\/.+\.ink$/.test(path)) continue
    for (const m of text.matchAll(/~\s*(?:set_flag|clear_flag)\(\s*"([^"]+)"/g)) noteFlag(m[1]!, path)
  }
  const walkFlags = (value: unknown, where: string): void => {
    if (Array.isArray(value)) {
      for (const item of value) walkFlags(item, where)
      return
    }
    if (value && typeof value === 'object') {
      const rec = value as Record<string, unknown>
      if ((rec.type === 'set_flag' || rec.type === 'clear_flag') && typeof rec.flag === 'string') noteFlag(rec.flag, where)
      for (const item of Object.values(rec)) walkFlags(item, where)
    }
  }
  walkFlags(store.meta, 'campaign.json')
  walkFlags(store.world, 'world.json')
  for (const [path, doc] of store.jsonFiles) walkFlags(doc, path)
  const flagRegistry = new Set((store.meta.flags ?? []).map((f) => f.id))
  const flagOrphans = [...flagUses].filter(([f]) => !flagRegistry.has(f) && !flagInternal(f))
  if (flagOrphans.length) {
    const shown = flagOrphans.slice(0, 6).map(([f, where]) => `«${f}» (${where})`).join(', ')
    structure.push({
      severity: 'error',
      message: `Флаги ставятся в ink/эффектах, но отсутствуют в реестре meta.flags: ${shown}${flagOrphans.length > 6 ? ` и ещё ${flagOrphans.length - 6}` : ''}. Флаг вне реестра не имеет описания «для чего нужен» и не виден мастеру в редакторе. Добавьте его в реестр флагов (Паспорт кампании) с пояснением — так же как делает конструктор диалогов при первом сохранении.`,
    })
  }

  // Вызов внешней функции без объявления EXTERNAL: inkjs не компилирует файл,
  // и диалог молча не открывается — самая частая ошибка автора и ИИ.
  for (const [path, text] of store.textFiles) {
    if (!/^dialogues\/.+\.ink$/.test(path)) continue
    const declared = new Set([...text.matchAll(/^\s*EXTERNAL\s+([A-Za-z_][A-Za-z0-9_]*)/gm)].map((m) => m[1]))
    const missing = new Set<string>()
    for (const m of text.matchAll(/^\s*~\s*([A-Za-z_][A-Za-z0-9_]*)\s*\(/gm)) {
      const fn = m[1]
      if (ENGINE_INK_FNS.has(fn) && !declared.has(fn)) missing.add(fn)
    }
    for (const m of text.matchAll(/\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)) {
      const fn = m[1]
      if (ENGINE_INK_FNS.has(fn) && !declared.has(fn)) missing.add(fn)
    }
    if (missing.size) {
      structure.push({
        severity: 'error',
        message: `${path}: вызовы без объявления EXTERNAL — ${[...missing].join(', ')}. inkjs не скомпилирует файл, и диалог не откроется. Добавьте в начало файла строки вида «EXTERNAL ${[...missing][0]}(a0)» (число аргументов — как в вызове).`,
      })
    }
  }

  // Дедлайн на раздумье в диалоге (§9): цель обязана существовать в том же
  // файле, а слишком короткий дедлайн не даёт прочитать варианты — игрок
  // проигрывает не по решению, а по скорости чтения.
  for (const [path, text] of store.textFiles) {
    if (!/^dialogues\/.+\.ink$/.test(path)) continue
    const knots = new Set([...text.matchAll(/^===\s*([^\s=]+)\s*===/gm)].map((m) => m[1]))
    for (const m of text.matchAll(/set_dialogue_timer\(\s*(\d+)\s*(?:,\s*"([^"]*)")?\s*\)/g)) {
      const secs = Number(m[1])
      const knot = m[2] ?? ''
      if (secs > 0 && secs < 5) {
        structure.push({
          severity: 'warning',
          message: `${path}: таймер на раздумье — ${secs} с. Это меньше 5 секунд: игрок не успевает прочитать варианты ответа. Возьмите 8–15 секунд или уберите таймер.`,
        })
      }
      if (knot && !knots.has(knot)) {
        structure.push({
          severity: 'warning',
          message: `${path}: таймер ведёт в узел «${knot}», которого в файле нет. Добавьте «=== ${knot} ===» или оставьте второй аргумент пустым ("" — разговор заканчивается).`,
        })
      }
    }
  }

  // Ink: условие выбора, записанное ПОСЛЕ квадратных скобок, часть сборок
  // inkjs печатает как текстовую строку («true» посреди разговора, фидбек 27
  // п.6). Канонично — перед скобками: `+ { cond } [текст]`.
  for (const [path, text] of store.textFiles) {
    if (!/^dialogues\/.+\.ink$/.test(path)) continue
    const bad = text.split('\n').filter((l) => /^\s*\+\s*\[[^\]]*\]\s*\{/.test(l)).length
    if (bad) {
      structure.push({
        severity: 'warning',
        message: `${path}: условий после квадратных скобок выбора — ${bad}. inkjs может напечатать значение условия строкой в диалоге; перенесите условие перед скобками: «+ { условие } [текст]».`,
      })
    }
  }
  // Правила-«призраки»: после санитарной загрузки массивы всегда на месте,
  // но ручная правка JSON могла их убрать — ловим до выхода в игру.
  for (const p of store.rulePaths()) {
    const r = store.rule(p)
    if (!Array.isArray(r.conditions) || !Array.isArray(r.effects)) {
      structure.push({
        severity: 'error',
        message: `Правило «${r.label ?? r.id}» (${p}): отсутствуют массивы conditions/effects — правило сломает движок при старте.`,
      })
    }
    // Стартовые правила на нулевой тик или катсцену не должны блокироваться триггером time_tick
    const hasIntroCutscene = (r.effects ?? []).some((e) => e.type === 'play_cutscene')
    const hasZeroTick = (r.conditions ?? []).some((c) => c.type === 'tick_elapsed' && c.min_tick === 0)
    if ((hasZeroTick || hasIntroCutscene) && r.trigger === 'time_tick') {
      structure.push({
        severity: 'warning',
        message: `Правило «${r.label ?? r.id}» (${p}): вступительное правило имеет событийный триггер «time_tick». Чтобы катсцена и пролог запускались сразу при старте новой игры, выберите триггер «always» (по умолчанию) или оставьте поле пустым.`,
      })
    }
  }

  // Проверка звуков (пункт 10 аудита): опечатка в sound_id превращается в тишину.
  const declaredSounds = new Set<string>((store.meta.sounds ?? []).map((s) => s.id))
  const BUILTIN_SOUNDS = new Set([
    'click', 'travel', 'craft', 'message', 'open', 'use', 'drop',
    'equip', 'unequip', 'dialogue_present', 'travel_depart', 'travel_arrive',
    'panel_open', 'panel_close', 'panel:open', 'panel:close',
  ])
  const checkSoundRef = (soundId: string | undefined, context: string): void => {
    if (!soundId) return
    const id = soundId.trim()
    if (!id || /^(?:https?:|\/|\.\/|assets\/)/i.test(id)) return // прямой файл/URL
    if (!declaredSounds.has(id) && !BUILTIN_SOUNDS.has(id)) {
      structure.push({
        severity: 'warning',
        message: `${context}: звук «${id}» не найден в реестре meta.sounds кампании (опечатка будет звучать как тишина).`,
      })
    }
  }
  // Проверяем связи локаций
  for (const r of store.world.regions ?? []) {
    for (const l of r.locations ?? []) {
      for (const tc of l.travel_connections ?? []) {
        checkSoundRef(tc.sound, `Связь ${l.id} -> ${tc.to}`)
        checkSoundRef(tc.depart_sound, `Отправление ${l.id} -> ${tc.to}`)
        checkSoundRef(tc.arrive_sound, `Прибытие ${l.id} -> ${tc.to}`)
      }
    }
  }
  // Проверяем рецепты
  for (const p of store.recipePaths()) {
    const rc = store.recipe(p)
    checkSoundRef(rc.sound, `Рецепт «${rc.label || rc.id}»`)
    // экономика попыток (кейс «дыхатель», 2026-10): успех стоит часы, промах — бесплатен →
    // рациональный спам «Изготовить» обесценивает проверку навыка
    if (rc.skill && (rc.time_ticks ?? 0) > 0 && !(rc.fail_time_ticks ?? 0)) {
      structure.push({
        severity: 'warning',
        message: `Рецепт «${rc.label || rc.id}»: успех стоит ${rc.time_ticks} тик(ов), но время промаха (fail_time_ticks) не задано — неудачная попытка бесплатна, и игрок будет давить «Изготовить» до победы. Задайте время при неудаче (материалы остаются целыми); если бесплатный промах задуман — игнорируйте.`,
      })
    }
  }
  // Проверяем слоты сцен
  for (const p of store.scenePaths()) {
    const sc = store.scene(p)
    for (const st of sc.states ?? []) {
      checkSoundRef(st.sound, `Состояние «${st.label || st.id}» сцены ${sc.id}`)
    }
    for (const sl of sc.slots ?? []) {
      checkSoundRef(sl.sound, `Слот «${sl.label || sl.id}» сцены ${sc.id}`)
    }
  }
  // Проверяем статусы
  for (const st of store.meta.statuses ?? []) {
    checkSoundRef(st.apply_sound, `Статус «${st.label || st.id}» (apply_sound)`)
    checkSoundRef(st.remove_sound, `Статус «${st.label || st.id}» (remove_sound)`)
  }

  // фон там, где его быть не должно: эмблема меню, спрайты сцен, фигурки боя
  structure.push(...(await inspectAlphaRoles(store)))

  const mediaRefs = collectCampaignMedia(store)
  const localFindings = await inspectLocalMedia(store, mediaRefs.local)
  const media: AuditFinding[] = localFindings.filter((finding) => finding.severity !== 'info')
  if (mediaRefs.local.length && media.length === 0) {
    // аудит кампании 2026-10: проверка покрывает ССЫЛКИ на медиа в данных
    // кампании (json + ink), а не все файлы на диске — раньше строка звучала
    // как полное покрытие («786 vs 952»). Файлы без ссылок — легальные запасные,
    // движок их не удаляет и лимитов размера не применяет (политика без лимитов).
    media.push({ severity: 'info', message: `Проверено ссылок на локальные медиа в контенте кампании: ${mediaRefs.local.length}; все найдены. Проверка покрывает только упомянутые в данных пути — файлы на диске без ссылок не считаются и не удаляются.` })
  }
  for (const url of mediaRefs.external) {
    media.push({
      severity: 'warning',
      message: `Внешнее медиа требует сети и не включается автоматически в пакет: ${url}`,
    })
  }
  if (media.length === 0) media.push({ severity: 'info', message: 'Ссылок на медиафайлы не найдено.' })

  const playtest: AuditFinding[] = []
  if (!lastPlaytest) {
    playtest.push({ severity: 'info', message: 'После текущей версии кампании плейтест не запускался.' })
  } else if (lastPlaytest.contentHash !== campaignContentHash(store)) {
    playtest.push({ severity: 'warning', message: `Последний плейтест завершён ${new Date(lastPlaytest.finishedAt).toLocaleString()}; после него содержимое менялось — запустите плейтест повторно.` })
    if (lastPlaytest.notes?.trim()) playtest.push({ severity: 'info', message: `Записанный результат предыдущей версии: ${lastPlaytest.notes.trim()}` })
  } else {
    playtest.push({ severity: 'info', message: `Плейтест запускался ${new Date(lastPlaytest.startedAt).toLocaleString()} и завершён возвратом в редактор. Автоматическая оценка прохождения невозможна.` })
    if (lastPlaytest.notes?.trim()) playtest.push({ severity: 'info', message: `Результат мастера: ${lastPlaytest.notes.trim()}` })
    else playtest.push({ severity: 'warning', message: 'Результат прохождения не записан. Во время плейтеста нажмите «Записать результат».' })
  }
  playtest.push({ severity: 'info', message: 'Эта проверка не симулирует игровой маршрут. Для проверки взаимодействий используйте кнопку «Плейтест».' })

  return { checkedAt: Date.now(), structure, media, playtest }
}
